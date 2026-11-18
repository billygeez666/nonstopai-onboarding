# Website Machine conversion release

The free preview is generated locally using bounded input and the existing renderer. No paid generation calls or anonymous project writes are involved. Saving a project still uses the authenticated Supabase RPC and its per-owner rate limit.

The customer confirms details against the actual preview, then signs in and opens the existing Stripe Checkout. Checkout uses a dedicated owner-scoped project created from the reviewed content. The customer-facing editor only changes the local draft and never updates the checkout project. Retries for the same content and domain reuse the project and the existing order. The same browser tab can restore the review after refresh or a checkout cancellation for up to one hour.

## Before release

- Apply and verify the public-preview projection migration in the appropriate environment. The existing token-gated RPC returns the complete stored content. The migration restricts its output, preserves prior token and expiry rules, and suppresses business phone and email unless explicitly approved for public sharing. Use only verified public information in free-text fields when preparing outreach concepts.
- Verify real account confirmation and return URLs on the intended staging hostname. Verify checkout using a test-mode account and the existing test offer if a new sandbox order is separately authorised. Keep production Stripe, Netlify and Resend settings as configured.
- Confirm the commercial commitment for how long the hosted address is maintained and the scope of support before promising any duration or service level.

## Fulfillment boundary

New orders snapshot the review project's content in the checkout-order transaction. The payment webhook's signed lookup uses that immutable snapshot, and an idempotent checkout retry keeps the original snapshot. Orders created before the migration continue to use their owner-scoped project content. The snapshot and outreach privacy migrations were exercised together in isolated PostgreSQL against synthetic fixtures.

The staging and production apps share the CRM database. Apply these migrations to an isolated staging database for the Stripe test-mode handoff, or coordinate a separate shared-database rollout once the PR is approved. The current production offer is already active. Leave its activation and existing payment links alone during release verification.
