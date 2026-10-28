'use client';

// ============================================================
// ShareButtons
//
// A row of share targets for one page. Deliberately dependency-free:
// no icon library, no third-party share SDK. Every target is a plain
// <a> built from a URL template, which means:
//
//   * no JS is required for the platform links to work at all
//   * nothing is blocked by an ad blocker or a consent prompt
//   * there is no tracking pixel to disclose in the privacy policy
//
// Two targets are NOT links, because they cannot be:
//   * Copy link      — needs the Clipboard API (with an execCommand
//                      fallback for older iOS Safari)
//   * device share   — navigator.share(), only rendered when the
//                      browser actually supports it (mobile mostly)
//
// ⚠️  Share URLs must be the CANONICAL host. These links are followed
//     by crawlers that often will NOT follow a redirect, so an apex
//     URL that 308s to www produces a blank preview card. siteUrl()
//     normalises this — see src/lib/site.js.
// ============================================================

import { useEffect, useState } from 'react';

function enc(value) {
  return encodeURIComponent(String(value || ''));
}

const ICONS = {
  facebook:
    'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488',
  email:
    'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.236-8 5-8-5V6l8 5 8-5Z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1ZM8 13h8v-2H8v2Zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4a5 5 0 0 0 0-10Z',
  share:
    'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15a2.99 2.99 0 0 0 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92Z',
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function ShareButtons({
  url,
  title,
  text,
  label = 'Share',
  variant = 'default',
}) {
  // navigator.share only exists on a secure origin (https) and mostly on
  // mobile. Resolved in an effect, not during render, so the server HTML and
  // the first client paint agree — otherwise React warns about a mismatch.
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    );
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  const shareUrl = url || '';
  const shareTitle = title || 'Verse Dedication';
  // Some platforms render the text next to the link and some ignore it
  // entirely; both get the same blurb so the copy stays consistent.
  const shareText = text || shareTitle;

  const targets = [
    {
      key: 'facebook',
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`,
    },
    {
      key: 'x',
      name: 'X',
      href: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`,
    },
    {
      key: 'whatsapp',
      name: 'WhatsApp',
      href: `https://wa.me/?text=${enc(`${shareText} ${shareUrl}`)}`,
    },
    {
      key: 'email',
      name: 'Email',
      href: `mailto:?subject=${enc(shareTitle)}&body=${enc(`${shareText}\n\n${shareUrl}`)}`,
    },
  ];

  async function copyLink() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older iOS Safari and any non-secure context. The
        // textarea must be in the document and selected for execCommand.
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
    } catch (err) {
      // Clipboard can be blocked by permissions policy. Do not claim success.
      console.warn('[share] copy failed:', err?.message || err);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
    } catch (err) {
      // AbortError = the user dismissed the sheet. That is not a failure.
      if (err?.name !== 'AbortError') {
        console.warn('[share] native share failed:', err?.message || err);
      }
    }
  }

  return (
    <div className={`share ${variant === 'footer' ? 'share--footer' : ''}`}>
      <p className="share-label">{label}</p>
      <div className="share-row">
        {targets.map((t) => (
          <a
            key={t.key}
            className="share-btn"
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${t.name}`}
          >
            <Icon name={t.key} />
            <span>{t.name}</span>
          </a>
        ))}

        <button
          type="button"
          className={`share-btn ${copied ? 'share-copied' : ''}`}
          onClick={copyLink}
          aria-label={copied ? 'Link copied' : 'Copy link'}
        >
          <Icon name="link" />
          <span>{copied ? 'Copied' : 'Copy link'}</span>
        </button>

        {canNativeShare && (
          <button
            type="button"
            className="share-btn"
            onClick={nativeShare}
            aria-label="Share via your device"
          >
            <Icon name="share" />
            <span>More</span>
          </button>
        )}
      </div>
      {/* Announced politely so a screen reader user hears that the copy
          worked — the visible label change alone is easy to miss. */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  );
}
