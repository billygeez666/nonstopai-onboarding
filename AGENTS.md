# NONSTOP AI Website Machine — Codex operating instructions

## Mission
Build, test, and deploy a production-ready Website Machine that turns verified business details into a reviewable website preview and, after payment/onboarding, a delivered website. Operate autonomously through engineering milestones; do not wait for repeated prompts for routine coding, tests, commits, or safe deployment work.

## Branch and local safety
- Work on `codex/website-machine-engine`, created from `main`. Use a separate git worktree. Do not reset, stash, overwrite, or commit unrelated local changes on `always-on-restore` (notably `src/App.jsx`, `.claude/`, `src/pages/AlwaysOn.*`).
- Do not modify the Booking Engine or AI Receptionist booking/onboarding flows.
- Make small reviewable commits and run tests/build before deploying.
- Never commit secrets or use service-role credentials in client code.

## Business outcome
First offer: fast, credible one-page websites for UK small businesses, with an initial preview and straightforward paid delivery. Prioritize real customer acquisition, revenue, margin, and maintainability. Do not invent customer facts, reviews, contact details, opening hours, certifications, or results.

## Delivery milestones
1. Audit current repo and relevant existing Website Machine/Netlify/Supabase/n8n infrastructure; reuse working pieces.
2. Implement server-side structured business intake, validation, source provenance, and safe content generation. No arbitrary execution of generated code; no unsafe server-side URL fetching.
3. Build a responsive template-driven preview and editing/review workflow with automated tests.
4. Persist project state with tenant isolation, idempotency, safe access control, and audit history.
5. Deploy a staging preview, verify end-to-end with synthetic business data and automated tests.
6. Integrate approved payment/onboarding and customer delivery, verifying actual Stripe and Netlify behavior with test mode first. Do not change unrelated live products or existing payment links.
7. Deploy the Website Machine product to production after successful checks; verify the live endpoint and rollback path.
8. Document operations, costs, support flow, monitoring, and remaining blockers.

## Autonomy and guardrails
- User authorizes autonomous coding, tests, commits, and deployment of the Website Machine once verified.
- Never send cold outreach, emails, or SMS to real prospects without verified eligibility, suppression checks, and lawful UK marketing compliance. No invented prospect lists.
- Never charge real cards, create real purchases, transfer domains, delete production data, or modify unrelated live workflows as a test.
- If a credential, external approval, payment confirmation, or platform authentication is required, report the exact blocker rather than circumventing it.
- Run tests and production build; use synthetic data for validation.
- Record exact evidence for deployed endpoints, tests, and changes. Never claim deployment if unverified.
- Optimize for the smallest production-capable release, not feature bloat.

## Reporting
At each milestone, record implemented files, tests, commit SHA, deployed URL if any, and blockers. Continue autonomously to the next safe milestone.
