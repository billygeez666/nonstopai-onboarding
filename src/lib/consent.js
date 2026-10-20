// Consent-first Meta Pixel loader — NONSTOP AI dataset 1748159716430306.
// The Pixel script is NOT in index.html any more. It is injected here only after the
// visitor has clicked Accept. Reject (or no choice yet) = fbevents.js is never requested.
// The choice is stored in localStorage and re-asked after CONSENT_DAYS.

const PIXEL_ID = '1748159716430306'
const KEY = 'nsai_consent_v1'
const CONSENT_DAYS = 180
export const OPEN_EVENT = 'nsai:open-consent'
export const CHANGE_EVENT = 'nsai:consent-changed'

export function getConsent() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { v, t } = JSON.parse(raw)
    if ((v !== 'granted' && v !== 'denied') || !t) return null
    if (Date.now() - t > CONSENT_DAYS * 86400000) return null
    return v
  } catch {
    return null
  }
}

function store(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v, t: Date.now() }))
  } catch {
    /* storage unavailable: the choice applies to this page view only */
  }
}

let loaded = false

export function loadPixel() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', PIXEL_ID)
  window.fbq('track', 'PageView')
}

function clearPixelCookies() {
  try {
    ;['_fbp', '_fbc'].forEach((n) => {
      document.cookie = `${n}=; Max-Age=0; path=/`
      document.cookie = `${n}=; Max-Age=0; path=/; domain=${location.hostname}`
      document.cookie = `${n}=; Max-Age=0; path=/; domain=.${location.hostname}`
    })
  } catch {
    /* ignore */
  }
}

export function setConsent(v) {
  store(v)
  if (v === 'granted') {
    loadPixel()
  } else {
    try {
      if (typeof window.fbq === 'function') window.fbq('consent', 'revoke')
    } catch {
      /* ignore */
    }
    clearPixelCookies()
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: v }))
}

// Called once at app start. Loads the Pixel only if consent was already granted earlier.
export function initConsent() {
  if (getConsent() === 'granted') loadPixel()
}

export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}
