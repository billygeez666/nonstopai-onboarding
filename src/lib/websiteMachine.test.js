import test from 'node:test'
import assert from 'node:assert/strict'
import { generateWebsiteContent, renderStaticWebsite, sanitizeEditableText, sanitizeWebsiteContent, validateBusinessInput } from './websiteMachine.js'

const garage = {
  businessName: 'Northstar Motor Works',
  industry: 'Independent garage',
  location: 'Leeds',
  websiteUrl: '',
  verifiedPhone: '+44 113 555 0100',
  verifiedEmail: 'hello@northstar.example',
  verifiedServices: 'MOT testing\nVehicle servicing',
  verifiedInfo: 'MOT testing\nVehicle servicing\nLocated in Kirkstall',
}

test('validates required fields and generates structured copy from supplied facts', () => {
  const result = generateWebsiteContent(garage)
  assert.equal(result.ok, true)
  assert.equal(result.content.heroTitle, 'Northstar Motor Works | MOT testing in Leeds')
  assert.deepEqual(result.content.facts, ['MOT testing', 'Vehicle servicing', 'Located in Kirkstall'])
  assert.deepEqual(result.content.services, ['MOT testing', 'Vehicle servicing'])
  assert.match(result.content.heroDescription, /looking for mot testing in Leeds/i)
  assert.match(result.content.aboutDescription, /details shared by the business/i)
  assert.equal('reviews' in result.content, false)
  assert.equal('openingHours' in result.content, false)
  assert.equal('qualifications' in result.content, false)
  assert.equal('phone' in result.content, false)
  assert.equal(result.content.ctaLabel, 'Call the business')
})

test('rejects missing required information', () => {
  const result = validateBusinessInput({ ...garage, verifiedInfo: '  ' })
  assert.equal(result.ok, false)
  assert.ok(result.errors.verifiedInfo)
  assert.equal(generateWebsiteContent({ ...garage, businessName: '' }).ok, false)
})

test('normalizes an optional website URL without fetching it', () => {
  const result = validateBusinessInput({ ...garage, websiteUrl: 'northstar.example.co.uk' })
  assert.equal(result.ok, true)
  assert.equal(result.value.websiteUrl, 'https://northstar.example.co.uk/')
  assert.equal(validateBusinessInput({ ...garage, websiteUrl: 'javascript:alert(1)' }).ok, false)
})

test('verified contact buttons only render validated business contact details', () => {
  const content = generateWebsiteContent(garage).content
  const html = renderStaticWebsite(content)
  assert.match(html, /href="tel:\+441135550100"/)
  assert.match(html, /href="mailto:hello@northstar\.example"/)
  assert.equal(validateBusinessInput({ ...garage, verifiedPhone: 'call-me' }).ok, false)
  assert.equal(validateBusinessInput({ ...garage, verifiedEmail: 'not-an-email' }).ok, false)
  const noContact = generateWebsiteContent({ ...garage, verifiedPhone: '', verifiedEmail: '' }).content
  assert.match(renderStaticWebsite(noContact), /Verified contact details needed before publishing/)
  assert.doesNotMatch(renderStaticWebsite(noContact), /href="(?:tel:|mailto:)/)
})

test('caps lengths, rejects excessive fact counts, and sanitizes edited copy', () => {
  const result = validateBusinessInput({ ...garage, businessName: 'N'.repeat(150), verifiedInfo: Array(13).fill('Fact').join('\n') })
  assert.equal(result.value.businessName.length, 100)
  assert.ok(result.errors.verifiedInfo)
  assert.equal(sanitizeEditableText('  safe\u0000 copy  '), 'safe copy')
  assert.equal(sanitizeEditableText('x'.repeat(400)).length, 300)
  assert.equal(validateBusinessInput({ ...garage, verifiedServices: Array(9).fill('Service').join('\n') }).errors.verifiedServices, 'Use 8 verified services or fewer.')
})

test('renders a responsive one-page business site with industry art direction and explicit contact gaps', () => {
  const content = generateWebsiteContent(garage).content
  const html = renderStaticWebsite(content)
  assert.match(html, /wm-theme-garage/)
  assert.match(html, /class="wm-hero"/)
  assert.match(html, /class="wm-services"/)
  assert.match(html, /What the business offers/)
  assert.match(html, /Ask Northstar Motor Works in Leeds about mot testing and current availability\./i)
  assert.match(html, /wm-contact/)
  assert.match(html, /Use one of the verified contact methods supplied by the business/)
  assert.equal((html.match(/MOT testing/g) || []).length, 2)
  assert.match(html, /@media\(max-width:760px\)/)
  assert.match(html, /@media\(max-width:440px\)/)
  assert.match(renderStaticWebsite(content), /<body class="wm-theme-garage">/)
  const variants = [
    ['Hair salon', 'studio'], ['Restaurant', 'hospitality'],
    ['Garden maintenance', 'outdoors'], ['Accountant', 'professional'],
  ]
  for (const [industry, theme] of variants) assert.match(renderStaticWebsite({ ...content, industry }), new RegExp(`<body class="wm-theme-${theme}">`))
  assert.doesNotMatch(html, /customer reviews|qualified|opening hours|telephone number/i)
})

test('preview and static export share the same controlled template', () => {
  const content = generateWebsiteContent(garage).content
  const preview = renderStaticWebsite(content, { editable: true })
  const exported = renderStaticWebsite(content)
  for (const section of ['wm-header', 'wm-hero', 'wm-services', 'wm-about', 'wm-contact', 'wm-footer']) {
    const markup = new RegExp(`class="[^"]*\\b${section}\\b[^"]*"`)
    assert.match(preview, markup, section)
    assert.match(exported, markup, section)
  }
  assert.match(preview, /data-wm-edit="heroTitle"/)
  assert.doesNotMatch(exported, /\scontenteditable=/)
  assert.doesNotMatch(preview, /<script>/i)
  assert.equal(preview.replace(/ data-wm-edit="[^"]+" data-wm-max="\d+" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Edit generated website copy" spellcheck="true"/g, ''), exported)
})

test('exports a fixed, escaped static template without executing supplied markup', () => {
  const result = generateWebsiteContent({ ...garage, verifiedInfo: '<script>alert("x")</script>' })
  const html = renderStaticWebsite(result.content)
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/i)
  assert.doesNotMatch(html, /name="robots" content="noindex,nofollow"/)
  assert.match(renderStaticWebsite(result.content, { noIndex: true }), /name="robots" content="noindex,nofollow"/)
  assert.match(html, /@media\(max-width:440px\)/)
})

test('accepts only a bounded structured website content shape for server persistence', () => {
  const content = generateWebsiteContent(garage).content
  assert.equal(sanitizeWebsiteContent(content).ok, true)
  assert.equal(sanitizeWebsiteContent({ ...content, facts: [42] }).ok, false)
  assert.equal(sanitizeWebsiteContent({ ...content, facts: Array(13).fill('fact') }).ok, false)
  assert.equal(sanitizeWebsiteContent({ ...content, services: Array(9).fill('service') }).ok, false)
  assert.equal(sanitizeWebsiteContent({ ...content, services: ['<script>alert(1)</script>'] }).content.services[0], '<script>alert(1)</script>')
  assert.match(renderStaticWebsite({ ...content, services: ['<script>alert(1)</script>'] }), /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.equal(sanitizeWebsiteContent({ ...content, websiteUrl: 'javascript:alert(1)' }).content.websiteUrl, '')
})
