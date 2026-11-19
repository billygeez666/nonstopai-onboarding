import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyWebsiteService, describeWebsiteService, generateWebsiteContent, renderStaticWebsite, sanitizeEditableText, sanitizeWebsiteContent, selectWebsiteHeroImage, validateBusinessInput } from './websiteMachine.js'

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
  assert.match(result.content.aboutDescription, /Independent garage in Leeds/i)
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
  assert.doesNotMatch(renderStaticWebsite(noContact), /Contact details needed|id="contact-details"/)
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

test('renders a responsive one-page business site with industry art direction and verified contact links', () => {
  const content = generateWebsiteContent(garage).content
  const html = renderStaticWebsite(content)
  assert.match(html, /wm-theme-garage/)
  assert.match(html, /class="wm-hero"/)
  assert.match(html, /class="wm-services wm-services--two"/)
  assert.match(html, /Services supplied by the business/)
  assert.match(html, /Share the vehicle and work you need, then ask Northstar Motor Works about availability\./i)
  assert.match(html, /wm-contact/)
  assert.match(html, /Get in touch to discuss your enquiry/)
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

test('styled websites publish customer-facing copy and safe social links', () => {
  const profile = 'https://www.instagram.com/example_business/'
  const result = generateWebsiteContent({ ...garage, socialUrl: profile + '?tracking=unused' })
  const content = sanitizeWebsiteContent({ ...result.content, visualStyle: 'dark' }).content
  const html = renderStaticWebsite(content)
  assert.equal(content.socialUrl, profile)
  assert.match(html, /data-style="dark"/)
  assert.match(html, /Services supplied by the business/)
  assert.match(html, /href="https:\/\/www\.instagram\.com\/example_business\/"/)
  assert.doesNotMatch(html, /tracking=unused|supplied as verified information/)
  assert.equal(validateBusinessInput({ ...garage, socialUrl: 'https://instagram.com.example.org/business' }).ok, false)
})

test('hero image selection matches the primary verified service before the industry', () => {
  assert.equal(classifyWebsiteService('Boiler servicing'), 'boiler')
  assert.equal(classifyWebsiteService('Emergency pipe repairs'), 'plumbing')
  assert.equal(classifyWebsiteService('Electrical installation'), 'electrical')
  assert.equal(classifyWebsiteService('Roof repairs'), 'roofing')
  assert.equal(classifyWebsiteService('Domestic cleaning'), 'cleaning')
  assert.equal(classifyWebsiteService('Facial treatments'), 'beauty')
  assert.equal(classifyWebsiteService('Vehicle servicing'), 'garage')
  assert.equal(classifyWebsiteService('Restaurant catering'), 'hospitality')

  const fromService = selectWebsiteHeroImage({ primaryService: 'Boiler servicing', industry: 'Independent garage' })
  assert.equal(fromService.category, 'boiler')
  assert.equal(fromService.matchedBy, 'service')
  assert.match(fromService.source, /water-heater/)

  const fromIndustry = selectWebsiteHeroImage({ industry: 'Electrical contractor' })
  assert.equal(fromIndustry.category, 'electrical')
  assert.equal(fromIndustry.matchedBy, 'industry')
  const neutral = selectWebsiteHeroImage({ industry: 'Unknown local service' })
  assert.equal(neutral.category, 'neutral')
  assert.equal(neutral.matchedBy, 'fallback')
  assert.match(neutral.source, /unsplash/)
})

test('service descriptions are deterministic, relevant, and do not add business claims', () => {
  assert.match(describeWebsiteService('Boiler servicing', 'Northstar Heating', 'Leeds'), /heating system/i)
  assert.match(describeWebsiteService('Pipe repairs', 'Northstar Plumbing', 'Leeds'), /plumbing work/i)
  assert.match(describeWebsiteService('Electrical installation', 'Northstar Electrical', 'Leeds'), /electrical work/i)
  assert.match(describeWebsiteService('Roof repair', 'Northstar Roofing', 'Leeds'), /roof work/i)
  assert.match(describeWebsiteService('Domestic cleaning', 'Northstar Cleaning', 'Leeds'), /spaces or cleaning work/i)
  assert.match(describeWebsiteService('Facial treatment', 'Northstar Beauty', 'Leeds'), /appointment availability/i)
  assert.match(describeWebsiteService('Vehicle servicing', 'Northstar Garage', 'Leeds'), /vehicle and work/i)
  for (const copy of ['Boiler servicing', 'Pipe repairs', 'Electrical installation', 'Roof repair', 'Domestic cleaning', 'Facial treatment', 'Vehicle servicing'].map((service) => describeWebsiteService(service, 'Northstar', 'Leeds'))) {
    assert.doesNotMatch(copy, /qualified|certified|guaranteed|award|review|testimonial|since \d{4}|years of experience|24\/7/i)
  }
})

test('website service layout adapts for zero, one, two, and five verified services', () => {
  const base = generateWebsiteContent(garage).content
  const withServices = (services) => ({ ...base, services, facts: ['Based in Leeds'] })

  const none = renderStaticWebsite(withServices([]))
  assert.match(none, /wm-services--none/)
  assert.match(none, /No services supplied yet/)
  assert.match(none, /Based in Leeds/)
  assert.doesNotMatch(none, /<article class="wm-service-card/)
  assert.doesNotMatch(none, /Business detail supplied.*Based in Leeds/)

  const one = renderStaticWebsite(withServices(['MOT testing']))
  assert.match(one, /wm-services--one/)
  assert.match(one, /wm-service-card-feature/)
  assert.equal((one.match(/class="wm-service-card/g) || []).length, 1)

  const two = renderStaticWebsite(withServices(['MOT testing', 'Vehicle servicing']))
  assert.match(two, /wm-services--two/)
  assert.match(two, /\.wm-services--two\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/)

  const five = renderStaticWebsite(withServices(['MOT testing', 'Vehicle servicing', 'Vehicle repairs', 'Tyre fitting', 'Valeting']))
  assert.match(five, /wm-services--many/)
  assert.equal((five.match(/class="wm-service-card/g) || []).length, 5)
  assert.match(five, /\.wm-services--many\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/)
  assert.match(five, /@media\(max-width:440px\)\{\.wm-services--two,.wm-services--many\{grid-template-columns:minmax\(0,1fr\)\}/)
})

test('hero images use responsive curated sources and are clearly illustrative', () => {
  const plumbing = generateWebsiteContent({ ...garage, industry: 'General trades', verifiedServices: 'Pipe repairs' }).content
  const html = renderStaticWebsite(plumbing)
  assert.match(html, /photo-1749532125405-70950966b0e5/)
  assert.match(html, /srcset="[^"]+640w,[^"]+960w,[^"]+1440w"/)
  assert.match(html, /sizes="\(max-width: 760px\) 100vw, 46vw"/)
  assert.match(html, /Illustrative stock image · not a photograph of this business/)
  assert.match(html, /@media\(max-width:760px\)\{\.wm-hero-art img\{object-position:center 45%\}/)
})
