import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { verifyDomainChallenge } from './websiteMachinePublishing.js'

const API = 'https://api.stripe.com/v1'
const WEBSITE_MACHINE_ONE_OFF_AMOUNT = 9900
const isId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{8,120}$/.test(value)
export const isStripeTestSecretKey = (value) => typeof value === 'string' && (value.startsWith('sk_test_') || value.startsWith('rk_test_'))
export const isStripeLiveSecretKey = (value) => typeof value === 'string' && (value.startsWith('sk_live_') || value.startsWith('rk_live_'))

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

function validatePrice(price, { id, amount, liveMode = false }) {
  const isWebsiteMachine = /website/i.test(price?.product?.name || '') || price?.product?.metadata?.product === 'website_machine'
  return price?.id === id && price.active === true && price.currency === 'gbp' && price.unit_amount === amount &&
    price.livemode === liveMode && !price.recurring &&
    typeof price.product === 'object' && price.product.active === true && isWebsiteMachine && !/receptionist/i.test(price.product.name || '')
}

function safeLogValue(value, pattern) {
  return typeof value === 'string' && pattern.test(value) ? value : undefined
}

function safeErrorType(error) {
  const candidate = error && typeof error === 'object' ? error.name || error.constructor?.name : ''
  return typeof candidate === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(candidate)
    ? candidate
    : 'NonErrorThrow'
}

