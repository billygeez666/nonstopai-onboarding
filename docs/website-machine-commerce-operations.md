# Website Machine commerce and customer publishing

## Flow

1. A signed-in owner saves a reviewed Website Machine project.
2. The server reads the configured Stripe prices and checks the Website Machine product, £199 one-time setup, £50 monthly amount, GBP currency, and active state.
3. The server creates a Stripe Checkout subscription and records the session on an owner-scoped order. Checkout return URLs only show a processing state.
4. The Stripe webhook checks its timestamped signature, retrieves the Checkout Session from Stripe, verifies mode, owner/project/order metadata, paid status, total, and both exact line items. Only then can it confirm the durable order and publish.
5. Netlify receives a new site with a deterministic `wm-<project UUID>` name. Before deployment, the publisher writes and reads back `website_machine_project_id` metadata and stores the site ID against the owner/project.
6. The publisher deploys a fixed static HTML file, verifies the deploy belongs to the recorded site, waits for `ready`, and fetches the HTTPS deploy URL to confirm the expected business name.
7. The customer return page reads delivery state through an authenticated owner-only endpoint. It never treats the Checkout redirect as payment proof.

Custom domains are optional. The owner must publish a one-hour DNS TXT challenge. Checkout and publishing both verify the exact TXT value, and publishing checks that Netlify does not already assign the domain. A domain that cannot be checked fails closed.

Rollback is limited to a prior ready deploy in the customer's stored allowlist. The server checks owner/project association, the site ID/name, project metadata, deploy ownership, restored published deploy ID, and HTTPS response before recording it.

## Netlify environment variables

Staging and production use different names so a missing production variable cannot fall back to a staging credential.

| Staging | Production | Purpose |
| --- | --- | --- |
| `WM_RUNTIME_ENV=staging` | `WM_RUNTIME_ENV=production` | Select environment |
| `WM_STAGING_PUBLIC_URL` | `WM_PRODUCTION_PUBLIC_URL` | Website Machine return/preview origin |
| `WM_STAGING_SUPABASE_URL` | `WM_PRODUCTION_SUPABASE_URL` | Active CRM Supabase project URL |
| `WM_STAGING_SUPABASE_PUBLISHABLE_KEY` | `WM_PRODUCTION_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `WM_STAGING_STRIPE_SECRET_KEY` | `WM_PRODUCTION_STRIPE_SECRET_KEY` | Server-only Stripe API key for the matching mode |
| `WM_STAGING_STRIPE_WEBHOOK_SECRET` | `WM_PRODUCTION_STRIPE_WEBHOOK_SECRET` | Dedicated webhook signing secret |
| `WM_STAGING_STRIPE_SETUP_PRICE_ID` | `WM_PRODUCTION_STRIPE_SETUP_PRICE_ID` | Verified Website Machine setup price |
| `WM_STAGING_STRIPE_MONTHLY_PRICE_ID` | `WM_PRODUCTION_STRIPE_MONTHLY_PRICE_ID` | Verified Website Machine monthly price |
| `WM_STAGING_PAYMENT_RPC_SECRET` | `WM_PRODUCTION_PAYMENT_RPC_SECRET` | At least 32 random bytes; also stored in Supabase Vault |
| `WM_STAGING_NETLIFY_CUSTOMER_TOKEN` | `WM_PRODUCTION_NETLIFY_CUSTOMER_TOKEN` | Server-only Netlify publishing credential |
| `WM_STAGING_NETLIFY_ACCOUNT_SLUG` | `WM_PRODUCTION_NETLIFY_ACCOUNT_SLUG` | Dedicated Netlify team/account that owns customer sites |

Do not copy any staging secret into production or the other way around. Keep the Stripe key in server function scope, not frontend build scope. The commerce handlers return `503` until all required secrets and price IDs for that environment are present.

The migration expects Vault secrets named `wm_payment_rpc_secret_staging` and `wm_payment_rpc_secret_production`; each value must match its corresponding Netlify `WM_*_PAYMENT_RPC_SECRET`. The migration only adds `wm_*` tables/functions/policies and does not alter CRM, booking, onboarding, existing Stripe products, or existing customer site rows.

## Stripe configuration

Existing live Website Machine prices verified in the Stripe dashboard:

- Setup: `price_1TtvtMEWP0eV3Fnn3Gd8ltId` — £199 one-time.
- Monthly: `price_1TtvtQEWP0eV3FnnCAi7Z9Ko` — £50/month.

Test-mode mirror prices verified in the Stripe test dashboard:

- Setup: `price_1UcLidEWP0eV3Fnn0GpGUYiT` — £199 one-time.
- Monthly: `price_1UcLjSEWP0eV3FnnWKkhUtDA` — £50/month.

Create one dedicated **test-mode** webhook endpoint at
`https://nonstopai-staging-preview.netlify.app/.netlify/functions/website-machine-stripe-webhook`
for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Production must use a separate live-mode endpoint and signing secret at
`https://nonstopai.netlify.app/.netlify/functions/website-machine-stripe-webhook`.

## Netlify publisher isolation

Customer publishing requires a dedicated Netlify account/team. Create separate Netlify teams for **Website Machine staging** and **Website Machine production**, with no existing NONSTOP AI sites attached. Create each publisher token while authenticated only to its matching dedicated team. Do not reuse a token from the existing NONSTOP AI team or an account-wide token that can modify existing customer sites.

Set the matching team slug in `WM_STAGING_NETLIFY_ACCOUNT_SLUG` and `WM_PRODUCTION_NETLIFY_ACCOUNT_SLUG`. The publisher resolves that slug through Netlify's account API, creates new customer sites through `POST /api/v1/{account_slug}/sites/`, and checks each site's `account_id` against the resolved dedicated account before persisting it, deploying, or rolling back. The configured account slug and token must be set together; checkout/delivery fails closed if either is absent. A token with access to other accounts still must not be used: Netlify's token itself is not site-scoped.

Netlify control-plane setup steps:

1. Create the isolated Website Machine staging team/account and record its slug from Team settings.
2. Generate a personal access token from a dedicated publisher identity that belongs only to that staging team; store it as the staging function secret `WM_STAGING_NETLIFY_CUSTOMER_TOKEN`.
3. Store the staging team slug as `WM_STAGING_NETLIFY_ACCOUNT_SLUG` in staging function scope. Keep both variables server-side.
4. Repeat with a separate Website Machine production team and token, storing them only as `WM_PRODUCTION_NETLIFY_CUSTOMER_TOKEN` and `WM_PRODUCTION_NETLIFY_ACCOUNT_SLUG` after staging purchase-to-delivery verification and production review.
5. Confirm each team has no pre-existing sites before enabling publishing. The application creates deterministic new `wm-<project UUID>` sites only within the configured team; it never adopts or changes a site unless its project metadata and dedicated account ID both match.

The existing NONSTOP AI production and staging Netlify sites are not used as publisher teams and must remain unchanged.

## Current release state

The existing Website Machine staging site has its Supabase URL and publishable key. Stripe API/webhook secrets, payment RPC secret, and dedicated staging publisher token/team slug are not configured. Checkout and publishing therefore stay disabled. The existing NONSTOP AI production and staging Netlify sites remain outside Website Machine publishing. Production must remain disabled until the complete Stripe test-mode purchase-to-delivery flow passes on staging.
