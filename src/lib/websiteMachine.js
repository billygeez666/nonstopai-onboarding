const MAX = {
  businessName: 100,
  industry: 80,
  location: 100,
  websiteUrl: 300,
  verifiedInfo: 1200,
}

// eslint-disable-next-line no-control-regex -- user input must not carry control characters into rendered content
const stripControls = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim()
// eslint-disable-next-line no-control-regex -- line breaks are meaningful delimiters between verified facts
const stripMultilineControls = (value) => String(value ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim()

export function validateBusinessInput(input) {
  const clean = Object.fromEntries(Object.entries(MAX).map(([key, limit]) => [
    key,
    (key === 'verifiedInfo' ? stripMultilineControls(input?.[key]) : stripControls(input?.[key])).slice(0, limit),
  ]))
  const errors = {}
  for (const key of ['businessName', 'industry', 'location', 'verifiedInfo']) {
    if (!clean[key]) errors[key] = 'This field is required.'
  }
  if (clean.verifiedInfo && clean.verifiedInfo.split(/\n/).filter((line) => line.trim()).length > 12) {
    errors.verifiedInfo = 'Use 12 verified facts or fewer.'
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
  const { businessName, industry, location, websiteUrl, verifiedInfo } = result.value
  const facts = verifiedInfo.split(/\n/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
  return {
    ok: true,
    content: {
      businessName,
      industry,
      location,
      websiteUrl,
      heroTitle: `${businessName} in ${location}`,
      heroDescription: `Business information for ${businessName}: ${industry} · ${location}.`,
      aboutTitle: `About ${businessName}`,
      aboutDescription: `Review the business information provided for ${businessName}.`,
      facts,
      ctaLabel: `Explore ${businessName}`,
    },
  }
}

export function sanitizeEditableText(value, maxLength = 300) {
  return stripControls(value).slice(0, maxLength)
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])

// Render reviewed structured copy into a fixed, self-contained document.
// No generated source code is interpreted or included in the output.
export function renderStaticWebsite(content) {
  const name = escapeHtml(content.businessName)
  const title = escapeHtml(content.heroTitle)
  const summary = escapeHtml(content.heroDescription)
  const aboutTitle = escapeHtml(content.aboutTitle)
  const about = escapeHtml(content.aboutDescription)
  const facts = (content.facts || []).map((fact) => `<li>${escapeHtml(fact)}</li>`).join('\n        ')
  let safeWebsiteUrl = ''
  try {
    const url = new URL(content.websiteUrl)
    if (['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password) {
      safeWebsiteUrl = url.toString()
    }
  } catch {
    // Invalid and non-web links are omitted from the exported template.
  }
  const siteLink = safeWebsiteUrl
    ? `<a href="${escapeHtml(safeWebsiteUrl)}" rel="noreferrer">Visit current website</a>`
    : ''

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="description" content="${summary}">
  <title>${name}</title>
  <style>
    :root{font-family:Arial,Helvetica,sans-serif;color:#1b2118;background:#f3f2eb}*{box-sizing:border-box}body{margin:0}header,main,footer{width:min(100% - 40px,960px);margin:auto}header{padding:24px 0;border-bottom:1px solid #d8dacd}header a{color:inherit;text-decoration:none;font-weight:700}main{padding:clamp(64px,12vw,150px) 0 90px}p.kicker{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#657044}h1{font-size:clamp(42px,8vw,88px);line-height:.98;letter-spacing:-.06em;max-width:850px;margin:18px 0}p{line-height:1.7;color:#5d6457;max-width:620px}a.button{display:inline-block;margin-top:18px;padding:14px 18px;background:#20251b;color:white;text-decoration:none;border-radius:3px}section{border-top:1px solid #d8dacd;padding:32px 0;margin-top:72px;display:grid;grid-template-columns:1fr 2fr;gap:24px}h2{font-size:30px;letter-spacing:-.04em;margin:0 0 12px}ul{padding:0;margin:24px 0;list-style:none;border-top:1px solid #d8dacd}li{padding:14px 0;border-bottom:1px solid #d8dacd}footer{padding:18px 0 28px;border-top:1px solid #d8dacd;display:flex;justify-content:space-between;gap:16px;font-size:12px;color:#687060}footer a{color:inherit}@media(max-width:600px){header,main,footer{width:calc(100% - 32px)}section{grid-template-columns:1fr;gap:14px;margin-top:52px}footer{flex-direction:column}}
  </style>
</head>
<body>
  <header><a href="#top">${name}</a></header>
  <main id="top">
    <p class="kicker">${escapeHtml(content.industry)} · ${escapeHtml(content.location)}</p>
    <h1>${title}</h1>
    <p>${summary}</p>
    <a class="button" href="#business-information">${escapeHtml(content.ctaLabel)}</a>
    <section id="business-information">
      <div><p class="kicker">Information supplied by the business</p></div>
      <div><h2>${aboutTitle}</h2><p>${about}</p><ul>${facts}</ul>${siteLink}</div>
    </section>
  </main>
  <footer><span>${name}</span><span>Draft website · verify all facts before publishing</span></footer>
</body>
</html>`
}
