import { useEffect, useState } from 'react'
import { getConsent, setConsent, OPEN_EVENT } from '../lib/consent.js'
import './ConsentBanner.css'

// Cookie / advertising consent. Accept and Reject are equally prominent.
export default function ConsentBanner() {
  const [open, setOpen] = useState(() => getConsent() === null)

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  if (!open) return null
  const choose = (v) => {
    setConsent(v)
    setOpen(false)
  }

  return (
    <div className="nsc" role="dialog" aria-modal="false" aria-labelledby="nsc-title" aria-describedby="nsc-desc">
      <div className="nsc-in">
        <div className="nsc-txt">
          <b id="nsc-title">Cookies &amp; advertising</b>
          <p id="nsc-desc">
            We&rsquo;d like to use Meta (Facebook/Instagram) advertising cookies to measure our ads. Nothing is loaded
            unless you accept. See our <a href="/privacy/">privacy policy</a>. You can change your mind at any time via
            &ldquo;Cookie settings&rdquo; in the footer.
          </p>
        </div>
        <div className="nsc-btns">
          <button type="button" className="nsc-btn" onClick={() => choose('denied')}>Reject</button>
          <button type="button" className="nsc-btn" onClick={() => choose('granted')}>Accept</button>
        </div>
      </div>
    </div>
  )
}
