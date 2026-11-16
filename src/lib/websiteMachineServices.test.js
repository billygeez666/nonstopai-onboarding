import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResearchSources, buildResearchBrief } from './websiteMachineResearch.js'
import { createProjectApi, createPreviewApi } from './websiteMachineServer.js'
import { createDeliveryApi } from '../../netlify/functions/website-machine-delivery.js'

const business = { businessName: 'Northstar Motor Works', industry: 'Garage', location: 'Leeds', websiteUrl: '', verifiedInfo: 'MOT testing\nServicing' }
const content = { businessName: business.businessName, industry: business.industry, location: business.location, websiteUrl: '', heroTitle: 'Northstar Motor Works in Leeds', heroDescription: 'Garage · Leeds', aboutTitle: 'About Northstar', aboutDescription: 'Review supplied information.', facts: ['MOT testing', 'Servicing'], ctaLabel: 'Explore Northstar' }
const env = { WM_STAGING_SUPABASE_URL: 'https://tszblrmdupgvhowcedgo.supabase.co', WM_STAGING_SUPABASE_SECRET_KEY: 'staging-only-secret', WM_STAGING_NETLIFY_SITE_ID: 'd9d04372-76e4-42d1-8ff2-1b1cbd79befa', WM_STAGING_NETLIFY_TOKEN: 'staging-netlify-token' }
const event = (httpMethod, body, headers = {}) => ({ httpMethod, body: body ? JSON.stringify(body) : '', headers, rawUrl: 'https://local.invalid/.netlify/functions/website-machine-project' })

test('research requires HTTPS sources and labels findings as human verified', () => {
  const source = [{ label: 'Business website', url: 'https://northstar.example', findings: 'Offers servicing' }]
  assert.equal(validateResearchSources(source).ok, true)
  assert.equal(buildResearchBrief(source).verifiedFindings[0].provenance, 'human_verified')
  assert.equal(validateResearchSources([{ ...source[0], url: 'http://northstar.example' }]).ok, false)
  assert.equal(validateResearchSources([{ ...source[0], url: 'https://user:pass@northstar.example' }]).ok, false)
})

test('project persistence keeps server key private and stores only a digest of access token', async () => {
  let stored
  const handler = createProjectApi({ env, uuid: () => 'a'.repeat(43), fetchImpl: async (url, options) => {
    assert.match(url, /tszblrmdupgvhowcedgo\.supabase\.co\/rest\/v1\/website_machine_projects/)
    assert.equal(options.headers.apikey, env.WM_STAGING_SUPABASE_SECRET_KEY)
    stored = JSON.parse(options.body)
    return { ok: true, status: 201, json: async () => [{ id: 'c70f3d5f-f910-441a-9b39-8374d1d28532', content: stored.content }] }
  } })
  const response = await handler(event('POST', { business, content }, { 'idempotency-key': 'northstar-test-001' }))
  const result = JSON.parse(response.body)
  assert.equal(response.statusCode, 201)
  assert.equal(stored.access_token_hash.length, 64)
  assert.equal(JSON.stringify(result).includes(env.WM_STAGING_SUPABASE_SECRET_KEY), false)
  assert.match(result.accessToken, /^[A-Za-z0-9_-]{43}$/)
})

test('project creation is retry safe for a repeated idempotency key', async () => {
  let insertCount = 0
  const handler = createProjectApi({ env, fetchImpl: async (url, options) => {
    if (options.method === 'POST') {
      insertCount += 1
      return { ok: true, status: 201, json: async () => insertCount === 1 ? [{ id: 'c70f3d5f-f910-441a-9b39-8374d1d28532', content, status: 'draft' }] : [] }
    }
    return { ok: true, status: 200, json: async () => [{ id: 'c70f3d5f-f910-441a-9b39-8374d1d28532', content, status: 'draft' }] }
  } })
  const request = event('POST', { business, content }, { 'idempotency-key': 'northstar-retry-001' })
  const first = JSON.parse((await handler(request)).body)
  const retryResponse = await handler(request)
  assert.equal(retryResponse.statusCode, 200)
  assert.equal(JSON.parse(retryResponse.body).accessToken, first.accessToken)
  assert.equal(insertCount, 2)
})

