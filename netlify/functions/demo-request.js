// netlify/functions/demo-request.js
//
// Captures an AI receptionist demo request from /ai-receptionist/ and writes it
// into Supabase via the ops_capture_demo_request RPC.
//
// The RPC is SECURITY DEFINER and does all the real work server-side in Postgres:
// validation, UK number normalisation, test-submission exclusion, suppression and
// opt-out checks, 30-day duplicate protection and a global hourly abuse cap. One
// insert into wm_onboarding then fires the two existing triggers, which create the
// ops_followup_queue row and queue the lead-alert email. Nothing new is invented
// here and no outreach is sent.
//
// Env (functions scope): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed.' })

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('demo-request: missing Supabase environment variables')
    return json(500, { ok: false, message: 'Server is not configured. Please ring us instead.' })
  }

  let body
  try {
    const ct = req.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      body = await req.json()
    } else {
      body = Object.fromEntries(new URLSearchParams(await req.text()))
    }
  } catch {
    return json(400, { ok: false, message: 'Invalid request body.' })
  }

  // Honeypot: real people leave this empty. Silently accept so bots learn nothing.
  // status "received" = accepted but NOT a saved lead, so the page must not fire a conversion.
  if (String(body['company-website'] || '').trim() !== '') {
    return json(200, { ok: true, status: 'received' })
  }

  // Attribution (Meta ad -> enquiry). Folded into p_source so no schema change is needed:
  // it lands in wm_onboarding.source->>'landing'. fbclid is recorded as present/absent only.
  const clean = (v, n) => String(v || '').replace(/[^\w.\-~%+ ]/g, '').slice(0, n)
  const attr = []
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const v = clean(body[k], 60)
    if (v) attr.push(`${k}=${v}`)
  }
  if (String(body.fbclid || '').trim() !== '') attr.push('fbclid=yes')
  const landing = String(body.source_page || '/ai-receptionist/').slice(0, 100)

  const payload = {
    p_name: String(body.name || '').slice(0, 120),
    p_email: String(body.email || '').slice(0, 160),
    p_mobile: String(body.mobile || '').slice(0, 32),
    p_business: String(body.business_name || '').slice(0, 160),
    p_trade: String(body.trade || '').slice(0, 80),
    p_source: attr.length ? `${landing} | ${attr.join(' ')}` : landing,
  }

  let res, out
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ops_capture_demo_request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(payload),
    })
    out = await res.json()
  } catch (err) {
    console.error('demo-request: Supabase unreachable', err)
    return json(502, { ok: false, message: 'Could not save that. Please ring 07460 080973.' })
  }

  if (!res.ok) {
    console.error('demo-request: RPC error', res.status, out)
    return json(502, { ok: false, message: 'Could not save that. Please ring 07460 080973.' })
  }

  // The RPC reports why it declined; surface only what is useful to the visitor.
  if (out && out.ok === false) {
    return json(400, { ok: false, message: out.reason || 'Please check your details.' })
  }

  // Test / internal submissions are deliberately NOT saved by the RPC. Say so plainly
  // (instead of showing a success screen) so nobody mistakes it for a stored enquiry.
  if (out && out.test) {
    return json(200, {
      ok: false,
      test: true,
      message:
        'Test submission recognised: nothing was saved and no alert was sent. To test properly, use a name and email that do not contain the word "test".',
    })
  }

  // Duplicate / suppressed look like a normal thank-you to the visitor (we never tell
  // anyone they are on a suppression list) but are NOT new leads: no conversion event.
  if (out && (out.duplicate || out.suppressed)) {
    return json(200, { ok: true, status: 'received' })
  }

  // Only a genuinely stored lead returns status "saved" plus its reference. The page
  // fires the Meta Lead event on this alone, using the ref as the event id.
  if (out && out.ok === true && out.ref) {
    return json(200, { ok: true, status: 'saved', ref: out.ref })
  }
  console.error('demo-request: unexpected RPC result', out)
  return json(502, { ok: false, message: 'Could not save that. Please ring 07460 080973.' })
}
