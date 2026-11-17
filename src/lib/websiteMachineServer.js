import { createHash, randomBytes } from 'node:crypto'
import { generateWebsiteContent, renderStaticWebsite, sanitizeWebsiteContent, validateBusinessInput } from './websiteMachine.js'
import { validateResearchSources } from './websiteMachineResearch.js'

const ACTIVE_CRM_SUPABASE_URL = 'https://lqywsbqctoydtdqvjzzw.supabase.co'
const json = (statusCode, body, headers = {}) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }, body: JSON.stringify(body) })
const cors = (headers = {}) => ({ ...headers, 'access-control-allow-origin': process.env.URL || 'http://localhost:5173', 'access-control-allow-headers': 'content-type, authorization, idempotency-key', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', vary: 'Origin' })
const bearer = (event) => (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer\s+(.+)$/i)?.[1] || ''

export function getWebsiteMachineConfig(env = process.env) {
  const production = env.WM_RUNTIME_ENV === 'production'
  const url = production ? env.WM_PRODUCTION_SUPABASE_URL : (env.WM_STAGING_SUPABASE_URL || env.WM_SUPABASE_URL)
  const publishableKey = production ? env.WM_PRODUCTION_SUPABASE_PUBLISHABLE_KEY : (env.WM_STAGING_SUPABASE_PUBLISHABLE_KEY || env.WM_SUPABASE_PUBLISHABLE_KEY)
  const publicUrl = production ? env.WM_PRODUCTION_PUBLIC_URL : (env.WM_STAGING_PUBLIC_URL || 'https://nonstopai-staging-preview.netlify.app')
  if (url !== ACTIVE_CRM_SUPABASE_URL || !publishableKey || !publicUrl?.startsWith('https://')) return null
  return { url, publishableKey, publicUrl, mode: production ? 'production' : 'staging' }
}

function asResponseError(error) {
  if (error?.status === 429) return json(429, { error: 'Project creation limit reached. Try again in the next hour.' }, cors())
  return json(500, { error: 'Website Machine request failed.' }, cors())
}

async function verifyUser({ token, env, fetchImpl }) {
  const config = getWebsiteMachineConfig(env)
  if (!token || token.length > 4096 || !config) return null
  const response = await fetchImpl(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, authorization: `Bearer ${token}` } })
  if (!response.ok) return null
  const user = await response.json()
  return typeof user.id === 'string' && /^[0-9a-f-]{36}$/i.test(user.id) ? user : null
}

