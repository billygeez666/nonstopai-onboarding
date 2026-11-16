-- Private, staging-only checkout authorization for designated synthetic testers.
-- No testers are seeded by this migration and no offer status is changed.
do $$
declare
  v_missing text[];
begin
  if to_regnamespace('wm_internal') is null or
     to_regprocedure('public.wm_create_checkout_order(uuid,text,text,text,text,text,text)') is null then
    raise exception 'Website Machine prerequisite missing: apply commerce migration 003/004 first';
  end if;
  if to_regclass('wm_internal.wm_staging_checkout_testers') is not null then
    select array_agg(required.column_name) into v_missing
    from unnest(array['user_id','enabled','created_at']) as required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'wm_internal'
        and c.table_name = 'wm_staging_checkout_testers'
        and c.column_name = required.column_name
    );
    if v_missing is not null then
      raise exception 'Incompatible partial tester allowlist table; missing columns: %', array_to_string(v_missing, ', ');
    end if;
  end if;
end;
$$;

create table if not exists wm_internal.wm_staging_checkout_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table wm_internal.wm_staging_checkout_testers enable row level security;
revoke all on table wm_internal.wm_staging_checkout_testers from public, anon, authenticated;
comment on table wm_internal.wm_staging_checkout_testers is
  'Admin-managed allowlist for staging-only Website Machine £99 sandbox checkout. Empty and disabled by default.';

create or replace function public.wm_is_staging_checkout_tester()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from wm_internal.wm_staging_checkout_testers t
    where t.user_id = auth.uid() and t.enabled
  );
$$;

revoke all on function public.wm_is_staging_checkout_tester() from public, anon, authenticated;
grant execute on function public.wm_is_staging_checkout_tester() to authenticated;

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

revoke all on function public.wm_create_checkout_order(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.wm_create_checkout_order(uuid, text, text, text, text, text, text) to authenticated;
