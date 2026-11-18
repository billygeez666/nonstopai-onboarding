import { websiteMachineHostingTerms } from './websiteMachineHosting.js'

const emailPattern = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

export function createWebsiteMachineDeliveryEmail({ apiKey, from, fetchImpl = fetch } = {}) {
  return async ({ to, businessName, deliveryUrl, orderId, hostingFreeUntil }) => {
    const fail = (message, deliveryOutcome = 'failed', safeCode = 'DELIVERY_EMAIL_INVALID') => {
      const error = new Error(message)
      error.deliveryOutcome = deliveryOutcome
      error.code = safeCode
      error.stage = 'resend_email'
      throw error
    }
    if (!apiKey || typeof apiKey !== 'string' || !from || !emailPattern.test(from) || !emailPattern.test(to || '') ||
        !/^[0-9a-f-]{36}$/i.test(orderId || '') || typeof deliveryUrl !== 'string') {
      fail('Website Machine delivery email is not configured.')
    }
    let url
    try { url = new URL(deliveryUrl) } catch { fail('A verified HTTPS customer website is required for delivery.') }
    if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname.endsWith('.netlify.app') || url.hostname.split('.').length > 1)) {
      fail('A verified HTTPS customer website is required for delivery.')
    }
    const name = String(businessName || 'Your business').slice(0, 100)
    const safeName = escapeHtml(name)
    const safeUrl = escapeHtml(url.toString())
    const end = new Date(hostingFreeUntil ?? NaN)
    const hosting = Number.isNaN(end.getTime()) ? '' : `${websiteMachineHostingTerms} Your free hosting ends on ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/London' }).format(end)} (UK time).`
    let response
    try {
      response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'idempotency-key': `wm-delivery-${orderId}` },
        body: JSON.stringify({
          from,
          to: [to],
          subject: `Your ${name} website is ready`,
          text: `Your website is ready: ${url.toString()}\n\nThis link is your published website. Reply to your Website Machine contact if you need help.${hosting ? `\n\n${hosting}` : ''}`,
          html: `<p>Your website is ready.</p><p><a href="${safeUrl}">Visit ${safeName}</a></p><p>This is the published website for ${safeName}.</p>${hosting ? `<p>${escapeHtml(hosting)}</p>` : ''}`,
        }),
      })
    } catch {
      fail('Resend delivery outcome is unknown and requires reconciliation.', 'unknown', 'RESEND_OUTCOME_UNKNOWN')
    }
    if (!response.ok) {
      const outcome = response.status >= 500 ? 'unknown' : 'failed'
      const code = outcome === 'unknown' ? 'RESEND_OUTCOME_UNKNOWN' : 'RESEND_REJECTED'
      fail(`Website Machine delivery email ${outcome === 'unknown' ? 'outcome is unknown' : 'was rejected'} (${response.status}).`, outcome, code)
    }
    const payload = await response.json().catch(() => ({}))
    return { sent: true, messageId: typeof payload?.id === 'string' ? payload.id : null }
  }
}
