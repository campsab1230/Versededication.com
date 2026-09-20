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

function secretMatches(provided) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  // timing-safe compare requires equal lengths
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
    // ---- Sign in ----
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (!secretMatches(body.password)) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      const cookie = [
        `${ADMIN_COOKIE}=${encodeURIComponent(body.password)}`,
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

    // ---- Everything below needs auth ----
    const cookieVal = readCookie(req, ADMIN_COOKIE);
    if (!secretMatches(cookieVal)) {
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
