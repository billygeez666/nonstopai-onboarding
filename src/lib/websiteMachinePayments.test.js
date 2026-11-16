import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createStripeWebsiteMachineWebhook, createWebsiteMachineCheckoutApi, isPaidWebsiteMachineSession, paymentRpcSignature, verifyStripeWebhookSignature } from './websiteMachinePayments.js'

const ownerId = 'd3cbfcf4-7cb8-4f63-a20d-73d963a88791'
const projectId = 'c70f3d5f-f910-441a-9b39-8374d1d28532'
const orderId = '6f5f3099-2ec4-4596-a1d1-82891e94ead0'
const setupPriceId = 'price_setup_wm'
const secret = 'whsec_test_' + 'a'.repeat(40)
const apiKey = 'sk_test_' + 'b'.repeat(40)
const baseSession = {
  id: 'cs_test_example', object: 'checkout.session', livemode: false, status: 'complete', payment_status: 'paid',
  mode: 'payment', currency: 'gbp', amount_total: 9900, client_reference_id: orderId,
  customer_details: { email: 'synthetic@example.test' },
  metadata: { wm_order_id: orderId, wm_project_id: projectId, wm_owner_id: ownerId },
  line_items: { data: [{ quantity: 1, amount_total: 9900, price: { id: setupPriceId, recurring: null } }] },
}
const now = Date.parse('2026-11-16T09:00:00Z')

function signedEvent(event, webhookSecret = secret, timestamp = Math.floor(now / 1000)) {
  const raw = Buffer.from(JSON.stringify(event))
  const digest = createHmac('sha256', webhookSecret).update(`${timestamp}.`).update(raw).digest('hex')
  return { raw, signature: `t=${timestamp},v1=${digest}` }
}

test('Stripe webhook verification requires a valid, recent HMAC signature', () => {
  const event = { id: 'evt_test_event', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: baseSession.id } } }
  const { raw, signature } = signedEvent(event)
  assert.equal(verifyStripeWebhookSignature(raw, signature, secret, now).id, event.id)
  assert.equal(verifyStripeWebhookSignature(raw, signature, 'whsec_wrong', now), null)
  assert.equal(verifyStripeWebhookSignature(raw, signature, secret, now + 600_000), null)
  assert.equal(verifyStripeWebhookSignature(Buffer.from('{bad'), signature, secret, now), null)
})

test('internal payment RPC HMAC is deterministic and binds the order to exact event, project, amount, and currency', () => {
  const args = { eventId: 'evt_12345678', sessionId: 'cs_test_12345678', projectId, amount: 24900, currency: 'GBP' }
  const first = paymentRpcSignature(args, 'x'.repeat(32))
  assert.equal(first, paymentRpcSignature({ ...args, currency: 'gbp' }, 'x'.repeat(32)))
  assert.notEqual(first, paymentRpcSignature({ ...args, projectId: ownerId }, 'x'.repeat(32)))
  assert.throws(() => paymentRpcSignature(args, 'weak'), /not configured/)
})

test('fulfillment requires a settled £99 test-mode one-off and exact Website Machine line item', () => {
  const expected = { orderId, projectId, ownerId, setupPriceId, liveMode: false }
  assert.equal(isPaidWebsiteMachineSession(baseSession, expected), true)
  assert.equal(isPaidWebsiteMachineSession({ ...baseSession, payment_status: 'unpaid' }, expected), false)
  assert.equal(isPaidWebsiteMachineSession({ ...baseSession, livemode: true }, expected), false)
  assert.equal(isPaidWebsiteMachineSession({ ...baseSession, amount_total: 24900 }, expected), false)
  assert.equal(isPaidWebsiteMachineSession({ ...baseSession, line_items: { data: [...baseSession.line_items.data, { quantity: 1, amount_total: 15000, price: { id: 'price_extra' } }] } }, expected), false)
  assert.equal(isPaidWebsiteMachineSession({ ...baseSession, mode: 'subscription' }, expected), false)
})

test('checkout rejects existing Stripe products that do not match Website Machine verified prices', async () => {
  const handler = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId },
    verifyUser: async () => ({ id: ownerId }),
    loadOwnedProject: async () => ({ id: projectId, owner_id: ownerId }),
    fetchImpl: async () => ({ ok: true, json: async () => ({ id: setupPriceId, active: true, currency: 'gbp', unit_amount: 19900, recurring: null, product: { active: true, name: 'Website Machine One-off' } }) }),
  })
  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer customer-session' }, body: JSON.stringify({ projectId, idempotencyKey: 'wm-checkout-test-01' }) })
  assert.equal(response.statusCode, 409)
  assert.match(JSON.parse(response.body).error, /£99/)
})

