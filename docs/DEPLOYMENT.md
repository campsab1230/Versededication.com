# Deployment Guide — Verse Dedication

This app is **Next.js (Pages Router)** with server-side API routes, so it needs a host that runs
Node serverless functions (Vercel is the smoothest; Netlify / Render / a Node VPS also work). It is
**not** a static-only site.

> ⚠️ Do **not** build this on a Windows machine if you plan to target a non-Node host. Build on
> Linux/macOS or in CI. Vercel builds in the cloud for you, so this only matters if you're
> self-hosting.

---

## 1. Supabase

1. Create a project at supabase.com.
2. **SQL Editor → New query** → paste and run `db/schema.sql`, then `db/seed.sql`.
3. **Storage → New bucket**:
   - Name: `certificates`
   - Public bucket: **on** (so the emailed certificate link works without auth)
   - If you prefer private, swap `getPublicUrl` in `src/pages/api/stripe-webhook.js` for
     `createSignedUrl`, and note the bucket name in `CERTIFICATE_BUCKET`.
4. **Project Settings → API**: copy the Project URL, the `anon` public key, and the
   `service_role` key.

## 2. Stripe

1. Create an account / switch to **Test mode** first.
2. **Developers → API keys**: copy the Secret key (`sk_test_…`).
3. **Developers → Webhooks → Add endpoint**:
   - Endpoint URL: `https://YOUR-DOMAIN/api/stripe-webhook`
   - Events: `checkout.session.completed`
   - Copy the **Signing secret** (`whsec_…`).
4. (Optional) If you want fixed Prices, create two Prices and set `STRIPE_PRICE_DIGITAL` /
   `STRIPE_PRICE_HEIRLOOM`. If unset, checkout uses inline pricing from `src/lib/pricing.js`.

## 3. Email (Resend)

1. Create a key at resend.com → `RESEND_API_KEY`.
2. Verify a sending domain and set `EMAIL_FROM` (e.g. `Verse Dedication <certificates@yourdomain.com>`).
   - Without a verified domain you can only send to your own address from `onboarding@resend.dev`.
3. If `RESEND_API_KEY` is unset, the webhook still records the order — it just skips the email.

## 4. Environment variables

Set **all** of these in your host's dashboard (and locally in `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=https://your-domain.com
RESEND_API_KEY=
EMAIL_FROM=Verse Dedication <certificates@your-domain.com>
CERTIFICATE_BUCKET=certificates
```

`NEXT_PUBLIC_SITE_URL` **must** match the domain you registered the Stripe webhook for, or the
success/cancel redirects will point at the wrong place.

## 5. Deploy (Vercel example)

```bash
npm install -g vercel
vercel            # link/create the project
vercel --prod     # deploy to production
```

Then in Vercel → **Settings → Environment Variables**, add every variable above and redeploy.

Other hosts: any platform that runs Next.js API routes works — Netlify (`@netlify/plugin-nextjs`),
Render, Fly.io, or a Node server with `npm run build && npm start`.

## 6. Go-live checklist

- [ ] `db/schema.sql` and `db/seed.sql` ran with no errors
- [ ] `certificates` Storage bucket exists
- [ ] All env vars set in the host (not just locally)
- [ ] Stripe webhook endpoint created and `whsec_…` saved
- [ ] Test order placed with card `4242 4242 4242 4242` (any future expiry / CVC)
- [ ] Order row appears in `orders` with status `paid`
- [ ] Dedication row appears with a `dedication_number`
- [ ] Certificate PDF uploaded and `certificate_url` populated
- [ ] Email received
- [ ] `NEXT_PUBLIC_SITE_URL` matches the live domain
- [ ] Legal pages reviewed (see `LEGAL_CHECKLIST.md`)
- [ ] Switched Stripe from Test to Live keys when ready

## 7. Testing the webhook locally

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe-webhook
# put the printed whsec_… into .env.local, restart `npm run dev`, then:
stripe trigger checkout.session.completed
```

Note: a bare `trigger` won't carry your dedication metadata, so the handler will reject it
(that's expected). The real test is a full checkout through the site.

## 8. Common issues

| Symptom | Fix |
|---|---|
| Empty verse grid | `seed.sql` not run, or env vars missing (check server logs) |
| "Could not start checkout" | `STRIPE_SECRET_KEY` missing/invalid |
| Webhook 400 | `STRIPE_WEBHOOK_SECRET` doesn't match the endpoint |
| No certificate URL | Bucket missing, or service role key not set |
| No email | `RESEND_API_KEY` / `EMAIL_FROM` not set, or domain not verified |
| Duplicate dedication numbers | Ensure the unique constraint in `schema.sql` was applied |
