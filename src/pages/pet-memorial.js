import Head from 'next/head';
import { fetchVersesWithMeta } from '@/lib/verseData';
import { snippetOf } from '@/lib/text';
import {
  SITE_NAME,
  SITE_DESCRIPTION,
  siteUrl,
  BIBLE_TRANSLATION,
  CHARITY_PERCENT,
  CHARITY,
} from '@/lib/site';
import { TIERS, formatPrice } from '@/lib/pricing';
import { selectPetMemorialVerses } from '@/lib/petMemorial';

// ============================================================
// For a Beloved Pet — pet memorial landing page.
//
// One clean link (versededication.com/pet-memorial) that vets,
// groomers, pet cremation services and shelters can put on a
// card, and that someone who just lost a dog, a cat, or any
// creature they loved can land on without hunting through the
// general catalogue.
//
// Same shape as /memorial on purpose: quiet copy, no sales
// language, verses selected by slug (see
// src/lib/petMemorial.js) so the page works whether or not
// the pet verses / theme have been added to the database yet.
// Each card links to the verse's own page, whose CTA opens
// the dedication flow — the pet's name goes in as the
// recipient name, the owner's as the dedicator.
// ============================================================

export default function PetMemorial({ verses, dataUnavailable }) {
  const title = `For a Beloved Pet — Dedicate a Verse in Their Memory · ${SITE_NAME}`;
  const description =
    'They were family. Dedicate a King James verse in memory of a beloved pet — personalized with their name, delivered by email in minutes, or printed and mailed as a keepsake.';
  const url = `${siteUrl()}/pet-memorial`;
  const shareImage = `${siteUrl()}/og-image.png`;
  const digital = TIERS.digital;
  const heirloom = TIERS.heirloom;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={shareImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content={`${SITE_NAME} — a framed certificate of dedication`}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={shareImage} />
      </Head>

      <header className="mini-bar">
        <a href="/" className="mini-brand">
          Verse Dedication
        </a>
        <a href="/" className="mini-link">
          Browse all verses
        </a>
      </header>

      <section className="hero">
        <svg className="hero-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 6 L24 30 M15 14 L33 14" stroke="#C9A968" strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="36" r="4" stroke="#C9A968" strokeWidth="1.4" fill="none" />
        </svg>
        <p className="hero-brand">Verse Dedication</p>
        <p className="hero-kicker">For a Beloved Pet</p>
        <h1>For the one who was never &ldquo;just a pet.&rdquo;</h1>
        <p>
          Not one sparrow falls without the Father — and the creature you loved was
          known to Him too. Choose a verse, add their name and yours, and keep a
          dedication worthy of what they were to you — delivered by email in
          minutes, or printed and mailed as a keepsake.
        </p>
        <div className="hero-cta">
          <a href="#pet-verses" className="btn btn-gold">
            Choose a verse
          </a>
          <a href="#pet-how" className="btn btn-outline">
            How it works
          </a>
        </div>
      </section>

      <section className="section browse" id="pet-verses">
        <div className="wrap">
          <div className="section-head">
            <h2>Verses for losing a pet</h2>
            <p>
              Verses about God&rsquo;s care for every creature He made, and comfort
              for the heart that loved one — every one can be dedicated in their
              name, with your message on the certificate.
            </p>
          </div>

          <div className="verse-grid memorial-grid">
            {verses.map((v) => (
              <a key={v.id} className="verse-card" href={`/verse/${v.slug}`}>
                <span className="verse-ref">{v.ref}</span>
                <span className="verse-snippet">{snippetOf(v.text)}</span>
                <span className="verse-meta">
                  <span>
                    Dedicated {v.count} {v.count === 1 ? 'time' : 'times'}
                  </span>
                  <span>For a Beloved Pet</span>
                </span>
              </a>
            ))}
            {verses.length === 0 && (
              <div className="empty-state">
                <p>
                  {dataUnavailable
                    ? 'The verse library is temporarily unavailable — we are on it. Please check back shortly.'
                    : 'These verses are being prepared. Please check back shortly.'}
                </p>
                <a className="btn btn-outline" href="/">
                  Browse all verses
                </a>
              </div>
            )}
          </div>

          <p className="request-inline">
            Don&rsquo;t see the verse you need?{' '}
            <a href="/#browse">Request it on the home page</a> — it&rsquo;s added
            within 24 hours.
          </p>

          <p className="request-inline">
            Missing a person instead?{' '}
            <a href="/memorial">Visit In Loving Memory</a>
          </p>
        </div>
      </section>

      <section className="section" id="pet-how">
        <div className="wrap">
          <div className="section-head">
            <h2>How a pet memorial dedication works</h2>
            <p>Quiet, simple, and entirely in your own time — no account, no pressure.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Choose their verse</h3>
              <p>Pick the verse above that fits them, and open it to dedicate it.</p>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <h3>Add their name</h3>
              <p>
                Put your pet&rsquo;s name as the one it is dedicated to, your name as
                the one giving it, and a short message if you have one. You can stay
                anonymous, and your dedication can stay private.
              </p>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <h3>Keep the keepsake</h3>
              <p>
                Digital ({formatPrice(digital.amountCents)}) arrives by email in about
                a minute. The printed heirloom ({formatPrice(heirloom.amountCents)},
                digital included) is mailed on premium cardstock and ships within
                3–5 business days — made to sit beside a collar, a photo, or an urn.
              </p>
            </div>
          </div>
          <p className="charity-note">
            {CHARITY_PERCENT}% given with every dedication.
            <span>
              Every purchase gives {CHARITY_PERCENT}% to{' '}
              <a href={CHARITY.url} target="_blank" rel="noopener noreferrer">
                {CHARITY.name}
              </a>
              . Not tax-deductible for the buyer.
            </span>
          </p>
        </div>
      </section>

      <footer>
        <div className="serif" style={{ fontSize: 22 }}>
          Verse Dedication
        </div>
        <div className="serif" style={{ fontSize: 15, marginBottom: 16 }}>
          Faith · Love · Always
        </div>
        <p style={{ marginBottom: 10 }}>
          {CHARITY_PERCENT}% of every purchase is given to {CHARITY.name}.
        </p>
        <nav className="footer-links" aria-label="Footer">
          <a href="/memorial">In Loving Memory</a>
          <a href="/pet-memorial">For a Beloved Pet</a>
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

// Same revalidation rhythm as the home page.
export const revalidate = 60;

export async function getStaticProps() {
  let verses = [];
  let dataUnavailable = false;

  try {
    const all = await fetchVersesWithMeta();
    verses = selectPetMemorialVerses(all);
    // A working database that returns none of the pet verses is
    // as much an outage symptom as a failed read — say so rather
    // than rendering a cheerful empty page (see verseData.js).
    // Note: until db/add-pet-memorial.sql is run, only the three
    // verses shared with the memorial collection can appear —
    // that is expected, not an outage.
    if (verses.length === 0) dataUnavailable = true;
  } catch (err) {
    console.error('[pet-memorial] verses fetch failed:', err?.message || err);
    dataUnavailable = true;
  }

  return {
    props: { verses, dataUnavailable },
    revalidate: 60,
  };
}
