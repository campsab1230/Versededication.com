import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendVerseRequestEmail } from '@/lib/email';
import { CONTACT_EMAIL } from '@/lib/site';

// ============================================================
// POST /api/verse-request
//
// A visitor asks for a verse we do not carry yet. We promise it
// within 24 hours, so we store the ask and (if they left an email)
// send them a confirmation.
//
// The insert uses the SERVICE ROLE because verse_requests has no
// public policy — it holds requester emails and must never be
// readable with the anon key.
// ============================================================

const MAX_REFERENCE = 120;
const MAX_NAME = 80;
const MAX_EMAIL = 160;
const MAX_NOTE = 400;

// Deliberately permissive: we want to catch typos, not police valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clamp(str, max) {
  return String(str || '').trim().slice(0, max);
}

// Best-effort in-memory throttle. Serverless instances are ephemeral and there
// may be several, so this is a speed bump for accidental double-submits, not a
// real defence. If verse requests ever get abused, move this to a DB counter.
const recent = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function throttled(key) {
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(key, hits);
    return true;
  }
  hits.push(now);
  recent.set(key, hits);
  // Keep the map from growing without bound on a long-lived instance.
  if (recent.size > 500) {
    for (const [k, v] of recent) {
      if (!v.some((t) => now - t < WINDOW_MS)) recent.delete(k);
    }
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    const reference = clamp(body.reference, MAX_REFERENCE);
    const requester_name = clamp(body.requester_name, MAX_NAME);
    const requester_email = clamp(body.requester_email, MAX_EMAIL).toLowerCase();
    const note = clamp(body.note, MAX_NOTE);

    if (reference.length < 2) {
      return res.status(400).json({ error: 'Tell us which verse you are looking for.' });
    }
    // Guard against a pasted paragraph being filed as a "reference".
    if (reference.split(/\s+/).length > 14) {
      return res.status(400).json({ error: 'Please give just the verse reference.' });
    }
    if (requester_email && !EMAIL_RE.test(requester_email)) {
      return res.status(400).json({ error: 'That email address does not look right.' });
    }

    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';
    if (throttled(ip)) {
      return res
        .status(429)
        .json({ error: 'Too many requests just now. Please try again in a minute.' });
    }

    const { data, error } = await supabaseAdmin()
      .from('verse_requests')
      .insert({
        reference,
        requester_name: requester_name || null,
        requester_email: requester_email || null,
        note: note || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[verse-request] insert failed:', error.message || error);
      return res
        .status(500)
        .json({ error: 'We could not save that just now. Please try again shortly.' });
    }

    // Email is a courtesy, never a blocker: if Resend is unconfigured the
    // request is still stored and the visitor still sees the confirmation.
    let emailed = false;
    try {
      const result = await sendVerseRequestEmail({
        to: requester_email,
        reference,
        requesterName: requester_name,
        adminTo: CONTACT_EMAIL,
      });
      emailed = !!result?.ok;
    } catch (err) {
      console.error('[verse-request] email failed:', err?.message || err);
    }

    return res.status(201).json({
      ok: true,
      id: data?.id,
      emailed,
      // The promise we make in the UI, returned so copy and behaviour agree.
      eta: 'within 24 hours',
    });
  } catch (err) {
    console.error('[verse-request]', err);
    return res
      .status(500)
      .json({ error: 'Something went wrong. Please try again in a moment.' });
  }
}
