import Head from 'next/head';
import { BUSINESS, CONTACT_EMAIL, SITE_NAME, siteUrl } from '@/lib/site';

export default function Contact() {
  return (
    <>
      <Head>
        <title>{`Contact · ${SITE_NAME}`}</title>
        <meta name="description" content={`Get in touch with ${SITE_NAME}.`} />
      </Head>
      <main className="legal">
        <h1>Contact</h1>
        <p className="updated">We usually reply within 2 business days.</p>

        <h2>Email</h2>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>

        <h2>Order help</h2>
        <p>
          Include the email address you used at checkout and, if you have it, the verse reference. That
          lets us find your order quickly.
        </p>

        <h2>Business details</h2>
        <p>
          {BUSINESS.name}
          <br />
          {BUSINESS.addressLines.join(', ')}
          <br />
          Registered in {BUSINESS.registration}
        </p>

        <h2>Site</h2>
        <p>{siteUrl()}</p>

        <p style={{ marginTop: 40 }}>
          <a href="/">← Back to {SITE_NAME}</a>
        </p>
      </main>
    </>
  );
}
