# NONSTOP AI — Booking & Reminder System Business Blueprint
Version: 1.0 | 15 November 2026
Status: Proposed product and pilot plan. Prices, customer demand, integrations and results are not yet validated.

## Executive decision
Build a standalone-capable appointment administration service, but sell it **first as an upsell** to NONSTOP AI Website Machine and AI Receptionist customers. Start with **independent UK garages** that have a real gap in their existing booking process. Do not duplicate reminder functionality already provided by their booking software.

## Commercial offer
Working name: NONSTOP AI Booking & Reminder System.
Initial price to test: **£299 setup + £99/month**, with a defined included messaging allowance and fair overage charges. This is a hypothesis, not a published or validated price. Establish VAT, provider costs, refund/cancellation policy, support boundaries, data processing terms, and contract scope before launch.

Core promise: reduce manual appointment administration and help customers confirm or request changes to bookings. Do not guarantee reduced no-shows or revenue increases without evidence.

## MVP scope
1. Receive a new or updated appointment from **one supported calendar/booking source**.
2. Send an appointment confirmation by approved channel.
3. Schedule reminders (e.g. 24 hours and 2 hours before; configurable).
4. Accept confirmation or a reschedule/cancellation **request** through a secure channel.
5. Respect calendar availability; never invent available slots or silently change appointments.
6. Update booking status where the integration permits; otherwise route the request to staff.
7. Alert the business to unresolved requests, delivery failures, and exceptions.
8. Provide a basic owner view of upcoming bookings, confirmations, requests and message usage.

MVP excludes universal calendar support, autonomous waitlist filling, complex multi-location scheduling, full CRM replacement, and unapproved voice calling. Advanced features come after proven demand.

## Initial ideal customer
Independent garages with repeat appointments, sufficient booking value, an identifiable current process, permission to integrate, and **no reliable existing reminder solution**. Secondary candidates: salons/barbers, cleaning firms and tutors only after garage pilot. Qualification must distinguish online bookings from phone-only bookings and confirm who owns the booking system.

## Customer acquisition
First approach existing Website Machine and AI Receptionist customers and warm leads where appropriate. Offer a simple demonstration showing how an appointment becomes a confirmation, reminder, and exception alert. Then test compliant outbound to verified qualified garages only after approval. Never claim a prospect has missed appointments or loses revenue without evidence. Respect UK GDPR/PECR, consent requirements, opt-outs and NONSTOP AI suppression/compliance gates.

## Technical architecture (reuse, do not rebuild)
- **n8n:** booking events, deduplication, scheduling, retry policies, delivery callbacks and exception alerts.
- **Supabase:** tenant-scoped booking metadata, communication preferences, message status, audit records, costs and usage.
- **One booking/calendar provider:** choose based on a real pilot customer's current tools; verify API access, cancellation semantics and webhook/polling reliability.
- **Email and SMS:** use approved providers, verify deliverability and messaging rules; consent/opt-out handling must match message purpose and applicable law.
- **Stripe:** existing subscription and payment visibility after product/pricing approval; never create live charges without approval.
- **NONSTOP AI dashboard:** reuse customer/pipeline records and show system health and customer usage.
- **AI Receptionist and Website Machine:** connect through a documented booking event contract, not fragile direct database edits.

Do not assume any of these integrations are already working. Claude Code must audit actual access and behavior first.

## Event and data design
Minimum events: appointment.created, appointment.updated, appointment.cancelled, reminder.due, message.sent, message.failed, customer.confirmed, change.requested, staff.action_required. Every event needs tenant ID, stable booking ID, source ID, timestamps/time zone, status, and idempotency key. Store the minimum personal information necessary, encrypt/protect credentials, apply role-based access and retention policies. Never send a reminder for a cancelled or moved booking; invalidate old schedules on updates. Avoid duplicate sends across retries and workflow restarts.

## Messaging and customer experience
Messages identify the garage, show the correct local appointment date/time, and offer a secure way to confirm or request changes. Avoid exposing sensitive details in SMS. Support accessibility and plain-language wording. Handle missing/invalid numbers, delivery failures, late bookings, out-of-hours requests and no-reply cases. Any automated reschedule must check availability and be authorized; otherwise mark as pending staff review.

## Unit economics and pricing validation
Track setup labor, integration maintenance, monthly support, email/SMS provider costs, Stripe fees, model usage if any, refund exposure, and gross margin per customer. Set included SMS allowance only after testing actual UK per-message rates and realistic appointment volumes. Assess customer willingness to pay against features already included in existing booking products. Stop or reprice accounts with persistently negative contribution margin.

## Security, compliance and operations
Human approval required for production deployments, provider purchases, sending real customer messages, Stripe product/payment changes, and public marketing claims. Enforce tenant isolation, credential secrecy, least privilege, audit logging, deletion/retention controls, and documented data-controller/processor responsibilities. Monitor failed runs, webhook delivery, provider limits, bounced messages, duplicates, booking conflicts and unexpected spend. Provide a manual fallback and escalation path.

## Success metrics
Qualified conversations; paid pilots; onboarding time; appointments processed; successful/failed deliveries; confirmations; cancellation/reschedule requests resolved; observed no-show rate when reliable baseline exists; customer retention; monthly recurring revenue; messaging cost; support time; gross margin. Do not equate messages sent with customer value.

## Phased execution
**Phase 0 — Read-only audit:** Inspect current n8n, Supabase, Stripe, calendar integrations, Website Machine, AI Receptionist and dashboard. Report what is verified working, missing, broken, inaccessible, or duplicative. No changes.
**Phase 1 — Customer discovery:** Speak to 5–10 garages and identify a specific booking system and unmet need. Confirm whether reminders already exist and whether £299 + £99/month is plausible.
**Phase 2 — Controlled pilot:** One garage, one booking source, confirmation, two configurable reminders, secure change request, staff alerts. Test creation, updates, cancellation, duplicates, time zones, provider failure, opt-outs, and manual fallback with synthetic data before real customer messages.
**Phase 3 — First paying customer:** Agree scope, pricing and allowance; obtain permission, complete onboarding, activate approved billing and live messages; measure costs and customer outcomes.
**Phase 4 — Productize:** Reusable configuration and onboarding, support documentation, exception monitoring, and upsell to existing NONSTOP AI customers. Add other industries/integrations only when justified by paid demand.

## Claude Code handoff
Read this blueprint, inspect the existing repository and connected systems read-only, and produce: (1) system inventory, (2) gap/risk register, (3) smallest pilot architecture, (4) estimated costs and dependencies, (5) exact approval points, and (6) prioritized implementation tasks. Keep changes in a separate branch. Do not deploy, message prospects/customers, charge cards, or change production workflows without explicit authorization.
