import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTier, isValidTier, stripePriceIdFor } from '@/lib/pricing';
import { siteUrl, MAX_MESSAGE_LENGTH } from '@/lib/site';

// ============================================================
// POST /api/create-checkout-session
//
// Creates a Stripe Checkout Session. The browser sends only the
// tier KEY and the dedication details — the PRICE is looked up
// server-side and attached as metadata so the webhook can trust it.
// ============================================================

function clamp(str, max) {
  return String(str || '').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const {
      verse_id,
      tier,
      recipient_name,
      dedicator_name,
      is_anonymous,
      message,
      is_public,
    } = body;

    if (!verse_id || typeof verse_id !== 'string') {
      return res.status(400).json({ error: 'A verse must be selected.' });
    }
    if (!isValidTier(tier)) {
      return res.status(400).json({ error: 'Invalid tier.' });
    }
    if (!recipient_name || !String(recipient_name).trim()) {
      return res.status(400).json({ error: "A recipient's name is required." });
    }

    const tierConfig = getTier(tier);

    // Confirm the verse exists (prevents orphan metadata / abuse).
    const { data: verse, error: verseErr } = await supabaseAdmin()
      .from('verses')
      .select('id, reference')
      .eq('id', verse_id)
      .single();

    if (verseErr || !verse) {
      return res.status(404).json({ error: 'That verse could not be found.' });
    }

    const base = siteUrl();
    const metadata = {
      verse_id: verse.id,
      verse_reference: verse.reference,
      tier: tierConfig.key,
      recipient_name: clamp(recipient_name, 120),
      dedicator_name: clamp(dedicator_name, 120),
      is_anonymous: String(!!is_anonymous),
      is_public: String(is_public !== false),
      message: clamp(message, MAX_MESSAGE_LENGTH),
    };

    // Prefer a pre-created Price if configured; else inline price_data.
    const priceId = stripePriceIdFor(tierConfig.key);
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: tierConfig.currency,
            unit_amount: tierConfig.amountCents,
            product_data: {
              name: tierConfig.name,
              description: `${verse.reference} — a personalized certificate of dedication`,
            },
          },
        };

    const sessionParams = {
      mode: 'payment',
      line_items: [lineItem],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${base}/?dedicated=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?canceled=1`,
      // Let us email the certificate link afterwards.
      customer_creation: 'always',
      // Collect a shipping address only for the mailed tier.
      ...(tierConfig.requiresShipping
        ? {
            shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ', 'IE'] },
          }
        : {}),
    };

    const session = await stripe().checkout.sessions.create(sessionParams);
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[create-checkout-session]', err);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
}
