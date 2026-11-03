// ============================================================
// In Loving Memory — the memorial / grief collection.
//
// The verses themselves already live in the database (they are
// also filed under Hope & Comfort, Peace and Protection). This
// module is the single source of truth for WHICH verses belong
// to the memorial collection and in what order, so the home-page
// section and the /memorial landing page can never drift apart.
//
// The matching database theme ('In Loving Memory',
// slug 'in-loving-memory') is added by
// db/add-memorial-theme.sql — once that has been run in Supabase,
// the same collection also appears as a filter pill on the home
// page, driven by the themes table like every other theme.
// Until then this page still works: it selects by verse slug,
// not by theme, so it never depends on the database change.
// ============================================================

export const MEMORIAL_THEME_NAME = 'In Loving Memory';
export const MEMORIAL_THEME_SLUG = 'in-loving-memory';

// Curated order: Psalm 23 first (the verse most families know),
// then comfort for the mourner, ending on Revelation 21:4 —
// "there shall be no more death" — as the closer.
export const MEMORIAL_VERSES = [
  { slug: 'psalm-23-1-4', ref: 'Psalm 23:1-4' },
  { slug: 'matthew-5-4', ref: 'Matthew 5:4' },
  { slug: 'psalm-34-18', ref: 'Psalm 34:18' },
  { slug: 'psalm-147-3', ref: 'Psalm 147:3' },
  { slug: '2-corinthians-1-3-4', ref: '2 Corinthians 1:3-4' },
  { slug: 'john-14-27', ref: 'John 14:27' },
  { slug: 'revelation-21-4', ref: 'Revelation 21:4' },
];

export const MEMORIAL_VERSE_SLUGS = MEMORIAL_VERSES.map((v) => v.slug);

// Pick the memorial verses out of a full verse list (the shape
// returned by fetchVersesWithMeta), in curated order. Verses
// missing from the database are skipped rather than breaking
// the page.
export function selectMemorialVerses(verses) {
  const bySlug = new Map((verses || []).map((v) => [v.slug, v]));
  return MEMORIAL_VERSE_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean);
}
