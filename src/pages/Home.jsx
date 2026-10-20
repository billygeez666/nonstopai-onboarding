import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import useMeta from '../hooks/useMeta.js'
import { CONTACT } from '../config/contact.js'
import SocialLinks from '../components/SocialLinks.jsx'
import ServiceEnquiryForm, { PRESELECT_EVENT } from '../components/ServiceEnquiryForm.jsx'
import { openCookieSettings } from '../lib/consent.js'
import './Home.css'

const META = {
  title: 'NONSTOP AI — Websites, AI receptionists, product video ads and business automation',
  description:
    'NONSTOP AI sets up four AI-powered services for your business: a professional website, a 24/7 AI receptionist, product video ads and business automation. Enquire first — no payment up front.',
}

const SIGNUP = '/signup' // internal react-router route — unchanged

const Ic = ({ d, c = '#5CD9F5' }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
const ICON = {
  web: 'M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5ZM3 9h18M7 6h.01M10 6h.01',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z',
  video: 'M4 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM17 10l5-3v10l-5-3',
  flow: 'M5 4h5v5H5zM14 15h5v5h-5zM7.5 9v3a2 2 0 0 0 2 2H14M16.5 15v-1',
}

function preselect(service) {
  window.dispatchEvent(new CustomEvent(PRESELECT_EVENT, { detail: service }))
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Muted looping hero backdrop. Falls back to the poster if autoplay is blocked or motion is reduced.
function HeroVideo() {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (!v || reduceMotion()) return
    v.muted = true
    const p = v.play()
    if (p && p.catch) p.catch(() => {})
  }, [])
  return (
    <video ref={ref} className="herovid" src="/media/video-ads/sneaker-ad.mp4" poster="/media/video-ads/sneaker-ad-poster.jpg"
      muted loop playsInline autoPlay={!reduceMotion()} preload="metadata" aria-hidden="true" tabIndex={-1} disablePictureInPicture />
  )
}

// Big receptionist film. Nothing downloads until play; plays with sound on tap.
function FilmPlayer() {
  const ref = useRef(null)
  const [state, setState] = useState('idle') // idle | playing | ended
  const play = () => {
    const v = ref.current
    if (!v) return
    if (!v.getAttribute('src')) v.src = '/ai-receptionist/video/nonstop-ai-30s.mp4'
    v.muted = false
    v.controls = true
    setState('playing')
    const p = v.play()
    if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => setState('idle')) })
  }
  return (
    <div className={`film ${state}`}>
      <video ref={ref} poster="/ai-receptionist/video/poster.jpg" playsInline preload="none" width="1280" height="720"
        aria-label="NONSTOP AI receptionist film" onEnded={() => { setState('ended') }} />
      {state !== 'playing' && (
        <button type="button" className="bigplay" onClick={play} aria-label={state === 'ended' ? 'Replay the film' : 'Play the film with sound'}>
          <span className="pi">{state === 'ended' ? '↻' : '▶'}</span>
          <span className="pt">{state === 'ended' ? 'Replay' : 'Watch it answer a call'}</span>
        </button>
      )}
    </div>
  )
}

