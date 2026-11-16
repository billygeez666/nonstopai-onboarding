import test from 'node:test'
import assert from 'node:assert/strict'
import { createWebsiteMachineDeliveryEmail } from './websiteMachineEmail.js'

const orderId = '6f5f3099-2ec4-4596-a1d1-82891e94ead0'

test('delivery email links to the verified HTTPS website and uses idempotent provider delivery', async () => {
  let request
  const send = createWebsiteMachineDeliveryEmail({ apiKey: 're_test_secret', from: 'sites@example.test', fetchImpl: async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => ({ id: 'email-test-id' }) }
  } })
  assert.deepEqual(await send({ to: 'customer@example.test', businessName: '<Northstar>', deliveryUrl: 'https://northstar.netlify.app', orderId }), { sent: true })
  assert.equal(request.url, 'https://api.resend.com/emails')
  assert.equal(request.options.headers['idempotency-key'], `wm-delivery-${orderId}`)
  const payload = JSON.parse(request.options.body)
  assert.equal(payload.to[0], 'customer@example.test')
  assert.match(payload.html, /&lt;Northstar&gt;/)
  assert.match(payload.html, /https:\/\/northstar\.netlify\.app/)
})

test('delivery email refuses insecure links and malformed recipients before sending', async () => {
  let calls = 0
  const send = createWebsiteMachineDeliveryEmail({ apiKey: 're_test_secret', from: 'sites@example.test', fetchImpl: async () => { calls += 1; return { ok: true } } })
  await assert.rejects(send({ to: 'customer@example.test', businessName: 'Northstar', deliveryUrl: 'http://northstar.netlify.app', orderId }), /HTTPS/)
  await assert.rejects(send({ to: 'not-email', businessName: 'Northstar', deliveryUrl: 'https://northstar.netlify.app', orderId }), /not configured/)
  assert.equal(calls, 0)
})
