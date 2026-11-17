import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createWebsiteMachineCheckoutHandler, createWebsiteMachineCustomerSiteHandler, createWebsiteMachineReadinessHandler, createWebsiteMachineStripeWebhookHandler } from './websiteMachineCommerceServer.js'
import { getWebsiteMachineConfig } from './websiteMachineServer.js'

const supabase = 'https://lqywsbqctoydtdqvjzzw.supabase.co'

test('runtime configuration is explicitly split between staging and production', () => {
  const config = getWebsiteMachineConfig({ WM_STAGING_SUPABASE_URL: supabase, WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'staging-publishable', WM_PRODUCTION_SUPABASE_URL: 'https://wrong.supabase.co', WM_PRODUCTION_SUPABASE_PUBLISHABLE_KEY: 'production-publishable' })
  assert.equal(config.mode, 'staging')
  assert.equal(config.publishableKey, 'staging-publishable')
  const production = getWebsiteMachineConfig({ WM_RUNTIME_ENV: 'production', WM_PRODUCTION_SUPABASE_URL: supabase, WM_PRODUCTION_SUPABASE_PUBLISHABLE_KEY: 'production-publishable', WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'staging-publishable', WM_PRODUCTION_PUBLIC_URL: 'https://nonstopai.netlify.app' })
  assert.equal(production.mode, 'production')
  assert.equal(production.publishableKey, 'production-publishable')
  assert.equal(getWebsiteMachineConfig({ WM_STAGING_SUPABASE_URL: 'https://attacker.supabase.co', WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'key' }), null)
})

test('production checkout remains disabled even when production commerce values are present', async () => {
  let externalCalls = 0
  const handler = createWebsiteMachineCheckoutHandler({ env: {
    WM_RUNTIME_ENV: 'production', WM_PRODUCTION_SUPABASE_URL: supabase,
    WM_PRODUCTION_SUPABASE_PUBLISHABLE_KEY: 'production-publishable', WM_PRODUCTION_PUBLIC_URL: 'https://nonstopai.netlify.app',
    WM_PRODUCTION_STRIPE_SECRET_KEY: 'sk_live_must_not_be_used', WM_PRODUCTION_STRIPE_WEBHOOK_SECRET: 'whsec_live_must_not_be_used',
    WM_PRODUCTION_STRIPE_PRICE_ID: 'price_live_offer', WM_PRODUCTION_PAYMENT_RPC_SECRET: 'p'.repeat(40),
    WM_PRODUCTION_NETLIFY_CUSTOMER_TOKEN: 'production-netlify-token', WM_PRODUCTION_NETLIFY_ACCOUNT_SLUG: 'production-team',
    WM_PRODUCTION_EMAIL_API_KEY: 'email-key', WM_PRODUCTION_DELIVERY_FROM_EMAIL: 'sites@example.test',
    WM_STAGING_STRIPE_SECRET_KEY: 'sk_test_staging', WM_STAGING_STRIPE_WEBHOOK_SECRET: 'whsec_staging',
    WM_STAGING_STRIPE_PRICE_ID: 'price_test_offer', WM_STAGING_PAYMENT_RPC_SECRET: 's'.repeat(40),
    WM_STAGING_NETLIFY_CUSTOMER_TOKEN: 'staging-netlify-token',
  }, fetchImpl: async () => { externalCalls += 1; throw new Error('production handler must not call external services') } })
  const response = await handler({ httpMethod: 'POST' })
  assert.equal(response.statusCode, 503)
  assert.match(response.body, /not fully configured/)
  assert.equal(externalCalls, 0)
})

test('staging webhook stays disabled until a dedicated Netlify account is configured', async () => {
  let requests = 0
  const handler = createWebsiteMachineStripeWebhookHandler({ env: {
    WM_RUNTIME_ENV: 'staging', WM_STAGING_SUPABASE_URL: supabase,
    WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'staging-publishable', WM_STAGING_PUBLIC_URL: 'https://nonstopai-staging-preview.netlify.app',
    WM_STAGING_STRIPE_SECRET_KEY: 'sk_test_staging', WM_STAGING_STRIPE_WEBHOOK_SECRET: 'whsec_staging',
    WM_STAGING_STRIPE_SETUP_PRICE_ID: 'price_test_setup', WM_STAGING_STRIPE_MONTHLY_PRICE_ID: 'price_test_monthly',
    WM_STAGING_PAYMENT_RPC_SECRET: 's'.repeat(40), WM_STAGING_NETLIFY_CUSTOMER_TOKEN: 'staging-netlify-token',
  }, fetchImpl: async () => { requests += 1; throw new Error('must remain disabled') } })
  const response = await handler({ httpMethod: 'POST', body: '{}' })
  assert.equal(response.statusCode, 503)
  assert.equal(requests, 0)
})

