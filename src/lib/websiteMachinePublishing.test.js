import test from 'node:test'
import assert from 'node:assert/strict'
import { createDomainChallenge, createNetlifyCustomerPublisher, makeStaticWebsiteZip, normalizeCustomerDomain, verifyDomainChallenge } from './websiteMachinePublishing.js'

const projectId = 'c70f3d5f-f910-441a-9b39-8374d1d28532'
const ownerId = 'd3cbfcf4-7cb8-4f63-a20d-73d963a88791'
const siteId = '61c134de-8e15-4cb9-86ea-9f9f92f03d27'
const content = { businessName: 'A&B Garage', industry: 'Garage', location: 'Leeds', websiteUrl: '', heroTitle: 'A&B Garage in Leeds', heroDescription: 'Business information for A&B Garage: Garage · Leeds.', aboutTitle: 'About A&B Garage', aboutDescription: 'Review the business information provided.', facts: ['MOT testing'], ctaLabel: 'Explore A&B Garage' }
const env = { WM_NETLIFY_CUSTOMER_TOKEN: 'netlify-test-only-token' }

test('customer domains are normalized and reject URL syntax, IPs, reserved hosts, and invalid labels', () => {
  assert.equal(normalizeCustomerDomain(' WWW.Example.co.uk. '), 'www.example.co.uk')
  for (const invalid of ['https://example.co.uk', 'localhost', '127.0.0.1', 'x.netlify.app', 'bad..example.org', 'user@domain.com', 'domain.test']) {
    assert.equal(normalizeCustomerDomain(invalid), null, invalid)
  }
})

test('domain challenge checks the exact TXT token and fails closed on DNS errors', async () => {
  const challenge = createDomainChallenge({ domain: 'example.co.uk', token: 'a'.repeat(43) })
  assert.equal(challenge.recordName, '_nonstopai-verify.example.co.uk')
  assert.equal(await verifyDomainChallenge({ domain: challenge.domain, token: challenge.token, resolveTxt: async () => [['other'], [challenge.recordValue]] }), true)
  assert.equal(await verifyDomainChallenge({ domain: challenge.domain, token: challenge.token, resolveTxt: async () => [['nonstopai-site-verification=wrong']] }), false)
  assert.equal(await verifyDomainChallenge({ domain: challenge.domain, token: challenge.token, resolveTxt: async () => { throw new Error('NXDOMAIN') } }), false)
})

test('static site archive is a ZIP containing only a fixed index.html document', () => {
  const zip = makeStaticWebsiteZip('<!doctype html><h1>test</h1>')
  assert.equal(zip.readUInt32LE(0), 0x04034b50)
  assert.equal(zip.toString('utf8').includes('index.html'), true)
  assert.equal(zip.toString('utf8').includes('<script'), false)
})

test('unpaid projects cannot create a Netlify site', async () => {
  let calls = 0
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl: async () => { calls += 1 } })
  await assert.rejects(publisher.publishPaidProject({ paid: false, projectId, ownerId, content }), /confirmed paid order/)
  assert.equal(calls, 0)
})

