import { useEffect, useRef, useState } from 'react'
import { generateWebsiteContent, renderStaticWebsite, sanitizeEditableText, sanitizeWebsiteContent, validateBusinessInput } from '../lib/websiteMachine.js'
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

const purchaseDraftKey = 'wm_purchase_draft_v1'
const emptyInput = { businessName: '', industry: '', location: '', verifiedInfo: '' }

function restorePurchaseDraft() {
  if (conceptLink().has('concept')) return null
  try {
    const saved = JSON.parse(sessionStorage.getItem(purchaseDraftKey))
    if (!saved || Date.now() > saved.expiresAt) return null
    const business = validateBusinessInput(saved.business)
    const content = sanitizeWebsiteContent(saved.content)
    if (!business.ok || !content.ok) return null
    return { ...saved, business: business.value, content: content.content }
  } catch {
    return null
  }
}

const purchaseFields = [
  ['businessName', 'Business name', 'text', 100],
  ['verifiedPhone', 'Business phone', 'tel', 40],
  ['verifiedEmail', 'Business email', 'email', 254],
  ['location', 'Business address or service area', 'text', 100],
  ['heroTitle', 'Website headline', 'text', 120],
]

const fields = [
  ['businessName', 'Business name'], ['industry', 'Business category'], ['location', 'Town or service area'],
]

