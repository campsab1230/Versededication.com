-- ============================================================
-- VERSE DEDICATION — post-purchase fulfilment check
--
-- Run this in the Supabase SQL Editor AFTER a real test purchase.
-- It answers one question per order: did the customer actually
-- receive what they paid for?
--
-- The three failure modes it distinguishes are exactly the ones
-- fixed in src/pages/api/stripe-webhook.js:
--
--   * no dedication  -> the webhook never ran, or died before the
--                       dedication insert (bad signature, missing
--                       metadata, or an order-row error)
--   * no certificate -> PDF render or storage upload failed. Stripe
--                       retries automatically; a row stuck here
--                       after several minutes means a code bug,
--                       not a transient blip.
--   * no email       -> Resend rejected the send (403 = sending
--                       domain not verified) or no API key.
--
-- Read-only. Changes nothing.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Every order and how far its fulfilment got.
--
-- `state` is the column that matters:
--   COMPLETE            the customer has a certificate and an email
--   NO EMAIL            certificate exists, delivery did not happen
--   NO CERTIFICATE      paid, nothing generated
--   NO DEDICATION       paid, webhook never completed
-- ------------------------------------------------------------------
select
  o.created_at,
  o.email,
  o.tier,
  o.amount_cents,
  o.status,
  (o.stripe_payment_intent_id is not null) as has_pi,
  (o.stripe_session_id is not null)        as has_session,
  (d.id is not null)                       as has_dedication,
  d.dedication_number,
  (d.certificate_url is not null)          as has_certificate,
  d.email_sent_at,
  case
    when d.id is null                    then 'NO DEDICATION'
    when d.certificate_url is null       then 'NO CERTIFICATE'
    when d.email_sent_at is null         then 'NO EMAIL'
    else                                      'COMPLETE'
  end as state
from orders o
left join dedications d on d.order_id = o.id
order by o.created_at desc
limit 20;

-- ------------------------------------------------------------------
-- 2. Is the new idempotency key actually being written?
--
-- After the first post-migration purchase, the newest row MUST have
-- has_session = true. If it is false, the deploy that writes
-- stripe_session_id is not the one serving traffic — check
-- /api/health for the commit hash.
-- ------------------------------------------------------------------
select id, created_at, stripe_session_id
from orders
order by created_at desc
limit 3;

-- ------------------------------------------------------------------
-- 3. Duplicate guard: one dedication per order.
--    Expect ZERO rows. Any row here means the webhook ran twice for
--    one payment.
-- ------------------------------------------------------------------
select order_id, count(*) as dedications
from dedications
where order_id is not null
group by order_id
having count(*) > 1;

-- ------------------------------------------------------------------
-- 4. Certificates that exist but were never emailed.
--    These customers are owed an email. Expect ZERO rows.
-- ------------------------------------------------------------------
select id, recipient_name, certificate_url, created_at
from dedications
where certificate_url is not null
  and email_sent_at is null
order by created_at desc;

-- ============================================================
-- CLEANUP REFERENCE — DO NOT RUN BLIND
-- Only relevant if query 3 returned rows (duplicate dedications).
-- Delete the LATER duplicates, keep the earliest: it holds the
-- dedication_number that was issued first and is the one the
-- customer's certificate was rendered from.
--
--   select id, order_id, dedication_number, created_at
--   from dedications
--   where order_id = '<the duplicate order id>'
--   order by created_at;
--
-- Then delete every id except the first, one at a time, after
-- confirming which certificate_url the customer was sent.
-- ============================================================
