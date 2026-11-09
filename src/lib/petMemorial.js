// ============================================================
// For a Beloved Pet — the pet memorial collection.
//
// Losing a pet is losing family, and it is the grief people
// are most often told to get over quickly. This collection
// gives that grief the same quiet treatment as the human
// memorial collection: Scripture about God's care for every
// creature He made, plus comfort for the broken heart that
// loved one.
//
// THEOLOGY NOTE — deliberate: these verses say God notices,
// preserves and has mercy on His creatures (Matthew 10:29,
// Psalm 36:6, Genesis 9:16). They do NOT claim a doctrine
// about pets in heaven that Scripture does not state plainly.
// The comfort offered is real and it is honest.
//
// Five verses are NEW to the catalogue (Matthew 10:29,
// Psalm 36:6, Proverbs 12:10, Psalm 145:9, Genesis 9:16) and
// are added by db/add-pet-memorial.sql. Three are shared with
// the memorial collection and already live in the database
// (Psalm 34:18, Psalm 147:3, Revelation 21:4).
//
// This module is the single source of truth for WHICH verses
// belong and in what order, so the home-page section and the
// /pet-memorial landing page can never drift apart. Selection
// is by slug, not by theme, so the page works before the SQL
// is run — new verses are simply skipped until they exist in
// the database, then appear on their own (ISR, 60s).
// ============================================================

export const PET_MEMORIAL_THEME_NAME = 'For a Beloved Pet';
export const PET_MEMORIAL_THEME_SLUG = 'pet-memorial';

// Curated order: God's attention to the smallest creature
// first (Matthew 10:29), then His preserving and mercy,
// then comfort for the owner, ending — like the memorial
// collection — on Revelation 21:4.
export const PET_MEMORIAL_VERSES = [
  { slug: 'matthew-10-29', ref: 'Matthew 10:29' },
  { slug: 'psalm-36-6', ref: 'Psalm 36:6' },
  { slug: 'proverbs-12-10', ref: 'Proverbs 12:10' },
  { slug: 'psalm-145-9', ref: 'Psalm 145:9' },
  { slug: 'psalm-34-18', ref: 'Psalm 34:18' },
  { slug: 'psalm-147-3', ref: 'Psalm 147:3' },
  { slug: 'genesis-9-16', ref: 'Genesis 9:16' },
  { slug: 'revelation-21-4', ref: 'Revelation 21:4' },
];

export const PET_MEMORIAL_VERSE_SLUGS = PET_MEMORIAL_VERSES.map((v) => v.slug);

// Pick the pet memorial verses out of a full verse list (the
// shape returned by fetchVersesWithMeta), in curated order.
// Verses missing from the database are skipped rather than
// breaking the page.
export function selectPetMemorialVerses(verses) {
  const bySlug = new Map((verses || []).map((v) => [v.slug, v]));
  return PET_MEMORIAL_VERSE_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean);
}
