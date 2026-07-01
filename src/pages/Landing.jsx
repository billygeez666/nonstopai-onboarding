import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import CallTicket from '../components/CallTicket.jsx'
import { ButtonLink } from '../components/Button.jsx'

const BENEFITS = [
  {
    title: 'Never miss a fare',
    body: 'Every call gets answered — even when every driver is on the road and the phone would normally just ring out.',
  },
  {
    title: 'Books while you work',
    body: 'Takes the pickup, drop-off and time, then sends the finished job straight to your dispatch — no re-typing.',
  },
  {
    title: 'Always on shift',
    body: "Nights, weekends, bank holidays. It doesn't take breaks, get tired, or clock off at 11pm.",
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Tell us about your firm',
    body: 'A short form — your business name, your number, your hours, how you take bookings today.',
  },
  {
    n: '02',
    title: 'We set up your line',
    body: 'Your AI receptionist is configured with your routes, your pricing style, and how you like jobs handled.',
  },
  {
    n: '03',
    title: 'Go live in 24–48 hours',
    body: 'Calls start getting answered and booked automatically. You keep your existing number.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />

      <main className="flex-1">
        {/* HERO */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-line px-3 py-1 font-mono text-[11px] tracking-widest text-paper-dim mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                FOR UK TAXI FIRMS
              </span>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] text-balance mb-5">
                Every call answered.
                <br />
                Every ride booked.
                <br />
                <span className="text-signal">Even at 2am.</span>
              </h1>
              <p className="text-paper-dim text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
                NONSTOPAI is a dedicated AI receptionist for taxi firms. It answers your
                phone, books the job, and sends it straight to dispatch — live in 24–48 hours.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <ButtonLink to="/signup" className="w-full sm:w-auto">
                  Get my AI receptionist
                </ButtonLink>
                <a
                  href="#pricing"
                  className="text-paper-dim text-sm font-medium hover:text-paper transition-colors px-2 py-3.5"
                >
                  See pricing ↓
                </a>
              </div>
              <p className="text-paper-faint text-xs mt-5 font-mono tracking-wide">
                KEEP YOUR EXISTING NUMBER · NO TECH SETUP ON YOUR END
              </p>
            </div>

            <CallTicket />
          </div>
        </section>

        {/* BENEFITS */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-5">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-ink-line bg-ink-surface p-6"
              >
                <h3 className="font-display font-semibold text-lg mb-2">{b.title}</h3>
                <p className="text-paper-dim text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-10 text-center">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="relative pl-0">
                <span className="font-mono text-signal text-sm tracking-widest">{s.n}</span>
                <h3 className="font-display font-semibold text-lg mt-2 mb-2">{s.title}</h3>
                <p className="text-paper-dim text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3 text-center">
            Simple pricing
          </h2>
          <p className="text-paper-dim text-center mb-10 max-w-md mx-auto">
            One plan. Everything set up for you. Cancel any time.
          </p>

          <div className="max-w-sm mx-auto rounded-2xl border border-signal/30 bg-ink-surface overflow-hidden shadow-2xl shadow-black/30">
            <div className="px-7 pt-7 pb-6">
              <span className="font-mono text-[11px] tracking-widest text-signal">AI RECEPTIONIST</span>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="font-display text-4xl font-semibold">£99</span>
                <span className="text-paper-dim text-sm">/month</span>
              </div>
              <p className="text-paper-faint text-xs mt-1 font-mono">+ £299 one-off setup</p>
            </div>

            <div className="px-7 border-t border-dashed border-ink-line" />

            <ul className="px-7 py-6 space-y-3 text-sm text-paper-dim">
              {[
                'Answers calls on your existing number',
                'Books jobs and sends them to dispatch',
                'Live in 24–48 hours',
                'Cancel any time',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-live shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="px-7 pb-7">
              <ButtonLink to="/signup" className="w-full">
                Get my AI receptionist
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
