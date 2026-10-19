import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTier, isValidTier } from '@/lib/pricing';
import { insertDedication } from '@/lib/dedications';
import { generateCertificatePdf } from '@/lib/certificate';
import { sendCertificateEmail } from '@/lib/email';
import { siteUrl } from '@/lib/site';

// Stripe needs the RAW body to verify the signature — disable body parsing.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set.');
    return res.status(500).json({ error: 'Webhook not configured.' });
  }

  const sig = req.headers['stripe-signature'];
  let event;
  const rawBody = await readRawBody(req);

  try {
    event = stripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        // ⚠️  `checkout.session.completed` does NOT imply the money arrived.
        // With delayed payment methods (bank debits, some wallets) Stripe fires
        // it while `payment_status` is still `unpaid`, then fires
        // `checkout.session.async_payment_succeeded` once it settles.
        // Fulfilling on `unpaid` would mint a certificate, store the PDF and
        // email it for a payment that may never clear.
        //
        // Note the test is `=== 'unpaid'`, NOT `!== 'paid'`. Stripe's own
        // fulfillment guide uses `payment_status != 'unpaid'`, because
        // `no_payment_required` (a 100%-discounted or zero-total session) is
        // still a completed sale that must be fulfilled. Rejecting anything
        // that is not exactly `paid` would silently strand those orders.
        // https://docs.stripe.com/checkout/fulfillment
        if (event.data.object.payment_status === 'unpaid') {
          console.warn(
            `[stripe-webhook] session ${event.data.object.id} completed with ` +
              `payment_status='unpaid' — awaiting async payment, not fulfilling yet.`
          );
          break;
        }
        await handleCheckoutCompleted(event.data.object);
        break;

      // The delayed-payment counterpart: this is the event that means paid.
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutCompleted(event.data.object);
        break;

      default:
        // Ignore other events (Stripe recommends returning 2xx for unhandled).
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err);
    // Return 500 so Stripe retries.
    return res.status(500).json({ error: 'Webhook handler failed.' });
  }
}

async function handleCheckoutCompleted(session) {
  const db = supabaseAdmin();

  // Retrieve metadata from the session (and its payment intent as a fallback).
  let md = session.metadata || {};
  if ((!md.verse_id || !md.tier) && session.payment_intent) {
    try {
      const pi = await stripe().paymentIntents.retrieve(session.payment_intent);
      md = { ...md, ...(pi.metadata || {}) };
    } catch (e) {
      console.warn('[stripe-webhook] could not load payment intent metadata', e.message);
    }
  }

  const { verse_id, verse_reference, tier, recipient_name, dedicator_name, message } = md;
  const isAnonymous = md.is_anonymous === 'true';
  const isPublic = md.is_public !== 'false';

  if (!verse_id || !isValidTier(tier)) {
    throw new Error(`Missing/invalid metadata on session ${session.id}`);
  }

  const tierConfig = getTier(tier);
  const paymentIntentId = session.payment_intent || null;
  const email = session.customer_details?.email || session.customer_email || null;

  // ---- Idempotency: has this payment already produced an order? ----
  if (paymentIntentId) {
    const { data: existing } = await db
      .from('orders')
      .select('id, status')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existing) {
      // Already processed — nothing else to do. Respond 200 to stop retries.
      console.log(`[stripe-webhook] order for ${paymentIntentId} already exists (${existing.id})`);
      return;
    }
  }

  // ---- Shipping details (heirloom tier) ----
  const ship = session.shipping_details || session.collected_information?.shipping_details || null;
  const shippingName = ship?.name || null;
  const shippingAddress = ship?.address || null;

  // ---- Create the order ----
  const { data: order, error: orderErr } = await db
    .from('orders')
    .insert({
      stripe_payment_intent_id: paymentIntentId,
      email,
      tier: tierConfig.key,
      // `??`, not `||`: 0 is a legitimate amount_total (a $0 /
      // `no_payment_required` session), but `0 || 1499` evaluates to 1499 and
      // would record the full list price for a session that collected nothing,
      // inflating revenue and mis-stating the order.
      amount_cents: session.amount_total ?? tierConfig.amountCents,
      status: 'paid',
      shipping_name: shippingName,
      shipping_address: shippingAddress,
    })
    .select('id')
    .single();

  if (orderErr) throw orderErr;

  // ---- Create the dedication (race-safe number) ----
  const dedication = await insertDedication({
    verse_id,
    order_id: order.id,
    dedicator_name: dedicator_name || null,
    is_anonymous: isAnonymous,
    recipient_name,
    message: message || null,
    is_public: isPublic,
  });

  // ---- Generate + store the certificate PDF ----
  let certificateUrl = null;
  try {
    const { data: verse } = await db
      .from('verses')
      .select('reference, text_kjv')
      .eq('id', verse_id)
      .single();

    const pdfBytes = await generateCertificatePdf({
      reference: verse?.reference || verse_reference || '',
      verseText: verse?.text_kjv || '',
      recipientName: recipient_name,
      dedicatorName: dedicator_name,
      isAnonymous,
      message,
      dedicationNumber: dedication?.dedication_number,
      // The date the gift was actually given (Stripe's own timestamp),
      // not the server clock at retry time.
      date: session.created ? new Date(session.created * 1000) : null,
    });

    const bucket = process.env.CERTIFICATE_BUCKET || 'certificates';
    const path = `${dedication.id}.pdf`;

    const { error: uploadErr } = await db.storage
      .from(bucket)
      .upload(path, Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      console.error('[stripe-webhook] certificate upload failed:', uploadErr.message);
    } else {
      const { data: pub } = db.storage.from(bucket).getPublicUrl(path);
      certificateUrl = pub?.publicUrl || null;
      if (certificateUrl) {
        await db.from('dedications').update({ certificate_url: certificateUrl }).eq('id', dedication.id);
      }
    }
  } catch (certErr) {
    // Don't fail the whole webhook just because the PDF failed — the order
    // is paid and recorded. Log so it can be regenerated.
    console.error('[stripe-webhook] certificate generation failed:', certErr);
  }

  // ---- Email the certificate link ----
  try {
    await sendCertificateEmail({
      to: email,
      recipientName: recipient_name,
      reference: verse_reference || 'your verse',
      certificateUrl: certificateUrl || siteUrl(),
      tier: tierConfig.key,
    });
  } catch (mailErr) {
    console.error('[stripe-webhook] email failed:', mailErr);
  }
}
