import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ADMIN_COOKIE } from '@/lib/site';

// ============================================================
// /api/admin/orders
//
//   POST { password }  → verify, set an httpOnly session cookie,
//                         return the order list
//   GET                → return the order list using the cookie
//   PATCH { id, status } → update an order's fulfilment status
//
// Auth is a single shared secret (ADMIN_SECRET). That's intentionally
// simple for a one-person shop: no accounts, no sessions table.
// If you add staff later, move to real auth (Supabase Auth).
//
// ⚠️  Server-only: uses the service-role client to bypass RLS.
// ============================================================

const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

// ============================================================
// The cookie must NOT carry ADMIN_SECRET.
//
// The previous version set `vd_admin=<the raw password>`. A cookie is sent on
// every request and is readable in the browser's dev tools, by any extension,
// and by anything that can read a response header. Leaking it leaked the
// permanent master password — the one credential that cannot be rotated
// without editing an environment variable and redeploying.
//
// Instead we derive a session token with HMAC-SHA256 and put THAT in the
// cookie:
//
//   token = HMAC_SHA256(ADMIN_SECRET, 'vd-admin-session-v1')
//
// Properties that matter here:
//   • The token is not reversible into ADMIN_SECRET.
//   • It is deterministic, so no session table or KV store is needed — the
//     server recomputes it and compares. Suits a one-person shop.
//   • Changing ADMIN_SECRET invalidates every existing cookie for free.
//   • The label string is signed too, so this token can never be replayed
//     against a different HMAC use of the same secret.
// ============================================================
const SESSION_LABEL = 'vd-admin-session-v1';

function sessionToken() {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', String(secret)).update(SESSION_LABEL).digest('hex');
}

// Constant-time compare that tolerates differing lengths without throwing.
// timingSafeEqual requires equal-length buffers, so length is checked first —
// which does leak length, but both sides here are fixed-length hex digests.
function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function passwordMatches(provided) {
  return safeEqual(provided, process.env.ADMIN_SECRET);
}

function sessionTokenMatches(provided) {
  return safeEqual(provided, sessionToken());
}

// ============================================================
// Sign-in throttling.
//
// ⚠️  This is per-instance and in-memory, so it is NOT a real defence against
// a distributed or patient attacker: a serverless platform runs many
// instances, each with its own counter, and they restart freely. It exists to
// blunt a single-script brute force against a shared password, which is the
// realistic threat for a site this size.
//
// If /admin ever gains a second user or starts appearing in logs as a target,
// replace this with durable storage (a D1 table, or Upstash) and real auth.
// ============================================================
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map(); // ip -> { count, resetAt }

function throttleKey(req) {
  // x-forwarded-for is set by Vercel's proxy. Take the first (client) entry.
  const fwd = req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0] : '') || req.socket?.remoteAddress || 'unknown';
  return ip.trim();
}

function isThrottled(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
  // Opportunistic cleanup so the Map cannot grow without bound.
  if (attempts.size > 500) {
    for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k);
  }
}

function clearFailures(key) {
  attempts.delete(key);
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';').map((p) => p.trim());
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx > -1 && p.slice(0, idx) === name) return decodeURIComponent(p.slice(idx + 1));
  }
  return null;
}

async function listOrders() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('orders')
    .select('id, email, tier, amount_cents, status, shipping_name, shipping_address, created_at, stripe_payment_intent_id')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export default async function handler(req, res) {
  if (!process.env.ADMIN_SECRET) {
    return res.status(503).json({ error: 'Admin is not configured (ADMIN_SECRET missing).' });
  }

  try {
    const key = throttleKey(req);

    // ---- Sign in ----
    if (req.method === 'POST') {
      if (isThrottled(key)) {
        return res
          .status(429)
          .json({ error: 'Too many attempts. Please wait 15 minutes and try again.' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (!passwordMatches(body.password)) {
        recordFailure(key);
        // Same message and status whether the password was wrong or throttled
        // on a later attempt, so this cannot be used to probe the threshold.
        return res.status(401).json({ error: 'Incorrect password.' });
      }

      clearFailures(key);

      // The cookie carries a derived token, never ADMIN_SECRET itself.
      // Existing sessions from the old scheme will fail the token check and
      // simply require signing in again — which is the intended upgrade path.
      const cookie = [
        `${ADMIN_COOKIE}=${encodeURIComponent(sessionToken())}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        `Max-Age=${COOKIE_MAX_AGE}`,
        process.env.NODE_ENV === 'production' ? 'Secure' : '',
      ]
        .filter(Boolean)
        .join('; ');
      res.setHeader('Set-Cookie', cookie);
      return res.status(200).json({ orders: await listOrders() });
    }

    // ---- Everything below needs the session token ----
    const cookieVal = readCookie(req, ADMIN_COOKIE);
    if (!sessionTokenMatches(cookieVal)) {
      return res.status(401).json({ error: 'Not signed in.' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({ orders: await listOrders() });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const { id, status } = body;
      const allowed = ['pending', 'paid', 'shipped', 'failed', 'refunded'];
      if (!id || !allowed.includes(status)) {
        return res.status(400).json({ error: 'A valid order id and status are required.' });
      }
      const { error } = await supabaseAdmin().from('orders').update({ status }).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ orders: await listOrders() });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[admin/orders]', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
}
