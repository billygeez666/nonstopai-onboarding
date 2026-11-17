-- One-time, order-scoped recovery for the legacy Website Machine email whose
-- provider outcome is unknown. The original unknown state is copied to an
-- immutable recovery audit row before the aggregate email status is advanced.

do $$
declare v_missing text[];
begin
  if to_regclass('public.wm_orders') is null or to_regclass('public.wm_customer_sites') is null
     or to_regclass('public.wm_delivery_emails') is null
     or to_regprocedure('wm_internal.verify_hmac(text,text)') is null then
    raise exception 'Website Machine order, site, email tracking, and HMAC objects must exist first';
  end if;
  if to_regclass('public.wm_delivery_email_recoveries') is not null then
    select array_agg(required.column_name) into v_missing
    from unnest(array['order_id','attempt_id','owner_id','recipient','prior_status','prior_error_code','prior_unknown_at','prior_updated_at','status','claimed_at','accepted_at','failed_at','unknown_at','provider_message_id','error_code','updated_at']) required(column_name)
    where not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='wm_delivery_email_recoveries' and c.column_name=required.column_name);
    if v_missing is not null then raise exception 'Incompatible partial recovery table; missing columns: %',array_to_string(v_missing,', '); end if;
  end if;
end;
$$;

create table if not exists public.wm_delivery_email_recoveries (
  order_id uuid primary key references public.wm_orders(id),
  attempt_id uuid not null unique,
  owner_id uuid not null,
  recipient text not null,
  prior_status text not null check (prior_status = 'unknown'),
  prior_error_code text,
  prior_unknown_at timestamptz,
  prior_updated_at timestamptz,
  status text not null check (status in ('pending','accepted','failed','unknown')),
  claimed_at timestamptz not null default now(),
  accepted_at timestamptz,
  failed_at timestamptz,
  unknown_at timestamptz,
  provider_message_id text,
  error_code text,
  updated_at timestamptz not null default now(),
  check (recipient ~ '^[^[:space:]@<>"'']+@[^[:space:]@<>"'']+\.[^[:space:]@<>"'']{2,}$')
);

alter table public.wm_delivery_email_recoveries enable row level security;
revoke all on public.wm_delivery_email_recoveries from public, anon, authenticated, service_role;

create or replace function public.wm_claim_one_time_email_recovery(
  p_order_id uuid, p_owner_id uuid, p_recipient text, p_mode text, p_signature text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.wm_orders;
  v_email public.wm_delivery_emails;
  v_attempt uuid := gen_random_uuid();
  v_message text;
begin
  v_message := p_mode || E'\nclaim_one_time_email_recovery\n' || p_order_id::text || E'\n' || p_owner_id::text || E'\n' || lower(btrim(p_recipient));
  if p_mode is distinct from 'test'
     or p_order_id is distinct from '38bdba88-0905-4045-8f46-0c83d349adfb'::uuid
     or p_recipient !~ '^[^[:space:]@<>"'']+@[^[:space:]@<>"'']+\.[^[:space:]@<>"'']{2,}$'
     or not wm_internal.verify_hmac(v_message, p_signature) then
    raise exception 'unauthorized or invalid one-time email recovery' using errcode='42501';
  end if;

  select * into v_order from public.wm_orders where id=p_order_id for update;
  if not found or v_order.owner_id <> p_owner_id or v_order.mode <> 'test'
     or v_order.status <> 'delivering' or v_order.paid_at is null
     or v_order.amount_total <> 9900 or v_order.currency <> 'gbp' then
    raise exception 'eligible paid test order required' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.wm_customer_sites s
    where s.project_id=v_order.project_id and s.owner_id=v_order.owner_id
      and s.status='delivered' and s.site_url like 'https://%'
  ) then raise exception 'verified published customer website required' using errcode='42501'; end if;

  select * into v_email from public.wm_delivery_emails where order_id=p_order_id for update;
  if not found or v_email.status <> 'unknown' or v_email.error_code <> 'LEGACY_EMAIL_OUTCOME_UNVERIFIED'
     or v_email.attempt_count <> 0 or v_email.attempt_id is not null then
    return jsonb_build_object('shouldSend',false,'status',coalesce(v_email.status,'missing'));
  end if;

  insert into public.wm_delivery_email_recoveries(
    order_id,attempt_id,owner_id,recipient,prior_status,prior_error_code,prior_unknown_at,prior_updated_at,status
  ) values (
    p_order_id,v_attempt,p_owner_id,lower(btrim(p_recipient)),v_email.status,v_email.error_code,v_email.unknown_at,v_email.updated_at,'pending'
  ) on conflict(order_id) do nothing;
  if not found then return jsonb_build_object('shouldSend',false,'status','recovery_already_claimed'); end if;

  update public.wm_delivery_emails set status='pending',attempt_count=1,attempt_id=v_attempt,
    attempt_started_at=now(),lease_expires_at=now()+interval '5 minutes',failed_at=null,
    error_code=null,updated_at=now()
    where order_id=p_order_id and status='unknown' and attempt_count=0;
  if not found then raise exception 'email recovery claim conflict' using errcode='40001'; end if;
  return jsonb_build_object('shouldSend',true,'status','pending','attemptId',v_attempt,'recipient',lower(btrim(p_recipient)));
