# Booking Engine — Integration Audit (15 Nov 2026)

## Verified by connected account reads
- Google Calendar account `aibookingsystems@gmail.com` is present and the user has **owner** access to its primary calendar.
- Read-only search for events from 15 Nov through 15 Dec 2026 returned **zero events** (no pagination). This is not proof the calendar has never been used.
- Active Supabase project: `NonStopAI CRM` (`lqywsbqctoydtdqvjzzw`).
- Existing `public.bookings` (63 rows) contains taxi journey fields, including pickup/dropoff addresses, and **must not be reused for appointment reminders**.
- Existing booking provider and allowlist tables also relate to prior booking infrastructure; preserve them.
- The GitHub `nonstopai-onboarding` repository contains a Vite/React app, not an independently verified production booking engine.
- This branch contains pure scheduling logic, a read-only Google Events API adapter, tests, and an **unapplied** draft schema.

## Gaps before live operation
1. Google Calendar account access in ChatGPT is not an OAuth token usable by the deployed app. Establish secure OAuth for a server-side runtime; do not store tokens in source control.
2. Select a safe, synthetic test event. Existing calendar is currently empty in the searched window.
3. Implement isolated Supabase tables, tenant isolation, atomic due-message claims, stale-event reconciliation and durable deduplication. Draft SQL is not yet applied.
4. Implement secure approved contact mapping and lawful reminder delivery. No contact details should be extracted from arbitrary event text.
5. Implement email/SMS provider, per-customer limits, delivery receipts, error handling and staff notifications.
6. Configure n8n workflows only after reviewing current workflows and avoiding name/trigger collisions.
7. Validate calendar time zones, all-day/recurring/cancelled events, OAuth refresh, retries, and missed scheduler runs.
8. Run tests and confirm integration behavior before production deployment.

## Safety and execution status
No calendar events created or modified; no database tables created or changed; no n8n workflows created or modified; no emails/SMS sent; no charges; no deployments. Code is isolated to `feature/booking-engine-mvp`.

## Immediate next action
Choose one synthetic appointment on `aibookingsystems@gmail.com` for a dry-run. Then implement and test the authenticated server runtime and isolated persistent queue before connecting message delivery.
