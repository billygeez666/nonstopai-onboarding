import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <header className="border-b border-ink-line/70">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" aria-label="NONSTOP AI">
          <img src="/nonstop-mark.png" alt="" width="112" height="91" className="h-7 w-auto" />
          <img src="/nonstop-wordmark.png" alt="NONSTOP AI" width="210" height="30" className="h-[13px] w-auto" />
        </Link>
        <Link
          to="/signup"
          className="inline-flex items-center rounded-full bg-brand-gradient text-ink font-semibold text-sm px-5 py-2.5 transition-transform duration-200 hover:-translate-y-px"
        >
          Get started
        </Link>
      </div>
    </header>
  )
}
