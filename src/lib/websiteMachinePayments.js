import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { verifyDomainChallenge } from './websiteMachinePublishing.js'

const API = 'https://api.stripe.com/v1'
const WEBSITE_MACHINE_ONE_OFF_AMOUNT = 9900
const isId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,120}$/.test(value)
export const isStripeTestSecretKey = (value) => typeof value === 'string' && (value.startsWith('sk_test_') || value.startsWith('rk_test_'))

export function verifyStripeWebhookSignature(rawBody, signatureHeader, secret, now = Date.now(), toleranceSeconds = 300) {
  if (!Buffer.isBuffer(rawBody) || typeof secret !== 'string' || secret.length < 16 || typeof signatureHeader !== 'string') return null
  const pieces = signatureHeader.split(',').map((part) => part.split('='))
  const timestamp = Number(pieces.find(([key]) => key === 't')?.[1])
  const signatures = pieces.filter(([key]) => key === 'v1').map(([, value]) => value).filter((value) => /^[a-f0-9]{64}$/i.test(value || ''))
  if (!Number.isInteger(timestamp) || Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds || !signatures.length) return null
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest()
  for (const signature of signatures) {
    const candidate = Buffer.from(signature, 'hex')
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      try { return JSON.parse(rawBody.toString('utf8')) } catch { return null }
    }
  }
  return null
}

export function paymentRpcSignature({ eventId, sessionId, projectId, amount, currency, mode = 'test' }, secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Payment confirmation is not configured.')
  const message = [mode, eventId, sessionId, projectId, String(amount), currency.toLowerCase()].join('\n')
  return createHmac('sha256', secret).update(message).digest('hex')
}

function validatePrice(price, { id, amount }) {
  const isWebsiteMachine = /website/i.test(price?.product?.name || '') || price?.product?.metadata?.product === 'website_machine'
  return price?.id === id && price.active === true && price.currency === 'gbp' && price.unit_amount === amount &&
    !price.recurring &&
    typeof price.product === 'object' && price.product.active === true && isWebsiteMachine && !/receptionist/i.test(price.product.name || '')
}

export function createWebsiteMachineCheckoutApi({
  env = process.env,
  fetchImpl = fetch,
  verifyUser,
  isAuthorizedTester = async () => false,
  loadOwnedProject,
  createOrder = async () => ({ id: randomUUID() }),
  saveCheckoutSession = async () => {},
  verifyDomain = verifyDomainChallenge,
  publicUrl = () => env.URL || 'http://localhost:5173',
} = {}) {
  return async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed.' }
    if (Buffer.byteLength(event.body || '') > 20_000) return { statusCode: 413, body: JSON.stringify({ error: 'Request is too large.' }) }
    const liveMode = env.WM_STRIPE_LIVEMODE === 'true'
    if (liveMode || !isStripeTestSecretKey(env.WM_STRIPE_SECRET_KEY) || !env.WM_STRIPE_PRICE_ID) {
      return { statusCode: 503, body: JSON.stringify({ error: 'Website Machine one-off test checkout is not configured.' }) }
    }
    try {
      const token = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
      const user = await verifyUser?.(token)
      if (!user?.id) return { statusCode: 401, body: JSON.stringify({ error: 'A valid Website Machine session is required.' }) }
      let authorizedTester = false
      try {
        authorizedTester = await isAuthorizedTester({ token, user }) === true
      } catch {
        return { statusCode: 503, body: JSON.stringify({ error: 'Staging checkout authorization could not be verified.' }) }
      }
      if (!authorizedTester) return { statusCode: 403, body: JSON.stringify({ error: 'Staging checkout is restricted to approved testers.' }) }
      const body = JSON.parse(event.body || '{}')
      if (!/^[0-9a-f-]{36}$/i.test(body.projectId || '')) return { statusCode: 400, body: JSON.stringify({ error: 'A valid project is required.' }) }
      const requestKey = event.headers?.['idempotency-key'] || event.headers?.['Idempotency-Key'] || body.idempotencyKey || ''
      if (!/^[A-Za-z0-9_-]{12,100}$/.test(requestKey)) return { statusCode: 400, body: JSON.stringify({ error: 'A valid checkout idempotency key is required.' }) }
      if (body.domain || body.domainChallenge) {
        const challengeExpiry = Date.parse(body.domainChallenge?.expiresAt || '')
        if (!body.domain || !body.domainChallenge || body.domainChallenge.domain !== body.domain || challengeExpiry <= Date.now() || challengeExpiry - Date.now() > 60 * 60 * 1000 || !await verifyDomain({ domain: body.domain, token: body.domainChallenge.token })) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Verify the custom domain TXT record before checkout.' }) }
        }
      }
      const project = await loadOwnedProject?.({ token, projectId: body.projectId, ownerId: user.id })
      if (!project || project.owner_id !== user.id) return { statusCode: 404, body: JSON.stringify({ error: 'Project not found.' }) }

      const stripeHeaders = { authorization: `Bearer ${env.WM_STRIPE_SECRET_KEY}` }
      const priceResponse = await fetchImpl(`${API}/prices/${encodeURIComponent(env.WM_STRIPE_PRICE_ID)}?expand%5B%5D=product`, { headers: stripeHeaders })
      if (!priceResponse.ok) return { statusCode: 503, body: JSON.stringify({ error: 'Website Machine Stripe price could not be verified.' }) }
      const price = await priceResponse.json()
      if (!validatePrice(price, { id: env.WM_STRIPE_PRICE_ID, amount: WEBSITE_MACHINE_ONE_OFF_AMOUNT })) {
        return { statusCode: 409, body: JSON.stringify({ error: 'Configured Stripe price does not match the £99 Website Machine one-off offer.' }) }
      }

      const order = await createOrder({ token, project, setupPriceId: price.id, monthlyPriceId: null, domain: body.domain || null, domainChallenge: body.domainChallenge || null, mode: 'test', idempotencyKey: requestKey })
      if (!isId(order?.id)) return { statusCode: 500, body: JSON.stringify({ error: 'Order could not be prepared.' }) }
      const form = new URLSearchParams({
        mode: 'payment',
        customer_creation: 'always',
        'line_items[0][price]': price.id,
        'line_items[0][quantity]': '1',
        client_reference_id: order.id,
        success_url: `${publicUrl()}/website-machine?payment=processing&project_id=${project.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicUrl()}/website-machine?payment=cancelled`,
        'metadata[wm_order_id]': order.id,
        'metadata[wm_project_id]': project.id,
        'metadata[wm_owner_id]': user.id,
      })
      const response = await fetchImpl(`${API}/checkout/sessions`, { method: 'POST', headers: { ...stripeHeaders, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': `wm-order-${order.id}` }, body: form.toString() })
      if (!response.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Stripe could not create checkout.' }) }
      const session = await response.json()
      if (!session.url || session.livemode !== liveMode || session.metadata?.wm_order_id !== order.id) return { statusCode: 502, body: JSON.stringify({ error: 'Stripe returned a checkout in the wrong mode.' }) }
      await saveCheckoutSession({ token, orderId: order.id, sessionId: session.id, url: session.url })
      return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ checkoutUrl: session.url }) }
    } catch (error) {
      if (error?.safeCode === 'WM_TEST_OFFER_INACTIVE') {
        return { statusCode: 409, body: JSON.stringify({ code: error.safeCode, error: error.message }) }
      }
      if (error?.safeCode === 'WM_STAGING_TESTER_REQUIRED') {
        return { statusCode: 403, body: JSON.stringify({ code: error.safeCode, error: error.message }) }
      }
      return { statusCode: 400, body: JSON.stringify({ error: 'Checkout request could not be processed.' }) }
    }
  }
}

