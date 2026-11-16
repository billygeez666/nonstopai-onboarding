-- Website Machine-only commerce and publishing records. No existing CRM,
-- booking, onboarding, Stripe, or customer-site records are altered.
create schema if not exists wm_internal;
revoke all on schema wm_internal from public, anon, authenticated;

create table if not exists public.wm_offer_prices (
  mode text not null check (mode in ('test', 'live')),
  purpose text not null check (purpose in ('setup', 'monthly')),
  stripe_price_id text not null unique,
  product_id text not null,
  unit_amount integer not null,
  currency text not null check (currency = 'gbp'),
  recurring_interval text,
  active boolean not null default true,
  primary key (mode, purpose),
  check ((purpose = 'setup' and recurring_interval is null) or (purpose = 'monthly' and recurring_interval = 'month'))
);

insert into public.wm_offer_prices(mode, purpose, stripe_price_id, product_id, unit_amount, currency, recurring_interval)
values
  ('live', 'setup', 'price_1TtvtMEWP0eV3Fnn3Gd8ltId', 'prod_UtjLRCAGcavRsu', 19900, 'gbp', null),
  ('live', 'monthly', 'price_1TtvtQEWP0eV3FnnCAi7Z9Ko', 'prod_UtjLmED608iIqv', 5000, 'gbp', 'month'),
  ('test', 'setup', 'price_1UcLidEWP0eV3Fnn0GpGUYiT', 'prod_Vdcy4n9IxffrUl', 19900, 'gbp', null),
  ('test', 'monthly', 'price_1UcLjSEWP0eV3FnnWKkhUtDA', 'prod_VdczjddIDXtY1H', 5000, 'gbp', 'month')
on conflict (mode, purpose) do update set
  stripe_price_id = excluded.stripe_price_id,
  product_id = excluded.product_id,
  unit_amount = excluded.unit_amount,
  currency = excluded.currency,
  recurring_interval = excluded.recurring_interval,
  active = true;

create table if not exists public.wm_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.wm_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (length(idempotency_key) between 12 and 100),
  mode text not null check (mode in ('test', 'live')),
  setup_price_id text not null,
  monthly_price_id text not null,
  amount_total integer not null default 24900 check (amount_total = 24900),
  currency text not null default 'gbp' check (currency = 'gbp'),
  domain text,
  domain_challenge text,
  checkout_session_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'delivering', 'delivered', 'failed')),
  paid_event_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, idempotency_key)
);

