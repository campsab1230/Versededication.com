import { SITE_NAME, CONTACT_EMAIL, siteUrl } from './site';

// ============================================================
// SERVER-ONLY email delivery via Resend.
//
// If RESEND_API_KEY is not set, we do NOT throw — we log and
// return { skipped: true }. That way the Stripe webhook can still
// record the order even before email is configured, and you won't
// lose a sale while you're finishing setup.
//
// ⚠️  Only import from API routes.
// ============================================================

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// ============================================================
// SENDER vs REPLY-TO — two different jobs
//
// `from` must be an address on a domain you CONTROL, because Resend
// authenticates it with DKIM/SPF records published in that domain's DNS.
// versededication.com is verified, so certificates@versededication.com works.
//
// A free-mail address (gmail.com, outlook.com, …) can NEVER be the sender:
// we do not control gmail.com's DNS, there is nothing to sign with, and
// Resend rejects the send. Setting EMAIL_FROM to a Gmail address therefore
// stops certificate delivery entirely — at the exact moment a customer has
// paid, and with no error visible to them.
//
// Replies are the separate problem. The certificate is sent from the brand
// address, but a customer hitting "Reply" must reach a monitored inbox. That
// is `reply_to`, and it may be ANY address, free mail included.
// ============================================================
const FREEMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
  'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net',
  'mail.com', 'zoho.com', 'yandex.com', 'aol.co.uk',
  'comcast.net', 'verizon.net', 'sbcglobal.net', 'att.net', 'cox.net',
]);

// Always deliverable: an address on the verified brand domain.
const BRAND_FROM = `${SITE_NAME} <certificates@versededication.com>`;

/** Pull the address out of either `a@b.com` or `Name <a@b.com>`. */
function bareAddress(value) {
  const s = String(value || '').trim();
  const m = s.match(/<\s*([^>\s]+)\s*>/);
  return (m ? m[1] : s).trim();
}

function domainOf(value) {
  const addr = bareAddress(value);
  const at = addr.lastIndexOf('@');
  return at === -1 ? '' : addr.slice(at + 1).toLowerCase();
}

export function isFreemailAddress(value) {
  return FREEMAIL_DOMAINS.has(domainOf(value));
}

/**
 * Resolve the From and Reply-To for an outgoing message.
 *
 * EMAIL_REPLY_TO wins when set; otherwise replies go to the public contact
 * address — the same inbox the contact/privacy/terms pages already advertise,
 * so a customer replying to a certificate and a customer using the contact
 * page both land in one place.
 *
 * If EMAIL_FROM is a free-mail address we refuse to use it as the sender and
 * fall back to the brand domain, routing to that address instead. That way a
 * misconfiguration degrades to "replies go to the right inbox" rather than
 * "no certificates are delivered at all".
 */
export function senderAddresses() {
  const configured = String(process.env.EMAIL_FROM || '').trim();
  const replyConfigured = String(process.env.EMAIL_REPLY_TO || '').trim();
  const replyTo = bareAddress(replyConfigured || CONTACT_EMAIL);

  if (!configured) {
    return { from: BRAND_FROM, replyTo };
  }

  if (isFreemailAddress(configured)) {
    const addr = bareAddress(configured);
    console.warn(
      `[email] EMAIL_FROM is a free-mail address (${addr}). Resend cannot send ` +
        'from it — its domain DNS is not ours, so there is nothing to authenticate ' +
        `against. Sending from ${bareAddress(BRAND_FROM)} and routing replies to ` +
        `${addr} instead.`
    );
    return { from: BRAND_FROM, replyTo: addr };
  }

  return { from: configured, replyTo };
}

