import test from 'node:test'
import assert from 'node:assert/strict'
import { createWebsiteMachineAuthUiState, shouldStartWebsiteMachineResendCooldown, websiteMachineAuthUiReducer, websiteMachineAuthView, websiteMachineConfirmationCooldownMs } from './websiteMachineAuthUi.js'

test('signup, confirmation, resend, return, sign-in, and checkout preserve the active preview', () => {
  const savedPreview = Object.freeze({ businessName: 'Cambridge Auto Detailing Demo', stage: 'review', checkoutProjectId: null })
  let ui = createWebsiteMachineAuthUiState()

  ui = websiteMachineAuthUiReducer(ui, { type: 'TOGGLE_MODE' })
  assert.equal(websiteMachineAuthView(ui), 'signup')
  assert.equal(savedPreview.stage, 'review')

  ui = websiteMachineAuthUiReducer(ui, { type: 'CONFIRMATION_REQUIRED', email: 'customer@example.test', resendUntil: 0 })
  assert.equal(websiteMachineAuthView(ui), 'confirm-email')
  assert.match(ui.confirmationEmail, /customer@example\.test/)

  const resendUntil = 61_000
  ui = websiteMachineAuthUiReducer(ui, { type: 'RESEND_REQUESTED', resendUntil })
  assert.equal(ui.resendUntil, resendUntil)
  assert.equal(shouldStartWebsiteMachineResendCooldown(429), true)
  assert.equal(shouldStartWebsiteMachineResendCooldown(503), false)

  ui = websiteMachineAuthUiReducer(ui, { type: 'CONFIRMATION_RETURNED' })
  assert.equal(websiteMachineAuthView(ui), 'signin')
  assert.match(ui.message, /sign in/i)
  assert.equal(savedPreview.businessName, 'Cambridge Auto Detailing Demo')
  assert.equal(savedPreview.stage, 'review')

  ui = websiteMachineAuthUiReducer(ui, { type: 'SIGNED_IN' })
  assert.equal(websiteMachineAuthView({ ...ui, session: 'opaque-session' }), 'signed-in')
  assert.match(ui.message, /saved website preview is ready/i)
  assert.equal(savedPreview.stage, 'review')
})

test('confirmation request failures retain the cooldown and show a safe error', () => {
  let ui = createWebsiteMachineAuthUiState()
  ui = websiteMachineAuthUiReducer(ui, { type: 'RESEND_REQUESTED', resendUntil: 90_000 })
  ui = websiteMachineAuthUiReducer(ui, { type: 'SET_ERROR', message: 'Confirmation email could not be requested right now.' })
  assert.equal(ui.resendUntil, 90_000)
  assert.equal(ui.error, 'Confirmation email could not be requested right now.')
  ui = websiteMachineAuthUiReducer(ui, { type: 'CONFIRMATION_BACK' })
  assert.equal(ui.mode, 'signin')
  assert.equal(ui.confirmationEmail, '')
})

test('confirmation cooldown remains one minute and mode changes retain preview context outside auth state', () => {
  assert.equal(websiteMachineConfirmationCooldownMs, 60_000)
  let ui = createWebsiteMachineAuthUiState()
  ui = websiteMachineAuthUiReducer(ui, { type: 'TOGGLE_MODE' })
  const next = websiteMachineAuthUiReducer(ui, { type: 'TOGGLE_MODE' })
  assert.equal(next.mode, 'signin')
  assert.equal(next.error, '')
  assert.equal(next.message, '')
})
