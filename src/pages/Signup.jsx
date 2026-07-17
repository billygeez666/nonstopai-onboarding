import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import { Button } from '../components/Button.jsx'
import { liveVerticals, getVertical } from '../config/verticals/index.js'

// The niche options are derived from the vertical registry. Only verticals
// with status 'live' appear — which per the registry rule means their
// signupValue has an ACTIVE row in Supabase `pathway_templates`.
// The `value` sent to the backend is the vertical's signupValue (e.g. the
// /food page submits 'takeaway'), which must match pathway_templates.niche.
const NICHES = liveVerticals().map((v) => ({ value: v.signupValue, label: v.shortLabel }))

const STYLE_PRESETS = [
  { value: 'professional', label: 'Professional & efficient' },
  { value: 'friendly', label: 'Warm & friendly' },
  { value: 'direct', label: 'Fast & direct' },
]

// Booking sources, grouped. These are business-context answers only — we never
// ask for dispatch API credentials here. Values are stored in projects.booking_method.
const BOOKING_SOURCE_GROUPS = [
  {
    group: 'Over the phone',
    options: [
      { value: 'phone_office', label: 'Customers ring the office' },
      { value: 'phone_mobile', label: 'Customers ring a mobile' },
    ],
  },
  {
    group: 'Online',
    options: [
      { value: 'website', label: 'Our website' },
      { value: 'app', label: 'Our own app' },
    ],
  },
  {
    group: 'Through a dispatch system',
    options: [
      { value: 'dispatch_icabbi', label: 'iCabbi' },
      { value: 'dispatch_autocab', label: 'Autocab' },
      { value: 'dispatch_taxicaller', label: 'TaxiCaller' },
      { value: 'dispatch_other', label: 'Another dispatch system' },
    ],
  },
  {
    group: 'Something else',
    options: [
      { value: 'walk_in', label: 'Walk-ins and repeat customers' },
      { value: 'other', label: 'Other' },
    ],
  },
]

// Dashboard is deliberately excluded — it does not exist yet.
const BOOKING_DELIVERY = [
  { value: 'sms', label: 'By SMS' },
  { value: 'email', label: 'By email' },
  { value: 'decide_together', label: "We'll decide together" },
]

// Sources that need a free-text follow-up to be useful to us.
const NEEDS_DETAIL = ['dispatch_other', 'other']
// Sources where knowing the current site helps us build the new one.
const NEEDS_WEBSITE = ['website', 'app']

const initialForm = {
  business_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  niche: NICHES[0]?.value || 'taxi',
  city: '',
  business_address: '',
  business_description: '',
  transfer_number: '',
  opening_hours: '',
  booking_required: true,
  style_preset: 'professional',
  booking_method: 'phone_office',
  booking_method_detail: '',
  booking_method_website: '',
  keep_existing_number: true,
  answering_247: true,
  booking_delivery: 'sms',
}

