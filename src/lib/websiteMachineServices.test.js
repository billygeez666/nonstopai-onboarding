import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResearchSources, buildResearchBrief } from './websiteMachineResearch.js'
import { createAuthApi, createProjectApi, createPreviewApi, createRenderPreviewApi } from './websiteMachineServer.js'
import { createDeliveryApi } from '../../netlify/functions/website-machine-delivery.js'

const business = { businessName: 'Northstar Motor Works', industry: 'Garage', location: 'Leeds', websiteUrl: '', verifiedInfo: 'MOT testing\nServicing' }
const content = { businessName: business.businessName, industry: business.industry, location: business.location, websiteUrl: '', heroTitle: 'Northstar Motor Works in Leeds', heroDescription: 'Garage · Leeds', aboutTitle: 'About Northstar', aboutDescription: 'Review supplied information.', facts: ['MOT testing', 'Servicing'], ctaLabel: 'Explore Northstar' }
const project = { id: 'c70f3d5f-f910-441a-9b39-8374d1d28532', owner_id: 'd3cbfcf4-7cb8-4f63-a20d-73d963a88791', business, content, research: [], status: 'draft' }
const env = { WM_STAGING_SUPABASE_URL: 'https://lqywsbqctoydtdqvjzzw.supabase.co', WM_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_wm_test' }
const accessToken = `eyJ${'a'.repeat(100)}`
const event = (httpMethod, body, headers = {}) => ({ httpMethod, body: body ? JSON.stringify(body) : '', headers, rawUrl: 'https://local.invalid/.netlify/functions/website-machine-project' })
const userFetch = async (url) => url.endsWith('/auth/v1/user') ? { ok: true, json: async () => ({ id: project.owner_id, email: 'wm-test@example.test' }) } : null

test('research requires HTTPS sources and labels findings as human verified', () => {
  const source = [{ label: 'Business website', url: 'https://northstar.example', findings: 'Offers servicing' }]
  assert.equal(validateResearchSources(source).ok, true)
  assert.equal(buildResearchBrief(source).verifiedFindings[0].provenance, 'human_verified')
  assert.equal(validateResearchSources([{ ...source[0], url: 'http://northstar.example' }]).ok, false)
  assert.equal(validateResearchSources([{ ...source[0], url: 'https://user:pass@northstar.example' }]).ok, false)
})

test('auth endpoint exchanges credentials server-side and returns only a bounded user session', async () => {
  let sent
  const handler = createAuthApi({ env, fetchImpl: async (url, options) => {
    sent = { url, options }
    return { ok: true, json: async () => ({ access_token: accessToken, refresh_token: 'must-not-return', expires_in: 3600, user: { id: project.owner_id, email: 'wm-test@example.test' } }) }
  } })
  const response = await handler(event('POST', { email: 'wm-test@example.test', password: 'test-only-password' }))
  const body = JSON.parse(response.body)
  assert.match(sent.url, /auth\/v1\/token\?grant_type=password$/)
  assert.equal(sent.options.headers.apikey, env.WM_STAGING_SUPABASE_PUBLISHABLE_KEY)
  assert.equal(body.accessToken, accessToken)
  assert.equal('refresh_token' in body, false)
  assert.equal(sent.options.body.includes('test-only-password'), true)
})

test('project creation rejects anonymous callers before any database write', async () => {
  let databaseCalls = 0
  const handler = createProjectApi({ env, fetchImpl: async (url) => {
    if (url.endsWith('/auth/v1/user')) return { ok: false }
    databaseCalls += 1
    return { ok: true, json: async () => [] }
  } })
  const response = await handler(event('POST', { business, content }, { 'idempotency-key': 'northstar-test-001' }))
  assert.equal(response.statusCode, 401)
  assert.equal(databaseCalls, 0)
})

test('project creation requires authenticated user and invokes the database rate-limited RPC', async () => {
  let rpcBody
  const handler = createProjectApi({ env, fetchImpl: async (url, options = {}) => {
    if (url.endsWith('/auth/v1/user')) return userFetch(url)
    assert.match(url, /\/rest\/v1\/rpc\/wm_create_project$/)
    assert.equal(options.headers.apikey, env.WM_STAGING_SUPABASE_PUBLISHABLE_KEY)
    assert.equal(options.headers.authorization, `Bearer ${accessToken}`)
    rpcBody = JSON.parse(options.body)
    return { ok: true, status: 200, json: async () => [project] }
  } })
  const response = await handler(event('POST', { business, content }, { authorization: `Bearer ${accessToken}`, 'idempotency-key': 'northstar-test-001' }))
  assert.equal(response.statusCode, 201)
  assert.equal(rpcBody.p_idempotency_key, 'northstar-test-001')
  assert.equal(JSON.parse(response.body).id, project.id)
  assert.doesNotMatch(response.body, /service_role|secret key/i)
})

test('database rate-limit failures return 429 rather than a generic server error', async () => {
  const handler = createProjectApi({ env, fetchImpl: async (url) => {
    if (url.endsWith('/auth/v1/user')) return userFetch(url)
    return { ok: false, status: 400, json: async () => ({ code: 'P0001', message: 'project creation rate limit exceeded' }) }
  } })
  const response = await handler(event('POST', { business, content }, { authorization: `Bearer ${accessToken}`, 'idempotency-key': 'northstar-test-002' }))
  assert.equal(response.statusCode, 429)
  assert.match(JSON.parse(response.body).error, /limit reached/)
})

test('owner project edits pass through authenticated PostgREST and validate source provenance', async () => {
  let patchBody
  const handler = createProjectApi({ env, fetchImpl: async (url, options = {}) => {
    if (url.endsWith('/auth/v1/user')) return userFetch(url)
    if (options.method === 'PATCH') {
      patchBody = JSON.parse(options.body)
      return { ok: true, status: 200, json: async () => [{ ...project, ...patchBody }] }
    }
    return { ok: true, status: 200, json: async () => [project] }
  } })
  const response = await handler({ ...event('PUT', { business, content, research: [{ label: 'Business page', url: 'https://northstar.example', findings: 'Offers MOT testing' }] }, { authorization: `Bearer ${accessToken}` }), rawUrl: `https://local.invalid/.netlify/functions/website-machine-project?id=${project.id}` })
  assert.equal(response.statusCode, 200)
  assert.equal(patchBody.status, 'review')
  assert.equal(patchBody.research[0].status, 'human_verified')
})

test('preview publishing stores only a hash and returns an expiring staging share link', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: project.owner_id }) }
    if (url.includes('/rest/v1/wm_projects?')) return { ok: true, status: 200, json: async () => [project] }
    if (url.includes('/rest/v1/wm_projects?id=')) return { ok: true, status: 204 }
    throw new Error('Unexpected external request')
  }
  const handler = createPreviewApi({ env, fetchImpl, tokenFactory: () => 'z'.repeat(43), now: () => Date.parse('2026-11-16T00:00:00Z') })
  const response = await handler(event('POST', { id: project.id }, { authorization: `Bearer ${accessToken}` }))
  assert.equal(response.statusCode, 200)
  const payload = JSON.parse(response.body)
  const previewUrl = new URL(payload.previewUrl)
  assert.equal(previewUrl.origin, 'https://nonstopai-staging-preview.netlify.app')
  assert.equal(previewUrl.searchParams.get('token'), 'z'.repeat(43))
  const update = JSON.parse(calls[2].options.body)
  assert.equal(update.status, 'preview_ready')
  assert.equal(update.preview_expires_at, '2026-11-23T00:00:00.000Z')
  assert.notEqual(update.preview_token_hash, 'z'.repeat(43))
  assert.equal(calls[2].options.headers.authorization, `Bearer ${accessToken}`)
  assert.equal(calls.some((call) => call.url.includes('api.netlify.com')), false)
})

