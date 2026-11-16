import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createStripeWebsiteMachineWebhook, createWebsiteMachineCheckoutApi, isPaidWebsiteMachineSession, paymentRpcSignature, verifyStripeWebhookSignature } from './websiteMachinePayments.js'

const ownerId = 'd3cbfcf4-7cb8-4f63-a20d-73d963a88791'
const projectId = 'c70f3d5f-f910-441a-9b39-8374d1d28532'
const orderId = '6f5f3099-2ec4-4596-a1d1-82891e94ead0'
const setupPriceId = 'price_setup_wm'
const monthlyPriceId = 'price_monthly_wm'
const secret = 'whsec_test_' + 'a'.repeat(40)
const apiKey = 'sk_test_' + 'b'.repeat(40)
const baseSession = {
  id: 'cs_test_example', object: 'checkout.session', livemode: false, status: 'complete', payment_status: 'paid',
  mode: 'subscription', currency: 'gbp', amount_total: 24900, client_reference_id: orderId,
  metadata: { wm_order_id: orderId, wm_project_id: projectId, wm_owner_id: ownerId },
  line_items: { data: [
    { quantity: 1, amount_total: 19900, price: { id: setupPriceId } },
    { quantity: 1, amount_total: 5000, price: { id: monthlyPriceId, recurring: { interval: 'month', interval_count: 1 } } },
  ] },
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

test('fulfillment requires a settled matching test-mode session and exact Website Machine line items', () => {
  const expected = { orderId, projectId, ownerId, setupPriceId, monthlyPriceId, liveMode: false }
  assert.equal(isPaidWebsiteMachineSession(baseSession, expected), true)
  assert.equal(isPaidWebsiteMachineSession({ ...baseSession, payment_status: 'unpaid' }, expected), false)
  assert.equal(isPaidWebsiteMachineSession({ ...baseSession, livemode: true }, expected), false)
  assert.equal(isPaidWebsiteMachineSession({ ...baseSession, amount_total: 9900 }, expected), false)
  assert.equal(isPaidWebsiteMachineSession({ ...baseSession, line_items: { data: [{ ...baseSession.line_items.data[0] }] } }, expected), false)
})

test('checkout rejects existing Stripe products that do not match Website Machine verified prices', async () => {
  const handler = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_SETUP_PRICE_ID: setupPriceId, WM_STRIPE_MONTHLY_PRICE_ID: monthlyPriceId },
    verifyUser: async () => ({ id: ownerId }),
    loadOwnedProject: async () => ({ id: projectId, owner_id: ownerId }),
    fetchImpl: async (url) => ({ ok: true, json: async () => ({ id: url.includes('setup') ? setupPriceId : monthlyPriceId, active: true, currency: 'gbp', unit_amount: url.includes('setup') ? 29900 : 9900, recurring: url.includes('setup') ? null : { interval: 'month', interval_count: 1 }, product: { active: true, name: url.includes('setup') ? 'NonStop AI Setup' : 'NonStop AI Receptionist' } }) }),
  })
  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer customer-session' }, body: JSON.stringify({ projectId, idempotencyKey: 'wm-checkout-test-01' }) })
  assert.equal(response.statusCode, 409)
  assert.match(JSON.parse(response.body).error, /do not match/)
})

test('checkout uses authenticated project ownership and creates Stripe-hosted session with exact prices', async () => {
  const calls = []
  let savedSession
  const handler = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_SETUP_PRICE_ID: setupPriceId, WM_STRIPE_MONTHLY_PRICE_ID: monthlyPriceId, URL: 'https://staging.example.net' },
    verifyUser: async (token) => token === 'user-token' ? { id: ownerId } : null,
    loadOwnedProject: async ({ ownerId: requestedOwner }) => requestedOwner === ownerId ? { id: projectId, owner_id: ownerId } : null,
    createOrder: async () => ({ id: orderId }),
    saveCheckoutSession: async (value) => { savedSession = value },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if (url.includes('/prices/')) {
        const setup = url.includes(setupPriceId)
        return { ok: true, json: async () => ({ id: setup ? setupPriceId : monthlyPriceId, active: true, currency: 'gbp', unit_amount: setup ? 19900 : 5000, recurring: setup ? null : { interval: 'month', interval_count: 1 }, product: { active: true, name: setup ? 'Website Machine Growth Setup' : 'Website Machine Growth' } }) }
      }
      const params = new URLSearchParams(options.body)
      return { ok: true, json: async () => ({ id: 'cs_test_12345678', url: 'https://checkout.stripe.test/session', livemode: false, metadata: { wm_order_id: params.get('metadata[wm_order_id]') } }) }
    },
  })
  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer user-token' }, body: JSON.stringify({ projectId, idempotencyKey: 'wm-checkout-test-02' }) })
  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(response.body).checkoutUrl, 'https://checkout.stripe.test/session')
  assert.equal(savedSession.sessionId, 'cs_test_12345678')
  const checkout = new URLSearchParams(calls[2].options.body)
  assert.equal(checkout.get('line_items[0][price]'), setupPriceId)
  assert.equal(checkout.get('line_items[1][price]'), monthlyPriceId)
  assert.equal(checkout.get('metadata[wm_project_id]'), projectId)
  assert.equal(checkout.get('success_url').includes('{CHECKOUT_SESSION_ID}'), true)
  assert.equal(calls[2].options.headers.authorization, `Bearer ${apiKey}`)
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
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, monthlyPriceId, content: {} }),
    confirmPaidOrder: async () => { paid = true; return { paid: true } },
    publisher,
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
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, monthlyPriceId, content: {} }),
    confirmPaidOrder: async () => ({ paid: true }),
    publisher,
    recordDeployment: async () => {},
    fetchImpl: async () => ({ ok: true, json: async () => baseSession }),
  })
  response = await paidHandler({ httpMethod: 'POST', body: raw.toString(), headers: { 'stripe-signature': signature } })
  assert.equal(response.statusCode, 200)
  assert.equal(publishCalls, 1)
})

test('bad Stripe signature never calls the database or publisher', async () => {
  let calls = 0
  const handler = createStripeWebsiteMachineWebhook({ env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret }, loadOrder: async () => { calls += 1 }, confirmPaidOrder: async () => {}, publisher: {} })
  const response = await handler({ httpMethod: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=bad' } })
  assert.equal(response.statusCode, 400)
  assert.equal(calls, 0)
})