test('staging accepts the configured Stripe secret names while still requiring a test key', async () => {
  const base = {
    WM_RUNTIME_ENV: 'staging', WM_STAGING_SUPABASE_URL: supabase,
    WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'staging-publishable', WM_STAGING_PUBLIC_URL: 'https://bendarus.netlify.app',
    STRIPE_SECRET_KEY: 'sk_test_staging', STRIPE_WEBHOOK_SECRET: 'whsec_staging',
    STRIPE_PRICE_ID: 'price_test_fixture_website_machine_99',
    WM_STAGING_PAYMENT_RPC_SECRET: 's'.repeat(40), WM_STAGING_NETLIFY_CUSTOMER_TOKEN: 'dedicated-staging-token',
    WM_STAGING_NETLIFY_ACCOUNT_SLUG: 'website-machine', WM_STAGING_EMAIL_API_KEY: 'staging-email-key',
    WM_STAGING_DELIVERY_FROM_EMAIL: 'websites@example.test',
  }
  const handler = createWebsiteMachineStripeWebhookHandler({ env: base, fetchImpl: async () => { throw new Error('GET must not make network requests') } })
  assert.equal((await handler({ httpMethod: 'GET' })).statusCode, 405)

  const unsafe = createWebsiteMachineStripeWebhookHandler({ env: { ...base, STRIPE_SECRET_KEY: 'sk_live_must_not_be_used' } })
  assert.equal((await unsafe({ httpMethod: 'POST', body: '{}' })).statusCode, 503)
})

