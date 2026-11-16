export function getWebsiteMachineActionState({ session = '', busyAction = '', project = null } = {}) {
  const signedIn = typeof session === 'string' && session.trim().length > 0
  const busy = typeof busyAction === 'string' && busyAction.length > 0

  return {
    saveProjectDisabled: busy || !signedIn || Boolean(project),
    checkoutDisabled: busy || !signedIn,
    saveProjectReason: busy
      ? `${busyAction} is in progress.`
      : !signedIn
        ? 'Sign in to save this project.'
        : project
          ? 'This project is already saved in this session.'
          : '',
    checkoutReason: busy
      ? `${busyAction} is in progress.`
      : !signedIn
        ? 'Sign in to continue to secure checkout.'
        : '',
  }
}

export async function fetchWebsiteMachineRequest(fetchImpl, input, options = {}, timeoutMs = 20_000) {
  const controller = new AbortController()
  let timeout
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort()
      const error = new Error('The request took too long. Please try again.')
      error.name = 'TimeoutError'
      reject(error)
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      fetchImpl(input, { ...options, signal: controller.signal }),
      timeoutPromise,
    ])
  } finally {
    clearTimeout(timeout)
  }
}
