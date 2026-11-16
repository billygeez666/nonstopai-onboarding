import { createHmac, timingSafeEqual } from 'node:crypto'
import { createDomainChallenge, createNetlifyCustomerPublisher } from './websiteMachinePublishing.js'
import { createStripeWebsiteMachineWebhook, createWebsiteMachineCheckoutApi, isStripeTestSecretKey } from './websiteMachinePayments.js'
import { createWebsiteMachineDeliveryEmail } from './websiteMachineEmail.js'
import { getWebsiteMachineConfig } from './websiteMachineServer.js'

function runtime(env) {
  const config = getWebsiteMachineConfig(env)
  if (!config) return null
  const production = config.mode === 'production'
  return {
    ...config,
    // Netlify has the short Stripe variable names configured on the isolated
    // staging site. Keep the namespaced variables preferred, and accept the
    // short aliases only in staging; stagingCommerceReady still requires sk_test_.
    stripeSecret: production ? env.WM_PRODUCTION_STRIPE_SECRET_KEY : (env.WM_STAGING_STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: production ? env.WM_PRODUCTION_STRIPE_WEBHOOK_SECRET : (env.WM_STAGING_STRIPE_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET),
    stripePrice: production ? env.WM_PRODUCTION_STRIPE_PRICE_ID : (env.WM_STAGING_STRIPE_PRICE_ID || env.STRIPE_PRICE_ID),
    rpcSecret: production ? env.WM_PRODUCTION_PAYMENT_RPC_SECRET : env.WM_STAGING_PAYMENT_RPC_SECRET,
    netlifyToken: production ? env.WM_PRODUCTION_NETLIFY_CUSTOMER_TOKEN : env.WM_STAGING_NETLIFY_CUSTOMER_TOKEN,
    netlifyAccountSlug: production ? env.WM_PRODUCTION_NETLIFY_ACCOUNT_SLUG : env.WM_STAGING_NETLIFY_ACCOUNT_SLUG,
    deliveryEmailApiKey: production ? env.WM_PRODUCTION_EMAIL_API_KEY : env.WM_STAGING_EMAIL_API_KEY,
    deliveryFromEmail: production ? env.WM_PRODUCTION_DELIVERY_FROM_EMAIL : env.WM_STAGING_DELIVERY_FROM_EMAIL,
    liveMode: production,
  }
}

function stagingCommerceReady(config) {
  return config?.mode === 'staging' && config.publicUrl === 'https://bendarus.netlify.app' &&
    isStripeTestSecretKey(config.stripeSecret) && config.stripeWebhookSecret?.startsWith('whsec_') && config.stripePrice?.startsWith('price_') &&
    typeof config.rpcSecret === 'string' && config.rpcSecret.length >= 32 && config.netlifyToken &&
    config.netlifyAccountSlug === 'website-machine' && config.deliveryEmailApiKey &&
    /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(config.deliveryFromEmail || '')
}

function signature(message, secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Website Machine payment storage is not configured.')
  return createHmac('sha256', secret).update(message).digest('hex')
}

function selectedEnv(env, primary, fallback = null) {
  if (env[primary]) return { name: primary, value: env[primary] }
  if (fallback && env[fallback]) return { name: fallback, value: env[fallback] }
  return { name: fallback ? `${primary} or ${fallback}` : primary, value: '' }
}

function inspectStagingEnvironment(env) {
  const missing = []
  const invalid = []
  const requireValue = (name, value) => { if (!value) missing.push(name); return value }
  const requireMatch = (name, value, predicate) => {
    if (!value) missing.push(name)
    else if (!predicate(value)) invalid.push(name)
    return value
  }
  requireMatch('WM_RUNTIME_ENV', env.WM_RUNTIME_ENV, (value) => value === 'staging')
  requireMatch('WM_STAGING_PUBLIC_URL', env.WM_STAGING_PUBLIC_URL, (value) => value === 'https://bendarus.netlify.app')
  const supabaseUrl = selectedEnv(env, 'WM_STAGING_SUPABASE_URL', 'WM_SUPABASE_URL')
  requireMatch(supabaseUrl.name, supabaseUrl.value, (value) => value === 'https://lqywsbqctoydtdqvjzzw.supabase.co')
  const publishableKey = selectedEnv(env, 'WM_STAGING_SUPABASE_PUBLISHABLE_KEY', 'WM_SUPABASE_PUBLISHABLE_KEY')
  requireValue(publishableKey.name, publishableKey.value)
  const stripeSecret = selectedEnv(env, 'WM_STAGING_STRIPE_SECRET_KEY', 'STRIPE_SECRET_KEY')
  requireMatch(stripeSecret.name, stripeSecret.value, isStripeTestSecretKey)
  const webhookSecret = selectedEnv(env, 'WM_STAGING_STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET')
  requireMatch(webhookSecret.name, webhookSecret.value, (value) => value.startsWith('whsec_'))
  const stripePrice = selectedEnv(env, 'WM_STAGING_STRIPE_PRICE_ID', 'STRIPE_PRICE_ID')
  requireMatch(stripePrice.name, stripePrice.value, (value) => value.startsWith('price_'))
  requireMatch('WM_STAGING_PAYMENT_RPC_SECRET', env.WM_STAGING_PAYMENT_RPC_SECRET, (value) => value.length >= 32)
  requireValue('WM_STAGING_NETLIFY_CUSTOMER_TOKEN', env.WM_STAGING_NETLIFY_CUSTOMER_TOKEN)
  requireMatch('WM_STAGING_NETLIFY_ACCOUNT_SLUG', env.WM_STAGING_NETLIFY_ACCOUNT_SLUG, (value) => value === 'website-machine')
  requireValue('WM_STAGING_EMAIL_API_KEY', env.WM_STAGING_EMAIL_API_KEY)
  requireMatch('WM_STAGING_DELIVERY_FROM_EMAIL', env.WM_STAGING_DELIVERY_FROM_EMAIL, (value) => /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(value))
  return { missing, invalid, stripeSecret, stripePrice, rpcSecret: env.WM_STAGING_PAYMENT_RPC_SECRET, publishableKey, supabaseUrl }
}

/**
 * A temporary, read-only staging diagnostic. Callers must prove possession of
 * the RPC secret with a short-lived HMAC challenge. The response contains only
 * variable names and booleans; it never returns environment values.
 */
export function createWebsiteMachineReadinessHandler({ env = process.env, fetchImpl = fetch, now = () => Date.now() } = {}) {
  return async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers: { allow: 'POST', 'cache-control': 'no-store' }, body: 'Method not allowed.' }
    if (Buffer.byteLength(event.body || '') > 1000) return { statusCode: 413, body: 'Request too large.' }
    const secret = env.WM_STAGING_PAYMENT_RPC_SECRET
    if (!secret || env.WM_RUNTIME_ENV !== 'staging') return { statusCode: 503, body: 'Staging diagnostics are unavailable.' }
    const headers = event.headers || {}
    const timestamp = headers['x-wm-diagnostic-timestamp'] || headers['X-Wm-Diagnostic-Timestamp'] || ''
    const nonce = headers['x-wm-diagnostic-nonce'] || headers['X-Wm-Diagnostic-Nonce'] || ''
    const suppliedHex = headers['x-wm-diagnostic-signature'] || headers['X-Wm-Diagnostic-Signature'] || ''
    const seconds = Number(timestamp)
    if (!/^\d{10}$/.test(timestamp) || !Number.isSafeInteger(seconds) || Math.abs(Math.floor(now() / 1000) - seconds) > 60 || !/^[a-f0-9]{32,128}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(suppliedHex)) {
      return { statusCode: 401, body: 'Invalid diagnostic authorization.' }
    }
    const expected = createHmac('sha256', secret).update(`wm-staging-readiness-v1\n${timestamp}\n${nonce}`).digest()
    const supplied = Buffer.from(suppliedHex, 'hex')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return { statusCode: 401, body: 'Invalid diagnostic authorization.' }

    const inspected = inspectStagingEnvironment(env)
    const result = {
      missing: inspected.missing,
      invalid: inspected.invalid,
      checks: { paymentRpcSecretMatchesSupabase: null, stripePriceIsVerifiedOneOff: null },
    }
    if (inspected.rpcSecret.length >= 32 && inspected.publishableKey.value && inspected.supabaseUrl.value === 'https://lqywsbqctoydtdqvjzzw.supabase.co') {
      try {
        const orderId = '00000000-0000-0000-0000-000000000000'
        const response = await fetchImpl(`${inspected.supabaseUrl.value}/rest/v1/rpc/wm_get_payment_order`, {
          method: 'POST',
          headers: { apikey: inspected.publishableKey.value, 'content-type': 'application/json' },
          body: JSON.stringify({ p_order_id: orderId, p_mode: 'test', p_signature: signature(`test\nget_order:${orderId}`, inspected.rpcSecret) }),
        })
        if (response.status === 401 || response.status === 403) {
          result.checks.paymentRpcSecretMatchesSupabase = false
          if (!result.invalid.includes('WM_STAGING_PAYMENT_RPC_SECRET')) result.invalid.push('WM_STAGING_PAYMENT_RPC_SECRET')
        } else if (response.ok) result.checks.paymentRpcSecretMatchesSupabase = true
      } catch {}
    }
    if (isStripeTestSecretKey(inspected.stripeSecret.value) && inspected.stripePrice.value.startsWith('price_')) {
      try {
        const response = await fetchImpl(`https://api.stripe.com/v1/prices/${encodeURIComponent(inspected.stripePrice.value)}?expand%5B%5D=product`, {
          headers: { authorization: `Bearer ${inspected.stripeSecret.value}` },
        })
        if (response.status === 401 || response.status === 403) {
          if (!result.invalid.includes(inspected.stripeSecret.name)) result.invalid.push(inspected.stripeSecret.name)
        } else if (response.status === 404) {
          if (!result.invalid.includes(inspected.stripePrice.name)) result.invalid.push(inspected.stripePrice.name)
        } else if (response.ok) {
          const price = await response.json()
          const isWebsiteMachine = /website/i.test(price?.product?.name || '') || price?.product?.metadata?.product === 'website_machine'
          result.checks.stripePriceIsVerifiedOneOff = price?.id === inspected.stripePrice.value && price?.livemode === false && price?.active === true &&
            price?.currency === 'gbp' && price?.unit_amount === 9900 && !price?.recurring && price?.product?.active === true &&
            isWebsiteMachine && !/receptionist/i.test(price?.product?.name || '')
          if (!result.checks.stripePriceIsVerifiedOneOff && !result.invalid.includes(inspected.stripePrice.name)) result.invalid.push(inspected.stripePrice.name)
        }
      } catch {}
    }
    return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(result) }
  }
}

