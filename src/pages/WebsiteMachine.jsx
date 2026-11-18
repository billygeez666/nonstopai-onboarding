import { useEffect, useRef, useState } from 'react'
import { generateWebsiteContent, renderStaticWebsite, sanitizeEditableText, validateBusinessInput } from '../lib/websiteMachine.js'
import { fetchWebsiteMachineRequest, getWebsiteMachineActionState } from '../lib/websiteMachineUiState.js'
import './WebsiteMachine.css'
import './WebsiteMachineEdits.css'
import './WebsiteMachineExport.css'
import './WebsiteMachineCommerce.css'
import './WebsiteMachinePremium.css'
import WebsiteMachineLanding, { WebsiteMachineDetails } from './WebsiteMachineLanding.jsx'

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
const conceptLink = () => new URLSearchParams(window.location.hash.slice(1))
const initialContent = { ...generateWebsiteContent(example).content, visualStyle: 'balanced' }
const emailRecoveryOrderId = '38bdba88-0905-4045-8f46-0c83d349adfb'

const fields = [
  ['businessName', 'Business name'], ['industry', 'Business category'], ['location', 'Town or service area'],
]

export default function WebsiteMachine() {
  const [input, setInput] = useState({ businessName: '', industry: '', location: '', verifiedInfo: '' })
  const [draftBusiness, setDraftBusiness] = useState(null)
  const [revealCount, setRevealCount] = useState(0)
  const [conceptEntry] = useState(() => conceptLink().has('concept'))
  const [conceptState, setConceptState] = useState('')
  const revealHeading = useRef(null)
  const [validation, setValidation] = useState({})
  const [content, setContent] = useState(initialContent)
  const [previewDocument, setPreviewDocument] = useState(() => renderStaticWebsite(initialContent))
  const [view, setView] = useState('desktop')
  const [project, setProject] = useState(null)
  const [publishedPreviewUrl, setPublishedPreviewUrl] = useState('')
  const [domain, setDomain] = useState('')
  const [domainChallenge, setDomainChallenge] = useState(null)
  const [domainRecord, setDomainRecord] = useState(null)
  const [customerSite, setCustomerSite] = useState(null)
  const [deliveryTimedOut, setDeliveryTimedOut] = useState(false)
  const [serviceState, setServiceState] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const busy = Boolean(busyAction)
  const [session, setSession] = useState(() => sessionStorage.getItem('wm_access_token') || '')
  const [account, setAccount] = useState(() => sessionStorage.getItem('wm_account_email') || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authMode, setAuthMode] = useState('signin')
  const paymentNotice = new URLSearchParams(window.location.search).get('payment')
  const returnProjectId = new URLSearchParams(window.location.search).get('project_id')
  const emailRecoveryMode = new URLSearchParams(window.location.search).get('wm_recovery') === emailRecoveryOrderId
  const [recoveryConfirmation, setRecoveryConfirmation] = useState(null)
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const createKey = useRef('')
  const fullPreview = useRef(null)
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
          if (result.status === 'delivered' && result.verified_deploy_url) return
        }
      } catch { /* Delivery status remains available by refreshing this page. */ }
      if (cancelled) return
      if (attempt < 10) timer = window.setTimeout(checkDelivery, 3000)
      else setDeliveryTimedOut(true)
    }
    setDeliveryTimedOut(false)
    checkDelivery()
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [paymentNotice, returnProjectId, session])

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Website Machine | Preview Your £99 Business Website'
    return () => { document.title = previousTitle }
  }, [])

  useEffect(() => {
    if (!conceptEntry) return undefined
    let cancelled = false
    const params = conceptLink()
    const query = new URLSearchParams({ id: params.get('concept'), token: params.get('token'), format: 'concept' })
    async function openConcept() {
      setConceptState('Opening your website concept…')
      try {
        const response = await request('/.netlify/functions/website-machine-render-preview?' + query)
        if (!response.ok) throw new Error('This concept link is unavailable or has expired. You can create a fresh preview below.')
        const { content: shared } = await response.json()
        if (cancelled) return
        const business = {
          businessName: shared.businessName, industry: shared.industry, location: shared.location,
          verifiedInfo: (shared.services.length ? shared.services : shared.facts).join('\n'),
          verifiedServices: shared.services.join('\n'),
        }
        const next = { ...shared, visualStyle: shared.visualStyle || 'balanced' }
        setInput(business)
        setDraftBusiness(business)
        setContent(next)
        setPreviewDocument(renderStaticWebsite(next, { editable: true }))
        setRevealCount(1)
        setConceptState('Website concept · Make an editable copy and sign in when you’re ready to save or publish.')
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      } catch (error) {
        if (!cancelled) setConceptState(error.message)
      }
    }
    openConcept()
    return () => { cancelled = true }
  }, [conceptEntry])

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
    const business = { ...checked.value, verifiedServices: checked.value.verifiedInfo }
    const result = generateWebsiteContent(business)
    if (!result.ok) {
      setValidation({ ...result.errors, verifiedInfo: 'Enter up to eight services, one per line.' })
      return
    }
    setDraftBusiness(business)
    setRevealCount((count) => count + 1)
    const { businessName, location } = result.content
    const primaryService = result.content.services[0]
    const next = {
      ...result.content,
      visualStyle: content.visualStyle || 'balanced',
      heroTitle: `${primaryService || businessName} in ${location}`.slice(0, 120),
      heroDescription: `Explore services from ${businessName} in ${location}.`.slice(0, 240),
      aboutDescription: `${businessName} serves ${location}.`,
      ctaLabel: business.verifiedPhone ? 'Call us' : business.verifiedEmail ? 'Email us' : 'View contact details',
    }
    setContent(next)
    setPreviewDocument(renderStaticWebsite(next, { editable: true }))
  }

  useEffect(() => {
    if (revealCount) revealHeading.current?.focus()
  }, [revealCount])

  function chooseStyle(visualStyle) {
    const next = { ...content, visualStyle }
    setContent(next)
    setPreviewDocument(renderStaticWebsite(next, { editable: true }))
  }

  async function signIn(event) {
    event.preventDefault()
    const signup = authMode === 'signup'
    setBusyAction(signup ? 'Creating account' : 'Signing in')
    setAuthError('')
    setAuthMessage('')
    try {
      const response = await request('/.netlify/functions/website-machine-auth', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: signup ? 'signup' : 'signin', email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || (signup ? 'Account creation failed.' : 'Sign-in failed.'))
      if (result.confirmationRequired) {
        setAuthMessage(result.message || 'Check your email to confirm your account, then sign in.')
        setPassword('')
        setAuthMode('signin')
        return
      }
      sessionStorage.setItem('wm_access_token', result.accessToken)
      sessionStorage.setItem('wm_account_email', result.user.email || email)
      setSession(result.accessToken)
      setAccount(result.user.email || email)
      setPassword('')
      if (signup) setAuthMessage('Account created and signed in.')
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
      const checked = validateBusinessInput(draftBusiness)
      setValidation(checked.errors)
      if (!checked.ok) throw new Error('Fix the business information before saving the project.')
      let current = project
      if (!current) {
        if (!createKey.current) createKey.current = crypto.randomUUID()
        const created = await request('/.netlify/functions/website-machine-project', {
          method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': createKey.current, authorization: `Bearer ${session}` },
          body: JSON.stringify({ business: checked.value, content }),
        })
        const createdBody = await created.json()
        if (!created.ok) throw new Error(createdBody.error || 'Could not save the project.')
        current = { id: createdBody.id }
        createKey.current = ''
        setProject(current)
      } else if (['save', 'preview', 'delivery'].includes(action)) {
        const saved = await request(`/.netlify/functions/website-machine-project?id=${encodeURIComponent(current.id)}`, {
          method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` }, body: JSON.stringify({ content, business: checked.value }),
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
      } else if (action === 'save') setServiceState('Your changes are saved.')
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
      const checked = validateBusinessInput(draftBusiness)
      if (!checked.ok) throw new Error('Fix the business information before checkout.')
      const action = project
        ? await request(`/.netlify/functions/website-machine-project?id=${encodeURIComponent(project.id)}`, {
          method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` },
          body: JSON.stringify({ content, business: checked.value }),
        })
        : await request('/.netlify/functions/website-machine-project', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}`, 'idempotency-key': (createKey.current ||= crypto.randomUUID()) },
          body: JSON.stringify({ business: checked.value, content }),
        })
      const saved = await action.json()
      if (!action.ok) throw new Error(saved.error || 'Could not save the project before checkout.')
      const projectId = project?.id || saved.id
      createKey.current = ''
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

  async function prepareEmailRecovery() {
    setBusyAction('Verifying original checkout recipient')
    setRecoveryMessage('')
    try {
      if (!session) throw new Error('Sign in as the paid order owner to continue.')
      const response = await request('/.netlify/functions/website-machine-recover-email', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` },
        body: JSON.stringify({ phase: 'prepare', orderId: emailRecoveryOrderId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Original checkout could not be verified.')
      setRecoveryConfirmation(result)
      setRecoveryMessage(`Verified recipient: ${result.recipient}. The email will link to the existing published website.`)
    } catch (error) {
      setRecoveryConfirmation(null)
      setRecoveryMessage(error.message)
    } finally {
      setBusyAction('')
    }
  }

  async function sendEmailRecovery() {
    if (!recoveryConfirmation?.confirmationToken) return
    setBusyAction('Sending one authorized recovery email')
    setRecoveryMessage('')
    try {
      const response = await request('/.netlify/functions/website-machine-recover-email', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` },
        body: JSON.stringify({ phase: 'send', orderId: emailRecoveryOrderId, confirmationToken: recoveryConfirmation.confirmationToken }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Recovery did not complete. Do not retry automatically.')
      setRecoveryConfirmation(null)
      setRecoveryMessage(`Resend accepted the email for ${result.recipient}. Website: ${result.websiteUrl}. Message ID: ${result.messageId || 'not returned'}.`)
    } catch (error) {
      setRecoveryConfirmation(null)
      setRecoveryMessage(error.message)
    } finally {
      setBusyAction('')
    }
  }

  return (
    <main className="wm-app">
      <header className="wm-topbar"><a href="/website-machine/" className="wm-brand">Website Machine</a><nav aria-label="Page navigation"><a href="#how-it-works">How it works</a><a href="#website-examples">Examples</a><a href="#pricing">Pricing</a></nav><a className="wm-sales-primary" href="#create-preview">Free preview ↗</a></header>
      {!conceptEntry && !paymentNotice && !emailRecoveryMode && <WebsiteMachineLanding />}
      {conceptState && <p className="wm-service-state" role="status">{conceptState}</p>}
      <div className="wm-workspace wm-sales-builder" id="create-preview">
        <section className="wm-panel wm-form-panel">
          <div className="wm-panel-heading"><div><h2>Create your free preview</h2></div></div>
          <form onSubmit={regenerate} noValidate>
            {fields.map(([name, label]) => <label className="wm-field" key={name}>
              <span>{label} <b>REQUIRED</b></span>
              <input name={name} value={input[name]} maxLength={name === 'industry' ? 80 : 100} required onChange={updateInput} aria-invalid={Boolean(validation[name])} />
              {validation[name] && <small className="wm-error">{validation[name]}</small>}
            </label>)}
            <label className="wm-field">
              <span>Services you offer</span>
              <textarea name="verifiedInfo" rows="4" maxLength={800} required placeholder={'Boiler servicing\nEmergency plumbing'} value={input.verifiedInfo} onChange={updateInput} aria-invalid={Boolean(validation.verifiedInfo)} />
              {validation.verifiedInfo && <small className="wm-error">{validation.verifiedInfo}</small>}
              <small>Describe your services in a few words, one per line.</small>
            </label>
            <details className="wm-research-details">
              <summary>Add contact details</summary>
              <p>Add a business phone number or email for your website’s contact buttons.</p>
              <label className="wm-field"><span>Business phone</span><input name="verifiedPhone" type="tel" maxLength={40} value={input.verifiedPhone || ''} onChange={updateInput} />{validation.verifiedPhone && <small className="wm-error">{validation.verifiedPhone}</small>}</label>
              <label className="wm-field"><span>Business email</span><input name="verifiedEmail" type="email" maxLength={254} value={input.verifiedEmail || ''} onChange={updateInput} />{validation.verifiedEmail && <small className="wm-error">{validation.verifiedEmail}</small>}</label>
              <label className="wm-field"><span>Business social profile</span><input name="socialUrl" type="url" maxLength={300} placeholder="https://www.instagram.com/yourbusiness/" value={input.socialUrl || ''} onChange={updateInput} />{validation.socialUrl && <small className="wm-error">{validation.socialUrl}</small>}</label>
            </details>
            <button className="wm-generate" type="submit">{draftBusiness ? 'Update my preview' : 'Create my free preview'} ↗</button>
          </form>
          <p className="wm-safety-note"><i /> No reviews, opening hours, credentials or contact details are invented.</p>
        </section>

        <section className="wm-preview-column">
          <div className="wm-preview-heading"><div><span className="wm-step">02 / LIVE PREVIEW</span><h2 ref={revealHeading} tabIndex={-1}>{draftBusiness ? `${content.businessName}’s website` : 'Example preview'}</h2></div>
            <div className="wm-view-toggle" role="group" aria-label="Preview size">
              <button type="button" className={view === 'desktop' ? 'selected' : ''} onClick={() => setView('desktop')}>Desktop</button>
              <button type="button" className={view === 'mobile' ? 'selected' : ''} onClick={() => setView('mobile')}>Mobile</button>
            </div>
          </div>
          {draftBusiness && <div className="wm-style-picker" role="group" aria-label="Website style">
            {['dark', 'balanced', 'light'].map((style) => <button key={style} type="button" aria-pressed={content.visualStyle === style} onClick={() => chooseStyle(style)}>{style}</button>)}
          </div>}
          <div className={`wm-browser ${view}`} key={revealCount}>
            <div className="wm-browser-bar"><span className="wm-dots"><i /><i /><i /></span><span className="wm-address">local preview <b>•</b> {content.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</span><span className="wm-preview-label">DRAFT</span></div>
            <iframe title={`Website preview for ${content.businessName}`} sandbox="allow-same-origin allow-popups" srcDoc={previewDocument} onLoad={draftBusiness ? handlePreviewLoad : undefined} />
          </div>
          {draftBusiness && <div className="wm-full-preview">
            <button type="button" onClick={() => fullPreview.current.showModal()}>Open full-page preview ↗</button>
            <dialog ref={fullPreview} aria-label="Full-page website preview">
              <div><strong>Website preview</strong><form method="dialog"><button>Close preview</button></form></div>
              <iframe title="Full-page website preview" sandbox="" srcDoc={renderStaticWebsite(content)} loading="lazy" />
            </dialog>
          </div>}
          {(draftBusiness || paymentNotice || emailRecoveryMode) && <div className="wm-purchase-flow">
          <section className="wm-auth-panel" id="website-account" aria-label="Website Machine account">
        {session
          ? <><span>Signed in as <b>{account}</b></span><button type="button" onClick={signOut}>Sign out</button></>
          : <form onSubmit={signIn}><strong>{authMode === 'signup' ? 'Create an account' : 'Sign in to save projects'}</strong><input aria-label="Account email" type="email" autoComplete="username" required maxLength={254} placeholder="Your NONSTOP AI account email" value={email} onChange={(event) => setEmail(event.target.value)} /><input aria-label="Account password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required minLength={authMode === 'signup' ? 12 : undefined} maxLength={1024} placeholder={authMode === 'signup' ? 'At least 12 characters' : 'Password'} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="submit" disabled={busy}>{busyAction ? `${busyAction}…` : authMode === 'signup' ? 'Create account' : 'Sign in'}</button><button type="button" disabled={busy} onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthError(''); setAuthMessage('') }}>{authMode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>{authError && <small role="alert">{authError}</small>}{authMessage && <small role="status">{authMessage}</small>}</form>}
      </section>
          <div className="wm-preview-actions"><p className="wm-preview-hint"><span>↗</span> Click generated copy in the preview to edit it. Changes are local to this draft.</p><button type="button" className="wm-export" onClick={downloadSite}>Download draft HTML ↓</button></div>
          <div className="wm-project-actions">
            <button type="button" onClick={() => projectAction('create')} disabled={actionState.saveProjectDisabled}>{project ? 'Project saved in this session' : 'Save project'}</button>
            <button type="button" onClick={() => projectAction('save')} disabled={busy || !project || !session}>Save edits</button>
            <button type="button" onClick={() => projectAction('preview')} disabled={busy || !project || !session}>Create share link</button>
            <button type="button" onClick={() => projectAction('delivery')} disabled={busy || !project || !session}>Prepare delivery file</button>
          </div>
          {actionState.saveProjectReason && !busy && <p className="wm-action-reason" role="status">{actionState.saveProjectReason}</p>}
          {busyAction && <p className="wm-action-reason" role="status">{busyAction}…</p>}
          {serviceState && <p className="wm-service-state" role="status">{serviceState}</p>}
          {paymentNotice === 'processing' && !(customerSite?.status === 'delivered' && customerSite.verified_deploy_url) && <p className="wm-service-state" role="status">
            {!session ? 'Sign in to check your website delivery.'
              : customerSite?.status === 'failed' ? 'Publishing hit a problem. Check this page again before attempting another payment.'
              : deliveryTimedOut ? 'Delivery is taking longer than expected. Refresh this page to check your order again.'
              : customerSite?.status === 'provisioning' ? 'Your website is being published and checked.'
              : 'Waiting for payment confirmation before publishing.'}
          </p>}
          {customerSite?.status === 'delivered' && customerSite.verified_deploy_url && <p className="wm-service-state" role="status">Your website is live. <a href={customerSite.site_url} target="_blank" rel="noreferrer">Open customer website ↗</a></p>}
          {emailRecoveryMode && <section className="wm-service-state" aria-labelledby="wm-email-recovery-title">
            <strong id="wm-email-recovery-title">One-time email recovery for the existing paid test order</strong>
            <p>We will verify the original Stripe Checkout recipient and the already-published website before sending. This does not create a payment or deploy a site.</p>
            {!recoveryConfirmation
              ? <button type="button" onClick={prepareEmailRecovery} disabled={!session || busy}>Verify checkout recipient</button>
              : <><p>Confirm one email to <b>{recoveryConfirmation.recipient}</b> containing <a href={recoveryConfirmation.websiteUrl} target="_blank" rel="noreferrer">the existing website link</a>.</p><button type="button" onClick={sendEmailRecovery} disabled={!session || busy}>Send one recovery email</button></>}
            {recoveryMessage && <p role="status">{recoveryMessage}</p>}
          </section>}
          {paymentNotice === 'cancelled' && <p className="wm-service-state" role="status">Checkout was cancelled. No website has been published.</p>}
          {draftBusiness && session && <p className="wm-preview-hint">Share links last seven days. Include only business information intended for recipients.</p>}
          {publishedPreviewUrl && <a className="wm-published-preview-link" href={publishedPreviewUrl} target="_blank" rel="noreferrer">Open secure website preview ↗</a>}
          <section className="wm-checkout-panel" aria-labelledby="wm-delivery-title">
            <span className="wm-step">03 / CUSTOMER DELIVERY</span>
            <h2 id="wm-delivery-title">Make this website yours</h2>
            <p>£99 one-time for a single-page website. No recurring charge. Delivery starts only after Stripe confirms payment.</p>
            <label className="wm-field"><span>Custom domain <b>OPTIONAL</b></span><input value={domain} maxLength={253} placeholder="www.yourbusiness.co.uk" onChange={(event) => { setDomain(event.target.value); setDomainChallenge(null); setDomainRecord(null) }} /></label>
            {domain.trim() && <button type="button" onClick={requestDomainChallenge} disabled={busy || !session}>Create DNS ownership check</button>}
            {domainRecord && <div className="wm-domain-record"><b>TXT record · expires {new Date(domainRecord.expiresAt).toLocaleString()}</b><code>{domainRecord.name}</code><code>{domainRecord.value}</code></div>}
            <button type="button" className="wm-checkout-button" onClick={beginCheckout} disabled={actionState.checkoutDisabled || !draftBusiness}>{busyAction === 'Preparing secure checkout' ? 'Preparing secure checkout…' : 'Publish for £99'}</button>
            {actionState.checkoutReason && !busy && <small className="wm-action-reason" role="status">{actionState.checkoutReason}</small>}
            <small>Payments are confirmed by a signed Stripe webhook. Returning from checkout alone never starts delivery.</small>
          </section>
          </div>}
        </section>
      </div>
      {!paymentNotice && !emailRecoveryMode && <WebsiteMachineDetails />}
      <footer className="wm-page-footer">Website Machine by NONSTOP AI <span>·</span> <a href="/privacy/">Privacy</a></footer>
    </main>
  )
}
