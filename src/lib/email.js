import { SITE_NAME, siteUrl } from './site';

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

export async function sendCertificateEmail({
  to,
  recipientName,
  reference,
  certificateUrl,
  tier,
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `${SITE_NAME} <onboarding@resend.dev>`;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping certificate email to', to);
    return { skipped: true };
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
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[email] Resend error', res.status, body);
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
