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
  return null;
}

/** Which candidate names are populated right now. Names are not secret. */
export function stripeKeyReport() {
  const found = {};
  for (const name of KEY_VARS) {
    found[name] = normalizeSecret(process.env[name]) ? 'set' : 'missing';
  }
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
