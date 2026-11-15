# NONSTOP AI — Website Machine Business Blueprint
Version: 1.0 | 15 November 2026
Status: Strategy and proposed implementation; not a declaration that integrations are operational.

## 1. Commercial objective
Build a repeatable, profitable UK website service that finds suitable small businesses, prepares accurate personalized website previews, conducts approved compliant outreach, converts interested prospects, and delivers finished websites using reusable templates. Optimize for collected revenue, gross margin, customer retention, and low owner workload—not leads or previews alone.

## 2. Core customer proposition
"See what your business website could look like before you commit. We build it, launch it, and manage it."
Target businesses with verified website shortcomings and an ability to pay. A poor website does not prove a business is losing customers; avoid unsupported claims.

## 3. Offers and pricing (existing positioning; verify live Stripe and scope before publishing)
- Starter: £99 one-off for a tightly scoped basic one-page website. Define hosting and future changes explicitly.
- Growth (primary): £199 setup plus £50/month for a managed website, with defined hosting, maintenance, monitoring, and bounded support. Specify booking/enquiry integrations where contracted.
- Business bundle: £299 setup plus £99/month for website plus AI receptionist, subject to confirmed scope, provider usage, and current offer commitments.
Do not silently change legacy customer promises or Stripe products. Define VAT treatment, cancellation, domain ownership, export/handover, support limits, and acceptable-use terms before launch.

## 4. Revenue and unit economics
Revenue = setup payments + monthly management subscriptions. Track acquisition spend, research/model costs, preview hosting, payment fees, build and support time, refunds, churn, and gross margin by customer and campaign. Example: 20 Growth customers yield £3,980 gross setup revenue and £1,000 monthly recurring revenue before costs, taxes, churn, and refunds. This is arithmetic, not a forecast.

## 5. Customer acquisition flow
1. Discover UK small businesses via existing Apify/public-source workflows.
2. Verify website defects with reproducible evidence and collect only accurate public business facts.
3. Qualify business, eligibility, contact, industry, and offer fit; deduplicate in Supabase.
4. Generate a low-cost template-based homepage preview; validate content, mobile layout, links, and accessibility basics.
5. Publish an isolated, clearly labeled unofficial preview only after appropriate approval; do not imply endorsement or misuse protected branding/images.
6. Draft personalized outreach with one verified observation, preview URL, transparent offer, and opt-out. Preserve UK compliance gates and suppressions. Do not send without approval.
7. Track reply and next action; alert owner on positive replies. Follow up only under approved compliant cadence.
8. Use approved Stripe checkout and onboarding after customer agreement.
9. Build the finished site, obtain customer signoff, test forms/mobile/domain, and launch after approval.
10. Deliver ongoing defined support, monitor renewal and cancellation, and offer relevant AI receptionist upgrades.

## 6. Systems and responsibilities
- Claude Code: engineering, template development, testing, code review; not an always-on unattended sales agent.
- Claude API or equivalent approved model: structured prospect research assistance, copy personalization, and page-content generation with verification.
- n8n: orchestration, scheduling, event handling, alerts, idempotency, and approvals.
- Supabase: source of truth for prospect CRM, verified findings, preview metadata, campaigns, sales stages, customer records, and audit trail.
- Apify: public business discovery and website checks where permitted.
- Hunter: business-email discovery/verification, only with valid credentials and within credits.
- Netlify: isolated preview hosting and managed production websites as appropriate; local hosting alone is not accessible to prospects.
- Gmail: approved outreach and reply handling.
- Stripe: approved payments and subscriptions; use webhooks for payment confirmation.
- NONSTOP AI dashboard: single control center for funnel, approvals, errors, spend, revenue, and customer delivery.
Reuse existing integrations and avoid another CRM or duplicate automations.

## 7. Reusable delivery model
Start with a small set of responsive, tested industry templates (garages, trades, cleaners, etc.). Separate verified business data from templates. Use placeholder assets only when clearly identified; no invented testimonials, reviews, awards, services, or customer results. Preview is a limited example, not the finished contractual deliverable. Full customization and production deployment follow payment and customer content approval.

## 8. Safeguards
- Never bypass the existing `fs_send_gate`, opt-outs, suppression lists, eligibility checks, or deduplication.
- No live email sends, paid API calls, ad spending, Stripe changes, production deploys, or public customer-branded previews without explicit approval.
- Per-prospect generation budgets and quotas; preview expiry/archiving; retry limits.
- Protect customer data, secrets, credentials, and domain ownership.
- Human approval for sales commitments, pricing exceptions, customer-specific claims, final launch, and unusual support obligations.
- Monitor build failures, form delivery, payment webhooks, bounces, and delivery exceptions; alert owner.
- Avoid claiming an integration is working until tested end-to-end.

## 9. Dashboard and feedback loop
Track: prospects researched, qualified leads, verified website issues, previews built, previews approved, outreach approved/sent, replies, positive replies, demos/meetings, paid customers, websites delivered, active subscriptions, MRR, churn, refunds, acquisition cost, gross margin, errors, and owner approvals. Growth Operator reviews real outcomes weekly and proposes bounded experiments; never autonomously rewrites production systems or compliance controls.

## 10. Phased execution and acceptance criteria
**Phase 0 — Audit:** Inspect existing five-previews-per-day workflow, Supabase tables, website generator, Netlify, Gmail, Stripe, and dashboard. Classify each component as verified working, broken, missing, or inaccessible.
**Phase 1 — Pilot:** Using authorized test data, generate three distinct previews; check mobile, links, factual accuracy, and isolated hosting. Measure cost per preview.
**Phase 2 — Sales pilot:** Qualify 20 prospects, prepare compliant messages, seek approval, send only approved outreach, record replies and next actions. No volume scaling without results.
**Phase 3 — First sale:** Verify approved checkout, payment webhook, onboarding, customer signoff, finished site deployment, and support ownership. Track actual time and margin.
**Phase 4 — Optimize:** Compare real reply, conversion, and profitability data; refine templates, targeting, and offers. Scale only once the process is reliable and profitable.

## 11. Relationship to NONSTOP AI AI Receptionist
Website Machine and AI Receptionist are two offers within NONSTOP AI. Share the same approved CRM, orchestration, sales pipeline, payment visibility, and executive dashboard, but maintain separate product configurations, deployment boundaries, and customer data. Cross-sell only when relevant.

## 12. Change control
This document is a strategic blueprint, not authorization to deploy. Claude Code should read it before proposing changes, verify actual system state, work in separate development branches, preserve existing live workflows, and request approval before production actions. Record changes and decisions in version control.
