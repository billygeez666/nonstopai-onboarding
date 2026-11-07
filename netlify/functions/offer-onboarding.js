// netlify/functions/offer-onboarding.js
//
// Payment-free onboarding for the £99/month (no setup fee) AI Receptionist offer.
// This function NEVER touches Stripe, NEVER creates a checkout session and NEVER
// asks for card details. Access is by a single-use token that is only issued
// after a verified Stripe payment (see n8n workflow "R99 - Payment Intake").
//
//   GET  /api/offer-onboarding?token=...   -> { state: ok|invalid|expired|submitted }
//   POST /api/offer-onboarding             -> saves the onboarding details
//
// All persistence happens in n8n -> Supabase RPC (service role). The browser
// never sees a secret. INTAKE_SECRET is the same secret the standard flow uses.

const N8N_URL = 'https://bendarus.app.n8n.cloud/webhook/nonstopai/r99-onboarding'
const TOKEN_RE = /^[a-f0-9]{64}$/

const REQUIRED = [
  'contact_name',
  'business_name',
  'contact_email',
  'business_phone',
  'business_type',
  'address_or_area',
  'opening_hours',
  'services',
  'ai_number',
  'typical_enquiries',
]

// Hard length caps (the database enforces them again).
const MAX = {
  contact_name: 200,
  business_name: 200,
  contact_email: 254,
  business_phone: 40,
  business_type: 100,
  website_url: 300,
  address_or_area: 500,
  opening_hours: 1000,
  services: 3000,
  faqs: 4000,
  ai_number: 40,
  greeting: 500,
  typical_enquiries: 2000,
  booking_requirements: 2000,
  calendar_requirements: 1000,
  escalation: 1000,
  notify_email: 254,
  notify_phone: 40,
  special_instructions: 2000,
}

const EXTRA_KEYS = ['restaurant_service_types', 'restaurant_menu_link', 'restaurant_takes_table_bookings']

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

async function callN8n(body, secret) {
  const res = await fetch(N8N_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-intake-secret': secret },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, data }
}

export default async (req) => {
  const secret = process.env.INTAKE_SECRET
  if (!secret) {
    console.error('offer-onboarding: INTAKE_SECRET missing')
    return json(500, { ok: false, message: 'Server is not configured correctly.' })
  }

  // ---- GET: is this link usable? (no personal data returned) ----
  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token') || ''
    if (!TOKEN_RE.test(token)) return json(200, { state: 'invalid' })
    try {
      const { ok, data } = await callN8n({ action: 'state', token }, secret)
      if (!ok || !data?.state) return json(502, { state: 'error' })
      return json(200, { state: data.state })
    } catch (err) {
      console.error('offer-onboarding state error', err?.message)
      return json(502, { state: 'error' })
    }
  }

  if (req.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed.' })

  let payload
  try {
    payload = await req.json()
  } catch {
    return json(400, { ok: false, message: 'Invalid request.' })
  }

  // Honeypot: bots fill hidden fields. Pretend success, store nothing.
  if (String(payload?.hp ?? '').trim()) return json(200, { ok: true })

  const token = String(payload?.token ?? '')
  if (!TOKEN_RE.test(token)) return json(400, { ok: false, reason: 'invalid', message: 'This link is not valid.' })

  const missing = REQUIRED.filter((k) => !String(payload?.[k] ?? '').trim())
  if (missing.length) {
    return json(400, { ok: false, reason: 'missing', message: 'Please complete all required fields.', fields: missing })
  }
  if (!isEmail(String(payload.contact_email).trim())) {
    return json(400, { ok: false, reason: 'bad_email', message: 'Please enter a valid email address.' })
  }
  if (payload.notify_email && !isEmail(String(payload.notify_email).trim())) {
    return json(400, { ok: false, reason: 'bad_email', message: 'Please enter a valid notification email address.' })
  }

  // Build a clean, capped payload (only known keys are forwarded).
  const clean = {}
  for (const [key, max] of Object.entries(MAX)) {
    clean[key] = String(payload?.[key] ?? '').trim().slice(0, max)
  }
  const extra = {}
  for (const key of EXTRA_KEYS) {
    if (payload?.extra?.[key] !== undefined) extra[key] = String(payload.extra[key]).trim().slice(0, 500)
  }

  try {
    const { ok, data } = await callN8n({ action: 'submit', token, payload: { ...clean, extra } }, secret)
    if (data?.ok) return json(200, { ok: true })
    const reason = data?.reason
    if (reason === 'submitted') return json(409, { ok: false, reason, message: 'These details have already been submitted.' })
    if (reason === 'expired') return json(410, { ok: false, reason, message: 'This link has expired. Please contact us for a new one.' })
    if (reason === 'invalid') return json(400, { ok: false, reason, message: 'This link is not valid.' })
    console.error('offer-onboarding submit rejected', ok, reason)
    return json(502, { ok: false, message: "We couldn't save your details. Please try again." })
  } catch (err) {
    console.error('offer-onboarding submit error', err?.message)
    return json(502, { ok: false, message: "We couldn't reach our systems. Please try again in a moment." })
  }
}
