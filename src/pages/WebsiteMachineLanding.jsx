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
        <h1>Create Your <strong>FREE</strong> Website Preview</h1>
        <p>Enter your business details and see your website before you pay. Like it? Make it yours for £99.</p>
        <div className="wm-sales-actions"><a className="wm-sales-primary" href="#create-preview">Create My Free Preview</a></div>
        <small>No payment required to preview.</small>
      </div>
      <figure className="wm-sales-showcase">
        <div>Example website</div>
        <img src="/media/website-demos/ironside-garage-desktop.jpg" alt="Ironside Garage example website with an automotive hero and clear enquiry buttons" fetchPriority="high" />
        <figcaption>Ironside Garage <span>Automotive</span></figcaption>
      </figure>
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
    <section className="wm-sales-section wm-sales-price" id="pricing">
      <div><p className="wm-sales-label">One-page business website</p><h2>£99 <small>one-time</small></h2><a className="wm-sales-primary" href="#create-preview">Create My Free Preview ↗</a></div>
      <ul><li>Personalised one-page site with three style choices</li><li>Services, service area and contact links you provide</li><li>Publishing on an included hosted address and a delivery email with your link</li><li>Optional custom domain you already own. Registration and renewals are paid separately to your domain provider.</li><li>The £99 covers the design you approve and its publication. Ongoing edits, maintenance, booking systems and online stores are outside this package.</li></ul>
    </section>
    <section className="wm-sales-section wm-sales-faq">
      <h2>Questions before you start?</h2>
      <details><summary>Do I pay to make a preview?</summary><p>Your preview is free. The £99 payment is for publishing your website.</p></details>
      <details><summary>Do I need to create an account?</summary><p>You can create and personalise a preview without signing in. You need an account to save it or continue to checkout.</p></details>
      <details><summary>Can I use my own domain?</summary><p>Yes. Enter your domain and verify ownership through your DNS provider before checkout.</p></details>
      <details><summary>What about hosting, support and future edits?</summary><p>We publish to a hosted address with no recurring Website Machine fee. You can correct your details before paying. Ongoing support and future edits are outside this package.</p></details>
      <details><summary>How will I receive my website?</summary><p>After payment is confirmed and publishing succeeds, we email you the website link.</p></details>
      <a className="wm-sales-primary" href="#create-preview">Create My Free Preview ↗</a>
    </section>
  </>
}
