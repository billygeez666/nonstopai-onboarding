import test from 'node:test'
import assert from 'node:assert/strict'
import { createDomainChallenge, createNetlifyCustomerPublisher, makeStaticWebsiteZip, normalizeCustomerDomain, verifyDomainChallenge } from './websiteMachinePublishing.js'

const projectId = 'c70f3d5f-f910-441a-9b39-8374d1d28532'
const ownerId = 'd3cbfcf4-7cb8-4f63-a20d-73d963a88791'
const siteId = '61c134de-8e15-4cb9-86ea-9f9f92f03d27'
const accountId = '3a0e2347-0ab3-4a76-ab4a-a2ab6947ef90'
const content = { businessName: 'A&B Garage', industry: 'Garage', location: 'Leeds', websiteUrl: '', heroTitle: 'A&B Garage in Leeds', heroDescription: 'Business information for A&B Garage: Garage · Leeds.', aboutTitle: 'About A&B Garage', aboutDescription: 'Review the business information provided.', facts: ['MOT testing'], ctaLabel: 'Explore A&B Garage' }
const env = { WM_NETLIFY_CUSTOMER_TOKEN: 'netlify-test-only-token', WM_NETLIFY_ACCOUNT_SLUG: 'nonstopai-website-machine-test' }

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
  const html = '<!doctype html><html><head><title>test</title></head><body><h1>test</h1></body></html>'
  const zip = makeStaticWebsiteZip(html)
  assert.equal(zip.readUInt32LE(0), 0x04034b50)
  const files = new Map()
  let offset = 0
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const nameLength = zip.readUInt16LE(offset + 26)
    const extraLength = zip.readUInt16LE(offset + 28)
    const bodyLength = zip.readUInt32LE(offset + 22)
    const nameStart = offset + 30
    const bodyStart = nameStart + nameLength + extraLength
    const name = zip.subarray(nameStart, nameStart + nameLength).toString('utf8')
    assert.equal(zip.readUInt16LE(offset + 8), 0, 'static files use ZIP store mode without transformations')
    files.set(name, zip.subarray(bodyStart, bodyStart + bodyLength).toString('utf8'))
    offset = bodyStart + bodyLength
  }
  assert.deepEqual([...files.keys()], ['index.html', '_headers'])
  assert.equal(files.get('index.html'), html)
  assert.match(files.get('_headers'), /^\/\n\s+Content-Type: text\/html; charset=utf-8/m)
  assert.match(files.get('_headers'), /^\/index\.html\n\s+Content-Type: text\/html; charset=utf-8/m)
  assert.match(html, /^<!doctype html>/i)
  assert.equal(html.includes('<script'), false)
})

test('unpaid projects cannot create a Netlify site', async () => {
  let calls = 0
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl: async () => { calls += 1 } })
  await assert.rejects(publisher.publishPaidProject({ paid: false, projectId, ownerId, content }), /confirmed paid order/)
  assert.equal(calls, 0)
})

test('Netlify publisher errors carry a bounded operation label for webhook diagnostics', async () => {
  const publisher = createNetlifyCustomerPublisher({
    env,
    fetchImpl: async () => { throw new TypeError('private provider response: netlify-test-only-token') },
    persistSite: async () => {},
  })

  await assert.rejects(publisher.publishPaidProject({ paid: true, projectId, ownerId, content }), (error) => {
    assert.equal(error.name, 'TypeError')
    assert.equal(error.websiteMachineOperation, 'netlify_account_lookup')
    return true
  })
})

test('transient first ZIP upload failure is retried and recovers without duplicating the customer site', async () => {
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const deployId = '0123456789abcdef01234567'
  const siteRecord = { projectId, ownerId, siteId, siteName, customDomain: null, currentDeployId: null, previousDeployIds: [] }
  let uploadAttempts = 0
  let listCalls = 0
  let waitCalls = 0
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
    if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}` && options.method !== 'PUT') return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: siteName, ssl_url: `https://${siteName}.netlify.app` }) }
    if (url.endsWith(`/sites/${siteId}/deploys?per_page=10`)) { listCalls += 1; return { ok: true, status: 200, json: async () => [] } }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}` && options.method === 'PUT') {
      uploadAttempts += 1
      if (uploadAttempts === 1) return { ok: false, status: 503, headers: new Headers({ 'x-nf-error-code': 'temporarily_unavailable', 'x-nf-request-id': 'netlifyReq123456' }), clone: () => ({ json: async () => ({ message: 'private error must not be logged' }) }) }
      return { ok: true, status: 200, json: async () => ({ id: deployId, site_id: siteId, state: 'ready', deploy_ssl_url: `https://${deployId}--${siteName}.netlify.app` }) }
    }
    if (url === `https://${deployId}--${siteName}.netlify.app`) return { ok: true, headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }), text: async () => '<!doctype html><h1>A&amp;B Garage</h1>' }
    throw new Error(`Unexpected request ${url}`)
  }
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl, sleep: async () => { waitCalls += 1 }, persistSite: async () => {} })

  const result = await publisher.publishPaidProject({ paid: true, projectId, ownerId, content, siteRecord })

  assert.equal(result.verified, true)
  assert.equal(result.deployId, deployId)
  assert.equal(uploadAttempts, 2)
  assert.equal(listCalls, 2)
  assert.equal(waitCalls, 1)
})

