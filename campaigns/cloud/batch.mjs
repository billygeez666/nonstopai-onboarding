import { execFileSync } from 'node:child_process'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve, relative, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { generateWebsiteContent, renderStaticWebsite } from './websiteMachine.mjs'

const checkout = 'https://website-machine-live.netlify.app/website-machine/'
const headers = '/*\n  X-Robots-Tag: noindex, nofollow\n'

function query(sql) {
  try {
    return execFileSync('psql', ['-XqAt', '-w', '-v', 'ON_ERROR_STOP=1'], {
      input: sql, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PGCONNECT_TIMEOUT: '10' }, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    throw new Error('CRM operation failed. Check the scoped PostgreSQL connection and migration. Reconcile claims before retrying.')
  }
}

function batchSql(batch, write) {
  const approved = `
    select company_number, batch_id, payload from wm_acquisition.preview_batch_input
    where batch_id = '${batch}'::uuid and revoked_at is null and approved_until > now()
      and exists (select 1 from wm_acquisition.territories
                  where slug = territory_slug and status = 'active')
    order by company_number limit 11`
  const available = `(select count(*) between 1 and 10 from approved)
    and not exists (select 1 from approved
      join wm_acquisition.preview_generation using (company_number))`
  if (!write) return `
    with approved as (${approved})
    select coalesce(json_agg(approved), '[]'::json)
    from approved where ${available};`
  // The unique company key closes the race with other batches. No conflict
  // handler means any concurrent conflict rolls back the entire statement.
  return `
    with approved as (${approved}),
    claims as (
      insert into wm_acquisition.preview_generation (company_number, batch_id)
      select company_number, batch_id from approved where ${available}
      returning company_number
    )
    select coalesce(json_agg(approved), '[]'::json)
    from approved join claims using (company_number);`
}

function htmlFor(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Approved input must contain a business object.')
  }
  const generated = generateWebsiteContent(payload)
  if (!generated.ok) throw new Error('Approved input failed the existing Website Machine validator.')
  return renderStaticWebsite(generated.content, { noIndex: true, claimUrl: checkout })
    .replace(/(<body[^>]*>)/, '$1\n<p style="margin:0;padding:12px 16px;text-align:center;background:#19352c;color:white">Unofficial website demonstration by NONSTOP AI</p>')
}

async function verify(browser, html) {
  const page = await browser.newPage({ javaScriptEnabled: false })
  try {
    await page.route('**/*', route => route.abort())
    await page.setContent(html)
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const valid = await page.evaluate(() => {
        const headings = document.querySelectorAll('h1')
        const ids = [...document.querySelectorAll('[id]')].map(node => node.id)
        return document.doctype?.name === 'html' &&
          document.querySelector('meta[name=viewport]') &&
          document.querySelector('meta[name=robots]')?.content.includes('noindex') &&
          headings.length === 1 && headings[0].textContent.trim() &&
          new Set(ids).size === ids.length &&
          !document.querySelector('script, form, iframe, [contenteditable=true]') &&
          [...document.querySelectorAll('a[href^="#"]')].every(link =>
            !!document.getElementById(link.getAttribute('href').slice(1))) &&
          document.documentElement.scrollWidth <= innerWidth
      })
      if (!valid || !(await page.locator(`a[href="${checkout}"]`).count())) {
        throw new Error(`Generated HTML failed structural or responsive QA at ${width}px.`)
      }
    }
  } finally {
    await page.close()
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    batch: { type: 'string' }, 'dry-run': { type: 'boolean' },
    'write-results': { type: 'boolean' }, out: { type: 'string' },
  } })
  const batch = values.batch?.toLowerCase()
  const dry = values['dry-run'] === true
  const write = values['write-results'] === true
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(batch ?? '') ||
      dry === write || (write && !values.out) || (dry && values.out)) {
    throw new Error('Use --batch UUID with --dry-run, or with --write-results --out NEW_DIRECTORY.')
  }
  const target = resolve(values.out ?? '.')
  const out = write ? resolve(await realpath(dirname(target)), basename(target)) : target
  const repo = await realpath(resolve(import.meta.dirname, '../..'))
  const fromRepo = relative(repo, out)
  const outputOutsideRepo = fromRepo === '..' || fromRepo.startsWith(`..${sep}`)
  if (write && !outputOutsideRepo) throw new Error('Store generated files outside the Git checkout.')
  const browser = await chromium.launch()
  try {
    if (write) await mkdir(out, { mode: 0o700 })
    const rows = JSON.parse(query(batchSql(batch, write)))
    if (rows.length < 1 || rows.length > 10) {
      throw new Error('No runnable batch. Check authorisation, territory, batch size and existing claims.')
    }
    const pages = []
    for (const row of rows) {
      const html = htmlFor(row.payload)
      await verify(browser, html)
      pages.push({ company: row.company_number, html })
    }
    if (write) {
      for (const { company, html } of pages) {
        const dir = resolve(out, company)
        await mkdir(dir, { mode: 0o700 })
        await writeFile(resolve(dir, 'index.html'), html, { mode: 0o600, flag: 'wx' })
      }
      await writeFile(resolve(out, '_headers'), headers, { mode: 0o600, flag: 'wx' })
      const count = query(`with updated as (
        update wm_acquisition.preview_generation set state = 'rendered', rendered_at = now()
        where batch_id = '${batch}'::uuid and state = 'claimed' returning 1
      ) select count(*) from updated;`)
      if (Number(count) !== pages.length) throw new Error('Result count did not match validated pages. Reconcile the batch.')
    }
    console.log(JSON.stringify({ dryRun: dry, validated: pages.length, crmWrites: write }, null, 2))
  } finally {
    await browser.close()
  }
}

await main().catch(error => {
  console.error(error.message.split('\n')[0])
  process.exitCode = 1
})
