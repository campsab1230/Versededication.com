import Stripe from 'stripe';

// ============================================================
// SERVER-ONLY Stripe client.
// ⚠️  Only import from API routes — never from components.
// ============================================================

let cached = null;

export function stripe() {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('stripe(): STRIPE_SECRET_KEY is not set.');
  }

  cached = new Stripe(key, {
    // Pin the API version so behavior can't shift under us.
    apiVersion: '2024-06-20',
    appInfo: { name: 'Verse Dedication', version: '1.0.0' },
  });
  return cached;
}
