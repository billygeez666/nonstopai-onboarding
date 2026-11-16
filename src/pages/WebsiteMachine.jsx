import { useEffect, useRef, useState } from 'react'
import { generateWebsiteContent, renderStaticWebsite, sanitizeEditableText, validateBusinessInput } from '../lib/websiteMachine.js'
import { buildResearchBrief } from '../lib/websiteMachineResearch.js'
import { fetchWebsiteMachineRequest, getWebsiteMachineActionState } from '../lib/websiteMachineUiState.js'
import './WebsiteMachine.css'
import './WebsiteMachineEdits.css'
import './WebsiteMachineExport.css'
import './WebsiteMachineCommerce.css'

const request = (url, options = {}) => fetchWebsiteMachineRequest(fetch, url, options)

const example = {
  businessName: 'Northstar Motor Works',
  industry: 'Independent garage',
  location: 'Leeds',
  websiteUrl: '',
  verifiedPhone: '',
  verifiedEmail: '',
  verifiedServices: 'MOT testing\nVehicle servicing\nVehicle repairs',
  verifiedInfo: 'MOT testing\nVehicle servicing\nVehicle repairs\nLocated in Kirkstall, Leeds',
}
const initialContent = generateWebsiteContent(example).content

const fields = [
  ['businessName', 'Business name'], ['industry', 'Industry'], ['location', 'Location'],
]

