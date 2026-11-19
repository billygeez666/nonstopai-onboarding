import { sanitizeWebsiteContent, validateBusinessInput } from './websiteMachine.js'

export const websiteMachinePurchaseDraftKey = 'wm_purchase_draft_v1'
export const websiteMachineConfirmationDraftKey = 'wm_confirmation_draft_v1'

export function clearWebsiteMachineConfirmationDraft(storage) {
  try { storage?.removeItem(websiteMachineConfirmationDraftKey) } catch {}
}

export function restoreWebsiteMachineDraft({ sessionStorage, localStorage, hash = '', now = Date.now(), hasConcept = false } = {}) {
  if (hasConcept) return null
  try {
    const saved = JSON.parse(sessionStorage?.getItem(websiteMachinePurchaseDraftKey) || 'null')
    const callback = new URLSearchParams(String(hash).replace(/^#/, ''))
    const confirmation = callback.has('access_token') || callback.has('error_code')
      ? JSON.parse(localStorage?.getItem(websiteMachineConfirmationDraftKey) || 'null') : null
    if (confirmation && now > confirmation.expiresAt) clearWebsiteMachineConfirmationDraft(localStorage)
    const draft = saved && now <= saved.expiresAt ? saved : confirmation
    if (!draft || now > draft.expiresAt) return null
    const business = validateBusinessInput(draft.business)
    const content = sanitizeWebsiteContent(draft.content)
    if (!business.ok || !content.ok) return null
    return { ...draft, business: business.value, content: content.content }
  } catch {
    return null
  }
}