function createRpc({ baseUrl, publishableKey, fetchImpl }) {
  return async (name, payload, token = null) => {
    const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const details = await response.json().catch(() => ({}))
      const error = new Error(`Website Machine storage request failed (${response.status}).`)
      error.databaseCode = typeof details.code === 'string' ? details.code : ''
      error.databaseMessage = typeof details.message === 'string' ? details.message : ''
      throw error
    }
    return response.status === 204 ? null : response.json()
  }
}

export function createWebsiteMachineCheckoutHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const config = runtime(env)
  if (!stagingCommerceReady(config)) return async () => ({ statusCode: 503, body: 'Website Machine staging checkout and delivery are not fully configured.' })
  const rpc = createRpc({ baseUrl: config.url, publishableKey: config.publishableKey, fetchImpl })
  return createWebsiteMachineCheckoutApi({
    env: {
      ...env,
      WM_STRIPE_SECRET_KEY: config.stripeSecret,
      WM_STRIPE_PRICE_ID: config.stripePrice,
      WM_STRIPE_LIVEMODE: 'false',
    },
    fetchImpl,
    publicUrl: () => config.publicUrl,
    verifyUser: async (token) => {
      if (!token) return null
      const response = await fetchImpl(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` } })
      return response.ok ? response.json() : null
    },
    isAuthorizedTester: async ({ token }) => (await rpc('wm_is_staging_checkout_tester', {}, token)) === true,
    loadOwnedProject: async ({ token, projectId, ownerId }) => {
      const response = await fetchImpl(`${config.url}/rest/v1/wm_projects?id=eq.${encodeURIComponent(projectId)}&select=id,owner_id,content,status`, {
        headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` },
      })
      if (!response.ok) return null
      const rows = await response.json()
      return rows.find((row) => row.owner_id === ownerId) || null
    },
    createOrder: async ({ token, project, setupPriceId, monthlyPriceId, domain, domainChallenge, mode, idempotencyKey }) => {
      try {
        const rows = await rpc('wm_create_checkout_order', {
          p_project_id: project.id,
          p_idempotency_key: idempotencyKey,
          p_mode: mode,
          p_setup_price_id: setupPriceId,
          p_monthly_price_id: monthlyPriceId,
          p_domain: domain,
          p_domain_challenge: domainChallenge?.token || null,
        }, token)
        return Array.isArray(rows) ? rows[0] : null
      } catch (error) {
        if (error.databaseCode === '22023' && error.databaseMessage === 'unapproved Website Machine one-off test price') {
          const safeError = new Error('The £99 sandbox offer is currently inactive. No order or payment was created.')
          safeError.safeCode = 'WM_TEST_OFFER_INACTIVE'
          throw safeError
        }
        if (error.databaseCode === '42501' && error.databaseMessage === 'staging tester access required') {
          const safeError = new Error('Checkout is restricted to approved staging testers. No order or payment was created.')
          safeError.safeCode = 'WM_STAGING_TESTER_REQUIRED'
          throw safeError
        }
        throw error
      }
    },
    saveCheckoutSession: async ({ token, orderId, sessionId }) => {
      const saved = await rpc('wm_attach_checkout_session', { p_order_id: orderId, p_session_id: sessionId }, token)
      if (saved !== true) throw new Error('Checkout session could not be saved to the order.')
    },
  })
}

export function createWebsiteMachineDomainChallengeHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const config = runtime(env)
  if (!config) return async () => ({ statusCode: 503, body: 'Website Machine is not configured.' })
  return async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed.' }
    if (Buffer.byteLength(event.body || '') > 1000) return { statusCode: 413, body: 'Request is too large.' }
    const token = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return { statusCode: 401, body: 'Authentication required.' }
    try {
      const response = await fetchImpl(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` } })
      if (!response.ok) return { statusCode: 401, body: 'Authentication required.' }
      const body = JSON.parse(event.body || '{}')
      const challenge = createDomainChallenge({ domain: body.domain })
      return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(challenge) }
    } catch (error) {
      return { statusCode: 400, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ error: error.message || 'Domain validation failed.' }) }
    }
  }
}

export function createWebsiteMachineCustomerSiteHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const config = runtime(env)
  if (!config) return async () => ({ statusCode: 503, body: 'Website Machine is not configured.' })
  return async (event) => {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed.' }
    const token = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return { statusCode: 401, body: 'Authentication required.' }
    try {
      const auth = await fetchImpl(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` } })
      if (!auth.ok) return { statusCode: 401, body: 'Authentication required.' }
      const user = await auth.json()
      const url = new URL(event.rawUrl || `https://local.invalid${event.path || '/'}`)
      const projectId = url.searchParams.get('project_id') || ''
      if (!/^[0-9a-f-]{36}$/i.test(projectId)) return { statusCode: 400, body: 'A valid project id is required.' }
      const response = await fetchImpl(`${config.url}/rest/v1/wm_customer_sites?project_id=eq.${encodeURIComponent(projectId)}&owner_id=eq.${encodeURIComponent(user.id)}&select=status,site_url,verified_deploy_url`, {
        headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` },
      })
      if (!response.ok) return { statusCode: 502, body: 'Delivery status could not be read.' }
      const rows = await response.json()
      if (!rows.length) return { statusCode: 404, headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ status: 'pending' }) }
      return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(rows[0]) }
    } catch {
      return { statusCode: 502, body: 'Delivery status could not be read.' }
    }
  }
}

export function createWebsiteMachineStripeWebhookHandler({ env = process.env, fetchImpl = fetch, sleep, maxPolls } = {}) {
  const config = runtime(env)
  if (!stagingCommerceReady(config)) return async () => ({ statusCode: 503, body: 'Website Machine staging fulfillment is not fully configured.' })
  const rpc = createRpc({ baseUrl: config.url, publishableKey: config.publishableKey, fetchImpl })
  const publisher = createNetlifyCustomerPublisher({
    env: { WM_NETLIFY_CUSTOMER_TOKEN: config.netlifyToken, WM_NETLIFY_ACCOUNT_SLUG: config.netlifyAccountSlug },
    fetchImpl,
    ...(sleep ? { sleep } : {}),
    ...(maxPolls ? { maxPolls } : {}),
    persistSite: async ({ projectId, ownerId, siteId, siteName, customDomain }) => {
      const mode = config.liveMode ? 'live' : 'test'
      const message = [mode, projectId, ownerId, siteId, siteName, customDomain || ''].join('\n')
      await rpc('wm_reserve_customer_site', {
        p_project_id: projectId, p_owner_id: ownerId, p_mode: mode, p_site_id: siteId, p_site_name: siteName,
        p_custom_domain: customDomain || null, p_signature: signature(message, config.rpcSecret),
      })
    },
  })

  return createStripeWebsiteMachineWebhook({
    env: {
      ...env,
      WM_STRIPE_SECRET_KEY: config.stripeSecret,
      WM_STRIPE_WEBHOOK_SECRET: config.stripeWebhookSecret,
      WM_STRIPE_PRICE_ID: config.stripePrice,
      WM_STRIPE_LIVEMODE: 'false',
    },
    fetchImpl,
    publisher,
    loadOrder: async ({ orderId, mode }) => {
      if (mode !== (config.liveMode ? 'live' : 'test')) return null
      const result = await rpc('wm_get_payment_order', { p_order_id: orderId, p_mode: mode, p_signature: signature(`${mode}\nget_order:${orderId}`, config.rpcSecret) })
      if (!result) return null
      return {
        id: result.id,
        projectId: result.projectId,
        ownerId: result.ownerId,
        mode: result.mode,
        setupPriceId: result.setupPriceId,
        monthlyPriceId: result.monthlyPriceId,
        amountTotal: result.amountTotal,
        currency: result.currency,
        checkoutSessionId: result.checkoutSessionId,
        status: result.status,
        domain: result.domain,
        domainChallenge: result.domain ? { domain: result.domain, token: result.domainChallenge } : null,
        content: result.content,
        siteRecord: result.siteRecord ? {
          siteId: result.siteRecord.site_id,
          siteName: result.siteRecord.site_name,
          projectId: result.siteRecord.project_id,
          ownerId: result.siteRecord.owner_id,
          customDomain: result.siteRecord.custom_domain,
          currentDeployId: result.siteRecord.current_deploy_id,
          previousDeployIds: result.siteRecord.previous_deploy_ids || [],
          siteUrl: result.siteRecord.site_url,
        } : null,
      }
    },
    confirmPaidOrder: async ({ eventId, session, order }) => {
      const mac = signature([order.mode, eventId, session.id, order.projectId, String(session.amount_total), session.currency.toLowerCase()].join('\n'), config.rpcSecret)
      const result = await rpc('wm_confirm_paid_order', {
        p_order_id: order.id, p_event_id: eventId, p_session_id: session.id, p_project_id: order.projectId,
        p_mode: order.mode, p_amount_total: session.amount_total, p_currency: session.currency, p_signature: mac,
      })
      return { ...result, siteRecord: order.siteRecord }
    },
    recordDeployment: async ({ order, site }) => {
      const message = [order.mode, order.projectId, order.ownerId, site.deployId, site.previousDeployId || '', site.url, site.verifiedDeployUrl].join('\n')
      await rpc('wm_record_customer_deployment', {
        p_project_id: order.projectId, p_owner_id: order.ownerId, p_mode: order.mode, p_deploy_id: site.deployId,
        p_previous_deploy_id: site.previousDeployId || null, p_site_url: site.url,
        p_verified_deploy_url: site.verifiedDeployUrl, p_signature: signature(message, config.rpcSecret),
      })
    },
    sendDeliveryEmail: createWebsiteMachineDeliveryEmail({ apiKey: config.deliveryEmailApiKey, from: config.deliveryFromEmail, fetchImpl }),
  })
}

export function createWebsiteMachineRollbackHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const config = runtime(env)
  if (!config || !config.netlifyToken || !config.netlifyAccountSlug || !config.rpcSecret) return async () => ({ statusCode: 503, body: 'Website Machine rollback is not configured.' })
  const rpc = createRpc({ baseUrl: config.url, publishableKey: config.publishableKey, fetchImpl })
  const publisher = createNetlifyCustomerPublisher({ env: { WM_NETLIFY_CUSTOMER_TOKEN: config.netlifyToken, WM_NETLIFY_ACCOUNT_SLUG: config.netlifyAccountSlug }, fetchImpl })
  return async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed.' }
    if (Buffer.byteLength(event.body || '') > 2000) return { statusCode: 413, body: 'Request is too large.' }
    const token = (event.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return { statusCode: 401, body: 'Authentication required.' }
    try {
      const auth = await fetchImpl(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` } })
      if (!auth.ok) return { statusCode: 401, body: 'Authentication required.' }
      const user = await auth.json()
      const body = JSON.parse(event.body || '{}')
      if (!/^[0-9a-f-]{36}$/i.test(body.projectId || '') || !/^[0-9a-f-]{16,64}$/i.test(body.deployId || '')) return { statusCode: 400, body: 'Invalid rollback request.' }
      const response = await fetchImpl(`${config.url}/rest/v1/wm_customer_sites?project_id=eq.${encodeURIComponent(body.projectId)}&owner_id=eq.${encodeURIComponent(user.id)}&select=project_id,owner_id,site_id,site_name,custom_domain,current_deploy_id,previous_deploy_ids,site_url,verified_deploy_url`, {
        headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` },
      })
      if (!response.ok) return { statusCode: 502, body: 'Customer site could not be read.' }
      const rows = await response.json()
      if (!rows.length) return { statusCode: 404, body: 'Customer site not found.' }
      const row = rows[0]
      const siteRecord = { projectId: row.project_id, ownerId: row.owner_id, siteId: row.site_id, siteName: row.site_name, customDomain: row.custom_domain, currentDeployId: row.current_deploy_id, previousDeployIds: row.previous_deploy_ids || [] }
      if (siteRecord.ownerId !== user.id) return { statusCode: 404, body: 'Customer site not found.' }
      const restored = await publisher.rollback({ ownerId: user.id, projectId: body.projectId, siteRecord, deployId: body.deployId })
      const deployId = restored.deployId || body.deployId
      const verifiedUrl = restored.verifiedDeployUrl || row.verified_deploy_url
      const mode = config.liveMode ? 'live' : 'test'
      const message = [mode, body.projectId, user.id, deployId, row.current_deploy_id || '', row.site_url, verifiedUrl].join('\n')
      await rpc('wm_record_customer_deployment', {
        p_project_id: body.projectId, p_owner_id: user.id, p_mode: mode, p_deploy_id: deployId,
        p_previous_deploy_id: row.current_deploy_id || null, p_site_url: row.site_url,
        p_verified_deploy_url: verifiedUrl, p_signature: signature(message, config.rpcSecret),
      })
      return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'rollback_requested', siteUrl: row.site_url }) }
    } catch {
      return { statusCode: 502, body: 'Customer site rollback failed.' }
    }
  }
}
