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
