# AI Booking Systems — Calendar pilot configuration

This is a **development-only** configuration reference for the NONSTOP AI Booking & Reminder Engine.

- Google Calendar ID: `aibookingsystems@gmail.com`
- Calendar display name: `aibookingsystems@gmail.com`
- Verified connected Google Calendar access: `owner`
- Pilot mode: **read-only / dry-run**
- Time zone for customer-facing appointments: `Europe/London` (verify per customer)
- Reminder offsets: 24 hours and 2 hours before appointment
- Message delivery: **disabled**
- Calendar write operations: **disabled**
- Customer contact extraction: **disabled** until approved, secure mapping and lawful messaging basis are implemented

## Integration boundary

The current `src/engine.js` includes a Google Calendar Events API read adapter. It is not yet authenticated or connected in the running application. The connected ChatGPT Calendar account does not automatically provide OAuth tokens to deployed code. A secure runtime OAuth connection and refresh-token handling must be implemented separately, without committing tokens to GitHub.

For the first pilot:
1. Audit calendar events and determine a safe test event, without changing existing appointments.
2. Configure the runtime with this calendar ID through secure settings.
3. Test event normalization and reminder scheduling in dry-run mode.
4. Add persistent Supabase queue and duplicate prevention.
5. Obtain explicit approval before any live email/SMS or calendar modifications.

**Do not deploy, send reminders, or modify this calendar from this document alone.**
