import { randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import { domainToASCII } from 'node:url'
import { resolveTxt as dnsResolveTxt } from 'node:dns/promises'
import { renderStaticWebsite, sanitizeWebsiteContent } from './websiteMachine.js'

const NETLIFY_API = 'https://api.netlify.com/api/v1'
const DOMAIN_PROOF_LABEL = '_nonstopai-verify'

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
  const name = Buffer.from('index.html')
  const data = Buffer.from(html, 'utf8')
  if (data.length > 150000) throw new Error('Website file is too large.')
  const crc = crc32(data)
  const local = Buffer.alloc(30 + name.length)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(name.length, 26)
  name.copy(local, 30)

  const central = Buffer.alloc(46 + name.length)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(name.length, 28)
  central.writeUInt32LE(0, 38)
  name.copy(central, 46)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length, 12)
  end.writeUInt32LE(local.length + data.length, 16)
  return Buffer.concat([local, data, central, end])
}

const jsonResponse = async (response) => {
  if (!response.ok) {
    const error = new Error(`Netlify API request failed (${response.status}).`)
    error.status = response.status
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
} = {}) {
  const accountSlug = env.WM_NETLIFY_ACCOUNT_SLUG
  if (typeof accountSlug !== 'string' || !/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(accountSlug)) {
    throw new Error('A dedicated Netlify Website Machine account must be configured.')
  }

  async function api(path, options = {}) {
    if (!env.WM_NETLIFY_CUSTOMER_TOKEN) throw new Error('Customer site publishing is not configured.')
    const response = await fetchImpl(`${NETLIFY_API}${path}`, {
      ...options,
      headers: { authorization: `Bearer ${env.WM_NETLIFY_CUSTOMER_TOKEN}`, ...options.headers },
    })
    return jsonResponse(response)
  }

  async function getPublisherAccountId() {
    const account = await api(`/accounts/${encodeURIComponent(accountSlug)}`)
    if (typeof account?.id !== 'string' || !account.id) throw new Error('Dedicated Netlify Website Machine account could not be verified.')
    return account.id
  }

  async function verifySiteBinding(site, projectId, siteName, customDomain, accountId) {
    if (!site?.id || site.account_id !== accountId || site.name !== siteName || !isNetlifyHttpsUrl(site.ssl_url || site.url || '') ||
        (customDomain && normalizeCustomerDomain(site.custom_domain || '') !== customDomain)) {
      throw new Error('Netlify did not return the isolated Website Machine site.')
    }
    const metadata = await api(`/sites/${encodeURIComponent(site.id)}/metadata`)
    if (metadata?.website_machine_project_id !== projectId) throw new Error('Netlify site is not bound to this Website Machine project.')
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
        const existing = await fetchImpl(`${NETLIFY_API}/sites/${encodeURIComponent(customDomain)}`, {
          headers: { authorization: `Bearer ${env.WM_NETLIFY_CUSTOMER_TOKEN}` },
        })
        if (existing.status !== 404) throw new Error('This domain is already assigned to a Netlify site or could not be safely checked.')
      }

      const accountId = await getPublisherAccountId()
      const siteName = siteRecord?.siteName || `wm-${projectId.replaceAll('-', '')}`
      let site
      if (siteRecord) {
        site = await api(`/sites/${encodeURIComponent(siteRecord.siteId)}`)
        if (site.id !== siteRecord.siteId) throw new Error('Stored customer site could not be verified.')
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
            throw new Error('Netlify did not return the isolated Website Machine site.')
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
      const upload = await api(`/sites/${encodeURIComponent(site.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/zip' },
        body: makeStaticWebsiteZip(html),
      })
      if (!upload?.id) throw new Error('Netlify did not start a customer deploy.')
      if (upload.site_id !== site.id) throw new Error('Netlify returned a deploy for a different site.')
      let deploy = upload
      for (let attempt = 0; attempt < maxPolls && !['ready', 'error'].includes(deploy.state); attempt += 1) {
        await sleep(1000)
        deploy = await api(`/deploys/${encodeURIComponent(upload.id)}`)
      }
      if (deploy.site_id !== site.id || deploy.state !== 'ready') throw new Error('Customer deploy did not reach the ready state for its isolated site.')
      const verifyUrl = deploy.deploy_ssl_url || deploy.ssl_url
      if (!isNetlifyHttpsUrl(verifyUrl)) throw new Error('Customer deploy has no secure Netlify verification URL.')
      const live = await fetchImpl(verifyUrl, { redirect: 'error' })
      const liveHtml = await live.text()
      if (!live.ok || !live.headers.get('content-type')?.includes('text/html') || !liveHtml.includes(escapeHtml(safeContent.content.businessName))) {
        throw new Error('Deployed customer website failed content verification.')
      }
      return {
        siteId: site.id,
        siteName,
        deployId: deploy.id,
        previousDeployId: siteRecord?.currentDeployId || upload.previous_deploy_id || null,
        url: customDomain ? `https://${customDomain}` : (site.ssl_url || site.url),
        verifiedDeployUrl: verifyUrl,
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
