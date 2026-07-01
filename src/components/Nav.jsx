import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <header className="border-b border-ink-line/70">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold text-lg tracking-tight">
          <span className="w-2 h-2 rounded-full bg-signal" />
          NONSTOP<span className="text-signal">AI</span>
        </Link>
        <Link
          to="/signup"
          className="hidden sm:inline-flex items-center rounded-full bg-signal text-ink font-semibold text-sm px-5 py-2.5 hover:bg-signal-dim transition-colors"
        >
          Get started
        </Link>
      </div>
    </header>
  )
}
