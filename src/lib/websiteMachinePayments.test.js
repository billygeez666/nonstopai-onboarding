import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createStripeWebsiteMachineWebhook, createWebsiteMachineCheckoutApi, isPaidWebsiteMachineSession, isStripeLiveSecretKey, isStripeTestSecretKey, paymentRpcSignature, verifyStripeWebhookSignature } from './websiteMachinePayments.js'
import { createWebsiteMachineDeliveryEmail } from './websiteMachineEmail.js'

const ownerId = 'd3cbfcf4-7cb8-4f63-a20d-73d963a88791'
const projectId = 'c70f3d5f-f910-441a-9b39-8374d1d28532'
const orderId = '6f5f3099-2ec4-4596-a1d1-82891e94ead0'
const setupPriceId = 'price_setup_wm'
const secret = 'whsec_test_' + 'a'.repeat(40)
const apiKey = 'sk_test_' + 'b'.repeat(40)
const liveApiKey = 'sk_live_' + 'c'.repeat(40)
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

function deliveryStore() {
  let status = null
  let attemptCount = 0
  let attemptId
  return {
    claim: async () => {
      if (status === 'accepted' || status === 'unknown' || status === 'pending') return { status, shouldSend: false }
      status = 'pending'
      attemptId = `attempt-${++attemptCount}`
      return { status, shouldSend: true, attemptId }
    },
    finish: async ({ attemptId: submittedAttempt, outcome }) => {
      if (submittedAttempt !== attemptId || !['pending', 'unknown'].includes(status)) return false
      status = outcome
      return true
    },
    get status() { return status },
    get attempts() { return attemptCount },
  }
}

function emailState(store = deliveryStore()) {
  return { store, claimDeliveryEmail: store.claim, finishDeliveryEmail: store.finish }
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
    isAuthorizedTester: async () => true,
    loadOwnedProject: async () => ({ id: projectId, owner_id: ownerId }),
    fetchImpl: async () => ({ ok: true, json: async () => ({ id: setupPriceId, livemode: false, active: true, currency: 'gbp', unit_amount: 19900, recurring: null, product: { active: true, name: 'Website Machine One-off' } }) }),
  })
  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer customer-session' }, body: JSON.stringify({ projectId, idempotencyKey: 'wm-checkout-test-01' }) })
  assert.equal(response.statusCode, 409)
  assert.match(JSON.parse(response.body).error, /£99/)
})

test('checkout rejects credentials that do not match the configured Stripe mode', async () => {
  let calls = 0
  const makeHandler = (env) => createWebsiteMachineCheckoutApi({
    env,
    verifyUser: async () => { calls += 1; return { id: ownerId } },
    loadOwnedProject: async () => { calls += 1; return { id: projectId, owner_id: ownerId } },
    fetchImpl: async () => { calls += 1; throw new Error('must reject before external request') },
  })
  const event = { httpMethod: 'POST', body: JSON.stringify({ projectId, idempotencyKey: 'live-checkout-test-001' }) }
  const missingLiveKey = await makeHandler({ WM_STRIPE_PRICE_ID: setupPriceId, WM_STRIPE_LIVEMODE: 'true' })(event)
  const testKeyWithLiveFlag = await makeHandler({ WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId, WM_STRIPE_LIVEMODE: 'true' })(event)
  assert.equal(missingLiveKey.statusCode, 503)
  assert.equal(testKeyWithLiveFlag.statusCode, 503)
  assert.equal(calls, 0)
})

test('restricted Stripe test keys are accepted while live restricted keys are rejected', async () => {
  assert.equal(isStripeTestSecretKey('rk_test_restricted_fixture'), true)
  assert.equal(isStripeTestSecretKey('sk_test_fixture'), true)
  assert.equal(isStripeTestSecretKey('rk_live_fixture'), false)
  assert.equal(isStripeTestSecretKey('sk_live_fixture'), false)
  assert.equal(isStripeLiveSecretKey('rk_live_fixture'), true)
  assert.equal(isStripeLiveSecretKey('sk_live_fixture'), true)
  assert.equal(isStripeLiveSecretKey('sk_test_fixture'), false)
  let externalCalls = 0
  const checkout = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: 'rk_test_restricted_fixture', WM_STRIPE_PRICE_ID: setupPriceId },
    fetchImpl: async () => { externalCalls += 1; throw new Error('authentication must stop before Stripe') },
  })
  const response = await checkout({ httpMethod: 'POST', headers: {}, body: '{}' })
  assert.equal(response.statusCode, 401)
  assert.equal(externalCalls, 0)
})

