// Test harness: render a sample certificate to /tmp and rasterize for review.
// Bundled with esbuild because the module is ESM + uses the `@/` alias style
// imports resolved by Next at build time.
import { writeFileSync } from 'node:fs';
import { generateCertificatePdf } from '../src/lib/certificate.js';

const samples = {
  full: {
    reference: 'Numbers 6:24-26',
    verseText:
      'The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace.',
    recipientName: 'A Special Person',
    dedicatorName: 'Michael & Sarah Bennett',
    isAnonymous: false,
    message: 'With all our love on your baptism day.',
    dedicationNumber: 1,
  },
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
  minimal: {
    reference: 'John 3:16',
    verseText: 'For God so loved the world, that he gave his only begotten Son.',
    recipientName: 'Grace',
    dedicatorName: 'Grandma Ruth',
    isAnonymous: false,
    message: '',
    dedicationNumber: 7,
  },
};

const which = process.argv[2] || 'full';
const input = samples[which] || samples.full;

const bytes = await generateCertificatePdf(input);
writeFileSync(`/tmp/cert-${which}.pdf`, bytes);
console.log(`wrote /tmp/cert-${which}.pdf`, bytes.length, 'bytes');
