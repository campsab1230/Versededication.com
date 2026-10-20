-- ============================================================
-- VERSE DEDICATION — add orders.stripe_session_id
--
-- WHY THIS EXISTS
-- The Stripe webhook needs a durable idempotency key. It previously used
-- `stripe_payment_intent_id`, which is null for `no_payment_required`
-- sessions (100%-discounted or $0 orders). The guard read:
--
--   if (paymentIntentId) { ...look for existing order... }
--
-- so for those sessions it was skipped ENTIRELY: every Stripe retry of the
-- same event created another order, another dedication, and another emailed
-- certificate. The customer got charged nothing and received the product
-- repeatedly.
--
-- A Checkout Session id (`cs_...`) is ALWAYS present, so it is the correct
-- key. It is also what the fulfilment resume path in
-- src/pages/api/stripe-webhook.js keys off.
--
-- SAFE TO RUN ON A LIVE DATABASE
--   • `add column if not exists` — idempotent, re-runnable.
--   • The column is nullable and existing rows keep NULL, which is allowed
--     by the partial unique index below. Existing orders are unaffected.
--   • `create unique index if not exists` builds an index that permits any
--     number of NULLs but rejects duplicate session ids.
--
-- Run in the Supabase SQL editor, or:
--   npx supabase db execute --file db/add-orders-session-id.sql
--
-- ORDER OF OPERATIONS
-- This migration does NOT have to be applied before deploying the code.
-- src/pages/api/stripe-webhook.js attempts the insert WITH this column and
-- falls back to the old shape if PostgREST reports 42703 (undefined_column)
-- or PGRST204 (absent from the schema cache), logging a warning. Applying
-- this file simply upgrades that fallback to the real key.
-- ============================================================

alter table orders
  add column if not exists stripe_session_id text;

-- Partial unique index: many NULLs allowed, duplicate cs_... ids rejected.
-- A plain `unique` constraint would also work; the partial form documents
-- that the NULL case is expected for pre-migration rows.
create unique index if not exists orders_stripe_session_id_key
  on orders (stripe_session_id)
  where stripe_session_id is not null;

comment on column orders.stripe_session_id is
  'Stripe Checkout Session id (cs_...). Primary webhook idempotency key — always present, unlike payment_intent which is null for no_payment_required sessions.';

-- ============================================================
-- VERIFY
-- ============================================================
-- Expect one row, nullable = YES:
--
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_name = 'orders' and column_name = 'stripe_session_id';
--
-- Expect the index to exist:
--
--   select indexname from pg_indexes
--   where tablename = 'orders' and indexname = 'orders_stripe_session_id_key';