create table if not exists public.wm_payment_events (
  event_id text primary key,
  order_id uuid not null references public.wm_orders(id) on delete cascade,
  checkout_session_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wm_customer_sites (
  project_id uuid primary key references public.wm_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  site_id text not null unique,
  site_name text not null unique,
  custom_domain text,
  current_deploy_id text,
  previous_deploy_ids text[] not null default '{}',
  site_url text not null,
  verified_deploy_url text,
  status text not null default 'provisioning' check (status in ('provisioning', 'delivered', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function wm_internal.verify_hmac(p_message text, p_signature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from vault.decrypted_secrets as s
    where s.name = case split_part(p_message, E'\n', 1)
      when 'test' then 'wm_payment_rpc_secret_staging'
      when 'live' then 'wm_payment_rpc_secret_production'
      else null
    end
      and p_signature ~ '^[0-9a-f]{64}$'
      and encode(extensions.hmac(convert_to(p_message, 'utf8'), convert_to(s.decrypted_secret, 'utf8'), 'sha256'), 'hex') = p_signature
  );
$$;
revoke all on function wm_internal.verify_hmac(text, text) from public, anon, authenticated;

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
  if p_mode not in ('test', 'live') or length(p_idempotency_key) not between 12 and 100 then raise exception 'invalid order request' using errcode = '22023'; end if;
  if not exists (select 1 from public.wm_projects p where p.id = p_project_id and p.owner_id = v_owner) then raise exception 'project not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.wm_offer_prices p where p.mode = p_mode and p.purpose = 'setup' and p.stripe_price_id = p_setup_price_id and p.active and p.unit_amount = 19900 and p.currency = 'gbp' and p.recurring_interval is null)
     or not exists (select 1 from public.wm_offer_prices p where p.mode = p_mode and p.purpose = 'monthly' and p.stripe_price_id = p_monthly_price_id and p.active and p.unit_amount = 5000 and p.currency = 'gbp' and p.recurring_interval = 'month') then
    raise exception 'unapproved Website Machine price' using errcode = '22023';
  end if;
  if (p_domain is null) <> (p_domain_challenge is null) then raise exception 'incomplete domain proof' using errcode = '22023'; end if;
  select * into v_order from public.wm_orders where owner_id = v_owner and idempotency_key = p_idempotency_key;
  if found then return next v_order; return; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text, 0));
  select * into v_order from public.wm_orders where owner_id = v_owner and idempotency_key = p_idempotency_key;
  if found then return next v_order; return; end if;
  select count(*) into v_recent_count from public.wm_orders where owner_id = v_owner and created_at >= now() - interval '1 hour';
  if v_recent_count >= 5 then raise exception 'Website Machine checkout rate limit exceeded' using errcode = 'P0001'; end if;
  insert into public.wm_orders(project_id, owner_id, idempotency_key, mode, setup_price_id, monthly_price_id, domain, domain_challenge)
    values (p_project_id, v_owner, p_idempotency_key, p_mode, p_setup_price_id, p_monthly_price_id, p_domain, p_domain_challenge)
    on conflict (owner_id, idempotency_key) do nothing returning * into v_order;
  if not found then select * into v_order from public.wm_orders where owner_id = v_owner and idempotency_key = p_idempotency_key; end if;
  return next v_order;
end;
$$;

create or replace function public.wm_attach_checkout_session(p_order_id uuid, p_session_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null or p_session_id !~ '^(cs_test_|cs_live_)[A-Za-z0-9_]{8,}$' then return false; end if;
  update public.wm_orders set checkout_session_id = p_session_id, updated_at = now()
    where id = p_order_id and owner_id = v_owner and status = 'pending' and (checkout_session_id is null or checkout_session_id = p_session_id);
  return found;
end;
$$;

create or replace function public.wm_get_payment_order(p_order_id uuid, p_mode text, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.wm_orders; v_project public.wm_projects;
begin
  if p_mode not in ('test', 'live') or not wm_internal.verify_hmac(p_mode || E'\nget_order:' || p_order_id::text, p_signature) then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into v_order from public.wm_orders where id = p_order_id;
  if not found or v_order.mode <> p_mode then return null; end if;
  select * into v_project from public.wm_projects where id = v_order.project_id;
  return jsonb_build_object(
    'id', v_order.id, 'projectId', v_order.project_id, 'ownerId', v_order.owner_id, 'mode', v_order.mode,
    'setupPriceId', v_order.setup_price_id, 'monthlyPriceId', v_order.monthly_price_id,
    'amountTotal', v_order.amount_total, 'currency', v_order.currency,
    'checkoutSessionId', v_order.checkout_session_id, 'status', v_order.status,
    'domain', v_order.domain, 'domainChallenge', v_order.domain_challenge,
    'content', v_project.content,
    'siteRecord', (select jsonb_build_object('project_id', s.project_id, 'owner_id', s.owner_id, 'site_id', s.site_id, 'site_name', s.site_name, 'custom_domain', s.custom_domain, 'current_deploy_id', s.current_deploy_id, 'previous_deploy_ids', s.previous_deploy_ids) from public.wm_customer_sites s where s.project_id = v_order.project_id)
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
  if v_order.mode <> p_mode or v_order.project_id <> p_project_id or v_order.checkout_session_id <> p_session_id or v_order.amount_total <> p_amount_total or v_order.currency <> lower(p_currency) then raise exception 'payment does not match order' using errcode = '22023'; end if;
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

create or replace function public.wm_reserve_customer_site(p_project_id uuid, p_owner_id uuid, p_mode text, p_site_id text, p_site_name text, p_custom_domain text, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_message text; v_site public.wm_customer_sites;
begin
  v_message := p_mode || E'\n' || p_project_id::text || E'\n' || p_owner_id::text || E'\n' || p_site_id || E'\n' || p_site_name || E'\n' || coalesce(p_custom_domain, '');
  if not wm_internal.verify_hmac(v_message, p_signature) then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_site_name <> ('wm-' || replace(p_project_id::text, '-', '')) then raise exception 'invalid isolated site name' using errcode = '22023'; end if;
  if p_mode not in ('test', 'live') or not exists (select 1 from public.wm_orders o where o.project_id = p_project_id and o.owner_id = p_owner_id and o.mode = p_mode and o.status in ('paid', 'delivering', 'delivered', 'failed') and o.domain is not distinct from p_custom_domain) then raise exception 'paid order required' using errcode = '42501'; end if;
  insert into public.wm_customer_sites(project_id, owner_id, site_id, site_name, custom_domain, site_url)
    values (p_project_id, p_owner_id, p_site_id, p_site_name, p_custom_domain, 'https://' || p_site_name || '.netlify.app')
    on conflict (project_id) do update set updated_at = now()
    where public.wm_customer_sites.site_id = excluded.site_id and public.wm_customer_sites.site_name = excluded.site_name and public.wm_customer_sites.owner_id = excluded.owner_id
    returning * into v_site;
  if not found then raise exception 'site idempotency conflict' using errcode = '23505'; end if;
  return jsonb_build_object('siteId', v_site.site_id, 'siteName', v_site.site_name, 'projectId', v_site.project_id, 'ownerId', v_site.owner_id, 'customDomain', v_site.custom_domain, 'siteUrl', v_site.site_url, 'previousDeployIds', v_site.previous_deploy_ids);
end;
$$;

create or replace function public.wm_record_customer_deployment(p_project_id uuid, p_owner_id uuid, p_mode text, p_deploy_id text, p_previous_deploy_id text, p_site_url text, p_verified_deploy_url text, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_message text; v_site public.wm_customer_sites;
begin
  v_message := p_mode || E'\n' || p_project_id::text || E'\n' || p_owner_id::text || E'\n' || p_deploy_id || E'\n' || coalesce(p_previous_deploy_id, '') || E'\n' || p_site_url || E'\n' || p_verified_deploy_url;
  if not wm_internal.verify_hmac(v_message, p_signature) then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_mode not in ('test', 'live') then raise exception 'invalid payment mode' using errcode = '22023'; end if;
  update public.wm_customer_sites set
    previous_deploy_ids = case when current_deploy_id is not null and current_deploy_id <> p_deploy_id then array_prepend(current_deploy_id, previous_deploy_ids) else previous_deploy_ids end,
    current_deploy_id = p_deploy_id, site_url = p_site_url, verified_deploy_url = p_verified_deploy_url, status = 'delivered', updated_at = now()
    where project_id = p_project_id and owner_id = p_owner_id returning * into v_site;
  if not found then raise exception 'customer site record not found' using errcode = 'P0002'; end if;
  update public.wm_orders set status = 'delivered', updated_at = now() where project_id = p_project_id and owner_id = p_owner_id and status in ('paid', 'delivering', 'delivered', 'failed');
  return jsonb_build_object('siteId', v_site.site_id, 'siteName', v_site.site_name, 'projectId', v_site.project_id, 'ownerId', v_site.owner_id, 'customDomain', v_site.custom_domain, 'siteUrl', v_site.site_url, 'deployId', v_site.current_deploy_id, 'previousDeployIds', v_site.previous_deploy_ids, 'status', v_site.status);
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
