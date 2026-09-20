import Head from 'next/head';
import { supabasePublic } from '@/lib/supabasePublic';
import { fetchVerseSlugs, fetchVersesWithMeta, mapVerseRow } from '@/lib/verseData';
import { snippetOf } from '@/lib/text';
import {
  SITE_NAME,
  siteUrl,
  BIBLE_TRANSLATION,
  CHARITY_PERCENT,
  CHARITY,
} from '@/lib/site';

// ============================================================
// Per-verse page — exists mainly so each verse is indexable and
// shareable. The CTA bounces back to the home page and opens the
// dedication modal for this verse via /?open=<id>.
// ============================================================

export default function VersePage({ verse, related }) {
  const title = `${verse.ref} — Dedicate this verse · ${SITE_NAME}`;
  const description = `${snippetOf(verse.text, 150)} Dedicate ${verse.ref} to someone you love.`;
  const url = `${siteUrl()}/verse/${verse.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: verse.ref,
    text: verse.text,
    inLanguage: 'en',
    isBasedOn: BIBLE_TRANSLATION,
    url,
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        <meta name="twitter:card" content="summary_large_image" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <header className="mini-bar">
        <a href="/" className="mini-brand">
          Verse Dedication
        </a>
        <a href="/" className="mini-link">
          Browse all verses
        </a>
      </header>

      <main className="verse-page">
        <p className="verse-page-count">
          Dedicated {verse.count} {verse.count === 1 ? 'time' : 'times'}
        </p>
        <h1 className="verse-page-ref">{verse.ref}</h1>
        <blockquote className="verse-page-text">&ldquo;{verse.text}&rdquo;</blockquote>
        <p className="verse-page-trans">{BIBLE_TRANSLATION}</p>

        {verse.themeNames.length > 0 && (
          <div className="verse-page-themes">
            {verse.themeNames.map((n) => (
              <span key={n} className="theme-chip">
                {n}
              </span>
            ))}
          </div>
        )}

        <div className="verse-page-cta">
          <a className="btn btn-gold" href={`/?open=${verse.id}#browse`}>
            Dedicate this verse
          </a>
          <a className="btn btn-outline-dark" href="/">
            See all verses
          </a>
        </div>

        <p className="verse-page-charity">
          {CHARITY_PERCENT}% of every dedication is given to {CHARITY.name}.
        </p>

        {related.length > 0 && (
          <section className="verse-page-related">
            <h2>More verses like this</h2>
            <div className="verse-grid">
              {related.map((v) => (
                <a key={v.id} className="verse-card" href={`/verse/${v.slug}`}>
                  <span className="verse-ref">{v.ref}</span>
                  <span className="verse-snippet">{snippetOf(v.text)}</span>
                  <span className="verse-meta">
                    <span>
                      Dedicated {v.count} {v.count === 1 ? 'time' : 'times'}
                    </span>
                    <span>{v.themeNames[0] || 'Scripture'}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer>
        <div className="serif" style={{ fontSize: 22 }}>
          Verse Dedication
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/refunds">Refunds</a>
          <a href="/contact">Contact</a>
        </nav>
        <p>{BIBLE_TRANSLATION}</p>
      </footer>
    </>
  );
}

export async function getStaticPaths() {
  let slugs = [];
  try {
    slugs = await fetchVerseSlugs();
  } catch (err) {
    console.error('[verse] slug fetch failed:', err?.message || err);
  }

  return {
    paths: slugs.map((slug) => ({ params: { slug } })),
    // New verses added to the DB get generated on first request.
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  try {
    const { data: verseRow } = await supabasePublic
      .from('verses')
      .select('id, reference, slug, text_kjv, featured, verse_themes(theme_id, themes(name, slug))')
      .eq('slug', params.slug)
      .single();

    if (!verseRow) return { notFound: true };

    const { data: countRow } = await supabasePublic
      .from('verse_dedication_counts')
      .select('total_dedications')
      .eq('verse_id', verseRow.id)
      .maybeSingle();

    const verse = mapVerseRow(verseRow, {
      [verseRow.id]: Number(countRow?.total_dedications || 0),
    });

    // Related = verses sharing any theme, excluding this one.
    let related = [];
    try {
      const all = await fetchVersesWithMeta();
      related = all
        .filter(
          (v) => v.id !== verse.id && v.themeIds.some((t) => verse.themeIds.includes(t))
        )
        .slice(0, 3);
    } catch (err) {
      console.error('[verse] related fetch failed:', err?.message || err);
    }

    return { props: { verse, related }, revalidate: 300 };
  } catch (err) {
    console.error('[verse] data fetch failed:', err?.message || err);
    return { notFound: true };
  }
}
