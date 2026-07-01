import { Link } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import { ButtonLink } from '../components/Button.jsx'

export default function Cancel() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />

      <main className="flex-1">
        <section className="max-w-xl mx-auto px-5 sm:px-8 pt-14 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-ink-line px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-paper-faint" />
            <span className="font-mono text-[11px] tracking-widest text-paper-dim">CHECKOUT CANCELLED</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-3 text-balance">
            No charge was made.
          </h1>
          <p className="text-paper-dim leading-relaxed max-w-sm mx-auto mb-10">
            You closed checkout before paying. Your details weren't lost — pick up where you
            left off whenever you're ready.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <ButtonLink to="/signup">Try again</ButtonLink>
            <Link
              to="/"
              className="text-paper-dim text-sm font-medium hover:text-paper transition-colors px-2 py-3.5"
            >
              Back to homepage
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
