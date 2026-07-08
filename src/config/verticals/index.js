// Vertical registry — single source of truth for every vertical.
//
// Adding a future vertical:
//   1. Create src/config/verticals/<slug>.js  (the landing page content)
//   2. Provision its Bland demo pathway + demo number
//   3. Activate its row in Supabase `pathway_templates` (niche = signupValue)
//   4. Import it below and set status: 'live'
//
// The homepage picker, nav, routes, and signup NICHES all render from this
// list — no other file needs to change.
//
// RULE: a vertical may only have status 'live' if its `signupValue` matches
// an ACTIVE row in Supabase `pathway_templates`. `coming_soon` verticals get
// a landing page but no checkout.

import taxi from './taxi.js'
import food from './food.js'

export const VERTICALS = [taxi, food]

export const liveVerticals = () => VERTICALS.filter((v) => v.status === 'live')

export const getVertical = (slug) => VERTICALS.find((v) => v.slug === slug) || null

export const getVerticalBySignupValue = (value) =>
  VERTICALS.find((v) => v.signupValue === value) || null
