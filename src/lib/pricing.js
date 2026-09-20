// ============================================================
// Pricing — the single source of truth for amounts.
//
// The browser sends only a tier KEY ('digital' | 'heirloom').
// The server looks the amount up here. Never trust a price
// sent from the client.
//
// To change pricing, edit this file only.
// ============================================================

export const TIERS = {
  digital: {
    key: 'digital',
    name: 'Digital Dedication',
    blurb: 'Personalized certificate PDF, delivered instantly.',
    amountCents: 799,
    currency: 'usd',
    requiresShipping: false,
    badge: null,
    features: [
      'Personalized certificate PDF',
      'Delivered instantly by email',
      'Recipient & dedicator names',
      'Optional personal message',
    ],
  },
  heirloom: {
    key: 'heirloom',
    name: 'Heirloom Certificate',
    blurb: 'Everything in Digital, plus a printed keepsake by mail.',
    amountCents: 1499,
    currency: 'usd',
    requiresShipping: true,
    badge: 'Most chosen',
    features: [
      'Everything in Digital',
      'Printed on premium cardstock',
      'Mailed directly to you or them',
      'Digital copy included free',
    ],
  },
};

export const TIER_KEYS = Object.keys(TIERS);

export function isValidTier(key) {
  return Object.prototype.hasOwnProperty.call(TIERS, key);
}

export function getTier(key) {
  return isValidTier(key) ? TIERS[key] : null;
}

// Preferred Stripe Price IDs (optional). If an env price id is set for a
// tier we use it; otherwise we fall back to inline price_data from amountCents.
export function stripePriceIdFor(key) {
  if (key === 'digital') return process.env.STRIPE_PRICE_DIGITAL || null;
  if (key === 'heirloom') return process.env.STRIPE_PRICE_HEIRLOOM || null;
  return null;
}

export function formatPrice(amountCents) {
  return `$${(amountCents / 100).toFixed(2)}`;
}
