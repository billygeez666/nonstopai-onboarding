const visualStyles = new Set(['dark', 'balanced', 'light'])

const MAX = {
  businessName: 100,
  industry: 80,
  location: 100,
  websiteUrl: 300,
  verifiedPhone: 40,
  verifiedEmail: 254,
  socialUrl: 300,
  verifiedInfo: 1200,
  verifiedServices: 800,
}

// eslint-disable-next-line no-control-regex -- user input must not carry control characters into rendered content
const stripControls = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim()
// eslint-disable-next-line no-control-regex -- line breaks are meaningful delimiters between verified facts
const stripMultilineControls = (value) => String(value ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim()

function publicSocialUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && url.pathname !== '/' &&
      ['facebook.com', 'instagram.com', 'linkedin.com', 'tiktok.com', 'youtube.com'].includes(host)) {
      url.search = ''
      url.hash = ''
      return url.toString()
    }
  } catch {
    // Missing and invalid social links are omitted by the renderer.
  }
  return ''
}

export function validateBusinessInput(input) {
  const clean = Object.fromEntries(Object.entries(MAX).map(([key, limit]) => [
    key,
    (key === 'verifiedInfo' || key === 'verifiedServices' ? stripMultilineControls(input?.[key]) : stripControls(input?.[key])).slice(0, limit),
  ]))
  const errors = {}
  for (const key of ['businessName', 'industry', 'location', 'verifiedInfo']) {
    if (!clean[key]) errors[key] = 'This field is required.'
  }
  if (clean.verifiedInfo && clean.verifiedInfo.split(/\n/).filter((line) => line.trim()).length > 12) {
    errors.verifiedInfo = 'Use 12 verified facts or fewer.'
  }
  if (clean.verifiedServices && clean.verifiedServices.split(/\n/).filter((line) => line.trim()).length > 8) {
    errors.verifiedServices = 'Use 8 verified services or fewer.'
  }
  if (clean.verifiedPhone) {
    const digits = clean.verifiedPhone.replace(/\D/g, '')
    if (!/^\+?[0-9 ().-]+$/.test(clean.verifiedPhone) || digits.length < 7 || digits.length > 15) errors.verifiedPhone = 'Enter a verified phone number using 7 to 15 digits.'
  }
  if (clean.verifiedEmail && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(clean.verifiedEmail)) {
    errors.verifiedEmail = 'Enter a valid verified email address.'
  }
  if (clean.socialUrl) {
    const socialUrl = publicSocialUrl(clean.socialUrl)
    if (socialUrl) clean.socialUrl = socialUrl
    else errors.socialUrl = 'Enter the HTTPS link to your business social profile.'
  }
  if (clean.websiteUrl) {
    try {
      const url = new URL(clean.websiteUrl.match(/^https?:\/\//i) ? clean.websiteUrl : `https://${clean.websiteUrl}`)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error('invalid')
      clean.websiteUrl = url.toString()
    } catch {
      errors.websiteUrl = 'Enter a valid website address (for example, example.co.uk).'
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, value: clean }
}

// Deterministic copy: the only business-specific claims come from submitted fields.
// This function does not fetch URLs, call an AI service, or create executable code.
export function generateWebsiteContent(input) {
  const result = validateBusinessInput(input)
  if (!result.ok) return { ok: false, errors: result.errors }
  const { businessName, industry, location, websiteUrl, verifiedInfo, verifiedServices, verifiedPhone, verifiedEmail, socialUrl } = result.value
  const facts = verifiedInfo.split(/\n/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
  const services = verifiedServices.split(/\n/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
  const article = /^[aeiou]/i.test(industry) ? 'an' : 'a'
  const primaryService = services[0]
  const heroTitle = primaryService ? `${businessName} | ${primaryService} in ${location}` : `${businessName} | ${industry} in ${location}`
  const ctaLabel = verifiedPhone ? 'Call the business' : verifiedEmail ? 'Email the business' : websiteUrl ? 'Visit current website' : 'Contact details needed'
  return {
    ok: true,
    content: {
      businessName,
      industry,
      location,
      websiteUrl,
      heroTitle: heroTitle.slice(0, 120),
      heroDescription: primaryService
        ? `Looking for ${primaryService.toLowerCase()} in ${location}? Explore the verified services and details shared by ${businessName}.`
        : `Explore ${businessName}, ${article} ${industry.toLowerCase()} in ${location} and review the verified details shared here.`,
      aboutTitle: `About ${businessName}`,
      aboutDescription: `Learn more about ${businessName} and explore the details shared by the business.`,
      facts,
      services,
      verifiedPhone,
      verifiedEmail,
      ...(socialUrl && { socialUrl }),
      ctaLabel,
    },
  }
}

export function sanitizeEditableText(value, maxLength = 300) {
  return stripControls(value).slice(0, maxLength)
}

export function sanitizeWebsiteContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.facts) || value.facts.length > 12 || value.facts.some((fact) => typeof fact !== 'string') || (value.services !== undefined && (!Array.isArray(value.services) || value.services.length > 8 || value.services.some((service) => typeof service !== 'string')))) {
    return { ok: false, error: 'Website content must use the supported structured format.' }
  }
  const limits = { businessName: 100, industry: 80, location: 100, websiteUrl: 300, verifiedPhone: 40, verifiedEmail: 254, heroTitle: 120, heroDescription: 240, aboutTitle: 120, aboutDescription: 300, ctaLabel: 100 }
  const content = Object.fromEntries(Object.entries(limits).map(([key, limit]) => [key, sanitizeEditableText(value[key], limit)]))
  if (visualStyles.has(value.visualStyle)) content.visualStyle = value.visualStyle
  const socialUrl = publicSocialUrl(sanitizeEditableText(value.socialUrl, 300))
  if (socialUrl) content.socialUrl = socialUrl
  content.facts = value.facts.map((fact) => sanitizeEditableText(fact, 180)).filter(Boolean)
  content.services = (value.services || []).map((service) => sanitizeEditableText(service, 100)).filter(Boolean)
  for (const key of ['businessName', 'industry', 'location', 'heroTitle', 'heroDescription', 'aboutTitle', 'aboutDescription', 'ctaLabel']) {
    if (!content[key]) return { ok: false, error: `Website content is missing ${key}.` }
  }
  if (content.websiteUrl) {
    try {
      const url = new URL(content.websiteUrl)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) throw new Error('invalid')
      content.websiteUrl = url.toString()
    } catch {
      content.websiteUrl = ''
    }
  }
  return { ok: true, content }
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])