export function isPaidWebsiteMachineSession(session, { orderId, projectId, ownerId, setupPriceId, liveMode = false } = {}) {
  if (!session || session.object !== 'checkout.session' || session.status !== 'complete' || session.payment_status !== 'paid' ||
      session.mode !== 'payment' || liveMode || session.livemode !== false || session.currency !== 'gbp' || session.amount_total !== WEBSITE_MACHINE_ONE_OFF_AMOUNT ||
      session.metadata?.wm_order_id !== orderId || session.metadata?.wm_project_id !== projectId || session.metadata?.wm_owner_id !== ownerId) return false
  const rows = session.line_items?.data
  if (!Array.isArray(rows) || rows.length !== 1) return false
  const item = rows[0]
  return Boolean(item.price?.id === setupPriceId && item.quantity === 1 && item.amount_total === WEBSITE_MACHINE_ONE_OFF_AMOUNT && !item.price.recurring)
}

export function createStripeWebsiteMachineWebhook({
  env = process.env,
  fetchImpl = fetch,
  loadOrder,
  confirmPaidOrder,
  publisher,
  recordDeployment,
  claimDeliveryEmail,
  finishDeliveryEmail,
  sendDeliveryEmail,
  now = () => Date.now(),
  logger = console,
} = {}) {
  return async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed.' }
    if (!isStripeTestSecretKey(env.WM_STRIPE_SECRET_KEY) || env.WM_STRIPE_LIVEMODE === 'true' || !env.WM_STRIPE_WEBHOOK_SECRET || typeof loadOrder !== 'function' || typeof confirmPaidOrder !== 'function' || !publisher || typeof recordDeployment !== 'function' || typeof claimDeliveryEmail !== 'function' || typeof finishDeliveryEmail !== 'function' || typeof sendDeliveryEmail !== 'function') {
      return { statusCode: 503, body: 'Website Machine payment fulfillment is not configured.' }
    }
    try {
      const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '', 'utf8')
      if (rawBody.length > 1_000_000) return { statusCode: 413, body: 'Stripe webhook is too large.' }
      const signature = event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'] || ''
      const stripeEvent = verifyStripeWebhookSignature(rawBody, signature, env.WM_STRIPE_WEBHOOK_SECRET, now())
      if (!stripeEvent?.id || stripeEvent.livemode !== (env.WM_STRIPE_LIVEMODE === 'true')) return { statusCode: 400, body: 'Invalid Stripe webhook.' }
      if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(stripeEvent.type)) return { statusCode: 200, body: 'Ignored event.' }

      const notice = stripeEvent.data?.object
      const orderId = notice?.metadata?.wm_order_id
      if (!/^[0-9a-f-]{36}$/i.test(orderId || '')) return { statusCode: 200, body: 'Not a Website Machine order.' }
      const order = await loadOrder({ orderId, mode: stripeEvent.livemode ? 'live' : 'test' })
      if (!order || order.id !== orderId || !order.projectId || !order.ownerId || !order.setupPriceId || order.mode !== 'test') return { statusCode: 404, body: 'Order not found.' }

      const stripeResponse = await fetchImpl(`${API}/checkout/sessions/${encodeURIComponent(notice.id)}?expand%5B%5D=line_items.data.price`, {
        headers: { authorization: `Bearer ${env.WM_STRIPE_SECRET_KEY}` },
      })
      if (!stripeResponse.ok) return { statusCode: 502, body: 'Stripe session verification failed.' }
      const session = await stripeResponse.json()
      if (session.id !== notice.id || session.client_reference_id !== orderId || !isPaidWebsiteMachineSession(session, {
        orderId, projectId: order.projectId, ownerId: order.ownerId,
        setupPriceId: order.setupPriceId, liveMode: false,
      })) {
        // Checkout can complete before a delayed payment settles. Never fulfill on
        // the redirect or on an unpaid `checkout.session.completed` notification.
        if (session.payment_status !== 'paid') return { statusCode: 200, body: 'Payment is not settled; nothing fulfilled.' }
        return { statusCode: 400, body: 'Payment does not match the Website Machine order.' }
      }

      const confirmed = await confirmPaidOrder({ eventId: stripeEvent.id, session, order })
      if (confirmed?.paid !== true) return { statusCode: 409, body: 'Paid order confirmation was not recorded.' }
      const deliverEmail = async (siteUrl) => {
        const recipient = session.customer_details?.email || session.customer_email
        if (!siteUrl || !recipient) throw new Error('Verified website or Checkout email is unavailable.')
        const claim = await claimDeliveryEmail({ orderId: order.id, mode: order.mode })
        if (claim?.status === 'accepted') return 'accepted'
        if (claim?.shouldSend !== true || !claim.attemptId) return claim?.status || 'unknown'
        try {
          const result = await sendDeliveryEmail({ to: recipient, businessName: order.content?.businessName || 'Your business', deliveryUrl: siteUrl, orderId: order.id })
          await finishDeliveryEmail({ orderId: order.id, mode: order.mode, attemptId: claim.attemptId, outcome: 'accepted', messageId: result?.messageId || null })
          return 'accepted'
        } catch (error) {
          const outcome = error?.deliveryOutcome === 'failed' ? 'failed' : 'unknown'
          await finishDeliveryEmail({ orderId: order.id, mode: order.mode, attemptId: claim.attemptId, outcome, errorCode: error?.code || 'DELIVERY_EMAIL_FAILED' })
          if (outcome === 'failed') throw error
          return 'unknown'
        }
      }
      if (confirmed.delivered === true) {
        const siteUrl = confirmed.siteRecord?.siteUrl || order.siteRecord?.siteUrl
        const status = await deliverEmail(siteUrl)
        if (status === 'unknown') return { statusCode: 200, body: 'Website is published; email outcome requires reconciliation.' }
        if (status === 'pending') return { statusCode: 200, body: 'Website is published; email delivery is already in progress.' }
        return { statusCode: 200, body: 'Website is published and delivery email is accepted.' }
      }
      const site = await publisher.publishPaidProject({
        paid: true,
        projectId: order.projectId,
        ownerId: order.ownerId,
        content: order.content,
        domain: order.domain || undefined,
        domainChallenge: order.domainChallenge,
        siteRecord: confirmed.siteRecord || order.siteRecord || null,
      })
      await recordDeployment({ eventId: stripeEvent.id, order, site })
      const status = await deliverEmail(site.url)
      if (status === 'unknown') return { statusCode: 200, body: 'Website is published; email outcome requires reconciliation.' }
      if (status === 'pending') return { statusCode: 200, body: 'Website is published; email delivery is already in progress.' }
      return { statusCode: 200, body: 'Paid Website Machine website published and delivery email accepted.' }
    } catch (error) {
      const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'FULFILLMENT_FAILED'
      const stage = typeof error?.stage === 'string' && /^[a-z0-9_]{1,80}$/.test(error.stage) ? error.stage : 'fulfillment'
      const status = Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599 ? error.status : undefined
      logger.error?.('website_machine_fulfillment_failed', { stage, code, ...(status ? { status } : {}) })
      return { statusCode: 500, body: 'Payment fulfillment failed and can be safely retried.' }
    }
  }
}
