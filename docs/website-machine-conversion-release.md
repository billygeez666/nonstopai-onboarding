# Website Machine conversion release

The free preview is generated locally using bounded input and the existing renderer. No paid generation calls or anonymous project writes are involved. Saving a project still uses the authenticated Supabase RPC and its per-owner rate limit.

The customer confirms details against the actual preview, then signs in and opens the existing Stripe Checkout. Checkout uses a dedicated owner-scoped project created from the reviewed content. The customer-facing editor only changes the local draft and never updates the checkout project. Retries for the same content and domain reuse the project and the existing order. The same browser tab can restore the review after refresh or a checkout cancellation for up to one hour.

## Before release

- Apply and verify the public-preview projection migration in the appropriate environment. The existing token-gated RPC returns the complete stored content. The migration restricts its output, preserves prior token and expiry rules, and suppresses business phone and email unless explicitly approved for public sharing. Use only verified public information in free-text fields when preparing outreach concepts.
- Verify real account confirmation and return URLs on the intended staging hostname. Verify checkout using a test-mode account and the existing test offer if a new sandbox order is separately authorised. Keep production Stripe, Netlify and Resend settings as configured.
- Assign an operator to the manual renewal procedure below.

## Fulfillment boundary

New orders snapshot the review project's content in the checkout-order transaction. The payment webhook's signed lookup uses that immutable snapshot, and an idempotent checkout retry keeps the original snapshot. Orders created before the migration continue to use their owner-scoped project content. The snapshot and outreach privacy migrations were exercised together in isolated PostgreSQL against synthetic fixtures.

The staging and production apps share the CRM database. Apply these migrations to an isolated staging database for the Stripe test-mode handoff, or coordinate a separate shared-database rollout once the PR is approved. The current production offer is already active. Leave its activation and existing payment links alone during release verification.

## Hosting

Checkout requires an explicit acknowledgement of the £99 one-off purchase and 30 days of free hosting, followed by optional continued hosting at £9.99/month. No recurring charge or suspension is scheduled. Once publication is recorded, the order stores the hosting start and end timestamps. Reconciliation preserves both dates. The existing delivery email includes the terms and end date for orders with a recorded hosting window.

## Manual hosting renewal

1. Review delivered orders approaching day 23 using the stored hosting start and end timestamps. The release owner assigns an operator to check this queue and record each contact.
2. Around day 23, contact the customer at the order's delivery address. Confirm the public website URL, the recorded free-hosting end date, and the £9.99/month price for continued hosting.
3. Ask whether the customer wants continued hosting and obtain explicit authorization before collecting any payment. Record the decision and authorization with the order. The original £99 payment does not authorize hosting charges.
4. If authorization is absent or declined, record the outcome and arrange follow-up manually. The order dates do not trigger charges, renewals, suspension, or deletion.

## Production rollout and rollback

- Prerequisite: on an isolated hosted staging stack, apply both migrations and complete an authenticated £99 Stripe test-mode order from the PR build. Confirm a signed webhook, one public deploy, one delivered Resend email, the recorded hosting window, and the same snapshot and dates on retry. Synthetic database and mocked browser tests do not satisfy this hosted check.
- After explicit production approval, record the currently published Netlify deploy and capture the current definitions and grants for `wm_get_public_preview`, `wm_create_checkout_order`, `wm_get_payment_order`, `wm_record_customer_deployment`, and `wm_claim_delivery_email`. Confirm the database recovery point before touching the shared CRM.
- Apply `20261118212000_website_machine_public_preview_contacts.sql` first, then `20261118220000_website_machine_checkout_content_snapshot.sql`. Verify token and expiry rules, contact opt-in, expected RPC grants, the nullable order columns, and the signed lookup fallback for pre-migration orders. Then publish the approved PR build and check the acknowledgement and checkout entry without submitting a live payment.
- If the application deploy has a regression, restore the last known-good Netlify deploy. Keep the additive database columns, snapshot-aware fulfillment lookup and privacy projection so in-flight orders retain their approved content and private contact fields stay protected. If a database RPC itself is faulty, restore only the affected known-good routine after checking its effect on in-flight orders. Preserve captured snapshots, hosting dates and email receipts. Avoid a broad database restore that would roll back valid customer orders.
