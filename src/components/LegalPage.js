import Head from 'next/head';
import { SITE_NAME } from '@/lib/site';

// Shared shell for legal pages. Keeps them readable and consistent.
export default function LegalPage({ title, updated, children }) {
  return (
    <>
      <Head>
        <title>{`${title} · ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="legal">
        <h1>{title}</h1>
        <p className="updated">Last updated: {updated}</p>
        <div className="legal-note" style={{
          border: '1px solid var(--line)',
          borderLeft: '3px solid var(--gold)',
          borderRadius: 4,
          padding: '14px 18px',
          marginBottom: 28,
          background: 'var(--cream-card)',
        }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Template — review before you launch.</strong>
          <span style={{ fontSize: 14 }}>
            This page is a starting point written to fit how the site actually works. It is not legal
            advice. Have a qualified professional review it for your jurisdiction and business before
            you take payments.
          </span>
        </div>
        {children}
        <p style={{ marginTop: 40 }}>
          <a href="/">← Back to {SITE_NAME}</a>
        </p>
      </main>
    </>
  );
}
