import { randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import { domainToASCII } from 'node:url'
import { resolveTxt as dnsResolveTxt } from 'node:dns/promises'
import { renderStaticWebsite, sanitizeWebsiteContent } from './websiteMachine.js'

const NETLIFY_API = 'https://api.netlify.com/api/v1'
const DOMAIN_PROOF_LABEL = '_nonstopai-verify'

function attachSafeOperation(error, operation) {
  if (error && typeof error === 'object') {
    try {
      if (!error.websiteMachineOperation) error.websiteMachineOperation = operation
    } catch {}
  }
  return error
}

function netlifyApiOperation(path, method = 'GET') {
  const route = String(path).split('?')[0]
  if (/^\/accounts\/[^/]+$/.test(route)) return 'netlify_account_lookup'
  if (/^\/[^/]+\/sites\/$/.test(route) && method === 'POST') return 'netlify_site_create'
  if (/^\/sites\/[^/]+\/metadata$/.test(route)) return method === 'PUT' ? 'netlify_site_metadata_bind' : 'netlify_site_metadata_verify'
  if (/^\/sites\/[^/]+$/.test(route) && method === 'PUT') return 'netlify_deploy_upload'
  if (/^\/sites\/[^/]+\/deploys$/.test(route)) return 'netlify_deploy_list'
  if (/^\/sites\/[^/]+$/.test(route)) return 'netlify_site_lookup'
  if (/^\/deploys\/[^/]+$/.test(route)) return 'netlify_deploy_poll'
  return 'netlify_api_request'
}

export function normalizeCustomerDomain(value) {
  if (typeof value !== 'string' || value.length > 253) return null
  const input = value.trim().toLowerCase().replace(/\.$/, '')
  if (!input || /[\s/:?#@\\]/.test(input)) return null
  const host = domainToASCII(input)
  if (!host || host.length > 253 || isIP(host) || !host.includes('.')) return null
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.netlify.app') || host.endsWith('.example') || host.endsWith('.test')) return null
  if (host.split('.').some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null
  return host
}

export function createDomainChallenge({ token = randomBytes(32).toString('base64url'), domain, now = Date.now(), ttlMs = 60 * 60 * 1000 } = {}) {
  const hostname = normalizeCustomerDomain(domain)
  if (!hostname || !/^[A-Za-z0-9_-]{32,100}$/.test(token) || ttlMs < 60_000 || ttlMs > 3_600_000) throw new Error('Enter a valid custom domain.')
  return { domain: hostname, recordName: `${DOMAIN_PROOF_LABEL}.${hostname}`, recordValue: `nonstopai-site-verification=${token}`, token, expiresAt: new Date(now + ttlMs).toISOString() }
}

export async function verifyDomainChallenge({ domain, token, resolveTxt = dnsResolveTxt }) {
  const hostname = normalizeCustomerDomain(domain)
  if (!hostname || !/^[A-Za-z0-9_-]{32,100}$/.test(token || '')) return false
  try {
    const records = await resolveTxt(`${DOMAIN_PROOF_LABEL}.${hostname}`)
    return records.some((parts) => parts.join('').trim() === `nonstopai-site-verification=${token}`)
  } catch {
    return false
  }
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

// A minimal, uncompressed ZIP writer avoids shelling out or evaluating content.
export function makeStaticWebsiteZip(html) {
  const data = Buffer.from(html, 'utf8')
  if (data.length > 150000) throw new Error('Website file is too large.')
  const headers = Buffer.from('/\n  Content-Type: text/html; charset=utf-8\n\n/index.html\n  Content-Type: text/html; charset=utf-8\n', 'utf8')
  const entries = [{ name: 'index.html', data }, { name: '_headers', data: headers }]
  const localEntries = []
  const centralEntries = []
  let localOffset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const crc = crc32(entry.data)
    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(entry.data.length, 18)
    local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    name.copy(local, 30)
    localEntries.push(local, entry.data)

    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(entry.data.length, 20)
    central.writeUInt32LE(entry.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(localOffset, 42)
    name.copy(central, 46)
    centralEntries.push(central)
    localOffset += local.length + entry.data.length
  }

  const centralDirectory = Buffer.concat(centralEntries)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(localOffset, 16)
  return Buffer.concat([...localEntries, centralDirectory, end])
}

function safeNetlifyErrorCode(value) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value)) return undefined
  return value.toUpperCase().replaceAll('-', '_').replaceAll('.', '_')
}

const jsonResponse = async (response) => {
  if (!response.ok) {
    const error = new Error(`Netlify API request failed (${response.status}).`)
    error.status = response.status
    const providerRequestId = response.headers?.get?.('x-nf-request-id') || response.headers?.get?.('x-request-id')
    if (typeof providerRequestId === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(providerRequestId)) error.netlifyRequestId = providerRequestId
    const headerCode = response.headers?.get?.('x-nf-error-code') || response.headers?.get?.('x-error-code')
    let bodyCode
    try {
      const body = await response.clone().json()
      bodyCode = body?.code || body?.error_code || body?.errorCode
    } catch {}
    const providerCode = safeNetlifyErrorCode(headerCode || bodyCode)
    if (providerCode) error.netlifyErrorCode = providerCode
    throw error
  }
  return response.status === 204 ? null : response.json()
}

export function createNetlifyCustomerPublisher({
  env = process.env,
  fetchImpl = fetch,
  resolveTxt = dnsResolveTxt,
  persistSite,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxPolls = 20,
  maxUploadAttempts = 3,
  uploadTimeoutMs = 8_000,
} = {}) {
  const accountSlug = env.WM_NETLIFY_ACCOUNT_SLUG
  if (typeof accountSlug !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(accountSlug)) {
    throw new Error('A dedicated Netlify Website Machine account must be configured.')
  }

  async function api(path, options = {}) {
    if (!env.WM_NETLIFY_CUSTOMER_TOKEN) throw new Error('Customer site publishing is not configured.')
    const operation = netlifyApiOperation(path, options.method || 'GET')
    const { timeoutMs = 10_000, ...fetchOptions } = options
    try {
      const response = await fetchImpl(`${NETLIFY_API}${path}`, {
        ...fetchOptions,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { authorization: `Bearer ${env.WM_NETLIFY_CUSTOMER_TOKEN}`, ...fetchOptions.headers },
      })
      return await jsonResponse(response)
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') error.code ||= 'NETLIFY_REQUEST_TIMEOUT'
      else if (Number.isInteger(error?.status)) error.code ||= `NETLIFY_HTTP_${error.status}`
      throw attachSafeOperation(error, operation)
    }
  }

  const isTransientUploadError = (error) => error?.code === 'NETLIFY_REQUEST_TIMEOUT' ||
    error?.name === 'TypeError' || [408, 425, 429, 500, 502, 503, 504].includes(error?.status)

  async function uploadWithRecovery(site, archive) {
    // Snapshot deploy IDs before the first ZIP request. A timed-out/5xx response
    // may still have created a deploy; discover and reuse it before retrying.
    const priorDeploys = await api(`/sites/${encodeURIComponent(site.id)}/deploys?per_page=10`, { timeoutMs: 3_000 })
    if (!Array.isArray(priorDeploys)) {
      throw attachSafeOperation(new Error('Netlify returned an invalid deploy list.'), 'netlify_deploy_list')
    }
    const priorIds = new Set(priorDeploys.map((deploy) => deploy?.id).filter((id) => typeof id === 'string'))
    let lastError

    for (let attempt = 1; attempt <= maxUploadAttempts; attempt += 1) {
      try {
        const deploy = await api(`/sites/${encodeURIComponent(site.id)}`, {
          method: 'PUT', timeoutMs: uploadTimeoutMs,
          headers: { 'content-type': 'application/zip' }, body: archive,
        })
        if (!deploy?.id) throw attachSafeOperation(new Error('Netlify did not start a customer deploy.'), 'netlify_deploy_upload')
        if (deploy.site_id !== site.id) throw attachSafeOperation(new Error('Netlify returned a deploy for a different site.'), 'netlify_deploy_upload')
        return deploy
      } catch (error) {
        lastError = error
        if (!isTransientUploadError(error)) throw error

        // Reconcile ambiguous failures before issuing another deploy request.
        // The site is isolated to this paid project, so a newly-created deploy
        // belongs to this fulfillment attempt and is safe to continue polling.
        const deploys = await api(`/sites/${encodeURIComponent(site.id)}/deploys?per_page=10`, { timeoutMs: 3_000 })
        if (!Array.isArray(deploys)) {
          throw attachSafeOperation(new Error('Netlify returned an invalid deploy list during upload recovery.'), 'netlify_deploy_list')
        }
        const observed = deploys
          .filter((deploy) => deploy?.site_id === site.id && typeof deploy.id === 'string' && !priorIds.has(deploy.id))
          .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))[0]
        if (observed && observed.state !== 'error') return observed
        if (observed) priorIds.add(observed.id)
        if (attempt === maxUploadAttempts) throw error

        await sleep(Math.min(250 * (2 ** (attempt - 1)), 1000))
      }
    }
    throw lastError || new Error('Netlify deployment upload failed.')
  }

  async function getPublisherAccountId() {
    const account = await api(`/accounts/${encodeURIComponent(accountSlug)}`)
    if (typeof account?.id !== 'string' || !account.id) {
      throw attachSafeOperation(new Error('Dedicated Netlify Website Machine account could not be verified.'), 'netlify_account_lookup')
    }
    return account.id
  }

  async function verifySiteBinding(site, projectId, siteName, customDomain, accountId) {
    if (!site?.id || site.account_id !== accountId || site.name !== siteName || !isNetlifyHttpsUrl(site.ssl_url || site.url || '') ||
        (customDomain && normalizeCustomerDomain(site.custom_domain || '') !== customDomain)) {
      throw attachSafeOperation(new Error('Netlify did not return the isolated Website Machine site.'), 'netlify_site_binding_verify')
    }
    const metadata = await api(`/sites/${encodeURIComponent(site.id)}/metadata`)
    if (metadata?.website_machine_project_id !== projectId) {
      throw attachSafeOperation(new Error('Netlify site is not bound to this Website Machine project.'), 'netlify_site_binding_verify')
    }
    return site
  }

  return {
    async publishPaidProject({ paid, projectId, ownerId, content, domain, domainChallenge, siteRecord = null }) {
      if (paid !== true) throw new Error('A confirmed paid order is required before publishing.')
      if (!/^[0-9a-f-]{36}$/i.test(projectId || '')) throw new Error('Invalid Website Machine project.')
      if (!/^[0-9a-f-]{36}$/i.test(ownerId || '')) throw new Error('Invalid Website Machine owner.')
      const safeContent = sanitizeWebsiteContent(content)
      if (!safeContent.ok) throw new Error('Website content is invalid.')
      if (typeof persistSite !== 'function') throw new Error('Durable customer site storage is not configured.')

      const requestedDomain = domain ? normalizeCustomerDomain(domain) : null
      if (domain && !requestedDomain) throw new Error('Enter a valid custom domain.')
      const customDomain = siteRecord ? (siteRecord.customDomain ? normalizeCustomerDomain(siteRecord.customDomain) : null) : requestedDomain
      if (siteRecord && (siteRecord.projectId !== projectId || siteRecord.ownerId !== ownerId || siteRecord.siteName !== `wm-${projectId.replaceAll('-', '')}` || !/^[0-9a-f-]{36}$/i.test(siteRecord.siteId || ''))) {
        throw new Error('Stored customer site does not match the paid project owner.')
      }
      if (siteRecord && domain && requestedDomain !== customDomain) throw new Error('A customer site domain cannot be changed without a new ownership check.')
      if (customDomain && !siteRecord) {
        if (domainChallenge?.domain !== customDomain || !await verifyDomainChallenge({ domain: customDomain, token: domainChallenge.token, resolveTxt })) {
          throw new Error('Add the requested DNS TXT ownership record before publishing to this domain.')
        }
        let existing
        try {
          existing = await fetchImpl(`${NETLIFY_API}/sites/${encodeURIComponent(customDomain)}`, {
            headers: { authorization: `Bearer ${env.WM_NETLIFY_CUSTOMER_TOKEN}` },
          })
        } catch (error) {
          throw attachSafeOperation(error, 'netlify_domain_assignment_check')
        }
        if (existing.status !== 404) throw new Error('This domain is already assigned to a Netlify site or could not be safely checked.')
      }

      const accountId = await getPublisherAccountId()
      const siteName = siteRecord?.siteName || `wm-${projectId.replaceAll('-', '')}`
      let site
      if (siteRecord) {
        site = await api(`/sites/${encodeURIComponent(siteRecord.siteId)}`)
        if (site.id !== siteRecord.siteId) {
          throw attachSafeOperation(new Error('Stored customer site could not be verified.'), 'netlify_site_binding_verify')
        }
        await verifySiteBinding(site, projectId, siteName, customDomain, accountId)
      } else {
        try {
          site = await api(`/${encodeURIComponent(accountSlug)}/sites/`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: siteName, ...(customDomain ? { custom_domain: customDomain } : {}) }),
          })
          if (!site?.id || site.account_id !== accountId || site.name !== siteName || !isNetlifyHttpsUrl(site.ssl_url || site.url || '') ||
              (customDomain && normalizeCustomerDomain(site.custom_domain || '') !== customDomain)) {
            throw attachSafeOperation(new Error('Netlify did not return the isolated Website Machine site.'), 'netlify_site_binding_verify')
          }
          await api(`/sites/${encodeURIComponent(site.id)}/metadata`, {
            method: 'PUT', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ website_machine_project_id: projectId }),
          })
        } catch (error) {
          if (![409, 422].includes(error.status)) throw error
          site = await api(`/sites/${encodeURIComponent(`${siteName}.netlify.app`)}`)
        }
        await verifySiteBinding(site, projectId, siteName, customDomain, accountId)
        await persistSite({ projectId, ownerId, siteId: site.id, siteName, customDomain })
      }

      const html = renderStaticWebsite(safeContent.content)
      const verifyDeployment = async (deploy) => {
        if (deploy?.site_id !== site.id || deploy.state !== 'ready') {
          const error = new Error('Customer deploy is not ready for the isolated Website Machine site.')
          error.code = 'CUSTOMER_DEPLOY_NOT_READY'
          error.stage = 'netlify_deploy_verify'
          error.websiteMachineOperation = 'netlify_deploy_verify'
          throw error
        }
        const verifyUrl = deploy.deploy_ssl_url || deploy.ssl_url
        if (!isNetlifyHttpsUrl(verifyUrl)) {
          const error = new Error('Customer deploy has no secure Netlify verification URL.')
          error.code = 'CUSTOMER_DEPLOY_URL_INVALID'
          error.stage = 'netlify_deploy_verify'
          error.websiteMachineOperation = 'netlify_deploy_verify'
          throw error
        }
        let live
        try {
          live = await fetchImpl(verifyUrl, { redirect: 'error' })
        } catch (error) {
          throw attachSafeOperation(error, 'netlify_public_site_verify')
        }
        if (!live.ok) {
          const error = new Error(live.status === 401 || live.status === 403
            ? `Customer site is access-restricted (HTTP ${live.status}).`
            : `Customer deploy could not be fetched (HTTP ${live.status}).`)
          error.code = live.status === 401 || live.status === 403 ? 'CUSTOMER_SITE_ACCESS_RESTRICTED' : 'CUSTOMER_DEPLOY_HTTP_ERROR'
          error.status = live.status
          error.stage = 'netlify_public_verify'
          error.websiteMachineOperation = 'netlify_public_site_verify'
          throw error
        }
        const contentType = live.headers?.get('content-type') || ''
        if (!contentType.toLowerCase().includes('text/html')) {
          const error = new Error('Customer deploy did not return HTML content.')
          error.code = 'CUSTOMER_DEPLOY_MIME_TYPE_INVALID'
          error.status = live.status
          error.stage = 'netlify_public_verify'
          error.websiteMachineOperation = 'netlify_public_site_verify'
          throw error
        }
        const liveHtml = await live.text()
        if (!liveHtml.includes(escapeHtml(safeContent.content.businessName))) {
          const error = new Error('Deployed customer website failed content verification.')
          error.code = 'CUSTOMER_DEPLOY_CONTENT_MISMATCH'
          error.status = live.status
          error.stage = 'netlify_public_verify'
          error.websiteMachineOperation = 'netlify_public_site_verify'
          throw error
        }
        return verifyUrl
      }

      // A webhook retry may arrive after Netlify finished the deploy but before
      // Supabase recorded it. Reuse only the site's current, ready deploy after
      // checking site ownership, metadata, public access, MIME type, and content.
      // This avoids creating another deployment during recovery.
      if (siteRecord && site.published_deploy?.id) {
        const currentDeploy = await api(`/deploys/${encodeURIComponent(site.published_deploy.id)}`)
        const verifiedDeployUrl = await verifyDeployment(currentDeploy)
        return {
          siteId: site.id,
          siteName,
          deployId: currentDeploy.id,
          previousDeployId: siteRecord.currentDeployId || null,
          url: customDomain ? `https://${customDomain}` : (site.ssl_url || site.url),
          verifiedDeployUrl,
          verified: true,
          reused: true,
        }
      }

      const upload = await uploadWithRecovery(site, makeStaticWebsiteZip(html))
      let deploy = upload
      for (let attempt = 0; attempt < maxPolls && !['ready', 'error'].includes(deploy.state); attempt += 1) {
        await sleep(1000)
        deploy = await api(`/deploys/${encodeURIComponent(upload.id)}`)
      }
      const verifiedDeployUrl = await verifyDeployment(deploy)
      return {
        siteId: site.id,
        siteName,
        deployId: deploy.id,
        previousDeployId: siteRecord?.currentDeployId || upload.previous_deploy_id || null,
        url: customDomain ? `https://${customDomain}` : (site.ssl_url || site.url),
        verifiedDeployUrl,
        verified: true,
      }
    },

    async rollback({ ownerId, projectId, siteRecord, deployId }) {
      if (!/^[0-9a-f-]{36}$/i.test(ownerId || '') || !/^[0-9a-f-]{36}$/i.test(projectId || '') ||
          siteRecord?.ownerId !== ownerId || siteRecord?.projectId !== projectId || siteRecord?.siteName !== `wm-${projectId.replaceAll('-', '')}` ||
          !/^[0-9a-f-]{36}$/i.test(siteRecord?.siteId || '') || !Array.isArray(siteRecord?.previousDeployIds) || !siteRecord.previousDeployIds.includes(deployId) ||
          !/^[0-9a-f-]{16,64}$/i.test(deployId || '')) {
        throw new Error('Invalid customer site rollback request.')
      }
      const site = await api(`/sites/${encodeURIComponent(siteRecord.siteId)}`)
      if (site.id !== siteRecord.siteId) throw new Error('Rollback is limited to the verified customer site.')
      const accountId = await getPublisherAccountId()
      await verifySiteBinding(site, projectId, siteRecord.siteName, siteRecord.customDomain, accountId)
      const deploy = await api(`/deploys/${encodeURIComponent(deployId)}`)
      if (deploy.site_id !== siteRecord.siteId || deploy.state !== 'ready') throw new Error('Requested rollback deploy is not a successful deploy for this customer site.')
      const restored = await api(`/sites/${encodeURIComponent(siteRecord.siteId)}/deploys/${encodeURIComponent(deployId)}/restore`, { method: 'POST' })
      const current = await api(`/sites/${encodeURIComponent(siteRecord.siteId)}`)
      const restoredId = restored?.id || deploy.id
      if (current.id !== siteRecord.siteId || current.name !== siteRecord.siteName || current.published_deploy?.id !== restoredId) {
        throw new Error('Netlify did not verify the restored customer deployment.')
      }
      const verifyUrl = current.published_deploy.deploy_ssl_url || restored?.deploy_ssl_url || restored?.ssl_url || deploy.deploy_ssl_url || deploy.ssl_url
      if (!isNetlifyHttpsUrl(verifyUrl)) throw new Error('Restored deployment has no secure verification URL.')
      const live = await fetchImpl(verifyUrl, { redirect: 'error' })
      if (!live.ok || !live.headers.get('content-type')?.includes('text/html')) throw new Error('Restored customer deployment failed HTTPS verification.')
      return { deployId: restoredId, verifiedDeployUrl: verifyUrl }
    },
  }
}

function isNetlifyHttpsUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.endsWith('.netlify.app')
  } catch {
    return false
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}
