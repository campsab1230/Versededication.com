import { stripe, resolveWebhookSecret } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getTier, isValidTier } from '@/lib/pricing';
import { insertDedication } from '@/lib/dedications';
import { generateCertificatePdf } from '@/lib/certificate';
import { sendCertificateEmail } from '@/lib/email';

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

  // Accept either known variable name — a Marketplace integration and a
  // hand-created variable are both plausible sources for this value.
  const resolvedSecret = resolveWebhookSecret();
  if (!resolvedSecret) {
    console.error(
      '[stripe-webhook] No webhook signing secret. Looked for STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SIGNING_SECRET.'
    );
    return res.status(500).json({ error: 'Webhook not configured.' });
  }
  const secret = resolvedSecret.value;

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

// Postgres reports a uniqueness conflict as SQLSTATE 23505. PostgREST passes
// the code through, so the code is the reliable signal; the message is checked
// too because some proxies strip the code field.
function isUniqueViolation(err) {
  if (!err) return false;
  if (err.code === '23505') return true;
  return /duplicate key value|unique constraint/i.test(err.message || '');
}

// Find the dedication belonging to an order.
//
// Deliberately NOT `.maybeSingle()`. That helper raises an error when more
// than one row matches, and `dedications.order_id` has no unique constraint —
// so a database that suffered the old idempotency bug (every retry of a
// `no_payment_required` session inserted another dedication) has duplicates
// for exactly the orders this resume logic exists to repair. maybeSingle would
// error there, the error was previously ignored, `data` would read as null,
// and we would insert yet another dedication on every retry — making the
// duplication worse each time. Fetching a list and taking the oldest row
// converges instead.
async function findDedicationForOrder(db, orderId) {
  const { data, error } = await db
    .from('dedications')
    .select('id, dedication_number, certificate_url, email_sent_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .limit(2);

  if (error) {
    console.error('[stripe-webhook] dedication lookup failed:', error.message);
    return null;
  }
  if (!data || !data.length) return null;

  if (data.length > 1) {
    console.warn(
      `[stripe-webhook] order ${orderId} has multiple dedications — using the ` +
        `earliest (${data[0].id}) and ignoring the rest. This indicates the old ` +
        `idempotency bug; the duplicates should be cleaned up manually.`
    );
  }
  return data[0];
}

// Locate a previously-recorded order for this Checkout Session.
//
// Two keys are tried because neither alone is sufficient:
//   • stripe_session_id — ALWAYS present on a session. The column is added
//     by db/add-orders-session-id.sql. Until that SQL is applied PostgREST
//     answers 42703 (column does not exist) and we fall through, so this
//     file is safe to deploy BEFORE the migration is run.
//   • stripe_payment_intent_id — present for every session that collects
//     money, but null for `no_payment_required` sessions, which is exactly
//     the case where the old guard was skipped entirely.
async function findExistingOrder(db, session, paymentIntentId) {
  if (session.id) {
    const { data, error } = await db
      .from('orders')
      .select('id, status')
      .eq('stripe_session_id', session.id)
      .maybeSingle();

    if (!error) {
      if (data) return data;
    } else if (error.code !== '42703') {
      console.error('[stripe-webhook] session-id lookup failed:', error.message);
    }
  }

  if (!paymentIntentId) return null;

  const { data, error } = await db
    .from('orders')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (error) {
    console.error('[stripe-webhook] payment-intent lookup failed:', error.message);
    return null;
  }
  return data || null;
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

  // ---- Idempotency AND resume ----
  //
  // ⚠️  An order existing does NOT mean the sale was fulfilled. The order is
  // written before the certificate is generated and before the email goes
  // out, so a PDF or Resend failure leaves a PAID order with no certificate
  // and no email. The old code returned early whenever an order existed,
  // which meant every Stripe retry hit that same early return and the failure
  // could never heal: the customer was charged, and silently received
  // nothing, permanently. So each fulfilment step below is keyed off what is
  // actually still missing rather than off "does an order exist".
  let orderId = null;
  let dedication = null;

  const existing = await findExistingOrder(db, session, paymentIntentId);

  if (existing) {
    orderId = existing.id;

    // Reuse the dedication from the previous attempt, if there was one.
    dedication = await findDedicationForOrder(db, orderId);

    console.log(
      `[stripe-webhook] resuming order ${orderId} — ` +
        `dedication ${dedication ? 'present' : 'MISSING'}, ` +
        `certificate ${dedication?.certificate_url ? 'present' : 'MISSING'}, ` +
        `email ${dedication?.email_sent_at ? 'sent' : 'NOT SENT'}`
    );
  } else {
    // ---- Shipping details (heirloom tier) ----
    const ship =
      session.shipping_details || session.collected_information?.shipping_details || null;

    // ---- Create the order ----
    // `stripe_session_id` is the durable idempotency key, but the column only
    // exists once db/add-orders-session-id.sql has been applied. Rather than
    // require the migration before the code can ship (which would leave the
    // live site broken in the meantime), we try WITH the column and fall back
    // to omitting it only on a "no such column" error. That way the deploy
    // order does not matter and nothing is lost when the column is missing —
    // findExistingOrder() simply falls through to the payment-intent key.
    const baseInsert = {
      stripe_payment_intent_id: paymentIntentId,
      email,
      tier: tierConfig.key,
      // `??`, not `||`: 0 is a legitimate amount_total (a $0 /
      // `no_payment_required` session), but `0 || 1499` evaluates to 1499 and
      // would record the full list price for a session that collected nothing,
      // inflating revenue and mis-stating the order.
      amount_cents: session.amount_total ?? tierConfig.amountCents,
      status: 'paid',
      shipping_name: ship?.name || null,
      shipping_address: ship?.address || null,
    };

    let order = null;
    let orderErr = null;

    // Attempt 1 carries the session id. If the column is missing we learn that
    // from the error and retry without it, so the deploy order never matters.
    ({ data: order, error: orderErr } = await db
      .from('orders')
      .insert(session.id ? { ...baseInsert, stripe_session_id: session.id } : baseInsert)
      .select('id')
      .single());

    if (orderErr) {
      // 42703 = undefined_column, PGRST204 = absent from the PostgREST schema
      // cache. Both mean db/add-orders-session-id.sql has not been run.
      const columnMissing =
        orderErr.code === '42703' ||
        orderErr.code === 'PGRST204' ||
        /stripe_session_id/.test(orderErr.message || '');

      if (columnMissing) {
        console.warn(
          '[stripe-webhook] orders.stripe_session_id does not exist yet — run ' +
            'db/add-orders-session-id.sql. Falling back to the payment-intent key.'
        );
        ({ data: order, error: orderErr } = await db
          .from('orders')
          .insert(baseInsert)
          .select('id')
          .single());
      }
    }

    // ---- Concurrent delivery of the same event ----
    //
    // Stripe guarantees at-least-once delivery, and two deliveries can overlap:
    // both invocations find no existing order, both insert, and the unique
    // index rejects the loser with 23505. Retrying the insert would never
    // succeed (the key is identical), and throwing would make Stripe retry
    // forever. The correct move is to adopt the row the other invocation
    // created — both are fulfilling the same payment.
    if (orderErr && isUniqueViolation(orderErr)) {
      const concurrent = await findExistingOrder(db, session, paymentIntentId);
      if (concurrent) {
        console.log(
          `[stripe-webhook] lost the insert race for session ${session.id} — adopting order ${concurrent.id}`
        );
        order = { id: concurrent.id };
        orderErr = null;
      }
    }

    if (orderErr) throw orderErr;
    orderId = order.id;
  }

  // ---- Dedication (created once; race-safe number) ----
  if (!dedication) {
    // Re-check immediately before inserting. A concurrent delivery that lost
    // the order race above has already built a dedication for this order, and
    // creating a second one would both duplicate the customer's certificate
    // and burn a dedication_number for a verse they dedicated only once.
    // (findDedicationForOrder, not maybeSingle — see its comment: an order may
    // legitimately carry duplicates from the old idempotency bug, and
    // maybeSingle would error on them and send us down the insert path again.)
    dedication =
      (await findDedicationForOrder(db, orderId)) ||
      (await insertDedication({
        verse_id,
        order_id: orderId,
        dedicator_name: dedicator_name || null,
        is_anonymous: isAnonymous,
        recipient_name,
        message: message || null,
        is_public: isPublic,
      }));
  }

  // ---- Generate + store the certificate PDF ----
  // Skipped when a previous attempt already produced one, so a retry after
  // an email-only failure does not re-render and re-upload the same file.
  let certificateUrl = dedication.certificate_url || null;
  let certificateFailed = false;

  if (!certificateUrl) try {
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
      certificateFailed = true;
      console.error('[stripe-webhook] certificate upload failed:', uploadErr.message);
    } else {
      const { data: pub } = db.storage.from(bucket).getPublicUrl(path);
      certificateUrl = pub?.publicUrl || null;
      if (certificateUrl) {
        await db.from('dedications').update({ certificate_url: certificateUrl }).eq('id', dedication.id);
      } else {
        certificateFailed = true;
        console.error('[stripe-webhook] storage returned no public URL for', path);
      }
    }
  } catch (certErr) {
    // The order is paid and recorded, so we do not lose the sale — but we do
    // NOT pretend it was delivered either. `certificateFailed` makes the
    // handler ask Stripe to retry, and the resume path above completes only
    // the steps that are still missing.
    certificateFailed = true;
    console.error('[stripe-webhook] certificate generation failed:', certErr);
  }

  // ---- Email the certificate link ----
  //
  // ⚠️  Only ever send a REAL certificate link. The old code passed
  // `certificateUrl || siteUrl()`, so when rendering failed the customer got
  // an email whose "Download your certificate" button pointed at the
  // homepage. That is worse than sending nothing: it looks like the product
  // was delivered, so the customer does not report it and the failure is
  // silent. We now send only when a certificate exists, and record
  // `email_sent_at` so a retry cannot mail the same person twice.
  // Track delivery in a local flag, NOT by re-reading `dedication.email_sent_at`.
  // That field holds the value read at the START of this invocation, so after a
  // successful send it is still null here. Testing it again would mark a
  // completed fulfilment as incomplete, return 500, and ask Stripe to retry
  // work that is already finished.
  let emailDelivered = Boolean(dedication.email_sent_at);

  if (!email) {
    // Not retryable: a Stripe retry re-reads the same session, which has no
    // email address on it. We log loudly and let the order show up in /admin
    // rather than returning 500 forever for something no retry can fix.
    console.error(
      `[stripe-webhook] order ${orderId} has no customer email — certificate cannot be delivered. ` +
        'A retry cannot fix this; the address must be obtained manually.'
    );
  } else if (certificateUrl && !emailDelivered) {
    try {
      const mailResult = await sendCertificateEmail({
        to: email,
        recipientName: recipient_name,
        reference: verse_reference || 'your verse',
        certificateUrl,
        tier: tierConfig.key,
      });

      if (mailResult?.ok) {
        await db
          .from('dedications')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', dedication.id);
        emailDelivered = true;
      } else {
        console.error('[stripe-webhook] email not sent:', JSON.stringify(mailResult));
      }
    } catch (mailErr) {
      console.error('[stripe-webhook] email failed:', mailErr);
    }
  }

  // Ask Stripe to retry ONLY when something is genuinely still missing.
  // A 500 here is the mechanism that makes the resume path reachable; without
  // it a transient PDF or Resend outage would be permanent.
  const stillMissing =
    certificateFailed || (Boolean(certificateUrl) && Boolean(email) && !emailDelivered);

  if (stillMissing) {
    throw new Error(`fulfilment incomplete for order ${orderId} — will retry`);
  }
}
