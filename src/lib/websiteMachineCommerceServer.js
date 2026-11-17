import { createHmac, timingSafeEqual } from 'node:crypto'
import { createDomainChallenge, createNetlifyCustomerPublisher } from './websiteMachinePublishing.js'
import { createStripeWebsiteMachineWebhook, createWebsiteMachineCheckoutApi, isStripeTestSecretKey, isStripeLiveSecretKey, isPaidWebsiteMachineSession } from './websiteMachinePayments.js'
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

function productionCommerceReady(config) {
  let publicHost = ''
  try {
    const origin = new URL(config?.publicUrl || '')
    if (origin.protocol === 'https:' && !origin.username && !origin.password) publicHost = origin.hostname.toLowerCase()
  } catch {}
  return config?.mode === 'production' &&
    Boolean(publicHost) && !['localhost', '127.0.0.1'].includes(publicHost) &&
    !['.example', '.test', '.invalid'].some((suffix) => publicHost.endsWith(suffix)) &&
    config.publicUrl !== 'https://bendarus.netlify.app' &&
    isStripeLiveSecretKey(config.stripeSecret) && config.stripeWebhookSecret?.startsWith('whsec_') &&
    config.stripePrice === 'price_1TtvtIEWP0eV3FnnXUMIwPwG' &&
    typeof config.rpcSecret === 'string' && config.rpcSecret.length >= 32 &&
    Boolean(config.netlifyToken) && config.netlifyAccountSlug === 'website-machine' &&
    config.deliveryEmailApiKey?.startsWith('re_') &&
    /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(config.deliveryFromEmail || '')
}

