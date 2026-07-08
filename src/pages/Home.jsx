import { Link } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import CallTicket from '../components/CallTicket.jsx'
import { ButtonLink } from '../components/Button.jsx'
import useMeta from '../hooks/useMeta.js'
import { VERTICALS, UPCOMING } from '../config/verticals/index.js'

const META = {
  title: 'NONSTOP AI — AI Operating Systems for Service Businesses',
  description:
    'Every missed call is lost revenue. NONSTOP AI builds complete AI operating systems - website, 24/7 AI receptionist, booking and order capture - for taxi firms, takeaways and more. Setup done for you.',
}

// Generic platform ticket stages — vertical-neutral version of the animation.
const PLATFORM_TICKET = {
  header: 'FRONT DESK',
  stages: [
    {
      key: 'ringing',
      label: 'INCOMING CALL',
      dotClass: 'bg-signal animate-ping-slow',
      line1: '07911 224 488',
      line2: 'Mobile · 11:47pm',
      footLabel: 'STATUS',
      footValue: 'Ringing…',
      footClass: 'text-signal',
    },
    {
      key: 'answering',
      label: 'AI RECEPTIONIST',
      dotClass: 'bg-signal',
      line1: 'Answered in 1 ring',
      line2: '“Thanks for calling — how can I help?”',
      footLabel: 'STATUS',
      footValue: 'Capturing details…',
      footClass: 'text-paper-dim',
    },
    {
      key: 'booked',
      label: 'CAPTURED',
      dotClass: 'bg-live',
      line1: 'Booking details taken',
      line2: 'Customer confirmed · Team notified',
      footLabel: 'STATUS',
      footValue: 'Revenue saved',
      footClass: 'text-live',
    },
  ],
}

const PROBLEMS = [
  {
    title: 'Missed calls are lost revenue',
    body: 'When the phone rings out, the customer calls your competitor. Most service businesses lose bookings every single week this way.',
  },
  {
    title: 'After-hours enquiries go nowhere',
    body: 'Customers call at night, on weekends, during the rush. An AI front desk answers every one, 24/7, without hiring anyone.',
  },
  {
    title: 'Slow follow-up kills deals',
    body: 'Details get scribbled down, lost, or never captured. Every call is captured in full and sent straight to your team.',
  },
]

const INCLUDED = [
  {
    title: 'Professional website',
    body: 'A custom, sleek website for your business, built and deployed by us.',
  },
  {
    title: '24/7 AI receptionist',
    body: 'Every call answered — even when your team is busy, closed, or off the clock.',
  },
  {
    title: 'Booking & order capture',
    body: 'Captures the details that matter for your industry so nothing gets missed.',
  },
  {
    title: 'Missed-call protection',
    body: 'Protects your business from losing customers when nobody can answer.',
  },
  {
    title: 'Automatic notifications',
    body: 'Bookings and enquiries sent straight to your team by SMS or email.',
  },
  {
    title: 'Setup done for you',
    body: 'No tech work on your side. We build it, connect it, host it and take you live.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Choose your industry',
    body: 'Pick your operating system below and tell us about your business in one simple form.',
  },
  {
    n: '02',
    title: 'We build your system',
    body: 'Website, AI receptionist, capture system and customer front desk — set up for you.',
  },
  {
    n: '03',
    title: 'Go live',
    body: 'Your operating system goes live so customers can call, book and order 24/7.',
  },
]

export default function Home() {
  useMeta(META)

  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-line px-3 py-1 font-mono text-[11px] tracking-widest text-paper-dim mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                AI OPERATING SYSTEMS FOR SERVICE BUSINESSES
              </span>

              <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] text-balance mb-5">
                Every missed call is lost revenue.
                <br />
                <span className="text-signal">We make sure you never miss another.</span>
              </h1>

              <p className="text-paper-dim text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
                NONSTOP AI builds complete AI operating systems — website, 24/7 AI
                receptionist, booking and order capture, customer front desk — built for
                your industry and fully set up for you.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <a
                  href="#industries"
                  className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-[15px] transition-colors duration-200 active:scale-[0.98] bg-signal text-ink hover:bg-signal-dim shadow-lg shadow-signal/20 w-full sm:w-auto"
                >
                  Choose your industry ↓
                </a>
                <Link
                  to="/signup"
                  className="text-paper-dim text-sm font-medium hover:text-paper transition-colors px-2 py-3.5"
                >
                  Get started →
                </Link>
              </div>

              <p className="text-paper-faint text-xs mt-5 font-mono tracking-wide">
                SETUP DONE FOR YOU · KEEP YOUR EXISTING NUMBER · LIVE FAST
              </p>
            </div>

            <CallTicket header={PLATFORM_TICKET.header} stages={PLATFORM_TICKET.stages} />
          </div>
        </section>

        {/* Industry picker */}
        <section id="industries" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3 text-center">
            Built for your business
          </h2>
          <p className="text-paper-dim text-center mb-10 max-w-md mx-auto">
            One operating system per industry. Pick yours.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-5">
            {VERTICALS.filter((v) => v.status === 'live').map((v) => (
              <Link
                key={v.slug}
                to={`/${v.slug}`}
                className="group rounded-2xl border border-signal/30 bg-ink-surface p-6 hover:border-signal transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] tracking-widest text-signal">
                    {v.name.toUpperCase()}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-live">
                    <span className="w-1.5 h-1.5 rounded-full bg-live animate-ping-slow" />
                    LIVE
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{v.shortLabel}</h3>
                <p className="text-paper-dim text-sm leading-relaxed mb-4">{v.cardBlurb}</p>
                <span className="text-signal text-sm font-medium group-hover:underline">
                  Open {v.name} →
                </span>
              </Link>
            ))}

            {UPCOMING.map((u) => (
              <div
                key={u.name}
                className="rounded-2xl border border-ink-line bg-ink-surface p-6 opacity-70"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] tracking-widest text-paper-faint">
                    {u.name.toUpperCase()} OS
                  </span>
                  <span className="font-mono text-[10px] tracking-widest text-paper-faint">
                    COMING SOON
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{u.name}</h3>
                <p className="text-paper-dim text-sm leading-relaxed">{u.blurb}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The problem */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-10 text-center">
            The revenue you never see leaving
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-5">
            {PROBLEMS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-ink-line bg-ink-surface p-6">
                <h3 className="font-display font-semibold text-lg mb-2">{b.title}</h3>
                <p className="text-paper-dim text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What every OS includes */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3 text-center">
            Every operating system includes
          </h2>
          <p className="text-paper-dim text-center mb-10 max-w-md mx-auto">
            Not just an AI receptionist. A complete business system, tailored to your industry.
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

        {/* How it works */}
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

        {/* Final CTA */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <div className="max-w-3xl mx-auto text-center rounded-2xl border border-signal/30 bg-ink-surface p-8 sm:p-10 shadow-2xl shadow-black/20">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3">
              Stop losing customers to a ringing phone.
            </h2>
            <p className="text-paper-dim text-sm sm:text-base leading-relaxed mb-7 max-w-xl mx-auto">
              £299 setup, £99/month. Your complete operating system, built and launched for
              you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="#industries"
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-[15px] transition-colors duration-200 active:scale-[0.98] bg-signal text-ink hover:bg-signal-dim shadow-lg shadow-signal/20 w-full sm:w-auto"
              >
                Find your industry
              </a>
              <ButtonLink to="/signup" variant="ghost" className="w-full sm:w-auto">
                Get started now
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
