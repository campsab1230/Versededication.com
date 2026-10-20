import Head from 'next/head';
import HomeClient from '@/components/HomeClient';
import { fetchThemes, fetchVersesWithMeta, fetchRecentFeed } from '@/lib/verseData';
import { SITE_NAME, SITE_DESCRIPTION, siteUrl } from '@/lib/site';

export default function Home({ verses, themes, feedItems, dataUnavailable }) {
  const title = `${SITE_NAME} — Dedicate a Bible Verse`;
  const shareImage = `${siteUrl()}/og-image.png`;
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <link rel="canonical" href={siteUrl()} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl()} />
        <meta property="og:image" content={shareImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`${SITE_NAME} — a framed certificate of dedication`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={SITE_DESCRIPTION} />
        <meta name="twitter:image" content={shareImage} />
      </Head>
      <HomeClient
        verses={verses}
        themes={themes}
        feedItems={feedItems}
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
  // True when the verse library itself could not be read. The page still
  // renders (the build must never fail on a database blip) but it says so
  // instead of showing a cheerful empty grid — which is what previously
  // disguised a total outage as "no data yet".
  let dataUnavailable = false;

  try {
    themes = await fetchThemes();
  } catch (err) {
    console.error('[home] themes fetch failed:', err?.message || err);
    dataUnavailable = true;
  }

  try {
    verses = await fetchVersesWithMeta();
  } catch (err) {
    console.error('[home] verses fetch failed:', err?.message || err);
    dataUnavailable = true;
  }

  // The feed is decorative — its failure must not mark the library unavailable.
  try {
    feedItems = await fetchRecentFeed(6);
  } catch (err) {
    console.error('[home] feed fetch failed:', err?.message || err);
  }

  return {
    props: { verses, themes, feedItems, dataUnavailable },
    revalidate: 60,
  };
}