test('site creation requires durable association and records a new isolated site before deploying', async () => {
  const calls = []
  const persisted = []
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (url === 'https://api.netlify.com/api/v1/sites') return { ok: true, status: 200, json: async () => ({ id: siteId, name: siteName, ssl_url: `https://${siteName}.netlify.app` }) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}/metadata` && options.method === 'PUT') return { ok: true, status: 200, json: async () => ({}) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}/metadata`) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}` && options.method === 'PUT') return { ok: true, status: 200, json: async () => ({ id: '0123456789abcdef01234567', site_id: siteId, state: 'ready', deploy_ssl_url: 'https://0123456789abcdef--wm-test.netlify.app' }) }
    if (url === 'https://0123456789abcdef--wm-test.netlify.app') return { ok: true, headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<h1>A&amp;B Garage</h1>' }
    throw new Error(`Unexpected request ${url}`)
  }
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl, persistSite: async (record) => persisted.push(record) })
  const result = await publisher.publishPaidProject({ paid: true, projectId, ownerId, content })
  assert.equal(result.verified, true)
  assert.equal(result.siteId, siteId)
  assert.equal(result.siteName, siteName)
  assert.equal(persisted[0].siteId, siteId)
  assert.equal(persisted[0].projectId, projectId)
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[1].options.method, 'PUT')
  assert.match(calls[1].url, /\/metadata$/)
  assert.equal(calls[3].options.method, 'PUT')
  assert.equal(calls[3].options.headers['content-type'], 'application/zip')
})

test('custom domain must be verified and unused before a customer site is created', async () => {
  let creates = 0
  const challenge = createDomainChallenge({ domain: 'example.co.uk', token: 'b'.repeat(43) })
  const publisher = createNetlifyCustomerPublisher({
    env,
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/sites/example.co.uk')) return { status: 404 }
      if (url.endsWith('/sites')) { creates += 1; return { ok: true, status: 200, json: async () => ({ id: siteId, name: `wm-${projectId.replaceAll('-', '')}`, custom_domain: 'example.co.uk', ssl_url: 'https://example.netlify.app' }) } }
      if (url.endsWith(`/sites/${siteId}/metadata`) && options.method === 'PUT') return { ok: true, status: 200, json: async () => ({}) }
      if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
      if (options.method === 'PUT') return { ok: true, status: 200, json: async () => ({ id: '0123456789abcdef01234567', site_id: siteId, state: 'ready', deploy_ssl_url: 'https://0123456789abcdef--wm-test.netlify.app' }) }
      if (url === 'https://0123456789abcdef--wm-test.netlify.app') return { ok: true, headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<h1>A&amp;B Garage</h1>' }
      throw new Error('Unexpected request')
    },
    resolveTxt: async (host) => host === challenge.recordName ? [[challenge.recordValue]] : [],
    persistSite: async () => {},
  })
  await assert.rejects(publisher.publishPaidProject({ paid: true, projectId, ownerId, content, domain: challenge.domain, domainChallenge: { ...challenge, token: 'wrong' } }), /TXT ownership/)
  assert.equal(creates, 0)
  const result = await publisher.publishPaidProject({ paid: true, projectId, ownerId, content, domain: challenge.domain, domainChallenge: challenge })
  assert.equal(result.url, 'https://example.co.uk')
  assert.equal(creates, 1)
})

test('rollback requires an owner-matched Website Machine site and prior deploy id', async () => {
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const siteRecord = { projectId, ownerId, siteId, siteName, previousDeployIds: ['0123456789abcdef01234567'] }
  const calls = []
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl: async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
    if (url.endsWith(`/sites/${siteId}`)) return { ok: true, status: 200, json: async () => ({ id: siteId, name: siteName, ssl_url: `https://${siteName}.netlify.app`, published_deploy: { id: '0123456789abcdef01234567', deploy_ssl_url: 'https://0123456789abcdef--wm-test.netlify.app' } }) }
    if (url.endsWith('/deploys/0123456789abcdef01234567')) return { ok: true, status: 200, json: async () => ({ id: '0123456789abcdef01234567', site_id: siteId, state: 'ready', deploy_ssl_url: 'https://old--site.netlify.app' }) }
    if (url.endsWith('/restore')) return { ok: true, status: 204, json: async () => null }
    if (url === 'https://0123456789abcdef--wm-test.netlify.app') return { ok: true, headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<!doctype html><title>restored</title>' }
    throw new Error('Unexpected request')
  } })
  await assert.rejects(publisher.rollback({ ownerId, projectId, siteRecord, deployId: 'fedcba9876543210' }), /Invalid customer site rollback/)
  await publisher.rollback({ ownerId, projectId, siteRecord, deployId: '0123456789abcdef01234567' })
  const restoreCall = calls.find((call) => call.url.endsWith('/restore'))
  assert.equal(restoreCall.options.method, 'POST')
  assert.match(restoreCall.url, /\/deploys\/0123456789abcdef01234567\/restore$/)
})
