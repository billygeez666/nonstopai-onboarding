import test from 'node:test'
import assert from 'node:assert/strict'
import { generateWebsiteContent, renderStaticWebsite, sanitizeEditableText, validateBusinessInput } from './websiteMachine.js'

const garage = {
  businessName: 'Northstar Motor Works',
  industry: 'Independent garage',
  location: 'Leeds',
  websiteUrl: '',
  verifiedInfo: 'MOT testing\nVehicle servicing\nLocated in Kirkstall',
}

test('validates required fields and generates structured copy from supplied facts', () => {
  const result = generateWebsiteContent(garage)
  assert.equal(result.ok, true)
  assert.equal(result.content.heroTitle, 'Northstar Motor Works in Leeds')
  assert.deepEqual(result.content.facts, ['MOT testing', 'Vehicle servicing', 'Located in Kirkstall'])
  assert.match(result.content.heroDescription, /independent garage · Leeds/i)
  assert.match(result.content.aboutDescription, /business information provided/i)
  assert.equal('reviews' in result.content, false)
  assert.equal('openingHours' in result.content, false)
  assert.equal('qualifications' in result.content, false)
  assert.equal('phone' in result.content, false)
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

test('caps lengths, rejects excessive fact counts, and sanitizes edited copy', () => {
  const result = validateBusinessInput({ ...garage, businessName: 'N'.repeat(150), verifiedInfo: Array(13).fill('Fact').join('\n') })
  assert.equal(result.value.businessName.length, 100)
  assert.ok(result.errors.verifiedInfo)
  assert.equal(sanitizeEditableText('  safe\u0000 copy  '), 'safe copy')
  assert.equal(sanitizeEditableText('x'.repeat(400)).length, 300)
})

test('exports a fixed, escaped static template without executing supplied markup', () => {
  const result = generateWebsiteContent({ ...garage, verifiedInfo: '<script>alert("x")</script>' })
  const html = renderStaticWebsite(result.content)
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/i)
  assert.match(html, /name="robots" content="noindex,nofollow"/)
  assert.match(html, /@media\(max-width:600px\)/)
})
