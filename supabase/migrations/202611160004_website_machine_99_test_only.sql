-- Website Machine £99 one-off TEST offer only.
-- Does not update or delete existing customer records or any NONSTOP AI data.
-- The placeholder stays inactive until an operator creates the matching Stripe
-- test price and changes this wm-only offer row to its verified Stripe ID.

-- Fail closed before touching the database if 003 is missing or only partly
-- present. A migration runner applies each file transactionally; this explicit
-- check also makes manual/partial rollout failures clear without data cleanup.
do $$
declare v_table text; v_columns text[]; v_missing text[];
begin
  for v_table, v_columns in
    select * from (values
      ('wm_projects', array['id','owner_id','content']),
      ('wm_offer_prices', array['mode','purpose','stripe_price_id','product_id','unit_amount','currency','recurring_interval','active']),
      ('wm_orders', array['id','project_id','owner_id','idempotency_key','mode','setup_price_id','monthly_price_id','amount_total','currency','domain','domain_challenge','checkout_session_id','status','paid_event_id','paid_at','created_at','updated_at']),
      ('wm_payment_events', array['event_id','order_id','checkout_session_id','created_at']),
      ('wm_customer_sites', array['project_id','owner_id','site_id','site_name','custom_domain','current_deploy_id','previous_deploy_ids','site_url','verified_deploy_url','status','created_at','updated_at'])
    ) as expected(table_name, column_names)
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Website Machine prerequisite missing: public.%; apply migrations 001 through 003 first', v_table;
    end if;
    select array_agg(required.column_name) into v_missing
    from unnest(v_columns) as required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = v_table and c.column_name = required.column_name
    );
    if v_missing is not null then
      raise exception 'Incompatible partial Website Machine table public.%; missing columns: %', v_table, array_to_string(v_missing, ', ');
    end if;
  end loop;
  if to_regclass('vault.decrypted_secrets') is null or
     not exists (select 1 from information_schema.columns where table_schema = 'vault' and table_name = 'decrypted_secrets' and column_name = 'decrypted_secret') then
    raise exception 'Supabase Vault decrypted_secrets view is unavailable';
  end if;
  if to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then
    raise exception 'pgcrypto hmac(bytea,bytea,text) is unavailable in the extensions schema';
  end if;
  if to_regnamespace('wm_internal') is null or to_regprocedure('wm_internal.verify_hmac(text,text)') is null or
     to_regprocedure('public.wm_attach_checkout_session(uuid,text)') is null or
     to_regprocedure('public.wm_reserve_customer_site(uuid,uuid,text,text,text,text,text)') is null or
     to_regprocedure('public.wm_record_customer_deployment(uuid,uuid,text,text,text,text,text,text)') is null then
    raise exception 'Website Machine signed RPC prerequisites from migration 003 are unavailable';
  end if;
end;
$$;

-- Turn off the production-signing path immediately, including in a partially
-- upgraded database where 003 was applied before this hardening.
create or replace function wm_internal.verify_hmac(p_message text, p_signature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from vault.decrypted_secrets as s
    where split_part(p_message, E'\n', 1) = 'test'
      and s.name = 'wm_payment_rpc_secret_staging'
      and p_signature ~ '^[0-9a-f]{64}$'
      and encode(extensions.hmac(convert_to(p_message, 'utf8'), convert_to(s.decrypted_secret, 'utf8'), 'sha256'), 'hex') = p_signature
  );
$$;
revoke all on function wm_internal.verify_hmac(text, text) from public, anon, authenticated;

-- Also disable offer creation immediately; existing rows and price IDs remain.
update public.wm_offer_prices set active = false where active;

-- Reassert Website Machine isolation if the prerequisite schema was only
-- partially applied. Client access remains owner-scoped read-only for orders
-- and customer sites; offer/event data is server-only.
alter table public.wm_offer_prices enable row level security;
alter table public.wm_orders enable row level security;
alter table public.wm_payment_events enable row level security;
alter table public.wm_customer_sites enable row level security;

drop policy if exists wm_orders_owner_read on public.wm_orders;
create policy wm_orders_owner_read on public.wm_orders for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists wm_customer_sites_owner_read on public.wm_customer_sites;
create policy wm_customer_sites_owner_read on public.wm_customer_sites for select to authenticated using (owner_id = (select auth.uid()));