test('live checkout uses only verified live £99 price and binds a live order without staging allowlist', async () => {
  const calls = []
  let created
  const handler = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: liveApiKey, WM_STRIPE_PRICE_ID: 'price_live_fixture', WM_STRIPE_LIVEMODE: 'true', URL: 'https://example.test' },
    verifyUser: async () => ({ id: ownerId }),
    isAuthorizedTester: async () => { throw new Error('staging allowlist must not run in live mode') },
    loadOwnedProject: async () => ({ id: projectId, owner_id: ownerId }),
    createOrder: async (input) => { created = input; return { id: orderId, status: 'pending' } },
    saveCheckoutSession: async () => {},
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if (url.includes('/prices/')) return { ok: true, json: async () => ({ id: 'price_live_fixture', livemode: true, active: true, currency: 'gbp', unit_amount: 9900, recurring: null, product: { active: true, name: 'Website Machine Starter' } }) }
      const form = new URLSearchParams(options.body)
      return { ok: true, json: async () => ({ id: 'cs_live_12345678', url: 'https://checkout.stripe.com/live', livemode: true, metadata: { wm_order_id: form.get('metadata[wm_order_id]') } }) }
    },
  })
  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer session' }, body: JSON.stringify({ projectId }) })
  assert.equal(response.statusCode, 200)
  assert.equal(created.mode, 'live')
  assert.equal(created.setupPriceId, 'price_live_fixture')
  assert.equal(JSON.parse(response.body).checkoutUrl, 'https://checkout.stripe.com/live')
  assert.equal(calls.every(({ options }) => options.headers.authorization === `Bearer ${liveApiKey}`), true)
})

test('staging checkout denies users outside the tester allowlist before project, Stripe, or order access', async () => {
  let downstreamCalls = 0
  const checkout = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId },
    verifyUser: async () => ({ id: ownerId }),
    isAuthorizedTester: async () => false,
    loadOwnedProject: async () => { downstreamCalls += 1; return { id: projectId, owner_id: ownerId } },
    createOrder: async () => { downstreamCalls += 1; return { id: orderId } },
    fetchImpl: async () => { downstreamCalls += 1; throw new Error('unauthorized tester must not contact Stripe') },
  })
  const response = await checkout({ httpMethod: 'POST', headers: { authorization: 'Bearer customer-session' }, body: JSON.stringify({ projectId, idempotencyKey: 'wm-checkout-allowlist-01' }) })
  assert.equal(response.statusCode, 403)
  assert.match(JSON.parse(response.body).error, /approved testers/)
  assert.equal(downstreamCalls, 0)
})

test('staging checkout fails closed when tester authorization is unavailable', async () => {
  let downstreamCalls = 0
  const checkout = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId },
    verifyUser: async () => ({ id: ownerId }),
    isAuthorizedTester: async () => { throw new Error('database unavailable') },
    loadOwnedProject: async () => { downstreamCalls += 1; return { id: projectId, owner_id: ownerId } },
    fetchImpl: async () => { downstreamCalls += 1; throw new Error('must remain unreachable') },
  })
  const response = await checkout({ httpMethod: 'POST', headers: { authorization: 'Bearer customer-session' }, body: JSON.stringify({ projectId, idempotencyKey: 'wm-checkout-allowlist-02' }) })
  assert.equal(response.statusCode, 503)
  assert.equal(downstreamCalls, 0)
})

