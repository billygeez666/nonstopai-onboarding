import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchWebsiteMachineRequest, getWebsiteMachineActionState } from './websiteMachineUiState.js'

test('signed-in idle users can save and checkout regardless of offer activation state', () => {
  const state = getWebsiteMachineActionState({ session: 'session-token', offerActive: false })
  assert.equal(state.saveProjectDisabled, false)
  assert.equal(state.checkoutDisabled, false)
})

test('checkout remains disabled without a session and explains the cause', () => {
  const state = getWebsiteMachineActionState()
  assert.equal(state.saveProjectDisabled, true)
  assert.equal(state.checkoutDisabled, true)
  assert.match(state.checkoutReason, /sign in/i)
})

test('an already-saved project disables only project creation and explains its state', () => {
  const state = getWebsiteMachineActionState({ session: 'session-token', project: { id: 'wm-test-project' } })
  assert.equal(state.saveProjectDisabled, true)
  assert.match(state.saveProjectReason, /already saved/i)
  assert.equal(state.checkoutDisabled, false)
})

test('in-progress actions disable duplicate requests with an accurate reason', () => {
  const state = getWebsiteMachineActionState({ session: 'session-token', busyAction: 'Saving project' })
  assert.equal(state.saveProjectDisabled, true)
  assert.equal(state.checkoutDisabled, true)
  assert.match(state.checkoutReason, /saving project/i)
})

test('stalled requests abort and reject so UI busy state can be cleared', async () => {
  let wasAborted = false
  const request = fetchWebsiteMachineRequest((_, { signal }) => new Promise(() => {
    signal.addEventListener('abort', () => { wasAborted = true }, { once: true })
  }), '/.netlify/functions/website-machine-project', {}, 5)

  await assert.rejects(request, /took too long/i)
  assert.equal(wasAborted, true)
})
