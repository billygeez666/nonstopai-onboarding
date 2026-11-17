-- Enforce one Website Machine order per project and reuse the original
-- pending order/session on retries. This does not activate any offer or alter
-- existing payment, site, email, or order records.
do $$
declare
  v_duplicate_project uuid;
begin
  if to_regclass('public.wm_orders') is null or
     to_regprocedure('public.wm_create_checkout_order(uuid,text,text,text,text,text,text)') is null or
     to_regclass('wm_internal.wm_staging_checkout_testers') is null then
    raise exception 'Website Machine checkout idempotency prerequisites are missing';
  end if;

  select project_id into v_duplicate_project
  from public.wm_orders
  group by project_id
  having count(*) > 1
  limit 1;
  if v_duplicate_project is not null then
    raise exception 'Multiple Website Machine orders already exist for a project; reconcile before applying checkout idempotency';
  end if;
end;
$$;

create unique index if not exists wm_orders_one_order_per_project_idx
  on public.wm_orders(project_id);

create or replace function public.wm_create_checkout_order(
  p_project_id uuid,
  p_idempotency_key text,
  p_mode text,
  p_setup_price_id text,
  p_monthly_price_id text,
  p_domain text default null,
  p_domain_challenge text default null
)
returns setof public.wm_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_order public.wm_orders;
  v_recent_count integer;
  v_expected_key text;
begin
  if v_owner is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_project_id is null or p_mode is distinct from 'test' or p_monthly_price_id is not null then
    raise exception 'invalid one-off test order request' using errcode = '22023';
  end if;

  v_expected_key := 'wm-project-' || v_owner::text || '-' || p_project_id::text;
  if p_idempotency_key is distinct from v_expected_key then
    raise exception 'invalid project checkout idempotency key' using errcode = '22023';
  end if;
  if not exists (
    select 1 from wm_internal.wm_staging_checkout_testers t
    where t.user_id = v_owner and t.enabled
  ) then raise exception 'staging tester access required' using errcode = '42501'; end if;
  if not exists (select 1 from public.wm_projects p where p.id = p_project_id and p.owner_id = v_owner) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.wm_offer_prices p
    where p.mode = 'test' and p.purpose = 'setup' and p.stripe_price_id = p_setup_price_id
      and p.active and p.unit_amount = 9900 and p.currency = 'gbp' and p.recurring_interval is null
  ) then raise exception 'unapproved Website Machine one-off test price' using errcode = '22023'; end if;
  if (p_domain is null) <> (p_domain_challenge is null) then
    raise exception 'incomplete domain proof' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
  select * into v_order from public.wm_orders where project_id = p_project_id for update;
  if found then
    if v_order.owner_id <> v_owner or v_order.mode <> 'test' or
       v_order.setup_price_id <> p_setup_price_id or v_order.monthly_price_id is not null or
       v_order.amount_total <> 9900 or v_order.currency <> 'gbp' or
       v_order.domain is distinct from p_domain or v_order.domain_challenge is distinct from p_domain_challenge then
      raise exception 'project already has a different Website Machine order' using errcode = '22023';
    end if;
    return next v_order;
    return;
  end if;

  select count(*) into v_recent_count
  from public.wm_orders
  where owner_id = v_owner and created_at >= now() - interval '1 hour';
  if v_recent_count >= 5 then raise exception 'Website Machine checkout rate limit exceeded' using errcode = 'P0001'; end if;

  insert into public.wm_orders(
    project_id, owner_id, idempotency_key, mode, setup_price_id,
    monthly_price_id, amount_total, domain, domain_challenge
  ) values (
    p_project_id, v_owner, v_expected_key, 'test', p_setup_price_id,
    null, 9900, p_domain, p_domain_challenge
  ) on conflict (project_id) do nothing returning * into v_order;

  if not found then
    select * into v_order from public.wm_orders where project_id = p_project_id for update;
    if v_order.owner_id <> v_owner or v_order.mode <> 'test' or
       v_order.setup_price_id <> p_setup_price_id or v_order.monthly_price_id is not null or
       v_order.amount_total <> 9900 or v_order.currency <> 'gbp' or
       v_order.domain is distinct from p_domain or v_order.domain_challenge is distinct from p_domain_challenge then
      raise exception 'project already has a different Website Machine order' using errcode = '22023';
    end if;
  end if;
  return next v_order;
end;
$$;

revoke all on function public.wm_create_checkout_order(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.wm_create_checkout_order(uuid, text, text, text, text, text, text) to authenticated;
