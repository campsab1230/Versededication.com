-- ============================================================
-- VERSE DEDICATION — add the "In Loving Memory" memorial theme
-- Run ONCE in the Supabase SQL Editor (Project → SQL Editor → New query).
-- Safe to re-run: uses ON CONFLICT DO NOTHING throughout.
--
-- What this does:
--   1. Adds the theme  In Loving Memory  (slug: in-loving-memory)
--      so it appears as a filter pill on the home page, driven by
--      the themes table like every other theme.
--   2. Links the seven grief / comfort verses already in the
--      catalogue to it. A verse can belong to several themes, so
--      their existing themes (Hope & Comfort, Peace, Protection)
--      are untouched.
--
-- The /memorial landing page does NOT depend on this file — it
-- selects its verses by slug in code (src/lib/memorial.js) and
-- works before and after this is run.
-- ============================================================

insert into themes (name, slug, sort_order) values
('In Loving Memory', 'in-loving-memory', 12)
on conflict (name) do nothing;

insert into verse_themes (verse_id, theme_id)
select v.id, t.id from verses v, themes t where (v.slug, t.slug) in (
  ('psalm-23-1-4', 'in-loving-memory'),
  ('matthew-5-4', 'in-loving-memory'),
  ('psalm-34-18', 'in-loving-memory'),
  ('psalm-147-3', 'in-loving-memory'),
  ('2-corinthians-1-3-4', 'in-loving-memory'),
  ('john-14-27', 'in-loving-memory'),
  ('revelation-21-4', 'in-loving-memory')
)
on conflict do nothing;

-- Verify (optional): should return 12 themes total, and 7 rows
-- linked to 'in-loving-memory'.
-- select count(*) from themes;
-- select count(*) from verse_themes vt
--   join themes t on t.id = vt.theme_id
--   where t.slug = 'in-loving-memory';
