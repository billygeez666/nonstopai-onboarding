import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import { Button } from '../components/Button.jsx'

// Payment-free onboarding for paying £99/month customers. Reached only through
// the single-use link emailed after Stripe confirms payment. No Stripe, no card
// fields, no redirect to checkout.

const BUSINESS_TYPES = [
  { value: 'Restaurant', label: 'Restaurant' },
  { value: 'Takeaway', label: 'Takeaway' },
  { value: 'Taxi / private hire', label: 'Taxi / private hire' },
  { value: 'Other', label: 'Other' },
]

const SERVICE_TYPES = ['Dine in', 'Collection', 'Delivery']

const initialForm = {
  contact_name: '',
  business_name: '',
  contact_email: '',
  business_phone: '',
  business_type: 'Restaurant',
  business_type_other: '',
  website_url: '',
  address_or_area: '',
  opening_hours: '',
  services: '',
  faqs: '',
  ai_number: '',
  greeting: '',
  typical_enquiries: '',
  booking_requirements: '',
  calendar_requirements: '',
  escalation: '',
  notify_email: '',
  notify_phone: '',
  special_instructions: '',
  hp: '',
}

const inputClass =
  'w-full rounded-xl border border-ink-line bg-ink-surface px-4 py-3.5 text-[15px] text-paper placeholder:text-paper-faint focus:border-signal focus:outline-none transition-colors'

function Field({ label, hint, htmlFor, children, required }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block font-mono text-[11px] tracking-widest text-paper-faint mb-2">
        {label}
        {required ? '' : ' (OPTIONAL)'}
      </label>
      {children}
      {hint && <p className="text-paper-faint text-xs mt-1.5">{hint}</p>}
    </div>
  )
}

function Shell({ children }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />
      <main className="flex-1">
        <section className="max-w-xl mx-auto px-5 sm:px-8 pt-10 pb-20">{children}</section>
      </main>
      <Footer />
    </div>
  )
}

function Message({ title, body }) {
  return (
    <Shell>
      <div className="text-center pt-6">
        <h1 className="font-display text-3xl font-semibold mb-3 text-balance">{title}</h1>
        <p className="text-paper-dim leading-relaxed max-w-sm mx-auto whitespace-pre-line">{body}</p>
      </div>
    </Shell>
  )
}

