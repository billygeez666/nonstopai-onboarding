// netlify/functions/start-onboarding.js
//
// Secure server-side proxy for the onboarding form.
// Keeps x-intake-secret and Stripe price IDs out of the browser entirely.
//
// Flow:
//   1. Validate the incoming form payload.
//   2. POST to Phase 9A intake -> get { client_id, project_id }.
//   3. POST to Phase 9A.5 checkout session -> get { checkout_url }.
//   4. Return { checkout_url } to the browser.

const PHASE_9A_URL = 'https://bendarus.app.n8n.cloud/webhook/phase9a-intake'
const PHASE_9A5_URL = 'https://bendarus.app.n8n.cloud/webhook/nonstopai/create-checkout-session'

const REQUIRED_FIELDS = [
  'business_name',
  'contact_name',
  'contact_email',
  'contact_phone',
  'niche',
  'city',
  'business_description',
  'opening_hours',
]

// Netlify Functions v2 requires every path to return a Response object
// (or undefined) — returning the legacy { statusCode, headers, body }
// shape throws "unsupported value" at runtime.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, message: 'Method not allowed.' })
  }

  const INTAKE_SECRET = process.env.INTAKE_SECRET
  const SETUP_PRICE_ID = process.env.SETUP_PRICE_ID
  const SUBSCRIPTION_PRICE_ID = process.env.SUBSCRIPTION_PRICE_ID

  if (!INTAKE_SECRET || !SETUP_PRICE_ID || !SUBSCRIPTION_PRICE_ID) {
    console.error('start-onboarding: missing required environment variables')
    return jsonResponse(500, {
      success: false,
      message: 'Server is not configured correctly. Please try again shortly.',
    })
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse(400, { success: false, message: 'Invalid request body.' })
  }

  // --- Validate ---
  const missing = REQUIRED_FIELDS.filter((field) => !String(payload?.[field] ?? '').trim())
  if (missing.length > 0) {
    return jsonResponse(400, {
      success: false,
      message: `Missing required field(s): ${missing.join(', ')}`,
    })
  }
  if (!isValidEmail(payload.contact_email)) {
    return jsonResponse(400, { success: false, message: 'Please enter a valid email address.' })
  }

  const intakeBody = {
    business_name: String(payload.business_name).trim(),
    contact_name: String(payload.contact_name).trim(),
    contact_email: String(payload.contact_email).trim(),
    contact_phone: String(payload.contact_phone).trim(),
    niche: String(payload.niche).trim(),
    city: String(payload.city).trim(),
    business_description: String(payload.business_description).trim(),
    transfer_number: String(payload.transfer_number ?? '').trim(),
    opening_hours: String(payload.opening_hours).trim(),
    booking_required: Boolean(payload.booking_required),
    style_preset: String(payload.style_preset ?? 'professional').trim(),
  }

  // --- Step 1: Phase 9A intake ---
  let intakeData
  try {
    const intakeRes = await fetch(PHASE_9A_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-intake-secret': INTAKE_SECRET,
      },
      body: JSON.stringify(intakeBody),
    })

    intakeData = await intakeRes.json().catch(() => null)

    if (!intakeRes.ok || !intakeData?.success || !intakeData?.client_id || !intakeData?.project_id) {
      console.error('Phase 9A intake failed', intakeRes.status, intakeData)
      return jsonResponse(502, {
        success: false,
        message: intakeData?.message || "We couldn't save your details. Please try again.",
      })
    }
  } catch (err) {
    console.error('Phase 9A intake request error', err)
    return jsonResponse(502, {
      success: false,
      message: "We couldn't reach our systems. Please try again in a moment.",
    })
  }

  // --- Step 2: Phase 9A.5 checkout session ---
  try {
    const checkoutRes = await fetch(PHASE_9A5_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-intake-secret': INTAKE_SECRET,
      },
      body: JSON.stringify({
        client_id: intakeData.client_id,
        project_id: intakeData.project_id,
        email: intakeBody.contact_email,
        business_name: intakeBody.business_name,
        niche: intakeBody.niche,
        setup_price_id: SETUP_PRICE_ID,
        subscription_price_id: SUBSCRIPTION_PRICE_ID,
      }),
    })

    const checkoutData = await checkoutRes.json().catch(() => null)

    if (!checkoutRes.ok || !checkoutData?.checkout_url) {
      console.error('Phase 9A.5 checkout failed', checkoutRes.status, checkoutData)
      return jsonResponse(502, {
        success: false,
        message: "We couldn't start checkout. Please try again.",
      })
    }

    return jsonResponse(200, {
      success: true,
      checkout_url: checkoutData.checkout_url,
      session_id: checkoutData.session_id,
    })
  } catch (err) {
    console.error('Phase 9A.5 checkout request error', err)
    return jsonResponse(502, {
      success: false,
      message: "We couldn't reach our payment provider. Please try again in a moment.",
    })
  }
}
