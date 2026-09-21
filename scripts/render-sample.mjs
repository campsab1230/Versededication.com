// ============================================================
// DEV-ONLY test harness. Renders sample certificates to /tmp and
// rasterizes them so the layout can be reviewed by eye.
//
// ⚠️  Everything below is FAKE TEST INPUT. None of it ships to
//     users and none of it is baked into the certificate design.
//     The real certificate is rendered at purchase time from the
//     buyer's own details (see /api/stripe-webhook). Values here
//     are written as "[SLOT]" markers on purpose, so a rendered
//     sample can never be mistaken for template content.
//
// Run:
//   npx esbuild scripts/render-sample.mjs --bundle --platform=node \
//     --format=esm --outfile=scripts/_bundle.mjs
//   node scripts/_bundle.mjs full|anonLong|minimal|noNames
//
// `noNames` exists specifically to prove the renderer draws NO
// name when it is not given one, rather than inventing a fallback.
// ============================================================

import { writeFileSync } from 'node:fs';
import { generateCertificatePdf } from '../src/lib/certificate.js';

const samples = {
  // A complete, typical order.
  full: {
    reference: 'Numbers 6:24-26',
    verseText:
      'The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace.',
    recipientName: '[RECIPIENT NAME]',
    dedicatorName: '[DEDICATOR NAME]',
    isAnonymous: false,
    message: '[OPTIONAL MESSAGE]',
    dedicationNumber: 1,
    date: '2026-09-21T00:00:00Z',
  },

  // Anonymous buyer, long verse, accented recipient name.
  anonLong: {
    reference: 'Psalm 23:1-4',
    verseText:
      'The Lord is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul: he leadeth me in the paths of righteousness for his name\u2019s sake.',
    recipientName: 'Jos\u00e9 Mar\u00eda Fern\u00e1ndez-W\u00fcst',
    dedicatorName: '',
    isAnonymous: true,
    message: '',
    dedicationNumber: 1042,
  },

  // Shortest realistic case.
  minimal: {
    reference: 'John 3:16',
    verseText: 'For God so loved the world, that he gave his only begotten Son.',
    recipientName: '[RECIPIENT NAME]',
    dedicatorName: '[DEDICATOR NAME]',
    isAnonymous: false,
    message: '',
    dedicationNumber: 7,
  },

  // REGRESSION GUARD: no names at all. The certificate must come out
  // with the name lines simply absent — never a substitute name.
  noNames: {
    reference: 'Numbers 6:24-26',
    verseText:
      'The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you.',
    recipientName: '',
    dedicatorName: '',
    isAnonymous: false,
    message: '',
    dedicationNumber: 99,
  },
};

const which = process.argv[2] || 'full';
const input = samples[which] || samples.full;

const bytes = await generateCertificatePdf(input);
writeFileSync(`/tmp/cert-${which}.pdf`, bytes);
console.log(`wrote /tmp/cert-${which}.pdf`, bytes.length, 'bytes');
