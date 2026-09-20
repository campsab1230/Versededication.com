// ============================================================
// Central site configuration.
// Edit copy/branding here instead of hunting through pages.
// ============================================================

export const SITE_NAME = 'Verse Dedication';
export const SITE_TAGLINE = 'Faith · Love · Always';
export const SITE_KICKER = 'A word for today. A light for tomorrow.';
export const SITE_DESCRIPTION =
  'Dedicate a Bible verse to someone you love. A gift that says more than words ever could.';

// Public base URL, no trailing slash. Falls back to localhost during dev.
export function siteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

export const BIBLE_TRANSLATION = 'King James Version';
export const BIBLE_TRANSLATION_ABBR = 'KJV';

// ============================================================
// CHARITY — the 10% recipient.
//
// Change these values in ONE place and the home page, footer,
// legal pages and certificate footer all update together.
//
// ⚠️  Before you launch with a named organisation, get their
//     written OK to be referenced in your commercial marketing.
//     See docs/LEGAL_CHECKLIST.md.
// ============================================================
export const CHARITY = {
  name: 'Pioneer Bible Translators',
  shortName: 'Pioneer Bible Translators',
  url: 'https://pioneerbible.org/donate/',
  ein: '23-7433923',
  location: 'Dallas, Texas',
  // Verified via their transparency page + Charity Navigator + Candid + ECFA.
  accountability:
    'Charity Navigator top rating · Candid Platinum transparency · ECFA accredited',
  blurb:
    'They translate Scripture into languages that have never had it — and train local translators to keep the work going.',
};

// The charitable share. Keep this in ONE place so copy, checkout,
// receipts and legal pages can never drift apart.
export const CHARITY_PERCENT = 10;
export const CHARITY_DESCRIPTION = `donated to ${CHARITY.name}, so Scripture can reach people who do not yet have it in their own language.`;

// Convenience blurb used across the site.
export const CHARITY_SENTENCE = `${CHARITY_PERCENT}% of every purchase is given to ${CHARITY.name}.`;

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@versededication.com';

export const MAX_MESSAGE_LENGTH = 140;

// Admin route protection. Set ADMIN_SECRET in your env to enable /admin.
export const ADMIN_COOKIE = 'vd_admin';
