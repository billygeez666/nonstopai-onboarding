-- Track Website Machine customer email acceptance independently from site
-- publication. No payment, offer, checkout, or customer-site rows are deleted.
-- Unknown legacy delivery outcomes are deliberately not retried automatically.

do $$
declare v_missing text[];
begin
  if to_regclass('public.wm_orders') is null or to_regclass('public.wm_customer_sites') is null or
     to_regnamespace('wm_internal') is null or to_regprocedure('wm_internal.verify_hmac(text,text)') is null then
    raise exception 'Website Machine commerce migrations and HMAC verifier must be applied first';
  end if;
  if to_regclass('public.wm_delivery_emails') is not null then
    select array_agg(required.column_name) into v_missing
    from unnest(array['order_id','status','attempt_count','attempt_id','attempt_started_at','lease_expires_at','accepted_at','failed_at','unknown_at','provider_message_id','error_code','created_at','updated_at']) as required(column_name)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name='wm_delivery_emails' and c.column_name=required.column_name
    );
    if v_missing is not null then
      raise exception 'Incompatible partial Website Machine email table; missing columns: %', array_to_string(v_missing, ', ');
    end if;
  end if;
end;
$$;

create table if not exists public.wm_delivery_emails (
  order_id uuid primary key references public.wm_orders(id) on delete cascade,
  status text not null check (status in ('pending','accepted','failed','unknown')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  attempt_id uuid,
  attempt_started_at timestamptz,
  lease_expires_at timestamptz,
  accepted_at timestamptz,
  failed_at timestamptz,
  unknown_at timestamptz,
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wm_delivery_emails enable row level security;
revoke all on public.wm_delivery_emails from public, anon, authenticated;
revoke all on public.wm_delivery_emails from service_role;

-- Previous deployments had no email receipt record. Preserve their site records,
-- but stop representing customer delivery as complete until provider acceptance
-- can be established. These entries require reconciliation and will not send.
insert into public.wm_delivery_emails(order_id, status, unknown_at, error_code)
select o.id, 'unknown', coalesce(o.updated_at, o.paid_at, o.created_at), 'LEGACY_EMAIL_OUTCOME_UNVERIFIED'
from public.wm_orders o
where o.status = 'delivered'
on conflict (order_id) do nothing;

update public.wm_orders o set status='delivering', updated_at=now()
where o.status='delivered'
  and exists (select 1 from public.wm_delivery_emails e where e.order_id=o.id and e.status <> 'accepted');

-- A deployment means the website is live. It no longer claims that its separate
-- delivery email was accepted.
create or replace function public.wm_record_customer_deployment(
  p_project_id uuid, p_owner_id uuid, p_mode text, p_deploy_id text,
  p_previous_deploy_id text, p_site_url text, p_verified_deploy_url text, p_signature text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_message text; v_site public.wm_customer_sites;
begin
  v_message := p_mode || E'\n' || p_project_id::text || E'\n' || p_owner_id::text || E'\n' || p_deploy_id || E'\n' || coalesce(p_previous_deploy_id, '') || E'\n' || p_site_url || E'\n' || p_verified_deploy_url;
  if not wm_internal.verify_hmac(v_message, p_signature) then raise exception 'unauthorized' using errcode='42501'; end if;
  if p_mode is distinct from 'test' then raise exception 'live payment fulfillment is disabled' using errcode='22023'; end if;
  update public.wm_customer_sites set
    previous_deploy_ids = case when current_deploy_id is not null and current_deploy_id <> p_deploy_id then array_prepend(current_deploy_id, previous_deploy_ids) else previous_deploy_ids end,
    current_deploy_id=p_deploy_id, site_url=p_site_url, verified_deploy_url=p_verified_deploy_url,
    status='delivered', updated_at=now()
  where project_id=p_project_id and owner_id=p_owner_id returning * into v_site;
  if not found then raise exception 'customer site record not found' using errcode='P0002'; end if;
  update public.wm_orders set status='delivering', updated_at=now()
  where project_id=p_project_id and owner_id=p_owner_id and status in ('paid','delivering','delivered','failed');
  return jsonb_build_object('siteId',v_site.site_id,'siteName',v_site.site_name,'projectId',v_site.project_id,'ownerId',v_site.owner_id,'customDomain',v_site.custom_domain,'siteUrl',v_site.site_url,'deployId',v_site.current_deploy_id,'previousDeployIds',v_site.previous_deploy_ids,'status',v_site.status);
end;
$$;

create or replace function public.wm_claim_delivery_email(p_order_id uuid, p_mode text, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.wm_orders; v_delivery public.wm_delivery_emails; v_attempt uuid;
begin
  if p_mode is distinct from 'test' or not wm_internal.verify_hmac(p_mode || E'\nclaim_delivery_email:' || p_order_id::text, p_signature) then
    raise exception 'unauthorized' using errcode='42501';
  end if;
  select * into v_order from public.wm_orders where id=p_order_id for update;
  if not found or v_order.mode <> 'test' or v_order.paid_at is null or v_order.status not in ('delivering','delivered') then
    raise exception 'paid Website Machine order required' using errcode='42501';
  end if;
  if not exists(select 1 from public.wm_customer_sites s where s.project_id=v_order.project_id and s.owner_id=v_order.owner_id and s.status='delivered' and s.site_url like 'https://%') then
    raise exception 'verified published customer website required' using errcode='42501';
  end if;
  v_attempt := gen_random_uuid();
  insert into public.wm_delivery_emails(order_id,status,attempt_count,attempt_id,attempt_started_at,lease_expires_at)
    values(p_order_id,'pending',1,v_attempt,now(),now()+interval '5 minutes')
    on conflict(order_id) do nothing;
  if found then return jsonb_build_object('status','pending','shouldSend',true,'attemptId',v_attempt); end if;

  select * into v_delivery from public.wm_delivery_emails where order_id=p_order_id for update;
  if v_delivery.status='accepted' then return jsonb_build_object('status','accepted','shouldSend',false); end if;
  if v_delivery.status='unknown' then return jsonb_build_object('status','unknown','shouldSend',false); end if;
  if v_delivery.status='pending' then
    if v_delivery.lease_expires_at > now() then return jsonb_build_object('status','pending','shouldSend',false); end if;
    update public.wm_delivery_emails set status='unknown', unknown_at=now(), error_code='DELIVERY_ATTEMPT_LEASE_EXPIRED', updated_at=now()
      where order_id=p_order_id and status='pending';
    return jsonb_build_object('status','unknown','shouldSend',false);
  end if;
  if v_delivery.status='failed' then
    v_attempt := gen_random_uuid();
    update public.wm_delivery_emails set status='pending', attempt_count=attempt_count+1, attempt_id=v_attempt,
      attempt_started_at=now(), lease_expires_at=now()+interval '5 minutes', failed_at=null, error_code=null, updated_at=now()
      where order_id=p_order_id;
    return jsonb_build_object('status','pending','shouldSend',true,'attemptId',v_attempt);
  end if;
  return jsonb_build_object('status',v_delivery.status,'shouldSend',false);
end;
$$;

create or replace function public.wm_finish_delivery_email(
  p_order_id uuid, p_mode text, p_attempt_id uuid, p_outcome text,
  p_provider_message_id text, p_error_code text, p_signature text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_message text; v_updated uuid;
begin
  v_message := p_mode || E'\n' || p_order_id::text || E'\n' || p_attempt_id::text || E'\n' || p_outcome || E'\n' || coalesce(p_provider_message_id,'') || E'\n' || coalesce(p_error_code,'');
  if p_mode is distinct from 'test' or p_outcome not in ('accepted','failed','unknown') or
     (p_provider_message_id is not null and p_provider_message_id !~ '^[A-Za-z0-9_-]{1,200}$') or
     (p_error_code is not null and p_error_code !~ '^[A-Z0-9_]{1,80}$') or
     not wm_internal.verify_hmac(v_message,p_signature) then
    raise exception 'unauthorized or invalid email delivery result' using errcode='42501';
  end if;
  update public.wm_delivery_emails set status=p_outcome,
    accepted_at=case when p_outcome='accepted' then now() else accepted_at end,
    failed_at=case when p_outcome='failed' then now() else failed_at end,
    unknown_at=case when p_outcome='unknown' then now() else unknown_at end,
    provider_message_id=case when p_outcome='accepted' then p_provider_message_id else provider_message_id end,
    error_code=case when p_outcome='accepted' then null else p_error_code end,
    attempt_id=case when p_outcome='failed' then null else attempt_id end,
    lease_expires_at=null, updated_at=now()
  where order_id=p_order_id and attempt_id=p_attempt_id and status in ('pending','unknown')
  returning order_id into v_updated;
  if v_updated is null then return false; end if;
  if p_outcome='accepted' then
    update public.wm_orders o set status='delivered', updated_at=now()
    where o.id=p_order_id and o.mode='test' and o.paid_at is not null and exists(
      select 1 from public.wm_customer_sites s where s.project_id=o.project_id and s.owner_id=o.owner_id and s.status='delivered'
    );
    if not found then raise exception 'published site and paid order are required' using errcode='23514'; end if;
  end if;
  return true;
end;
$$;

revoke all on function public.wm_claim_delivery_email(uuid,text,text) from public, anon, authenticated;
revoke all on function public.wm_finish_delivery_email(uuid,text,uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.wm_record_customer_deployment(uuid,uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.wm_claim_delivery_email(uuid,text,text) to anon;
grant execute on function public.wm_finish_delivery_email(uuid,text,uuid,text,text,text,text) to anon;
grant execute on function public.wm_record_customer_deployment(uuid,uuid,text,text,text,text,text,text) to anon;
