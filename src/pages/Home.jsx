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


const I2 = {
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7',
  bot: 'M12 3v3M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3ZM9 13h.01M15 13h.01M9.5 16.5h5',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3ZM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  send: 'M21 3 10 14M21 3l-7 18-4-7-7-4Z',
  chat: 'M4 5h16v11H9l-5 4Z',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM6 11a6 6 0 0 0 12 0M12 17v4',
  grid: 'M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01',
  spk: 'M4 9v6h4l5 4V5L8 9ZM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  end: 'M3 14c5-5 13-5 18 0l-2.5 2.5-3-1.5v-2.5a11 11 0 0 0-5 0V15l-3 1.5Z',
  check: 'M5 12.5 10 17.5 19 7',
  arr: 'M5 12h14M13 6l6 6-6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  x: 'M6 6l12 12M18 6 6 18',
  win: 'M3 5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5ZM3 9h18',
}
const Ico = ({ d, s = 18, c = 'currentColor', w = 1.8 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const saveData = () => typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData === true

// Deterministic night skyline for the hero (pure SVG, no image asset).
function Skyline() {
  const b = []
  let x = 0, seed = 7
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  while (x < 1200) {
    const w = 38 + Math.floor(rnd() * 54), h = 90 + Math.floor(rnd() * 230)
    b.push({ x, w, h })
    x += w + 4
  }
  const wins = []
  b.forEach((bd, bi) => {
    for (let wy = 20; wy < bd.h - 8; wy += 13) {
      for (let wx = 7; wx < bd.w - 8; wx += 11) {
        if (rnd() > 0.62) wins.push({ k: `${bi}-${wx}-${wy}`, x: bd.x + wx, y: 400 - bd.h + wy, c: rnd() > 0.55 ? '#5CD9F5' : rnd() > 0.5 ? '#D24BF5' : '#F4C46A', o: 0.25 + rnd() * 0.5 })
      }
    }
  })
  return (
    <svg className="sky" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#141a3a" /><stop offset="1" stopColor="#070913" /></linearGradient></defs>
      {b.map((bd, i) => <rect key={i} x={bd.x} y={400 - bd.h} width={bd.w} height={bd.h} fill="url(#bg1)" />)}
      {wins.map((w) => <rect key={w.k} x={w.x} y={w.y} width="4" height="6" fill={w.c} opacity={w.o} />)}
    </svg>
  )
}

function HeroScene() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="sceneglow" />
      <Skyline />
      <div className="bokeh"><i /><i /><i /><i /><i /><i /></div>
      <div className="laptop">
        <div className="lscreen">
          <div className="lglare" />
          <img className="lm" src="/nonstop-mark.png" alt="" />
          <img className="lw" src="/nonstop-wordmark.png" alt="" />
        </div>
        <div className="lbase" />
      </div>
      <div className="aiphone"><span>AI</span></div>
    </div>
  )
}

const DEMOS = [
  { id: 'cardiff', name: 'Cardiff Plumbing', note: 'Click-to-call and quote request', d: '/media/website-demos/cardiff-plumbing-desktop.jpg', m: '/media/website-demos/cardiff-plumbing.jpg', href: 'https://cardiff-plumbing-preview.netlify.app/' },
  { id: 'primefinish', name: 'PrimeFinish Decorating', note: 'Clear offer and free quotes', d: '/media/website-demos/primefinish-decorating-desktop.jpg', m: '/media/website-demos/primefinish-decorating.jpg', href: 'https://primefinish-decorating.netlify.app/' },
  { id: 'clearline', name: 'Clearline Exteriors', note: 'Sample build — fictional company', d: '/media/website-demos/clearline-exteriors-desktop.jpg', m: '/media/website-demos/clearline-exteriors.jpg', href: 'https://website-machine-sample-clearline.netlify.app/' },
  { id: 'roofers', name: 'Roofersites UK', note: 'Our £99 website offer for roofers', d: '/media/website-demos/roofersites-uk-desktop.jpg', m: '/media/website-demos/roofersites-uk.jpg', href: 'https://roofersites-uk.netlify.app/' },
]

