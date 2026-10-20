// ============================================================
// GET /api/health
//
// A deployment readiness check you can open in a browser.
//
// WHY THIS EXISTS
// Vercel bakes environment variables in at BUILD time. Editing a
// variable does nothing to the running deployment, and the Stripe
// Marketplace integration can provision a key under a name this app
// does not read — or under no name at all until the project is
// explicitly connected to the integration resource. The result is a
// site that looks deployed, serves pages fine, and cannot charge a
// card. This endpoint answers "is THIS build able to take money?"
// without a redeploy-and-hope cycle.
//
// ⚠️  NEVER return any part of a secret here. This route is public.
//     Only the *class* of the key (live / test / missing) and the
//     NAMES of variables are exposed — never a value, length, or
//     character of one.
// ============================================================

import {
  KEY_VARS,
  keyMode,
  resolveStripeKey,
  resolveWebhookSecret,
  stripeKeyReport,
} from '@/lib/stripe';

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

  const resolved = resolveStripeKey();
  const mode = keyMode(resolved ? resolved.value : '');
  const webhook = resolveWebhookSecret();

  // NAMES ONLY — never values. This is the diagnostic that separates
  // "the key was never provided to this build" from "the key is here,
  // but under a name this app does not read". Variable names are not
  // secrets; the values never enter this array.
  const stripeVarsPresent = Object.keys(process.env)
    .filter((name) => /^STRIPE/i.test(name))
    .sort();

  const priceIdsInUse = {
    digital: presence(process.env.STRIPE_PRICE_DIGITAL),
    heirloom: presence(process.env.STRIPE_PRICE_HEIRLOOM),
  };

  const warnings = [];

  if (!resolved) {
    warnings.push(
      `No Stripe secret key in this build. Looked for: ${KEY_VARS.join(', ')}. ` +
        'If you installed the Vercel Stripe integration, the project must be ' +
        'connected to the integration resource before the variable appears.'
    );
  } else if (mode === 'test') {
    warnings.push(
      `Stripe is in TEST mode (key came from ${resolved.name}). Real cards cannot be charged.`
    );
  } else if (mode === 'malformed') {
    warnings.push(
      `The key in ${resolved.name} starts with neither sk_live_ nor sk_test_. ` +
        'It was probably truncated, quoted, or pasted with a stray character.'
    );
  }

  if (mode === 'live' && !webhook) {
    warnings.push(
      'Live key with no webhook signing secret: cards will be charged but no ' +
        'certificate will be generated or emailed. This is the worst failure ' +
        'mode because it looks like success to the customer.'
    );
  }

  if (priceIdsInUse.digital === 'set' || priceIdsInUse.heirloom === 'set') {
    warnings.push(
      'Pre-created Price IDs are configured. Price IDs created in test mode do ' +
        'not exist in live mode and fail checkout with "No such price".'
    );
  }

  return res.status(200).json({
    // `ok` means "this build can take a real payment", not "the site loaded".
    ok: mode === 'live' && Boolean(webhook),
    stripe: {
      mode,
      // The variable that actually supplied the key. Names are not secret.
      key_var: resolved ? resolved.name : null,
      key_vars_checked: stripeKeyReport(),
      // Every STRIPE* variable name visible to THIS build, sorted.
      // Names only — values never appear here.
      stripe_vars_present: stripeVarsPresent,
      webhook_secret: webhook ? `set (${webhook.name})` : 'missing',
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