function Field({ label, hint, children, htmlFor }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block font-mono text-[11px] tracking-widest text-paper-faint mb-2"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-paper-faint text-xs mt-1.5">{hint}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-ink-line bg-ink-surface px-4 py-3.5 text-[15px] text-paper placeholder:text-paper-faint focus:border-signal focus:outline-none transition-colors'

export default function Signup() {
  // /signup/:vertical pre-selects and locks the industry (e.g. /signup/food
  // locks the niche to 'takeaway'). Plain /signup keeps the dropdown open.
  const { vertical: verticalSlug } = useParams()
  const lockedVertical = (() => {
    if (!verticalSlug) return null
    const v = getVertical(verticalSlug)
    return v && v.status === 'live' ? v : null
  })()

  const [form, setForm] = useState(() => ({
    ...initialForm,
    niche: lockedVertical ? lockedVertical.signupValue : initialForm.niche,
  }))
  const [status, setStatus] = useState('idle') // idle | submitting | error
  const [error, setError] = useState('')

  const nicheLocked = !!lockedVertical || NICHES.length === 1

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('submitting')
    setError('')

    try {
      const res = await fetch('/api/start-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok || !data.checkout_url) {
        throw new Error(data.message || 'Something went wrong. Please try again.')
      }

      window.location.href = data.checkout_url
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />

      <main className="flex-1">
        <section className="max-w-xl mx-auto px-5 sm:px-8 pt-10 pb-20">
          <div className="mb-8">
            <span className="font-mono text-[11px] tracking-widest text-signal">
              STEP 1 OF 2
            </span>
            <h1 className="font-display text-3xl font-semibold mt-2 mb-2">
              Tell us about your business
            </h1>
            <p className="text-paper-dim text-sm leading-relaxed">
              Takes about two minutes. You'll pay securely on the next screen — nothing is
              charged until then.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="BUSINESS NAME" htmlFor="business_name">
              <input
                id="business_name"
                required
                className={inputClass}
                placeholder="e.g. Bolton Taxis Ltd"
                value={form.business_name}
                onChange={(e) => update('business_name', e.target.value)}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="YOUR NAME" htmlFor="contact_name">
                <input
                  id="contact_name"
                  required
                  className={inputClass}
                  placeholder="Full name"
                  value={form.contact_name}
                  onChange={(e) => update('contact_name', e.target.value)}
                />
              </Field>
              <Field label="CITY" htmlFor="city">
                <input
                  id="city"
                  required
                  className={inputClass}
                  placeholder="e.g. Bolton"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="BUSINESS ADDRESS"
              htmlFor="business_address"
              hint="Optional — used on your website if you want it shown."
            >
              <input
                id="business_address"
                className={inputClass}
                placeholder="e.g. 14 Mill Street, Bolton, BL1 1AA"
                value={form.business_address}
                onChange={(e) => update('business_address', e.target.value)}
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="EMAIL" htmlFor="contact_email">
                <input
                  id="contact_email"
                  type="email"
                  required
                  className={inputClass}
                  placeholder="you@business.com"
                  value={form.contact_email}
                  onChange={(e) => update('contact_email', e.target.value)}
                />
              </Field>
              <Field label="PHONE" htmlFor="contact_phone">
                <input
                  id="contact_phone"
                  type="tel"
                  required
                  className={inputClass}
                  placeholder="07911 224488"
                  value={form.contact_phone}
                  onChange={(e) => update('contact_phone', e.target.value)}
                />
              </Field>
            </div>

            <Field label="BUSINESS TYPE" htmlFor="niche">
              <select
                id="niche"
                className={inputClass}
                value={form.niche}
                onChange={(e) => update('niche', e.target.value)}
                disabled={nicheLocked}
              >
                {NICHES.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </select>
              {lockedVertical && (
                <p className="text-paper-faint text-xs mt-1.5">
                  You're signing up for {lockedVertical.name}.
                </p>
              )}
            </Field>

            <Field
              label="WHAT SHOULD WE KNOW ABOUT YOUR BUSINESS?"
              htmlFor="business_description"
              hint="Areas you cover, services, anything the receptionist should mention."
            >
              <textarea
                id="business_description"
                required
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="e.g. We cover Bolton and Bury, mostly local and airport runs..."
                value={form.business_description}
                onChange={(e) => update('business_description', e.target.value)}
              />
            </Field>

            <div className="pt-2 border-t border-ink-line">
              <h2 className="font-display text-lg font-semibold mt-6 mb-1">
                How you take bookings today
              </h2>
              <p className="text-paper-dim text-sm leading-relaxed mb-5">
                This just helps us build the right system. Your receptionist goes live in
                48 hours either way.
              </p>
            </div>

            <Field
              label="WHERE DO MOST OF YOUR BOOKINGS COME FROM TODAY?"
              htmlFor="booking_method"
            >
              <select
                id="booking_method"
                className={inputClass}
                value={form.booking_method}
                onChange={(e) => update('booking_method', e.target.value)}
              >
                {BOOKING_SOURCE_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            {NEEDS_DETAIL.includes(form.booking_method) && (
              <Field
                label="WHICH SYSTEM DO YOU USE?"
                htmlFor="booking_method_detail"
                hint="Just the name is fine — we'll look into it from there."
              >
                <input
                  id="booking_method_detail"
                  className={inputClass}
                  placeholder="e.g. Cordic, Ghost, an in-house system"
                  value={form.booking_method_detail}
                  onChange={(e) => update('booking_method_detail', e.target.value)}
                />
              </Field>
            )}

            {NEEDS_WEBSITE.includes(form.booking_method) && (
              <Field
                label="YOUR CURRENT WEBSITE OR APP"
                htmlFor="booking_method_website"
                hint="So we can match what already works for you."
              >
                <input
                  id="booking_method_website"
                  className={inputClass}
                  placeholder="e.g. boltontaxis.co.uk"
                  value={form.booking_method_website}
                  onChange={(e) => update('booking_method_website', e.target.value)}
                />
              </Field>
            )}

            <Field
              label="HOW SHOULD BOOKINGS REACH YOU?"
              htmlFor="booking_delivery"
              hint="Bookings arrive from day one. You can change this any time."
            >
              <select
                id="booking_delivery"
                className={inputClass}
                value={form.booking_delivery}
                onChange={(e) => update('booking_delivery', e.target.value)}
              >
                {BOOKING_DELIVERY.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-surface px-4 py-4">
              <input
                id="keep_existing_number"
                type="checkbox"
                className="mt-1 w-4 h-4 accent-signal shrink-0"
                checked={form.keep_existing_number}
                onChange={(e) => update('keep_existing_number', e.target.checked)}
              />
              <label
                htmlFor="keep_existing_number"
                className="text-sm text-paper-dim leading-relaxed"
              >
                <span className="text-paper font-medium">Keep my existing number</span>
                <br />
                Your customers carry on calling the same number. Nothing to reprint or
                re-advertise.
              </label>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-surface px-4 py-4">
              <input
                id="answering_247"
                type="checkbox"
                className="mt-1 w-4 h-4 accent-signal shrink-0"
                checked={form.answering_247}
                onChange={(e) => update('answering_247', e.target.checked)}
              />
              <label htmlFor="answering_247" className="text-sm text-paper-dim leading-relaxed">
                <span className="text-paper font-medium">Answer calls 24/7</span>
                <br />
                Recommended — nights, weekends and the rush are when most calls get missed.
                Untick to answer only during your opening hours.
              </label>
            </div>

            <div className="rounded-xl border border-ink-line bg-ink-surface px-4 py-4">
              <p className="text-sm text-paper font-medium mb-1.5">
                We're not asking for any logins or API keys.
              </p>
              <p className="text-sm text-paper-dim leading-relaxed">
                Everything above is background so we can build your system properly. If
                connecting your dispatch system ever turns out to be worth doing, we'll
                walk you through it separately — and only ever with credentials you're
                permitted to share. It never holds up your go-live.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <Field
                label="TRANSFER NUMBER"
                htmlFor="transfer_number"
                hint="Where to send calls it can't handle."
              >
                <input
                  id="transfer_number"
                  type="tel"
                  className={inputClass}
                  placeholder="Optional"
                  value={form.transfer_number}
                  onChange={(e) => update('transfer_number', e.target.value)}
                />
              </Field>
              <Field label="OPENING HOURS" htmlFor="opening_hours">
                <input
                  id="opening_hours"
                  required
                  className={inputClass}
                  placeholder="e.g. Mon–Sun, 7am–11pm"
                  value={form.opening_hours}
                  onChange={(e) => update('opening_hours', e.target.value)}
                />
              </Field>
            </div>

            <Field label="RECEPTIONIST STYLE" htmlFor="style_preset">
              <select
                id="style_preset"
                className={inputClass}
                value={form.style_preset}
                onChange={(e) => update('style_preset', e.target.value)}
              >
                {STYLE_PRESETS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-surface px-4 py-4">
              <input
                id="booking_required"
                type="checkbox"
                className="mt-1 w-4 h-4 accent-signal shrink-0"
                checked={form.booking_required}
                onChange={(e) => update('booking_required', e.target.checked)}
              />
              <label htmlFor="booking_required" className="text-sm text-paper-dim leading-relaxed">
                <span className="text-paper font-medium">Confirm every booking before it's passed on</span>
                <br />
                Recommended for most businesses — the receptionist reads the details back to
                the customer before sending them to your team.
              </label>
            </div>

            {status === 'error' && (
              <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Setting up…' : 'Continue to payment'}
            </Button>

            <p className="text-paper-faint text-xs text-center font-mono tracking-wide">
              SECURE CHECKOUT BY STRIPE
            </p>
          </form>
        </section>
      </main>

      <Footer />
    </div>
  )
}