export async function sendCertificateEmail({
  to,
  recipientName,
  reference,
  certificateUrl,
  tier,
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const { from, replyTo } = senderAddresses();

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping certificate email to', to);
    return { skipped: true, reason: 'not_configured' };
  }
  if (!to) {
    console.warn('[email] No recipient email on order — skipping certificate email.');
    return { skipped: true };
  }

  const isHeirloom = tier === 'heirloom';
  const subject = `Your dedication of ${reference} is ready`;
  const heirloomLine = isHeirloom
    ? `<p style="margin:16px 0;color:#5C564A;">Your printed Heirloom certificate will ship within 3–5 business days.</p>`
    : '';

  const html = `
  <div style="background:#F4EEE0;padding:32px;font-family:Georgia,serif;color:#2A2620;">
    <div style="max-width:520px;margin:0 auto;background:#FBF8F0;border:2px solid #A8823D;border-radius:8px;padding:32px;">
      <p style="text-align:center;letter-spacing:.08em;font-size:11px;color:#7A5F2C;margin:0 0 12px;">CERTIFICATE OF DEDICATION</p>
      <h1 style="text-align:center;font-size:24px;margin:0 0 12px;">${escapeHtml(reference)}</h1>
      <p style="text-align:center;color:#5C564A;margin:0 0 8px;">dedicated to</p>
      <p style="text-align:center;font-size:22px;color:#7A5F2C;margin:0 0 20px;"><strong>${escapeHtml(
        recipientName
      )}</strong></p>
      ${heirloomLine}
      <p style="text-align:center;margin:24px 0;">
        <a href="${certificateUrl}" style="background:#A8823D;color:#1A1508;text-decoration:none;padding:14px 28px;border-radius:4px;display:inline-block;">Download your certificate</a>
      </p>
      <p style="text-align:center;font-size:12px;color:#5C564A;margin-top:24px;">
        Or copy this link: <br/><a href="${certificateUrl}" style="color:#7A5F2C;">${certificateUrl}</a>
      </p>
    </div>
    <p style="text-align:center;font-size:11px;color:#8A8270;margin-top:20px;">
      ${SITE_NAME} · ${siteUrl()}
    </p>
  </div>`;

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // reply_to is what makes a customer's "Reply" reach a monitored inbox.
    // The From address is the brand domain (deliverable); the reply address is
    // whatever real inbox the operator watches.
    body: JSON.stringify({ from, to, subject, html, reply_to: replyTo }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[email] Resend error', res.status, body);
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

// ============================================================
// Verse request emails.
//
// Two messages, both best-effort:
//   1. a confirmation to the requester (only if they gave an email)
//   2. a heads-up to the site owner so the verse actually gets added
//
// Like sendCertificateEmail, a missing RESEND_API_KEY returns
// { skipped: true } rather than throwing — the request is already
// saved by the time we get here.
// ============================================================

// How long we tell the requester to expect. Kept in one place so the UI,
// the API response and this email cannot drift apart.
export const VERSE_REQUEST_ETA = 'within 24 hours';

export async function sendVerseRequestEmail({ to, reference, requesterName, adminTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const { from, replyTo } = senderAddresses();

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping verse-request email for', reference);
    return { skipped: true, reason: 'not_configured' };
  }

  const safeRef = escapeHtml(reference);
  const who = requesterName ? escapeHtml(requesterName) : null;
  const results = { requester: null, admin: null };

  // ---- 1. Confirmation to the requester -------------------------------
  if (to) {
    const html = `
    <div style="background:#F4EEE0;padding:32px;font-family:Georgia,serif;color:#2A2620;">
      <div style="max-width:520px;margin:0 auto;background:#FBF8F0;border:2px solid #A8823D;border-radius:8px;padding:32px;">
        <p style="text-align:center;letter-spacing:.08em;font-size:11px;color:#7A5F2C;margin:0 0 12px;">VERSE REQUEST RECEIVED</p>
        <h1 style="text-align:center;font-size:22px;margin:0 0 16px;">${safeRef}</h1>
        <p style="margin:0 0 12px;">Thank you${who ? `, ${who}` : ''} — we have your request.</p>
        <p style="margin:0 0 12px;">
          We are adding <strong>${safeRef}</strong> to the collection. It will be available
          <strong>${VERSE_REQUEST_ETA}</strong>, and we will email you the moment it is ready to dedicate.
        </p>
        <p style="margin:0;color:#5C564A;font-size:13px;">
          Every verse we add is the King James Version, and can be personalized into a certificate just
          like the rest of the collection.
        </p>
      </div>
      <p style="text-align:center;font-size:11px;color:#8A8270;margin-top:20px;">
        ${SITE_NAME} · ${siteUrl()}
      </p>
    </div>`;

    results.requester = await post(apiKey, {
      from,
      to,
      subject: `We received your request for ${reference}`,
      html,
      reply_to: replyTo,
    });
  } else {
    results.requester = { skipped: true, reason: 'no requester email' };
  }

  // ---- 2. Notification to the site owner ------------------------------
  if (adminTo) {
    const adminHtml = `
    <div style="font-family:Georgia,serif;color:#2A2620;">
      <h2 style="margin:0 0 12px;">New verse request</h2>
      <p style="margin:0 0 8px;"><strong>Verse:</strong> ${safeRef}</p>
      <p style="margin:0 0 8px;"><strong>From:</strong> ${who || '(not given)'}</p>
      <p style="margin:0 0 8px;"><strong>Email:</strong> ${to ? escapeHtml(to) : '(not given — cannot follow up)'}</p>
      <p style="margin:16px 0 0;color:#5C564A;font-size:13px;">
        Promised to the requester ${VERSE_REQUEST_ETA}. Add it, then mark the request
        <code>added</code> in the <code>verse_requests</code> table.
      </p>
    </div>`;

    results.admin = await post(apiKey, {
      from,
      to: adminTo,
      subject: `Verse request: ${reference}`,
      html: adminHtml,
      // Replying to the internal notification should reach the same monitored
      // inbox, not the brand certificate address.
      reply_to: replyTo,
    });
  } else {
    results.admin = { skipped: true, reason: 'no admin address' };
  }

  const ok = !!(results.requester?.ok || results.admin?.ok);
  // A bare `ok:false` cannot tell "Resend is not configured" apart from
  // "Resend rejected the send". Callers log this, so failures are diagnosable.
  return { ok, reason: ok ? null : describeFailure(results), ...results };
}

// Collapse the per-recipient attempts into one short machine-readable reason.
function describeFailure(results) {
  const attempts = [results.requester, results.admin].filter((r) => r && !r.skipped);

  if (!attempts.length) {
    const reasons = [results.requester?.reason, results.admin?.reason].filter(Boolean);
    if (reasons.includes('missing api key')) return 'not_configured';
    return 'no_recipient';
  }

  const failed = attempts.find((r) => !r.ok);
  if (!failed) return 'unknown';
  // 403 from Resend almost always means the sending domain is not verified yet.
  if (failed.status === 403) return 'domain_not_verified';
  if (failed.status) return `resend_http_${failed.status}`;
  if (failed.error) return 'network_error';
  return 'unknown';
}

// Shared POST to Resend. Never throws — returns { ok } / { ok:false, status }.
async function post(apiKey, payload) {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] Resend error', res.status, body);
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.error('[email] Resend request failed:', err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