test('staging webhook persists Resend acceptance and provider id through signed private RPCs', async () => {
  const orderId = 'c2e671de-dfd5-4b1c-9f83-d9a92d852a01'
  const projectId = 'a5bd4cb4-8467-4cc6-b769-16087d180fc6'
  const ownerId = 'f3765312-550e-436b-8fea-9d3dc42a1167'
  const rpcSecret = 's'.repeat(40)
  const webhookSecret = 'whsec_' + 'w'.repeat(40)
  const session = {
    id: 'cs_test_delivery_12345678', object: 'checkout.session', livemode: false, status: 'complete', payment_status: 'paid', mode: 'payment',
    currency: 'gbp', amount_total: 9900, client_reference_id: orderId, customer_details: { email: 'synthetic@example.test' },
    metadata: { wm_order_id: orderId, wm_project_id: projectId, wm_owner_id: ownerId },
    line_items: { data: [{ quantity: 1, amount_total: 9900, price: { id: 'price_test_99', recurring: null } }] },
  }
  const event = { id: 'evt_test_delivery_tracking', type: 'checkout.session.completed', livemode: false, data: { object: { id: session.id, metadata: session.metadata } } }
  const raw = Buffer.from(JSON.stringify(event))
  const timestamp = Math.floor(Date.now() / 1000)
  const signed = createHmac('sha256', webhookSecret).update(`${timestamp}.`).update(raw).digest('hex')
  const calls = []
  const handler = createWebsiteMachineStripeWebhookHandler({ env: {
    WM_RUNTIME_ENV: 'staging', WM_STAGING_SUPABASE_URL: supabase,
    WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'staging-publishable', WM_STAGING_PUBLIC_URL: 'https://bendarus.netlify.app',
    STRIPE_SECRET_KEY: 'sk_test_staging', STRIPE_WEBHOOK_SECRET: webhookSecret, STRIPE_PRICE_ID: 'price_test_99',
    WM_STAGING_PAYMENT_RPC_SECRET: rpcSecret, WM_STAGING_NETLIFY_CUSTOMER_TOKEN: 'dedicated-staging-token',
    WM_STAGING_NETLIFY_ACCOUNT_SLUG: 'website-machine', WM_STAGING_EMAIL_API_KEY: 're_test_key',
    WM_STAGING_DELIVERY_FROM_EMAIL: 'sites@example.test',
  }, fetchImpl: async (url, options = {}) => {
    calls.push({ url, options })
    if (url.startsWith('https://api.stripe.com/v1/checkout/sessions/')) return { ok: true, json: async () => session }
    if (url.endsWith('/rpc/wm_get_payment_order')) return { ok: true, json: async () => ({
      id: orderId, projectId, ownerId, mode: 'test', setupPriceId: 'price_test_99', amountTotal: 9900,
      currency: 'gbp', checkoutSessionId: session.id, status: 'delivering', content: { businessName: 'Synthetic Garage' },
      siteRecord: { project_id: projectId, owner_id: ownerId, site_id: 'dde29a46-a3d5-4dec-963b-1304b1c85e1f',
        site_name: `wm-${projectId.replaceAll('-', '')}`, site_url: 'https://synthetic-garage.netlify.app',
        current_deploy_id: '0123456789abcdef', previous_deploy_ids: [] },
    }) }
    if (url.endsWith('/rpc/wm_confirm_paid_order')) return { ok: true, json: async () => ({ paid: true, delivered: true }) }
    if (url.endsWith('/rpc/wm_claim_delivery_email')) return { ok: true, json: async () => ({ status: 'pending', shouldSend: true, attemptId: 'e7d42ed9-7765-4937-b415-fb0923ef3331' }) }
    if (url === 'https://api.resend.com/emails') return { ok: true, json: async () => ({ id: 're_accepted_message_1' }) }
    if (url.endsWith('/rpc/wm_finish_delivery_email')) return { ok: true, json: async () => true }
    throw new Error(`Unexpected request ${url}`)
  } })
  const response = await handler({ httpMethod: 'POST', body: raw.toString(), headers: { 'stripe-signature': `t=${timestamp},v1=${signed}` } })
  assert.equal(response.statusCode, 200, response.body)
  assert.match(response.body, /delivery email is accepted/)
  const rpcCalls = calls.filter((call) => call.url.includes('/rpc/'))
  assert.deepEqual(rpcCalls.map((call) => call.url.split('/').at(-1)), ['wm_get_payment_order', 'wm_confirm_paid_order', 'wm_claim_delivery_email', 'wm_finish_delivery_email'])
  const finish = JSON.parse(rpcCalls.at(-1).options.body)
  assert.equal(finish.p_outcome, 'accepted')
  assert.equal(finish.p_provider_message_id, 're_accepted_message_1')
  assert.equal(finish.p_signature.length, 64)
})

test('staging checkout asks the self-only tester RPC before reading the owner project', async () => {
  const env = {
    WM_RUNTIME_ENV: 'staging', WM_STAGING_SUPABASE_URL: supabase,
    WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'staging-publishable', WM_STAGING_PUBLIC_URL: 'https://bendarus.netlify.app',
    WM_STAGING_STRIPE_SECRET_KEY: 'sk_test_staging', WM_STAGING_STRIPE_WEBHOOK_SECRET: 'whsec_staging',
    WM_STAGING_STRIPE_PRICE_ID: 'price_test_fixture_website_machine_99', WM_STAGING_PAYMENT_RPC_SECRET: 's'.repeat(40),
    WM_STAGING_NETLIFY_CUSTOMER_TOKEN: 'staging-netlify-token', WM_STAGING_NETLIFY_ACCOUNT_SLUG: 'website-machine',
    WM_STAGING_EMAIL_API_KEY: 'email-key', WM_STAGING_DELIVERY_FROM_EMAIL: 'websites@example.test',
  }
  const projectId = 'c70f3d5f-f910-441a-9b39-8374d1d28532'
  const ownerId = '7a9d31b9-5bbb-48e8-83ec-5200a5293314'
  async function invoke(allowed) {
    const calls = []
    const handler = createWebsiteMachineCheckoutHandler({ env, fetchImpl: async (url, options = {}) => {
      calls.push({ url, options })
      if (url.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: ownerId }) }
      if (url.endsWith('/rpc/wm_is_staging_checkout_tester')) return { ok: true, json: async () => allowed }
      if (url.includes('/rest/v1/wm_projects')) return { ok: true, json: async () => [] }
      throw new Error('project or tester checks must stop before Stripe')
    } })
    const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer staging-user-token' }, body: JSON.stringify({ projectId, idempotencyKey: `wm-private-test-${allowed ? 'yes' : 'no'}-01` }) })
    return { response, calls }
  }

  const denied = await invoke(false)
  assert.equal(denied.response.statusCode, 403)
  assert.deepEqual(denied.calls.map((call) => call.url.split('/').at(-1)), ['user', 'wm_is_staging_checkout_tester'])
  assert.equal(denied.calls[1].options.headers.authorization, 'Bearer staging-user-token')
  assert.deepEqual(JSON.parse(denied.calls[1].options.body), {})

  const allowed = await invoke(true)
  assert.equal(allowed.response.statusCode, 404)
  assert.deepEqual(allowed.calls.map((call) => call.url.split('/').at(-1)), ['user', 'wm_is_staging_checkout_tester', `wm_projects?id=eq.${projectId}&select=id,owner_id,content,status`])
})

