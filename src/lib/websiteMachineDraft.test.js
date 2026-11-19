import test from 'node:test'
import assert from 'node:assert/strict'
import { generateWebsiteContent } from './websiteMachine.js'
import { clearWebsiteMachineConfirmationDraft, restoreWebsiteMachineDraft, websiteMachineConfirmationDraftKey, websiteMachinePurchaseDraftKey } from './websiteMachineDraft.js'

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    has: (key) => values.has(key),
  }
}

const business = { businessName: 'Cambridge Auto Detailing Demo', industry: 'Automotive detailing', location: 'Cambridge, England', verifiedInfo: 'Fictional test business' }
const content = { ...generateWebsiteContent(business).content, visualStyle: 'balanced' }
const savedReview = { business, content, account: '', checkoutProject: null, expiresAt: 200_000 }

test('confirmation callback restores the saved preview and review step after a browser return', () => {
  const localStorage = memoryStorage({ [websiteMachineConfirmationDraftKey]: JSON.stringify(savedReview) })
  const restored = restoreWebsiteMachineDraft({ sessionStorage: memoryStorage(), localStorage, hash: '#access_token=confirmation-token', now: 100_000 })
  assert.equal(restored.business.businessName, business.businessName)
  assert.equal(restored.content.heroTitle, content.heroTitle)
  assert.equal(restored.expiresAt, savedReview.expiresAt)
  assert.equal(restored.checkoutProject, null)
  assert.equal(restored.account, '')
})

test('saved session preview is preferred after sign-in and stays associated with the active account', () => {
  const sessionStorage = memoryStorage({ [websiteMachinePurchaseDraftKey]: JSON.stringify({ ...savedReview, account: 'customer@example.test' }) })
  const localStorage = memoryStorage({ [websiteMachineConfirmationDraftKey]: JSON.stringify({ ...savedReview, business: { ...business, businessName: 'stale preview' } }) })
  const restored = restoreWebsiteMachineDraft({ sessionStorage, localStorage, hash: '', now: 100_000 })
  assert.equal(restored.business.businessName, business.businessName)
  assert.equal(restored.account, 'customer@example.test')
})

test('expired and invalid drafts are rejected and expired confirmation data is cleared', () => {
  const localStorage = memoryStorage({ [websiteMachineConfirmationDraftKey]: JSON.stringify({ ...savedReview, expiresAt: 99_000 }) })
  assert.equal(restoreWebsiteMachineDraft({ sessionStorage: memoryStorage(), localStorage, hash: '#error_code=expired', now: 100_000 }), null)
  assert.equal(localStorage.has(websiteMachineConfirmationDraftKey), false)
  const invalid = memoryStorage({ [websiteMachinePurchaseDraftKey]: JSON.stringify({ ...savedReview, content: { ...content, facts: [42] } }) })
  assert.equal(restoreWebsiteMachineDraft({ sessionStorage: invalid, localStorage: memoryStorage(), now: 100_000 }), null)
  assert.equal(restoreWebsiteMachineDraft({ sessionStorage: invalid, localStorage: memoryStorage(), hasConcept: true, now: 100_000 }), null)
})

test('confirmation draft cleanup removes only the confirmation snapshot', () => {
  const storage = memoryStorage({ [websiteMachineConfirmationDraftKey]: 'draft', [websiteMachinePurchaseDraftKey]: 'purchase' })
  clearWebsiteMachineConfirmationDraft(storage)
  assert.equal(storage.has(websiteMachineConfirmationDraftKey), false)
  assert.equal(storage.has(websiteMachinePurchaseDraftKey), true)
})
