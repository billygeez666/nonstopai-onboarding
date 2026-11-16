import { createHmac } from 'node:crypto'
import { createDomainChallenge, createNetlifyCustomerPublisher } from './websiteMachinePublishing.js'
import { createStripeWebsiteMachineWebhook, createWebsiteMachineCheckoutApi } from './websiteMachinePayments.js'
import { getWebsiteMachineConfig } from './websiteMachineServer.js'

function runtime(env) {
  const config = getWebsiteMachineConfig(env)
  if (!config) return null
  const production = config.mode === 'production'
  return {
    ...config,
    stripeSecret: production ? env.WM_PRODUCTION_STRIPE_SECRET_KEY : env.WM_STAGING_STRIPE_SECRET_KEY,
    stripeWebhookSecret: production ? env.WM_PRODUCTION_STRIPE_WEBHOOK_SECRET : env.WM_STAGING_STRIPE_WEBHOOK_SECRET,
    stripeSetupPrice: production ? env.WM_PRODUCTION_STRIPE_SETUP_PRICE_ID : env.WM_STAGING_STRIPE_SETUP_PRICE_ID,
    stripeMonthlyPrice: production ? env.WM_PRODUCTION_STRIPE_MONTHLY_PRICE_ID : env.WM_STAGING_STRIPE_MONTHLY_PRICE_ID,
    rpcSecret: production ? env.WM_PRODUCTION_PAYMENT_RPC_SECRET : env.WM_STAGING_PAYMENT_RPC_SECRET,
    netlifyToken: production ? env.WM_PRODUCTION_NETLIFY_CUSTOMER_TOKEN : env.WM_STAGING_NETLIFY_CUSTOMER_TOKEN,
    liveMode: production,
  }
}

function signature(message, secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Website Machine payment storage is not configured.')
  return createHmac('sha256', secret).update(message).digest('hex')
}

function createRpc({ baseUrl, publishableKey, fetchImpl }) {
  return async (name, payload, token = null) => {
    const response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: publishableKey, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(`Website Machine storage request failed (${response.status}).`)
    return response.status === 204 ? null : response.json()
  }
}

export function createWebsiteMachineCheckoutHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const config = runtime(env)
  if (!config || !config.stripeSecret || !config.stripeWebhookSecret || !config.stripeSetupPrice || !config.stripeMonthlyPrice || !config.rpcSecret || !config.netlifyToken) return async () => ({ statusCode: 503, body: 'Website Machine checkout and delivery are not fully configured.' })
  const rpc = createRpc({ baseUrl: config.url, publishableKey: config.publishableKey, fetchImpl })
  return createWebsiteMachineCheckoutApi({
    env: {
      ...env,
      WM_STRIPE_SECRET_KEY: config.stripeSecret,
      WM_STRIPE_SETUP_PRICE_ID: config.stripeSetupPrice,
      WM_STRIPE_MONTHLY_PRICE_ID: config.stripeMonthlyPrice,
      WM_STRIPE_LIVEMODE: String(config.liveMode),
    },
    fetchImpl,
    publicUrl: () => config.publicUrl,
    verifyUser: async (token) => {
      if (!token) return null
      const response = await fetchImpl(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` } })
      return response.ok ? response.json() : null
    },
    loadOwnedProject: async ({ token, projectId, ownerId }) => {
      const response = await fetchImpl(`${config.url}/rest/v1/wm_projects?id=eq.${encodeURIComponent(projectId)}&select=id,owner_id,content,status`, {
        headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` },
      })
      if (!response.ok) return null
      const rows = await response.json()
      return rows.find((row) => row.owner_id === ownerId) || null
    },
    createOrder: async ({ token, project, setupPriceId, monthlyPriceId, domain, domainChallenge, mode, idempotencyKey }) => {
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
  if (!config || !config.stripeSecret || !config.stripeWebhookSecret || !config.stripeSetupPrice || !config.stripeMonthlyPrice || !config.rpcSecret || !config.netlifyToken) return async () => ({ statusCode: 503, body: 'Website Machine payment fulfillment is not fully configured.' })
  const rpc = createRpc({ baseUrl: config.url, publishableKey: config.publishableKey, fetchImpl })
  const publisher = createNetlifyCustomerPublisher({
    env: { WM_NETLIFY_CUSTOMER_TOKEN: config.netlifyToken },
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
      WM_STRIPE_SETUP_PRICE_ID: config.stripeSetupPrice,
      WM_STRIPE_MONTHLY_PRICE_ID: config.stripeMonthlyPrice,
      WM_STRIPE_LIVEMODE: String(config.liveMode),
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
  })
}

export function createWebsiteMachineRollbackHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const config = runtime(env)
  if (!config || !config.netlifyToken || !config.rpcSecret) return async () => ({ statusCode: 503, body: 'Website Machine rollback is not configured.' })
  const rpc = createRpc({ baseUrl: config.url, publishableKey: config.publishableKey, fetchImpl })
  const publisher = createNetlifyCustomerPublisher({ env: { WM_NETLIFY_CUSTOMER_TOKEN: config.netlifyToken }, fetchImpl })
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