test('checkout rejects live-mode credentials and flags before contacting Stripe or storage', async () => {
  let calls = 0
  const makeHandler = (env) => createWebsiteMachineCheckoutApi({
    env,
    verifyUser: async () => { calls += 1; return { id: ownerId } },
    loadOwnedProject: async () => { calls += 1; return { id: projectId, owner_id: ownerId } },
    fetchImpl: async () => { calls += 1; throw new Error('must reject before external request') },
  })
  const event = { httpMethod: 'POST', body: JSON.stringify({ projectId, idempotencyKey: 'live-checkout-test-001' }) }
  const liveKey = await makeHandler({ WM_STRIPE_SECRET_KEY: 'sk_live_never_use', WM_STRIPE_PRICE_ID: setupPriceId })(event)
  const liveFlag = await makeHandler({ WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId, WM_STRIPE_LIVEMODE: 'true' })(event)
  assert.equal(liveKey.statusCode, 503)
  assert.equal(liveFlag.statusCode, 503)
  assert.equal(calls, 0)
})

test('checkout uses authenticated project ownership and creates Stripe-hosted session with exact prices', async () => {
  const calls = []
  let savedSession
  const handler = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId, URL: 'https://staging.example.net' },
    verifyUser: async (token) => token === 'user-token' ? { id: ownerId } : null,
    loadOwnedProject: async ({ ownerId: requestedOwner }) => requestedOwner === ownerId ? { id: projectId, owner_id: ownerId } : null,
    createOrder: async () => ({ id: orderId }),
    saveCheckoutSession: async (value) => { savedSession = value },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if (url.includes('/prices/')) {
        return { ok: true, json: async () => ({ id: setupPriceId, active: true, currency: 'gbp', unit_amount: 9900, recurring: null, product: { active: true, name: 'Website Machine One-off' } }) }
      }
      const params = new URLSearchParams(options.body)
      return { ok: true, json: async () => ({ id: 'cs_test_12345678', url: 'https://checkout.stripe.test/session', livemode: false, metadata: { wm_order_id: params.get('metadata[wm_order_id]') } }) }
    },
  })
  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer user-token' }, body: JSON.stringify({ projectId, idempotencyKey: 'wm-checkout-test-02' }) })
  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(response.body).checkoutUrl, 'https://checkout.stripe.test/session')
  assert.equal(savedSession.sessionId, 'cs_test_12345678')
  const checkout = new URLSearchParams(calls[1].options.body)
  assert.equal(checkout.get('line_items[0][price]'), setupPriceId)
  assert.equal(checkout.get('mode'), 'payment')
  assert.equal(checkout.get('line_items[0][price]'), setupPriceId)
  assert.equal(checkout.has('line_items[1][price]'), false)
  assert.equal([...checkout.keys()].some((key) => key.startsWith('subscription_data')), false)
  assert.equal(checkout.get('metadata[wm_project_id]'), projectId)
  assert.equal(checkout.get('success_url').includes('{CHECKOUT_SESSION_ID}'), true)
  assert.equal(calls[1].options.headers.authorization, `Bearer ${apiKey}`)
})

test('Stripe webhook does not fulfill unpaid sessions and only publishes once confirmed by durable storage', async () => {
  const stripeEvent = { id: 'evt_test_paid_1234', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: baseSession.id, metadata: baseSession.metadata } } }
  const { raw, signature } = signedEvent(stripeEvent)
  let paid = false
  let publishCalls = 0
  const publisher = { publishPaidProject: async (input) => { publishCalls += 1; assert.equal(input.paid, true); return { siteId: 'netlify-site-123', deployId: '0123456789abcdef' } } }
  const handler = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret, WM_STRIPE_LIVEMODE: 'false' },
    now: () => now,
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: {} }),
    confirmPaidOrder: async () => { paid = true; return { paid: true } },
    publisher,
    sendDeliveryEmail: async () => {},
    recordDeployment: async () => {},
    fetchImpl: async () => ({ ok: true, json: async () => ({ ...baseSession, payment_status: 'unpaid' }) }),
  })
  let response = await handler({ httpMethod: 'POST', body: raw.toString(), headers: { 'stripe-signature': signature } })
  assert.equal(response.statusCode, 200)
  assert.equal(paid, false)
  assert.equal(publishCalls, 0)

  const paidHandler = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret },
    now: () => now,
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: { businessName: 'Northstar' } }),
    confirmPaidOrder: async () => ({ paid: true }),
    recordDeployment: async () => {},
    sendDeliveryEmail: async ({ to, deliveryUrl }) => { assert.equal(to, 'synthetic@example.test'); assert.equal(deliveryUrl, 'https://northstar.netlify.app') },
    publisher: { publishPaidProject: async (input) => { publishCalls += 1; assert.equal(input.paid, true); return { siteId: 'netlify-site-123', deployId: '0123456789abcdef', url: 'https://northstar.netlify.app' } } },
    fetchImpl: async () => ({ ok: true, json: async () => baseSession }),
  })
  response = await paidHandler({ httpMethod: 'POST', body: raw.toString(), headers: { 'stripe-signature': signature } })
  assert.equal(response.statusCode, 200)
  assert.equal(publishCalls, 1)
})

