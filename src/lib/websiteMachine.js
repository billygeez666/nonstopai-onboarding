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
