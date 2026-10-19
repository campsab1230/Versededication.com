-- ============================================================
-- GENERATED FILE — DO NOT EDIT.
--
-- This is db/schema.sql followed by db/seed.sql, so it can be
-- pasted into the Supabase SQL editor in one go.
--
-- Regenerate with:  bash scripts/make-setup-sql.sh
-- Edit schema.sql / seed.sql instead, never this file.
-- ============================================================

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


-- ============================================================
-- VERSE DEDICATION — seed data (themes + 45 verses + theme links)
-- Run AFTER schema.sql in the Supabase SQL Editor.
-- Safe to re-run: uses ON CONFLICT DO NOTHING.
-- ============================================================

insert into themes (name, slug, sort_order) values
('Love & Marriage', 'love-marriage', 1),
('Strength & Courage', 'strength-courage', 2),
('Hope & Comfort', 'hope-comfort', 3),
('Peace', 'peace', 4),
('Guidance & Wisdom', 'guidance-wisdom', 5),
('Faith', 'faith', 6),
('Protection', 'protection', 7),
('New Baby / Child', 'new-baby', 8),
('Gratitude', 'gratitude', 9),
('Friendship', 'friendship', 10),
('Healing', 'healing', 11)
on conflict (name) do nothing;

insert into verses (book, chapter, verse_start, verse_end, reference, slug, text_kjv, featured) values
('1 Corinthians', 13, 4, 7, '1 Corinthians 13:4-7', '1-corinthians-13-4-7', 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil; Rejoiceth not in iniquity, but rejoiceth in the truth; Beareth all things, believeth all things, hopeth all things, endureth all things.', true),
('Song of Solomon', 8, 7, null, 'Song of Solomon 8:7', 'song-of-solomon-8-7', 'Many waters cannot quench love, neither can the floods drown it: if a man would give all the substance of his house for love, it would utterly be contemned.', false),
('Ecclesiastes', 4, 9, 10, 'Ecclesiastes 4:9-10', 'ecclesiastes-4-9-10', 'Two are better than one; because they have a good reward for their labour. For if they fall, the one will lift up his fellow: but woe to him that is alone when he falleth; for he hath not another to help him up.', false),
('Ruth', 1, 16, null, 'Ruth 1:16', 'ruth-1-16', 'And Ruth said, Intreat me not to leave thee, or to return from following after thee: for whither thou goest, I will go; and where thou lodgest, I will lodge: thy people shall be my people, and thy God my God:', false),
('Genesis', 2, 24, null, 'Genesis 2:24', 'genesis-2-24', 'Therefore shall a man leave his father and his mother, and shall cleave unto his wife: and they shall be one flesh.', false),

('Philippians', 4, 13, null, 'Philippians 4:13', 'philippians-4-13', 'I can do all things through Christ which strengtheneth me.', true),
('Joshua', 1, 9, null, 'Joshua 1:9', 'joshua-1-9', 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.', true),
('Isaiah', 41, 10, null, 'Isaiah 41:10', 'isaiah-41-10', 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.', false),
('Psalm', 27, 1, null, 'Psalm 27:1', 'psalm-27-1', 'The Lord is my light and my salvation; whom shall I fear? the Lord is the strength of my life; of whom shall I be afraid?', false),
('2 Timothy', 1, 7, null, '2 Timothy 1:7', '2-timothy-1-7', 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.', false),

('Jeremiah', 29, 11, null, 'Jeremiah 29:11', 'jeremiah-29-11', 'For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end.', true),
('Psalm', 34, 18, null, 'Psalm 34:18', 'psalm-34-18', 'The Lord is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.', false),
('Revelation', 21, 4, null, 'Revelation 21:4', 'revelation-21-4', 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.', false),
('Matthew', 5, 4, null, 'Matthew 5:4', 'matthew-5-4', 'Blessed are they that mourn: for they shall be comforted.', false),
('Psalm', 147, 3, null, 'Psalm 147:3', 'psalm-147-3', 'He healeth the broken in heart, and bindeth up their wounds.', false),
('2 Corinthians', 1, 3, 4, '2 Corinthians 1:3-4', '2-corinthians-1-3-4', 'Blessed be God, even the Father of our Lord Jesus Christ, the Father of mercies, and the God of all comfort; Who comforteth us in all our tribulation, that we may be able to comfort them which are in any trouble, by the comfort wherewith we ourselves are comforted of God.', false),

('Philippians', 4, 6, 7, 'Philippians 4:6-7', 'philippians-4-6-7', 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.', false),
('John', 14, 27, null, 'John 14:27', 'john-14-27', 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.', true),
('Isaiah', 26, 3, null, 'Isaiah 26:3', 'isaiah-26-3', 'Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.', false),
('Psalm', 29, 11, null, 'Psalm 29:11', 'psalm-29-11', 'The Lord will give strength unto his people; the Lord will bless his people with peace.', false),

('Proverbs', 3, 5, 6, 'Proverbs 3:5-6', 'proverbs-3-5-6', 'Trust in the Lord with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.', true),
('Psalm', 119, 105, null, 'Psalm 119:105', 'psalm-119-105', 'Thy word is a lamp unto my feet, and a light unto my path.', true),
('James', 1, 5, null, 'James 1:5', 'james-1-5', 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.', false),
('Proverbs', 16, 9, null, 'Proverbs 16:9', 'proverbs-16-9', 'A man''s heart deviseth his way: but the Lord directeth his steps.', false),

('Hebrews', 11, 1, null, 'Hebrews 11:1', 'hebrews-11-1', 'Now faith is the substance of things hoped for, the evidence of things not seen.', false),
('Romans', 8, 28, null, 'Romans 8:28', 'romans-8-28', 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.', true),
('Mark', 11, 24, null, 'Mark 11:24', 'mark-11-24', 'Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.', false),
('Matthew', 17, 20, null, 'Matthew 17:20', 'matthew-17-20', 'And Jesus said unto them, Because of your unbelief: for verily I say unto you, If ye have faith as a grain of mustard seed, ye shall say unto this mountain, Remove hence to yonder place; and it shall remove; and nothing shall be impossible unto you.', false),

('Psalm', 91, 11, null, 'Psalm 91:11', 'psalm-91-11', 'For he shall give his angels charge over thee, to keep thee in all thy ways.', false),
('Psalm', 23, 1, 4, 'Psalm 23:1-4', 'psalm-23-1-4', 'The Lord is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul: he leadeth me in the paths of righteousness for his name''s sake. Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.', true),
('Deuteronomy', 31, 6, null, 'Deuteronomy 31:6', 'deuteronomy-31-6', 'Be strong and of a good courage, fear not, nor be afraid of them: for the Lord thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.', false),
('Numbers', 6, 24, 26, 'Numbers 6:24-26', 'numbers-6-24-26', 'The Lord bless thee, and keep thee: The Lord make his face shine upon thee, and be gracious unto thee: The Lord lift up his countenance upon thee, and give thee peace.', true),

('Psalm', 127, 3, null, 'Psalm 127:3', 'psalm-127-3', 'Lo, children are an heritage of the Lord: and the fruit of the womb is his reward.', false),
('Jeremiah', 1, 5, null, 'Jeremiah 1:5', 'jeremiah-1-5', 'Before I formed thee in the belly I knew thee; and before thou camest forth out of the womb I sanctified thee, and I ordained thee a prophet unto the nations.', false),
('Proverbs', 22, 6, null, 'Proverbs 22:6', 'proverbs-22-6', 'Train up a child in the way he should go: and when he is old, he will not depart from it.', false),
('Isaiah', 40, 11, null, 'Isaiah 40:11', 'isaiah-40-11', 'He shall feed his flock like a shepherd: he shall gather the lambs with his arm, and carry them in his bosom, and shall gently lead those that are with young.', false),

('1 Thessalonians', 5, 18, null, '1 Thessalonians 5:18', '1-thessalonians-5-18', 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.', false),
('Psalm', 100, 4, 5, 'Psalm 100:4-5', 'psalm-100-4-5', 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name. For the Lord is good; his mercy is everlasting; and his truth endureth to all generations.', false),
('James', 1, 17, null, 'James 1:17', 'james-1-17', 'Every good gift and every perfect gift is from above, and cometh down from the Father of lights, with whom is no variableness, neither shadow of turning.', false),

('Proverbs', 17, 17, null, 'Proverbs 17:17', 'proverbs-17-17', 'A friend loveth at all times, and a brother is born for adversity.', false),
('Ecclesiastes', 4, 12, null, 'Ecclesiastes 4:12', 'ecclesiastes-4-12', 'And if one prevail against him, two shall withstand him; and a threefold cord is not quickly broken.', false),
('John', 15, 13, null, 'John 15:13', 'john-15-13', 'Greater love hath no man than this, that a man lay down his life for his friends.', false),

('Jeremiah', 17, 14, null, 'Jeremiah 17:14', 'jeremiah-17-14', 'Heal me, O Lord, and I shall be healed; save me, and I shall be saved: for thou art my praise.', false),
('3 John', 1, 2, null, '3 John 1:2', '3-john-1-2', 'Beloved, I wish above all things that thou mayest prosper and be in health, even as thy soul prospereth.', false),
('Psalm', 30, 2, null, 'Psalm 30:2', 'psalm-30-2', 'O Lord my God, I cried unto thee, and thou hast healed me.', false)
on conflict (reference) do nothing;

insert into verse_themes (verse_id, theme_id)
select v.id, t.id from verses v, themes t where (v.slug, t.slug) in (
  ('1-corinthians-13-4-7','love-marriage'),('song-of-solomon-8-7','love-marriage'),
  ('ecclesiastes-4-9-10','love-marriage'),('ruth-1-16','love-marriage'),('genesis-2-24','love-marriage'),
  ('philippians-4-13','strength-courage'),('joshua-1-9','strength-courage'),('isaiah-41-10','strength-courage'),
  ('psalm-27-1','strength-courage'),('2-timothy-1-7','strength-courage'),
  ('jeremiah-29-11','hope-comfort'),('psalm-34-18','hope-comfort'),('revelation-21-4','hope-comfort'),
  ('matthew-5-4','hope-comfort'),('psalm-147-3','hope-comfort'),('2-corinthians-1-3-4','hope-comfort'),
  ('philippians-4-6-7','peace'),('john-14-27','peace'),('isaiah-26-3','peace'),('psalm-29-11','peace'),
  ('proverbs-3-5-6','guidance-wisdom'),('psalm-119-105','guidance-wisdom'),('james-1-5','guidance-wisdom'),('proverbs-16-9','guidance-wisdom'),
  ('hebrews-11-1','faith'),('romans-8-28','faith'),('mark-11-24','faith'),('matthew-17-20','faith'),
  ('psalm-91-11','protection'),('psalm-23-1-4','protection'),('deuteronomy-31-6','protection'),('numbers-6-24-26','protection'),
  ('psalm-127-3','new-baby'),('jeremiah-1-5','new-baby'),('proverbs-22-6','new-baby'),('isaiah-40-11','new-baby'),
  ('1-thessalonians-5-18','gratitude'),('psalm-100-4-5','gratitude'),('james-1-17','gratitude'),
  ('proverbs-17-17','friendship'),('ecclesiastes-4-12','friendship'),('john-15-13','friendship'),
  ('jeremiah-17-14','healing'),('3-john-1-2','healing'),('psalm-30-2','healing')
)
on conflict do nothing;
