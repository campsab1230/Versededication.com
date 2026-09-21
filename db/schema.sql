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

-- No select policy on orders — intentionally service-role only.
