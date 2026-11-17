# Website Machine live launch checklist

## Current state

- The selected live offer is the existing Stripe price `price_1TtvtIEWP0eV3FnnXUMIwPwG`: GBP 99, one-time, live mode. No Stripe product, price, or payment link was created or changed.
- Supabase maps that price to the Website Machine `live/setup` row, which remains inactive. No live Website Machine orders exist.
- Live Checkout and fulfillment code is present, but checkout remains gated by the inactive Supabase row. Payment confirmation also fails closed unless the separate production HMAC secret exists in Supabase Vault.
- `bendarus.netlify.app` is staging. Do not set it to production mode and do not copy production values into its staging context.

## Production Netlify setup

On the dedicated Website Machine production Netlify project only, set these values in the **production Functions runtime**. Mark credentials as secret; do not put secrets in `netlify.toml`, build scope, or client variables.

| Variable | Required value |
| --- | --- |
| `WM_RUNTIME_ENV` | `production` |
| `WM_PRODUCTION_PUBLIC_URL` | The actual HTTPS URL of the production Website Machine application; not Bendarus or a placeholder domain |
| `WM_PRODUCTION_SUPABASE_URL` | `https://lqywsbqctoydtdqvjzzw.supabase.co` |
| `WM_PRODUCTION_SUPABASE_PUBLISHABLE_KEY` | The CRM project's publishable key |
| `WM_PRODUCTION_STRIPE_SECRET_KEY` | Prefer an `rk_live_` key with only Price/Product read, Checkout Session create/read permissions required by this integration |
| `WM_PRODUCTION_STRIPE_PRICE_ID` | `price_1TtvtIEWP0eV3FnnXUMIwPwG` |
| `WM_PRODUCTION_STRIPE_WEBHOOK_SECRET` | Signing secret for the dedicated production Website Machine endpoint |
| `WM_PRODUCTION_PAYMENT_RPC_SECRET` | A new random value of at least 32 bytes; store the identical value in Supabase Vault as `wm_payment_rpc_secret_production` |
| `WM_PRODUCTION_NETLIFY_CUSTOMER_TOKEN` | Token belonging only to the Website Machine publisher identity/team |
| `WM_PRODUCTION_NETLIFY_ACCOUNT_SLUG` | `website-machine` |
| `WM_PRODUCTION_EMAIL_API_KEY` | Resend sending key for the verified delivery domain |
| `WM_PRODUCTION_DELIVERY_FROM_EMAIL` | A verified sender address on that domain |

The production publisher creates sites only in the `website-machine` account and verifies that each deployed HTTPS URL returns public HTML with the correct business content before recording deployment. The Websites team default visibility should remain Public; the runtime check rejects restricted sites rather than reporting them delivered.

## Stripe webhook

Once the real production app URL is known and its Netlify Function is deployed, add a **new** live endpoint at:

`https://<production-app-host>/.netlify/functions/website-machine-stripe-webhook`

Subscribe only to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Save its signing secret to `WM_PRODUCTION_STRIPE_WEBHOOK_SECRET`. Do not edit or disable existing endpoints. The live account currently has three enabled endpoints, all targeting n8n; one handles all events. The contents and downstream effects of those n8n workflows are not available here, so check that they will not fulfill or email Website Machine sessions before creating another destination.

## Activation sequence

1. Configure and verify the production Netlify project and its runtime variables.
2. Confirm the Netlify token cannot manage existing NONSTOP AI or customer sites and verify the team slug resolves to the dedicated Website Machine team.
3. Create the endpoint above, verify its live signature configuration, and verify the deployed handler receives only `livemode=true` events.
4. Verify the production HMAC secret matches Supabase Vault without displaying it.
5. Run all non-charging preflight checks and a final sandbox end-to-end purchase on staging.
6. Obtain explicit launch approval before activating only the live `wm_offer_prices` row.
7. Conduct the first live transaction only after every earlier check passes.

Do not enable monthly pricing. Do not reuse old Website Machine setup/subscription payment links. Do not change any existing Stripe or n8n destinations as part of this launch.
