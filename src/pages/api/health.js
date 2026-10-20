// ============================================================
// GET /api/health
//
// A deployment readiness check you can open in a browser.
//
// WHY THIS EXISTS
// Vercel bakes environment variables in at BUILD time. Editing a
// variable does nothing to the running deployment, and Marketplace
// integrations can inject a *second* variable under a different name
// ("Managed" keys), leaving an older plain variable in place. The
// result is a site that looks deployed, works, and silently charges
// in test mode.
//
// This endpoint answers "is THIS build live?" without a redeploy-and-
// hope cycle.
//
// ⚠️  NEVER return any part of a secret here. This route is public.
//     Only the *class* of the key (live/test/missing) is exposed,
//     never the value, length, or any character of it.
// ============================================================

function keyMode(key) {
  if (!key) return 'missing';
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  // A key that is neither is most likely truncated, quoted, or has a
  // stray newline from a bad paste.
  return 'malformed';
}

function presence(value) {
  return value && String(value).trim() ? 'set' : 'missing';
}

export default function handler(req, res) {
  // Never cache: the whole point is to see the CURRENT build's values.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mode = keyMode(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // A live key paired with a test-mode webhook secret is the quiet
  // killer: Stripe takes the money, the webhook fails signature
  // verification, and the customer never receives their certificate.
  // We cannot verify the secret itself without a real event, so we
  // surface both facts and let the two be compared.
  const priceIdsInUse = {
    digital: presence(process.env.STRIPE_PRICE_DIGITAL),
    heirloom: presence(process.env.STRIPE_PRICE_HEIRLOOM),
  };

  const warnings = [];
  if (mode !== 'live') {
    warnings.push(
      'Stripe is not in live mode for this deployment. Real cards cannot be charged.'
    );
  }
  if (mode === 'live' && presence(webhookSecret) === 'missing') {
    warnings.push(
      'Live key with no webhook secret: payments will succeed but no certificate will be generated or emailed.'
    );
  }
  if (mode === 'malformed') {
    warnings.push(
      'STRIPE_SECRET_KEY does not start with sk_live_ or sk_test_ — it was probably truncated or quoted when pasted.'
    );
  }
  if (
    priceIdsInUse.digital === 'set' ||
    priceIdsInUse.heirloom === 'set'
  ) {
    warnings.push(
      'Pre-created Price IDs are configured. Price IDs made in test mode do not exist in live mode and will fail checkout with "No such price".'
    );
  }

  return res.status(200).json({
    ok: mode === 'live',
    stripe: {
      mode,
      webhook_secret: presence(webhookSecret),
      price_ids: priceIdsInUse,
    },
    supabase: {
      url: presence(process.env.NEXT_PUBLIC_SUPABASE_URL),
      anon_key: presence(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      service_role_key: presence(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    email: {
      resend: presence(process.env.RESEND_API_KEY),
      from: presence(process.env.EMAIL_FROM),
    },
    site_url: process.env.NEXT_PUBLIC_SITE_URL || null,
    deployment: {
      environment: process.env.VERCEL_ENV || 'local',
      commit: process.env.VERCEL_GIT_COMMIT_SHA
        ? String(process.env.VERCEL_GIT_COMMIT_SHA).slice(0, 7)
        : null,
      deployment_id: process.env.VERCEL_DEPLOYMENT_ID || null,
      region: process.env.VERCEL_REGION || null,
    },
    warnings,
  });
}
