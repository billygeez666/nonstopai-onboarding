# NONSTOP AI Booking Engine — MVP (development only)

This is a **dry-run, read-only prototype**, not a production service. No Google account is connected, no reminders are sent, and no payment changes occur.

## Google Calendar integration
The engine includes a read-only adapter for the Google Calendar Events API. A future service must obtain an OAuth token with the minimum calendar read scope via a secure consent flow and store credentials outside GitHub. No token is needed for unit tests. The adapter reads event metadata, but **does not assume attendees have opted in to SMS or email**.

## Local tests
From this directory, run `node --test engine.test.js` using a modern Node.js version. No extra packages are required.

## Current behavior
- Normalizes timed Google Calendar events, skipping all-day events.
- Plans 24-hour and 2-hour reminders only when explicit contact approval is supplied.
- Creates stable per-version idempotency keys.
- Rejects stale reminders after event changes and skips cancelled appointments.
- Uses an injectable HTTP client to test Google Calendar pagination offline.

## Not implemented (required before any production use)
- Google OAuth consent/token refresh and verified calendar permissions.
- Persistent tenant-isolated booking store, scheduled queue, distributed idempotency lock and durable cancellation/reconciliation.
- Messaging providers, approved templates, consent/opt-out handling, message delivery tracking, costs and quotas.
- Confirmation/rescheduling request endpoints, secure links, staff approval and calendar conflict checks.
- Authentication, authorization, audit logs, GDPR retention/deletion, monitoring and manual fallback.
- Stripe subscriptions, customer onboarding, dashboard and production deployment.

## Engineering rule
Do not merge or deploy this code as a live appointment system. Test with synthetic events first. Read the business blueprint at `docs/NONSTOP_AI_BOOKING_REMINDER_BLUEPRINT.md` on branch `docs/booking-reminder-blueprint`.