export default function WebsiteMachine() {
  const [restored] = useState(restorePurchaseDraft)
  const [input, setInput] = useState(restored?.business || emptyInput)
  const [draftBusiness, setDraftBusiness] = useState(restored?.business || null)
  const [purchaseStage, setPurchaseStage] = useState(restored ? 'review' : '')
  const [purchaseFieldsState, setPurchaseFieldsState] = useState({})
  const [purchaseErrors, setPurchaseErrors] = useState({})
  const [operatorSignIn, setOperatorSignIn] = useState(false)
  const [publicShareReviewed, setPublicShareReviewed] = useState(false)
  const [sharePublicContacts, setSharePublicContacts] = useState(false)
  const purchaseHeading = useRef(null)
  const checkoutProject = useRef(restored?.account === sessionStorage.getItem('wm_account_email') ? restored?.checkoutProject : null)
  const [revealCount, setRevealCount] = useState(0)
  const [conceptEntry] = useState(() => conceptLink().has('concept'))
  const [conceptState, setConceptState] = useState('')
  const revealHeading = useRef(null)
  const [validation, setValidation] = useState({})
  const [content, setContent] = useState(restored?.content || initialContent)
  const [previewDocument, setPreviewDocument] = useState(() => renderStaticWebsite(restored?.content || initialContent))
  const [view, setView] = useState('desktop')
  const [project, setProject] = useState(null)
  const [publishedPreviewUrl, setPublishedPreviewUrl] = useState('')
  const [domain, setDomain] = useState(restored?.domain || '')
  const [domainChallenge, setDomainChallenge] = useState(restored?.domainChallenge || null)
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
    if (paymentNotice === 'processing') sessionStorage.removeItem(purchaseDraftKey)
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
        business.verifiedPhone = shared.verifiedPhone
        business.verifiedEmail = shared.verifiedEmail
        const next = { ...shared, visualStyle: shared.visualStyle || 'balanced' }
        setInput(business)
        setDraftBusiness(business)
        setContent(next)
        setPreviewDocument(renderStaticWebsite(next))
        setRevealCount(1)
        setPurchaseFieldsState({ ...business, heroTitle: next.heroTitle })
        setPurchaseStage('details')
        setConceptState('Your website concept is ready to preview.')
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      } catch (error) {
        if (!cancelled) setConceptState(error.message)
      }
    }
    openConcept()
    return () => { cancelled = true }
  }, [conceptEntry])

  useEffect(() => {
    if (purchaseStage) purchaseHeading.current?.focus()
  }, [purchaseStage])

  function restartPreview() {
    sessionStorage.removeItem(purchaseDraftKey)
    window.location.assign('/website-machine/')
  }

  function openPurchase() {
    setPurchaseFieldsState({ ...draftBusiness, heroTitle: content.heroTitle })
    setPurchaseErrors({})
    setServiceState('')
    setPurchaseStage('details')
  }

  function applyPurchaseDetails(event) {
    event.preventDefault()
    const checked = validateBusinessInput(purchaseFieldsState)
    const headline = sanitizeEditableText(purchaseFieldsState.heroTitle, 120)
    const errors = { ...checked.errors }
    if (!headline) errors.heroTitle = 'Enter a headline for your website.'
    if (Object.keys(errors).length) {
      setPurchaseErrors(errors)
      const invalid = event.currentTarget.elements.namedItem(Object.keys(errors)[0])
      invalid?.focus()
      return
    }
    const business = checked.value
    const sameIdentity = business.businessName === content.businessName && business.location === content.location
    const next = {
      ...content,
      businessName: business.businessName,
      location: business.location,
      verifiedPhone: business.verifiedPhone,
      verifiedEmail: business.verifiedEmail,
      heroTitle: headline,
      ...(sameIdentity ? {} : {
        aboutTitle: `About ${business.businessName}`,
        aboutDescription: `${business.businessName} serves ${business.location}.`,
        heroDescription: `Explore services from ${business.businessName} in ${business.location}.`.slice(0, 240),
      }),
      ctaLabel: business.verifiedPhone ? 'Call us' : business.verifiedEmail ? 'Email us' : 'View contact details',
    }
    setDraftBusiness(business)
    setInput(business)
    setContent(next)
    setPreviewDocument(renderStaticWebsite(next))
    setPurchaseStage('review')
  }

  function rememberPurchaseDraft(savedProject) {
    try {
      sessionStorage.setItem(purchaseDraftKey, JSON.stringify({
        business: draftBusiness, content, account, checkoutProject: savedProject,
        domain, domainChallenge, expiresAt: Date.now() + 60 * 60 * 1000,
      }))
    } catch {
      // Checkout can continue when browser storage is unavailable.
    }
  }

  useEffect(() => {
    if (purchaseStage === 'review' && draftBusiness && paymentNotice !== 'processing') rememberPurchaseDraft(checkoutProject.current)
  }, [purchaseStage, draftBusiness, content, account, domain, domainChallenge, paymentNotice])

  function updateInput(event) {
    setInput((current) => ({ ...current, [event.target.name]: event.target.value }))
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
    if (busy) return
    const checked = validateBusinessInput(input)
    setValidation(checked.errors)
    if (!checked.ok) return
    const business = { ...checked.value, verifiedServices: checked.value.verifiedInfo }
    const result = generateWebsiteContent(business)
    if (!result.ok) {
      setValidation({ ...result.errors, verifiedInfo: 'Enter up to eight services, one per line.' })
      return
    }
    setPurchaseStage('')
    setPublicShareReviewed(false)
    setSharePublicContacts(false)
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
    setPreviewDocument(renderStaticWebsite(next))
  }

  useEffect(() => {
    if (revealCount && !purchaseStage) revealHeading.current?.focus()
  }, [revealCount])

  function chooseStyle(visualStyle) {
    const next = { ...content, visualStyle }
    setContent(next)
    setPreviewDocument(renderStaticWebsite(next))
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
      if (account && account.toLowerCase() !== result.user.email?.toLowerCase()) checkoutProject.current = null
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
    sessionStorage.removeItem(purchaseDraftKey)
    checkoutProject.current = null
    setPurchaseStage('')
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
      const projectContent = { ...content, sharePublicContacts: action === 'preview' && sharePublicContacts }
      let current = project
      if (!current) {
        if (!createKey.current) createKey.current = crypto.randomUUID()
        const created = await request('/.netlify/functions/website-machine-project', {
          method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': createKey.current, authorization: `Bearer ${session}` },
          body: JSON.stringify({ business: checked.value, content: projectContent }),
        })
        const createdBody = await created.json()
        if (!created.ok) throw new Error(createdBody.error || 'Could not save the project.')
        current = { id: createdBody.id }
        createKey.current = ''
        setProject(current)
      } else if (['save', 'preview', 'delivery'].includes(action)) {
        const saved = await request(`/.netlify/functions/website-machine-project?id=${encodeURIComponent(current.id)}`, {
          method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` }, body: JSON.stringify({ content: projectContent, business: checked.value }),
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
      const approved = sanitizeWebsiteContent(content)
      if (!approved.ok) throw new Error(approved.error)
      const { sharePublicContacts: _sharePublicContacts, ...approvedContent } = approved.content
      const payload = JSON.stringify({ business: checked.value, content: approvedContent })
      const approvalKey = JSON.stringify([payload, domainChallenge?.domain || ''])
      const cached = checkoutProject.current
      if (cached?.approvalKey !== approvalKey) {
        checkoutProject.current = { approvalKey, id: null, saveKey: crypto.randomUUID() }
        rememberPurchaseDraft(checkoutProject.current)
      }
      if (!checkoutProject.current.id) {
        const action = await request('/.netlify/functions/website-machine-project', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': checkoutProject.current.saveKey, authorization: `Bearer ${session}` },
          body: payload,
        })
        const saved = await action.json()
        if (!action.ok) throw new Error(saved.error || 'Could not save the approved website.')
        checkoutProject.current.id = saved.id
        rememberPurchaseDraft(checkoutProject.current)
      }
      const projectId = checkoutProject.current.id
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

  const showLanding = !draftBusiness && !conceptEntry && !paymentNotice && !emailRecoveryMode
  const previewForm = showLanding && (
<section className="wm-panel wm-form-panel">
          <form onSubmit={regenerate} noValidate>
            {fields.map(([name, label]) => <label className="wm-field" key={name}>
              <span>{label} <b>REQUIRED</b></span>
              <input name={name} placeholder={{ businessName: 'e.g. Oakfield Plumbing', industry: 'e.g. Plumber', location: 'e.g. Cambridge' }[name]} value={input[name]} maxLength={name === 'industry' ? 80 : 100} required onChange={updateInput} aria-invalid={Boolean(validation[name])} />
              {validation[name] && <small className="wm-error">{validation[name]}</small>}
            </label>)}
            <label className="wm-field">
              <span>Services you offer</span>
              <textarea name="verifiedInfo" rows="2" maxLength={800} required placeholder={'Boiler servicing\nEmergency plumbing'} value={input.verifiedInfo} onChange={updateInput} aria-invalid={Boolean(validation.verifiedInfo)} />
              {validation.verifiedInfo && <small className="wm-error">{validation.verifiedInfo}</small>}
              <small>Describe your services in a few words, one per line.</small>
            </label>
            <details className="wm-research-details">
              <summary>Add contact details (optional)</summary>
              <p>Add a business phone number or email for your website’s contact buttons.</p>
              <label className="wm-field"><span>Business phone</span><input name="verifiedPhone" type="tel" maxLength={40} value={input.verifiedPhone || ''} onChange={updateInput} />{validation.verifiedPhone && <small className="wm-error">{validation.verifiedPhone}</small>}</label>
              <label className="wm-field"><span>Business email</span><input name="verifiedEmail" type="email" maxLength={254} value={input.verifiedEmail || ''} onChange={updateInput} />{validation.verifiedEmail && <small className="wm-error">{validation.verifiedEmail}</small>}</label>
              <label className="wm-field"><span>Business social profile</span><input name="socialUrl" type="url" maxLength={300} placeholder="https://www.instagram.com/yourbusiness/" value={input.socialUrl || ''} onChange={updateInput} />{validation.socialUrl && <small className="wm-error">{validation.socialUrl}</small>}</label>
            </details>
            <button className="wm-generate" type="submit" disabled={busy}>Create My Free Preview</button>
          </form>
        </section>
  )

  return (
    <main className="wm-app">
      <header className="wm-topbar"><a href="/website-machine/" className="wm-brand">Website Machine</a>{!draftBusiness && !conceptEntry && !paymentNotice && !emailRecoveryMode && <nav aria-label="Page navigation"><a href="#website-examples">Examples</a><a href="#pricing">Pricing</a></nav>}{draftBusiness && paymentNotice !== 'processing' && <button type="button" className="wm-review-edit" onClick={restartPreview} disabled={busy}>Start a new preview</button>}</header>
      {showLanding && <WebsiteMachineLanding>{previewForm}</WebsiteMachineLanding>}
      {conceptState && <p className="wm-service-state" role="status">{conceptState}</p>}
      {!showLanding && <div data-stage={purchaseStage} className={`wm-workspace wm-sales-builder${draftBusiness || paymentNotice === 'processing' || emailRecoveryMode ? ' wm-builder-result' : ''}`} id="create-preview">


        <section className="wm-preview-column">
          {paymentNotice !== 'processing' && !emailRecoveryMode && draftBusiness && <div className="wm-preview-heading"><div><h2 ref={revealHeading} tabIndex={-1}>{draftBusiness ? `${content.businessName}’s website` : 'Example preview'}</h2></div>
            <div className="wm-view-toggle" role="group" aria-label="Preview size">
              <button type="button" className={view === 'desktop' ? 'selected' : ''} onClick={() => setView('desktop')}>Desktop</button>
              <button type="button" className={view === 'mobile' ? 'selected' : ''} onClick={() => setView('mobile')}>Mobile</button>
            </div>
          </div>}
          {draftBusiness && !purchaseStage && <div className="wm-style-picker" role="group" aria-label="Website style">
            {['dark', 'balanced', 'light'].map((style) => <button key={style} type="button" aria-pressed={content.visualStyle === style} onClick={() => chooseStyle(style)}>{style}</button>)}
          </div>}
          {draftBusiness && !purchaseStage && paymentNotice !== 'processing' && <div className="wm-result-actions"><button type="button" className="wm-sales-primary" onClick={openPurchase}>Get This Website — £99</button>{!conceptEntry && <button type="button" onClick={() => { setDraftBusiness(null); setPreviewDocument(renderStaticWebsite(initialContent)) }}>Edit preview inputs</button>}</div>}
          {paymentNotice !== 'processing' && !emailRecoveryMode && draftBusiness && <div className={`wm-browser ${view}`} key={revealCount}>
            <div className="wm-browser-bar"><span className="wm-dots"><i /><i /><i /></span><span className="wm-address">Website preview</span><span className="wm-preview-label">DRAFT</span></div>
            <iframe title={`Website preview for ${content.businessName}`} sandbox="" srcDoc={previewDocument} />
          </div>}
          {draftBusiness && !purchaseStage && <div className="wm-full-preview">
            <button type="button" onClick={() => fullPreview.current.showModal()}>Open full-page preview ↗</button>
            <dialog ref={fullPreview} aria-label="Full-page website preview">
              <div><strong>Website preview</strong><form method="dialog"><button>Close preview</button></form></div>
              <iframe title="Full-page website preview" sandbox="" srcDoc={renderStaticWebsite(content)} loading="lazy" />
            </dialog>
          </div>}
          {(draftBusiness || paymentNotice || emailRecoveryMode) && <div className="wm-purchase-flow">
          {(purchaseStage === 'review' || operatorSignIn || paymentNotice === 'processing' || emailRecoveryMode) && <section className="wm-auth-panel" id="website-account" aria-label="Website Machine account">
        {session
          ? <><span>Signed in as <b>{account}</b></span><button type="button" onClick={signOut}>Sign out</button></>
          : <form onSubmit={signIn}><strong>{authMode === 'signup' ? 'Create an account' : 'Sign in to continue'}</strong><input aria-label="Account email" type="email" autoComplete="username" required maxLength={254} placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} /><input aria-label="Account password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required minLength={authMode === 'signup' ? 12 : undefined} maxLength={1024} placeholder={authMode === 'signup' ? 'At least 12 characters' : 'Password'} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="submit" disabled={busy}>{busyAction ? `${busyAction}…` : authMode === 'signup' ? 'Create account' : 'Sign in'}</button><button type="button" disabled={busy} onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthError(''); setAuthMessage('') }}>{authMode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>{authError && <small role="alert">{authError}</small>}{authMessage && <small role="status">{authMessage}</small>}</form>}
      </section>}
          {draftBusiness && !purchaseStage && session && <details className="wm-operator-tools">
          <summary>Project and sharing tools</summary>
          <div className="wm-preview-actions"><button type="button" className="wm-export" onClick={downloadSite}>Download draft HTML ↓</button></div>
          <div className="wm-project-actions">
            <button type="button" onClick={() => projectAction('create')} disabled={actionState.saveProjectDisabled}>{project ? 'Project saved in this session' : 'Save project'}</button>
            <button type="button" onClick={() => projectAction('save')} disabled={busy || !project || !session}>Save edits</button>
            <button type="button" onClick={() => projectAction('preview')} disabled={busy || !project || !session || !publicShareReviewed}>Create share link</button>
            <button type="button" onClick={() => projectAction('delivery')} disabled={busy || !project || !session}>Prepare delivery file</button>
          </div>
          <p className="wm-preview-hint">Anyone with the link can view it for seven days.</p>
          <label className="wm-share-option"><input type="checkbox" checked={publicShareReviewed} onChange={(event) => setPublicShareReviewed(event.target.checked)} /> I checked that this preview contains only public business information.</label>
          <label className="wm-share-option"><input type="checkbox" checked={sharePublicContacts} onChange={(event) => setSharePublicContacts(event.target.checked)} /> Include the verified public business phone and email.</label>
          {publishedPreviewUrl && <a className="wm-published-preview-link" href={publishedPreviewUrl} target="_blank" rel="noreferrer">Open share link ↗</a>}
          </details>}
          {draftBusiness && !purchaseStage && !conceptEntry && !session && <button type="button" className="wm-review-edit" onClick={() => setOperatorSignIn((active) => !active)}>Sign in to manage or share a draft</button>}
          {busyAction && <p className="wm-action-reason" role="status">{busyAction}…</p>}
          {serviceState && purchaseStage !== 'review' && <p className="wm-service-state" role="status">{serviceState}</p>}
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

          {purchaseStage === 'details' && <section className="wm-checkout-panel" aria-labelledby="wm-purchase-details">
            <h2 id="wm-purchase-details" ref={purchaseHeading} tabIndex={-1}>Anything you’d like to update?</h2>
            <p>These details will appear on your website. Business phone and email are optional.</p>
            <form onSubmit={applyPurchaseDetails} noValidate>
              {purchaseFields.map(([name, label, type, limit]) => <label className="wm-field" key={name}>
                <span>{label}</span>
                <input name={name} type={type} maxLength={limit} value={purchaseFieldsState[name] || ''} aria-label={label} aria-describedby={purchaseErrors[name] ? `wm-purchase-error-${name}` : undefined} aria-invalid={Boolean(purchaseErrors[name])}
                  onChange={(event) => setPurchaseFieldsState((current) => ({ ...current, [name]: event.target.value }))} />
                {purchaseErrors[name] && <small id={`wm-purchase-error-${name}`} className="wm-error" role="alert">{purchaseErrors[name]}</small>}
              </label>)}
              <button className="wm-sales-primary" type="submit">Update and review my website</button>
            </form>
          </section>}
          {purchaseStage === 'review' && paymentNotice !== 'processing' && <section className="wm-checkout-panel" aria-labelledby="wm-delivery-title">
            <h2 id="wm-delivery-title" ref={purchaseHeading} tabIndex={-1}>Publish your website for £99</h2>
            <p>Review the updated preview above. Your one-time payment covers publishing this version and emailing your website link.</p>
            <button type="button" className="wm-review-edit" onClick={openPurchase} disabled={busy}>Edit website details</button>
            {serviceState && <p className="wm-service-state" role="alert">{serviceState}</p>}
            <details className="wm-research-details"><summary>Use a domain you already own</summary>
            <label className="wm-field"><span>Custom domain <b>OPTIONAL</b></span><input value={domain} maxLength={253} placeholder="www.yourbusiness.co.uk" onChange={(event) => { setDomain(event.target.value); setDomainChallenge(null); setDomainRecord(null) }} /></label>
            {domain.trim() && <button type="button" onClick={requestDomainChallenge} disabled={busy || !session}>Create DNS ownership check</button>}
            {domainRecord && <div className="wm-domain-record"><b>TXT record · expires {new Date(domainRecord.expiresAt).toLocaleString()}</b><code>{domainRecord.name}</code><code>{domainRecord.value}</code></div>}
            </details>
            {session ? <button type="button" className="wm-checkout-button" onClick={beginCheckout} disabled={actionState.checkoutDisabled || !draftBusiness}>{busyAction === 'Preparing secure checkout' ? 'Preparing secure checkout…' : 'Continue to Stripe — £99'}</button> : <a href="#website-account">Sign in or create an account to continue</a>}
          </section>}
          </div>}
        </section>
      </div>}
      {showLanding && <WebsiteMachineDetails />}
      <footer className="wm-page-footer">Website Machine by NONSTOP AI <span>·</span> <a href="/privacy/">Privacy</a></footer>
    </main>
  )
}