test('project edits validate and persist business data, copy, and source provenance under bearer auth', async () => {
  let patchBody
  const handler = createProjectApi({ env, fetchImpl: async (url, options = {}) => {
    if (options.method === 'PATCH') {
      patchBody = JSON.parse(options.body)
      return { ok: true, status: 200, json: async () => [{ id: 'c70f3d5f-f910-441a-9b39-8374d1d28532', ...patchBody }] }
    }
    return { ok: true, status: 200, json: async () => [{ id: 'c70f3d5f-f910-441a-9b39-8374d1d28532' }] }
  } })
  const response = await handler({ ...event('PUT', { business, content, research: [{ label: 'Business page', url: 'https://northstar.example', findings: 'Offers MOT testing' }] }, { authorization: `Bearer ${'c'.repeat(43)}` }), rawUrl: 'https://local.invalid/.netlify/functions/website-machine-project?id=c70f3d5f-f910-441a-9b39-8374d1d28532' })
  assert.equal(response.statusCode, 200)
  assert.equal(patchBody.status, 'review')
  assert.equal(patchBody.research[0].status, 'human_verified')
  assert.equal(patchBody.business.businessName, business.businessName)
})

test('project endpoint rejects missing storage configuration and oversized requests', async () => {
  assert.equal((await createProjectApi({ env: {} })(event('POST', { business }))).statusCode, 503)
  const oversized = await createProjectApi({ env })(event('POST', { business, extra: 'x'.repeat(21000) }))
  assert.equal(oversized.statusCode, 413)
})

test('preview publish uses a draft deploy and never accepts caller supplied HTML or site ID', async () => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.includes('/rest/v1/')) return { ok: true, status: 200, json: async () => [{ id: 'c70f3d5f-f910-441a-9b39-8374d1d28532', content, business }] }
    if (url.endsWith('/deploys')) return { ok: true, status: 201, json: async () => ({ id: 'deploy-123', deploy_url: 'https://deploy-123--nonstopai-staging-preview.netlify.app', required: ['hash'] }) }
    return { ok: true, status: 200, json: async () => ({}) }
  }
  const handler = createPreviewApi({ env, fetchImpl, hash: () => 'hash' })
  const response = await handler({ ...event('POST', { id: 'c70f3d5f-f910-441a-9b39-8374d1d28532', html: '<script>x</script>', siteId: 'production' }, { authorization: `Bearer ${'b'.repeat(43)}` }) })
  assert.equal(response.statusCode, 202)
  assert.equal(JSON.parse(calls[1].options.body).draft, true)
  assert.equal(calls[1].url.includes('d9d04372-76e4-42d1-8ff2-1b1cbd79befa'), true)
  assert.equal(calls[1].options.body.includes('production'), false)
  assert.equal(JSON.parse(response.body).previewUrl, 'https://deploy-123--nonstopai-staging-preview.netlify.app/')
  assert.match(calls[2].options.body, /Northstar Motor Works/)
  assert.doesNotMatch(calls[2].options.body, /<script>/)
  assert.equal(calls[3].options.method, 'PATCH')
  assert.match(calls[3].options.body, /preview_pending/)
})

test('delivery returns the fixed static template as a private attachment', async () => {
  const handler = createDeliveryApi({ env, fetchImpl: async () => ({ ok: true, status: 200, json: async () => [{ business, content }] }) })
  const response = await handler({ ...event('GET', null, { authorization: `Bearer ${'b'.repeat(43)}` }), rawUrl: 'https://local.invalid/.netlify/functions/website-machine-delivery?id=c70f3d5f-f910-441a-9b39-8374d1d28532' })
  assert.equal(response.statusCode, 200)
  assert.match(response.headers['content-disposition'], /northstar-motor-works\.html/)
  assert.match(response.headers['cache-control'], /no-store/)
  assert.doesNotMatch(response.body, /<script>/)
})
