# Calendar-to-Supabase synchronization — implementation status

## Completed
- Added `src/sync-calendar.js` server-only integration code to read Google Calendar events and call Supabase RPC.
- Added `sync-calendar.test.js` mock transport tests (not yet executed).
- Applied Supabase migration `br_atomic_dry_run_sync_function_20261115`.
- Verified function `public.br_sync_test_event` exists, is security-definer, is executable by `service_role`, and is **not** executable by `authenticated`.
- Function is locked to disabled pilot tenant `nonstopai-internal-test` and calendar `aibookingsystems@gmail.com`.
- The queue still enforces `channel='dry-run'`. No real messages can be queued through this design.

## Not completed
- No deployed server-side Google OAuth authorization or refresh-token handling.
- No secure environment for Google access token and Supabase service-role key configured.
- No n8n schedule or workflow deployed; the sync module has not run against live Google Calendar.
- Mock unit tests have been committed but not executed.
- No full end-to-end test, retry strategy, missing-event reconciliation, recurring-event cancellation tombstone support, or production messaging.
- Existing manually seeded test records will be reconciled on the first authorized sync; no automatic reconciliation is happening yet.

## Critical engineering boundary
The `service_role` key bypasses RLS. Keep it in a server-only secret store, never in Vite client variables or GitHub. The RPC is deliberately narrow and must not be exposed as a general appointment creation API. The `br_sync_test_event` function is a pilot function, not production-ready scheduling infrastructure.

## Next steps
1. Confirm a secure runtime hosting choice (existing n8n credential vault is preferred if its Google OAuth and Supabase credentials are available and verified).
2. Inspect n8n workflows and credential capabilities in read-only mode.
3. Configure a dry-run polling workflow with no outgoing messages, then run tests.
4. Only after verification, add due-job processing, robust cancellation handling, and consent-based delivery.
