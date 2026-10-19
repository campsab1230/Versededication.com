// ============================================================
// DEV-ONLY. End-to-end proof for a REAL customer path.
//
// Fetches verse text from the LIVE Supabase database (the same source
// /api/stripe-webhook uses) and renders it through the REAL
// generateCertificatePdf, then reads the PDF back with pdftotext.
//
// This is the check that matters: it exercises live data + production
// renderer together, including the `liga: false` text-layer fix.
//
// Run:
//   npx esbuild scripts/verify-live-certificate.mjs --bundle \
//     --platform=node --format=esm --outfile=scripts/_bundle_live.mjs
//   node scripts/_bundle_live.mjs
// ============================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateCertificatePdf } from '../src/lib/certificate.js';

const OUT = '/tmp/livecert';
mkdirSync(OUT, { recursive: true });

function envLocal() {
  const env = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = envLocal();
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;

async function verse(ref) {
  const res = await fetch(
    `${base}/rest/v1/verses?reference=eq.${encodeURIComponent(ref)}&select=reference,text_kjv,featured`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } }
  );
  const j = await res.json();
  return j[0] || null;
}

// Verses chosen to cover: a formerly-truncated featured verse, an
// fl-containing verse, and the longest corrected text.
const REFS = [
  'Psalm 23:1-4',
  'Genesis 2:24',
  'Matthew 17:20',
  'Numbers 6:24-26',
  '1 Corinthians 13:4-7',
  'Song of Solomon 8:7',
];

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

const rows = [];
for (const ref of REFS) {
  const v = await verse(ref);
  if (!v) { rows.push({ ref, status: 'MISSING FROM DB' }); continue; }

  const bytes = await generateCertificatePdf({
    reference: v.reference,
    verseText: v.text_kjv,
    recipientName: 'Sarah Mitchell',
    dedicatorName: 'James',
    isAnonymous: false,
    message: '',
    dedicationNumber: 1042,
    date: '2026-10-19T00:00:00Z',
  });
  const pdf = `${OUT}/${ref.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  writeFileSync(pdf, bytes);

  let drawn = '';
  try { drawn = execFileSync('pdftotext', ['-q', pdf, '-']).toString(); } catch {}

  const want = norm(v.text_kjv);
  const got = norm(drawn);
  const complete = got.includes(want);
  let cov = 100;
  if (!complete) {
    const w = want.split(' ');
    let i = 0;
    while (i < w.length && got.includes(w.slice(0, i + 1).join(' '))) i++;
    cov = Math.round((i / w.length) * 100);
  }
  rows.push({
    ref,
    status: complete ? 'FULL' : `PARTIAL ${cov}%`,
    chars: v.text_kjv.length,
    featured: v.featured,
    pdf,
  });
}

const w = (s, n) => String(s).padEnd(n);
console.log(w('reference', 24), w('live text on certificate', 26), w('chars', 7), 'featured');
console.log('-'.repeat(72));
for (const r of rows) {
  console.log(w(r.ref, 24), w(r.status, 26), w(r.chars ?? '-', 7), r.featured ?? '');
}
const bad = rows.filter((r) => r.status !== 'FULL');
console.log();
console.log(bad.length ? `FAIL: ${bad.length} verse(s) not fully drawn` : 'PASS: every live verse renders complete on the certificate');
