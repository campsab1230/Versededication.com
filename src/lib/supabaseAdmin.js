import { createClient } from '@supabase/supabase-js';

// ============================================================
// SERVER-ONLY admin client.
// Uses the SERVICE ROLE key, which BYPASSES Row Level Security.
//
// ⚠️  NEVER import this file into any component under /src/app or
//     /src/components that runs in the browser. It is only safe to
//     import from API routes (anything that runs on the server).
//
//     If you ever see "SUPABASE_SERVICE_ROLE_KEY" in client output,
//     something is wrong.
// ============================================================

let cached = null;

export function supabaseAdmin() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'supabaseAdmin(): NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.'
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