test('inactive £99 test offer returns a safe conflict after authentication and tester checks, without creating a Stripe session', async () => {
  const ownerId = '7a9d31b9-5bbb-48e8-83ec-5200a5293314'
  const projectId = 'c70f3d5f-f910-441a-9b39-8374d1d28532'
  const priceId = 'price_test_fixture_website_machine_99'
  const calls = []
  const handler = createWebsiteMachineCheckoutHandler({ env: {
    WM_RUNTIME_ENV: 'staging', WM_STAGING_SUPABASE_URL: supabase,
    WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'staging-publishable', WM_STAGING_PUBLIC_URL: 'https://bendarus.netlify.app',
    WM_STAGING_STRIPE_SECRET_KEY: 'sk_test_staging', WM_STAGING_STRIPE_WEBHOOK_SECRET: 'whsec_staging',
    WM_STAGING_STRIPE_PRICE_ID: priceId, WM_STAGING_PAYMENT_RPC_SECRET: 's'.repeat(40),
    WM_STAGING_NETLIFY_CUSTOMER_TOKEN: 'staging-netlify-token', WM_STAGING_NETLIFY_ACCOUNT_SLUG: 'website-machine',
    WM_STAGING_EMAIL_API_KEY: 'email-key', WM_STAGING_DELIVERY_FROM_EMAIL: 'websites@example.test',
  }, fetchImpl: async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: ownerId }) }
    if (url.endsWith('/rpc/wm_is_staging_checkout_tester')) return { ok: true, json: async () => true }
    if (url.includes('/rest/v1/wm_projects')) return { ok: true, json: async () => [{ id: projectId, owner_id: ownerId, content: {}, status: 'draft' }] }
    if (url.startsWith('https://api.stripe.com/v1/prices/')) return { ok: true, json: async () => ({ id: priceId, active: true, livemode: false, currency: 'gbp', unit_amount: 9900, recurring: null, product: { active: true, name: 'Website Machine One-page Website', metadata: {} } }) }
    if (url.endsWith('/rpc/wm_create_checkout_order')) return { ok: false, status: 400, json: async () => ({ code: '22023', message: 'unapproved Website Machine one-off test price' }) }
    if (url.includes('/checkout/sessions')) throw new Error('inactive offer must stop before creating a Stripe checkout session')
    throw new Error(`Unexpected request: ${url}`)
  } })

  const response = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer staging-user-token' }, body: JSON.stringify({ projectId, idempotencyKey: 'wm-inactive-offer-check-01' }) })
  const body = JSON.parse(response.body)
  assert.equal(response.statusCode, 409)
  assert.equal(body.code, 'WM_TEST_OFFER_INACTIVE')
  assert.match(body.error, /£99 sandbox offer is currently inactive/i)
  assert.match(body.error, /No order or payment was created/i)
  assert.doesNotMatch(response.body, /unapproved Website Machine one-off test price|22023/)
  assert.deepEqual(calls.filter((call) => call.url.includes('/checkout/sessions')), [])
})