revoke all on public.wm_offer_prices, public.wm_orders, public.wm_payment_events, public.wm_customer_sites from public, anon, authenticated;
grant select on public.wm_orders, public.wm_customer_sites to authenticated;

alter table public.wm_orders alter column monthly_price_id drop not null;
alter table public.wm_orders alter column amount_total set default 9900;
alter table public.wm_orders drop constraint if exists wm_orders_amount_total_check;
alter table public.wm_orders add constraint wm_orders_amount_total_check check (amount_total in (9900, 24900));
alter table public.wm_offer_prices alter column active set default false;

insert into public.wm_offer_prices(mode, purpose, stripe_price_id, product_id, unit_amount, currency, recurring_interval, active)
values ('test', 'setup', 'price_wm_99_test_pending', 'prod_wm_99_test_pending', 9900, 'gbp', null, false)
on conflict (mode, purpose) do nothing;

create or replace function public.wm_create_checkout_order(
  p_project_id uuid,
  p_idempotency_key text,
  p_mode text,
  p_setup_price_id text,
  p_monthly_price_id text,
  p_domain text default null,
  p_domain_challenge text default null
)
returns setof public.wm_orders language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_order public.wm_orders; v_recent_count integer;
begin
  if v_owner is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_mode is distinct from 'test' or p_monthly_price_id is not null or p_idempotency_key is null or length(p_idempotency_key) not between 12 and 100 then
    raise exception 'invalid one-off test order request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.wm_projects p where p.id = p_project_id and p.owner_id = v_owner) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.wm_offer_prices p
    where p.mode = 'test' and p.purpose = 'setup' and p.stripe_price_id = p_setup_price_id
      and p.active and p.unit_amount = 9900 and p.currency = 'gbp' and p.recurring_interval is null
  ) then raise exception 'unapproved Website Machine one-off test price' using errcode = '22023'; end if;
  if (p_domain is null) <> (p_domain_challenge is null) then raise exception 'incomplete domain proof' using errcode = '22023'; end if;
  select * into v_order from public.wm_orders where owner_id = v_owner and idempotency_key = p_idempotency_key;
  if found then
    if v_order.project_id <> p_project_id or v_order.mode <> 'test' or v_order.setup_price_id <> p_setup_price_id or v_order.monthly_price_id is not null or v_order.amount_total <> 9900 then
      raise exception 'idempotency key is already bound to a different order' using errcode = '22023';
    end if;
    return next v_order; return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));
  select * into v_order from public.wm_orders where owner_id = v_owner and idempotency_key = p_idempotency_key;
  if found then
    if v_order.project_id <> p_project_id or v_order.mode <> 'test' or v_order.setup_price_id <> p_setup_price_id or v_order.monthly_price_id is not null or v_order.amount_total <> 9900 then
      raise exception 'idempotency key is already bound to a different order' using errcode = '22023';
    end if;
    return next v_order; return;
  end if;
  select count(*) into v_recent_count from public.wm_orders where owner_id = v_owner and created_at >= now() - interval '1 hour';
  if v_recent_count >= 5 then raise exception 'Website Machine checkout rate limit exceeded' using errcode = 'P0001'; end if;
  insert into public.wm_orders(project_id, owner_id, idempotency_key, mode, setup_price_id, monthly_price_id, amount_total, domain, domain_challenge)
    values (p_project_id, v_owner, p_idempotency_key, 'test', p_setup_price_id, null, 9900, p_domain, p_domain_challenge)
    on conflict (owner_id, idempotency_key) do nothing returning * into v_order;
  if not found then
    select * into v_order from public.wm_orders where owner_id = v_owner and idempotency_key = p_idempotency_key;
    if v_order.project_id <> p_project_id or v_order.mode <> 'test' or v_order.setup_price_id <> p_setup_price_id or v_order.monthly_price_id is not null or v_order.amount_total <> 9900 then
      raise exception 'idempotency key is already bound to a different order' using errcode = '22023';
    end if;
  end if;
  return next v_order;
end;
$$;