function commerceReady(config) {
  return config?.mode === 'production' ? productionCommerceReady(config) : stagingCommerceReady(config)
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
  if (!commerceReady(config)) return async () => ({ statusCode: 503, body: 'Website Machine checkout and delivery are not fully configured.' })
  const rpc = createRpc({ baseUrl: config.url, publishableKey: config.publishableKey, fetchImpl })
  return createWebsiteMachineCheckoutApi({
    env: {
      ...env,
      WM_STRIPE_SECRET_KEY: config.stripeSecret,
      WM_STRIPE_PRICE_ID: config.stripePrice,
      WM_STRIPE_LIVEMODE: config.liveMode ? 'true' : 'false',
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
        if (error.databaseCode === '22023' && error.databaseMessage === 'unapproved Website Machine one-off live price') {
          const safeError = new Error('The live Website Machine offer is inactive. No order or payment was created.')
          safeError.safeCode = 'WM_LIVE_OFFER_INACTIVE'
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

const RECOVERY_ORDER_ID = '38bdba88-0905-4045-8f46-0c83d349adfb'
const RECOVERY_SITE_ID = 'dde29a46-a3d5-4dec-963b-1304b1c85e1f'
const RECOVERY_APPROVED_RECIPIENT = 'billygeez888@gmail.com'
const EMAIL_RECOVERY_SENDER = 'websites@mail.ai-receptionist.work'
const STRIPE_API = 'https://api.stripe.com/v1'
const emailAddressPattern = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/

function recoveryConfirmationToken(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = createHmac('sha256', secret).update(`wm-email-recovery-v1\n${encoded}`).digest('hex')
  return `${encoded}.${mac}`
}

function verifyRecoveryConfirmationToken(token, secret, now) {
  if (typeof token !== 'string' || token.length > 2000) return null
  const [encoded, suppliedHex, extra] = token.split('.')
  if (!encoded || !/^[a-f0-9]{64}$/i.test(suppliedHex || '') || extra !== undefined) return null
  const expected = createHmac('sha256', secret).update(`wm-email-recovery-v1\n${encoded}`).digest()
  const supplied = Buffer.from(suppliedHex, 'hex')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (payload.purpose !== 'send-one-time-recovery' || payload.orderId !== RECOVERY_ORDER_ID ||
        !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt < Math.floor(now() / 1000) ||
        !emailAddressPattern.test(payload.recipient || '') || !/^[0-9a-f-]{36}$/i.test(payload.ownerId || '')) return null
    return payload
  } catch { return null }
}

/**
 * Owner-authenticated, one-time recovery for the specified legacy sandbox order.
 * The prepare phase verifies Checkout and returns a short-lived recipient-bound
 * token. The send phase atomically claims the sole recovery attempt before Resend.
 */
export function createWebsiteMachineEmailRecoveryHandler({ env = process.env, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const config = runtime(env)
  if (!stagingCommerceReady(config) || config.deliveryFromEmail.toLowerCase() !== EMAIL_RECOVERY_SENDER) {
    return async () => ({ statusCode: 503, body: 'Website Machine email recovery is not configured.' })
  }

  const rpc = createRpc({ baseUrl: config.url, publishableKey: config.publishableKey, fetchImpl })
  const failJson = (statusCode, error) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ error }) })

  async function loadRecoveryContext(orderId, accessToken) {
    const result = await rpc('wm_get_payment_order', {
      p_order_id: orderId, p_mode: 'test', p_signature: signature(`test\nget_order:${orderId}`, config.rpcSecret),
    })
    if (!result || result.id !== RECOVERY_ORDER_ID || result.mode !== 'test' || result.status !== 'delivering' ||
        result.amountTotal !== 9900 || result.currency !== 'gbp' || !result.checkoutSessionId || !result.ownerId || !result.projectId) {
      throw Object.assign(new Error('This order is not eligible for one-time email recovery.'), { statusCode: 409 })
    }

    const siteResponse = await fetchImpl(`${config.url}/rest/v1/wm_customer_sites?project_id=eq.${encodeURIComponent(result.projectId)}&owner_id=eq.${encodeURIComponent(result.ownerId)}&select=site_id,site_name,status,site_url&limit=1`, {
      headers: { apikey: config.publishableKey, authorization: `Bearer ${accessToken}` },
    })
    if (!siteResponse.ok) throw Object.assign(new Error('Published website status could not be verified.'), { statusCode: 502 })
    const sites = await siteResponse.json()
    const site = sites[0]
    const expectedSiteName = `wm-${result.projectId.replace(/-/g, '')}`
    const expectedSiteUrl = `https://${expectedSiteName}.netlify.app`
    if (!site || site.site_id !== RECOVERY_SITE_ID || site.status !== 'delivered' || site.site_name !== expectedSiteName || site.site_url !== expectedSiteUrl) {
      throw Object.assign(new Error('The existing customer website is not verified as published.'), { statusCode: 409 })
    }

    const websiteResponse = await fetchImpl(site.site_url, { method: 'GET', redirect: 'manual' })
    if (!websiteResponse.ok || websiteResponse.status !== 200 || !/^text\/html(?:;|$)/i.test(websiteResponse.headers.get('content-type') || '')) {
      throw Object.assign(new Error('The existing customer website failed its public delivery check.'), { statusCode: 409 })
    }

    const stripeResponse = await fetchImpl(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(result.checkoutSessionId)}?expand%5B%5D=line_items.data.price`, {
      headers: { authorization: `Bearer ${config.stripeSecret}` },
    })
    if (!stripeResponse.ok) throw Object.assign(new Error('Original sandbox Checkout session could not be verified.'), { statusCode: 502 })
    const checkout = await stripeResponse.json()
    if (checkout.id !== result.checkoutSessionId || checkout.client_reference_id !== result.id ||
        !isPaidWebsiteMachineSession(checkout, {
          orderId: result.id, projectId: result.projectId, ownerId: result.ownerId,
          setupPriceId: result.setupPriceId, liveMode: false,
        })) {
      throw Object.assign(new Error('Original sandbox Checkout session does not match the paid order.'), { statusCode: 409 })
    }
    const recipient = String(checkout.customer_details?.email || checkout.customer_email || '').trim().toLowerCase()
    if (!emailAddressPattern.test(recipient) || recipient !== RECOVERY_APPROVED_RECIPIENT) {
      throw Object.assign(new Error('Original Checkout recipient does not match the approved recovery recipient.'), { statusCode: 409 })
    }
    return { order: result, site, recipient }
  }

  async function authorize(event) {
    const token = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw Object.assign(new Error('Sign in as the paid order owner.'), { statusCode: 401 })
    const response = await fetchImpl(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` } })
    if (!response.ok) throw Object.assign(new Error('Sign in as the paid order owner.'), { statusCode: 401 })
    return { accessToken: token, user: await response.json() }
  }

  return async (event) => {
    if (event.httpMethod !== 'POST') return failJson(405, 'Method not allowed.')
    if (Buffer.byteLength(event.body || '') > 3000) return failJson(413, 'Request is too large.')
    try {
      const { accessToken, user } = await authorize(event)
      const body = JSON.parse(event.body || '{}')
      if (body.orderId !== RECOVERY_ORDER_ID || !['prepare','send'].includes(body.phase)) return failJson(404, 'Recovery order not found.')
      const context = await loadRecoveryContext(body.orderId, accessToken)
      if (user.id !== context.order.ownerId) return failJson(403, 'Only the paid order owner can recover this delivery email.')

      if (body.phase === 'prepare') {
        const expiresAt = Math.floor(now() / 1000) + 300
        const token = recoveryConfirmationToken({
          purpose: 'send-one-time-recovery', orderId: body.orderId,
          ownerId: context.order.ownerId, recipient: context.recipient, expiresAt,
        }, config.rpcSecret)
        return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ recipient: context.recipient, websiteUrl: context.site.site_url, confirmationToken: token, expiresAt }) }
      }

      const confirmation = verifyRecoveryConfirmationToken(body.confirmationToken, config.rpcSecret, now)
      if (!confirmation || confirmation.ownerId !== user.id || confirmation.recipient !== context.recipient) return failJson(403, 'Recovery confirmation expired or does not match the verified Checkout recipient.')
      const claimMessage = `test\nclaim_one_time_email_recovery\n${body.orderId}\n${user.id}\n${context.recipient}`
      const claim = await rpc('wm_claim_one_time_email_recovery', {
        p_order_id: body.orderId, p_owner_id: user.id, p_recipient: context.recipient,
        p_mode: 'test', p_signature: signature(claimMessage, config.rpcSecret),
      })
      if (claim?.shouldSend !== true || !claim.attemptId) return failJson(409, 'The one-time recovery has already been claimed or this email outcome changed.')

      const finish = async (outcome, messageId = null, errorCode = null) => {
        const safeMessageId = typeof messageId === 'string' ? messageId : ''
        const safeErrorCode = typeof errorCode === 'string' && /^[A-Z0-9_]{1,80}$/.test(errorCode) ? errorCode : 'DELIVERY_RECOVERY_FAILED'
        const finishMessage = ['test', body.orderId, claim.attemptId, outcome, safeMessageId, outcome === 'accepted' ? '' : safeErrorCode].join('\n')
        const saved = await rpc('wm_finish_one_time_email_recovery', {
          p_order_id: body.orderId, p_mode: 'test', p_attempt_id: claim.attemptId,
          p_outcome: outcome, p_provider_message_id: safeMessageId || null,
          p_error_code: outcome === 'accepted' ? null : safeErrorCode,
          p_signature: signature(`test\nfinish_one_time_email_recovery\n${finishMessage.slice('test\n'.length)}`, config.rpcSecret),
        })
        if (saved !== true) throw new Error('Recovery outcome could not be saved; do not retry automatically.')
      }

      let sent
      try {
        sent = await createWebsiteMachineDeliveryEmail({ apiKey: config.deliveryEmailApiKey, from: config.deliveryFromEmail, fetchImpl })(
          { to: context.recipient, businessName: context.order.content?.businessName || 'Your business', deliveryUrl: context.site.site_url, orderId: body.orderId },
        )
      } catch (error) {
        const outcome = error?.deliveryOutcome === 'failed' ? 'failed' : 'unknown'
        try { await finish(outcome, null, error?.code || 'DELIVERY_RECOVERY_FAILED') }
        catch { return failJson(502, 'Resend may have processed this request; recovery is blocked pending reconciliation. Do not retry.') }
        return failJson(502, outcome === 'failed'
          ? 'Resend rejected the one-time recovery. No automatic retry was made.'
          : 'Resend outcome is unknown. No automatic retry was made.')
      }

      try { await finish('accepted', sent.messageId || null) }
      catch { return failJson(502, 'Resend accepted the request, but its result could not be recorded. Do not retry.') }
      return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({ status: 'accepted', recipient: context.recipient, websiteUrl: context.site.site_url, messageId: sent.messageId || null }) }
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400
      return failJson(statusCode, error?.message || 'One-time recovery could not be processed.')
    }
  }
}