export function createAuthApi({ env = process.env, fetchImpl = fetch } = {}) {
  return async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' }, cors())
    const config = getWebsiteMachineConfig(env)
    if (!config) return json(503, { error: 'Website Machine authentication is not configured.' }, cors())
    try {
      if (Buffer.byteLength(event.body || '') > 5000) return json(413, { error: 'Request is too large.' }, cors())
      const body = JSON.parse(event.body || '{}')
      if (typeof body.email !== 'string' || body.email.length > 254 || typeof body.password !== 'string' || body.password.length > 1024) return json(400, { error: 'Enter a valid email and password.' }, cors())
      const email = body.email.trim()
      const signup = body.action === 'signup'
      if (signup && (body.password.length < 12 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json(400, { error: 'Use a valid email and a password with at least 12 characters.' }, cors())
      const response = signup
        ? await fetchImpl(`${config.url}/auth/v1/signup`, { method: 'POST', headers: { apikey: config.publishableKey, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: body.password, options: { emailRedirectTo: `${config.publicUrl}/website-machine/` } }) })
        : await fetchImpl(`${config.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: config.publishableKey, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: body.password }) })
      if (!response.ok) return json(signup ? 400 : 401, { error: signup ? 'Account could not be created. Check the email or try signing in.' : 'Sign-in failed. Check your account details.' }, cors())
      const session = await response.json()
      if (signup && !session.access_token) return json(200, { confirmationRequired: true, message: 'Check your email to confirm your account, then sign in.' }, cors())
      if (typeof session.access_token !== 'string' || !session.user?.id) return json(401, { error: 'Sign-in failed. Check your account details.' }, cors())
      return json(200, { accessToken: session.access_token, expiresIn: session.expires_in, user: { id: session.user.id, email: session.user.email }, ...(signup ? { confirmationRequired: false } : {}) }, cors())
    } catch {
      return json(400, { error: 'Sign-in request could not be processed.' }, cors())
    }
  }
}

export function createProjectApi({ env = process.env, fetchImpl = fetch } = {}) {
  const config = getWebsiteMachineConfig(env)
  async function db(path, token, options = {}) {
    const response = await fetchImpl(`${config.url}/rest/v1/${path}`, { ...options, headers: { apikey: config.publishableKey, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...options.headers } })
    if (!response.ok) {
      const details = await response.json().catch(() => ({}))
      const error = new Error('Storage request failed')
      error.status = details.code === 'P0001' && /rate limit/i.test(details.message || '') ? 429 : response.status
      throw error
    }
    return response.status === 204 ? null : response.json()
  }

  return async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() }
    if (!config) return json(503, { error: 'Website Machine storage is not configured.' }, cors())
    try {
      const token = bearer(event)
      const user = await verifyUser({ token, env, fetchImpl })
      if (!user) return json(401, { error: 'A valid Website Machine account session is required.' }, cors())
      const url = new URL(event.rawUrl || `https://local.invalid${event.path || '/'}`)
      if (event.httpMethod === 'POST') {
        if (Buffer.byteLength(event.body || '') > 20000) return json(413, { error: 'Request is too large.' }, cors())
        const body = JSON.parse(event.body || '{}')
        const input = validateBusinessInput(body.business)
        if (!input.ok) return json(400, { error: 'Invalid business information.', fields: input.errors }, cors())
        const generated = generateWebsiteContent(input.value)
        const safeContent = sanitizeWebsiteContent(body.content || generated.content)
        if (!safeContent.ok) return json(400, { error: safeContent.error }, cors())
        if (renderStaticWebsite(safeContent.content).length > 150000) return json(400, { error: 'Website content is too large.' }, cors())
        const safeResearch = validateResearchSources(body.research || [])
        if (!safeResearch.ok) return json(400, { error: safeResearch.error }, cors())
        const key = event.headers?.['idempotency-key'] || event.headers?.['Idempotency-Key'] || ''
        if (!/^[A-Za-z0-9_-]{12,100}$/.test(key)) return json(400, { error: 'A valid idempotency key is required.' }, cors())
        const rows = await db('rpc/wm_create_project', token, { method: 'POST', body: JSON.stringify({ p_idempotency_key: key, p_business: input.value, p_content: safeContent.content, p_research: safeResearch.sources }) })
        if (!rows?.length) return json(500, { error: 'Project could not be saved.' }, cors())
        return json(201, { id: rows[0].id, status: rows[0].status, content: rows[0].content }, cors())
      }
      const projectId = url.searchParams.get('id')
      if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) return json(400, { error: 'A valid project id is required.' }, cors())
      const projectPath = `wm_projects?id=eq.${encodeURIComponent(projectId)}&select=id,owner_id,business,content,research,status,created_at,updated_at,preview_deploy_id,preview_url`
      const rows = await db(projectPath, token)
      if (!rows?.length) return json(404, { error: 'Project not found.' }, cors())
      if (event.httpMethod === 'GET') return json(200, rows[0], cors())
      if (event.httpMethod === 'PUT') {
        if (Buffer.byteLength(event.body || '') > 20000) return json(413, { error: 'Request is too large.' }, cors())
        const body = JSON.parse(event.body || '{}')
        const safeContent = sanitizeWebsiteContent(body.content)
        if (!safeContent.ok || renderStaticWebsite(safeContent.content).length > 150000) return json(400, { error: 'Invalid website content.' }, cors())
        const patch = { content: safeContent.content, status: 'review' }
        if (body.business !== undefined) {
          const business = validateBusinessInput(body.business)
          if (!business.ok) return json(400, { error: 'Invalid business information.', fields: business.errors }, cors())
          patch.business = business.value
        }
        if (body.research !== undefined) {
          const research = validateResearchSources(body.research)
          if (!research.ok) return json(400, { error: research.error }, cors())
          patch.research = research.sources
        }
        const updated = await db(`wm_projects?id=eq.${encodeURIComponent(projectId)}`, token, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify(patch) })
        return updated?.length ? json(200, { id: updated[0].id, status: updated[0].status, content: updated[0].content }, cors()) : json(404, { error: 'Project not found.' }, cors())
      }
      return json(405, { error: 'Method not allowed.' }, cors())
    } catch (error) {
      return asResponseError(error)
    }
  }
}