function Showroom() {
  const [i, setI] = useState(0)
  const touch = useRef(null)
  const n = DEMOS.length
  const go = (k) => setI(((k % n) + n) % n)
  const cur = DEMOS[i]
  const onKey = (e) => { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1) }
  return (
    <div className="show-room">
      <div className="stage" tabIndex={0} onKeyDown={onKey} aria-roledescription="carousel" aria-label="Website examples. Use arrow keys or swipe."
        onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touch.current == null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1))
        }}>
        <div className="dev-laptop">
          <div className="dl-screen">
            {DEMOS.map((d, k) => <img key={d.id} className={k === i ? 'on' : ''} src={d.d} alt={k === i ? `${d.name} website on desktop` : ''} aria-hidden={k !== i} loading={k === 0 ? 'eager' : 'lazy'} width="1280" height="800" decoding="async" />)}
          </div>
          <div className="dl-base" />
        </div>
        <div className="dev-phone">
          <div className="dp-notch" />
          {DEMOS.map((d, k) => <img key={d.id} className={k === i ? 'on' : ''} src={d.m} alt={k === i ? `${d.name} website on a phone` : ''} aria-hidden={k !== i} loading="lazy" width="390" height="844" decoding="async" />)}
        </div>
        <button type="button" className="arw l" onClick={() => go(i - 1)} aria-label="Previous website"><Ico d="M15 5l-7 7 7 7" s={20} /></button>
        <button type="button" className="arw r" onClick={() => go(i + 1)} aria-label="Next website"><Ico d="M9 5l7 7-7 7" s={20} /></button>
      </div>
      <p className="scap" aria-live="polite"><b>{cur.name}</b> <span>{cur.note}</span> <a href={cur.href} target="_blank" rel="noopener noreferrer">View live &#8599;</a></p>
      <div className="thumbs" role="tablist" aria-label="Choose a website example">
        {DEMOS.map((d, k) => (
          <button key={d.id} type="button" role="tab" aria-selected={k === i} aria-label={d.name} className={k === i ? 'on' : ''} onClick={() => go(k)}>
            <img src={d.d} alt="" loading="lazy" width="320" height="200" decoding="async" />
          </button>
        ))}
      </div>
    </div>
  )
}

const CALL_STEPS = [
  { ic: I2.mic, t: 'Thanks for calling. How can I help today?' },
  { ic: I2.chat, t: 'Capture enquiry' },
  { ic: I2.cal, t: 'Book appointment' },
  { ic: I2.mail, t: 'Send to your email' },
]
function CallShowcase() {
  return (
    <div className="callwrap">
      <div className="cphone" role="img" aria-label="Illustration of an AI receptionist answering a call">
        <div className="cp-top"><span>NONSTOP AI</span></div>
        <div className="cp-num">+44 7360 266496</div>
        <div className="cp-sub">NONSTOP AI</div>
        <div className="wave" aria-hidden="true">{Array.from({ length: 31 }).map((_, k) => <i key={k} style={{ '--d': `${(k % 9) * 0.11}s`, '--h': `${14 + Math.round(Math.abs(Math.sin(k * 0.7)) * 46)}px` }} />)}</div>
        <div className="cp-time">00:12</div>
        <div className="cp-btns">
          <span><i><Ico d={I2.mic} s={20} /></i>Mute</span>
          <span><i><Ico d={I2.grid} s={20} w={3} /></i>Keypad</span>
          <span><i><Ico d={I2.spk} s={20} /></i>Speaker</span>
        </div>
        <div className="cp-end"><Ico d={I2.end} s={26} c="#fff" /></div>
      </div>
      <ol className="csteps" aria-label="Example call, illustrative">
        {CALL_STEPS.map((s, k) => (
          <li key={s.t} style={{ '--i': k }}><span className="ci"><Ico d={s.ic} s={18} /></span>{s.t}</li>
        ))}
        <li className="cnote">Illustrative example &mdash; not a recorded call.</li>
      </ol>
    </div>
  )
}

