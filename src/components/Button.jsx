import { Link } from 'react-router-dom'

export function ButtonLink({ to, children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary:
      'bg-signal text-ink hover:bg-signal-dim shadow-lg shadow-signal/20',
    ghost:
      'bg-transparent text-paper border border-ink-line hover:border-paper-dim',
  }
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-[15px] transition-colors duration-200 active:scale-[0.98] ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary:
      'bg-signal text-ink hover:bg-signal-dim shadow-lg shadow-signal/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-signal',
    ghost:
      'bg-transparent text-paper border border-ink-line hover:border-paper-dim',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-[15px] transition-colors duration-200 active:scale-[0.98] ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