test('checkout uses authenticated project ownership and creates Stripe-hosted session with exact prices', async () => {
  const calls = []
  let savedSession
  let savedOrderRequest
  const handler = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId, URL: 'https://staging.example.net' },
    verifyUser: async (token) => token === 'user-token' ? { id: ownerId } : null,
    isAuthorizedTester: async ({ user }) => user.id === ownerId,
    loadOwnedProject: async ({ ownerId: requestedOwner }) => requestedOwner === ownerId ? { id: projectId, owner_id: ownerId } : null,
    createOrder: async (value) => { savedOrderRequest = value; return { id: orderId, status: 'pending' } },
    saveCheckoutSession: async (value) => { savedSession = value },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if (url.includes('/prices/')) {
        return { ok: true, json: async () => ({ id: setupPriceId, livemode: false, active: true, currency: 'gbp', unit_amount: 9900, recurring: null, product: { active: true, name: 'Website Machine One-off' } }) }
      }
      const params = new URLSearchParams(options.body)
      return { ok: true, json: async () => ({ id: 'cs_test_12345678', url: 'https://checkout.stripe.test/session', livemode: false, metadata: { wm_order_id: params.get('metadata[wm_order_id]') } }) }
    },
  })
  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer user-token' }, body: JSON.stringify({ projectId, idempotencyKey: 'wm-checkout-test-02' }) })
  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(response.body).checkoutUrl, 'https://checkout.stripe.test/session')
  assert.equal(savedOrderRequest.idempotencyKey, `wm-project-${ownerId}-${projectId}`)
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

test('checkout retries reuse one project order and the already-created Stripe session', async () => {
  const calls = []
  let order = { id: orderId, status: 'pending', checkout_session_id: null }
  let savedOrderKey
  let createSessionCalls = 0
  const handler = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId },
    verifyUser: async () => ({ id: ownerId }),
    isAuthorizedTester: async () => true,
    loadOwnedProject: async () => ({ id: projectId, owner_id: ownerId }),
    createOrder: async ({ idempotencyKey }) => {
      if (savedOrderKey) assert.equal(idempotencyKey, savedOrderKey)
      savedOrderKey = idempotencyKey
      return order
    },
    saveCheckoutSession: async ({ sessionId }) => { order = { ...order, checkout_session_id: sessionId } },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if (url.includes('/prices/')) return { ok: true, json: async () => ({ id: setupPriceId, active: true, livemode: false, currency: 'gbp', unit_amount: 9900, recurring: null, product: { active: true, name: 'Website Machine One-off' } }) }
      if (url.includes('/checkout/sessions/cs_test_')) return { ok: true, json: async () => ({
        id: 'cs_test_12345678', url: 'https://checkout.stripe.test/session', livemode: false,
        status: 'open', mode: 'payment', currency: 'gbp', amount_total: 9900, client_reference_id: orderId,
        metadata: { wm_order_id: orderId, wm_project_id: projectId, wm_owner_id: ownerId },
      }) }
      if (url.includes('/checkout/sessions')) {
        createSessionCalls += 1
        return { ok: true, json: async () => ({ id: 'cs_test_12345678', url: 'https://checkout.stripe.test/session', livemode: false, metadata: { wm_order_id: orderId } }) }
      }
      throw new Error(`Unexpected request ${url}`)
    },
  })
  const invoke = (idempotencyKey) => handler({
    httpMethod: 'POST', headers: { authorization: 'Bearer user-token', 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ projectId, idempotencyKey }),
  })

  const first = await invoke('client-key-first-attempt')
  const second = await invoke('client-key-after-reload')
  assert.equal(first.statusCode, 200)
  assert.equal(second.statusCode, 200)
  assert.equal(JSON.parse(first.body).checkoutUrl, JSON.parse(second.body).checkoutUrl)
  assert.equal(savedOrderKey, `wm-project-${ownerId}-${projectId}`)
  assert.equal(createSessionCalls, 1)
  assert.equal(calls.filter(({ url }) => url.includes('/checkout/sessions/cs_test_')).length, 1)
})

