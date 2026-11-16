import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const commerce = readFileSync(new URL('../../supabase/migrations/202611160003_website_machine_orders_and_sites.sql', import.meta.url), 'utf8')
const oneOff = readFileSync(new URL('../../supabase/migrations/202611160004_website_machine_99_test_only.sql', import.meta.url), 'utf8')

test('commerce migration seeds and leaves every Website Machine Stripe offer inactive', () => {
  const offerInsert = commerce.match(/insert into public\.wm_offer_prices[\s\S]*?on conflict \(mode, purpose\) do nothing;/i)?.[0]
  assert.ok(offerInsert)
  assert.equal((offerInsert.match(/, false\)/g) || []).length, 4)
  assert.match(commerce, /active boolean not null default false/i)
  assert.match(commerce, /update public\.wm_offer_prices set active = false where active/i)
  assert.doesNotMatch(offerInsert, /true\)/i)
})

test('commerce checkout, confirmation, site reservation, and payment HMAC reject live mode', () => {
  assert.match(commerce, /if p_mode is distinct from 'test' or p_monthly_price_id is not null/i)
  assert.match(commerce, /p_amount_total <> 9900/i)
  assert.match(commerce, /p_mode is distinct from 'test' or not exists[\s\S]*?paid test order required/i)
  assert.match(commerce, /p_mode is distinct from 'test' then raise exception 'live payment fulfillment is disabled'/i)
  assert.match(commerce, /when 'test' then 'wm_payment_rpc_secret_staging'[\s\S]*?else null/i)
  assert.doesNotMatch(commerce, /wm_payment_rpc_secret_production/)
})

test('£99 migration keeps all offers inactive and preserves conflicting configured offer identifiers', () => {
  assert.match(oneOff, /update public\.wm_offer_prices set active = false where active/i)
  assert.match(oneOff, /alter table public\.wm_offer_prices alter column active set default false/i)
  assert.match(oneOff, /on conflict \(mode, purpose\) do nothing/i)
  assert.match(oneOff, /values \('test', 'setup', 'price_wm_99_test_pending', 'prod_wm_99_test_pending', 9900, 'gbp', null, false\)/i)
  assert.match(oneOff, /p_mode is distinct from 'test'/i)
  assert.match(oneOff, /p_amount_total <> 9900/i)
  assert.match(oneOff, /alter table public\.wm_offer_prices enable row level security/i)
  assert.match(oneOff, /alter table public\.wm_orders enable row level security/i)
  assert.match(oneOff, /revoke all on public\.wm_offer_prices, public\.wm_orders, public\.wm_payment_events, public\.wm_customer_sites/i)
  assert.match(oneOff, /grant select on public\.wm_orders, public\.wm_customer_sites to authenticated/i)
  assert.match(oneOff, /where split_part\(p_message, E'\\n', 1\) = 'test'[\s\S]*?s\.name = 'wm_payment_rpc_secret_staging'/i)
  assert.doesNotMatch(oneOff, /wm_payment_rpc_secret_production/)
  assert.doesNotMatch(oneOff, /\b(delete from|truncate|drop table)\b/i)
})

test('migrations detect missing and partially applied prerequisites without destructive repair', () => {
  assert.match(commerce, /Website Machine prerequisite missing: apply migration 001 first/i)
  assert.match(commerce, /Incompatible partial Website Machine table/i)
  assert.match(oneOff, /apply migrations 001 through 003 first/i)
  assert.match(oneOff, /Incompatible partial Website Machine table/i)
  assert.match(commerce, /vault\.decrypted_secrets/)
  assert.match(commerce, /extensions\.hmac\(bytea,bytea,text\)/)
  assert.match(oneOff, /vault\.decrypted_secrets/)
  assert.match(oneOff, /extensions\.hmac\(bytea,bytea,text\)/)
})
