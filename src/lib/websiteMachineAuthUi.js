export const websiteMachineConfirmationCooldownMs = 60_000

export function createWebsiteMachineAuthUiState() {
  return { mode: 'signin', confirmationEmail: '', resendUntil: 0, error: '', message: '' }
}

export function websiteMachineAuthUiReducer(state, event) {
  switch (event.type) {
    case 'TOGGLE_MODE':
      return { ...state, mode: state.mode === 'signup' ? 'signin' : 'signup', error: '', message: '' }
    case 'CLEAR_STATUS':
      return { ...state, error: '', message: '' }
    case 'CONFIRMATION_REQUIRED':
      return { ...state, confirmationEmail: event.email, resendUntil: event.resendUntil || 0, error: '', message: '' }
    case 'CONFIRMATION_RETURNED':
      return { ...state, confirmationEmail: '', mode: 'signin', error: '', message: 'Email confirmed. Sign in to continue with your saved website preview.' }
    case 'CONFIRMATION_BACK':
      return { ...state, confirmationEmail: '', mode: 'signin', error: '', message: '' }
    case 'RESEND_REQUESTED':
      return { ...state, resendUntil: event.resendUntil, error: '', message: '' }
    case 'COOLDOWN_ELAPSED':
      return { ...state, resendUntil: 0 }
    case 'SET_ERROR':
      return { ...state, error: event.message, message: '' }
    case 'SET_MESSAGE':
      return { ...state, error: '', message: event.message }
    case 'SIGNED_IN':
      return { ...state, confirmationEmail: '', mode: 'signin', error: '', message: 'Signed in. Your saved website preview is ready; continue below.' }
    default:
      return state
  }
}

export function websiteMachineAuthView({ session = '', confirmationEmail = '', mode = 'signin' } = {}) {
  if (session) return 'signed-in'
  if (confirmationEmail) return 'confirm-email'
  return mode === 'signup' ? 'signup' : 'signin'
}

export function shouldStartWebsiteMachineResendCooldown(statusCode) {
  return statusCode === 429 || (statusCode >= 200 && statusCode < 300)
}