test('checkout will not create another Stripe session for an order that is already paid', async () => {
  let sessionCreates = 0
  const handler = createWebsiteMachineCheckoutApi({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_PRICE_ID: setupPriceId },
    verifyUser: async () => ({ id: ownerId }),
    isAuthorizedTester: async () => true,
    loadOwnedProject: async () => ({ id: projectId, owner_id: ownerId }),
    createOrder: async () => ({ id: orderId, status: 'delivered' }),
    fetchImpl: async (url) => {
      if (url.includes('/prices/')) return { ok: true, json: async () => ({ id: setupPriceId, active: true, livemode: false, currency: 'gbp', unit_amount: 9900, recurring: null, product: { active: true, name: 'Website Machine One-off' } }) }
      if (url.includes('/checkout/sessions')) sessionCreates += 1
      throw new Error('paid order must stop before Stripe Checkout')
    },
  })
  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer user-token' }, body: JSON.stringify({ projectId }) })
  assert.equal(response.statusCode, 409)
  assert.match(JSON.parse(response.body).error, /already has a paid or completed/i)
  assert.equal(sessionCreates, 0)
})

test('Stripe webhook does not fulfill unpaid sessions and only publishes once confirmed by durable storage', async () => {
  const stripeEvent = { id: 'evt_test_paid_1234', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: baseSession.id, metadata: baseSession.metadata } } }
  const { raw, signature } = signedEvent(stripeEvent)
  let paid = false
  let publishCalls = 0
  const publisher = { publishPaidProject: async (input) => { publishCalls += 1; assert.equal(input.paid, true); return { siteId: 'netlify-site-123', deployId: '0123456789abcdef' } } }
  const emailStateForTest = emailState()
  const handler = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret, WM_STRIPE_LIVEMODE: 'false' },
    now: () => now,
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: {} }),
    confirmPaidOrder: async () => { paid = true; return { paid: true } },
    publisher,
    sendDeliveryEmail: async () => {},
    recordDeployment: async () => {},
    ...emailStateForTest,
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
    ...emailState(),
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
    isAuthorizedTester: async () => true,
    loadOwnedProject: async () => ({ id: projectId, owner_id: ownerId }),
    createOrder: async () => ({ id: orderId }),
    saveCheckoutSession: async () => {},
    fetchImpl: async (url, options = {}) => {
      if (url.includes('/prices/')) return { ok: true, json: async () => ({ id: setupPriceId, livemode: false, active: true, currency: 'gbp', unit_amount: 9900, recurring: null, product: { active: true, name: 'Website Machine One-off' } }) }
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
  const emailStateForTest = emailState()
  const webhook = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret, WM_STRIPE_LIVEMODE: 'false' },
    now: () => now,
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: { businessName: 'Northstar Motor Works' } }),
    confirmPaidOrder: async ({ session }) => { assert.equal(session.amount_total, 9900); actions.push('paid'); return { paid: true } },
    publisher: { publishPaidProject: async ({ paid }) => { assert.equal(paid, true); actions.push('published'); return { siteId: 'wm-site-synthetic', deployId: '0123456789abcdef', url: 'https://northstar-motor-works.netlify.app' } } },
    recordDeployment: async () => { actions.push('recorded') },
    sendDeliveryEmail: async ({ to, deliveryUrl }) => { assert.equal(to, 'synthetic@example.test'); assert.equal(deliveryUrl, 'https://northstar-motor-works.netlify.app'); actions.push('emailed') },
    ...emailStateForTest,
    fetchImpl: async () => ({ ok: true, json: async () => checkoutSession }),
  })
  const delivered = await webhook({ httpMethod: 'POST', body: signed.raw.toString(), headers: { 'stripe-signature': signed.signature } })
  assert.equal(delivered.statusCode, 200)
  assert.deepEqual(actions, ['paid', 'published', 'recorded', 'emailed'])
})