export default function Welcome() {
  const { token } = useParams()
  const [linkState, setLinkState] = useState('checking') // checking | ok | invalid | expired | submitted | error
  const [form, setForm] = useState(initialForm)
  const [serviceTypes, setServiceTypes] = useState([])
  const [menuLink, setMenuLink] = useState('')
  const [tableBookings, setTableBookings] = useState('')
  const [status, setStatus] = useState('idle') // idle | submitting | error | done
  const [error, setError] = useState('')

  useEffect(() => {
    // Keep this page out of search results.
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex,nofollow'
    document.head.appendChild(meta)
    document.title = 'NONSTOP AI onboarding'
    return () => meta.remove()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/offer-onboarding?token=${encodeURIComponent(token || '')}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setLinkState(d.state || 'error'))
      .catch(() => !cancelled && setLinkState('error'))
    return () => {
      cancelled = true
    }
  }, [token])

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const isFood = form.business_type === 'Restaurant' || form.business_type === 'Takeaway'

  function toggleService(s) {
    setServiceTypes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setStatus('submitting')
    const business_type =
      form.business_type === 'Other' ? form.business_type_other.trim() || 'Other' : form.business_type
    const extra = isFood
      ? {
          restaurant_service_types: serviceTypes.join(', '),
          restaurant_menu_link: menuLink,
          restaurant_takes_table_bookings: tableBookings,
        }
      : {}
    try {
      const res = await fetch('/api/offer-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, business_type, token, extra }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setStatus('done')
        window.scrollTo({ top: 0 })
        return
      }
      if (data.reason === 'submitted') {
        setLinkState('submitted')
        return
      }
      setError(data.message || "We couldn't save your details. Please try again.")
      setStatus('error')
    } catch {
      setError("We couldn't reach our systems. Please check your connection and try again.")
      setStatus('error')
    }
  }

  if (linkState === 'checking') return <Message title="One moment…" body="" />
  if (linkState === 'invalid')
    return <Message title="This link isn't valid" body="Please use the link in your onboarding email, or reply to that email and we'll help." />
  if (linkState === 'expired')
    return <Message title="This link has expired" body="Reply to your onboarding email and we'll send you a fresh one." />
  if (linkState === 'submitted')
    return <Message title="Already received" body="We already have your business details, so there's nothing more to do here. We'll be in touch when your receptionist is ready for testing." />
  if (linkState === 'error')
    return <Message title="Something went wrong" body="Please refresh the page in a moment, or reply to your onboarding email." />

  if (status === 'done') {
    return (
      <Message
        title="Thank you!"
        body={
          "We've received your business details.\n\nYour NONSTOP AI Receptionist onboarding is now in progress.\n\nWe'll review your information, configure your AI receptionist and contact you when it's ready for testing."
        }
      />
    )
  }

  return (
    <Shell>
      <div className="mb-8">
        <span className="font-mono text-[11px] tracking-widest text-signal">PAYMENT RECEIVED</span>
        <h1 className="font-display text-3xl font-semibold mt-2 mb-2">Tell us about your business</h1>
        <p className="text-paper-dim text-sm leading-relaxed">
          This takes about five minutes. Nothing to pay here: your subscription is already set up. We use these
          answers to configure your AI receptionist.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Honeypot: real people never see or fill this. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', height: 0, overflow: 'hidden' }}>
          <label htmlFor="hp">Leave this empty</label>
          <input id="hp" tabIndex={-1} autoComplete="off" value={form.hp} onChange={(e) => update('hp', e.target.value)} />
        </div>

        <h2 className="font-display text-lg font-semibold">Your details</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="FULL NAME" htmlFor="contact_name" required>
            <input id="contact_name" required maxLength={200} className={inputClass} autoComplete="name" value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} />
          </Field>
          <Field label="BUSINESS NAME" htmlFor="business_name" required>
            <input id="business_name" required maxLength={200} className={inputClass} autoComplete="organization" value={form.business_name} onChange={(e) => update('business_name', e.target.value)} />
          </Field>
          <Field label="EMAIL ADDRESS" htmlFor="contact_email" required>
            <input id="contact_email" type="email" required maxLength={254} className={inputClass} autoComplete="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} />
          </Field>
          <Field label="BUSINESS TELEPHONE" htmlFor="business_phone" required>
            <input id="business_phone" type="tel" required maxLength={40} className={inputClass} autoComplete="tel" value={form.business_phone} onChange={(e) => update('business_phone', e.target.value)} />
          </Field>
        </div>

        <div className="pt-2 border-t border-ink-line">
          <h2 className="font-display text-lg font-semibold mt-6 mb-5">Your business</h2>
        </div>
        <Field label="BUSINESS TYPE" htmlFor="business_type" required>
          <select id="business_type" className={inputClass} value={form.business_type} onChange={(e) => update('business_type', e.target.value)}>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        {form.business_type === 'Other' && (
          <Field label="WHAT KIND OF BUSINESS?" htmlFor="business_type_other" required>
            <input id="business_type_other" required maxLength={100} className={inputClass} value={form.business_type_other} onChange={(e) => update('business_type_other', e.target.value)} />
          </Field>
        )}
        <Field label="WEBSITE" htmlFor="website_url">
          <input id="website_url" type="url" maxLength={300} placeholder="https://" className={inputClass} value={form.website_url} onChange={(e) => update('website_url', e.target.value)} />
        </Field>
        <Field label="ADDRESS OR SERVICE AREA" htmlFor="address_or_area" required>
          <input id="address_or_area" required maxLength={500} className={inputClass} value={form.address_or_area} onChange={(e) => update('address_or_area', e.target.value)} />
        </Field>
        <Field label="OPENING HOURS" htmlFor="opening_hours" required hint="For example: Mon–Thu 12:00–22:00, Fri–Sat 12:00–23:00, Sun closed.">
          <textarea id="opening_hours" required rows={3} maxLength={1000} className={`${inputClass} resize-none`} value={form.opening_hours} onChange={(e) => update('opening_hours', e.target.value)} />
        </Field>
        <Field label="SERVICES YOU OFFER" htmlFor="services" required>
          <textarea id="services" required rows={4} maxLength={3000} className={`${inputClass} resize-none`} value={form.services} onChange={(e) => update('services', e.target.value)} />
        </Field>
        <Field label="FREQUENTLY ASKED QUESTIONS" htmlFor="faqs" hint="Questions customers ask you often, with the answers you'd like given.">
          <textarea id="faqs" rows={4} maxLength={4000} className={`${inputClass} resize-none`} value={form.faqs} onChange={(e) => update('faqs', e.target.value)} />
        </Field>

        {isFood && (
          <div className="rounded-2xl border border-ink-line bg-ink-surface px-5 py-5 space-y-5">
            <h2 className="font-display text-base font-semibold">Restaurant &amp; takeaway questions</h2>
            <div>
              <p className="block font-mono text-[11px] tracking-widest text-paper-faint mb-2">HOW DO CUSTOMERS ORDER? (OPTIONAL)</p>
              <div className="flex flex-wrap gap-4">
                {SERVICE_TYPES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm text-paper-dim">
                    <input type="checkbox" className="w-4 h-4 accent-signal" checked={serviceTypes.includes(s)} onChange={() => toggleService(s)} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <Field label="LINK TO YOUR MENU" htmlFor="menu_link" hint="A web link is fine. If you only have a PDF or photos, reply to your onboarding email with them.">
              <input id="menu_link" maxLength={500} className={inputClass} value={menuLink} onChange={(e) => setMenuLink(e.target.value)} />
            </Field>
            <Field label="DO YOU TAKE TABLE BOOKINGS?" htmlFor="table_bookings">
              <select id="table_bookings" className={inputClass} value={tableBookings} onChange={(e) => setTableBookings(e.target.value)}>
                <option value="">Select…</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </Field>
          </div>
        )}

        <div className="pt-2 border-t border-ink-line">
          <h2 className="font-display text-lg font-semibold mt-6 mb-5">Your AI receptionist</h2>
        </div>
        <Field label="NUMBER THE AI SHOULD ANSWER" htmlFor="ai_number" required hint="The number customers ring. If you're not sure how this works, put your business number and we'll talk it through with you.">
          <input id="ai_number" type="tel" required maxLength={40} className={inputClass} value={form.ai_number} onChange={(e) => update('ai_number', e.target.value)} />
        </Field>
        <Field label="HOW SHOULD IT GREET CALLERS?" htmlFor="greeting">
          <textarea id="greeting" rows={2} maxLength={500} className={`${inputClass} resize-none`} value={form.greeting} onChange={(e) => update('greeting', e.target.value)} />
        </Field>
        <Field label="WHAT DO CALLERS TYPICALLY ASK ABOUT?" htmlFor="typical_enquiries" required>
          <textarea id="typical_enquiries" required rows={3} maxLength={2000} className={`${inputClass} resize-none`} value={form.typical_enquiries} onChange={(e) => update('typical_enquiries', e.target.value)} />
        </Field>
        <Field label="BOOKING REQUIREMENTS" htmlFor="booking_requirements" hint="What details do you need from a caller to take a booking or order?">
          <textarea id="booking_requirements" rows={3} maxLength={2000} className={`${inputClass} resize-none`} value={form.booking_requirements} onChange={(e) => update('booking_requirements', e.target.value)} />
        </Field>
        <Field label="CALENDAR OR BOOKING SYSTEM" htmlFor="calendar_requirements" hint="Do you use a calendar or booking system we should know about?">
          <textarea id="calendar_requirements" rows={2} maxLength={1000} className={`${inputClass} resize-none`} value={form.calendar_requirements} onChange={(e) => update('calendar_requirements', e.target.value)} />
        </Field>
        <Field label="CALL FORWARDING OR ESCALATION" htmlFor="escalation" hint="When should a call be passed to you or a team member, and to which number?">
          <textarea id="escalation" rows={2} maxLength={1000} className={`${inputClass} resize-none`} value={form.escalation} onChange={(e) => update('escalation', e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="NOTIFICATION EMAIL" htmlFor="notify_email" hint="Where we send messages and enquiries.">
            <input id="notify_email" type="email" maxLength={254} className={inputClass} value={form.notify_email} onChange={(e) => update('notify_email', e.target.value)} />
          </Field>
          <Field label="NOTIFICATION PHONE" htmlFor="notify_phone">
            <input id="notify_phone" type="tel" maxLength={40} className={inputClass} value={form.notify_phone} onChange={(e) => update('notify_phone', e.target.value)} />
          </Field>
        </div>
        <Field label="ANYTHING ELSE WE SHOULD KNOW?" htmlFor="special_instructions">
          <textarea id="special_instructions" rows={3} maxLength={2000} className={`${inputClass} resize-none`} value={form.special_instructions} onChange={(e) => update('special_instructions', e.target.value)} />
        </Field>

        {status === 'error' && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        <Button type="submit" className="w-full" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Sending…' : 'Send my business details'}
        </Button>
        <p className="text-paper-faint text-xs text-center font-mono tracking-wide">NO PAYMENT NEEDED ON THIS PAGE</p>
      </form>
    </Shell>
  )
}