// Perfume ad: autoplays muted when visible, plays once, holds the last frame, manual Play/Replay for iOS.
function OnceVideo() {
  const ref = useRef(null)
  const wrap = useRef(null)
  const done = useRef(false)
  const [state, setState] = useState('idle') // idle | playing | ended
  const start = useCallback(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    if (done.current) v.currentTime = 0
    const p = v.play()
    if (p && p.then) p.then(() => setState('playing')).catch(() => setState('idle'))
    else setState('playing')
  }, [])
  useEffect(() => {
    const el = wrap.current
    if (!el || reduceMotion() || !('IntersectionObserver' in window)) return
    let fired = false
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.55 && !fired && !done.current) {
          fired = true
          start()
          io.disconnect()
        }
      })
    }, { threshold: [0.55] })
    io.observe(el)
    return () => io.disconnect()
  }, [start])
  return (
    <div ref={wrap} className={`once ${state}`}>
      <video ref={ref} src="/media/video-ads/perfume-ad.mp4" poster="/media/video-ads/perfume-ad-poster.jpg" muted playsInline preload="metadata"
        width="720" height="1294" aria-label="Sample AI-generated perfume advert"
        onPlaying={() => setState('playing')} onEnded={() => { done.current = true; setState('ended') }} />
      {state !== 'playing' && (
        <button type="button" className="oncebtn" onClick={start} aria-label={state === 'ended' ? 'Replay the perfume advert' : 'Play the perfume advert'}>
          <span className="pi">{state === 'ended' ? '↻' : '▶'}</span>
          <span className="pt">{state === 'ended' ? 'Replay' : 'Play'}</span>
        </button>
      )}
    </div>
  )
}

const DEMOS = [
  { img: '/media/website-demos/cardiff-plumbing.jpg', name: 'Cardiff Plumbing', note: 'Click-to-call and quote request', href: 'https://cardiff-plumbing-preview.netlify.app/' },
  { img: '/media/website-demos/primefinish-decorating.jpg', name: 'PrimeFinish Decorating', note: 'Clear offer, free quotes', href: 'https://primefinish-decorating.netlify.app/' },
  { img: '/media/website-demos/clearline-exteriors.jpg', name: 'Clearline Exteriors', note: 'Sample build — fictional company', href: 'https://website-machine-sample-clearline.netlify.app/' },
]

function DemoCarousel() {
  const ref = useRef(null)
  const [i, setI] = useState(0)
  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const card = el.children[0]
    const step = card ? card.getBoundingClientRect().width + 16 : 1
    setI(Math.max(0, Math.min(DEMOS.length - 1, Math.round(el.scrollLeft / step))))
  }
  const go = (n) => {
    const el = ref.current
    if (!el) return
    const card = el.children[0]
    const step = card ? card.getBoundingClientRect().width + 16 : 0
    el.scrollTo({ left: n * step, behavior: reduceMotion() ? 'auto' : 'smooth' })
  }
  return (
    <div className="car">
      <div className="track" ref={ref} onScroll={onScroll} role="region" aria-label="Website examples, swipe sideways" tabIndex={0}>
        {DEMOS.map((d) => (
          <a key={d.name} className="dcard" href={d.href} target="_blank" rel="noopener noreferrer" aria-label={`${d.name} — open live example in a new tab`}>
            <img src={d.img} alt={`${d.name} website on a phone`} width="390" height="844" loading="lazy" decoding="async" />
            <span className="dcap"><b>{d.name}</b><small>{d.note}</small><em>View live &#8599;</em></span>
          </a>
        ))}
      </div>
      <div className="cnav">
        <button type="button" onClick={() => go(Math.max(0, i - 1))} aria-label="Previous example" disabled={i === 0}>&#8592;</button>
        <div className="dots">{DEMOS.map((d, n) => <i key={d.name} className={n === i ? 'on' : ''} />)}</div>
        <button type="button" onClick={() => go(Math.min(DEMOS.length - 1, i + 1))} aria-label="Next example" disabled={i === DEMOS.length - 1}>&#8594;</button>
      </div>
    </div>
  )
}

function Reveal({ children, className = '' }) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || reduceMotion() || !('IntersectionObserver' in window)) { setOn(true); return }
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { setOn(true); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`rv ${on ? 'in' : ''} ${className}`}>{children}</div>
}

