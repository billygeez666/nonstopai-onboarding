import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import CallTicket from '../components/CallTicket.jsx'
import { ButtonLink } from '../components/Button.jsx'

// Reusable vertical landing template. Renders any config from
// src/config/verticals/. Section order and styling are identical to the
// original taxi Landing.jsx — only the content is parameterized.

export default function VerticalLanding({ config }) {
  const signupTo = config.signupPath || '/signup'
  const isLive = config.status === 'live'

  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-line px-3 py-1 font-mono text-[11px] tracking-widest text-paper-dim mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                {config.badge}
              </span>

              <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] text-balance mb-5">
                {config.heroTitle}
                <br />
                <span className="text-signal">{config.heroAccent}</span>
              </h1>

              <p className="text-paper-dim text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
                {config.heroBody}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
                <ButtonLink to={signupTo} className="w-full sm:w-auto">
                  {config.ctaLabel}
                </ButtonLink>
                {config.demoPhone && (
                  <a
                    href="#demo"
                    className="text-paper-dim text-sm font-medium hover:text-paper transition-colors px-2 py-3.5"
                  >
                    Try live demo ↓
                  </a>
                )}
              </div>

              <p className="text-paper-faint text-xs mt-5 font-mono tracking-wide">
                {config.heroTicker}
              </p>
            </div>

            <CallTicket header={config.ticket.header} stages={config.ticket.stages} />
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-5">
            {config.benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-ink-line bg-ink-surface p-6">
                <h3 className="font-display font-semibold text-lg mb-2">{b.title}</h3>
                <p className="text-paper-dim text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3 text-center">
            {config.includedHeading}
          </h2>
          <p className="text-paper-dim text-center mb-10 max-w-md mx-auto">
            {config.includedSub}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-5">
            {config.included.map((item) => (
              <div key={item.title} className="rounded-2xl border border-ink-line bg-ink-surface p-6">
                <h3 className="font-display font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-paper-dim text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {config.demoPhone && (
          <section id="demo" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
            <div className="max-w-3xl mx-auto text-center rounded-2xl border border-signal/30 bg-ink-surface p-8 sm:p-10 shadow-2xl shadow-black/20">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-line px-3 py-1 font-mono text-[11px] tracking-widest text-paper-dim mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-live animate-ping-slow" />
                {config.demo.badge}
              </span>

              <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3">
                {config.demo.title}
              </h2>

              <p className="text-paper-dim text-sm sm:text-base leading-relaxed mb-7 max-w-xl mx-auto">
                {config.demo.body}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={`tel:${config.demoPhone}`}
                  className="inline-flex items-center justify-center rounded-full bg-signal text-ink font-semibold text-[15px] px-6 py-3.5 hover:bg-signal-dim transition-colors duration-200 active:scale-[0.98] w-full sm:w-auto"
                >
                  {config.demo.buttonLabel}
                </a>

                <a
                  href={`tel:${config.demoPhone}`}
                  className="text-signal hover:text-signal-dim transition-colors font-medium"
                >
                  {config.demoPhone}
                </a>
              </div>

              <p className="text-paper-faint text-xs mt-5 font-mono tracking-wide">
                {config.demo.ticker}
              </p>
            </div>
          </section>
        )}

        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 border-t border-ink-line/70">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-10 text-center">
            How it works
          </h2>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
            {config.steps.map((s) => (
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
            {config.pricing.sub}
          </p>

          <div className="max-w-sm mx-auto rounded-2xl border border-signal/30 bg-ink-surface overflow-hidden shadow-2xl shadow-black/30">
            <div className="px-7 pt-7 pb-6">
              <span className="font-mono text-[11px] tracking-widest text-signal">
                {config.pricing.label}
              </span>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="font-display text-4xl font-semibold">£{config.pricing.monthly}</span>
                <span className="text-paper-dim text-sm">/month</span>
              </div>
              <p className="text-paper-faint text-xs mt-1 font-mono">
                + £{config.pricing.setup} one-off setup
              </p>
            </div>

            <ul className="px-7 py-6 space-y-3 text-sm text-paper-dim border-t border-dashed border-ink-line">
              {config.pricing.features.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-live shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="px-7 pb-7">
              {isLive ? (
                <ButtonLink to={signupTo} className="w-full">
                  {config.ctaLabel}
                </ButtonLink>
              ) : (
                <p className="text-center font-mono text-xs tracking-widest text-paper-faint py-3">
                  LAUNCHING SOON
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
