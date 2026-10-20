import { useEffect, useRef, useState } from 'react'
import { CONTACT } from '../config/contact.js'
import { getAttribution, newEventId, trackLead } from '../lib/metaPixel.js'

// Posts to the Netlify Form "service-enquiry" (registered statically in /forms/index.html).
// Same fields as the Phase 1 pages, so the existing n8n notifier handles it unchanged.
// Does NOT touch /api/demo-request, Supabase or the signup/Stripe flow.
const SERVICES = ['Website Machine', 'AI Receptionist', 'Product Video Ads', 'Business Automation', 'Not sure']
const PACKAGES = {
  'Website Machine': ['One-page website', 'Website with booking or enquiry system', 'Larger or custom website', 'Not sure yet'],
  'AI Receptionist': ['AI receptionist with business number', 'Receptionist plus website', 'Not sure yet'],
  'Product Video Ads': ['Single product advert', 'Several adverts', 'Not sure yet'],
  'Business Automation': ['Enquiry & follow-up automation', 'Custom workflow', 'Not sure yet'],
  'Not sure': ['Not sure yet'],
}
export const PRESELECT_EVENT = 'nsai:preselect'

export default function ServiceEnquiryForm() {
  const [service, setService] = useState('Not sure')
  const [pkg, setPkg] = useState('Not sure yet')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const formRef = useRef(null)

  useEffect(() => {
    const on = (e) => {
      const s = e.detail
      if (SERVICES.includes(s)) {
        setService(s)
        setPkg(PACKAGES[s][PACKAGES[s].length - 1])
      }
    }
    window.addEventListener(PRESELECT_EVENT, on)
    return () => window.removeEventListener(PRESELECT_EVENT, on)
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const f = formRef.current
    const fd = new FormData(f)
    if (fd.get('bot-field')) return
    const name = String(fd.get('name') || '').trim()
    const biz = String(fd.get('business_name') || '').trim()
    const email = String(fd.get('email') || '').trim()
    if (!name || !biz) return setError('Please add your name and business name.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Please enter a valid email address.')

    let attr = {}
    try { attr = JSON.parse(getAttribution() || '{}') || {} } catch { attr = {} }
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'].forEach((k) => fd.set(k, attr[k] || ''))
    fd.set('referrer', (document.referrer || '').slice(0, 300))
    fd.set('source_page', location.pathname)
    fd.set('form-name', 'service-enquiry')

    setStatus('sending')
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fd).toString(),
      })
      if (!res.ok) throw new Error('http ' + res.status)
      trackLead(newEventId('enquiry'), { content_name: 'service-enquiry' }) // no-op unless the visitor accepted ad cookies
      setStatus('done')
    } catch {
      setStatus('idle')
      setError(`Sorry, that didn't send. Please try again, or call us on ${CONTACT.phoneDisplay}.`)
    }
  }

  if (status === 'done') {
    return (
      <div className="formcard thanks" role="status">
        <h3>Thanks — we&rsquo;ve got your enquiry.</h3>
        <p>We&rsquo;ll review it and reply by email. No payment is taken at this stage.</p>
      </div>
    )
  }

  return (
    <form ref={formRef} className="formcard" name="service-enquiry" method="POST" onSubmit={onSubmit} noValidate>
      <input type="hidden" name="form-name" value="service-enquiry" />
      <p className="hp" aria-hidden="true"><label>Leave this empty <input name="bot-field" tabIndex={-1} autoComplete="off" /></label></p>
      <div className="fgrid">
        <div><label htmlFor="h-name">Your name</label><input id="h-name" name="name" autoComplete="name" required /></div>
        <div><label htmlFor="h-biz">Business name</label><input id="h-biz" name="business_name" autoComplete="organization" required /></div>
        <div><label htmlFor="h-email">Email</label><input id="h-email" name="email" type="email" inputMode="email" autoComplete="email" required /></div>
        <div><label htmlFor="h-phone">Phone <small>(optional)</small></label><input id="h-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" /></div>
        <div>
          <label htmlFor="h-svc">Service</label>
          <select id="h-svc" name="service" value={service} onChange={(e) => { setService(e.target.value); setPkg(PACKAGES[e.target.value].slice(-1)[0]) }}>
            {SERVICES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="h-pkg">What do you need?</label>
          <select id="h-pkg" name="package" value={pkg} onChange={(e) => setPkg(e.target.value)}>
            {PACKAGES[service].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label htmlFor="h-msg">Tell us a little about it <small>(optional)</small></label>
        <textarea id="h-msg" name="message" />
      </div>
      {error && <p className="ferr" role="alert">{error}</p>}
      <button className="btn btn-primary full" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send enquiry'}
      </button>
      <p className="priv">No payment is taken. We use your details only to reply to this enquiry. See our <a href="/privacy/">privacy policy</a>.</p>
    </form>
  )
}