test('a 2xx upload response missing deployment metadata reuses the newly observed deploy instead of uploading again', async () => {
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const deployId = 'abcdef0123456789abcdef01'
  const siteRecord = { projectId, ownerId, siteId, siteName, customDomain: null, currentDeployId: null, previousDeployIds: [] }
  let uploadAttempts = 0
  let listCalls = 0
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
    if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}` && options.method !== 'PUT') return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: siteName, ssl_url: `https://${siteName}.netlify.app` }) }
    if (url.endsWith(`/sites/${siteId}/deploys?per_page=10`)) {
      listCalls += 1
      const deploys = listCalls === 1 ? [] : [{ id: deployId, site_id: siteId, state: 'ready', created_at: '2026-11-18T14:35:24.000Z', deploy_ssl_url: `https://${deployId}--${siteName}.netlify.app` }]
      return { ok: true, status: 200, json: async () => deploys }
    }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}` && options.method === 'PUT') { uploadAttempts += 1; return { ok: true, status: 200, headers: new Headers({ 'x-nf-request-id': 'netlifyReq123456' }), json: async () => ({}) } }
    if (url === `https://${deployId}--${siteName}.netlify.app`) return { ok: true, headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<h1>A&amp;B Garage</h1>' }
    throw new Error(`Unexpected request ${url}`)
  }
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl, persistSite: async () => {} })

  const result = await publisher.publishPaidProject({ paid: true, projectId, ownerId, content, siteRecord })

  assert.equal(result.verified, true)
  assert.equal(result.deployId, deployId)
  assert.equal(uploadAttempts, 1)
  assert.equal(listCalls, 2)
})

test('unreconciled 2xx upload responses report a safe shape code and HTTP status without retrying blindly', async () => {
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const siteRecord = { projectId, ownerId, siteId, siteName, customDomain: null, currentDeployId: null, previousDeployIds: [] }
  let uploadAttempts = 0
  const publisher = createNetlifyCustomerPublisher({
    env,
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
      if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
      if (url === `https://api.netlify.com/api/v1/sites/${siteId}` && options.method !== 'PUT') return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: siteName, ssl_url: `https://${siteName}.netlify.app` }) }
      if (url.endsWith(`/sites/${siteId}/deploys?per_page=10`)) return { ok: true, status: 200, json: async () => [] }
      if (url === `https://api.netlify.com/api/v1/sites/${siteId}` && options.method === 'PUT') { uploadAttempts += 1; return { ok: true, status: 200, headers: new Headers({ 'x-nf-request-id': 'netlifyReq123456' }), json: async () => ({}) } }
      throw new Error(`Unexpected request ${url}`)
    },
    persistSite: async () => {},
  })

  await assert.rejects(publisher.publishPaidProject({ paid: true, projectId, ownerId, content, siteRecord }), (error) => {
    assert.equal(error.code, 'NETLIFY_DEPLOY_ID_MISSING')
    assert.equal(error.status, 200)
    assert.equal(error.netlifyRequestId, 'netlifyReq123456')
    assert.equal(error.websiteMachineOperation, 'netlify_deploy_upload')
    return true
  })
  assert.equal(uploadAttempts, 1)
})

test('permanent upload failures are not retried and expose only sanitized provider metadata', async () => {
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const siteRecord = { projectId, ownerId, siteId, siteName, customDomain: null, currentDeployId: null, previousDeployIds: [] }
  let uploadAttempts = 0
  const publisher = createNetlifyCustomerPublisher({
    env,
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
      if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
      if (url === `https://api.netlify.com/api/v1/sites/${siteId}` && options.method !== 'PUT') return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: siteName, ssl_url: `https://${siteName}.netlify.app` }) }
      if (url.endsWith(`/sites/${siteId}/deploys?per_page=10`)) return { ok: true, status: 200, json: async () => [] }
      if (url === `https://api.netlify.com/api/v1/sites/${siteId}` && options.method === 'PUT') {
        uploadAttempts += 1
        return { ok: false, status: 400, headers: new Headers({ 'x-nf-error-code': 'invalid_archive', 'x-nf-request-id': 'netlifyReq654321' }), clone: () => ({ json: async () => ({ message: 'private customer and token details' }) }) }
      }
      throw new Error(`Unexpected request ${url}`)
    },
    persistSite: async () => {},
  })

  await assert.rejects(publisher.publishPaidProject({ paid: true, projectId, ownerId, content, siteRecord }), (error) => {
    assert.equal(error.status, 400)
    assert.equal(error.code, 'NETLIFY_HTTP_400')
    assert.equal(error.netlifyErrorCode, 'INVALID_ARCHIVE')
    assert.equal(error.netlifyRequestId, 'netlifyReq654321')
    assert.equal(error.websiteMachineOperation, 'netlify_deploy_upload')
    assert.doesNotMatch(error.message, /customer|token/i)
    return true
  })
  assert.equal(uploadAttempts, 1)
})

