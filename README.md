# Verse Dedication

Dedicate a Bible verse to someone you love. A personalized certificate — digital (emailed
instantly) or Heirloom (printed and mailed). A share of every purchase supports Bible translation.

Built with **Next.js (Pages Router)** + **Supabase** + **Stripe** + **Resend**, with certificate
PDFs generated server-side via **pdf-lib**.

---

## Features (implemented)

- **Browse & filter verses** by theme. Pills are driven by the `themes` table (no hard-coded
  mismatch), and a verse can belong to several themes.
- **Social proof** — each card shows how many times a verse has been dedicated.
- **Public dedication feed** — recent public dedications, opt-in per order.
- **Personalize modal** with a live certificate preview, recipient/name/message fields, and a
  character counter.
- **Privacy toggle** — "show my dedication in the public feed," defaults on.
- **Two tiers** — Digital ($7.99) and Heirloom ($14.99, collects shipping).
- **Stripe Checkout** created server-side. The price is looked up on the server; the browser only
  sends a tier key.
- **Idempotent Stripe webhook** that records the order, creates the dedication with a race-safe
  per-verse number, generates the certificate PDF, stores it in Supabase Storage, and emails it.
- **Legal pages** — Privacy, Terms, Refunds, Contact (templates — review before launch).
- **SEO** — metadata, Open Graph/Twitter, JSON-LD, `sitemap.xml`, `robots.txt`, favicon.
- **Accessibility** — dialogs with `role="dialog"`/`aria-modal`/Escape/scroll-lock, `aria-expanded`
  FAQ, `aria-pressed` filters, visible focus rings.

## Not yet implemented / recommended next

- **Order lookup page** (`/order/[id]`) so a buyer can re-download a certificate.
- **Admin view** for fulfillment: flip `orders.status` to `shipped`, print labels.
- **OG image** at `public/og-image.png` (1200×630) — referenced but not yet created.
- **Rate limiting** on `/api/create-checkout-session` (e.g. Upstash) if abuse appears.
- **Verse ordering** currently `featured desc, reference asc`; add a `sort_order` column if you want
  a curated order.
- **Certificate regeneration** job for cases where PDF generation failed but the order paid.

---

## Project structure

```
src/
  components/
    HomeClient.js        # main client UI (filters, modals, checkout trigger)
    Modal.js             # accessible dialog wrapper
    LegalPage.js         # shared shell for legal pages
  lib/
    site.js              # brand + charity copy, single source of truth
    pricing.js           # tier definitions + amounts (server-authoritative)
    supabasePublic.js    # anon-key client (browser-safe reads)
    supabaseAdmin.js     # service-role client (server only)
    stripe.js            # server-only Stripe client
    certificate.js       # pdf-lib certificate generator
    email.js             # Resend email sender
    dedications.js       # race-safe dedication insert
  pages/
    index.js             # home (getStaticProps)
    privacy.js terms.js refunds.js contact.js
    sitemap.xml.js robots.txt.js
    api/
      create-checkout-session.js
      stripe-webhook.js
  styles/globals.css
db/
  schema.sql             # hardened schema (run first)
  seed.sql               # themes + 45 verses (run second)
docs/
  DEPLOYMENT.md          # step-by-step go-live guide
  LEGAL_CHECKLIST.md     # the "cover your own ass" checklist
```

## Environment variables

Copy `.env.example` → `.env.local` and fill in:

| Variable | Where it runs | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | public, RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | bypasses RLS — webhook only |
| `STRIPE_SECRET_KEY` | **server only** | `sk_test_…` while testing |
| `STRIPE_WEBHOOK_SECRET` | **server only** | from your webhook endpoint |
| `NEXT_PUBLIC_SITE_URL` | browser + server | public base URL, no trailing slash |
| `RESEND_API_KEY` | **server only** | email delivery |
| `EMAIL_FROM` | **server only** | verified sender |
| `CERTIFICATE_BUCKET` | **server only** | Supabase Storage bucket |
| `STRIPE_PRICE_DIGITAL` / `STRIPE_PRICE_HEIRLOOM` | server only | optional pre-made Prices |

## Local development

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev                  # http://localhost:3000
```

Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET
```

## Database setup

In Supabase → SQL Editor, run **`db/schema.sql`**, then **`db/seed.sql`**.
Then create a Storage bucket named `certificates` (public recommended) — see `docs/DEPLOYMENT.md`.

## Deployment

See **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** for the full go-live sequence.

## Legal

**Read [`docs/LEGAL_CHECKLIST.md`](docs/LEGAL_CHECKLIST.md) before taking real payments.** The legal
pages in this repo are templates, not legal advice.