test('public preview serves only a valid database-matched, unexpired token as noindex HTML', async () => {
  const token = 'y'.repeat(43)
  let rpcBody
  const handler = createRenderPreviewApi({ env, fetchImpl: async (url, options) => {
    assert.match(url, /\/rest\/v1\/rpc\/wm_get_public_preview$/)
    rpcBody = JSON.parse(options.body)
    return { ok: true, json: async () => [{ content }] }
  } })
  const response = await handler({ httpMethod: 'GET', rawUrl: `https://nonstopai-staging-preview.netlify.app/.netlify/functions/website-machine-render-preview?id=${project.id}&token=${token}` })
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow')
  assert.match(response.body, /name="robots" content="noindex,nofollow"/)
  assert.equal(rpcBody.p_project_id, project.id)
  assert.equal(rpcBody.p_token_hash.length, 64)
  assert.match(response.body, /Northstar Motor Works/)
  assert.doesNotMatch(response.body, /<script>/)
  const invalid = await handler({ httpMethod: 'GET', rawUrl: `https://nonstopai-staging-preview.netlify.app/.netlify/functions/website-machine-render-preview?id=${project.id}&token=short` })
  assert.equal(invalid.statusCode, 404)
})

test('delivery returns a fixed static attachment only to the authenticated project owner', async () => {
  const handler = createDeliveryApi({ env, fetchImpl: async (url) => {
    if (url.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: project.owner_id }) }
    return { ok: true, status: 200, json: async () => [project] }
  } })
  const response = await handler({ ...event('GET', null, { authorization: `Bearer ${accessToken}` }), rawUrl: `https://local.invalid/.netlify/functions/website-machine-delivery?id=${project.id}` })
  assert.equal(response.statusCode, 200)
  assert.match(response.headers['content-disposition'], /northstar-motor-works\.html/)
  assert.match(response.headers['cache-control'], /no-store/)
  assert.doesNotMatch(response.body, /<script>/)
})
