const emailPattern = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

export function createWebsiteMachineDeliveryEmail({ apiKey, from, fetchImpl = fetch } = {}) {
  return async ({ to, businessName, deliveryUrl, orderId }) => {
    if (!apiKey || typeof apiKey !== 'string' || !from || !emailPattern.test(from) || !emailPattern.test(to || '') ||
        !/^[0-9a-f-]{36}$/i.test(orderId || '') || typeof deliveryUrl !== 'string') {
      throw new Error('Website Machine delivery email is not configured.')
    }
    const url = new URL(deliveryUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname.endsWith('.netlify.app') || url.hostname.split('.').length > 1)) {
      throw new Error('A verified HTTPS customer website is required for delivery.')
    }
    const name = String(businessName || 'Your business').slice(0, 100)
    const safeName = escapeHtml(name)
    const safeUrl = escapeHtml(url.toString())
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'idempotency-key': `wm-delivery-${orderId}` },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Your ${name} website is ready`,
        text: `Your website is ready: ${url.toString()}\n\nThis link is your published website. Reply to your Website Machine contact if you need help.`,
        html: `<p>Your website is ready.</p><p><a href="${safeUrl}">Visit ${safeName}</a></p><p>This is the published website for ${safeName}.</p>`,
      }),
    })
    if (!response.ok) throw new Error(`Website Machine delivery email failed (${response.status}).`)
    return { sent: true }
  }
}