export default function WebsiteMachine() {
  const [input, setInput] = useState(example)
  const [validation, setValidation] = useState({})
  const [content, setContent] = useState(initialContent)
  const [previewDocument, setPreviewDocument] = useState(() => renderStaticWebsite(initialContent, { editable: true }))
  const [view, setView] = useState('desktop')
  const [source, setSource] = useState({ label: '', url: '', findings: '' })
  const [project, setProject] = useState(null)
  const [publishedPreviewUrl, setPublishedPreviewUrl] = useState('')
  const [domain, setDomain] = useState('')
  const [domainChallenge, setDomainChallenge] = useState(null)
  const [domainRecord, setDomainRecord] = useState(null)
  const [customerSite, setCustomerSite] = useState(null)
  const [serviceState, setServiceState] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const busy = Boolean(busyAction)
  const [session, setSession] = useState(() => sessionStorage.getItem('wm_access_token') || '')
  const [account, setAccount] = useState(() => sessionStorage.getItem('wm_account_email') || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const paymentNotice = new URLSearchParams(window.location.search).get('payment')
  const returnProjectId = new URLSearchParams(window.location.search).get('project_id')
  const createKey = useRef('')
  const previewFrame = useRef(null)
  const actionState = getWebsiteMachineActionState({ session, busyAction, project })

  useEffect(() => {
    if (paymentNotice !== 'processing' || !returnProjectId || !session) return undefined
    let cancelled = false
    let timer
    let attempt = 0
    const checkDelivery = async () => {
      attempt += 1
      try {
        const response = await request(`/.netlify/functions/website-machine-customer-site?project_id=${encodeURIComponent(returnProjectId)}`, {
          headers: { authorization: `Bearer ${session}` },
        })
        if (response.ok) {
          const result = await response.json()
          if (!cancelled) setCustomerSite(result)
          if (result.status === 'delivered') return
        }
      } catch { /* Delivery status remains available by refreshing this page. */ }
      if (!cancelled && attempt < 10) timer = window.setTimeout(checkDelivery, 3000)
    }
    checkDelivery()
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [paymentNotice, returnProjectId, session])

  function updateInput(event) {
    setInput((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function handlePreviewLoad(event) {
    const document = event.currentTarget.contentDocument
    if (!document) return
    document.addEventListener('input', (inputEvent) => {
      const target = inputEvent.target.closest('[data-wm-edit]')
      if (!target) return
      const key = target.dataset.wmEdit
      const max = Number(target.dataset.wmMax) || 300
      const text = sanitizeEditableText(target.textContent, max)
      if (target.textContent !== text || target.children.length) target.textContent = text
      if (['heroTitle', 'heroDescription', 'aboutTitle', 'aboutDescription'].includes(key)) {
        setContent((current) => ({ ...current, [key]: text }))
      }
    })
    document.addEventListener('paste', (pasteEvent) => {
      const editable = pasteEvent.target.closest('[data-wm-edit]')
      if (!editable) return
      pasteEvent.preventDefault()
      const selection = document.getSelection()
      if (!selection?.rangeCount) return
      const range = selection.getRangeAt(0)
      if (!editable.contains(range.commonAncestorContainer)) return
      range.deleteContents()
      const text = document.createTextNode(pasteEvent.clipboardData?.getData('text/plain') || '')
      range.insertNode(text)
      range.setStartAfter(text)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      pasteEvent.target.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }))
    })
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
    const next = generateWebsiteContent(checked.value).content
    setContent(next)
    setPreviewDocument(renderStaticWebsite(next, { editable: true }))
  }

  async function signIn(event) {
    event.preventDefault()
    setBusyAction('Signing in')
    setAuthError('')
    try {
      const response = await request('/.netlify/functions/website-machine-auth', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Sign-in failed.')
      sessionStorage.setItem('wm_access_token', result.accessToken)
      sessionStorage.setItem('wm_account_email', result.user.email || email)
      setSession(result.accessToken)
      setAccount(result.user.email || email)
      setPassword('')
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setBusyAction('')
    }
  }

  function signOut() {
    sessionStorage.removeItem('wm_access_token')
    sessionStorage.removeItem('wm_account_email')
    setSession('')
    setAccount('')
    setProject(null)
    setPublishedPreviewUrl('')
  }

  async function projectAction(action) {
    const actionLabels = { create: 'Saving project', save: 'Saving edits', preview: 'Creating secure preview', delivery: 'Preparing delivery file' }
    setBusyAction(actionLabels[action] || 'Working')
    setServiceState('')
    try {
      const checked = validateBusinessInput(input)
      setValidation(checked.errors)
      if (!checked.ok) throw new Error('Fix the business information before saving the project.')
      const research = source.label || source.url || source.findings
        ? buildResearchBrief([{ ...source, verifiedAt: new Date().toISOString() }])
        : { ok: true, verifiedFindings: [] }
      if (!research.ok) throw new Error(research.error)
      let current = project
      if (!current) {
        if (!createKey.current) createKey.current = crypto.randomUUID()
        const created = await request('/.netlify/functions/website-machine-project', {
          method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': createKey.current, authorization: `Bearer ${session}` },
          body: JSON.stringify({ business: checked.value, content, research: research.verifiedFindings }),
        })
        const createdBody = await created.json()
        if (!created.ok) throw new Error(createdBody.error || 'Could not save the project.')
        current = { id: createdBody.id }
        createKey.current = ''
        setProject(current)
      } else if (action === 'save') {
        const saved = await request(`/.netlify/functions/website-machine-project?id=${encodeURIComponent(current.id)}`, {
          method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` }, body: JSON.stringify({ content, business: checked.value, research: research.verifiedFindings }),
        })
        if (!saved.ok) throw new Error((await saved.json()).error || 'Could not save edits.')
        setPublishedPreviewUrl('')
      }
      if (action === 'preview') {
        const response = await request('/.netlify/functions/website-machine-preview', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` }, body: JSON.stringify({ id: current.id }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not publish the draft preview.')
        setPublishedPreviewUrl(result.previewUrl)
        setServiceState(`Secure preview ready. This link expires ${new Date(result.expiresAt).toLocaleString()}.`)
      } else if (action === 'delivery') {
        const response = await request(`/.netlify/functions/website-machine-delivery?id=${encodeURIComponent(current.id)}`, { headers: { authorization: `Bearer ${session}` } })
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
      setBusyAction('')
    }
  }

  async function requestDomainChallenge(event) {
    event.preventDefault()
    setBusyAction('Creating DNS ownership check')
    setServiceState('')
    setDomainRecord(null)
    try {
      if (!session) throw new Error('Sign in before verifying a custom domain.')
      const response = await request('/.netlify/functions/website-machine-domain-challenge', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` },
        body: JSON.stringify({ domain }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not create a domain verification record.')
      setDomainChallenge(result)
      setDomainRecord({ name: result.recordName, value: result.recordValue, expiresAt: result.expiresAt })
      setServiceState('Add this TXT record at your DNS provider. Ownership is checked again before checkout and publishing.')
    } catch (error) {
      setDomainChallenge(null)
      setServiceState(error.message)
    } finally {
      setBusyAction('')
    }
  }

  async function beginCheckout() {
    setBusyAction('Preparing secure checkout')
    setServiceState('')
    try {
      if (!session) throw new Error('Sign in before continuing to secure checkout.')
      if (domain.trim() && (!domainChallenge || domainChallenge.domain !== domain.trim().toLowerCase().replace(/\.$/, '') || Date.parse(domainChallenge.expiresAt) <= Date.now())) {
        throw new Error('Verify the custom domain TXT record before checkout, or clear the optional domain field.')
      }
      const checked = validateBusinessInput(input)
      if (!checked.ok) throw new Error('Fix the business information before checkout.')
      const research = source.label || source.url || source.findings
        ? buildResearchBrief([{ ...source, verifiedAt: new Date().toISOString() }])
        : { ok: true, verifiedFindings: [] }
      if (!research.ok) throw new Error(research.error)
      const action = project
        ? await request(`/.netlify/functions/website-machine-project?id=${encodeURIComponent(project.id)}`, {
          method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` },
          body: JSON.stringify({ content, business: checked.value, research: research.verifiedFindings }),
        })
        : await request('/.netlify/functions/website-machine-project', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}`, 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ business: checked.value, content, research: research.verifiedFindings }),
        })
      const saved = await action.json()
      if (!action.ok) throw new Error(saved.error || 'Could not save the project before checkout.')
      const projectId = project?.id || saved.id
      setProject({ id: projectId })
      const response = await request('/.netlify/functions/website-machine-checkout', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}`, 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ projectId, ...(domain.trim() ? { domain: domainChallenge.domain, domainChallenge } : {}) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Secure checkout could not be prepared.')
      window.location.assign(result.checkoutUrl)
    } catch (error) {
      setServiceState(error.message)
      setBusyAction('')
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

      <section className="wm-auth-panel" aria-label="Website Machine account">
        {session
          ? <><span>Signed in as <b>{account}</b></span><button type="button" onClick={signOut}>Sign out</button></>
          : <form onSubmit={signIn}><strong>Sign in to save projects</strong><input aria-label="Account email" type="email" autoComplete="username" required maxLength={254} placeholder="Your NONSTOP AI account email" value={email} onChange={(event) => setEmail(event.target.value)} /><input aria-label="Account password" type="password" autoComplete="current-password" required maxLength={1024} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="submit" disabled={busy}>{busyAction === 'Signing in' ? 'Signing in…' : 'Sign in'}</button>{authError && <small role="alert">{authError}</small>}</form>}
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
            <label className="wm-field">
              <span>Verified phone <b>OPTIONAL</b></span>
              <input name="verifiedPhone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+44 20 1234 5678" value={input.verifiedPhone || ''} maxLength={40} onChange={updateInput} aria-invalid={Boolean(validation.verifiedPhone)} />
              {validation.verifiedPhone && <small className="wm-error">{validation.verifiedPhone}</small>}
              <small>Used only for a call button when you provide a confirmed number.</small>
            </label>
            <label className="wm-field">
              <span>Verified email <b>OPTIONAL</b></span>
              <input name="verifiedEmail" type="email" autoComplete="email" placeholder="hello@example.co.uk" value={input.verifiedEmail || ''} maxLength={254} onChange={updateInput} aria-invalid={Boolean(validation.verifiedEmail)} />
              {validation.verifiedEmail && <small className="wm-error">{validation.verifiedEmail}</small>}
              <small>Used only for an email button when you provide a confirmed address.</small>
            </label>
            <details className="wm-research-details">
              <summary>Verified research source <b>OPTIONAL</b></summary>
              <p>Record findings you have checked yourself. This does not fetch or crawl the source URL.</p>
              <input aria-label="Research source name" placeholder="Source name" maxLength={120} value={source.label} onChange={(event) => setSource({ ...source, label: event.target.value })} />
              <input aria-label="Research source URL" placeholder="https://example.co.uk/about" maxLength={500} value={source.url} onChange={(event) => setSource({ ...source, url: event.target.value })} />
              <textarea aria-label="Verified research findings" rows="3" maxLength={800} placeholder="Findings verified from this source" value={source.findings} onChange={(event) => setSource({ ...source, findings: event.target.value })} />
            </details>
            <label className="wm-field">
              <span>Verified services <b>OPTIONAL · ONE SERVICE PER LINE</b></span>
              <textarea name="verifiedServices" rows="3" maxLength={800} value={input.verifiedServices || ''} onChange={updateInput} aria-invalid={Boolean(validation.verifiedServices)} />
              {validation.verifiedServices && <small className="wm-error">{validation.verifiedServices}</small>}
              <small>Only list services the business has confirmed. These appear as service cards.</small>
            </label>
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
            <iframe ref={previewFrame} title={`Website preview for ${content.businessName}`} sandbox="allow-same-origin allow-popups" srcDoc={previewDocument} onLoad={handlePreviewLoad} />
          </div>
          <div className="wm-preview-actions"><p className="wm-preview-hint"><span>↗</span> Click generated copy in the preview to edit it. Changes are local to this draft.</p><button type="button" className="wm-export" onClick={downloadSite}>Download draft HTML ↓</button></div>
          <div className="wm-project-actions">
            <button type="button" onClick={() => projectAction('create')} disabled={actionState.saveProjectDisabled}>{project ? 'Project saved in this session' : 'Save project'}</button>
            <button type="button" onClick={() => projectAction('save')} disabled={busy || !project || !session}>Save edits</button>
            <button type="button" onClick={() => projectAction('preview')} disabled={busy || !project || !session}>Publish staging preview</button>
            <button type="button" onClick={() => projectAction('delivery')} disabled={busy || !project || !session}>Prepare delivery file</button>
          </div>
          {actionState.saveProjectReason && !busy && <p className="wm-action-reason" role="status">{actionState.saveProjectReason}</p>}
          {busyAction && <p className="wm-action-reason" role="status">{busyAction}…</p>}
          {serviceState && <p className="wm-service-state" role="status">{serviceState}</p>}
          {paymentNotice === 'processing' && <p className="wm-service-state" role="status">Payment is being confirmed. Website delivery starts only after the signed Stripe confirmation is verified.</p>}
          {customerSite?.status === 'delivered' && <p className="wm-service-state" role="status">Your website is live. <a href={customerSite.site_url} target="_blank" rel="noreferrer">Open customer website ↗</a></p>}
          {paymentNotice === 'cancelled' && <p className="wm-service-state" role="status">Checkout was cancelled. No website has been published.</p>}
          {publishedPreviewUrl && <a className="wm-published-preview-link" href={publishedPreviewUrl} target="_blank" rel="noreferrer">Open secure website preview ↗</a>}
          <section className="wm-checkout-panel" aria-labelledby="wm-delivery-title">
            <span className="wm-step">03 / CUSTOMER DELIVERY</span>
            <h2 id="wm-delivery-title">Make this website yours</h2>
            <p>£99 one-time for a single-page website. No recurring charge. Delivery starts only after Stripe confirms payment.</p>
            <label className="wm-field"><span>Custom domain <b>OPTIONAL</b></span><input value={domain} maxLength={253} placeholder="www.yourbusiness.co.uk" onChange={(event) => { setDomain(event.target.value); setDomainChallenge(null); setDomainRecord(null) }} /></label>
            {domain.trim() && <button type="button" onClick={requestDomainChallenge} disabled={busy || !session}>Create DNS ownership check</button>}
            {domainRecord && <div className="wm-domain-record"><b>TXT record · expires {new Date(domainRecord.expiresAt).toLocaleString()}</b><code>{domainRecord.name}</code><code>{domainRecord.value}</code></div>}
            <button type="button" className="wm-checkout-button" onClick={beginCheckout} disabled={actionState.checkoutDisabled}>{busyAction === 'Preparing secure checkout' ? 'Preparing secure checkout…' : 'Continue to secure checkout'}</button>
            {actionState.checkoutReason && !busy && <small className="wm-action-reason" role="status">{actionState.checkoutReason}</small>}
            <small>Payments are confirmed by a signed Stripe webhook. Returning from checkout alone never starts delivery.</small>
          </section>
        </section>
      </div>
      <footer className="wm-page-footer">WEBSITE MACHINE <span>·</span> STRUCTURED CONTENT <span>·</span> CONTROLLED TEMPLATE <span>·</span> NO CUSTOMER SITE PUBLISHED</footer>
    </main>
  )
}
