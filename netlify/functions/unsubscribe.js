// netlify/functions/unsubscribe.js
//
// One-click unsubscribe for NONSTOP AI outbound email.
//
//   GET  /api/unsubscribe?e=<email>&t=<token>   -> suppresses, shows confirmation page
//   POST /api/unsubscribe?e=<email>&t=<token>   -> same, for RFC 8058 List-Unsubscribe-Post
//
// The token is HMAC-SHA256(lowercased email, UNSUBSCRIBE_SECRET) truncated to 32 hex
// chars. Without it the request is refused, so nobody can walk the endpoint and
// suppress addresses that were never mailed.
//
// All the suppression work happens in Postgres in ops_unsubscribe_email(), which
// writes re_suppressions(channel='email') — the exact predicate the send-eligibility
// view reads — and sets re_contacts.opted_out / re_accounts.do_not_contact.
//
// Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, UNSUBSCRIBE_SECRET

import { createHmac, timingSafeEqual } from 'node:crypto'

const sign = (email, secret) =>
  createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex').slice(0, 32)

const page = (title, body) => `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} &middot; NONSTOP AI</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#07070b;color:#c9cdda;
       font:400 16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:24px}
  .card{max-width:460px;width:100%;background:#0e0f16;border:1px solid #232535;border-radius:16px;
        overflow:hidden}
  .bar{height:4px;background:linear-gradient(100deg,#2f6bff 0%,#8b3cf6 52%,#f0379a 100%)}
  .in{padding:30px 32px 32px}
  h1{margin:0 0 12px;font-size:22px;line-height:1.25;color:#fff;letter-spacing:-.02em}
  p{margin:0 0 10px}
  .mark{font:700 12px/1 Arial,sans-serif;letter-spacing:.22em;color:#6f7486;margin:0 0 18px}
</style></head><body>
<div class="card"><div class="bar"></div><div class="in">
<p class="mark">NONSTOP AI</p>
${body}
</div></div></body></html>`

const html = (status, title, body) =>
  new Response(page(title, body), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return html(405, 'Not allowed', '<h1>Method not allowed</h1>')
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
  const SECRET = process.env.UNSUBSCRIBE_SECRET

  if (!SUPABASE_URL || !SUPABASE_KEY || !SECRET) {
    console.error('unsubscribe: missing environment variables')
    return html(500, 'Something went wrong',
      `<h1>We could not process that automatically</h1>
       <p>Please reply to our email with the word STOP and we will remove you by hand.</p>`)
  }

  const url = new URL(req.url)
  const email = (url.searchParams.get('e') || '').trim()
  const token = (url.searchParams.get('t') || '').trim().toLowerCase()

  const expected = email ? sign(email, SECRET) : ''
  const ok =
    email &&
    token.length === expected.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected))

  if (!ok) {
    return html(400, 'Link not valid',
      `<h1>That unsubscribe link is not valid</h1>
       <p>It may have been cut short by your email client. Reply to our email with the word
       STOP and we will remove you by hand.</p>`)
  }

  let res, out
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ops_unsubscribe_email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ p_email: email, p_source: 'email_link' }),
    })
    out = await res.json()
  } catch (err) {
    console.error('unsubscribe: Supabase unreachable', err)
    return html(502, 'Something went wrong',
      `<h1>We could not process that automatically</h1>
       <p>Please reply to our email with the word STOP and we will remove you by hand.</p>`)
  }

  if (!res.ok || !out || out.ok !== true) {
    console.error('unsubscribe: RPC refused', res.status, out)
    return html(502, 'Something went wrong',
      `<h1>We could not process that automatically</h1>
       <p>Please reply to our email with the word STOP and we will remove you by hand.</p>`)
  }

  return html(200, 'Unsubscribed',
    `<h1>You are unsubscribed</h1>
     <p>We have removed <strong style="color:#fff">${email.replace(/[<>&"]/g, '')}</strong>
     from our outbound email and we will not contact you again.</p>
     <p>Sorry for the interruption.</p>`)
}
