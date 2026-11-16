import { createProjectApi } from '../../src/lib/websiteMachineServer.js'
import { renderStaticWebsite } from '../../src/lib/websiteMachine.js'

export function createDeliveryApi(options = {}) {
  const projectApi = createProjectApi(options)
  return async (event) => {
    if (event.httpMethod !== 'GET') return { statusCode: 405, headers: { 'cache-control': 'no-store' }, body: '' }
    const query = new URL(event.rawUrl || `https://local.invalid${event.path || '/'}`).searchParams
    const result = await projectApi({ ...event, httpMethod: 'GET', rawUrl: `https://local.invalid/.netlify/functions/website-machine-project?id=${encodeURIComponent(query.get('id') || '')}` })
    if (result.statusCode !== 200) return result
    const { content, business } = JSON.parse(result.body)
    const html = renderStaticWebsite(content)
    const slug = String(business.businessName || 'website').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'website'
    return { statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'content-disposition': `attachment; filename="${slug}.html"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }, body: html }
  }
}

export const handler = createDeliveryApi()
