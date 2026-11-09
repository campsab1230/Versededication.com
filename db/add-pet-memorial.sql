-- ============================================================
-- VERSE DEDICATION — add the "For a Beloved Pet" pet memorial
-- Run ONCE in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: uses ON CONFLICT DO NOTHING throughout.
--
-- What this does:
--   1. Adds FIVE new verses about God's care for His creatures:
--        Matthew 10:29, Psalm 36:6, Proverbs 12:10,
--        Psalm 145:9, Genesis 9:16
--      (full KJV text, verified against canonical KJV 2026-11-09)
--   2. Adds the theme  For a Beloved Pet  (slug: pet-memorial)
--      so it appears as a filter pill on the home page.
--   3. Links all eight pet-memorial verses to it — the five new
--      ones plus Psalm 34:18, Psalm 147:3 and Revelation 21:4,
--      which are already in the catalogue. A verse can belong to
--      several themes, so their existing themes are untouched.
--
-- The /pet-memorial landing page does NOT depend on this file —
-- it selects its verses by slug in code (src/lib/petMemorial.js).
-- Before this is run it shows the three shared verses; after,
-- all eight appear on their own (ISR revalidates within 60s).
-- ============================================================

insert into verses (book, chapter, verse_start, verse_end, reference, slug, text_kjv, featured) values
('Matthew', 10, 29, null, 'Matthew 10:29', 'matthew-10-29', 'Are not two sparrows sold for a farthing? and one of them shall not fall on the ground without your Father.', false),
('Psalm', 36, 6, null, 'Psalm 36:6', 'psalm-36-6', 'Thy righteousness is like the great mountains; thy judgments are a great deep: O LORD, thou preservest man and beast.', false),
('Proverbs', 12, 10, null, 'Proverbs 12:10', 'proverbs-12-10', 'A righteous man regardeth the life of his beast: but the tender mercies of the wicked are cruel.', false),
('Psalm', 145, 9, null, 'Psalm 145:9', 'psalm-145-9', 'The LORD is good to all: and his tender mercies are over all his works.', false),
('Genesis', 9, 16, null, 'Genesis 9:16', 'genesis-9-16', 'And the bow shall be in the cloud; and I will look upon it, that I may remember the everlasting covenant between God and every living creature of all flesh that is upon the earth.', false)
on conflict (slug) do nothing;

insert into themes (name, slug, sort_order) values
('For a Beloved Pet', 'pet-memorial', 13)
on conflict (name) do nothing;

insert into verse_themes (verse_id, theme_id)
select v.id, t.id from verses v, themes t where (v.slug, t.slug) in (
  ('matthew-10-29', 'pet-memorial'),
  ('psalm-36-6', 'pet-memorial'),
  ('proverbs-12-10', 'pet-memorial'),
  ('psalm-145-9', 'pet-memorial'),
  ('psalm-34-18', 'pet-memorial'),
  ('psalm-147-3', 'pet-memorial'),
  ('genesis-9-16', 'pet-memorial'),
  ('revelation-21-4', 'pet-memorial')
)
on conflict do nothing;

-- Also file the five new verses under their natural existing
-- themes, so they show up in normal browsing too.
insert into verse_themes (verse_id, theme_id)
select v.id, t.id from verses v, themes t where (v.slug, t.slug) in (
  ('matthew-10-29', 'protection'),
  ('psalm-36-6', 'hope-comfort'),
  ('proverbs-12-10', 'guidance-wisdom'),
  ('psalm-145-9', 'gratitude'),
  ('genesis-9-16', 'faith')
)
on conflict do nothing;

-- Verify (optional): should return 50 verses total, 13 themes
-- total, and 8 rows linked to 'pet-memorial'.
-- select count(*) from verses;
-- select count(*) from themes;
-- select count(*) from verse_themes vt
--   join themes t on t.id = vt.theme_id
--   where t.slug = 'pet-memorial';
