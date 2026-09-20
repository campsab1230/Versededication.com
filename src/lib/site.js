// ============================================================
// Central site configuration.
// Edit copy/branding here instead of hunting through pages.
// ============================================================

export const SITE_NAME = 'Verse 4 You';
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

// The charitable share. Keep this in ONE place so copy, checkout,
// receipts and legal pages can never drift apart.
export const CHARITY_PERCENT = 10;
export const CHARITY_DESCRIPTION =
  'donated to support Bible translation work, so Scripture can reach people who do not yet have it in their own language.';

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@verse4you.com';

export const MAX_MESSAGE_LENGTH = 140;
