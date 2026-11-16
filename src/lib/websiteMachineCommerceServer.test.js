import test from 'node:test'
import assert from 'node:assert/strict'
import { createWebsiteMachineCheckoutHandler, createWebsiteMachineCustomerSiteHandler, createWebsiteMachineStripeWebhookHandler } from './websiteMachineCommerceServer.js'
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