export function createPreviewApi({ env = process.env, fetchImpl = fetch, tokenFactory = () => randomBytes(32).toString('base64url'), now = () => Date.now() } = {}) {
  const projectApi = createProjectApi({ env, fetchImpl })
  const config = getWebsiteMachineConfig(env)
  return async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' }, cors())
    if (!config) return json(503, { error: 'Website Machine preview publishing is not configured.' }, cors())
    try {
      if (Buffer.byteLength(event.body || '') > 2000) return json(413, { error: 'Request is too large.' }, cors())
      const body = JSON.parse(event.body || '{}')
      const read = await projectApi({ httpMethod: 'GET', rawUrl: `https://local.invalid/.netlify/functions/website-machine-project?id=${encodeURIComponent(body.id || '')}`, headers: event.headers })
      if (read.statusCode !== 200) return read
      const project = JSON.parse(read.body)
      const previewToken = tokenFactory()
      const tokenHash = createHash('sha256').update(previewToken).digest('hex')
      const expiresAt = new Date(now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const previewUrl = new URL('/.netlify/functions/website-machine-render-preview', config.publicUrl)
      previewUrl.searchParams.set('id', project.id)
      previewUrl.searchParams.set('token', previewToken)
      const token = bearer(event)
      const saved = await fetchImpl(`${config.url}/rest/v1/wm_projects?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH', headers: { apikey: config.publishableKey, authorization: `Bearer ${token}`, 'content-type': 'application/json', prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'preview_ready', preview_deploy_id: null, preview_url: previewUrl.toString(), preview_token_hash: tokenHash, preview_expires_at: expiresAt }),
      })
      if (!saved.ok) throw new Error('Could not record preview state')
      return json(200, { status: 'ready', previewUrl: previewUrl.toString(), expiresAt, message: 'Secure preview is ready to share.' }, cors())
    } catch {
      return json(502, { error: 'Preview publishing failed.' }, cors())
    }
  }
}

export function createRenderPreviewApi({ env = process.env, fetchImpl = fetch } = {}) {
  const config = getWebsiteMachineConfig(env)
  return async (event) => {
    if (event.httpMethod !== 'GET') return { statusCode: 405, headers: { 'cache-control': 'no-store' }, body: '' }
    if (!config) return { statusCode: 503, headers: { 'cache-control': 'no-store' }, body: 'Preview unavailable.' }
    try {
      const url = new URL(event.rawUrl || `https://local.invalid${event.path || '/'}`)
      const id = url.searchParams.get('id') || ''
      const token = url.searchParams.get('token') || ''
      if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(token)) return { statusCode: 404, headers: { 'cache-control': 'no-store' }, body: 'Preview not found.' }
      const tokenHash = createHash('sha256').update(token).digest('hex')
      const response = await fetchImpl(`${config.url}/rest/v1/rpc/wm_get_public_preview`, { method: 'POST', headers: { apikey: config.publishableKey, 'content-type': 'application/json' }, body: JSON.stringify({ p_project_id: id, p_token_hash: tokenHash }) })
      if (!response.ok) throw new Error('Preview read failed')
      const rows = await response.json()
      if (!rows?.length) return { statusCode: 404, headers: { 'cache-control': 'no-store' }, body: 'Preview not found or expired.' }
      const html = renderStaticWebsite(rows[0].content, { noIndex: true })
      return { statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" }, body: html }
    } catch {
      return { statusCode: 502, headers: { 'cache-control': 'no-store' }, body: 'Preview unavailable.' }
    }
  }
}

export const handler = createProjectApi()
