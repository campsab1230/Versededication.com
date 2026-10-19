import { supabasePublic } from './supabasePublic';

// ============================================================
// Shared read helpers for public verse data.
//
// Used by the home page, the per-verse SEO pages and the sitemap
// so the shape of a "verse" is identical everywhere.
//
// ⚠️  IMPORTANT — why every read goes through unwrap():
//
// These helpers used to do `const { data } = await ...; return data || []`,
// which threw away `error` entirely. When the database was unreachable the
// site did not break — it rendered a cheerful empty grid and every verse page
// 404'd. A total outage looked identical to "no data yet", which is exactly
// how a dead Supabase project went unnoticed.
//
// Now a failed read throws DataUnavailableError, and callers decide whether
// to show an "unavailable" state (getStaticProps) or to fail loudly.
// ============================================================

export class DataUnavailableError extends Error {
  constructor(op, detail) {
    super(`Supabase read failed (${op}): ${detail}`);
    this.name = 'DataUnavailableError';
    this.op = op;
  }
}

// Throws on error, otherwise returns rows (never null/undefined).
function unwrap({ data, error }, op) {
  if (error) throw new DataUnavailableError(op, error.message || String(error));
  return data ?? [];
}

export async function fetchThemes() {
  return unwrap(
    await supabasePublic
      .from('themes')
      .select('id, name, slug')
      .order('sort_order', { ascending: true }),
    'themes'
  );
}

// All verses with themes + public dedication counts, in one shape.
export async function fetchVersesWithMeta() {
  const versesRaw = unwrap(
    await supabasePublic
      .from('verses')
      .select('id, reference, slug, text_kjv, featured, verse_themes(theme_id, themes(name, slug))')
      .order('featured', { ascending: false })
      .order('reference', { ascending: true }),
    'verses'
  );

  // Counts are decorative social proof — a failure here must not blank the
  // whole grid, so this one degrades to zero counts instead of throwing.
  let counts = [];
  try {
    counts = unwrap(
      await supabasePublic.from('verse_dedication_counts').select('verse_id, total_dedications'),
      'verse_dedication_counts'
    );
  } catch (err) {
    console.error('[verseData] dedication counts unavailable:', err?.message || err);
  }

  const countMap = Object.fromEntries(
    counts.map((c) => [c.verse_id, Number(c.total_dedications || 0)])
  );

  return versesRaw.map((v) => mapVerseRow(v, countMap));
}

export function mapVerseRow(v, countMap = {}) {
  const vt = v.verse_themes || [];
  return {
    id: v.id,
    ref: v.reference,
    slug: v.slug,
    text: v.text_kjv,
    themeIds: vt.map((x) => x.theme_id),
    themeNames: vt.map((x) => x.themes?.name).filter(Boolean),
    themeSlugs: vt.map((x) => x.themes?.slug).filter(Boolean),
    count: countMap[v.id] || 0,
  };
}

export async function fetchRecentFeed(limit = 6) {
  const data = unwrap(
    await supabasePublic
      .from('dedications')
      .select('recipient_name, dedicator_name, is_anonymous, created_at, verses(reference)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit),
    'dedications'
  );

  return data.map((d) => ({
    who: d.is_anonymous ? 'Someone' : d.dedicator_name || 'Someone',
    verse: d.verses?.reference || '',
    target: d.recipient_name,
  }));
}

// Just the slugs, for getStaticPaths + sitemap.
//
// This one deliberately does NOT throw: it is called during `next build`, and
// a database blip must not fail the build. An empty list is safe because both
// callers recover — getStaticPaths pairs it with `fallback: 'blocking'` (new
// verses render on first request) and the sitemap is regenerated hourly.
export async function fetchVerseSlugs() {
  const { data, error } = await supabasePublic.from('verses').select('slug');
  if (error) {
    console.error('[verseData] slug fetch failed:', error.message || error);
    return [];
  }
  return (data || []).map((v) => v.slug).filter(Boolean);
}

// Re-export the shared text helper so server code has one import path.
export { snippetOf } from './text';
