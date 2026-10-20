import { useEffect, useRef, useState } from 'react'
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

// Tap-to-play sample video. Nothing is downloaded until the visitor presses play.
function VideoCard({ src, audio, poster, label, w, h, tall }) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  const play = () => {
    const v = ref.current
    if (!v) return
    document.querySelectorAll('.nsh video').forEach((o) => { if (o !== v && !o.paused) o.pause() })
    const url = audio || src
    if (v.getAttribute('src') !== url) v.src = url
    v.muted = false
    v.playsInline = true
    v.controls = true
    setOn(true)
    const p = v.play()
    if (p && p.catch) {
      p.catch(() => {
        v.muted = true
        const q = v.play()
        if (q && q.catch) q.catch(() => { setOn(false); v.controls = false })
      })
    }
  }
  return (
    <div className={`vid${tall ? ' tall' : ''}${on ? ' playing' : ''}`}>
      <video ref={ref} poster={poster} playsInline preload="none" width={w} height={h} aria-label={label} onEnded={() => setOn(false)} />
      {!on && (
        <button type="button" className="playbig" onClick={play} aria-label={`Play: ${label}`}><span>&#9654;</span></button>
      )}
    </div>
  )
}

export default function Home() {
  useMeta(META)

  // Single-open FAQ accordion, scoped to this component.
  useEffect(() => {
    const root = document.querySelector('.nsh')
    if (!root) return
    const faq = [...root.querySelectorAll('.faq details')]
    const handlers = faq.map((d) => {
      const h = () => { if (d.open) faq.forEach((o) => { if (o !== d) o.open = false }) }
      d.addEventListener('toggle', h)
      return [d, h]
    })
    return () => { handlers.forEach(([d, h]) => d.removeEventListener('toggle', h)) }
  }, [])

  const goEnquiry = (service) => () => preselect(service)

  return (
    <div className="nsh">
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
            <a href="#faq">FAQ</a>
          </nav>
          <div className="navcta">
            <SocialLinks className="social-head" />
            <a className="navtel" href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>
            <a className="btn btn-primary" href="#enquiry" onClick={goEnquiry('Not sure')}>Enquire</a>
          </div>
        </div>
      </div>

      {/* ---------------- HERO ---------------- */}
      <section className="hero" id="top">
        <div className="wrap herogrid">
          <div>
            <span className="eyebrow">AI systems for UK businesses</span>
            <h1>A business that <span className="gt">never stops.</span></h1>
            <p className="lede">
              We set up four AI-powered services for you: a professional website, a 24/7 AI receptionist, product video
              ads and business automation. You tell us what you need — we build it and put it live.
            </p>
            <div className="herobtns">
              <a className="btn btn-primary" href="#enquiry" onClick={goEnquiry('Not sure')}>Send an enquiry</a>
              <a className="btn btn-ghost" href="#services">See the four services</a>
            </div>
            <ul className="ticks">
              <li>Enquire first — no payment up front</li>
              <li>Set up for you</li>
              <li>Keep your own number</li>
            </ul>
          </div>

          <div className="quad" id="services">
            <a className="qt" href="#website"><span className="qi"><Ic d={ICON.web} c="#5CD9F5" /></span><b>Website Machine</b><span>Professional, mobile-first websites.</span></a>
            <a className="qt" href="#receptionist"><span className="qi"><Ic d={ICON.phone} c="#6FA0F7" /></span><b>AI Receptionist</b><span>Answers every call, day and night.</span></a>
            <a className="qt" href="#video-ads"><span className="qi"><Ic d={ICON.video} c="#9B6BF5" /></span><b>Product Video Ads</b><span>AI-made adverts for your product.</span></a>
            <a className="qt" href="#automation"><span className="qi"><Ic d={ICON.flow} c="#D24BF5" /></span><b>Business Automation</b><span>Less admin, faster follow-up.</span></a>
          </div>
        </div>
      </section>

      {/* ---------------- WEBSITE MACHINE ---------------- */}
      <section className="sec" id="website">
        <div className="wrap split">
          <div>
            <span className="eyebrow">01 · Website Machine</span>
            <h2>A professional website, <span className="gt">built for you.</span></h2>
            <p className="body">
              A fast, mobile-first website with clear calls to action, click-to-call and an enquiry form, so people who
              find you know how to get in touch. We write it, build it and put it live — you don&rsquo;t touch a dashboard.
            </p>
            <ul className="list">
              <li>One-page websites from <b>£99</b> (one-off)</li>
              <li>Booking or enquiry capture available on larger builds</li>
              <li>Works with the AI receptionist and automation below</li>
            </ul>
            <p className="fine">A website does not by itself bring in customers — we don&rsquo;t sell advertising or SEO.</p>
            <div className="herobtns">
              <a className="btn btn-primary" href="#enquiry" onClick={goEnquiry('Website Machine')}>Enquire about a website</a>
            </div>
          </div>
          <div className="mock" aria-hidden="true">
            <div className="mbar"><i /><i /><i /><span>yourbusiness.co.uk</span></div>
            <div className="mbody">
              <div className="mh" /><div className="ml w70" /><div className="ml w50" />
              <div className="mrow"><div className="mb" /><div className="mb g" /></div>
              <div className="mcards"><div /><div /><div /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- AI RECEPTIONIST ---------------- */}
      <section className="sec sec-tint" id="receptionist">
        <div className="wrap split rev">
          <div className="ticket" aria-label="Example of a call being answered">
            <div className="tbar"><span className="lbl">Your front desk</span><span className="livechip"><span className="dot" /> Live</span></div>
            <div className="tbody">
              <div className="callrow">
                <div className="avatar"><Ic d={ICON.phone} /></div>
                <div><div className="num">07911 224 488</div><div className="meta">Missed at 11:47pm</div></div>
                <div className="stat">Answered ✓</div>
              </div>
              <div className="tsteps">
                <div className="line on"><span className="tagx">Ring 1</span><span className="txt">“Good evening, how can I help?”</span></div>
                <div className="line on"><span className="tagx">Caller</span><span className="txt">“Do you do a website with online booking?”</span></div>
                <div className="line on"><span className="tagx">Captured</span><span className="txt">Name · business · phone · what they need</span></div>
                <div className="line on"><span className="tagx">Sent</span><span className="txt">Details in your inbox before they hang up</span></div>
              </div>
            </div>
            <div className="tfoot"><span>Example call</span><span>24/7</span></div>
          </div>
          <div>
            <span className="eyebrow">02 · AI Receptionist</span>
            <h2>Every call answered, <span className="gt">day or night.</span></h2>
            <p className="body">
              An AI receptionist on your business number takes the booking or the enquiry, captures the caller&rsquo;s
              details and notifies you straight away. Your existing number stays your number.
            </p>
            <ul className="list">
              <li><b>£299</b> setup + <b>£99</b>/month — website, business number and receptionist as one package</li>
              <li>Rolling monthly subscription, no long-term contract</li>
              <li>Set up, tested and launched by us</li>
            </ul>
            <div className="herobtns">
              <a className="btn btn-primary" href="/ai-receptionist/">See the AI receptionist</a>
              <Link className="btn btn-ghost" to={SIGNUP}>Get started</Link>
            </div>
            <div className="dem">
              <span className="eyebrow">Hear it live — real lines, no signup</span>
              <a className="dial" href="tel:+447449839233"><span>Taxi demo</span><b>07449 839233</b></a>
              <a className="dial" href="tel:+447460045201"><span>Takeaway demo</span><b>07460 045201</b></a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- PRODUCT VIDEO ADS ---------------- */}
      <section className="sec" id="video-ads">
        <div className="wrap">
          <div className="sechead">
            <span className="eyebrow">03 · Product Video Ads</span>
            <h2>AI-made adverts for <span className="gt">the way people scroll.</span></h2>
            <p>Cinematic short product ads for Instagram, TikTok, Facebook and your website. Tap to play our own sample adverts.</p>
          </div>
          <div className="vgrid">
            <VideoCard tall src="/media/video-ads/perfume-ad.mp4" audio="/media/video-ads/perfume-ad-audio.mp4" poster="/media/video-ads/perfume-ad-poster.jpg" label="Sample AI-generated perfume advert" w={720} h={1294} />
            <VideoCard src="/media/video-ads/sneaker-ad.mp4" audio="/media/video-ads/sneaker-ad-audio.mp4" poster="/media/video-ads/sneaker-ad-poster.jpg" label="Sample AI-generated sneaker advert" w={1280} h={720} />
            <VideoCard tall src="/media/video-ads/skincare-ad.mp4" poster="/media/video-ads/skincare-ad-poster.jpg" label="Sample AI-generated skincare advert" w={720} h={1294} />
          </div>
          <p className="fine">These are NONSTOP AI&rsquo;s own sample ads, not client work. Priced per project — quote before you pay.</p>
          <div className="herobtns">
            <a className="btn btn-primary" href="/product-video-ads/">Explore Product Video Ads</a>
            <a className="btn btn-ghost" href="#enquiry" onClick={goEnquiry('Product Video Ads')}>Request a quote</a>
          </div>
        </div>
      </section>

      {/* ---------------- BUSINESS AUTOMATION ---------------- */}
      <section className="sec sec-tint" id="automation">
        <div className="wrap split">
          <div>
            <span className="eyebrow">04 · Business Automation</span>
            <h2>Less admin. <span className="gt">Faster follow-up.</span></h2>
            <p className="body">
              We connect the tools you already use so enquiries, notifications, follow-ups and reports happen
              automatically — scoped to how your business actually runs, not sold off a shelf.
            </p>
            <ul className="list">
              <li>Instant alerts when a new enquiry arrives</li>
              <li>Automatic customer follow-up messages</li>
              <li>Simple reporting on what is coming in</li>
            </ul>
            <p className="fine">Quote-only: every business is different, so we scope it with you first.</p>
            <div className="herobtns">
              <a className="btn btn-primary" href="/business-automation/">Explore Business Automation</a>
              <a className="btn btn-ghost" href="#enquiry" onClick={goEnquiry('Business Automation')}>Request a quote</a>
            </div>
          </div>
          <div className="flow" role="img" aria-label="Example workflow: enquiry arrives, alert sent, follow-up queued, recorded">
            <span className="flowtag">Example workflow</span>
            <div className="fn"><i>1</i><span><b>Enquiry arrives</b><small>Form, call or message</small></span></div>
            <div className="fl" />
            <div className="fn"><i>2</i><span><b>You&rsquo;re alerted</b><small>Email the moment it lands</small></span></div>
            <div className="fl" />
            <div className="fn"><i>3</i><span><b>Follow-up queued</b><small>Customer hears back quickly</small></span></div>
            <div className="fl" />
            <div className="fn"><i>4</i><span><b>Recorded</b><small>One place, nothing lost</small></span></div>
          </div>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="sec" id="how">
        <div className="wrap">
          <div className="sechead">
            <span className="eyebrow">How it works</span>
            <h2>Enquire first. <span className="gt">Pay only once we&rsquo;ve agreed.</span></h2>
          </div>
          <ol className="steps">
            <li><b>Tell us what you need</b><span>Send a short enquiry — pick a service or say you&rsquo;re not sure.</span></li>
            <li><b>We review and reply</b><span>We confirm the scope and send a clear quote or next step by email.</span></li>
            <li><b>You agree</b><span>Nothing is charged at enquiry stage. Payment comes after you&rsquo;ve agreed the work.</span></li>
            <li><b>We build and launch</b><span>We set it up, test it and put it live for you.</span></li>
          </ol>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="sec sec-tint" id="faq">
        <div className="wrap faqwrap">
          <div className="sechead"><span className="eyebrow">FAQ</span><h2>Good to know.</h2></div>
          <div className="faq">
            <details open><summary>Do I pay when I enquire? <span className="chev">+</span></summary><div className="ans">No. The enquiry form is free to send and no payment is taken. You are only asked to pay after you&rsquo;ve agreed the work.</div></details>
            <details><summary>Can I keep my existing phone number? <span className="chev">+</span></summary><div className="ans">Yes. For the AI receptionist you keep the number your customers already have. We set up the answering behind it.</div></details>
            <details><summary>Can I try the AI receptionist first? <span className="chev">+</span></summary><div className="ans">Yes — call either live demo line in the AI Receptionist section. No signup, no card.</div></details>
            <details><summary>How much do the video ads and automation cost? <span className="chev">+</span></summary><div className="ans">Both are priced per project, so we quote after your enquiry. You&rsquo;ll see a price before you pay anything.</div></details>
            <details><summary>What if I want to cancel the receptionist? <span className="chev">+</span></summary><div className="ans">The £99/month is a rolling monthly subscription. There is no long-term contract to sign.</div></details>
          </div>
        </div>
      </section>

      {/* ---------------- ENQUIRY ---------------- */}
      <section className="sec" id="enquiry">
        <div className="wrap enq">
          <div className="sechead center">
            <span className="eyebrow">Get started</span>
            <h2>Tell us what you <span className="gt">need.</span></h2>
            <p>Takes about a minute. No payment needed. Prefer to talk? Call <a className="tl" href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>.</p>
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