// Perfume ad (A): lazy, autoplays muted when visible, plays once, holds the last frame, manual Play/Replay.
function OnceVideo() {
  const ref = useRef(null)
  const wrap = useRef(null)
  const done = useRef(false)
  const [state, setState] = useState('idle') // idle | playing | ended
  const begin = useCallback(() => {
    const v = ref.current
    if (!v) return
    if (!v.getAttribute('src')) v.src = '/media/video-ads/perfume-ad.mp4'
    v.muted = true
    if (done.current) { try { v.currentTime = 0 } catch (e) { /* ignore */ } }
    const p = v.play()
    if (p && p.catch) p.catch(() => setState('idle'))
  }, [])
  useEffect(() => {
    const el = wrap.current
    if (!el || reduceMotion() || saveData() || !('IntersectionObserver' in window)) return
    let fired = false
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting && !fired && !done.current) { fired = true; io.disconnect(); begin() }
      })
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [begin])
  return (
    <div ref={wrap} className={`vframe ${state}`}>
      <div className="vbg" style={{ backgroundImage: 'url(/media/video-ads/perfume-ad-poster.jpg)' }} />
      <div className="vwrap">
        <video ref={ref} poster="/media/video-ads/perfume-ad-poster.jpg" muted playsInline preload="none" width="720" height="1294"
          aria-label="Sample AI-generated perfume advert"
          onPlaying={() => setState('playing')} onEnded={() => { done.current = true; setState('ended') }} />
      </div>
      {state !== 'playing' && (
        <button type="button" className="vplay" onClick={begin} aria-label={state === 'ended' ? 'Replay the perfume advert' : 'Play the perfume advert'}>
          <span className="vpi">{state === 'ended' ? '↻' : '▶'}</span>
        </button>
      )}
    </div>
  )
}

const PRICES = [
  { key: 'starter', name: 'Starter', price: '£99', per: 'one-off', items: ['1-page website', 'Contact form', 'Mobile friendly'], cta: 'Get started', svc: 'Website Machine' },
  { key: 'business', name: 'Business', price: '£299', per: 'setup + £99/month', items: ['Professional website', 'Business number', '24/7 AI receptionist', 'Set up, tested and launched by us'], cta: 'Get started', svc: 'AI Receptionist', pop: true },
  { key: 'custom', name: 'Custom', price: '£599+', per: '', items: ['Larger websites', 'Booking or enquiry systems', 'Quoted before you pay'], cta: 'Discuss your project', svc: 'Website Machine' },
]

const FLOW = [
  { ic: I2.mail, t: 'Enquiry received' },
  { ic: I2.bot, t: 'AI handles conversation' },
  { ic: I2.db, t: 'Lead saved in CRM' },
  { ic: I2.send, t: 'Follow-up sent automatically' },
]

