'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Modal from './Modal';
import { MAX_MESSAGE_LENGTH, CHARITY_PERCENT, CHARITY } from '@/lib/site';
import { TIERS, formatPrice } from '@/lib/pricing';
import { snippetOf } from '@/lib/text';

const FAQ_ITEMS = [
  {
    q: 'Can more than one person dedicate the same verse?',
    a: "Yes. Since Scripture belongs to everyone, popular verses can be dedicated by many people — your name is added to that verse's list of dedications, numbered in the order it was given.",
  },
  { q: 'What translation is the text from?', a: 'King James Version.' },
  {
    q: 'How fast will I get my certificate?',
    a: 'Digital certificates are emailed within a minute of checkout. Heirloom certificates are printed and ship within 3–5 business days.',
  },
  { q: 'Can I send this anonymously?', a: 'Yes — just leave the "Your name" field blank.' },
  { q: 'Will my dedication appear publicly?', a: 'Only if you tick "Show my dedication in the public feed." Untick it and the dedication stays private.' },
  {
    q: 'Does any of this go to charity?',
    a: `Yes — ${CHARITY_PERCENT}% of every purchase is given to ${CHARITY.name}, who translate Scripture into languages that don't yet have it. It isn't tax-deductible for the buyer.`,
  },
];

export default function HomeClient({ verses, themes, feedItems, justDedicated }) {
  const router = useRouter();
  const [activeThemeId, setActiveThemeId] = useState('all');
  const [search, setSearch] = useState('');
  const [verseModal, setVerseModal] = useState(null);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  // Support deep links like /?open=<verse_id> (used by verse pages' CTA).
  useEffect(() => {
    const id = typeof router.query.open === 'string' ? router.query.open : null;
    if (!id) return;
    const match = verses.find((v) => v.id === id);
    if (match) {
      setVerseModal(match);
      setPersonalizeOpen(false);
    }
  }, [router.query.open, verses]);

  const [recipient, setRecipient] = useState('');
  const [dedicator, setDedicator] = useState('');
  const [message, setMessage] = useState('');
  const [tier, setTier] = useState('digital');
  const [isPublic, setIsPublic] = useState(true);
  const [recipientError, setRecipientError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredVerses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return verses.filter((v) => {
      const themeOk = activeThemeId === 'all' || v.themeIds.includes(activeThemeId);
      if (!themeOk) return false;
      if (!q) return true;
      return (
        v.ref.toLowerCase().includes(q) ||
        v.text.toLowerCase().includes(q) ||
        v.themeNames.some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [activeThemeId, search, verses]);

  function openVerse(v) {
    setVerseModal(v);
    setPersonalizeOpen(false);
  }

  function startPersonalize() {
    setRecipient('');
    setDedicator('');
    setMessage('');
    setTier('digital');
    setIsPublic(true);
    setRecipientError('');
    setFormError('');
    setPersonalizeOpen(true);
  }

  async function goToCheckout() {
    if (!recipient.trim()) {
      setRecipientError("Enter a recipient's name");
      return;
    }
    setRecipientError('');
    setFormError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verse_id: verseModal.id,
          tier,
          recipient_name: recipient.trim(),
          dedicator_name: dedicator.trim(),
          is_anonymous: !dedicator.trim(),
          message: message.trim(),
          is_public: isPublic,
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data?.url) {
        setSubmitting(false);
        setFormError(
          data?.error || 'Something went wrong starting checkout. Please try again.'
        );
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      setFormError('Network error. Please check your connection and try again.');
    }
  }

  return (
    <>
      {justDedicated && (
        <div className="banner" role="status">
          Your dedication is on its way — check your email for the certificate.
        </div>
      )}

      <section className="hero">
        <svg className="hero-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 6 L24 30 M15 14 L33 14" stroke="#C9A968" strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="36" r="4" stroke="#C9A968" strokeWidth="1.4" fill="none" />
        </svg>
        <p className="hero-brand">Verse Dedication</p>
        <p className="hero-kicker">A word for today. A light for tomorrow.</p>
        <h1>Dedicate a verse to someone you love.</h1>
        <p>
          A gift that says more than words ever could — chosen from Scripture, personalized for them,
          ready in minutes.
        </p>
        <div className="hero-cta">
          <a href="#browse" className="btn btn-gold">
            Dedicate a verse
          </a>
          <a href="#how" className="btn btn-outline">
            See how it works
          </a>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <div className="section-head">
            <h2>How it works</h2>
            <p>Three simple steps, from choosing a verse to giving it away.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Choose a verse</h3>
              <p>Browse by what someone needs right now — strength, comfort, hope, love.</p>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <h3>Personalize it</h3>
              <p>Add their name, your name, and a short message. Watch it come to life.</p>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <h3>Give it</h3>
              <p>Download it in seconds, or have a printed keepsake mailed straight to them.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section browse" id="browse">
        <div className="wrap">
          <div className="section-head">
            <h2>Find the right words for this moment</h2>
            <p>Every verse can be dedicated by more than one person — Scripture belongs to everyone.</p>
          </div>

          <div className="search-wrap">
            <label className="sr-only" htmlFor="verse-search">
              Search verses by reference, word, or theme
            </label>
            <input
              id="verse-search"
              type="search"
              className="search-input"
              placeholder="Search a verse, a word, or a feeling…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="pills" role="group" aria-label="Filter verses by theme">
            <button
              type="button"
              className={`pill ${activeThemeId === 'all' ? 'active' : ''}`}
              aria-pressed={activeThemeId === 'all'}
              onClick={() => setActiveThemeId('all')}
            >
              All
            </button>
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`pill ${activeThemeId === t.id ? 'active' : ''}`}
                aria-pressed={activeThemeId === t.id}
                onClick={() => setActiveThemeId(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="verse-grid">
            {filteredVerses.map((v) => (
              <div key={v.id} className="verse-card" onClick={() => openVerse(v)}>
                {/* Real link so search engines can crawl the per-verse pages. */}
                <a
                  className="verse-ref"
                  href={`/verse/${v.slug}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {v.ref}
                </a>
                <div className="verse-snippet">{snippetOf(v.text)}</div>
                <div className="verse-meta">
                  <span>
                    Dedicated {v.count} {v.count === 1 ? 'time' : 'times'}
                  </span>
                  <span>{v.themeNames[0] || 'Scripture'}</span>
                </div>
              </div>
            ))}
            {filteredVerses.length === 0 && (
              <p className="empty-state">
                {search.trim()
                  ? `No verses match “${search.trim()}”. Try another word.`
                  : 'No verses in this theme yet — try another.'}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <h2>Choose how you want to give it</h2>
            <p>
              Every dedication includes a personalized certificate — the printed keepsake adds a copy
              that arrives by mail.
            </p>
          </div>
          <div className="tiers">
            {Object.values(TIERS).map((t) => (
              <div key={t.key} className={`tier ${t.badge ? 'featured' : ''}`}>
                {t.badge && <span className="tier-badge">{t.badge}</span>}
                <h3>{t.name}</h3>
                <div className="price">{formatPrice(t.amountCents)}</div>
                <ul>
                  {t.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a href="#browse" className={`btn ${t.badge ? 'btn-gold' : 'btn-dark'}`}>
                  Start here
                </a>
              </div>
            ))}
          </div>
          <p className="charity-note">
            {CHARITY_PERCENT}% given with every dedication.
            <span>
              Every purchase gives {CHARITY_PERCENT}% to{' '}
              <a href={CHARITY.url} target="_blank" rel="noopener noreferrer">
                {CHARITY.name}
              </a>
              , who translate Scripture into languages that don&rsquo;t yet have it — {CHARITY.blurb}.
              Not tax-deductible for the buyer.
            </span>
          </p>
        </div>
      </section>

      <section className="section browse">
        <div className="wrap">
          <div className="section-head">
            <h2>Recent dedications</h2>
          </div>
          <div className="feed">
            {feedItems.map((f, i) => (
              <div key={i} className="feed-item">
                <span className="feed-dot" aria-hidden="true" />
                <p>
                  <b>{f.who}</b> dedicated <b>{f.verse}</b> to {f.target}.
                </p>
              </div>
            ))}
            {feedItems.length === 0 && (
              <p style={{ color: 'var(--ink-soft)', textAlign: 'center' }}>
                Be the first to dedicate a verse.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <h2>Questions</h2>
          </div>
          <div className="faq">
            {FAQ_ITEMS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={i} className={`faq-item ${open ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpenFaq(open ? null : i)}
                  >
                    {f.q}
                    <span className="plus" aria-hidden="true">
                      +
                    </span>
                  </button>
                  <div className="faq-a" id={`faq-panel-${i}`} role="region">
                    <p>{f.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
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
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/refunds">Refunds</a>
          <a href="/contact">Contact</a>
        </nav>
        <p>King James Version</p>
      </footer>

      {verseModal && !personalizeOpen && (
        <Modal onClose={() => setVerseModal(null)} labelledBy="verse-modal-title">
          <button className="modal-close" onClick={() => setVerseModal(null)} aria-label="Close">
            &times;
          </button>
          <div className="dedication-count">
            Dedicated {verseModal.count} {verseModal.count === 1 ? 'time' : 'times'}
          </div>
          <h2 id="verse-modal-title">{verseModal.ref}</h2>
          <div className="verse-text">&ldquo;{verseModal.text}&rdquo;</div>
          <button
            type="button"
            className="btn btn-gold"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={startPersonalize}
          >
            Dedicate this verse
          </button>
        </Modal>
      )}

      {personalizeOpen && verseModal && (
        <Modal onClose={() => setPersonalizeOpen(false)} labelledBy="personalize-modal-title">
          <button className="modal-close" onClick={() => setPersonalizeOpen(false)} aria-label="Close">
            &times;
          </button>
          <h2 id="personalize-modal-title">Personalize your dedication</h2>

          <div className="cert" aria-hidden="true">
            <div className="cert-kicker">Certificate of Dedication</div>
            <h3>This verse is dedicated to</h3>
            <div className="cert-to-label">dedicated to</div>
            <div className="cert-to">{recipient || 'Their name'}</div>
            <div className="cert-verse">
              &ldquo;{verseModal.text}&rdquo; — {verseModal.ref}
            </div>
            {message && <div className="cert-msg">&ldquo;{message}&rdquo;</div>}
            <div className="cert-from">
              from <b>{dedicator || 'Anonymous'}</b>
            </div>
          </div>

          <div className={`field ${recipientError ? 'invalid' : ''}`}>
            <label htmlFor="recipient">Recipient&rsquo;s name</label>
            <input
              id="recipient"
              type="text"
              placeholder="e.g. Grandma Ruth"
              value={recipient}
              aria-invalid={!!recipientError}
              onChange={(e) => {
                setRecipient(e.target.value);
                if (recipientError) setRecipientError('');
              }}
            />
            {recipientError && <div className="err">{recipientError}</div>}
          </div>

          <div className="field">
            <label htmlFor="dedicator">Your name (or leave blank to stay anonymous)</label>
            <input
              id="dedicator"
              type="text"
              placeholder="e.g. Ty"
              value={dedicator}
              onChange={(e) => setDedicator(e.target.value)}
            />
          </div>

          <div className="field">
            <div className="field-row">
              <label htmlFor="message">Personal message (optional)</label>
              <span className="char-count">
                {message.length}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>
            <textarea
              id="message"
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="A short note"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <label className="checkbox-field" htmlFor="is-public">
            <input
              id="is-public"
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>Show my dedication in the public feed (first name, verse, recipient only).</span>
          </label>

          <div className="tier-select">
            {Object.values(TIERS).map((t) => (
              <button
                key={t.key}
                type="button"
                className={`tier-opt ${tier === t.key ? 'selected' : ''}`}
                aria-pressed={tier === t.key}
                onClick={() => setTier(t.key)}
              >
                <div className="t-name">{t.key === 'heirloom' ? 'Heirloom (mailed)' : 'Digital'}</div>
                <div className="t-price">{formatPrice(t.amountCents)}</div>
              </button>
            ))}
          </div>

          {formError && <div className="form-error">{formError}</div>}

          <button
            type="button"
            className="btn btn-gold"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={goToCheckout}
            disabled={submitting}
          >
            {submitting ? 'Redirecting to checkout…' : 'Continue to checkout'}
          </button>
        </Modal>
      )}
    </>
  );
}
