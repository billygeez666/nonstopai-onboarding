import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import useMeta from '../hooks/useMeta.js'
import { CONTACT } from '../config/contact.js'
import './Home.css'

const META = {
  title: 'NONSTOP AI — Turn missed calls into paying customers',
  description:
    'A complete business system — professional website, 24/7 AI receptionist, booking capture and SMS follow-ups — installed and supported for you, on your own number.',
}

const SIGNUP = '/signup' // internal react-router route
// Internal vertical routes. In the app these can be react-router <Link> paths ('/taxi','/food','/signup').
// Kept as anchors so the component is router-agnostic; swap to <Link> if preferred.

export default function Home() {
  useMeta(META)
  // scroll-reveal + single-open FAQ, scoped to this component
  useEffect(() => {
    const root = document.querySelector('.nsh')
    if (!root) return
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
    }, { threshold: 0.12 })
    root.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    const t = setTimeout(() => root.querySelectorAll('.reveal:not(.in)').forEach((el) => el.classList.add('in')), 4000)

    const faq = [...root.querySelectorAll('.faq details')]
    const handlers = faq.map((d) => {
      const h = () => { if (d.open) faq.forEach((o) => { if (o !== d) o.open = false }) }
      d.addEventListener('toggle', h)
      return [d, h]
    })
    return () => { io.disconnect(); clearTimeout(t); handlers.forEach(([d, h]) => d.removeEventListener('toggle', h)) }
  }, [])

  const scrollTo = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="nsh">
      <header className="site">
        <div className="wrap navbar">
          <a className="brand" href="#top" onClick={(e) => scrollTo(e, 'top')}>NONSTOP<span className="dot">·</span>AI</a>
          <nav className="nav-cta">
            <a className="navlink hide-sm" href="#demo" onClick={(e) => scrollTo(e, 'demo')}>Demo</a>
            <a className="navlink hide-sm" href="#pricing" onClick={(e) => scrollTo(e, 'pricing')}>Pricing</a>
            <Link className="btn btn-primary" to={SIGNUP}>Get started</Link>
          </nav>
        </div>
      </header>
      <span id="top" />

      {/* PROBLEM + SOLUTION */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="wrap hero-grid">
          <div>
            <div className="price-kicker"><span className="amt">£99</span><span className="per">/month</span></div>
            <h1>Turn missed calls into <span className="hl">paying customers.</span></h1>
            <p className="hero-sub"><b>A complete business system</b> — website, AI receptionist and booking capture, set up on your own number.</p>
            <div className="hero-cta">
              <a className="btn btn-live" href="#demo" onClick={(e) => scrollTo(e, 'demo')}>▶ Hear it answer</a>
              <Link className="btn btn-ghost" to={SIGNUP}>Get started</Link>
            </div>
            <ul className="hero-ticks">
              <li>Keep your number</li><li>Live in 48 hours</li><li>£299 setup</li>
            </ul>
          </div>
          <div className="callcard" aria-hidden="true">
            <div className="bar"><span>Your front desk</span><span className="live-chip"><span className="pulse" /> Live</span></div>
            <div className="call-row">
              <div className="avatar">📞</div>
              <div><div className="call-num">07911 224 488</div><div className="call-meta">Missed at 11:47pm</div></div>
              <div className="call-status">Answered ✓</div>
            </div>
            <div className="transcript">
              <div className="tline ai d1">“Good evening — where would you like picking up?”</div>
              <div className="tline sys d2">✓ Booking captured · texted to your team</div>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section className="demo" id="demo">
        <div className="wrap">
          <div className="center reveal">
            <span className="eyebrow">Live demo · no signup</span>
            <h2 className="title">Don't trust us. Phone it yourself.</h2>
            <p className="sub">Two real AI lines, answering right now. Call like a customer would.</p>
          </div>
          <div className="demo-grid">
            <div className="demo-card reveal">
              <h3>This could be your taxi line.</h3>
              <p>Book a taxi and hear it captured in seconds.</p>
              <a className="btn btn-live callbtn" href="tel:+447449839233"><span className="cl">Call the live taxi demo</span><span className="cn">07449 839233</span></a>
            </div>
            <div className="demo-card reveal">
              <h3>This could be your takeaway.</h3>
              <p>Place an order and hear every detail captured.</p>
              <a className="btn btn-live callbtn" href="tel:+447460045201"><span className="cl">Call the live takeaway demo</span><span className="cn">07460 045201</span></a>
            </div>
          </div>
          <p className="demo-help">On a laptop? Dial from your phone — it's a real line answering 24/7.</p>
        </div>
      </section>

      {/* WHY US */}
      <section id="why">
        <div className="wrap">
          <div className="center reveal">
            <span className="eyebrow">Why NONSTOP AI</span>
            <h2 className="title">More bookings. Fewer missed customers.</h2>
          </div>
          <div className="why-rows reveal">
            <div className="why-row">Never miss another customer.</div>
            <div className="why-row">Open 24/7 — nights, weekends, the rush.</div>
            <div className="why-row">Keep your existing number.</div>
            <div className="why-row">Everything installed for you.</div>
            <div className="why-row">No technical knowledge needed.</div>
            <div className="why-row">Built for your industry.</div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing" id="pricing">
        <div className="wrap">
          <div className="center reveal"><span className="eyebrow">Pricing</span><h2 className="title">One price. Everything included.</h2></div>
          <div className="price-card reveal">
            <div className="price-tag"><span className="big">£99</span><span className="per">/month</span></div>
            <div className="price-setup">+ <b>£299</b> one-off setup</div>
            <ul className="price-list">
              <li>Professional website</li>
              <li>24/7 AI receptionist</li>
              <li>Booking &amp; order capture</li>
              <li>SMS follow-ups to customers</li>
              <li>Keep your existing number</li>
              <li>Installed &amp; supported for you</li>
            </ul>
            <Link className="btn btn-primary price-cta" to={SIGNUP}>Get started</Link>
            <p className="price-note">Secure checkout with Stripe.</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="wrap">
          <div className="center reveal"><span className="eyebrow">FAQ</span><h2 className="title">Good to know.</h2></div>
          <div className="faq reveal">
            <details open><summary>Keep my number? <span className="chev">+</span></summary><div className="ans">Yes. Calls route through the AI front desk on your existing number — nothing changes for your customers.</div></details>
            <details><summary>How fast is setup? <span className="chev">+</span></summary><div className="ans">Live within 24–48 hours of signup. We build and connect everything for you.</div></details>
            <details><summary>What if it can't answer something? <span className="chev">+</span></summary><div className="ans">It captures the details and can transfer to a number you choose, so a person can always pick up.</div></details>
            <details><summary>Can I try it before I pay? <span className="chev">+</span></summary><div className="ans">Yes — call either live demo above. No signup, no card.</div></details>
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section className="founder" id="founder">
        <div className="wrap">
          <div className="founder-grid reveal">
            <div className="founder-photo">
              <img
                src="/founder.webp"
                width="112"
                height="112"
                loading="lazy"
                decoding="async"
                alt={`${CONTACT.founderShort}, Founder of Nonstop AI`}
              />
            </div>
            <div className="founder-copy">
              <h2 className="title">Meet the founder</h2>
              <p className="founder-body">
                I help UK taxi firms recover lost bookings with professional websites and a
                24/7 AI receptionist. You'll deal directly with me from setup to ongoing
                support.
              </p>
              <div className="founder-sig">
                <span className="founder-name">{CONTACT.founderShort}</span>
                <span className="founder-role">Founder, Nonstop AI</span>
              </div>
              <div className="founder-contact">
                <a href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT ALEX */}
      <section className="contact" id="contact">
        <div className="wrap">
          <div className="center reveal">
            <span className="eyebrow">Talk to a human</span>
            <h2 className="title">Questions? Speak to {CONTACT.founderShort} directly.</h2>
            <p className="sub">
              No sales team, no ticket queue. You get the founder.
            
