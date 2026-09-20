import { supabasePublic } from './supabasePublic';

// ============================================================
// Shared read helpers for public verse data.
//
// Used by the home page, the per-verse SEO pages and the sitemap
// so the shape of a "verse" is identical everywhere.
// ============================================================

export async function fetchThemes() {
  const { data } = await supabasePublic
    .from('themes')
    .select('id, name, slug')
    .order('sort_order', { ascending: true });
  return data || [];
}

// All verses with themes + public dedication counts, in one shape.
export async function fetchVersesWithMeta() {
  const { data: versesRaw } = await supabasePublic
    .from('verses')
    .select('id, reference, slug, text_kjv, featured, verse_themes(theme_id, themes(name, slug))')
    .order('featured', { ascending: false })
    .order('reference', { ascending: true });

  const { data: counts } = await supabasePublic
    .from('verse_dedication_counts')
    .select('verse_id, total_dedications');

  const countMap = Object.fromEntries(
    (counts || []).map((c) => [c.verse_id, Number(c.total_dedications || 0)])
  );

  return (versesRaw || []).map((v) => mapVerseRow(v, countMap));
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
  const { data } = await supabasePublic
    .from('dedications')
    .select('recipient_name, dedicator_name, is_anonymous, created_at, verses(reference)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map((d) => ({
    who: d.is_anonymous ? 'Someone' : d.dedicator_name || 'Someone',
    verse: d.verses?.reference || '',
    target: d.recipient_name,
  }));
}

// Just the slugs, for getStaticPaths + sitemap.
export async function fetchVerseSlugs() {
  const { data } = await supabasePublic.from('verses').select('slug');
  return (data || []).map((v) => v.slug).filter(Boolean);
}

// A short, word-boundary-safe preview of verse text.
export function snippetOf(text, len = 90) {
  const t = String(text || '').trim();
  if (t.length <= len) return t;
  const cut = t.slice(0, len);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : len)}…`;
}
