import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import useMeta from '../hooks/useMeta.js'
import { CONTACT } from '../config/contact.js'
import './Home.css'

const META = {
  title: 'NONSTOP AI — Websites, AI receptionists and booking systems for service businesses',
  description:
    'NONSTOP AI builds the systems that answer your customers and capture the work — professional website, 24/7 AI receptionist, booking and enquiry capture, and follow-up. Installed and supported for you, on your own number.',
}

const SIGNUP = '/signup' // internal react-router route — unchanged

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

  return (
    <div className="nsh">
        <div className="nav">
          <div className="wrap navin">
            <a className="lock" href="#top" aria-label="NONSTOP AI">
              <img className="m" src="/nonstop-mark.png" alt="" />
              <img className="w" src="/nonstop-wordmark.png" alt="NONSTOP AI" />
            </a>
            <nav className="navlinks">
              <a href="#services">Services</a>
              <a href="#industries">Industries</a>
              <a href="#demos">Live demos</a>
              <a href="#pricing">Pricing</a>
              <a href="#contact">Contact</a>
            </nav>
            <div className="navcta">
              <a className="navtel" href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>
              <Link className="btn btn-primary" to={SIGNUP}>Get started</Link>
            </div>
          </div>
        </div>

        <section className="hero" id="top">
          <div className="wrap herogrid">
            <div>
              <div className="kicker"><span className="amt gt">£99</span><span className="per">/ month</span></div>
              <h1>Turn missed calls into <span className="gt">paying customers.</span></h1>
              <p className="lede">A complete business system — professional website, 24/7 AI receptionist, booking and enquiry capture, and SMS follow-ups — installed and supported for you, on your own number.</p>
              <div className="herobtns">
                <Link className="btn btn-primary" to={SIGNUP}>Get started</Link>
                <a className="btn btn-ghost" href="#demos">Hear it live</a>
              </div>
              <ul className="ticks">
                <li>Keep your number</li>
                <li>Live in 48 hours</li>
                <li>£299 setup</li>
              </ul>
            </div>

            <div className="ticket" aria-label="Example of a call being answered">
              <div className="tbar">
                <span className="lbl">Your front desk</span>
                <span className="livechip"><span className="dot"></span> Live</span>
              </div>
              <div className="tbody">
                <div className="callrow">
                  <div className="avatar">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5CD9F5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>
                  </div>
                  <div>
                    <div className="num">07911 224 488</div>
                    <div className="meta">Missed at 11:47pm</div>
                  </div>
                  <div className="stat">Answered ✓</div>
                </div>
                <div className="tsteps">
                  <div className="line on"><span className="tagx">Ring 1</span><span className="txt">“Good evening, NONSTOP AI — how can I help?”</span></div>
                  <div className="line on"><span className="tagx">Caller</span><span className="txt">“Do you do a website with online booking?”</span></div>
                  <div className="line on"><span className="tagx">Captured</span><span className="txt">Name · business · phone · what they need</span></div>
                  <div className="line on"><span className="tagx">Sent</span><span className="txt">Details in your inbox before they hang up</span></div>
                </div>
              </div>
              <div className="tfoot"><span>Never engaged</span><span><b>0 missed</b> · 24/7</span></div>
            </div>
          </div>
        </section>

        <section className="sec" id="services">
          <div className="wrap">
            <div className="sechead">
              <span className="eyebrow">What we build</span>
              <h2>More than an <span className="gt">AI receptionist.</span></h2>
              <p>NONSTOP AI builds the systems that answer your customers and capture the work — the website, the phone line, the booking, and the follow-up behind them.</p>
            </div>
            <div className="caps">
              <div className="cap">
                <div className="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5CD9F5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg></div>
                <h3>AI receptionists &amp; phone assistants</h3>
                <p>Answers every call, day or night, in one ring. Takes the booking or the enquiry, and notifies you straight away. Your existing number stays your number.</p>
              </div>
              <div className="cap">
                <div className="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6FA0F7" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="19" height="16" rx="2.5"/><path d="M2.5 8.5h19M6 6h.01M8.5 6h.01"/></svg></div>
                <h3>Websites</h3>
                <p>Fast, mobile-first sites built to bring in enquiries — clear calls to action, click-to-call, contact forms, and online booking on the higher packages.</p>
              </div>
              <div className="cap">
                <div className="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#9B6BF5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8.5 14.5l2.5 2.5 4.5-4.5"/></svg></div>
                <h3>Booking &amp; order systems</h3>
                <p>Jobs, appointments and orders captured properly — on the phone and on the site — with the details you actually need to turn up and get paid.</p>
              </div>
              <div className="cap">
                <div className="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#C160F5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/><path d="M8 9h8M8 13h5"/></svg></div>
                <h3>Enquiry capture</h3>
                <p>Every call, form and message lands in one place with the caller's name, number and what they wanted — so nothing sits in a voicemail nobody checks.</p>
              </div>
              <div className="cap">
                <div className="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#D24BF5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17V9M9.5 17V5M15 17v-6M20.5 17V7"/><path d="M2.5 20.5h19"/></svg></div>
                <h3>Follow-up &amp; automation</h3>
                <p>Automatic customer notifications, SMS follow-ups and reporting on what the phone is actually bringing in. Scoped to your business rather than sold off a shelf.</p>
              </div>
              <div className="cap">
                <div className="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#5CD9F5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7Z"/><path d="M3.5 7 12 11.6 20.5 7M12 21.5V11.6"/></svg></div>
                <h3>Set up for you</h3>
                <p>We build it, configure it and put it live — usually inside 48 hours. No dashboards to learn, no integrations to wire up yourself.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sec sec-tint" id="industries">
          <div className="wrap">
            <div className="sechead">
              <span className="eyebrow">Who it's for</span>
              <h2>Built for businesses that <span className="gt">live on the phone.</span></h2>
              <p>If a missed call costs you a job, the system works the same way whatever trade you're in. These are industries our systems are built to serve.</p>
            </div>
            <div className="inds">
              <div className="ind"><div className="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5CD9F5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4.5 4.5 0 0 1-5.9 5.9L4 17v3h3l4.8-4.8a4.5 4.5 0 0 0 5.9-5.9l-2.4 2.4-2.1-.6-.6-2.1Z"/></svg></div><b>Plumbers</b><span>Industry</span></div>
              <div className="ind"><div className="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6FA0F7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12Z"/></svg></div><b>Electricians</b><span>Industry</span></div>
              <div className="ind"><div className="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8B6BF5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 16M8.1 8 20 20"/></svg></div><b>Barbers</b><span>Industry</span></div>
              <div className="ind"><div className="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A85FF5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5c2.5 3 4 5.4 4 7.5a4 4 0 0 1-8 0c0-2.1 1.5-4.5 4-7.5Z"/><path d="M5 21.5h14"/></svg></div><b>Beauty salons</b><span>Industry</span></div>
              <div className="ind"><div className="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C160F5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5v8a2.5 2.5 0 0 0 5 0v-8M8.5 10.5v11"/><path d="M17.5 2.5c-1.5 1.5-2 3.5-2 6s.7 3 2 3 2-.5 2-3-.5-4.5-2-6Zm0 9v10"/></svg></div><b>Restaurants &amp; takeaways</b><span className="demo">Live demo</span></div>
              <div className="ind"><div className="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D24BF5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17.5h14M4 17.5v-4l1.8-5A2 2 0 0 1 7.7 7h8.6a2 2 0 0 1 1.9 1.5l1.8 5v4"/><path d="M4 13.5h16M7 20.5v-3M17 20.5v-3"/></svg></div><b>Garages</b><span>Industry</span></div>
              <div className="ind"><div className="ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5CD9F5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17.5h14M4 17.5v-4l1.8-5A2 2 0 0 1 7.7 7h8.6a2 2 0 0 1 1.9 1.5l1.8 5v4M9 3.5h6"/><path d="M7 20.5v-3M17 20.5v-3"/></svg></div><b>Taxi &amp; private hire</b><span className="demo">Live demo</span></div>
              <div className="ind more"><b>+ other service businesses</b><span>Ask us</span></div>
            </div>
          </div>
        </section>

        {/* legacy anchor aliases — old links (#demo, #why, #founder) still land here */}
        <span id="demo" />
        <span id="why" />
        <section className="sec" id="demos">
          <div className="wrap">
            <div className="sechead">
              <span className="eyebrow">Live demo · no signup</span>
              <h2>Don't trust us. <span className="gt">Phone it yourself.</span></h2>
              <p>Two of our systems are running right now on real numbers. Call either one and test it exactly like a customer would. No signup, no card.</p>
            </div>
            <div className="demos">
              <div className="demo">
                <span className="badge"><span className="dot"></span> Live taxi demo</span>
                <h3>This could be your taxi line.</h3>
                <p>Book a taxi and hear it captured in seconds — pickup, destination, time, the lot.</p>
                <a className="dial" href="tel:+447449839233"><span>Call the live taxi demo</span><span className="n">07449 839233</span></a>
              </div>
              <div className="demo">
                <span className="badge"><span className="dot"></span> Live takeaway demo</span>
                <h3>This could be your takeaway.</h3>
                <p>Place an order and hear every detail captured, straight off the call.</p>
                <a className="dial" href="tel:+447460045201"><span>Call the live takeaway demo</span><span className="n">07460 045201</span></a>
              </div>
            </div>
            <p className="demohelp">On a laptop? Dial from your phone — it's a real line.</p>
          </div>
        </section>

        <section className="sec sec-rule pricewrap" id="pricing">
          <div className="wrap">
            <div className="sechead center">
              <span className="eyebrow">Pricing</span>
              <h2>One price. <span className="gt">Everything included.</span></h2>
            </div>
            <div className="pricecard">
              <div className="ptag"><span className="big gt">£99</span><span className="per">/ month</span></div>
              <p className="psetup">+ <b>£299</b> one-off setup</p>
              <ul className="plist">
                <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5CD9F5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>Professional website</li>
                <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5CD9F5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>24/7 AI receptionist</li>
                <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C8FF6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>Booking &amp; order capture</li>
                <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9B6BF5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>SMS follow-ups to customers</li>
                <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#BC5BF5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>Keep your existing number</li>
                <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D24BF5" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>Installed &amp; supported for you</li>
              </ul>
              <Link className="btn btn-primary" to={SIGNUP}>Get started</Link>
              <p className="pnote">Secure checkout with Stripe</p>
            </div>
          </div>
        </section>

        <section className="sec" id="faq">
          <div className="wrap">
            <div className="sechead"><span className="eyebrow">FAQ</span><h2>Good to know.</h2></div>
            <div className="faq">
              <details open><summary>Keep my existing number? <span className="chev">+</span></summary><div className="ans">Yes. You keep the number your customers already have. We set up the answering behind it — nothing on your printed material or your Google listing has to change.</div></details>
              <details><summary>How fast does it go live? <span className="chev">+</span></summary><div className="ans">Usually inside 48 hours of your details coming through. We configure it with your hours, services and the way you like jobs handled, then put it live.</div></details>
              <details><summary>Can I try it before I pay? <span className="chev">+</span></summary><div className="ans">Yes — call either live demo above. No signup, no card.</div></details>
              <details><summary>What if I want to cancel? <span className="chev">+</span></summary><div className="ans">The £99/month is a rolling monthly subscription. There is no long-term contract to sign.</div></details>
            </div>
          </div>
        </section>

        <span id="founder" />
        <section className="sec belief" id="belief">
          <div className="wrap">
            <div className="beliefin">
              <span className="eyebrow">What we believe</span>
              <h2>Adapt. Automate. <span className="gt">Keep moving.</span></h2>
              <span className="rule"></span>
              <p>AI is changing how businesses operate. NONSTOP AI gives businesses practical systems to stay ahead — <b>not someday, but now.</b></p>
            </div>
          </div>
        </section>

        <section className="sec" id="contact">
          <div className="wrap">
            <div className="sechead"><span className="eyebrow">Talk to a human</span><h2>Questions? <span className="gt">Get in touch.</span></h2></div>
            <div className="contacts">
              <a className="cc" href={`tel:${CONTACT.phone}`}>
                <div className="ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5CD9F5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg></div>
                <span className="k">Call us</span><span className="v">{CONTACT.phoneDisplay}</span>
              </a>
              <a className="cc" href={`mailto:${CONTACT.email}`}>
                <div className="ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9B6BF5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3 6.5 9 6 9-6"/></svg></div>
                <span className="k">Email</span><span className="v">{CONTACT.email}</span>
              </a>
              <a className="cc" href={CONTACT.facebook}>
                <div className="ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#D24BF5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2.5h-2.5A4.5 4.5 0 0 0 8 7v3H5.5v4H8v7.5h4V14h3l.5-4H12V7.2c0-.5.3-.7.8-.7H15Z"/></svg></div>
                <span className="k">Message</span><span className="v">Facebook</span>
              </a>
            </div>

            <div className="finalcta">
              <h2>Stop losing customers to a <span className="gt">ringing phone.</span></h2>
              <p className="pi"><b>£299</b> setup · <b>£99</b>/month · live in 48 hours</p>
              <Link className="btn btn-primary" to={SIGNUP}>Get started</Link>
            </div>
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
            </div>
            <div className="fcols">
              <div className="fcol">
                <span className="h">Systems</span>
                <Link to="/taxi">Taxi OS</Link>
                <Link to="/food">FOOD OS</Link>
                <a href="#services">All services</a>
              </div>
              <div className="fcol">
                <span className="h">Company</span>
                <a href="#industries">Industries</a>
                <a href="#pricing">Pricing</a>
                <a href="#contact">Contact</a>
              </div>
              <div className="fcol">
                <span className="h">Get in touch</span>
                <a href={`tel:${CONTACT.phone}`}>{CONTACT.phoneDisplay}</a>
                <a href={`mailto:${CONTACT.email}`}>Email us</a>
              </div>
            </div>
          </div>
        </footer>
    </div>
  )
}
