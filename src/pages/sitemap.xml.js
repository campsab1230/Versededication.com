import { siteUrl } from '@/lib/site';
import { fetchVerseSlugs } from '@/lib/verseData';

// Sitemap for search engines. Public, indexable pages + every verse.
export default function Sitemap() {
  return null;
}

function urlEntry(base, p, changefreq, priority) {
  return `  <url>
    <loc>${base}${p}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function generateSiteMap(verseSlugs) {
  const base = siteUrl();

  const staticPages = [
    ['', 'daily', '1.0'],
    ['/privacy', 'monthly', '0.3'],
    ['/terms', 'monthly', '0.3'],
    ['/refunds', 'monthly', '0.3'],
    ['/contact', 'monthly', '0.3'],
  ];

  const versePages = verseSlugs.map((slug) => [`/verse/${slug}`, 'weekly', '0.7']);

  const all = [...staticPages, ...versePages];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(([p, cf, pr]) => urlEntry(base, p, cf, pr)).join('\n')}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  let slugs = [];
  try {
    slugs = await fetchVerseSlugs();
  } catch (err) {
    console.error('[sitemap] slug fetch failed:', err?.message || err);
  }

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(generateSiteMap(slugs));
  res.end();
  return { props: {} };
}
