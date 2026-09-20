import Head from 'next/head';
import { SITE_NAME } from '@/lib/site';

export default function NotFound() {
  return (
    <>
      <Head>
        <title>{`Page not found · ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="legal" style={{ textAlign: 'center' }}>
        <p
          className="serif"
          style={{ fontSize: 60, color: 'var(--gold-text)', marginBottom: 8 }}
        >
          404
        </p>
        <h1>This page could not be found.</h1>
        <p>
          The verse or page you were looking for may have moved, or the link may be mistyped.
        </p>
        <p style={{ marginTop: 28 }}>
          <a href="/" className="btn btn-gold">
            Browse verses
          </a>
        </p>
      </main>
    </>
  );
}