test('site creation requires durable association and records a new isolated site before deploying', async () => {
  const calls = []
  const persisted = []
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (url === 'https://api.netlify.com/api/v1/accounts/nonstopai-website-machine-test') return { ok: true, status: 200, json: async () => ({ id: accountId }) }
    if (url === 'https://api.netlify.com/api/v1/nonstopai-website-machine-test/sites/') return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: siteName, ssl_url: `https://${siteName}.netlify.app` }) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=10`) return { ok: true, status: 200, json: async () => [] }
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
  assert.equal(calls[0].url, 'https://api.netlify.com/api/v1/accounts/nonstopai-website-machine-test')
  assert.equal(calls[1].url, 'https://api.netlify.com/api/v1/nonstopai-website-machine-test/sites/')
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[2].options.method, 'PUT')
  assert.match(calls[2].url, /\/metadata$/)
  const uploadCall = calls.find((call) => call.options.method === 'PUT' && call.options.headers?.['content-type'] === 'application/zip')
  assert.equal(uploadCall.options.method, 'PUT')
  assert.equal(uploadCall.options.headers['content-type'], 'application/zip')
  assert.equal(calls.every((call) => !call.url.endsWith('/sites')), true)
})

test('a retry verifies and reuses an already published deployment instead of uploading another', async () => {
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const deployId = '6afb9ee4f72fcc6eeefea8d8'
  const deployUrl = `https://${deployId}--${siteName}.netlify.app`
  const calls = []
  const siteRecord = { projectId, ownerId, siteId, siteName, customDomain: null, currentDeployId: null, previousDeployIds: [] }
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}`) {
      return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: siteName, ssl_url: `https://${siteName}.netlify.app`, published_deploy: { id: deployId } }) }
    }
    if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=10`) return { ok: true, status: 200, json: async () => [] }
    if (url.endsWith(`/deploys/${deployId}`)) return { ok: true, status: 200, json: async () => ({ id: deployId, site_id: siteId, state: 'ready', deploy_ssl_url: deployUrl }) }
    if (url === deployUrl) return { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }), text: async () => '<!doctype html><h1>A&amp;B Garage</h1>' }
    throw new Error(`Unexpected request ${url}`)
  }
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl, persistSite: async () => {} })

  const result = await publisher.publishPaidProject({ paid: true, projectId, ownerId, content, siteRecord })

  assert.equal(result.verified, true)
  assert.equal(result.reused, true)
  assert.equal(result.deployId, deployId)
  assert.equal(result.verifiedDeployUrl, deployUrl)
  assert.equal(calls.some(({ url, options }) => url.endsWith('/sites/') && options.method === 'POST'), false)
  assert.equal(calls.some(({ url, options }) => url.endsWith(`/sites/${siteId}`) && options.method === 'PUT'), false)
})

test('a protected deployment response is not accepted as a verified website', async () => {
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const deployId = '0123456789abcdef01234567'
  const calls = []
  const siteRecord = { projectId, ownerId, siteId, siteName, customDomain: null, currentDeployId: null, previousDeployIds: [] }
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
    if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=10`) return { ok: true, status: 200, json: async () => [] }
    if (url.endsWith(`/sites/${siteId}`) && options.method !== 'PUT') {
      return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: siteName, ssl_url: `https://${siteName}.netlify.app` }) }
    }
    if (url.endsWith(`/sites/${siteId}`) && options.method === 'PUT') {
      return { ok: true, status: 200, json: async () => ({ id: deployId, site_id: siteId, state: 'ready', deploy_ssl_url: `https://${deployId}--${siteName}.netlify.app` }) }
    }
    if (url.endsWith(`/deploys/${deployId}`)) {
      return { ok: true, status: 200, json: async () => ({ id: deployId, site_id: siteId, state: 'ready', deploy_ssl_url: `https://${deployId}--${siteName}.netlify.app` }) }
    }
    if (url === `https://${deployId}--${siteName}.netlify.app`) {
      return { ok: false, status: 401, headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }), text: async () => '<title>Login Redirect</title>' }
    }
    throw new Error(`Unexpected request ${url}`)
  }
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl, sleep: async () => {}, persistSite: async () => {} })

  await assert.rejects(publisher.publishPaidProject({ paid: true, projectId, ownerId, content, siteRecord }), (error) => {
    assert.match(error.message, /access-restricted/)
    assert.equal(error.code, 'CUSTOMER_SITE_ACCESS_RESTRICTED')
    assert.equal(error.status, 401)
    assert.equal(error.stage, 'netlify_public_verify')
    return true
  })
  assert.equal(calls.some(({ url, options }) => url.endsWith('/sites/') && options.method === 'POST'), false, 'reuse the existing isolated site')
  assert.equal(calls.some(({ url, options }) => url.endsWith(`/sites/${siteId}`) && options.method === 'PUT'), true, 'the deployment itself may be ready while public verification fails')
})

