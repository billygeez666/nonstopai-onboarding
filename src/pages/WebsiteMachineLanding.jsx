const examples = [
  ['ironside-garage', 'Ironside Garage', 'Automotive & detailing'],
  ['northgate-barbers', 'Northgate Barbers', 'Barbers & beauty'],
  ['brightside-cleaning', 'Brightside Cleaning', 'Cleaning services'],
  ['clearline-exteriors', 'Clearline Exteriors', 'Roofers & builders'],
]

export default function WebsiteMachineLanding() {
  return <>
    <section className="wm-sales-hero">
      <div>
        <p className="wm-sales-label">Professional websites for local businesses</p>
        <h1>Your new business website.<br /><em>See it before you pay.</em></h1>
        <p>Get a free preview designed around your business. Make it yours, then publish your one-page website for a one-time £99 payment.</p>
        <div className="wm-sales-actions"><a className="wm-sales-primary" href="#create-preview">Create My Free Preview <span aria-hidden="true">↗</span></a><a href="#website-examples">See Example Websites</a></div>
        <small>No account or card required to preview.</small>
      </div>
      <figure className="wm-sales-showcase">
        <div><span>● ● ●</span><span>Example website</span></div>
        <img src="/media/website-demos/ironside-garage-desktop.jpg" alt="Ironside Garage example website with an automotive hero and clear enquiry buttons" fetchPriority="high" />
        <figcaption>Ironside Garage <span>Automotive</span></figcaption>
      </figure>
    </section>
    <section className="wm-sales-section wm-sales-steps" id="how-it-works">
      <h2>From business details to a live website</h2>
      <ol>
        <li><strong>Tell us about your business</strong><p>Share your name, service area and what you do.</p></li>
        <li><strong>Preview and personalise</strong><p>See your own website, choose a style and fine-tune the wording.</p></li>
        <li><strong>Publish for £99</strong><p>When you’re happy with your preview, sign in and pay securely to publish.</p></li>
      </ol>
    </section>
  </>
}

export function WebsiteMachineDetails() {
  return <>
    <section className="wm-sales-section wm-sales-examples" id="website-examples">
      <p className="wm-sales-label">Example websites</p><h2>Designed for the work you do</h2>
      <div className="wm-sales-gallery">{examples.map(([slug, name, industry]) => <figure key={slug}>
        <a href={'/media/website-demos/' + slug + '-desktop.jpg'} target="_blank" rel="noreferrer"><img loading="lazy" src={'/media/website-demos/' + slug + '-desktop.jpg'} alt={'View the ' + name + ' example website'} /></a>
        <figcaption><strong>{name}</strong><span>{industry}</span></figcaption>
      </figure>)}</div>
      <p>Website Machine also supports trades, restaurants, takeaways and other local services.</p>
    </section>
    <section className="wm-sales-section wm-sales-comparison">
      <p className="wm-sales-label">Illustrative before and after</p><h2>Give customers an easier way to choose you</h2>
      <div><article><strong>Before</strong><p>A service list buried in a social profile and a phone number customers have to copy.</p></article><article><strong>After</strong><p>A mobile-friendly page with your services and service area up front, and a tap-to-call or email button when you supply contact details.</p></article></div>
    </section>
    <section className="wm-sales-section wm-sales-price" id="pricing">
      <div><p className="wm-sales-label">One-page business website</p><h2>£99 <small>one-time</small></h2><a className="wm-sales-primary" href="#create-preview">Create My Free Preview ↗</a></div>
      <ul><li>Personalised one-page site with three style choices</li><li>Services, service area and contact links you provide</li><li>Publishing and a delivery email with your website link</li><li>Optional custom domain you already own. Registration and renewals are paid separately to your domain provider.</li><li>Booking systems, online stores and ongoing edits are outside this package.</li></ul>
    </section>
    <section className="wm-sales-section wm-sales-faq">
      <h2>Questions before you start?</h2>
      <details><summary>Do I pay to make a preview?</summary><p>Your preview is free. The £99 payment is for publishing your website.</p></details>
      <details><summary>Do I need to create an account?</summary><p>You can create and personalise a preview without signing in. You need an account to save it or continue to checkout.</p></details>
      <details><summary>Can I use my own domain?</summary><p>Yes. Enter your domain and verify ownership through your DNS provider before checkout.</p></details>
      <details><summary>How will I receive my website?</summary><p>After payment is confirmed and publishing succeeds, we email you the website link.</p></details>
      <a className="wm-sales-primary" href="#create-preview">Create My Free Preview ↗</a>
    </section>
  </>
}
