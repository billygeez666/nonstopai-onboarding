import { sanitizeEditableText } from './websiteMachine.js'

// Research is deliberately source-led: this module records human-verified findings
// and provenance. It does not scrape arbitrary URLs or turn search snippets into facts.
export function validateResearchSources(sources = []) {
  if (!Array.isArray(sources) || sources.length > 12) return { ok: false, error: 'Add no more than 12 sources.' }
  const clean = []
  for (const source of sources) {
    const label = sanitizeEditableText(source?.label, 120)
    const urlText = sanitizeEditableText(source?.url, 500)
    const verifiedAt = sanitizeEditableText(source?.verifiedAt, 40)
    const findings = sanitizeEditableText(source?.findings, 800)
    if (!label || !findings) return { ok: false, error: 'Each source needs a label and verified findings.' }
    let url
    try {
      url = new URL(urlText)
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('unsafe')
    } catch {
      return { ok: false, error: 'Sources must use a valid HTTPS URL.' }
    }
    clean.push({ label, url: url.toString(), findings, verifiedAt: verifiedAt || new Date().toISOString(), status: 'human_verified' })
  }
  return { ok: true, sources: clean }
}

export function buildResearchBrief(sources) {
  const result = validateResearchSources(sources)
  if (!result.ok) return result
  return { ok: true, verifiedFindings: result.sources.map(({ label, url, findings, verifiedAt }) => ({ label, url, findings, verifiedAt, provenance: 'human_verified' })), generatedCopy: [] }
}