test('an HTML document served as text/plain is rejected before delivery verification', async () => {
  const siteName = `wm-${projectId.replaceAll('-', '')}`
  const deployId = '0123456789abcdef01234567'
  const siteRecord = { projectId, ownerId, siteId, siteName, customDomain: null, currentDeployId: null, previousDeployIds: [] }
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
    if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
    if (url === `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=10`) return { ok: true, status: 200, json: async () => [] }
    if (url.endsWith(`/sites/${siteId}`) && !options.method) return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: siteName, ssl_url: `https://${siteName}.netlify.app` }) }
    if (url.endsWith(`/sites/${siteId}`) && options.method === 'PUT') return { ok: true, status: 200, json: async () => ({ id: deployId, site_id: siteId, state: 'ready', deploy_ssl_url: `https://${deployId}--${siteName}.netlify.app` }) }
    if (url === `https://${deployId}--${siteName}.netlify.app`) {
      return { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/plain; charset=UTF-8' }), text: async () => '<!doctype html><h1>A&amp;B Garage</h1>' }
    }
    throw new Error(`Unexpected request ${url}`)
  }
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl, persistSite: async () => {} })

  await assert.rejects(publisher.publishPaidProject({ paid: true, projectId, ownerId, content, siteRecord }), (error) => {
    assert.equal(error.code, 'CUSTOMER_DEPLOY_MIME_TYPE_INVALID')
    assert.equal(error.stage, 'netlify_public_verify')
    return true
  })
})

test('custom domain must be verified and unused before a customer site is created', async () => {
  let creates = 0
  const challenge = createDomainChallenge({ domain: 'example.co.uk', token: 'b'.repeat(43) })
  const publisher = createNetlifyCustomerPublisher({
    env,
    fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/sites/example.co.uk')) return { status: 404 }
      if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
      if (url.endsWith('/nonstopai-website-machine-test/sites/')) { creates += 1; return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: `wm-${projectId.replaceAll('-', '')}`, custom_domain: 'example.co.uk', ssl_url: 'https://example.netlify.app' }) } }
      if (url.endsWith(`/sites/${siteId}/metadata`) && options.method === 'PUT') return { ok: true, status: 200, json: async () => ({}) }
      if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
      if (url === `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=10`) return { ok: true, status: 200, json: async () => [] }
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
    if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
    if (url.endsWith(`/sites/${siteId}/metadata`)) return { ok: true, status: 200, json: async () => ({ website_machine_project_id: projectId }) }
    if (url.endsWith(`/sites/${siteId}`)) return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: accountId, name: siteName, ssl_url: `https://${siteName}.netlify.app`, published_deploy: { id: '0123456789abcdef01234567', deploy_ssl_url: 'https://0123456789abcdef--wm-test.netlify.app' } }) }
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

test('customer site publishing fails closed when Netlify account scope is missing or differs', async () => {
  assert.throws(() => createNetlifyCustomerPublisher({ env: { WM_NETLIFY_CUSTOMER_TOKEN: env.WM_NETLIFY_CUSTOMER_TOKEN } }), /dedicated Netlify Website Machine account/)
  let creates = 0
  const publisher = createNetlifyCustomerPublisher({ env, fetchImpl: async (url) => {
    if (url.endsWith('/accounts/nonstopai-website-machine-test')) return { ok: true, status: 200, json: async () => ({ id: accountId }) }
    if (url.endsWith('/nonstopai-website-machine-test/sites/')) { creates += 1; return { ok: true, status: 200, json: async () => ({ id: siteId, account_id: 'another-netlify-account', name: `wm-${projectId.replaceAll('-', '')}`, ssl_url: `https://wm-${projectId.replaceAll('-', '')}.netlify.app` }) } }
    throw new Error(`Unexpected request ${url}`)
  }, persistSite: async () => {} })
  await assert.rejects(publisher.publishPaidProject({ paid: true, projectId, ownerId, content }), /isolated Website Machine site/)
  assert.equal(creates, 1)
})
