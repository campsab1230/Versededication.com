// ============================================================
// Central site configuration.
// Edit copy/branding here instead of hunting through pages.
// ============================================================

export const SITE_NAME = 'Verse Dedication';
export const SITE_TAGLINE = 'Faith · Love · Always';
export const SITE_KICKER = 'A word for today. A light for tomorrow.';
export const SITE_DESCRIPTION =
  'Dedicate a Bible verse to someone you love. A gift that says more than words ever could.';

// ============================================================
// CANONICAL HOST
//
// The apex domain (versededication.com) 308-redirects to www in
// Vercel. That redirect is harmless in a browser and FATAL for
// anything that does not follow it:
//
//   * Stripe webhooks — a 308 counts as a failed delivery. This is
//     exactly how every event was lost before the endpoint URL was
//     changed to www. Do not reintroduce it.
//   * Share/link preview crawlers — Facebook, X, WhatsApp and Slack
//     fetchers frequently render a blank card for a redirecting URL
//     rather than following to the final page.
//
// So every URL this app EMITS (canonical, og:url, share links,
// Stripe success/cancel URLs) must name the host that actually
// serves the response. Normalising here means it cannot drift from
// whatever NEXT_PUBLIC_SITE_URL happens to be set to.
//
// Deliberately a fixed map, not a general "strip the apex" rule:
// localhost, *.vercel.app previews and any other host are left
// completely alone.
// ============================================================
const CANONICAL_HOST_OVERRIDES = {
  'versededication.com': 'www.versededication.com',
};

function normalizeCanonicalHost(base) {
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    // Not a parseable absolute URL — hand it back untouched rather than
    // guessing. A malformed base should look wrong, not silently change.
    return base;
  }

  const target = CANONICAL_HOST_OVERRIDES[parsed.hostname.toLowerCase()];
  if (!target) return base;

  parsed.hostname = target;
  return parsed.toString().replace(/\/+$/, '');
}

// Public base URL, no trailing slash, always on the canonical host.
// Falls back to localhost during dev.
export function siteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000';
  return normalizeCanonicalHost(raw.replace(/\/+$/, ''));
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

// ============================================================
// BUSINESS — the identity shown on /contact. Payment providers
// and consumer-protection rules expect a reachable name and
// address, so keep this accurate.
//
// ⚠️  "Verse Dedication" is currently a TRADING name, not a
//     registered legal entity. California requires a Fictitious
//     Business Name statement (county filing + newspaper
//     publication) to trade under a name that is not your own
//     legal name, and payment providers may ask for it. Forming
//     an LLC is the alternative. Until one of those is done,
//     this page describes a sole proprietorship trading as
//     "Verse Dedication".
//
// Change these values in ONE place and /contact updates.
// ============================================================
export const BUSINESS = {
  name: 'Verse Dedication',
  // A PO Box satisfies most payment-provider and consumer-notice
  // requirements. Some formal notices need a street address —
  // update this if you get a physical premises.
  addressLines: ['PO Box 173', 'Samoa, CA 95564'],
  // Location only. Deliberately NOT worded as "registered in" —
  // there is no registered legal entity yet (see note above).
  location: 'California, United States',
};

// Where customer mail goes AND where verse-request notifications are sent.
// The fallback is deliberate: NEXT_PUBLIC_* vars are inlined at build time, so
// relying on the env var alone silently ships a dead address when it is unset.
// A real, monitored inbox here means the site never advertises an address that
// bounces, and admin notifications have somewhere to land.
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'verserequesting@gmail.com';

export const MAX_MESSAGE_LENGTH = 140;

// Admin route protection. Set ADMIN_SECRET in your env to enable /admin.
export const ADMIN_COOKIE = 'vd_admin';