test('synthetic £99 purchase flows from Checkout through signed fulfillment, isolated publish, and delivery email', async () => {
  let checkoutSession
  const checkout = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId, URL: 'https://bendarus.netlify.app' },
    verifyUser: async () => ({ id: ownerId }),
    loadOwnedProject: async () => ({ id: projectId, owner_id: ownerId }),
    createOrder: async () => ({ id: orderId }),
    saveCheckoutSession: async () => {},
    fetchImpl: async (url, options = {}) => {
      if (url.includes('/prices/')) return { ok: true, json: async () => ({ id: setupPriceId, active: true, currency: 'gbp', unit_amount: 9900, recurring: null, product: { active: true, name: 'Website Machine One-off' } }) }
      const body = new URLSearchParams(options.body)
      checkoutSession = { ...baseSession, id: 'cs_test_purchase_123', client_reference_id: orderId, metadata: { wm_order_id: body.get('metadata[wm_order_id]'), wm_project_id: body.get('metadata[wm_project_id]'), wm_owner_id: body.get('metadata[wm_owner_id]') } }
      return { ok: true, json: async () => ({ id: checkoutSession.id, url: 'https://checkout.stripe.test/session', livemode: false, metadata: checkoutSession.metadata }) }
    },
  })
  const checkoutResponse = await checkout({ httpMethod: 'POST', headers: { authorization: 'Bearer synthetic-user' }, body: JSON.stringify({ projectId, idempotencyKey: 'synthetic-checkout-001' }) })
  assert.equal(checkoutResponse.statusCode, 200)
  assert.equal(checkoutSession.mode, 'payment')
  const event = { id: 'evt_synthetic_purchase', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: checkoutSession.id, metadata: checkoutSession.metadata } } }
  const signed = signedEvent(event)
  const actions = []
  const webhook = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret, WM_STRIPE_LIVEMODE: 'false' },
    now: () => now,
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: { businessName: 'Northstar Motor Works' } }),
    confirmPaidOrder: async ({ session }) => { assert.equal(session.amount_total, 9900); actions.push('paid'); return { paid: true } },
    publisher: { publishPaidProject: async ({ paid }) => { assert.equal(paid, true); actions.push('published'); return { siteId: 'wm-site-synthetic', deployId: '0123456789abcdef', url: 'https://northstar-motor-works.netlify.app' } } },
    recordDeployment: async () => { actions.push('recorded') },
    sendDeliveryEmail: async ({ to, deliveryUrl }) => { assert.equal(to, 'synthetic@example.test'); assert.equal(deliveryUrl, 'https://northstar-motor-works.netlify.app'); actions.push('emailed') },
    fetchImpl: async () => ({ ok: true, json: async () => checkoutSession }),
  })
  const delivered = await webhook({ httpMethod: 'POST', body: signed.raw.toString(), headers: { 'stripe-signature': signed.signature } })
  assert.equal(delivered.statusCode, 200)
  assert.deepEqual(actions, ['paid', 'published', 'recorded', 'emailed'])
})

test('bad Stripe signature never calls the database or publisher', async () => {
  let calls = 0
  const handler = createStripeWebsiteMachineWebhook({ env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret }, loadOrder: async () => { calls += 1 }, confirmPaidOrder: async () => {}, publisher: {}, recordDeployment: async () => {}, sendDeliveryEmail: async () => {} })
  const response = await handler({ httpMethod: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=bad' } })
  assert.equal(response.statusCode, 400)
  assert.equal(calls, 0)
})
