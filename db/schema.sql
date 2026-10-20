-- ============================================================
-- VERSE DEDICATION — full database setup (hardened)
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query)
--
-- This is the ORIGINAL schema with the fixes applied:
--   1. dedications: unique (verse_id, dedication_number) to stop
--      duplicate numbers under concurrent inserts
--   2. view casts count(*) to int (PostgREST returns bigint as a string)
--   3. view uses security_invoker so it respects RLS
--   4. message length checked in the DB
--   5. updated_at columns for fulfilment tracking
-- ============================================================

-- ============================
-- THEMES (Love, Strength, etc.)
-- ============================
create table if not exists themes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int default 0
);

-- ============================
-- VERSES
-- ============================
create table if not exists verses (
  id uuid primary key default gen_random_uuid(),
  book text not null,
  chapter int not null,
  verse_start int not null,
  verse_end int,
  reference text not null unique,
  slug text not null unique,
  text_kjv text not null,
  featured boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_verses_reference on verses (reference);
create index if not exists idx_verses_featured on verses (featured desc);

-- ============================
-- VERSE <-> THEME (many-to-many)
-- ============================
create table if not exists verse_themes (
  verse_id uuid references verses(id) on delete cascade,
  theme_id uuid references themes(id) on delete cascade,
  primary key (verse_id, theme_id)
);

create index if not exists idx_verse_themes_theme on verse_themes (theme_id);

-- ============================
-- ORDERS (one per checkout)
-- ============================
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  stripe_payment_intent_id text unique,
  -- Stripe's Checkout Session id (cs_...). Added as the PRIMARY idempotency
  -- key because a session always carries one, whereas payment_intent is null
  -- for `no_payment_required` sessions — and that null was the case where the
  -- webhook's duplicate guard was skipped entirely.
  stripe_session_id text unique,
  email text,
  tier text not null check (tier in ('digital', 'heirloom')),
  amount_cents int not null,
  status text not null default 'pending'
    check (status in ('pending','paid','shipped','failed','refunded')),
  shipping_name text,
  shipping_address jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================
-- DEDICATIONS (one per purchase)
-- ============================
create table if not exists dedications (
  id uuid primary key default gen_random_uuid(),
  verse_id uuid not null references verses(id),
  order_id uuid references orders(id),
  dedicator_name text,
  is_anonymous boolean default false,
  recipient_name text not null,
  message text check (message is null or char_length(message) <= 140),
  dedication_number int not null,
  is_public boolean default true,
  certificate_url text,
  email_sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_dedications_verse on dedications (verse_id);
create index if not exists idx_dedications_created on dedications (created_at desc);
create index if not exists idx_dedications_public on dedications (is_public, created_at desc);

-- ✅ FIX: prevent duplicate dedication numbers for the same verse.
-- The trigger below tries max+1; under concurrency two inserts can collide,
-- and the app retries on the resulting unique-violation (Postgres 23505).
alter table dedications
  drop constraint if exists dedications_verse_number_unique;
alter table dedications
  add constraint dedications_verse_number_unique unique (verse_id, dedication_number);

-- Auto-increment dedication_number PER VERSE
create or replace function set_dedication_number()
returns trigger as $$
begin
  if new.dedication_number is null or new.dedication_number = 0 then
    select coalesce(max(dedication_number), 0) + 1
    into new.dedication_number
    from dedications
    where verse_id = new.verse_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_dedication_number on dedications;
create trigger trg_set_dedication_number
before insert on dedications
for each row execute function set_dedication_number();

-- Keep updated_at fresh
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders for each row execute function touch_updated_at();

drop trigger if exists trg_dedications_updated_at on dedications;
create trigger trg_dedications_updated_at
before update on dedications for each row execute function touch_updated_at();

-- ============================
-- Dedication counts per verse
-- ✅ FIX: cast to int (PostgREST returns bigint as a *string* otherwise)
-- ✅ FIX: security_invoker so the view obeys the caller's RLS, and we
--         only count PUBLIC dedications (private ones are not social proof).
-- ============================
drop view if exists verse_dedication_counts;
create view verse_dedication_counts
with (security_invoker = true)
as
select
  v.id as verse_id,
  v.reference,
  count(d.id)::int as total_dedications
from verses v
left join dedications d
  on d.verse_id = v.id
 and d.is_public = true
group by v.id, v.reference;

-- ============================
-- ROW LEVEL SECURITY
-- Public pages read verses/themes/verse_themes/dedications from the browser
-- with the anon key, so those need SELECT policies.
-- Orders are never read from the browser — only the server (service role,
-- which bypasses RLS) touches them.
-- ============================
alter table verses enable row level security;
alter table themes enable row level security;
alter table verse_themes enable row level security;
alter table dedications enable row level security;
alter table orders enable row level security;

drop policy if exists "Public can read verses" on verses;
create policy "Public can read verses" on verses for select using (true);

drop policy if exists "Public can read themes" on themes;
create policy "Public can read themes" on themes for select using (true);

drop policy if exists "Public can read verse_themes" on verse_themes;
create policy "Public can read verse_themes" on verse_themes for select using (true);

drop policy if exists "Public can read public dedications" on dedications;
create policy "Public can read public dedications" on dedications
  for select using (is_public = true);

-- ---------------------------------------------------------------------------
-- ⚠️  COLUMN-LEVEL PRIVILEGES ON dedications — do not remove.
--
-- RLS filters ROWS, not COLUMNS. Supabase grants `anon` and `authenticated`
-- a blanket `GRANT SELECT ON ALL TABLES`, so the policy above only decides
-- *which* dedications are visible — every column of a visible row is still
-- readable by anyone holding the public anon key (which ships in the browser
-- bundle). Before this block, a single unauthenticated request:
--
--   GET /rest/v1/dedications?select=*&is_public=eq.true
--
-- returned the private `message` ("My private note to Sarah..."), the
-- `certificate_url` of the personalised PDF (the `certificates` bucket is
-- public, so that URL downloads without auth), and the internal `order_id`.
-- That contradicts src/pages/privacy.js, which promises only first name /
-- verse reference / recipient name are ever public.
--
-- The public feed (src/lib/verseData.js: fetchRecentFeed) selects exactly the
-- columns kept below, so it keeps working untouched. service_role bypasses
-- these grants entirely, so the server is unaffected.
--
-- The `if exists (pg_roles)` guard keeps this file runnable on a plain
-- Postgres instance that has no Supabase roles defined (it becomes a no-op).
-- Safe to run repeatedly.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke select on table dedications from anon;
    grant select (
      id, verse_id, dedicator_name, is_anonymous, recipient_name,
      dedication_number, is_public, created_at, updated_at
    ) on dedications to anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke select on table dedications from authenticated;
    grant select (
      id, verse_id, dedicator_name, is_anonymous, recipient_name,
      dedication_number, is_public, created_at, updated_at
    ) on dedications to authenticated;
  end if;
end $$;

-- Withheld from anon/authenticated: order_id, message, certificate_url,
-- email_sent_at.

-- No select policy on orders — intentionally service-role only.
--
-- RLS with no policy already returns zero rows, but privileges are a second,
-- independent lock. Supabase's blanket `GRANT SELECT ON ALL TABLES` means an
-- anon-key request against orders is decided by the GRANT first: with the
-- grant in place the response is `200 []`, which looks like an empty table
-- rather than a refusal, and any future policy slip silently exposes
-- customer emails, amounts and shipping addresses.
--
-- Production was measured returning 401 `42501 permission denied for table
-- orders`, i.e. the privilege was revoked there but was NOT recorded in this
-- file. Rebuilding from setup.sql would have silently dropped the hardening.
-- This block closes that drift.
--
-- Every orders accessor in the app goes through supabaseAdmin()
-- (src/lib/supabaseAdmin.js → service_role, which bypasses grants):
--   src/pages/api/stripe-webhook.js:118,137
--   src/pages/api/admin/orders.js:45,96
-- so revoking from anon/authenticated cannot break the site.
--
-- No grant is re-added: nothing in the app reads orders with a public key.
-- Same `if exists (pg_roles)` guard as above, so this stays runnable on a
-- plain Postgres with no Supabase roles.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table orders from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table orders from authenticated;
  end if;
end $$;

-- ============================
-- VERSE REQUESTS
-- A visitor asks for a verse we do not carry yet. We promise it within 24h.
--
-- PRIVACY: this table holds a requester's name and email, so there is NO
-- public read policy. It is written and read only by the server through the
-- service role (which bypasses RLS). Adding a public SELECT here would leak
-- every requester's email address.
-- ============================
create table if not exists verse_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null
    check (char_length(trim(reference)) between 2 and 120),
  requester_name text
    check (requester_name is null or char_length(requester_name) <= 80),
  requester_email text
    check (requester_email is null or char_length(requester_email) <= 160),
  note text
    check (note is null or char_length(note) <= 400),
  status text not null default 'pending'
    check (status in ('pending','added','declined')),
  -- Set when an admin adds the verse, so we can close the loop with the requester.
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_verse_requests_created on verse_requests (created_at desc);
create index if not exists idx_verse_requests_status on verse_requests (status, created_at desc);
-- Light dedupe help: the same reference requested repeatedly is one row per ask,
-- but this index makes "how many people asked for X" cheap.
create index if not exists idx_verse_requests_reference on verse_requests (lower(reference));

alter table verse_requests enable row level security;

drop trigger if exists trg_verse_requests_updated_at on verse_requests;
create trigger trg_verse_requests_updated_at
before update on verse_requests for each row execute function touch_updated_at();

-- No policies on purpose: service-role only (see PRIVACY note above).
