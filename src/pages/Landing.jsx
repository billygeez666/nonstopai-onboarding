import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import CallTicket from '../components/CallTicket.jsx'
import { ButtonLink } from '../components/Button.jsx'

const DEMO_PHONE = '+447449839233'

const BENEFITS = [
  {
    title: 'Professional taxi website',
    body: 'A custom, sleek website built for your taxi firm and deployed by us.',
  },
  {
    title: '24/7 AI receptionist',
    body: 'Every call gets answered — even when drivers are busy, the office is closed, or the phone would normally ring out.',
  },
  {
    title: 'Booking capture system',
    body: 'Captures pickup, drop-off, time, passenger details and enquiries so no job gets missed.',
  },
]

const INCLUDED = [
  {
    title: 'Complete taxi operating system',
    body: 'Website, AI receptionist, front desk, booking capture and notifications working together.',
  },
  {
    title: 'Customer front desk',
    body: 'One place for customers to call, book, ask questions and reach your firm properly.',
  },
  {
    title: 'Missed-call protection',
    body: 'Protects your firm from losing bookings when nobody can answer the phone.',
  },
  {
    title: 'Enquiry handling',
    body: 'Answers common questions, captures details, and helps customers get the right response.',
  },
  {
    title: 'Automatic notifications',
    body: 'Booking and enquiry details can be sent straight to your team by SMS or email.',
  },
  {
    title: 'Setup done for you',
    body: 'No tech work on your side. We build it, connect it, host it and help you go live.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Tell us about your taxi firm',
    body: 'You complete one simple form with your business details, phone number, services and booking process.',
  },
  {
    n: '02',
    title: 'We build your system',
    body: 'We set up your website, AI receptionist, booking capture and customer front desk.',
  },
  {
    n: '03',
    title: 'Go live',
    body: 'Your taxi operating system goes live so customers can call, book and enquire 24/7.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-line px-3 py-1 font-mono text-[11px] tracking-widest text-paper-dim mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                THE TAXI OPERATING SYSTEM
              </span>

              <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] text-balance mb-5">
                The complete operating system for taxi companies.
                <br />
                <span className="text-signal">Website. Calls. Bookings. Front desk.</span>
              </h1>

              <p className="text-paper-dim text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
                NONSTOP AI gives taxi firms a professional website, 24/7 AI receptionist,
                booking capture system, missed-call protection and customer front desk —
                fully set up for you.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <ButtonLink to="/signup" className="w-full sm:w-auto">
                  Get my Taxi OS
                </ButtonLink>
                <a
                  href="#demo"
                  className="text-paper-dim text-sm font-medium hover:text-paper transition-colors px-2 py-3.5"
                >
                  Try live demo ↓
                </a>
              </div>

              <p className="text-paper-faint text-xs mt-5 font-mono tracking-wide">
                SETUP DONE FOR YOU · KEEP YOUR EXISTING NUMBER · LIVE FAST
              </p>
            </div>

            <CallTicket />
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-ink-line bg-ink-surface p-6">
                <h3 className="font-display font-semibold text-lg mb-2">{b.title}</h3>
                <p className="text-paper-dim text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3 text-center">
            Not just an AI receptionist. A full taxi business system.
          </h2>
          <p className="text-paper-dim text-center mb-10 max-w-md mx-auto">
            Everything needed to help your taxi firm look professional, answer customers,
            capture bookings and stop enquiries slipping away.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-5">
            {INCLUDED.map((item) => (
              <div key={item.title} className="rounded-2xl border border-ink-line bg-ink-surface p-6">
                <h3 className="font-display font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-paper-dim text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="demo" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <div className="max-w-3xl mx-auto text-center rounded-2xl border border-signal/30 bg-ink-surface p-8 sm:p-10 shadow-2xl shadow-black/20">
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-line px-3 py-1 font-mono text-[11px] tracking-widest text-paper-dim mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-ping-slow" />
              LIVE TAXI DEMO
            </span>

            <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3">
              Call the demo and hear how the taxi system works.
            </h2>

            <p className="text-paper-dim text-sm sm:text-base leading-relaxed mb-7 max-w-xl mx-auto">
              This is the live AI taxi receptionist. Test it like a real customer:
              ask for a taxi, give a pickup, destination and time, and hear how the
              system captures the booking details.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`tel:${DEMO_PHONE}`}
                className="inline-flex items-center justify-center rounded-full bg-signal text-ink font-semibold text-[15px] px-6 py-3.5 hover:bg-signal-dim transition-colors duration-200 active:scale-[0.98] w-full sm:w-auto"
              >
                Call live taxi demo
              </a>

              <a
                href={`tel:${DEMO_PHONE}`}
                className="text-signal hover:text-signal-dim transition-colors font-medium"
              >
                {DEMO_PHONE}
              </a>
            </div>

            <p className="text-paper-faint text-xs mt-5 font-mono tracking-wide">
              REAL PHONE DEMO · BOOKING CAPTURE · 24/7 AI RECEPTIONIST
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-10 text-center">
            How it works
          </h2>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-mono text-signal text-sm tracking-widest">{s.n}</span>
                <h3 className="font-display font-semibold text-lg mt-2 mb-2">{s.title}</h3>
                <p className="text-paper-dim text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3 text-center">
            Simple pricing
          </h2>
          <p className="text-paper-dim text-center mb-10 max-w-md mx-auto">
            One system. Setup done for you. Built for taxi companies.
          </p>

          <div className="max-w-sm mx-auto rounded-2xl border border-signal/30 bg-ink-surface overflow-hidden shadow-2xl shadow-black/30">
            <div className="px-7 pt-7 pb-6">
              <span className="font-mono text-[11px] tracking-widest text-signal">TAXI OPERATING SYSTEM</span>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="font-display text-4xl font-semibold">£99</span>
                <span className="text-paper-dim text-sm">/month</span>
              </div>
              <p className="text-paper-faint text-xs mt-1 font-mono">+ £299 one-off setup</p>
            </div>

            <ul className="px-7 py-6 space-y-3 text-sm text-paper-dim border-t border-dashed border-ink-line">
              {[
                'Professional taxi website',
                '24/7 AI receptionist',
                'Booking capture system',
                'Customer front desk',
                'Missed-call protection',
                'Enquiry handling',
                'Automatic customer notifications',
                'Setup done for you',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-live shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="px-7 pb-7">
              <ButtonLink to="/signup" className="w-full">
                Get my Taxi OS
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}