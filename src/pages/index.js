import Head from 'next/head';
import HomeClient from '@/components/HomeClient';
import { supabasePublic } from '@/lib/supabasePublic';
import { SITE_NAME, SITE_DESCRIPTION, siteUrl } from '@/lib/site';

export default function Home({ verses, themes, feedItems, justDedicated }) {
  const title = `${SITE_NAME} — Dedicate a Bible Verse`;
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <link rel="canonical" href={siteUrl()} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl()} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <HomeClient
        verses={verses}
        themes={themes}
        feedItems={feedItems}
        justDedicated={justDedicated}
      />
    </>
  );
}

// Re-fetch counts/feed at most once a minute.
export const revalidate = 60;

export async function getStaticProps() {
  let verses = [];
  let themes = [];
  let feedItems = [];

  try {
    const { data: themesRaw } = await supabasePublic
      .from('themes')
      .select('id, name, slug')
      .order('sort_order', { ascending: true });

    themes = themesRaw || [];

    const { data: versesRaw } = await supabasePublic
      .from('verses')
      .select('id, reference, text_kjv, featured, verse_themes(theme_id, themes(name))')
      .order('featured', { ascending: false })
      .order('reference', { ascending: true });

    const { data: counts } = await supabasePublic
      .from('verse_dedication_counts')
      .select('verse_id, total_dedications');

    const countMap = Object.fromEntries(
      (counts || []).map((c) => [c.verse_id, Number(c.total_dedications || 0)])
    );

    verses = (versesRaw || []).map((v) => ({
      id: v.id,
      ref: v.reference,
      text: v.text_kjv,
      themeIds: (v.verse_themes || []).map((vt) => vt.theme_id),
      themeNames: (v.verse_themes || []).map((vt) => vt.themes?.name).filter(Boolean),
      count: countMap[v.id] || 0,
    }));

    const { data: recentDedications } = await supabasePublic
      .from('dedications')
      .select('recipient_name, dedicator_name, is_anonymous, created_at, verses(reference)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(6);

    feedItems = (recentDedications || []).map((d) => ({
      who: d.is_anonymous ? 'Someone' : d.dedicator_name || 'Someone',
      verse: d.verses?.reference || '',
      target: d.recipient_name,
    }));
  } catch (err) {
    // Build must not fail when env vars / tables are not ready yet.
    console.error('[home] data fetch failed:', err?.message || err);
  }

  return {
    props: { verses, themes, feedItems },
    revalidate: 60,
  };
}