test('live webhook accepts only a matching signed live £99 one-off order and runs fulfillment', async () => {
  const liveWebhookSecret = 'whsec_live_' + 'l'.repeat(32)
  const liveSession = {
    ...baseSession, id: 'cs_live_synthetic_12345678', livemode: true,
    line_items: { data: [{ quantity: 1, amount_total: 9900, price: { id: setupPriceId, recurring: null } }] },
  }
  const event = { id: 'evt_live_synthetic_12345678', object: 'event', type: 'checkout.session.completed', livemode: true,
    data: { object: { id: liveSession.id, metadata: liveSession.metadata } } }
  const signed = signedEvent(event, liveWebhookSecret)
  const actions = []
  const email = deliveryStore()
  const webhook = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: liveApiKey, WM_STRIPE_WEBHOOK_SECRET: liveWebhookSecret, WM_STRIPE_LIVEMODE: 'true' },
    now: () => now,
    loadOrder: async ({ mode }) => { assert.equal(mode, 'live'); return { id: orderId, projectId, ownerId, setupPriceId, mode: 'live', content: { businessName: 'Synthetic live fixture' } } },
    confirmPaidOrder: async ({ session, order }) => { assert.equal(session.livemode, true); assert.equal(order.mode, 'live'); actions.push('confirmed'); return { paid: true } },
    publisher: { publishPaidProject: async ({ paid }) => { assert.equal(paid, true); actions.push('published'); return { siteId: 'synthetic-live-site', deployId: 'abcdef0123456789', url: 'https://synthetic-live.netlify.app' } } },
    recordDeployment: async () => { actions.push('deployment-recorded') },
    claimDeliveryEmail: async () => { const claim = await email.claim(); return { status: 'pending', shouldSend: claim.shouldSend, attemptId: claim.attemptId } },
    finishDeliveryEmail: async (args) => { actions.push(`email-${args.outcome}`); return email.finish(args) },
    sendDeliveryEmail: async ({ to, deliveryUrl }) => { assert.equal(to, 'synthetic@example.test'); assert.equal(deliveryUrl, 'https://synthetic-live.netlify.app'); actions.push('email-sent'); return { messageId: 're_synthetic_live' } },
    fetchImpl: async (url) => { assert.match(url, /cs_live_synthetic/); return { ok: true, json: async () => liveSession } },
  })
  const response = await webhook({ httpMethod: 'POST', body: signed.raw.toString(), headers: { 'stripe-signature': signed.signature } })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(actions, ['confirmed', 'published', 'deployment-recorded', 'email-sent', 'email-accepted'])
})

test('failed asynchronous payment is acknowledged without order confirmation, publishing, or email', async () => {
  let calls = 0
  const event = { id: 'evt_test_async_failed', object: 'event', type: 'checkout.session.async_payment_failed', livemode: false, data: { object: { id: baseSession.id, metadata: baseSession.metadata } } }
  const signed = signedEvent(event)
  const handler = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret },
    now: () => now,
    loadOrder: async () => { calls += 1 },
    confirmPaidOrder: async () => { calls += 1 },
    publisher: { publishPaidProject: async () => { calls += 1 } },
    recordDeployment: async () => { calls += 1 },
    sendDeliveryEmail: async () => { calls += 1 },
    ...emailState(),
  })
  const response = await handler({ httpMethod: 'POST', body: signed.raw.toString(), headers: { 'stripe-signature': signed.signature } })
  assert.equal(response.statusCode, 200)
  assert.match(response.body, /Ignored event/)
  assert.equal(calls, 0)
})

test('webhook retry recovers after a temporary publisher failure without premature email', async () => {
  const event = { id: 'evt_test_recover_1234', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: baseSession.id, metadata: baseSession.metadata } } }
  const signed = signedEvent(event)
  let deployAttempts = 0
  let sentEmails = 0
  let records = 0
  const handler = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret },
    now: () => now,
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: { businessName: 'Northstar' } }),
    confirmPaidOrder: async () => ({ paid: true, delivered: false }),
    publisher: { publishPaidProject: async () => {
      deployAttempts += 1
      if (deployAttempts === 1) throw new Error('temporary Netlify failure')
      return { url: 'https://northstar.netlify.app', deployId: '0123456789abcdef' }
    } },
    recordDeployment: async () => { records += 1 },
    sendDeliveryEmail: async () => { sentEmails += 1 },
    ...emailState(),
    fetchImpl: async () => ({ ok: true, json: async () => baseSession }),
  })
  const request = { httpMethod: 'POST', body: signed.raw.toString(), headers: { 'stripe-signature': signed.signature } }
  assert.equal((await handler(request)).statusCode, 500)
  assert.equal(sentEmails, 0)
  assert.equal((await handler(request)).statusCode, 200)
  assert.equal(deployAttempts, 2)
  assert.equal(records, 1)
  assert.equal(sentEmails, 1)
})

