import { useState } from 'react'
import { generateWebsiteContent, renderStaticWebsite, sanitizeEditableText, validateBusinessInput } from '../lib/websiteMachine.js'
import { buildResearchBrief } from '../lib/websiteMachineResearch.js'
import './WebsiteMachine.css'
import './WebsiteMachineEdits.css'
import './WebsiteMachineExport.css'

const example = {
  businessName: 'Northstar Motor Works',
  industry: 'Independent garage',
  location: 'Leeds',
  websiteUrl: '',
  verifiedInfo: 'MOT testing\nVehicle servicing\nVehicle repairs\nLocated in Kirkstall, Leeds',
}

const fields = [
  ['businessName', 'Business name'], ['industry', 'Industry'], ['location', 'Location'],
]

export default function WebsiteMachine() {
  const [input, setInput] = useState(example)
  const [validation, setValidation] = useState({})
  const [content, setContent] = useState(() => generateWebsiteContent(example).content)
  const [view, setView] = useState('desktop')
  const [source, setSource] = useState({ label: '', url: '', findings: '' })
  const [project, setProject] = useState(null)
  const [serviceState, setServiceState] = useState('')
  const [busy, setBusy] = useState(false)
  const isSample = content.facts.join('\n') === example.verifiedInfo
  const facts = content.facts

  function updateInput(event) {
    setInput((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function updateCopy(key, value, max = 300) {
    setContent((current) => ({ ...current, [key]: sanitizeEditableText(value, max) }))
  }

  function downloadSite() {
    const fileName = `${content.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'website'}-draft.html`
    const blob = new Blob([renderStaticWebsite(content)], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function regenerate(event) {
    event.preventDefault()
    const checked = validateBusinessInput(input)
    setValidation(checked.errors)
    if (!checked.ok) return
    setInput(checked.value)
    setContent(generateWebsiteContent(checked.value).content)
  }

  async function projectAction(action) {
    setBusy(true)
    setServiceState('')
    try {
      const research = source.label || source.url || source.findings
        ? buildResearchBrief([{ ...source, verifiedAt: new Date().toISOString() }])
        : { ok: true, verifiedFindings: [] }
      if (!research.ok) throw new Error(research.error)
      let current = project
      if (!current) {
        const created = await fetch('/.netlify/functions/website-machine-project', {
          method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ business: validateBusinessInput(input).value, content, research: research.verifiedFindings }),
        })
        const createdBody = await created.json()
        if (!created.ok) throw new Error(createdBody.error || 'Could not save the project.')
        current = { id: createdBody.id, accessToken: createdBody.accessToken }
        setProject(current)
      } else if (action === 'save') {
        const saved = await fetch(`/.netlify/functions/website-machine-project?id=${encodeURIComponent(current.id)}`, {
          method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${current.accessToken}` }, body: JSON.stringify({ content, business: validateBusinessInput(input).value, research: research.verifiedFindings }),
        })
        if (!saved.ok) throw new Error((await saved.json()).error || 'Could not save edits.')
      }
      if (action === 'preview') {
        const response = await fetch('/.netlify/functions/website-machine-preview', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${current.accessToken}` }, body: JSON.stringify({ id: current.id }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not publish the draft preview.')
        setServiceState(`Preview submitted to staging (deploy ${result.deployId}). Check its status before sharing.`)
      } else if (action === 'delivery') {
        const response = await fetch(`/.netlify/functions/website-machine-delivery?id=${encodeURIComponent(current.id)}`, { headers: { authorization: `Bearer ${current.accessToken}` } })
        if (!response.ok) throw new Error((await response.json()).error || 'Could not prepare delivery.')
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${content.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'website'}.html`
        anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        setServiceState('Customer website file downloaded. Confirm approved business facts before handoff.')
      } else if (action === 'save') setServiceState('Project and edited copy saved to staging storage.')
      else setServiceState('Project created. Save changes before publishing a preview or preparing delivery.')
    } catch (error) {
      setServiceState(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="wm-app">
      <header className="wm-topbar"><a href="/" className="wm-brand">NONSTOP <span>AI</span></a><span className="wm-local">MVP PROTOTYPE · CUSTOMER SITES UNPUBLISHED</span></header>
      <section className="wm-intro">
        <p className="wm-kicker">WEBSITE MACHINE / PHASE 1</p>
        <h1>From business facts<br /><em>to a website preview.</em></h1>
        <p>Enter what you know, generate a first draft, then edit the copy directly. Business facts stay clearly marked and separate from generated wording.</p>
      </section>

      <div className="wm-workspace">
        <section className="wm-panel wm-form-panel">
          <div className="wm-panel-heading"><div><span className="wm-step">01 / BUSINESS BRIEF</span><h2>Business information</h2></div><span className="wm-demo-tag">FICTIONAL DEMO</span></div>
          <form onSubmit={regenerate} noValidate>
            {fields.map(([name, label]) => <label className="wm-field" key={name}>
              <span>{label} <b>REQUIRED</b></span>
              <input name={name} value={input[name]} maxLength={name === 'businessName' ? 100 : 80} onChange={updateInput} aria-invalid={Boolean(validation[name])} />
              {validation[name] && <small className="wm-error">{validation[name]}</small>}
            </label>)}
            <label className="wm-field">
              <span>Current website <b>OPTIONAL</b></span>
              <input name="websiteUrl" inputMode="url" placeholder="example.co.uk" value={input.websiteUrl} maxLength={300} onChange={updateInput} aria-invalid={Boolean(validation.websiteUrl)} />
              {validation.websiteUrl && <small className="wm-error">{validation.websiteUrl}</small>}
              <small>Saved as a link only. This prototype does not visit or fetch the address.</small>
            </label>
            <details className="wm-research-details">
              <summary>Verified research source <b>OPTIONAL</b></summary>
              <p>Record findings you have checked yourself. This does not fetch or crawl the source URL.</p>
              <input aria-label="Research source name" placeholder="Source name" maxLength={120} value={source.label} onChange={(event) => setSource({ ...source, label: event.target.value })} />
              <input aria-label="Research source URL" placeholder="https://example.co.uk/about" maxLength={500} value={source.url} onChange={(event) => setSource({ ...source, url: event.target.value })} />
              <textarea aria-label="Verified research findings" rows="3" maxLength={800} placeholder="Findings verified from this source" value={source.findings} onChange={(event) => setSource({ ...source, findings: event.target.value })} />
            </details>
            <label className="wm-field">
              <span>Verified business information <b>REQUIRED · ONE FACT PER LINE</b></span>
              <textarea name="verifiedInfo" rows="5" maxLength={1200} value={input.verifiedInfo} onChange={updateInput} aria-invalid={Boolean(validation.verifiedInfo)} />
              {validation.verifiedInfo && <small className="wm-error">{validation.verifiedInfo}</small>}
              <small>Only add details you have confirmed. These appear on the preview as verified information.</small>
            </label>
            <button className="wm-generate" type="submit"><span>↻</span> Regenerate website preview</button>
          </form>
          <p className="wm-safety-note"><i /> No reviews, opening hours, credentials or contact details are invented.</p>
        </section>

        <section className="wm-preview-column">
          <div className="wm-preview-heading"><div><span className="wm-step">02 / LIVE PREVIEW</span><h2>Your website</h2></div>
            <div className="wm-view-toggle" role="group" aria-label="Preview size">
              <button type="button" className={view === 'desktop' ? 'selected' : ''} onClick={() => setView('desktop')}>Desktop</button>
              <button type="button" className={view === 'mobile' ? 'selected' : ''} onClick={() => setView('mobile')}>Mobile</button>
            </div>
          </div>
          <div className={`wm-browser ${view}`}>
            <div className="wm-browser-bar"><span className="wm-dots"><i /><i /><i /></span><span className="wm-address">local preview <b>•</b> {content.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</span><span className="wm-preview-label">DRAFT</span></div>
            <article className="wm-site">
              <nav className="wm-site-nav"><a className="wm-site-logo" href="#top">{content.businessName}</a><a href="#verified">The business <span>↗</span></a></nav>
              <section className="wm-site-hero" id="top">
                <div className="wm-hero-orbit" aria-hidden="true"><div /><div /><div /></div>
                <p className="wm-site-overline"><i /> {content.industry} <span>·</span> {content.location}</p>
                <span className="wm-generated-badge">GENERATED MARKETING COPY · EDITABLE</span>
                <Editable as="h1" value={content.heroTitle} onChange={(value) => updateCopy('heroTitle', value, 120)} />
                <Editable as="p" className="wm-site-lead" value={content.heroDescription} onChange={(value) => updateCopy('heroDescription', value, 240)} />
                <a className="wm-site-cta" href="#verified">{content.ctaLabel} <span>↗</span></a>
                <div className="wm-hero-foot"><span>INFORMATION SUPPLIED FOR THIS PREVIEW</span><span>01 — 03</span></div>
              </section>
              <section className="wm-site-about" id="verified">
                <div className="wm-about-index">A / ABOUT</div>
                <div className="wm-about-copy"><span className="wm-fact-badge"><i /> {isSample ? 'SAMPLE FACTS · FICTIONAL BUSINESS' : 'USER-PROVIDED FACTS · VERIFY BEFORE PUBLISH'}</span>
                  <span className="wm-generated-badge">GENERATED MARKETING COPY · EDITABLE</span>
                  <Editable as="h2" value={content.aboutTitle} onChange={(value) => updateCopy('aboutTitle', value, 120)} />
                  <Editable as="p" value={content.aboutDescription} onChange={(value) => updateCopy('aboutDescription', value, 300)} />
                  <ul className="wm-facts">{facts.map((fact, index) => <li key={`${fact}-${index}`}><span>0{index + 1}</span>{fact}</li>)}</ul>
                </div>
              </section>
              <footer className="wm-site-footer"><a href="#top">{content.businessName}</a><span>Browser draft · Customer site not published</span>{content.websiteUrl && <a className="wm-source-link" href={content.websiteUrl} target="_blank" rel="noreferrer">Current website ↗</a>}</footer>
            </article>
          </div>
          <div className="wm-preview-actions"><p className="wm-preview-hint"><span>↗</span> Click any text in the preview to edit it. Changes are local to this draft.</p><button type="button" className="wm-export" onClick={downloadSite}>Download draft HTML ↓</button></div>
          <div className="wm-project-actions">
            <button type="button" onClick={() => projectAction('create')} disabled={busy || Boolean(project)}>{project ? 'Project saved in this session' : 'Save project'}</button>
            <button type="button" onClick={() => projectAction('save')} disabled={busy || !project}>Save edits</button>
            <button type="button" onClick={() => projectAction('preview')} disabled={busy || !project}>Publish staging preview</button>
            <button type="button" onClick={() => projectAction('delivery')} disabled={busy || !project}>Prepare delivery file</button>
          </div>
          {serviceState && <p className="wm-service-state" role="status">{serviceState}</p>}
        </section>
      </div>
      <footer className="wm-page-footer">WEBSITE MACHINE <span>·</span> STRUCTURED CONTENT <span>·</span> CONTROLLED TEMPLATE <span>·</span> NO CUSTOMER SITE PUBLISHED</footer>
    </main>
  )
}

function Editable({ as: Tag, value, onChange, className = '' }) {
  return <textarea className={`wm-editable wm-edit-${Tag} ${className}`} aria-label={`Edit generated ${Tag} text`} rows={2} spellCheck value={value} onChange={(event) => onChange(event.target.value)} />
}
