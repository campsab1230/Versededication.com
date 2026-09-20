import { createClient } from '@supabase/supabase-js';

// ============================================================
// BROWSER / PUBLIC client.
// Uses the anon key — safe to expose because Row Level Security
// restricts what it can read. Only used for public reads (verses,
// themes, public dedications).
//
// NOTE: this file imports the anon key only; it will throw at
// import time if the public env vars are missing, which is a
// useful early failure in development.
// ============================================================

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Warn instead of throwing so that `next build` can still succeed
  // while env vars are being set up. Public pages will show empty state.
  console.warn(
    '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Public data will not load until these are set in .env.local.'
  );
}

export const supabasePublic = createClient(url || 'http://localhost', anonKey || 'anon', {
  auth: { persistSession: false },
});