test('a Netlify access restriction is logged safely and cannot record delivery or send email', async () => {
  const event = { id: 'evt_test_access_blocked', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: baseSession.id, metadata: baseSession.metadata } } }
  const signed = signedEvent(event)
  const logs = []
  let recorded = 0
  let emailed = 0
  const handler = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret },
    now: () => now,
    logger: { error: (...args) => logs.push(args) },
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: { businessName: 'Northstar' } }),
    confirmPaidOrder: async () => ({ paid: true, delivered: false }),
    publisher: { publishPaidProject: async () => { const error = new Error('private'); error.code = 'CUSTOMER_SITE_ACCESS_RESTRICTED'; error.stage = 'netlify_public_verify'; error.status = 401; throw error } },
    recordDeployment: async () => { recorded += 1 },
    sendDeliveryEmail: async () => { emailed += 1 },
    ...emailState(),
    fetchImpl: async () => ({ ok: true, json: async () => baseSession }),
  })

  const response = await handler({ httpMethod: 'POST', body: signed.raw.toString(), headers: { 'stripe-signature': signed.signature } })

  assert.equal(response.statusCode, 500)
  assert.equal(recorded, 0)
  assert.equal(emailed, 0)
  assert.deepEqual(logs, [['website_machine_fulfillment_failed', { stage: 'netlify_public_verify', code: 'CUSTOMER_SITE_ACCESS_RESTRICTED', status: 401 }]])
})

test('duplicate delivered webhook reuses the existing deployment and sends one idempotent delivery email', async () => {
  const event = { id: 'evt_test_duplicate_1234', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: baseSession.id, metadata: baseSession.metadata } } }
  const signed = signedEvent(event)
  const providerSent = new Map()
  let publishCalls = 0
  let providerCalls = 0
  const emailStateForTest = emailState()
  const sendEmail = async ({ to, businessName, deliveryUrl, orderId: id }) => {
    const sender = createWebsiteMachineDeliveryEmail({ apiKey: 're_test_key', from: 'sites@example.test', fetchImpl: async (_url, options) => {
      providerCalls += 1
      const key = options.headers['idempotency-key']
      if (!providerSent.has(key)) providerSent.set(key, { to, businessName, deliveryUrl })
      return { ok: true, json: async () => ({ id: `email-${key}` }) }
    } })
    return sender({ to, businessName, deliveryUrl, orderId: id })
  }
  const handler = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret },
    now: () => now,
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: { businessName: 'Northstar' }, siteRecord: { siteUrl: 'https://northstar.netlify.app', currentDeployId: '0123456789abcdef' } }),
    confirmPaidOrder: async () => ({ paid: true, delivered: false, siteRecord: { siteUrl: 'https://northstar.netlify.app', currentDeployId: '0123456789abcdef' } }),
    publisher: { publishPaidProject: async ({ siteRecord }) => { assert.equal(siteRecord.currentDeployId, '0123456789abcdef'); publishCalls += 1; return { url: 'https://northstar.netlify.app', siteId: 'existing-site-id', deployId: '0123456789abcdef' } } },
    recordDeployment: async () => {},
    sendDeliveryEmail: sendEmail,
    ...emailStateForTest,
    fetchImpl: async () => ({ ok: true, json: async () => baseSession }),
  })
  const request = { httpMethod: 'POST', body: signed.raw.toString(), headers: { 'stripe-signature': signed.signature } }
  assert.equal((await handler(request)).statusCode, 200)
  assert.equal((await handler(request)).statusCode, 200)
  assert.equal(publishCalls, 2) // Both invocations reuse the persisted deployment id; neither creates a site.
  assert.equal(providerCalls, 1)
  assert.equal(providerSent.size, 1)
})