function stageForOperation(operation) {
  if (operation.startsWith('supabase_')) return 'supabase'
  if (operation.startsWith('stripe_')) return 'stripe_verification'
  if (operation.startsWith('netlify_')) return 'netlify_publish'
  if (operation.startsWith('resend_')) return 'resend_email'
  return 'fulfillment'
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
    const keyMatchesMode = liveMode ? isStripeLiveSecretKey(env.WM_STRIPE_SECRET_KEY) : isStripeTestSecretKey(env.WM_STRIPE_SECRET_KEY)
    if (!keyMatchesMode || !env.WM_STRIPE_PRICE_ID) {
      return { statusCode: 503, body: JSON.stringify({ error: `Website Machine ${liveMode ? 'live' : 'test'} checkout is not configured.` }) }
    }
    try {
      const token = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
      const user = await verifyUser?.(token)
      if (!user?.id) return { statusCode: 401, body: JSON.stringify({ error: 'A valid Website Machine session is required.' }) }
      if (!liveMode) {
        let authorizedTester = false
        try {
          authorizedTester = await isAuthorizedTester({ token, user }) === true
        } catch {
          return { statusCode: 503, body: JSON.stringify({ error: 'Staging checkout authorization could not be verified.' }) }
        }
        if (!authorizedTester) return { statusCode: 403, body: JSON.stringify({ error: 'Staging checkout is restricted to approved testers.' }) }
      }
      const body = JSON.parse(event.body || '{}')
      if (!/^[0-9a-f-]{36}$/i.test(body.projectId || '')) return { statusCode: 400, body: JSON.stringify({ error: 'A valid project is required.' }) }
      if (body.domain || body.domainChallenge) {
        const challengeExpiry = Date.parse(body.domainChallenge?.expiresAt || '')
        if (!body.domain || !body.domainChallenge || body.domainChallenge.domain !== body.domain || challengeExpiry <= Date.now() || challengeExpiry - Date.now() > 60 * 60 * 1000 || !await verifyDomain({ domain: body.domain, token: body.domainChallenge.token })) {
          return { statusCode: 400, body: JSON.stringify({ error: 'Verify the custom domain TXT record before checkout.' }) }
        }
      }
      const project = await loadOwnedProject?.({ token, projectId: body.projectId, ownerId: user.id })
      if (!project || project.owner_id !== user.id) return { statusCode: 404, body: JSON.stringify({ error: 'Project not found.' }) }

      // One paid website order is allowed per authenticated project. Derive
      // the key on the server so retries, reloads, and parallel tabs cannot
      // create fresh orders by supplying a new client-generated value.
      const requestKey = `wm-project-${user.id}-${project.id}`

      const stripeHeaders = { authorization: `Bearer ${env.WM_STRIPE_SECRET_KEY}` }
      const priceResponse = await fetchImpl(`${API}/prices/${encodeURIComponent(env.WM_STRIPE_PRICE_ID)}?expand%5B%5D=product`, { headers: stripeHeaders })
      if (!priceResponse.ok) return { statusCode: 503, body: JSON.stringify({ error: 'Website Machine Stripe price could not be verified.' }) }
      const price = await priceResponse.json()
      if (!validatePrice(price, { id: env.WM_STRIPE_PRICE_ID, amount: WEBSITE_MACHINE_ONE_OFF_AMOUNT, liveMode })) {
        return { statusCode: 409, body: JSON.stringify({ error: 'Configured Stripe price does not match the £99 Website Machine one-off offer.' }) }
      }

      const mode = liveMode ? 'live' : 'test'
      const order = await createOrder({ token, project, setupPriceId: price.id, monthlyPriceId: null, domain: body.domain || null, domainChallenge: body.domainChallenge || null, mode, idempotencyKey: requestKey })
      if (!isId(order?.id)) return { statusCode: 500, body: JSON.stringify({ error: 'Order could not be prepared.' }) }
      if (order.status && order.status !== 'pending') {
        return { statusCode: 409, body: JSON.stringify({ error: 'This project already has a paid or completed Website Machine order.' }) }
      }
      const existingCheckoutSessionId = order.checkoutSessionId || order.checkout_session_id
      if (existingCheckoutSessionId) {
        const existingResponse = await fetchImpl(`${API}/checkout/sessions/${encodeURIComponent(existingCheckoutSessionId)}`, { headers: stripeHeaders })
        if (!existingResponse.ok) return { statusCode: 503, body: JSON.stringify({ error: 'The existing checkout could not be verified. Contact support before trying again.' }) }
        const existing = await existingResponse.json()
        const matchesOrder = existing?.id === existingCheckoutSessionId && existing?.livemode === liveMode &&
          existing?.mode === 'payment' && existing?.currency === 'gbp' && existing?.amount_total === WEBSITE_MACHINE_ONE_OFF_AMOUNT &&
          existing?.client_reference_id === order.id && existing?.metadata?.wm_order_id === order.id &&
          existing?.metadata?.wm_project_id === project.id && existing?.metadata?.wm_owner_id === user.id
        if (!matchesOrder) return { statusCode: 409, body: JSON.stringify({ error: 'The existing checkout does not match this project. Contact support before trying again.' }) }
        if (existing.status === 'open' && typeof existing.url === 'string') {
          return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ checkoutUrl: existing.url }) }
        }
        return { statusCode: 409, body: JSON.stringify({ error: 'This project already has a completed or expired checkout. Contact support before trying again.' }) }
      }
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
      if (error?.safeCode === 'WM_LIVE_OFFER_INACTIVE') {
        return { statusCode: 409, body: JSON.stringify({ code: error.safeCode, error: error.message }) }
      }
      return { statusCode: 400, body: JSON.stringify({ error: 'Checkout request could not be processed.' }) }
    }
  }
}

