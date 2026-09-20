import { siteUrl } from '@/lib/site';

// Sitemap for search engines. Public, indexable pages only.
export default function Sitemap() {
  return null;
}

function generateSiteMap() {
  const base = siteUrl();
  const pages = ['', '/privacy', '/terms', '/refunds', '/contact'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${base}${p}</loc>
    <changefreq>${p === '' ? 'daily' : 'monthly'}</changefreq>
    <priority>${p === '' ? '1.0' : '0.5'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'application/xml');
  res.write(generateSiteMap());
  res.end();
  return { props: {} };
}
