import { siteUrl } from '@/lib/site';

export default function Robots() {
  return null;
}

export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'text/plain');
  res.write(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${siteUrl()}/sitemap.xml
`);
  res.end();
  return { props: {} };
}