end;
$$;

create or replace function public.wm_finish_one_time_email_recovery(
  p_order_id uuid, p_mode text, p_attempt_id uuid, p_outcome text,
  p_provider_message_id text, p_error_code text, p_signature text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_message text;
  v_updated uuid;
begin
  v_message := p_mode || E'\nfinish_one_time_email_recovery\n' || p_order_id::text || E'\n' || p_attempt_id::text || E'\n' || p_outcome || E'\n' || coalesce(p_provider_message_id,'') || E'\n' || coalesce(p_error_code,'');
  if p_mode is distinct from 'test' or p_order_id is distinct from '38bdba88-0905-4045-8f46-0c83d349adfb'::uuid
     or p_outcome not in ('accepted','failed','unknown')
     or (p_provider_message_id is not null and p_provider_message_id !~ '^[A-Za-z0-9_-]{1,200}$')
     or (p_error_code is not null and p_error_code !~ '^[A-Z0-9_]{1,80}$')
     or not wm_internal.verify_hmac(v_message,p_signature) then
    raise exception 'unauthorized or invalid email recovery result' using errcode='42501';
  end if;

  update public.wm_delivery_email_recoveries set status=p_outcome,
    accepted_at=case when p_outcome='accepted' then now() else accepted_at end,
    failed_at=case when p_outcome='failed' then now() else failed_at end,
    unknown_at=case when p_outcome='unknown' then now() else unknown_at end,
    provider_message_id=case when p_outcome='accepted' then p_provider_message_id else provider_message_id end,
    error_code=case when p_outcome='accepted' then null else p_error_code end,updated_at=now()
    where order_id=p_order_id and attempt_id=p_attempt_id and status='pending'
    returning order_id into v_updated;
  if v_updated is null then return false; end if;

  update public.wm_delivery_emails set status=p_outcome,
    accepted_at=case when p_outcome='accepted' then now() else accepted_at end,
    failed_at=case when p_outcome='failed' then now() else failed_at end,
    unknown_at=case when p_outcome='unknown' then now() else unknown_at end,
    provider_message_id=case when p_outcome='accepted' then p_provider_message_id else provider_message_id end,
    error_code=case when p_outcome='accepted' then null else p_error_code end,
    lease_expires_at=null,updated_at=now()
    where order_id=p_order_id and attempt_id=p_attempt_id and status in ('pending','unknown')
    returning order_id into v_updated;
  if v_updated is null then raise exception 'email tracking claim changed unexpectedly' using errcode='40001'; end if;

  if p_outcome='accepted' then
    update public.wm_orders set status='delivered',updated_at=now()
      where id=p_order_id and mode='test' and status='delivering' and paid_at is not null
        and exists(select 1 from public.wm_customer_sites s where s.project_id=wm_orders.project_id and s.owner_id=wm_orders.owner_id and s.status='delivered');
    if not found then raise exception 'paid order with published website required' using errcode='23514'; end if;
  end if;
  return true;
end;
$$;

revoke all on function public.wm_claim_one_time_email_recovery(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.wm_finish_one_time_email_recovery(uuid,text,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.wm_claim_one_time_email_recovery(uuid,uuid,text,text,text) to anon;
grant execute on function public.wm_finish_one_time_email_recovery(uuid,text,uuid,text,text,text,text) to anon;