export default function Home() {
  useMeta(META)
  const goEnquiry = (service) => () => preselect(service)

  return (
    <div className="nsh nsh2">
      <div className="nav">
        <div className="wrap navin">
          <a className="lock" href="#top" aria-label="NONSTOP AI">
            <img className="m" src="/nonstop-mark.png" alt="" />
            <img className="w" src="/nonstop-wordmark.png" alt="NONSTOP AI" />
          </a>
          <nav className="navlinks" aria-label="Main">
            <a href="#website">Websites</a>
            <a href="#receptionist">AI Receptionist</a>
            <a href="#video-ads">Video Ads</a>
            <a href="#automation">Automation</a>
          </nav>
          <div className="navcta">
            <SocialLinks className="social-head" />
            <a className="navtel" href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>
            <a className="btn btn-primary" href="#enquiry" onClick={goEnquiry('Not sure')}>Enquire</a>
          </div>
        </div>
      </div>

      {/* 1 ---- HERO ---- */}
      <section className="cine" id="top">
        <HeroVideo />
        <div className="cineshade" />
        <div className="wrap cinein">
          <span className="eyebrow">NONSTOP AI &middot; United Kingdom</span>
          <h1>Your business, <span className="gt">never off.</span></h1>
          <p className="cl">Websites, an AI receptionist, product video ads and automation &mdash; set up for you.</p>
          <div className="herobtns">
            <a className="btn btn-primary big" href="#enquiry" onClick={goEnquiry('Not sure')}>Start your enquiry</a>
            <a className="btn btn-ghost big" href="#website">See what we build</a>
          </div>
          <div className="svcrail" aria-label="Our four services">
            <a href="#website"><i /> Website Machine</a>
            <a href="#receptionist"><i /> AI Receptionist</a>
            <a href="#video-ads"><i /> Video Ads</a>
            <a href="#automation"><i /> Automation</a>
          </div>
        </div>
      </section>

      {/* 2 ---- WEBSITE MACHINE ---- */}
      <section className="show s-web" id="website">
        <div className="wrap">
          <Reveal>
            <span className="num">01</span>
            <span className="eyebrow">Website Machine</span>
            <h2>Websites that <span className="gt">look the part.</span></h2>
            <p className="short">Fast, mobile-first, built and launched for you.</p>
          </Reveal>
        </div>
        <Reveal><DemoCarousel /></Reveal>
        <div className="wrap">
          <Reveal className="pricerow">
            <div className="pc"><b>&pound;99</b><span>One-page website<br />one-off, no monthly fee</span></div>
            <div className="pc"><b>&pound;299<small> + &pound;99/mo</small></b><span>Website, business number and AI receptionist together</span></div>
          </Reveal>
          <p className="fine">A website does not by itself bring in customers &mdash; we don&rsquo;t sell advertising or SEO.</p>
          <div className="herobtns">
            <a className="btn btn-primary big" href="#enquiry" onClick={goEnquiry('Website Machine')}>Enquire about a website</a>
          </div>
        </div>
      </section>

      {/* 3 ---- AI RECEPTIONIST ---- */}
      <section className="show s-rec" id="receptionist">
        <div className="wrap">
          <Reveal>
            <span className="num">02</span>
            <span className="eyebrow">AI Receptionist</span>
            <h2>Every call answered, <span className="gt">day or night.</span></h2>
          </Reveal>
          <Reveal><FilmPlayer /></Reveal>
          <Reveal className="flow3">
            <div><i>1</i><b>Answers</b><span>Picks up on your business number, 24/7.</span></div>
            <div><i>2</i><b>Captures</b><span>Name, number and what they need.</span></div>
            <div><i>3</i><b>Alerts you</b><span>Details sent the moment they hang up.</span></div>
          </Reveal>
          <div className="herobtns">
            <a className="btn btn-primary big" href="/ai-receptionist/">See the AI receptionist</a>
            <a className="btn btn-ghost big" href="#enquiry" onClick={goEnquiry('AI Receptionist')}>Enquire</a>
          </div>
          <div className="dem">
            <span className="eyebrow">Hear it live</span>
            <a className="dial" href="tel:+447449839233"><span>Taxi demo</span><b>07449 839233</b></a>
            <a className="dial" href="tel:+447460045201"><span>Takeaway demo</span><b>07460 045201</b></a>
          </div>
        </div>
      </section>

      {/* 4 ---- PRODUCT VIDEO ADS ---- */}
      <section className="show s-vid" id="video-ads">
        <div className="wrap vidgrid">
          <Reveal className="vtxt">
            <span className="num">03</span>
            <span className="eyebrow">Product Video Ads</span>
            <h2>Adverts made for <span className="gt">the scroll.</span></h2>
            <p className="short">Cinematic five-second product ads for Instagram, TikTok and your site.</p>
            <div className="herobtns">
              <a className="btn btn-primary big" href="/product-video-ads/">Explore AI Video Ads</a>
            </div>
            <p className="fine">Our own sample advert &mdash; not client work. Priced per project; quote before you pay.</p>
          </Reveal>
          <Reveal className="vmedia"><OnceVideo /></Reveal>
        </div>
      </section>

      {/* 5 ---- BUSINESS AUTOMATION ---- */}
      <section className="show s-aut" id="automation">
        <div className="wrap">
          <Reveal>
            <span className="num">04</span>
            <span className="eyebrow">Business Automation</span>
            <h2>Less admin. <span className="gt">Faster follow-up.</span></h2>
          </Reveal>
          <Reveal>
            <div className="wf" role="img" aria-label="Animated example workflow: enquiry arrives, you are alerted, follow-up is sent, everything is recorded">
              <div className="wfn n1"><i>&#9993;</i><b>Enquiry</b></div>
              <div className="wfl"><u /></div>
              <div className="wfn n2"><i>&#128276;</i><b>You&rsquo;re alerted</b></div>
              <div className="wfl"><u /></div>
              <div className="wfn n3"><i>&#9889;</i><b>Follow-up sent</b></div>
              <div className="wfl"><u /></div>
              <div className="wfn n4"><i>&#10003;</i><b>Recorded</b></div>
            </div>
          </Reveal>
          <ul className="chips">
            <li>Instant alerts</li>
            <li>Automatic follow-ups</li>
            <li>Nothing lost</li>
          </ul>
          <div className="herobtns">
            <a className="btn btn-primary big" href="/business-automation/">Explore Business Automation</a>
            <a className="btn btn-ghost big" href="#enquiry" onClick={goEnquiry('Business Automation')}>Request a quote</a>
          </div>
        </div>
      </section>

      {/* 6 ---- ENQUIRY ---- */}
      <section className="sec" id="enquiry">
        <div className="wrap enq">
          <div className="sechead center">
            <span className="eyebrow">Get started</span>
            <h2>Tell us what you <span className="gt">need.</span></h2>
            <p>About a minute. No payment taken. Prefer to talk? Call <a className="tl" href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>.</p>
          </div>
          <ServiceEnquiryForm />
        </div>
      </section>

      <footer className="site">
        <div className="wrap fin">
          <div className="fbrand">
            <a className="lock" href="#top" aria-label="NONSTOP AI">
              <img className="m" src="/nonstop-mark.png" alt="" />
              <img className="w" src="/nonstop-wordmark.png" alt="NONSTOP AI" />
            </a>
            <p>Built for businesses that never want to miss another customer. United Kingdom.</p>
            <SocialLinks className="social-foot" showLabels />
          </div>
          <div className="fcols">
            <div className="fcol">
              <span className="h">Services</span>
              <a href="#website">Website Machine</a>
              <a href="#receptionist">AI Receptionist</a>
              <a href="/product-video-ads/">Product Video Ads</a>
              <a href="/business-automation/">Business Automation</a>
            </div>
            <div className="fcol">
              <span className="h">Industries</span>
              <Link to="/taxi">Taxi OS</Link>
              <Link to="/food">FOOD OS</Link>
            </div>
            <div className="fcol">
              <span className="h">Get in touch</span>
              <a href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>
              <a href={`mailto:${CONTACT.email}`}>Email us</a>
              <a href="/privacy/">Privacy</a>
              <button type="button" className="linkbtn" onClick={openCookieSettings}>Cookie settings</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
