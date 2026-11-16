# NONSTOPAI Onboarding Website

Mobile-first onboarding site: taxi firms land on the page, see what NONSTOPAI does,
see pricing, fill in a short form, pay via Stripe Checkout, and land on a confirmation page.

## Stack

- Vite + React + React Router
- Tailwind CSS v4
- Netlify Functions (secure server-side proxy — keeps `x-intake-secret` and Stripe
  price IDs out of the browser)

## Local development

```bash
npm install
npm run dev          # frontend only, http://localhost:5173
```

To test the full flow including the serverless function locally, use the Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

## Website Machine engine

The Website Machine is available at `/website-machine`. It generates structured
copy from supplied business facts, records manually verified HTTPS source
findings with provenance, renders a controlled responsive template, and lets an
operator edit the copy. Website URLs are stored as links and are never fetched.
The Netlify Functions persist projects in Supabase, publish **draft** Netlify
deploys, and return a bearer-authorized static HTML delivery file. They never
execute generated code or accept arbitrary HTML for publishing.

The server adapter is pinned to the active NonStopAI CRM Supabase project and
the `nonstopai-staging-preview` Netlify site. It uses Supabase Auth email and
password sign-in, validates each bearer JWT server-side, and sends only the
user JWT plus the project publishable key to PostgREST. It never uses a service
role key. Data lives in isolated `wm_*` tables with owner-only RLS; project
creation goes through a transaction-safe RPC limited to eight creations per
user per hour. The staging environment needs `WM_STAGING_SUPABASE_URL` and
`WM_STAGING_SUPABASE_PUBLISHABLE_KEY`; the publishable key is not a secret.
Shareable previews use random, seven-day bearer links. Only token hashes are
stored in the project table, and the render function serves a fixed escaped
template with `noindex` and a restrictive content security policy. Staging does
not receive a broad Netlify account token.

The SQL migrations in `supabase/migrations/` were checked against the CRM schema
and applied as additive `wm_*` tables, policies, and functions. They do not
alter CRM, booking, onboarding, or Website Generator tables.

Research in this first release is source-led: the operator records findings
they have checked. It does not crawl supplied URLs. Existing n8n lead finder
and Website Generator workflows are separate systems and remain unchanged.
The customer delivery action downloads a static site file; email, custom-domain
provisioning, payment gating, and hands-off customer delivery are not connected.

Run `npm test` for the validation, authentication, persistence-adapter,
preview-publish, and delivery tests. `npm run build` runs these tests before
Vite builds the app.

Create a `.env` file (see `.env.example`) with:

```
INTAKE_SECRET=your-real-secret
SETUP_PRICE_ID=price_xxx
SUBSCRIPTION_PRICE_ID=price_xxx
```

## Deploying to Netlify

1. Push this project to a GitHub repo (or drag-and-drop the built `dist/` folder
   for a one-off deploy — but the serverless function requires a connected repo
   or `netlify deploy` from the CLI, not drag-and-drop).
2. In Netlify: **Add new site > Import an existing project**, connect the repo.
   Build command `npm run build`, publish directory `dist` (already set in
   `netlify.toml`).
3. In **Site settings > Environment variables**, add:
   - `INTAKE_SECRET`
   - `SETUP_PRICE_ID`
   - `SUBSCRIPTION_PRICE_ID`
4. Deploy. Your site will be live at a `*.netlify.app` URL — share that link by
   SMS, WhatsApp, Facebook, Instagram, or email. Attach a custom domain later
   with no code changes.

## How it works

```
Browser (signup form)
   │  POST /api/start-onboarding  (no secrets in this request)
   ▼
Netlify Function (start-onboarding.js)
   │  adds x-intake-secret server-side
   │  POST → Phase 9A intake            → { client_id, project_id }
   │  POST → Phase 9A.5 checkout session → { checkout_url }
   ▼
Browser redirects to Stripe Checkout (hosted by Stripe)
   │
   ▼
Stripe redirects to /onboarding/success or /onboarding/cancel
   (Phase 9B provisioning is triggered server-side via Stripe webhook,
   independent of whether the browser tab stays open)
```

## Editing pricing copy

The price shown on the landing page (`src/pages/Landing.jsx`, `£99/month + £299
setup`) is display copy only — it does not drive the actual Stripe charge. Update
it to match whatever `SETUP_PRICE_ID` / `SUBSCRIPTION_PRICE_ID` actually charge,
so the number on the page always matches what Stripe charges at checkout.
