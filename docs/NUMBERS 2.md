# NONSTOP AI — Phone Number Architecture

Single source of truth for every inbound number: Supabase `inbound_number_pool`.
Each row has a `purpose` column that hard-separates the two classes of number.

## purpose = 'demo' — permanent public demo lines

Never claimed for customers. Published on the website. Do not retire, repoint,
or reuse without updating the website vertical configs.

| Number | Vertical | Bland pathway | Notes |
|---|---|---|---|
| +44 7449 839233 | Taxi OS | `3a71c8fb-47af-49a7-84e3-813f663cb782` (BeTaxiMK master, production) | Also the taxi production number. Do not touch. |
| +44 1992 932782 | FOOD OS | `3e3c1370-f4b1-4830-bbaa-deada455ece3` (King Kebab Demo) | Permanent FOOD demo. Repurposed from the retired hotel demo 2026-07-08. Self-contained pathway — no webhooks. |

## purpose = 'provisioning' — customer onboarding pool

Claimed by the provisioning flow (`status = 'available'` only). Pre-imported
into Bland, pre-wired to the taxi master pathway with per-number
`bland-lookup` dynamic data, ready for client assignment.

Current pool: +44 7576 597441, +44 7460 045201, +44 7460 076255,
+44 7460 079123, +44 7460 080973 (all available as of 2026-07-08).

## Rules

1. Provisioning claims MUST filter `status = 'available' AND purpose = 'provisioning'`.
2. Website vertical configs (`src/config/verticals/*.js`) reference demo numbers
   only; a vertical's `demoPhone` must be a `purpose = 'demo'` number.
3. A vertical may be `status: 'live'` in the frontend registry only when its
   `signupValue` matches an ACTIVE row in `pathway_templates`.
4. New demo numbers: buy, import to Bland, point at the vertical's demo pathway,
   insert into `inbound_number_pool` with `purpose = 'demo', status = 'assigned'`.
