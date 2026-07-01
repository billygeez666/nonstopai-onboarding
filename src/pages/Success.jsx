import { useSearchParams, Link } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'

const NEXT_STEPS = [
  {
    label: 'NOW',
    title: "We've got your details",
    body: 'Your business information has been received and your payment is confirmed.',
  },
  {
    label: 'NEXT',
    title: 'Your receptionist is being set up',
    body: 'We configure your AI receptionist with your routes, hours and the way you like jobs handled.',
  },
  {
    label: 'WITHIN 24–48 HOURS',
    title: "You're live",
    body: "We'll email and text you once calls are being answered on your number.",
  },
]

export default function Success() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')

  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />

      <main className="flex-1">
        <section className="max-w-xl mx-auto px-5 sm:px-8 pt-14 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-live/30 bg-live-soft px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-live" />
            <span className="font-mono text-[11px] tracking-widest text-live">JOB CONFIRMED</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-3 text-balance">
            You're booked in.
          </h1>
          <p className="text-paper-dim leading-relaxed max-w-sm mx-auto mb-10">
            Thanks — your AI receptionist is being set up now. Here's exactly what happens
            next.
          </p>

          <div className="rounded-2xl border border-ink-line bg-ink-surface text-left overflow-hidden mb-8">
            {NEXT_STEPS.map((step, i) => (
              <div
                key={step.title}
                className={`px-6 py-5 ${
                  i !== NEXT_STEPS.length - 1 ? 'border-b border-ink-line' : ''
                }`}
              >
                <span className="font-mono text-[11px] tracking-widest text-signal">
                  {step.label}
                </span>
                <h3 className="font-display font-semibold text-base mt-1.5 mb-1">
                  {step.title}
                </h3>
                <p className="text-paper-dim text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          <p className="text-paper-faint text-xs leading-relaxed mb-1">
            Questions in the meantime? Reply to your confirmation email and we'll pick it up.
          </p>
          {sessionId && (
            <p className="text-paper-faint text-[11px] font-mono mt-6 break-all">
              REF {sessionId}
            </p>
          )}

          <Link
            to="/"
            className="inline-block mt-8 text-sm text-paper-dim hover:text-paper transition-colors"
          >
            ← Back to homepage
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  )
}