test('staging readiness diagnostic verifies the RPC secret and reports only missing variable names', async () => {
  const secret = 'synthetic-test-payment-rpc-secret-0123456789'
  const now = Date.now()
  const timestamp = String(Math.floor(now / 1000))
  const nonce = 'a'.repeat(64)
  const authMessage = `wm-staging-readiness-v1\n${timestamp}\n${nonce}`
  const authSignature = createHmac('sha256', secret).update(authMessage).digest('hex')
  const env = {
    WM_RUNTIME_ENV: 'staging', WM_STAGING_PUBLIC_URL: 'https://bendarus.netlify.app',
    WM_STAGING_SUPABASE_URL: supabase, WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'publishable-test-key',
    STRIPE_SECRET_KEY: 'sk_test_synthetic', STRIPE_WEBHOOK_SECRET: 'whsec_synthetic', STRIPE_PRICE_ID: 'price_test_fixture_website_machine_99',
    WM_STAGING_PAYMENT_RPC_SECRET: secret, WM_STAGING_NETLIFY_CUSTOMER_TOKEN: 'synthetic-netlify-token',
    WM_STAGING_NETLIFY_ACCOUNT_SLUG: 'website-machine', WM_STAGING_EMAIL_API_KEY: 'synthetic-email-key',
    WM_STAGING_DELIVERY_FROM_EMAIL: 'websites@example.test',
  }
  const mockFetch = async (url) => url.includes('/rpc/wm_get_payment_order')
    ? { ok: true, status: 200 }
    : { ok: true, status: 200, json: async () => ({ id: env.STRIPE_PRICE_ID, livemode: false, active: true, currency: 'gbp', unit_amount: 9900, recurring: null, product: { active: true, name: 'Website Machine Website', metadata: {} } }) }
  const handler = createWebsiteMachineReadinessHandler({
    env,
    now: () => now,
    fetchImpl: mockFetch,
  })
  const event = { httpMethod: 'POST', headers: { 'x-wm-diagnostic-timestamp': timestamp, 'x-wm-diagnostic-nonce': nonce, 'x-wm-diagnostic-signature': authSignature }, body: '' }
  const result = await handler(event)
  const body = JSON.parse(result.body)
  assert.equal(result.statusCode, 200)
  assert.deepEqual(body.missing, [])
  assert.deepEqual(body.invalid, [])
  assert.equal(body.checks.paymentRpcSecretMatchesSupabase, true)
  assert.equal(body.checks.stripePriceIsVerifiedOneOff, true)

  const incomplete = createWebsiteMachineReadinessHandler({ env: { ...env, WM_STAGING_EMAIL_API_KEY: '', WM_STAGING_NETLIFY_ACCOUNT_SLUG: 'wrong-team' }, now: () => now, fetchImpl: mockFetch })
  const incompleteResult = await incomplete(event)
  const incompleteBody = JSON.parse(incompleteResult.body)
  assert.deepEqual(incompleteBody.missing, ['WM_STAGING_EMAIL_API_KEY'])
  assert.deepEqual(incompleteBody.invalid, ['WM_STAGING_NETLIFY_ACCOUNT_SLUG'])
  assert.equal((await handler({ ...event, headers: { ...event.headers, 'x-wm-diagnostic-signature': '0'.repeat(64) } })).statusCode, 401)
})

test('customer site status requires the owner session and returns no row for another project owner', async () => {
  const projectId = 'c70f3d5f-f910-441a-9b39-8374d1d28532'
  const ownerId = 'd3cbfcf4-7cb8-4f63-a20d-73d963a88791'
  const calls = []
  const handler = createWebsiteMachineCustomerSiteHandler({
    env: { WM_STAGING_SUPABASE_URL: supabase, WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'publishable' },
    fetchImpl: async (url) => {
      calls.push(url)
      if (url.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: ownerId }) }
      return { ok: true, json: async () => [{ status: 'delivered', site_url: 'https://wm-customer.netlify.app', verified_deploy_url: 'https://deploy--wm-customer.netlify.app' }] }
    },
  })
  const response = await handler({ httpMethod: 'GET', rawUrl: `https://staging.test/.netlify/functions/website-machine-customer-site?project_id=${projectId}`, headers: { authorization: 'Bearer user-session' } })
  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(response.body).status, 'delivered')
  assert.match(calls[1], new RegExp(`owner_id=eq.${ownerId}`))
  assert.equal((await handler({ httpMethod: 'GET', rawUrl: 'https://staging.test/.netlify/functions/website-machine-customer-site?project_id=invalid' })).statusCode, 401)
})