// Render reviewed structured copy into a fixed, self-contained document.
// No generated source code is interpreted or included in the output.
function industryTheme(industry) {
  const value = String(industry || '').toLowerCase()
  if (/garage|automotive|motor|vehicle|mechanic|tyre|detailing/.test(value)) return 'garage'
  if (/beauty|salon|wellness|spa|skin|hair|barber/.test(value)) return 'studio'
  if (/food|cafe|café|restaurant|bakery|hospitality|bar/.test(value)) return 'hospitality'
  if (/garden|landscap|outdoor|arbor|florist|farm/.test(value)) return 'outdoors'
  if (/clean|janitor/.test(value)) return 'cleaning'
  if (/roof|build|plumb|electric|trade|construct/.test(value)) return 'trades'
  return 'professional'
}

// Fixed, editorial stock photographs. Never load addresses from business input.
const industryPhotography = {
  garage: '1486262715619-67b85e0b08d3',
  studio: '1503951914875-452162b0f3f1',
  hospitality: '1517248135467-4c7edcad34c4',
  cleaning: '1584622650111-993a426fbf0a',
  trades: '1504307651254-35680f356dfd',
  outdoors: '1416879595882-3373a0480b5b',
}

export function renderStaticWebsite(content, { editable = false, noIndex = false, claimUrl = '' } = {}) {
  const visualStyle = visualStyles.has(content.visualStyle) ? content.visualStyle : ''
  const theme = industryTheme(content.industry)
  const photo = visualStyle && industryPhotography[theme]
  const heroArt = photo
    ? `<img src="https://images.unsplash.com/photo-${photo}?auto=format&amp;fit=crop&amp;w=900&amp;q=75" width="900" height="560" alt="" referrerpolicy="no-referrer" decoding="async">`
    : '<div class="wm-art-grid"></div><div class="wm-art-orbit"></div><div class="wm-art-tile"></div><div class="wm-art-spark">✳</div>'
  const name = escapeHtml(content.businessName)
  const title = escapeHtml(content.heroTitle)
  const summary = escapeHtml(content.heroDescription)
  const aboutTitle = escapeHtml(content.aboutTitle)
  const about = escapeHtml(content.aboutDescription)
  const facts = content.facts || []
  const services = content.services || []
  const additionalFacts = services.length ? facts.filter((fact) => !services.includes(fact)) : facts
  let safeWebsiteUrl = ''
  try {
    const url = new URL(content.websiteUrl)
    if (['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password) {
      safeWebsiteUrl = url.toString()
    }
  } catch {
    // Invalid and non-web links are omitted from the exported template.
  }
  const rawPhone = String(content.verifiedPhone || '').trim()
  const phoneDigits = rawPhone.replace(/\D/g, '')
  const safePhone = /^\+?[0-9 ().-]+$/.test(rawPhone) && phoneDigits.length >= 7 && phoneDigits.length <= 15
    ? `${rawPhone.startsWith('+') ? '+' : ''}${phoneDigits}`
    : ''
  const rawEmail = String(content.verifiedEmail || '').trim()
  const safeEmail = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(rawEmail) ? rawEmail : ''
  const serviceItems = services.length ? services : facts
  const serviceLabel = visualStyle ? escapeHtml(content.location) : services.length ? 'Services supplied by the business' : 'Verified business details'
  const target = safePhone ? `tel:${safePhone}` : safeEmail ? `mailto:${safeEmail}` : safeWebsiteUrl || '#contact-details'
  const editableAttr = (key, max) => editable ? ` data-wm-edit="${key}" data-wm-max="${max}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Edit generated website copy" spellcheck="true"` : ''
  const serviceCards = serviceItems.map((item, index) => `
        <article class="wm-service-card"><span class="wm-card-number">${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(item)}</h3><p>${services.length ? `Ask ${escapeHtml(content.businessName)} in ${escapeHtml(content.location)} about ${escapeHtml(item.toLowerCase())} and current availability.` : `Business detail supplied for ${escapeHtml(content.businessName)} in ${escapeHtml(content.location)}.`}</p><span class="wm-card-arrow" aria-hidden="true">↗</span></article>`).join('')
  const verifiedFacts = additionalFacts.map((fact, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(fact)}</li>`).join('\n          ')
  const verifiedFactsList = verifiedFacts ? `<ul class="wm-facts" aria-label="Verified business information">${verifiedFacts}</ul>` : ''
  const socialUrl = publicSocialUrl(content.socialUrl)
  const contactLinks = [
    safePhone ? `<a class="wm-contact-link" href="tel:${escapeHtml(safePhone)}">Call the business <span aria-hidden="true">↗</span></a>` : '',
    safeEmail ? `<a class="wm-contact-link" href="mailto:${escapeHtml(safeEmail)}">Email the business <span aria-hidden="true">↗</span></a>` : '',
    safeWebsiteUrl ? `<a class="wm-contact-link" href="${escapeHtml(safeWebsiteUrl)}" target="_blank" rel="noreferrer">Visit the current website <span aria-hidden="true">↗</span></a>` : '',
    socialUrl ? `<a class="wm-contact-link" href="${escapeHtml(socialUrl)}" target="_blank" rel="noreferrer">Find us on social media <span aria-hidden="true">↗</span></a>` : '',
  ].filter(Boolean).join('')
  const contactCopy = visualStyle
    ? (contactLinks ? 'Get in touch to discuss your enquiry.' : 'Contact details will appear here when supplied.')
    : contactLinks
    ? 'Use one of the verified contact methods supplied by the business. Confirm these details before publishing.'
    : 'No contact details were supplied for this draft. Add a verified phone number, email address or website before publishing.'

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${noIndex ? '<meta name="robots" content="noindex,nofollow">' : ''}
  <meta name="description" content="${summary}">
  <meta name="theme-color" content="#f4f2eb">
  <title>${name} | ${escapeHtml(content.industry)}</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1b2118;background:#f4f2eb;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;--ink:#17231f;--muted:#5d6a63;--paper:#f4f2eb;--surface:#fffefa;--accent:#b95c37;--accent-soft:#f0dfd3;--line:#dedbd1;--deep:#19352c}*{box-sizing:border-box}body{margin:0}.wm-theme-garage{--accent:#849640;--accent-soft:#e7ecd1;--deep:#202b28}.wm-theme-studio{--accent:#9b536d;--accent-soft:#f3e2e8;--deep:#392634}.wm-theme-hospitality{--accent:#b26c2d;--accent-soft:#f2e2c8;--deep:#432e20}.wm-theme-outdoors{--accent:#4f7652;--accent-soft:#e2eadb;--deep:#203a2c}.wm-theme-professional{--accent:#446b9a;--accent-soft:#e1e9f3;--deep:#20314b}a{color:inherit}button,a{-webkit-tap-highlight-color:transparent}.wm-shell{width:min(1180px,calc(100% - 64px));margin:0 auto}.wm-header{height:78px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.wm-logo{text-decoration:none;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:750;letter-spacing:-.04em}.wm-logo-mark{width:28px;height:28px;border-radius:9px;background:var(--deep);display:grid;place-items:center;color:#fff;font-size:13px}.wm-nav{display:flex;align-items:center;gap:30px;font-size:12px;color:var(--muted)}.wm-header-cta,.wm-button{display:inline-flex;align-items:center;justify-content:center;gap:16px;padding:13px 17px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:700}.wm-header-cta,.wm-button-primary{background:var(--deep);color:white}.wm-button-primary span,.wm-contact-link span{color:#d5e6ba}.wm-hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(300px,.92fr);gap:clamp(35px,7vw,100px);align-items:center;padding:clamp(70px,10vw,130px) 0 90px}.wm-eyebrow{display:inline-flex;align-items:center;gap:9px;color:var(--muted);font-size:11px;font-weight:650;letter-spacing:.1em;text-transform:uppercase}.wm-eyebrow-dot{width:7px;height:7px;border-radius:50%;background:var(--accent)}h1{color:var(--ink);font-size:clamp(46px,7vw,82px);font-weight:680;letter-spacing:-.075em;line-height:.98;margin:22px 0 22px;max-width:680px}p{line-height:1.7}.wm-hero-copy>p{color:var(--muted);font-size:16px;max-width:500px;margin:0}.wm-hero-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:30px}.wm-button-secondary{text-decoration:none;padding:12px 4px;font-size:12px;font-weight:650}.wm-generated-note{margin-top:25px;color:#7a817a;font-size:10px;letter-spacing:.05em}.wm-hero-art{min-height:430px;border-radius:20px;background:var(--deep);position:relative;overflow:hidden;display:flex;align-items:flex-end;padding:26px;color:#f5f2e9}.wm-art-grid{position:absolute;inset:0;background:linear-gradient(135deg,transparent 49.8%,#ffffff15 50%,transparent 50.3%),linear-gradient(45deg,transparent 49.8%,#ffffff12 50%,transparent 50.3%);background-size:56px 56px;mask-image:linear-gradient(135deg,#000 10%,transparent 80%)}.wm-art-orbit{position:absolute;width:min(76%,340px);aspect-ratio:1;right:-5%;top:7%;border:1px solid #ffffff42;border-radius:50%}.wm-art-orbit:before,.wm-art-orbit:after{content:"";position:absolute;inset:12%;border:1px solid #ffffff32;border-radius:50%}.wm-art-orbit:after{inset:26%}.wm-art-tile{position:absolute;right:17%;top:27%;width:38%;aspect-ratio:.85;border-radius:48% 48% 12px 12px;background:linear-gradient(155deg,var(--accent-soft),var(--accent));transform:rotate(9deg);box-shadow:0 28px 70px #0004}.wm-art-tile:after{content:"";position:absolute;width:48%;height:66%;left:26%;bottom:0;border:1px solid #fff9;border-bottom:0;border-radius:50% 50% 0 0}.wm-art-spark{position:absolute;left:17%;top:24%;width:42px;height:42px;border:1px solid #dce7c4;border-radius:50%;display:grid;place-items:center;color:#dce7c4;font-size:21px}.wm-art-caption{position:relative;z-index:1;border-top:1px solid #ffffff4a;padding-top:15px;width:100%;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#e1e4d7}.wm-section{padding:70px 0;border-top:1px solid var(--line)}.wm-section-heading{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:28px}.wm-section-kicker{margin:0 0 10px;color:var(--accent);font-size:10px;font-weight:750;letter-spacing:.14em;text-transform:uppercase}.wm-section-heading h2,.wm-about-copy h2,.wm-contact h2{margin:0;color:var(--ink);font-size:clamp(30px,4vw,46px);font-weight:650;letter-spacing:-.065em;line-height:1.06}.wm-section-heading>p{max-width:340px;margin:0;color:var(--muted);font-size:12px}.wm-services{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.wm-service-card{position:relative;min-height:190px;padding:23px;border:1px solid var(--line);border-radius:10px;background:var(--surface);transition:transform .2s,border-color .2s}.wm-service-card:hover{transform:translateY(-3px);border-color:var(--accent)}.wm-card-number{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--accent-soft);color:var(--deep);font:700 10px ui-monospace,monospace}.wm-service-card h3{margin:26px 0 8px;color:var(--ink);font-size:17px;letter-spacing:-.04em;line-height:1.2}.wm-service-card p{margin:0;color:var(--muted);font-size:11px;line-height:1.55}.wm-card-arrow{position:absolute;right:22px;top:27px;color:var(--accent);font-size:14px}.wm-about{display:grid;grid-template-columns:.72fr 1.28fr;gap:clamp(35px,9vw,140px);align-items:start}.wm-about-label{color:var(--accent);font-size:11px;font-weight:750;letter-spacing:.12em;text-transform:uppercase}.wm-generated-copy-label{display:block;margin-top:14px;color:#778179;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.wm-about-copy>p{max-width:650px;margin:12px 0 0;color:var(--muted);font-size:15px}.wm-facts{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:27px 0 0;list-style:none}.wm-facts li{padding:9px 12px;border:1px solid var(--line);border-radius:99px;background:var(--surface);color:#46534b;font-size:10px}.wm-contact{margin:18px 0 70px;padding:clamp(28px,6vw,70px);border-radius:16px;background:var(--deep);color:#f5f2e9;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end}.wm-contact .wm-section-kicker{color:var(--accent-soft)}.wm-contact h2{max-width:600px;color:#fff}.wm-contact>div>p:last-child{max-width:550px;color:#d0d6ca;font-size:12px;margin:15px 0 0}.wm-contact-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.wm-contact-link{display:inline-flex;white-space:nowrap;align-items:center;gap:16px;padding:14px 17px;border-radius:6px;background:#f5f2e9;color:#20352e;text-decoration:none;font-size:11px;font-weight:750}.wm-contact-note{color:#d0d6ca;font-size:11px;max-width:280px}.wm-footer{border-top:1px solid var(--line);padding:22px 0 30px;display:flex;justify-content:space-between;gap:20px;color:#737d75;font-size:10px}.wm-footer strong{color:var(--ink)}[contenteditable="true"]{outline:none;border-radius:3px}[contenteditable="true"]:focus{outline:2px dashed var(--accent);outline-offset:5px}@media(max-width:760px){.wm-shell{width:min(100% - 38px,620px)}.wm-header{height:65px}.wm-nav{gap:14px}.wm-nav a:first-child{display:none}.wm-header-cta{padding:10px 12px;font-size:10px}.wm-hero{grid-template-columns:1fr;gap:34px;padding:66px 0 64px}.wm-hero-art{min-height:290px}.wm-art-tile{width:31%;right:22%}.wm-section{padding:52px 0}.wm-section-heading{align-items:start;flex-direction:column;gap:7px}.wm-services{grid-template-columns:repeat(2,minmax(0,1fr))}.wm-service-card{min-height:170px}.wm-about{grid-template-columns:1fr;gap:18px}.wm-contact{grid-template-columns:1fr;align-items:start;margin:12px 0 50px}.wm-contact-actions{justify-content:flex-start}.wm-contact-link{justify-self:start}.wm-footer{flex-direction:column;gap:9px}}@media(max-width:440px){.wm-shell{width:calc(100% - 32px)}.wm-nav{display:none}.wm-hero{padding-top:50px}.wm-hero-copy>p{font-size:14px}.wm-hero-art{min-height:250px}.wm-services{grid-template-columns:1fr}.wm-service-card{min-height:150px;padding:20px}.wm-service-card h3{margin-top:20px}.wm-section-heading h2,.wm-about-copy h2,.wm-contact h2{font-size:34px}.wm-contact{padding:25px 21px}.wm-contact-link{white-space:normal}.wm-footer{font-size:9px}}
    .wm-hero-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .wm-hero-art img+.wm-art-caption{background:#17231fe8;padding:10px;border:0;border-radius:4px}
    .wm-theme-cleaning{--deep:#164049;--accent:#257e85;--accent-soft:#d2eeec}
    .wm-theme-trades{--deep:#242b34;--accent:#b9522e;--accent-soft:#f5decf}
    body[data-style]{overflow-wrap:anywhere}
    body[data-style] .wm-generated-note,body[data-style] .wm-generated-copy-label,
    body[data-style] .wm-card-number,body[data-style] .wm-card-arrow,body[data-style] .wm-footer>span:empty{display:none}
    body[data-style] .wm-service-card{min-height:120px}
    body[data-style] .wm-service-card h3{margin-top:8px}
    body[data-style] .wm-hero h1{font-size:clamp(36px,5.7vw,76px)}
    body[data-style] .wm-hero-art{border-radius:6px}
    body[data-style=dark]{--paper:#12171a;--surface:#212a2e;--ink:#f5f5eb;--muted:#c5ceca;--line:#405056;--accent:#c8ddad;--deep:#273c39;background:var(--paper);color:var(--ink)}
    body[data-style=dark] .wm-facts li{color:#e0e7dd}
    body[data-style=light]{--paper:#fff;--surface:#f8f8f3;--line:#e1e3dc;background:var(--paper)}
    body[data-style=light] .wm-hero-art,body[data-style=light] .wm-contact{border-radius:24px}
    .wm-theme-studio[data-style] h1,.wm-theme-hospitality[data-style] h1{font-family:Georgia,serif;font-weight:400;letter-spacing:-.055em}
    .wm-theme-cleaning[data-style] .wm-hero-art,.wm-theme-outdoors[data-style] .wm-hero-art{border-radius:48% 48% 10px 10px}
    .wm-preview-entry{background:#19251b;color:#fff;padding:12px 20px;display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;justify-content:center;font-size:14px}
    .wm-preview-entry a{display:inline-block;background:#d9fa83;color:#17210d;text-decoration:none;border-radius:5px;padding:10px 16px;font-weight:750}
    @media(min-width:761px){
      .wm-theme-hospitality[data-style] .wm-hero{grid-template-columns:1fr;text-align:center;gap:24px;padding-top:64px}
      .wm-theme-hospitality[data-style] .wm-hero h1,.wm-theme-hospitality[data-style] .wm-hero-copy>p{margin-inline:auto}
      .wm-theme-hospitality[data-style] .wm-hero-actions{justify-content:center}
      .wm-theme-hospitality[data-style] .wm-hero-art{min-height:285px}
      .wm-theme-studio[data-style] .wm-hero-art{order:-1}
      .wm-theme-trades[data-style] .wm-service-card{border-top:4px solid var(--accent)}
    }
  </style>
</head>
<body class="wm-theme-${theme}"${visualStyle ? ` data-style="${visualStyle}"` : ''}>
  ${claimUrl ? '<aside class="wm-preview-entry"><strong>Private-link website concept · Unpublished</strong><a href="#claim-website">Publish this design for £99</a></aside>' : ''}
  <header class="wm-shell wm-header"><a class="wm-logo" href="#top"><span class="wm-logo-mark" aria-hidden="true">${escapeHtml((content.businessName || '').trim().slice(0, 1).toUpperCase())}</span>${name}</a><nav class="wm-nav" aria-label="Main navigation"><a href="#services">${services.length ? 'Services' : 'Business details'}</a><a href="#about">About</a><a href="#contact-details">Contact</a></nav><a class="wm-header-cta" href="${escapeHtml(target)}">${escapeHtml(content.ctaLabel)} <span aria-hidden="true">↗</span></a></header>
  <main class="wm-shell" id="top">
    <section class="wm-hero" aria-labelledby="hero-title">
      <div class="wm-hero-copy"><span class="wm-eyebrow"><i class="wm-eyebrow-dot" aria-hidden="true"></i>${escapeHtml(content.industry)} <span>·</span> ${escapeHtml(content.location)}</span><h1 id="hero-title"${editableAttr('heroTitle', 120)}>${title}</h1><p${editableAttr('heroDescription', 240)}>${summary}</p><div class="wm-hero-actions"><a class="wm-button wm-button-primary" href="${escapeHtml(target)}">${escapeHtml(content.ctaLabel)} <span aria-hidden="true">↗</span></a><a class="wm-button-secondary" href="#services">${services.length ? 'Explore services' : 'Explore details'} ↓</a></div><div class="wm-generated-note">Generated marketing copy · verified business facts are identified below</div></div>
      <div class="wm-hero-art" aria-hidden="true">${heroArt}<div class="wm-art-caption">${escapeHtml(content.industry)} <span>—</span> ${escapeHtml(content.location)}</div></div>
    </section>
    <section class="wm-section" id="services"><div class="wm-section-heading"><div><p class="wm-section-kicker">${serviceLabel}</p><h2>${visualStyle ? (services.length ? 'Our services' : 'Business details') : (services.length ? 'What the business offers' : 'What we know')}</h2></div>${visualStyle ? '' : `<p>${services.length ? 'Each service listed here was supplied as verified information.' : 'These business details were supplied for this draft and should be checked before publishing.'}</p>`}</div><div class="wm-services">${serviceCards || '<article class="wm-service-card"><span class="wm-card-number">01</span><h3>More details needed</h3><p>Add verified services or business facts to complete this section.</p></article>'}</div></section>
    <section class="wm-section wm-about" id="about"><div><span class="wm-about-label">About the business</span><p class="wm-section-kicker" style="margin-top:12px">${escapeHtml(content.industry)} · ${escapeHtml(content.location)}</p></div><div class="wm-about-copy"><h2${editableAttr('aboutTitle', 120)}>${aboutTitle}</h2><span class="wm-generated-copy-label">Generated marketing copy · editable</span><p${editableAttr('aboutDescription', 300)}>${about}</p>${verifiedFactsList}</div></section>
    <section class="wm-contact" id="contact-details"><div><p class="wm-section-kicker">Next step</p><h2>Ready to talk about what you need?</h2><p class="wm-contact-note">${contactCopy}</p></div><div class="wm-contact-actions">${contactLinks || (visualStyle ? '' : '<span class="wm-contact-note">Verified contact details needed before publishing</span>')}</div></section>
  </main>
  ${claimUrl ? '<aside id="claim-website" class="wm-preview-entry">Continue to make your own editable copy and sign in before saving or purchasing. <a href="' + escapeHtml(claimUrl) + '">Continue to Website Machine</a></aside>' : ''}
  <footer class="wm-shell wm-footer"><strong>${name}</strong>${noIndex || editable || !visualStyle ? '<span>Draft website · business information must be verified before publishing</span>' : ''}<span>${escapeHtml(content.location)}</span></footer>
</body>
</html>`
}
