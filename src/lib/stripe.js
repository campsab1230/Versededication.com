import Stripe from 'stripe';

// ============================================================
// SERVER-ONLY Stripe client.
// ⚠️  Only import from API routes — never from components.
//
// WHY THERE IS A LIST OF VARIABLE NAMES
// Vercel's Stripe Marketplace integration provisions keys under
// whatever name the integration chooses, and a hand-created variable
// can be scoped to Preview/Development only. Both produce an app that
// is deployed, healthy, and silently unable to charge a card.
//
// So we accept the common aliases and report WHICH one we used.
// A key that is present under a name we do not know would otherwise
// be indistinguishable from a key that does not exist at all.
// ============================================================

// Checked in order; first non-empty wins.
export const KEY_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_LIVE_SECRET_KEY',
  'STRIPE_SECRET_KEY_LIVE',
  'STRIPE_API_KEY',
  'STRIPE_KEY',
];

// ============================================================
// LAST-RESORT FALLBACK: ADMIN_SECRET
//
// The live key was placed in ADMIN_SECRET, which is also the /admin login
// password. Rather than leave checkout returning 500 while that gets sorted
// out, we read it from there too — but ONLY when the value actually looks
// like a Stripe key.
//
// The shape check is essential. ADMIN_SECRET normally holds a random admin
// password, and blindly feeding that to the Stripe SDK produces a 401 from
// Stripe that looks like "your key is wrong" when the real problem is "you
// never set a key". Requiring the `sk_`/`rk_` prefix means either the value
// IS a usable key, or we correctly report it as missing.
//
// ⚠️  This is a stopgap, not a design. A live payment secret that doubles as
// a web-form password is exposed to everything that captures form input:
// password managers, browser sync, extensions, and shoulder-surfing over a
// 107-character paste. Once payments are confirmed working, create a real
// STRIPE_SECRET_KEY and replace ADMIN_SECRET with a random string.
// ============================================================
export const FALLBACK_KEY_VAR = 'ADMIN_SECRET';

/**
 * True when a value is shaped like any Stripe API secret key.
 *
 * ⚠️  The LENGTH and ELLIPSIS checks are load-bearing, not defensive padding.
 * Stripe's dashboard shows a *masked label* by default — `sk_live_...55Rm` —
 * and that string starts with `sk_live_`, so a prefix test alone reports it as
 * a valid live key. It is not: it is nine characters of display text plus an
 * ellipsis. Feeding it to the SDK yields a 401 that reads like "your key is
 * wrong", when the real problem is "you copied the label instead of revealing
 * the key".
 *
 * A real secret key is ~107 characters of URL-safe base64 and contains no
 * ellipsis. Both tests must pass.
 */
export function looksLikeStripeKey(value) {
  const v = normalizeSecret(value);

  if (v.includes('...') || v.includes('…')) return false; // masked display label
  if (v.length < 40) return false; // real keys are ~107 chars

  return (
    v.startsWith('sk_live_') ||
    v.startsWith('sk_test_') ||
    v.startsWith('rk_live_') ||
    v.startsWith('rk_test_')
  );
}

const WEBHOOK_VARS = [
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_WEBHOOK_SIGNING_SECRET',
];

/**
 * Strip the things a copy-paste from a dashboard actually picks up.
 * Stripe keys are URL-safe base64: no spaces, no quotes, no newlines.
 * A trailing "\n" or a wrapping pair of quotes is enough to make a
 * perfectly good live key fail with an opaque 401.
 */
export function normalizeSecret(raw) {
  let v = String(raw == null ? '' : raw).trim();
  if (v.length > 1) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      v = v.slice(1, -1).trim();
    }
  }
  return v.replace(/\s+/g, '');
}

/**
 * Find the secret key actually present in this build.
 * @returns {{name: string, value: string} | null}
 */
export function resolveStripeKey() {
  for (const name of KEY_VARS) {
    const value = normalizeSecret(process.env[name]);
    if (value) return { name, value };
  }

  // Fallback: ADMIN_SECRET, but only when it is genuinely key-shaped. A random
  // admin password must never be handed to Stripe — see the block above.
  const adminValue = normalizeSecret(process.env[FALLBACK_KEY_VAR]);
  if (looksLikeStripeKey(adminValue)) {
    return { name: FALLBACK_KEY_VAR, value: adminValue };
  }

  return null;
}

/**
 * Which candidate names are populated right now. Names are not secret.
 * ADMIN_SECRET is reported by SHAPE, not presence: saying "set" would imply it
 * is usable for Stripe when it is usually just the admin password.
 */
export function stripeKeyReport() {
  const found = {};
  for (const name of KEY_VARS) {
    found[name] = normalizeSecret(process.env[name]) ? 'set' : 'missing';
  }

  const adminValue = normalizeSecret(process.env[FALLBACK_KEY_VAR]);
  found[FALLBACK_KEY_VAR] = !adminValue
    ? 'missing'
    : looksLikeStripeKey(adminValue)
      ? 'set (usable stripe key)'
      : 'set (not a stripe key — ignored)';

  return found;
}

/** Classify a key without revealing it. */
export function keyMode(value) {
  const v = normalizeSecret(value);
  if (!v) return 'missing';
  if (v.startsWith('sk_live_')) return 'live';
  if (v.startsWith('sk_test_')) return 'test';
  if (v.startsWith('rk_live_')) return 'live_restricted';
  return 'malformed';
}

/** The webhook signing secret, under either known name. */
export function resolveWebhookSecret() {
  for (const name of WEBHOOK_VARS) {
    const value = normalizeSecret(process.env[name]);
    if (value) return { name, value };
  }
  return null;
}

let cached = null;
let cachedKeyName = null;

export function stripe() {
  if (cached) return cached;

  const resolved = resolveStripeKey();
  if (!resolved) {
    // Name every variable we looked at, so the fix is obvious from the
    // log line alone: it is always "set one of these".
    throw new Error(
      `stripe(): no Stripe secret key in this build. Looked for: ${KEY_VARS.join(', ')}.`
    );
  }

  cachedKeyName = resolved.name;
  cached = new Stripe(resolved.value, {
    // Pin the API version so behavior can't shift under us.
    apiVersion: '2024-06-20',
    appInfo: { name: 'Verse Dedication', version: '1.0.0' },
  });
  return cached;
}

/** Which env var name supplied the active client (for logs/health). */
export function stripeKeyName() {
  if (!cachedKeyName) {
    const resolved = resolveStripeKey();
    cachedKeyName = resolved ? resolved.name : null;
  }
  return cachedKeyName;
}