export default function Home() {
  useMeta(META)
  const [menu, setMenu] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const goEnquiry = (service) => () => { preselect(service); setMenu(false) }
  const close = () => setMenu(false)

  return (
    <div className="nsh nsh3">
      <header className="tn">
        <div className="tnin">
          <a className="lock" href="#top" aria-label="NONSTOP AI home" onClick={close}>
            <img className="m" src="/nonstop-mark.png" alt="" />
            <img className="w" src="/nonstop-wordmark.png" alt="NONSTOP AI" />
          </a>
          <nav className="tlinks" aria-label="Main">
            <a href="#top">Home</a>
            <a href="#website">Services</a>
            <a href="#about">About</a>
            <a href="#enquiry">Contact</a>
          </nav>
          <div className="tcta">
            <SocialLinks className="social-head" />
            <a className="btn btn-primary sm" href="#enquiry" onClick={goEnquiry('Not sure')}>Enquire</a>
            <button type="button" className="burger" aria-expanded={menu} aria-controls="mnav" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => setMenu(!menu)}>
              <Ico d={menu ? I2.x : I2.menu} s={22} />
            </button>
          </div>
        </div>
        {menu && (
          <nav id="mnav" className="mnav" aria-label="Mobile">
            <a href="#top" onClick={close}>Home</a>
            <a href="#website" onClick={close}>Website Machine</a>
            <a href="#receptionist" onClick={close}>AI Receptionist</a>
            <a href="#video-ads" onClick={close}>Product Video Ads</a>
            <a href="#automation" onClick={close}>Business Automation</a>
            <a href="#about" onClick={close}>About</a>
            <a href="#enquiry" onClick={goEnquiry('Not sure')}>Contact / Enquire</a>
            <a className="mtel" href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>
          </nav>
        )}
      </header>

      <main className="pg">
        {/* HERO */}
        <section className="panel hero3" id="top">
          <HeroScene />
          <div className="h3txt">
            <span className="eyebrow">AI systems for UK businesses</span>
            <h1>We Help Businesses <span className="gt">Grow with AI.</span></h1>
            <p className="lede3">Professional websites, 24/7 AI receptionists, cinematic product video ads and smart business automation &mdash; built for your business.</p>
            <div className="btnrow">
              <a className="btn btn-primary big" href="#enquiry" onClick={goEnquiry('Not sure')}>Start your enquiry <Ico d={I2.arr} s={16} /></a>
              <a className="btn btn-ghost big" href="#website">See our services</a>
            </div>
            <div className="chips3" aria-label="Our four services">
              <a href="#website"><Ico d={I2.win} s={15} />Websites</a>
              <a href="#receptionist"><Ico d={ICON.phone} s={15} />AI Receptionist</a>
              <a href="#video-ads"><Ico d={ICON.video} s={15} />Video Ads</a>
              <a href="#automation"><Ico d={ICON.flow} s={15} />Automation</a>
            </div>
          </div>
        </section>

        {/* WEBSITE MACHINE */}
        <section className="panel sv s-web" id="website">
          <div className="svgrid">
            <div className="svhead">
              <span className="eyebrow">01 &middot; Website Machine</span>
              <h2>Professional websites that <span className="gt">get you enquiries.</span></h2>
              <p>Modern, mobile-first websites with clear calls to action, click-to-call and enquiry forms. We write it, build it and put it live &mdash; you don&rsquo;t touch a dashboard.</p>
              <ul className="tick">
                <li>Mobile-friendly and fast</li>
                <li>Enquiry form and click-to-call</li>
                <li>Booking or enquiry capture on larger builds</li>
                <li>Works with our AI receptionist</li>
              </ul>
            </div>
            <div className="svmedia"><Showroom /></div>
            <div className="svcta btnrow">
              <a className="btn btn-primary" href="#enquiry" onClick={goEnquiry('Website Machine')}>Enquire about a website</a>
              <a className="btn btn-ghost" href="#website" onClick={(e) => { e.preventDefault(); document.querySelector('.stage')?.focus() }}>View examples</a>
            </div>
          </div>
          <div className="prices">
            {PRICES.map((p) => (
              <div key={p.key} className={`pcard${p.pop ? ' pop' : ''}`}>
                {p.pop && <span className="poptag">Most popular</span>}
                <h3>{p.name}</h3>
                <div className="pprice"><b>{p.price}</b> <span>{p.per}</span></div>
                <ul>{p.items.map((t) => <li key={t}><Ico d={I2.check} s={13} w={2.6} />{t}</li>)}</ul>
                <a className={`btn ${p.pop ? 'btn-primary' : 'btn-ghost'} full`} href="#enquiry" onClick={goEnquiry(p.svc)}>{p.cta}</a>
              </div>
            ))}
          </div>
          <p className="pfine">A website does not by itself bring in customers &mdash; we don&rsquo;t sell advertising or SEO.</p>
        </section>

        {/* AI RECEPTIONIST */}
        <section className="panel sv s-rec" id="receptionist">
          <div className="svgrid">
            <div className="svhead">
              <span className="eyebrow">02 &middot; AI Receptionist</span>
              <h2>Never miss <span className="gt">another enquiry.</span></h2>
              <p>Our AI receptionist answers your calls 24/7, captures enquiries and takes bookings, so you never miss business again.</p>
              <ul className="tick">
                <li>Answers calls day and night</li>
                <li>Captures caller details</li>
                <li>Books appointments where needed</li>
                <li>Set up, tested and launched by us</li>
              </ul>
            </div>
            <div className="svmedia"><CallShowcase /></div>
            <div className="svcta">
              <div className="btnrow">
                <button type="button" className="btn btn-primary" aria-expanded={demoOpen} onClick={() => setDemoOpen(!demoOpen)}>Listen to a demo call</button>
                <a className="btn btn-ghost" href="#enquiry" onClick={goEnquiry('AI Receptionist')}>Enquire now</a>
                <a className="btn btn-ghost" href="/ai-receptionist/">See the AI receptionist</a>
              </div>
              {demoOpen && (
                <div className="demopanel" role="region" aria-label="Live demo lines">
                  <span>Call a live demo line &mdash; no signup:</span>
                  <a className="dial" href="tel:+447449839233"><span>Taxi demo</span><b>07449 839233</b></a>
                  <a className="dial" href="tel:+447460045201"><span>Takeaway demo</span><b>07460 045201</b></a>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PRODUCT VIDEO ADS */}
        <section className="panel sv s-vid" id="video-ads">
          <div className="svgrid vgrid3">
            <div className="svhead">
              <span className="eyebrow">03 &middot; Product Video Ads</span>
              <h2>AI-made adverts for <span className="gt">the way people scroll.</span></h2>
              <p>Cinematic short product ads for Instagram, TikTok, Facebook and your website &mdash; made from your product, without a film crew.</p>
            </div>
            <div className="svmedia"><OnceVideo /></div>
            <div className="svcta">
              <div className="btnrow">
                <a className="btn btn-primary" href="/product-video-ads/">View more video examples</a>
                <a className="btn btn-ghost" href="#enquiry" onClick={goEnquiry('Product Video Ads')}>Request a quote</a>
              </div>
              <p className="pfine l">Our own sample advert &mdash; not client work. Priced per project; you see a quote before you pay.</p>
            </div>
          </div>
        </section>

        {/* BUSINESS AUTOMATION */}
        <section className="panel sv s-aut" id="automation">
          <div className="svgrid autgrid">
            <div className="svhead">
              <span className="eyebrow">04 &middot; Business Automation</span>
              <h2>Smarter systems for <span className="gt">a more efficient business.</span></h2>
              <p>We set up AI and automation to handle repetitive tasks, follow up with leads and keep your business running smoothly.</p>
              <ul className="tick">
                <li>Automate enquiries and follow-ups</li>
                <li>Connect with your existing tools</li>
                <li>Save time and reduce missed opportunities</li>
              </ul>
            </div>
            <div className="svmedia">
              <div className="flow4" role="img" aria-label="Illustrative workflow: enquiry received, AI handles conversation, lead saved in CRM, follow-up sent automatically">
                {FLOW.map((f, k) => (
                  <div className="fstep" key={f.t} style={{ '--i': k }}>
                    <div className="fcard"><span className="fic"><Ico d={f.ic} s={26} /></span><b>{f.t}</b></div>
                    {k < FLOW.length - 1 && <span className="farrow" aria-hidden="true"><u /></span>}
                  </div>
                ))}
              </div>
              <p className="illus">Illustrative example &mdash; every workflow is scoped to your business.</p>
            </div>
            <div className="svcta btnrow">
              <a className="btn btn-primary" href="#enquiry" onClick={goEnquiry('Business Automation')}>Enquire about automation</a>
              <a className="btn btn-ghost" href="/business-automation/">See how it works</a>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="panel closing" aria-labelledby="closeh">
          <div>
            <h2 id="closeh">Ready to grow your business with AI?</h2>
            <p>Tell us what you need and we&rsquo;ll set everything up for you. No payment up front.</p>
          </div>
          <a className="btn btn-primary big" href="#enquiry" onClick={goEnquiry('Not sure')}>Start your enquiry <Ico d={I2.arr} s={16} /></a>
        </section>

        {/* ENQUIRY */}
        <section className="panel enqp" id="enquiry">
          <div className="enq">
            <div className="sechead center">
              <span className="eyebrow">Get started</span>
              <h2>Tell us what you <span className="gt">need.</span></h2>
              <p>About a minute. No payment taken. Prefer to talk? Call <a className="tl" href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>.</p>
            </div>
            <ServiceEnquiryForm />
          </div>
        </section>
      </main>

      <footer className="site">
        <div className="wrap fin">
          <div className="fbrand" id="about">
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
              <Link to={SIGNUP}>Get started online</Link>
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
