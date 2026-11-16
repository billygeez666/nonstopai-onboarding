# Website Machine staging commerce setup

The checkout and delivery code is deliberately staging-only. Production checkout, live Stripe keys, and monthly prices are not accepted. Keep all values in the `WEBSITE MACHINE` Netlify team, on the `bendarus` site, with secret values scoped to **Functions**. Do not add them to the repository, `netlify.toml`, or build/client variables. Netlify documents function-scoped runtime variables and per-deploy-context values in its [environment variable guide](https://docs.netlify.com/build/environment-variables/overview/).

## 1. CRM Supabase migration

Apply `202611160004_website_machine_99_test_only.sql` to the existing `lqywsbqctoydtdqvjzzw` project after reviewing it. It updates only Website Machine offer/order functions and `wm_*` offer rows. Existing order amounts are retained; the amount constraint temporarily permits historic £249 test rows and new £99 test rows. It disables the old Website Machine test monthly offer and leaves all live offer rows unchanged.

Create a random 32-byte-or-longer HMAC value outside the repository. Store the same value as the Supabase Vault secret named `wm_payment_rpc_secret_staging` and as the Netlify function variable `WM_STAGING_PAYMENT_RPC_SECRET`.

## 2. Stripe test offer

In Stripe **test mode**, create a Website Machine product and a **one-time** GBP price of £99. Do not attach a recurring price. The product name should include “Website” and must not refer to the AI Receptionist. Use a restricted test API key that can read products/prices and create Checkout Sessions; never use an `sk_live_` key.

Set `WM_STAGING_STRIPE_SECRET_KEY` and `WM_STAGING_STRIPE_PRICE_ID` in Netlify Functions. The secret key may be a restricted `rk_test_…` key or a standard `sk_test_…` key; live-mode key prefixes are rejected. In Stripe test mode, add webhook endpoint `https://bendarus.netlify.app/.netlify/functions/website-machine-stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`; set its signing secret as `WM_STAGING_STRIPE_WEBHOOK_SECRET`. Once the migration has been applied and the Stripe test price is verified, replace the inactive pending test offer row’s price/product IDs and set only that test setup row active. Checkout independently re-reads Stripe and rejects any amount, currency, product, active-state, or recurring mismatch.

## 3. Isolated customer publishing

Create a dedicated Website Machine team member identity with access only to the `WEBSITE MACHINE` team. Use its dedicated Netlify token for `WM_STAGING_NETLIFY_CUSTOMER_TOKEN`; set `WM_STAGING_NETLIFY_ACCOUNT_SLUG=website-machine`. Do not use a personal token with access to the existing NONSTOP AI sites.

## 4. Delivery email

Use an email sending account/domain dedicated to Website Machine delivery. Verify the sender domain and create a restricted sending API key. Set `WM_STAGING_EMAIL_API_KEY` and `WM_STAGING_DELIVERY_FROM_EMAIL` in Netlify Functions. The sender address must be a verified address on that domain. Delivery uses an order-specific idempotency key to make webhook retries safe.

## 5. Required Website Machine runtime variables

Already configured per operator report: `WM_RUNTIME_ENV=staging` and `WM_STAGING_PUBLIC_URL=https://bendarus.netlify.app`.

Set these remaining values, all in the `bendarus` site’s **Functions** scope:

- `WM_STAGING_SUPABASE_URL=https://lqywsbqctoydtdqvjzzw.supabase.co`
- `WM_STAGING_SUPABASE_PUBLISHABLE_KEY` (publishable/anon key only)
- `WM_STAGING_PAYMENT_RPC_SECRET` (same random value in Supabase Vault)
- `WM_STAGING_STRIPE_SECRET_KEY` (`rk_test_…` restricted key or `sk_test_…`)
- `WM_STAGING_STRIPE_WEBHOOK_SECRET` (`whsec_…` test endpoint secret)
- `WM_STAGING_STRIPE_PRICE_ID` (verified one-time GBP 9900 price)
- `WM_STAGING_NETLIFY_CUSTOMER_TOKEN` (dedicated `WEBSITE MACHINE` team identity)
- `WM_STAGING_NETLIFY_ACCOUNT_SLUG=website-machine`
- `WM_STAGING_EMAIL_API_KEY` (restricted sender key)
- `WM_STAGING_DELIVERY_FROM_EMAIL` (verified sender address)

After setting the values, redeploy the staging branch and verify its functions return normally (not the Edge Access 401 page). Then sign in with a synthetic staging customer, run a £99 Stripe test payment, verify the signed webhook, new site ownership under `website-machine`, deployed HTML, durable delivered state, and a single delivery email. No live purchase is part of this procedure.
