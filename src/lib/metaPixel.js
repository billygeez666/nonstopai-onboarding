// Meta Pixel helpers — NONSTOP AI dataset 1748159716430306.
// The base code (fbq init) lives in index.html. PageView is fired ONLY from
// here (initial load + every SPA route change) — automatic pushState
// tracking is disabled in index.html so nothing is double-counted.

const ATTR_KEY = 'nsai_attribution'
const ATTR_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid']

function fbqSafe(...args) {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') window.fbq(...args)
  } catch {
    /* tracking must never break the site */
  }
}

let lastPath = null
export function trackPageView(path) {
  if (path === lastPath) return // guards React StrictMode double effects
  lastPath = path
  fbqSafe('track', 'PageView')
}

// Unique ID shared by the browser Lead event and the stored lead, so a later
// Conversions API Lead can be deduplicated against the browser event.
export function newEventId(prefix = 'lead') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${rand}`
}

export function trackLead(eventId, customData = {}) {
  fbqSafe('track', 'Lead', customData, { eventID: eventId })
}

// Remember the first-touch UTM / fbclid values for this browser session so
// they can be stored with the lead (V1 vs V2 attribution).
export function captureAttribution(search) {
  try {
    const p = new URLSearchParams(search)
    const found = {}
    ATTR_PARAMS.forEach((k) => {
      if (p.get(k)) found[k] = p.get(k)
    })
    if (Object.keys(found).length && !sessionStorage.getItem(ATTR_KEY)) {
      sessionStorage.setItem(ATTR_KEY, JSON.stringify(found))
    }
  } catch {
    /* storage unavailable — ignore */
  }
}

export function getAttribution() {
  try {
    return sessionStorage.getItem(ATTR_KEY) || ''
  } catch {
    return ''
  }
}