create or replace function public.wm_get_payment_order(p_order_id uuid, p_mode text, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.wm_orders; v_project public.wm_projects;
begin
  if p_mode is distinct from 'test' or not wm_internal.verify_hmac(p_mode || E'\nget_order:' || p_order_id::text, p_signature) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into v_order from public.wm_orders where id = p_order_id;
  if not found or v_order.mode <> 'test' then return null; end if;
  select * into v_project from public.wm_projects where id = v_order.project_id;
  return jsonb_build_object(
    'id', v_order.id, 'projectId', v_order.project_id, 'ownerId', v_order.owner_id, 'mode', v_order.mode,
    'setupPriceId', v_order.setup_price_id, 'monthlyPriceId', v_order.monthly_price_id,
    'amountTotal', v_order.amount_total, 'currency', v_order.currency,
    'checkoutSessionId', v_order.checkout_session_id, 'status', v_order.status,
    'domain', v_order.domain, 'domainChallenge', v_order.domain_challenge,
    'content', v_project.content,
    'siteRecord', (select jsonb_build_object('project_id', s.project_id, 'owner_id', s.owner_id, 'site_id', s.site_id, 'site_name', s.site_name, 'custom_domain', s.custom_domain, 'current_deploy_id', s.current_deploy_id, 'previous_deploy_ids', s.previous_deploy_ids, 'site_url', s.site_url) from public.wm_customer_sites s where s.project_id = v_order.project_id)
  );
end;
$$;

create or replace function public.wm_confirm_paid_order(p_order_id uuid, p_event_id text, p_session_id text, p_project_id uuid, p_mode text, p_amount_total integer, p_currency text, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.wm_orders; v_message text;
begin
  select * into v_order from public.wm_orders where id = p_order_id;
  if not found or v_order.project_id <> p_project_id then raise exception 'order not found' using errcode = 'P0002'; end if;
  v_message := p_mode || E'\n' || p_event_id || E'\n' || p_session_id || E'\n' || p_project_id::text || E'\n' || p_amount_total::text || E'\n' || lower(p_currency);
  if not wm_internal.verify_hmac(v_message, p_signature) then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into v_order from public.wm_orders where id = p_order_id for update;
  if p_mode is distinct from 'test' or v_order.mode <> 'test' or v_order.project_id <> p_project_id or
     v_order.checkout_session_id <> p_session_id or v_order.amount_total <> 9900 or
     p_amount_total <> 9900 or v_order.currency <> lower(p_currency) or lower(p_currency) <> 'gbp' then
    raise exception 'payment does not match the £99 test order' using errcode = '22023';
  end if;
  if exists (select 1 from public.wm_payment_events e where e.event_id = p_event_id and (e.order_id <> p_order_id or e.checkout_session_id <> p_session_id)) then
    raise exception 'Stripe event already belongs to another order' using errcode = '23505';
  end if;
  insert into public.wm_payment_events(event_id, order_id, checkout_session_id) values (p_event_id, p_order_id, p_session_id) on conflict (event_id) do nothing;
  update public.wm_orders set status = case when status = 'delivered' then 'delivered' else 'delivering' end,
    paid_event_id = coalesce(paid_event_id, p_event_id), paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = p_order_id and status in ('pending', 'paid', 'delivering', 'delivered', 'failed');
  select * into v_order from public.wm_orders where id = p_order_id;
  return jsonb_build_object('paid', v_order.status in ('delivering', 'delivered'), 'delivered', v_order.status = 'delivered');
end;
$$;

revoke all on function public.wm_create_checkout_order(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.wm_attach_checkout_session(uuid, text) from public, anon;
revoke all on function public.wm_get_payment_order(uuid, text, text) from public, authenticated;
revoke all on function public.wm_confirm_paid_order(uuid, text, text, uuid, text, integer, text, text) from public, authenticated;
revoke all on function public.wm_reserve_customer_site(uuid, uuid, text, text, text, text, text) from public, authenticated;
revoke all on function public.wm_record_customer_deployment(uuid, uuid, text, text, text, text, text, text) from public, authenticated;
grant execute on function public.wm_create_checkout_order(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.wm_attach_checkout_session(uuid, text) to authenticated;
grant execute on function public.wm_get_payment_order(uuid, text, text) to anon;
grant execute on function public.wm_confirm_paid_order(uuid, text, text, uuid, text, integer, text, text) to anon;
grant execute on function public.wm_reserve_customer_site(uuid, uuid, text, text, text, text, text) to anon;
grant execute on function public.wm_record_customer_deployment(uuid, uuid, text, text, text, text, text, text) to anon;
