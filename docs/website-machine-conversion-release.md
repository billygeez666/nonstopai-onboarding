# Website Machine conversion release

The free preview is generated locally using bounded input and the existing renderer. No paid generation calls or anonymous project writes are involved. Saving a project still uses the authenticated Supabase RPC and its per-owner rate limit.

The customer confirms details against the actual preview, then signs in and opens the existing Stripe Checkout. Checkout uses a dedicated owner-scoped project created from the reviewed content. The customer-facing editor only changes the local draft and never updates the checkout project. Retries for the same content and domain reuse the project and the existing order. The same browser tab can restore the review after refresh or a checkout cancellation for up to one hour.

## Before release

- Apply and verify the public-preview projection migration in the appropriate environment. The existing token-gated RPC returns the complete stored content. The migration restricts its output, preserves prior token and expiry rules, and suppresses business phone and email unless explicitly approved for public sharing. Use only verified public information in free-text fields when preparing outreach concepts.
- Verify real account confirmation and return URLs on the intended staging hostname. Verify checkout using a test-mode account and the existing test offer if a new sandbox order is separately authorised. Keep production Stripe, Netlify and Resend settings as configured.
- Confirm the commercial commitment for how long the hosted address is maintained and the scope of support before promising any duration or service level.

## Fulfillment boundary

The existing order and webhook read content from the owner-scoped project record. The redesigned UI saves a dedicated reviewed copy and leaves that project alone once saved. The database does not yet store an immutable order snapshot against direct or concurrent writes by an authorised project owner. To guarantee the exact approved revision independently of the browser, add a checkout-time snapshot column on the order, set it in the order-creation transaction, and have the signed fulfillment lookup return that snapshot with a compatibility fallback for pre-existing orders. Review and test that change separately before modifying production fulfillment.