export function isPaidWebsiteMachineSession(session, { orderId, projectId, ownerId, setupPriceId, liveMode = false } = {}) {
  if (!session || session.object !== 'checkout.session' || session.status !== 'complete' || session.payment_status !== 'paid' ||
      session.mode !== 'payment' || session.livemode !== liveMode || session.currency !== 'gbp' || session.amount_total !== WEBSITE_MACHINE_ONE_OFF_AMOUNT ||
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
    const liveMode = env.WM_STRIPE_LIVEMODE === 'true'
    const keyMatchesMode = liveMode ? isStripeLiveSecretKey(env.WM_STRIPE_SECRET_KEY) : isStripeTestSecretKey(env.WM_STRIPE_SECRET_KEY)
    if (!keyMatchesMode || !env.WM_STRIPE_WEBHOOK_SECRET || typeof loadOrder !== 'function' || typeof confirmPaidOrder !== 'function' || !publisher || typeof recordDeployment !== 'function' || typeof claimDeliveryEmail !== 'function' || typeof finishDeliveryEmail !== 'function' || typeof sendDeliveryEmail !== 'function') {
      return { statusCode: 503, body: 'Website Machine payment fulfillment is not configured.' }
    }
    let operation = 'webhook_validation'
    let stripeEvent
    let orderId
    const runOperation = async (name, action) => {
      operation = name
      try {
        return await action()
      } catch (error) {
        if (error && typeof error === 'object') {
          try {
            if (!error.websiteMachineOperation) error.websiteMachineOperation = name
          } catch {}
        }
        throw error
      }
    }

    try {
      const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '', 'utf8')
      if (rawBody.length > 1_000_000) return { statusCode: 413, body: 'Stripe webhook is too large.' }
      const signature = event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'] || ''
      stripeEvent = verifyStripeWebhookSignature(rawBody, signature, env.WM_STRIPE_WEBHOOK_SECRET, now())
      if (!stripeEvent?.id || stripeEvent.livemode !== (env.WM_STRIPE_LIVEMODE === 'true')) return { statusCode: 400, body: 'Invalid Stripe webhook.' }
      if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(stripeEvent.type)) return { statusCode: 200, body: 'Ignored event.' }

      const notice = stripeEvent.data?.object
      orderId = notice?.metadata?.wm_order_id
      if (!/^[0-9a-f-]{36}$/i.test(orderId || '')) return { statusCode: 200, body: 'Not a Website Machine order.' }
      const order = await runOperation('supabase_load_payment_order', () => loadOrder({ orderId, mode: stripeEvent.livemode ? 'live' : 'test' }))
      const mode = liveMode ? 'live' : 'test'
      if (!order || order.id !== orderId || !order.projectId || !order.ownerId || !order.setupPriceId || order.mode !== mode) return { statusCode: 404, body: 'Order not found.' }

      const stripeResponse = await runOperation('stripe_retrieve_checkout_session', () => fetchImpl(`${API}/checkout/sessions/${encodeURIComponent(notice.id)}?expand%5B%5D=line_items.data.price`, {
        headers: { authorization: `Bearer ${env.WM_STRIPE_SECRET_KEY}` },
      }))
      if (!stripeResponse.ok) return { statusCode: 502, body: 'Stripe session verification failed.' }
      const session = await runOperation('stripe_parse_checkout_session', () => stripeResponse.json())
      if (session.id !== notice.id || session.client_reference_id !== orderId || !isPaidWebsiteMachineSession(session, {
        orderId, projectId: order.projectId, ownerId: order.ownerId,
        setupPriceId: order.setupPriceId, liveMode,
      })) {
        // Checkout can complete before a delayed payment settles. Never fulfill on
        // the redirect or on an unpaid `checkout.session.completed` notification.
        if (session.payment_status !== 'paid') return { statusCode: 200, body: 'Payment is not settled; nothing fulfilled.' }
        return { statusCode: 400, body: 'Payment does not match the Website Machine order.' }
      }

      const confirmed = await runOperation('supabase_confirm_paid_order', () => confirmPaidOrder({ eventId: stripeEvent.id, session, order }))
      if (confirmed?.paid !== true) return { statusCode: 409, body: 'Paid order confirmation was not recorded.' }
      const deliverEmail = async (siteUrl) => {
        const recipient = session.customer_details?.email || session.customer_email
        if (!siteUrl || !recipient) throw new Error('Verified website or Checkout email is unavailable.')
        const claim = await runOperation('supabase_claim_delivery_email', () => claimDeliveryEmail({ orderId: order.id, mode: order.mode }))
        if (claim?.status === 'accepted') return 'accepted'
        if (claim?.shouldSend !== true || !claim.attemptId) return claim?.status || 'unknown'
        try {
          const result = await runOperation('resend_send_delivery_email', () => sendDeliveryEmail({ to: recipient, businessName: order.content?.businessName || 'Your business', deliveryUrl: siteUrl, orderId: order.id }))
          await runOperation('supabase_record_email_acceptance', () => finishDeliveryEmail({ orderId: order.id, mode: order.mode, attemptId: claim.attemptId, outcome: 'accepted', messageId: result?.messageId || null }))
          return 'accepted'
        } catch (error) {
          const outcome = error?.deliveryOutcome === 'failed' ? 'failed' : 'unknown'
          await runOperation(`supabase_record_email_${outcome}`, () => finishDeliveryEmail({ orderId: order.id, mode: order.mode, attemptId: claim.attemptId, outcome, errorCode: error?.code || 'DELIVERY_EMAIL_FAILED' }))
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
      const site = await runOperation('netlify_publish_paid_project', () => publisher.publishPaidProject({
        paid: true,
        projectId: order.projectId,
        ownerId: order.ownerId,
        content: order.content,
        domain: order.domain || undefined,
        domainChallenge: order.domainChallenge,
        siteRecord: confirmed.siteRecord || order.siteRecord || null,
      }))
      await runOperation('supabase_record_customer_deployment', () => recordDeployment({ eventId: stripeEvent.id, order, site }))
      const status = await deliverEmail(site.url)
      if (status === 'unknown') return { statusCode: 200, body: 'Website is published; email outcome requires reconciliation.' }
      if (status === 'pending') return { statusCode: 200, body: 'Website is published; email delivery is already in progress.' }
      return { statusCode: 200, body: 'Paid Website Machine website published and delivery email accepted.' }
    } catch (error) {
      const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'FULFILLMENT_FAILED'
      const stage = typeof error?.stage === 'string' && /^[a-z0-9_]{1,80}$/.test(error.stage) ? error.stage : 'fulfillment'
      const statusValue = Number.isInteger(error?.status) ? error.status : error?.statusCode
      const status = Number.isInteger(statusValue) && statusValue >= 100 && statusValue <= 599 ? statusValue : undefined
      const databaseCode = safeLogValue(error?.databaseCode, /^[A-Z0-9]{5}$/)
      const operationName = safeLogValue(error?.websiteMachineOperation, /^[a-z0-9_]{1,80}$/) || operation
      const netlifyErrorCode = safeLogValue(error?.netlifyErrorCode, /^[A-Z0-9_]{1,80}$/)
      const netlifyRequestId = safeLogValue(error?.netlifyRequestId, /^[A-Za-z0-9_-]{6,80}$/)
      const effectiveStage = stage === 'fulfillment' ? stageForOperation(operationName) : stage
      const requestId = safeLogValue(
        event.headers?.['x-nf-request-id'] || event.headers?.['X-Nf-Request-Id'] || event.headers?.['x-netlify-request-id'],
        /^[A-Za-z0-9_-]{6,80}$/,
      )
      const eventId = safeLogValue(stripeEvent?.id, /^evt_[A-Za-z0-9_]{8,120}$/)
      const safeOrderId = safeLogValue(orderId, /^[0-9a-f-]{36}$/i)
      try {
        logger.error?.('website_machine_fulfillment_failed', {
          stage: effectiveStage,
          operation: operationName,
          errorType: safeErrorType(error),
          code,
          ...(status ? { status } : {}),
          ...(databaseCode ? { databaseCode } : {}),
          ...(netlifyErrorCode ? { upstreamCode: netlifyErrorCode } : {}),
          ...(netlifyRequestId ? { netlifyRequestId } : {}),
          ...(requestId ? { requestId } : {}),
          ...(eventId ? { stripeEventId: eventId } : {}),
          ...(safeOrderId ? { orderId: safeOrderId } : {}),
        })
      } catch {}
      return { statusCode: 500, body: 'Payment fulfillment failed and can be safely retried.' }
    }
  }
}
