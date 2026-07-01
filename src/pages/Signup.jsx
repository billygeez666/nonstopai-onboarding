import { useState } from 'react'
import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import { Button } from '../components/Button.jsx'

const NICHES = ['Taxi', 'Takeaway', 'Eye Clinic', 'Other']
const STYLE_PRESETS = [
  { value: 'professional', label: 'Professional & efficient' },
  { value: 'friendly', label: 'Warm & friendly' },
  { value: 'direct', label: 'Fast & direct' },
]

const initialForm = {
  business_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  niche: 'Taxi',
  city: '',
  business_description: '',
  transfer_number: '',
  opening_hours: '',
  booking_required: true,
  style_preset: 'professional',
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
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState('idle') // idle | submitting | error
  const [error, setError] = useState('')

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
              Tell us about your firm
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
              >
                {NICHES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="WHAT SHOULD WE KNOW ABOUT YOUR BUSINESS?"
              htmlFor="business_description"
              hint="Areas you cover, fares, anything the receptionist should mention."
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
                <span className="text-paper font-medium">Confirm every job before dispatch</span>
                <br />
                Recommended for most firms — the receptionist reads the booking back before
                sending it to a driver.
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
