import { Link } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />
      <main className="flex-1 flex items-center justify-center px-5 py-24 text-center">
        <div>
          <span className="font-mono text-[11px] tracking-widest text-paper-faint">404</span>
          <h1 className="font-display text-2xl font-semibold mt-2 mb-4">Page not found</h1>
          <Link to="/" className="text-signal text-sm font-medium hover:underline">
            ← Back to homepage
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
