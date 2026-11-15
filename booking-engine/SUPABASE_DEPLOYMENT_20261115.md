# Supabase dry-run deployment — 15 November 2026

## Verified deployed (NonStopAI CRM, project `lqywsbqctoydtdqvjzzw`)

Migration: `br_dry_run_isolated_tables_20261115` applied successfully.

Created isolated tables:
- `public.br_tenants` — internal pilot tenant, `enabled=false`
- `public.br_appointments` — one synthetic Google Calendar appointment
- `public.br_message_queue` — two dry-run planned reminders

Security:
- RLS enabled on all three tables
- No client-facing policies; grants revoked for `anon` and `authenticated`
- Queue `CHECK(channel = 'dry-run')` prevents writing live channels
- Unique `idempotency_key` prevents duplicate reminder rows
- No cron, trigger, webhook, delivery provider, OAuth token, or live scheduler configured

Test event:
- Google Calendar ID `aibookingsystems@gmail.com`
- Event ID `7lhjp43mgskbjaeo79b77oasp0`
- Appointment 16 November 2026, 10:00–10:30 Europe/London
- 24-hour reminder due 15 November 2026, 10:00 UTC
- 2-hour reminder due 16 November 2026, 08:00 UTC
- Due times are synthetic scheduling records, **not messages**

Verification query returned 1 tenant, 1 appointment, 2 queue rows, 0 live-channel rows, and RLS enabled.

## Important limitations

The DB queue was seeded manually for the known synthetic test event; the deployed engine is **not yet syncing Google Calendar automatically**. The current source-code planner is not deployed or tested end-to-end. Queue rows do not automatically send, dispatch, or mark complete.

## Next implementation milestone

Secure runtime Google OAuth for `aibookingsystems@gmail.com`, read-only calendar polling, idempotent upsert and reconciliation into these isolated tables, then n8n scheduled dry-run processing. Keep live messaging disabled pending approval and security review.

## No-impact guarantees during this change

Existing `public.bookings`, taxi and outreach tables were not modified. No calendar writes, messages, charges, n8n changes or application deployments were performed.