export function createWebsiteMachineStripeWebhookHandler({ env = process.env, fetchImpl = fetch, sleep, maxPolls } = {}) {
  const config = runtime(env)
  if (!commerceReady(config)) return async () => ({ statusCode: 503, body: 'Website Machine payment fulfillment is not fully configured.' })
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
      WM_STRIPE_LIVEMODE: config.liveMode ? 'true' : 'false',
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
    claimDeliveryEmail: async ({ orderId, mode }) => {
      const message = `${mode}\nclaim_delivery_email:${orderId}`
      return rpc('wm_claim_delivery_email', {
        p_order_id: orderId, p_mode: mode, p_signature: signature(message, config.rpcSecret),
      })
    },
    finishDeliveryEmail: async ({ orderId, mode, attemptId, outcome, messageId = null, errorCode = null }) => {
      const safeMessageId = typeof messageId === 'string' ? messageId : ''
      const safeErrorCode = typeof errorCode === 'string' ? errorCode : ''
      const message = [mode, orderId, attemptId, outcome, safeMessageId, safeErrorCode].join('\n')
      const saved = await rpc('wm_finish_delivery_email', {
        p_order_id: orderId, p_mode: mode, p_attempt_id: attemptId, p_outcome: outcome,
        p_provider_message_id: safeMessageId || null, p_error_code: safeErrorCode || null,
        p_signature: signature(message, config.rpcSecret),
      })
      if (saved !== true) throw new Error('Website Machine email delivery state could not be saved.')
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
