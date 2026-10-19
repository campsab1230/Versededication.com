// ============================================================
// DEV-ONLY. Measures whether a verse survives the certificate's
// 3-line verse box, or is silently truncated.
//
// The renderer wraps the verse at TEXT_W=430, shrinking 11.8 -> 9.0pt,
// but hard-caps at `maxLines = 3` and then does lines.slice(0, maxLines)
// — with NO ellipsis. Anything past line 3 is dropped from the PDF.
//
// Geometrically the box is 3 lines: verseTop 358, verseGap 21, and the
// reference sits at 426 (358 + 21*3 = 421, already colliding).
//
// This renders each verse through the REAL generateCertificatePdf and
// reads the result back with pdftotext, so the verdict is what a buyer
// would actually see.
//
// Run:
//   npx esbuild scripts/audit-verse-fit.mjs --bundle --platform=node \
//     --format=esm --outfile=scripts/_bundle_fit.mjs
//   node scripts/_bundle_fit.mjs
// ============================================================

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateCertificatePdf } from '../src/lib/certificate.js';

const OUT = '/tmp/versefit';
mkdirSync(OUT, { recursive: true });

// ---- gather the live (OLD) and seed (NEW) text for every verse ----

function envLocal() {
  const env = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const seed = readFileSync('db/seed.sql', 'utf8');
const rows = [...seed.matchAll(
  /\('([^']+)',\s*(\d+),\s*(\d+|null),\s*(\d+|null),\s*'([^']+)',\s*'([^']+)',\s*'((?:[^']|'')*)'/g
)];
const NEW = {};
for (const r of rows) NEW[r[5]] = r[7].replace(/''/g, "'");

const env = envLocal();
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;

async function liveText(ref) {
  const res = await fetch(
    `${base}/rest/v1/verses?reference=eq.${encodeURIComponent(ref)}&select=text_kjv`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } }
  );
  const j = await res.json();
  return j[0]?.text_kjv ?? null;
}

// ---- normalise for comparison ----
// pdftotext will re-wrap at the drawn line breaks; collapse whitespace,
// unify the curly quotes the renderer wraps the verse in, drop punctuation.
function norm(s) {
  return String(s || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const refs = Object.keys(NEW).sort();
const results = [];

for (const ref of refs) {
  const isFixed = await (async () => {
    const old = await liveText(ref);
    return old !== null && old !== NEW[ref];
  })();

  const report = { ref, changed: isFixed };
  for (const [label, text] of [['old', await liveText(ref)], ['new', NEW[ref]]]) {
    if (!text) { report[label] = 'n/a'; continue; }
    const bytes = await generateCertificatePdf({
      reference: ref,
      verseText: text,
      recipientName: 'Audit Recipient',
      dedicatorName: 'Audit Dedicator',
      isAnonymous: false,
      message: '',
      dedicationNumber: 1,
      date: '2026-10-19T00:00:00Z',
    });
    const pdf = `${OUT}/${label}-${ref.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
    writeFileSync(pdf, bytes);
    let drawn = '';
    try {
      drawn = execFileSync('pdftotext', ['-q', pdf, '-']).toString();
    } catch { /* ignore */ }

    const want = norm(text);
    const got = norm(drawn);
    // Does the drawn text contain the FULL verse, or only a prefix?
    const complete = got.includes(want);
    // If truncated, how much of the verse survived?
    let cov = 0;
    if (!complete) {
      const w = want.split(' ');
      let i = 0;
      while (i < w.length && got.includes(w.slice(0, i + 1).join(' '))) i++;
      cov = Math.round((i / w.length) * 100);
    }
    report[label] = complete ? 'FULL' : `TRUNCATED ${cov}%`;
    report[`${label}_chars`] = text.length;
  }
  results.push(report);
}

// ---- report ----
const w = (s, n) => String(s).padEnd(n);
console.log(w('reference', 24), w('old', 18), w('new', 18), 'chars o->n');
console.log('-'.repeat(78));
for (const r of results) {
  console.log(
    w(r.ref, 24),
    w(r.old, 18),
    w(r.new, 18),
    `${r.old_chars ?? '-'} -> ${r.new_chars ?? '-'}`
  );
}

const changed = results.filter((r) => r.changed);
const newTrunc = changed.filter((r) => r.new !== 'FULL');
const oldTrunc = changed.filter((r) => r.old !== 'FULL');
console.log('\n=== SUMMARY ===');
console.log(`verses changed:                 ${changed.length}`);
console.log(`  old truncated on certificate: ${oldTrunc.length}`);
console.log(`  new truncated on certificate: ${newTrunc.length}`);
console.log(`all 45 verses truncated (new):  ${results.filter((r) => r.new !== 'FULL').length}`);
writeFileSync('/tmp/versefit/results.json', JSON.stringify(results, null, 1));
console.log('\nfull results -> /tmp/versefit/results.json');
