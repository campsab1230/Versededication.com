import Head from 'next/head';
import HomeClient from '@/components/HomeClient';
import { fetchThemes, fetchVersesWithMeta, fetchRecentFeed } from '@/lib/verseData';
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
    themes = await fetchThemes();
    verses = await fetchVersesWithMeta();
    feedItems = await fetchRecentFeed(6);
  } catch (err) {
    // Build must not fail when env vars / tables are not ready yet.
    console.error('[home] data fetch failed:', err?.message || err);
  }

  return {
    props: { verses, themes, feedItems },
    revalidate: 60,
  };
}
