import { Link } from 'react-router-dom'

// Brand CTA styling. `primary` is the NONSTOP AI gradient; `ghost` is a hairline
// outline on ink. Shapes, padding and behaviour are unchanged from the previous
// version so every existing call site keeps working.
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-[15px] transition-all duration-200 active:scale-[0.98]'

const STYLES = {
  primary:
    'bg-brand-gradient text-ink shadow-lg shadow-signal/25 hover:-translate-y-px hover:shadow-xl hover:shadow-signal/30',
  ghost:
    'bg-transparent text-paper border border-ink-line hover:border-paper-dim',
}

const DISABLED =
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg'

export function ButtonLink({ to, children, variant = 'primary', className = '', ...props }) {
  return (
    <Link to={to} className={`${BASE} ${STYLES[variant]} ${className}`} {...props}>
      {children}
    </Link>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`${BASE} ${STYLES[variant]} ${DISABLED} ${className}`} {...props}>
      {children}
    </button>
  )
}
