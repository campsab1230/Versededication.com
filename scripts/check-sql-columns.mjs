#!/usr/bin/env node
/**
 * check-sql-columns.mjs — preflight guard against referencing a column that
 * does not exist.
 *
 * WHY THIS EXISTS
 * ---------------
 * A generated `update verses set text_kjv = ..., updated_at = now()` shipped
 * to the customer's SQL Editor and failed with:
 *
 *     42703: column "updated_at" of relation "verses" does not exist
 *
 * The pattern was copy-pasted from `dedications`, which *does* have
 * `updated_at`. `verses` does not. Nothing checked the generated SQL against
 * the real column list, so the error surfaced only when a human pasted it.
 *
 * WHAT IT DOES
 * ------------
 * Parses every `insert into <tbl> (...)` and `update <tbl> set <col> = ...`
 * out of the given SQL files and asserts each referenced column exists.
 * The column list is read from the LIVE Supabase schema (ground truth) via
 * the PostgREST OpenAPI spec; falls back to db/schema.sql when offline.
 *
 * USAGE
 *   node scripts/check-sql-columns.mjs                      # default: db/*.sql
 *   node scripts/check-sql-columns.mjs db/seed.sql /tmp/x.sql
 *   node scripts/check-sql-columns.mjs --offline            # use schema.sql
 *
 * Exit code 0 = every column exists. 1 = unknown column found.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA = join(ROOT, 'db', 'schema.sql')

// ---- 1. Build the authoritative column map -------------------------------

function columnsFromSchemaSql() {
  // Parse `create table [if not exists] <name> ( ... );`
  const src = readFileSync(SCHEMA, 'utf8')
  const map = {}
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi
  let m
  while ((m = re.exec(src))) {
    const [, table, body] = m
    const cols = []
    for (const raw of body.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('--')) continue
      // skip table-level constraints
      if (/^(primary|foreign|unique|check|constraint|exclude)\b/i.test(line)) continue
      const col = line.match(/^(\w+)\s+\S/)
      if (col) cols.push(col[1])
    }
    map[table] = cols
  }
  return map
}

/** Minimal .env.local reader so `npm run check:sql` works without exporting. */
function loadEnvLocal() {
  const p = join(ROOT, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (!(m[1] in process.env)) process.env[m[1]] = val
  }
}

async function columnsFromLive() {
  loadEnvLocal()
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')
  // service_role is required: the browser-format `sb_publishab…` anon key is
  // rejected (401) by the /rest/v1/ introspection endpoint.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`OpenAPI fetch failed: HTTP ${res.status}`)
  const spec = await res.json()
  const map = {}
  for (const [name, def] of Object.entries(spec.definitions || spec.components?.schemas || {})) {
    map[name] = Object.keys(def.properties || {})
  }
  if (!Object.keys(map).length) throw new Error('OpenAPI spec contained no tables')
  return map
}

// ---- 2. Extract table/column references from SQL --------------------------

/** Blank out string literals so their contents can't be mistaken for SQL. */
function stripLiterals(sql) {
  return sql.replace(/'(?:[^']|'')*'/g, "''")
}

function extractRefs(sql) {
  const refs = []
  const clean = stripLiterals(sql)

  // insert into <tbl> (a, b, c)
  const ins = /insert\s+into\s+(?:public\.)?(\w+)\s*\(([^)]*)\)/gi
  let m
  while ((m = ins.exec(clean))) {
    for (const c of m[2].split(',')) {
      const name = c.trim().match(/^(\w+)$/)
      if (name) refs.push({ table: m[1], column: name[1], kind: 'insert' })
    }
  }

  // update <tbl> set <col> = ..., <col> = ...
  // The SET clause is taken up to the first `where` at a line start, which is
  // how these files are formatted; that avoids semicolons inside literals.
  const upd = /update\s+(?:public\.)?(\w+)\s+set\s+([\s\S]*?)(?=\n\s*where\b)/gi
  while ((m = upd.exec(clean))) {
    const table = m[1]
    for (const assign of m[2].split(',')) {
      const col = assign.match(/^\s*(\w+)\s*=/)
      if (col) refs.push({ table, column: col[1], kind: 'update' })
    }
  }
  return refs
}

// ---- 3. Run ---------------------------------------------------------------

const args = process.argv.slice(2)
const offline = args.includes('--offline')
const files = args.filter((a) => !a.startsWith('--'))

const targets = files.length
  ? files
  : existsSync(join(ROOT, 'db'))
    ? readdirSync(join(ROOT, 'db'))
        .filter((f) => f.endsWith('.sql'))
        .map((f) => join(ROOT, 'db', f))
    : []

if (!targets.length) {
  console.error('no SQL files to check')
  process.exit(1)
}

let columns
if (offline) {
  columns = columnsFromSchemaSql()
  console.log('column source: db/schema.sql (offline)')
} else {
  try {
    columns = await columnsFromLive()
    console.log('column source: LIVE Supabase OpenAPI')
  } catch (err) {
    console.warn(`live schema unavailable (${err.message}) — falling back`)
    columns = columnsFromSchemaSql()
    console.log('column source: db/schema.sql (offline)')
  }
}

console.log(`tables known: ${Object.keys(columns).sort().join(', ')}\n`)

let bad = 0
for (const file of targets) {
  const refs = extractRefs(readFileSync(file, 'utf8'))
  const errors = []
  for (const { table, column, kind } of refs) {
    const known = columns[table]
    if (!known) {
      errors.push(`  ${kind}: table "${table}" not in schema`)
    } else if (!known.includes(column)) {
      errors.push(
        `  ${kind}: ${table}.${column} DOES NOT EXIST` +
          (known.includes(`${column.replace(/_(at|by)$/, '')}_at`)
            ? ''
            : ` (available: ${known.join(', ')})`)
      )
    }
  }
  const label = basename(file)
  if (errors.length) {
    console.log(`FAIL  ${label}  (${refs.length} refs, ${errors.length} bad)`)
    for (const e of errors) console.log(e)
    bad += errors.length
  } else if (refs.length === 0) {
    // ⚠️  This checker only parses `insert into t (cols)` and `update t set col`.
    // A read-only file (SELECT-only) therefore yields zero refs, and printing a
    // plain "ok" here once let a green tick stand in for real verification on
    // db/verify-fulfilment.sql — which validated nothing. Say so explicitly so
    // the absence of coverage can never be mistaken for coverage.
    console.log(`SKIP  ${label}  (0 refs — no insert/update columns in this file)`)
  } else {
    console.log(`ok    ${label}  (${refs.length} column refs verified)`)
  }
}

console.log()
if (bad) {
  console.log(`RESULT: ${bad} unknown column reference(s) — do NOT ship this SQL.`)
  process.exit(1)
}
console.log('RESULT: all column references exist.')