test('known Resend rejection remains recoverable and a later webhook retry completes email once', async () => {
  const event = { id: 'evt_test_email_recover_1234', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: baseSession.id, metadata: baseSession.metadata } } }
  const signed = signedEvent(event)
  const persistence = emailState()
  let emailAttempts = 0
  let publishCalls = 0
  const handler = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret }, now: () => now,
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: { businessName: 'Northstar' }, siteRecord: { siteUrl: 'https://northstar.netlify.app', currentDeployId: '0123456789abcdef' } }),
    confirmPaidOrder: async () => ({ paid: true, delivered: false, siteRecord: { siteUrl: 'https://northstar.netlify.app', currentDeployId: '0123456789abcdef' } }),
    publisher: { publishPaidProject: async () => { publishCalls += 1; return { url: 'https://northstar.netlify.app', siteId: 'existing-site-id', deployId: '0123456789abcdef' } } },
    recordDeployment: async () => {},
    sendDeliveryEmail: async () => {
      emailAttempts += 1
      if (emailAttempts === 1) { const error = new Error('Resend rejected'); error.deliveryOutcome = 'failed'; error.code = 'RESEND_REJECTED'; error.stage = 'resend_email'; throw error }
      return { sent: true, messageId: 'resend-message-recovered' }
    },
    ...persistence,
    fetchImpl: async () => ({ ok: true, json: async () => baseSession }),
  })
  const request = { httpMethod: 'POST', body: signed.raw.toString(), headers: { 'stripe-signature': signed.signature } }
  assert.equal((await handler(request)).statusCode, 500)
  assert.equal(persistence.store.status, 'failed')
  assert.equal((await handler(request)).statusCode, 200)
  assert.equal(persistence.store.status, 'accepted')
  assert.equal(emailAttempts, 2)
  assert.equal(publishCalls, 2) // Publisher receives the stored existing site and reuses its deployment.
})

test('ambiguous Resend timeout is recorded unknown and duplicate webhook does not blindly resend', async () => {
  const event = { id: 'evt_test_email_unknown_1234', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: baseSession.id, metadata: baseSession.metadata } } }
  const signed = signedEvent(event)
  const persistence = emailState()
  let emailAttempts = 0
  const handler = createStripeWebsiteMachineWebhook({
    env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret }, now: () => now,
    loadOrder: async () => ({ id: orderId, projectId, ownerId, setupPriceId, mode: 'test', content: { businessName: 'Northstar' } }),
    confirmPaidOrder: async () => ({ paid: true, delivered: false }),
    publisher: { publishPaidProject: async () => ({ url: 'https://northstar.netlify.app', siteId: 'existing-site-id', deployId: '0123456789abcdef' }) },
    recordDeployment: async () => {},
    sendDeliveryEmail: async () => { emailAttempts += 1; const error = new Error('uncertain'); error.deliveryOutcome = 'unknown'; error.code = 'RESEND_OUTCOME_UNKNOWN'; throw error },
    ...persistence,
    fetchImpl: async () => ({ ok: true, json: async () => baseSession }),
  })
  const request = { httpMethod: 'POST', body: signed.raw.toString(), headers: { 'stripe-signature': signed.signature } }
  assert.equal((await handler(request)).statusCode, 200)
  assert.match((await handler(request)).body, /requires reconciliation/)
  assert.equal(persistence.store.status, 'unknown')
  assert.equal(emailAttempts, 1)
})

test('bad Stripe signature never calls the database or publisher', async () => {
  let calls = 0
  const handler = createStripeWebsiteMachineWebhook({ env: { WM_STRIPE_SECRET_KEY: apiKey, WM_STRIPE_WEBHOOK_SECRET: secret }, loadOrder: async () => { calls += 1 }, confirmPaidOrder: async () => {}, publisher: {}, recordDeployment: async () => {}, sendDeliveryEmail: async () => {}, ...emailState() })
  const response = await handler({ httpMethod: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=bad' } })
  assert.equal(response.statusCode, 400)
  assert.equal(calls, 0)
})
