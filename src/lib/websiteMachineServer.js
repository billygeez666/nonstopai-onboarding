import { createHash, createHmac, randomBytes } from 'node:crypto'
import { generateWebsiteContent, renderStaticWebsite, sanitizeWebsiteContent, validateBusinessInput } from './websiteMachine.js'
import { validateResearchSources } from './websiteMachineResearch.js'

const digest = (value) => createHash('sha256').update(value).digest('hex')
const STAGING_SUPABASE_URL = 'https://tszblrmdupgvhowcedgo.supabase.co'
const STAGING_NETLIFY_SITE_ID = 'd9d04372-76e4-42d1-8ff2-1b1cbd79befa'
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) })
const cors = (headers = {}) => ({ ...headers, 'access-control-allow-origin': process.env.URL || 'http://localhost:5173', 'access-control-allow-headers': 'content-type, authorization, idempotency-key', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'vary': 'Origin' })

export function createProjectApi({ env = process.env, fetchImpl = fetch, uuid = () => randomBytes(32).toString('base64url') } = {}) {
  async function db(path, options = {}) {
    const response = await fetchImpl(`${env.WM_STAGING_SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: env.WM_STAGING_SUPABASE_SECRET_KEY, authorization: `Bearer ${env.WM_STAGING_SUPABASE_SECRET_KEY}`, 'content-type': 'application/json', ...options.headers } })
    if (!response.ok) throw new Error(`Storage request failed (${response.status})`)
    return response.status === 204 ? null : response.json()
  }

  return async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() }
    if (env.WM_STAGING_SUPABASE_URL !== STAGING_SUPABASE_URL || !env.WM_STAGING_SUPABASE_SECRET_KEY) return json(503, { error: 'Website Machine staging storage is not configured.' })
    try {
      const url = new URL(event.rawUrl || `https://local.invalid${event.path || '/'}`)
      if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}')
        if (Buffer.byteLength(event.body || '') > 20000) return json(413, { error: 'Request is too large.' })
        const input = validateBusinessInput(body.business)
        if (!input.ok) return json(400, { error: 'Invalid business information.', fields: input.errors })
        const generated = generateWebsiteContent(input.value)
        const safeContent = sanitizeWebsiteContent(body.content || generated.content)
        if (!safeContent.ok) return json(400, { error: safeContent.error })
        const safeResearch = validateResearchSources(body.research || [])
        if (!safeResearch.ok) return json(400, { error: safeResearch.error })
        const preview = renderStaticWebsite(safeContent.content)
        if (preview.length > 150000) return json(400, { error: 'Website content is too large.' })
        const key = event.headers?.['idempotency-key'] || event.headers?.['Idempotency-Key'] || uuid()
        if (!/^[A-Za-z0-9_-]{12,100}$/.test(key)) return json(400, { error: 'Invalid idempotency key.' })
        const token = createHmac('sha256', env.WM_STAGING_SUPABASE_SECRET_KEY).update(`website-machine-project:${key}`).digest('base64url')
        const rows = await db('website_machine_projects?on_conflict=idempotency_key', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ idempotency_key: key, access_token_hash: digest(token), business: input.value, content: safeContent.content, research: safeResearch.sources, status: 'draft' }) })
        const saved = rows?.length ? rows : await db(`website_machine_projects?idempotency_key=eq.${encodeURIComponent(key)}&access_token_hash=eq.${digest(token)}&select=id,content,status`)
        if (!saved?.length) return json(500, { error: 'Project could not be saved.' })
        return json(rows?.length ? 201 : 200, { id: saved[0].id, accessToken: token, status: saved[0].status || 'draft', content: saved[0].content })
      }
      const projectId = url.searchParams.get('id')
      const token = (event.headers?.authorization || '').replace(/^Bearer\s+/i, '')
      if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId) || !/^[A-Za-z0-9_-]{32,100}$/.test(token)) return json(401, { error: 'Valid project access is required.' })
      const rows = await db(`website_machine_projects?id=eq.${encodeURIComponent(projectId)}&access_token_hash=eq.${digest(token)}&select=id,business,content,research,status,created_at,updated_at`)
      if (!rows?.length) return json(404, { error: 'Project not found.' })
      if (event.httpMethod === 'GET') return json(200, rows[0])
      if (event.httpMethod === 'PUT') {
        const body = JSON.parse(event.body || '{}')
        if (Buffer.byteLength(event.body || '') > 20000) return json(413, { error: 'Request is too large.' })
        const safeContent = sanitizeWebsiteContent(body.content)
        if (!safeContent.ok || renderStaticWebsite(safeContent.content).length > 150000) return json(400, { error: 'Invalid website content.' })
        const content = safeContent.content
        const patch = { content, status: 'review' }
        if (body.business !== undefined) {
          const business = validateBusinessInput(body.business)
          if (!business.ok) return json(400, { error: 'Invalid business information.', fields: business.errors })
          patch.business = business.value
        }
        if (body.research !== undefined) {
          const research = validateResearchSources(body.research)
          if (!research.ok) return json(400, { error: research.error })
          patch.research = research.sources
        }
        const updated = await db(`website_machine_projects?id=eq.${encodeURIComponent(projectId)}&access_token_hash=eq.${digest(token)}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify(patch) })
        return updated?.length ? json(200, { id: updated[0].id, status: updated[0].status, content: updated[0].content }) : json(404, { error: 'Project not found.' })
      }
      return json(405, { error: 'Method not allowed.' })
    } catch {
      return json(500, { error: 'Website Machine request failed.' })
    }
  }
}

export function createPreviewApi({ env = process.env, fetchImpl = fetch, hash = (html) => createHash('sha1').update(html).digest('hex') } = {}) {
  const projectApi = createProjectApi({ env, fetchImpl })
  return async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors() }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' })
    if (env.WM_STAGING_NETLIFY_SITE_ID !== STAGING_NETLIFY_SITE_ID || !env.WM_STAGING_NETLIFY_TOKEN) return json(503, { error: 'Website Machine staging preview publishing is not configured.' })
    try {
      if (Buffer.byteLength(event.body || '') > 2000) return json(413, { error: 'Request is too large.' })
      const body = JSON.parse(event.body || '{}')
      const read = await projectApi({ httpMethod: 'GET', rawUrl: `https://local.invalid/.netlify/functions/website-machine-project?id=${encodeURIComponent(body.id || '')}`, headers: event.headers })
      if (read.statusCode !== 200) return read
      const html = renderStaticWebsite(read.body ? JSON.parse(read.body).content : {})
      const sha = hash(html)
      const response = await fetchImpl(`https://api.netlify.com/api/v1/sites/${STAGING_NETLIFY_SITE_ID}/deploys`, { method: 'POST', headers: { authorization: `Bearer ${env.WM_STAGING_NETLIFY_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ draft: true, files: { '/index.html': sha } }) })
      if (!response.ok) throw new Error('Preview deploy create failed')
      const deploy = await response.json()
      if ((deploy.required || []).includes(sha)) {
        const upload = await fetchImpl(`https://api.netlify.com/api/v1/deploys/${encodeURIComponent(deploy.id)}/files/index.html`, { method: 'PUT', headers: { authorization: `Bearer ${env.WM_STAGING_NETLIFY_TOKEN}`, 'content-type': 'application/octet-stream' }, body: html })
        if (!upload.ok) throw new Error('Preview upload failed')
      }
      let previewUrl = ''
      try {
        const candidate = new URL(deploy.deploy_url)
        if (candidate.protocol === 'https:' && candidate.hostname.endsWith('.netlify.app')) previewUrl = candidate.toString()
      } catch {
        // Some deploy responses omit deploy_url while a preview is being prepared.
      }
      const accessToken = (event.headers?.authorization || '').replace(/^Bearer\s+/i, '')
      const projectId = encodeURIComponent(body.id)
      const saved = await fetchImpl(`${STAGING_SUPABASE_URL}/rest/v1/website_machine_projects?id=eq.${projectId}&access_token_hash=eq.${digest(accessToken)}`, {
        method: 'PATCH', headers: { apikey: env.WM_STAGING_SUPABASE_SECRET_KEY, authorization: `Bearer ${env.WM_STAGING_SUPABASE_SECRET_KEY}`, 'content-type': 'application/json', prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'preview_pending', preview_deploy_id: deploy.id, preview_url: previewUrl || null }),
      })
      if (!saved.ok) throw new Error('Could not record preview state')
      return json(202, { deployId: deploy.id, status: 'processing', ...(previewUrl ? { previewUrl } : {}), message: 'Preview draft submitted. Confirm the deploy is ready before sharing.' })
    } catch {
      return json(502, { error: 'Preview publishing failed.' })
    }
  }
}

export const handler = createProjectApi()
