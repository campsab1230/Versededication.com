// ============================================================
// DEV-ONLY. Ground-truth truncation audit.
//
// The first version of this audit compared pdftotext output against
// the source text with string matching. That produced a FALSE POSITIVE:
// "flesh" extracted as "esh" (dropped "fl"), so Genesis 2:24 — which
// actually fits in 3 lines — was reported as "TRUNCATED 95%".
//
// String matching against extracted text is therefore not trustworthy.
// This version reproduces the renderer's exact wrap loop using the real
// embedded font metrics, so the answer is the renderer's own behaviour,
// not a guess about extraction.
//
// Mirrors certificate.js:
//   const maxLines = 3;
//   let size = 11.8;
//   let lines = wrapText(`“${quote}”`, crimIt, size, TEXT_W);
//   while (lines.length > maxLines && size > 9) { size -= 0.4; ... }
//   if (lines.length > maxLines) lines = lines.slice(0, maxLines);
//
// Run:
//   npx esbuild scripts/audit-verse-fit2.mjs --bundle --platform=node \
//     --format=esm --outfile=scripts/_bundle_fit2.mjs
//   node scripts/_bundle_fit2.mjs
// ============================================================

import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { CrimsonItalic } from '../src/lib/certificateFonts.js';

const TEXT_W = 430;
const MAX_LINES = 3;

const b64ToBytes = (b64) => Uint8Array.from(Buffer.from(b64, 'base64'));

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

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

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const crimIt = await pdf.embedFont(b64ToBytes(CrimsonItalic), { subset: false });

/** Reproduce the renderer's fit + truncation exactly. */
function analyse(text) {
  const quote = String(text || '').trim();
  if (!quote) return { lines: 0, size: null, fits: true, kept: 0, lost: 0 };
  let size = 11.8;
  let lines = wrapText(`\u201c${quote}\u201d`, crimIt, size, TEXT_W);
  while (lines.length > MAX_LINES && size > 9) {
    size -= 0.4;
    lines = wrapText(`\u201c${quote}\u201d`, crimIt, size, TEXT_W);
  }
  const rawCount = lines.length;
  const kept = lines.slice(0, MAX_LINES);
  const keptText = kept.join(' ');
  const lostChars = Math.max(0, quote.length - keptText.replace(/[\u201c\u201d]/g, '').length);
  return {
    lines: rawCount,
    size: Math.round(size * 10) / 10,
    fits: rawCount <= MAX_LINES,
    kept: keptText.length,
    lost: lostChars,
    lostPct: Math.round((lostChars / (quote.length + 2)) * 100),
  };
}

const refs = Object.keys(NEW).sort();
const out = [];
for (const ref of refs) {
  const old = await liveText(ref);
  const nw = NEW[ref];
  out.push({ ref, old: analyse(old), new: analyse(nw), changed: old !== nw, oldText: old, newText: nw });
}

const w = (s, n) => String(s).padEnd(n);
console.log(w('reference', 24), w('old lines', 10), w('new lines', 10), w('new size', 9), 'verdict');
console.log('-'.repeat(80));
for (const r of out) {
  const verdict =
    !r.new.fits && !r.old.fits ? 'both truncated' :
    !r.new.fits ? 'NEW TRUNCATES' :
    !r.old.fits ? 'new fixes truncation' : 'ok';
  console.log(
    w(r.ref, 24),
    w(r.old.lines + (r.old.fits ? '' : '!'), 10),
    w(r.new.lines + (r.new.fits ? '' : '!'), 10),
    w(r.new.size ?? '-', 9),
    verdict
  );
}

const changed = out.filter((r) => r.changed);
const regressions = changed.filter((r) => r.new.fits === false && (r.old.fits === true || r.new.lost > r.old.lost));
console.log('\n=== SUMMARY ===');
console.log(`changed:                       ${changed.length}`);
console.log(`NEW truncates (was ok):        ${changed.filter((r) => !r.new.fits && r.old.fits).length}`);
console.log(`already truncated, unchanged:  ${out.filter((r) => !r.changed && !r.new.fits).length}`);
console.log(`new truncates (of all 45):     ${out.filter((r) => !r.new.fits).length}`);
console.log(`old truncates (of all 45):     ${out.filter((r) => !r.old.fits).length}`);
console.log('\n=== VERSES THAT GET WORSE ON THE CERTIFICATE ===');
for (const r of regressions) {
  console.log(`  ${r.ref}`);
  console.log(`     old: ${r.old.lines} lines, fits=${r.old.fits}, lost ${r.old.lost} chars`);
  console.log(`     new: ${r.new.lines} lines, fits=${r.new.fits}, lost ${r.new.lost} chars (${r.new.lostPct}%)`);
}
const fix = changed.filter((r) => r.new.fits && !r.old.fits);
console.log(`\n=== VERSES THE FIX HELPS === (${fix.length})`);
for (const r of fix) console.log(`  ${r.ref}: ${r.old.lines} lines -> ${r.new.lines} lines`);
console.log(`\n=== CHANGED VERSES THAT STILL FIT (${changed.filter((r) => r.new.fits).length} of ${changed.length}) ===`);
