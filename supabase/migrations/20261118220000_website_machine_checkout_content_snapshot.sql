begin;

alter table public.wm_orders add column if not exists checkout_content jsonb;

create or replace function public.wm_create_checkout_order(
  p_project_id uuid, p_idempotency_key text, p_mode text, p_setup_price_id text,
  p_monthly_price_id text, p_domain text default null, p_domain_challenge text default null
)
returns setof public.wm_orders language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_order public.wm_orders; v_recent_count integer; v_expected_key text; v_content jsonb;
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_project_id is null or p_mode not in ('test','live') or p_monthly_price_id is not null then
    raise exception 'invalid one-off Website Machine order request' using errcode='22023';
  end if;
  v_expected_key := 'wm-project-' || v_owner::text || '-' || p_project_id::text;
  if p_idempotency_key is distinct from v_expected_key then raise exception 'invalid project checkout idempotency key' using errcode='22023'; end if;
  if p_mode='test' and not exists(select 1 from wm_internal.wm_staging_checkout_testers t where t.user_id=v_owner and t.enabled) then
    raise exception 'staging tester access required' using errcode='42501';
  end if;
  if not exists(select 1 from public.wm_projects p where p.id=p_project_id and p.owner_id=v_owner) then raise exception 'project not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.wm_offer_prices p where p.mode=p_mode and p.purpose='setup'
    and p.stripe_price_id=p_setup_price_id and p.active and p.unit_amount=9900 and p.currency='gbp' and p.recurring_interval is null) then
    if p_mode='live' then raise exception 'unapproved Website Machine one-off live price' using errcode='22023';
    else raise exception 'unapproved Website Machine one-off test price' using errcode='22023'; end if;
  end if;
  if (p_domain is null) <> (p_domain_challenge is null) then raise exception 'incomplete domain proof' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
  select * into v_order from public.wm_orders where project_id=p_project_id for update;
  if found then
    if v_order.owner_id<>v_owner or v_order.mode<>p_mode or v_order.setup_price_id<>p_setup_price_id or v_order.monthly_price_id is not null or
       v_order.amount_total<>9900 or v_order.currency<>'gbp' or v_order.domain is distinct from p_domain or v_order.domain_challenge is distinct from p_domain_challenge then
      raise exception 'project already has a different Website Machine order' using errcode='22023';
    end if;
    return next v_order; return;
  end if;
  select count(*) into v_recent_count from public.wm_orders where owner_id=v_owner and created_at>=now()-interval '1 hour';
  if v_recent_count>=5 then raise exception 'Website Machine checkout rate limit exceeded' using errcode='P0001'; end if;
  -- Row lock serializes the snapshot with owner edits to this project.
  select p.content into strict v_content from public.wm_projects p
    where p.id=p_project_id and p.owner_id=v_owner for share;
  insert into public.wm_orders(project_id,owner_id,idempotency_key,mode,setup_price_id,monthly_price_id,amount_total,domain,domain_challenge,checkout_content)
  values(p_project_id,v_owner,v_expected_key,p_mode,p_setup_price_id,null,9900,p_domain,p_domain_challenge,v_content)
  on conflict(project_id) do nothing returning * into v_order;
  if not found then
    select * into v_order from public.wm_orders where project_id=p_project_id for update;
    if v_order.owner_id<>v_owner or v_order.mode<>p_mode or v_order.setup_price_id<>p_setup_price_id or v_order.monthly_price_id is not null or
       v_order.amount_total<>9900 or v_order.currency<>'gbp' or v_order.domain is distinct from p_domain or v_order.domain_challenge is distinct from p_domain_challenge then
      raise exception 'project already has a different Website Machine order' using errcode='22023';
    end if;
  end if;
  return next v_order;
end;
$$;

create or replace function public.wm_get_payment_order(p_order_id uuid,p_mode text,p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.wm_orders; v_project public.wm_projects;
begin
  if p_mode not in ('test','live') or not wm_internal.verify_hmac(p_mode||E'\nget_order:'||p_order_id::text,p_signature) then raise exception 'unauthorized' using errcode='42501'; end if;
  select * into v_order from public.wm_orders where id=p_order_id;
  if not found or v_order.mode<>p_mode then return null; end if;
  if v_order.checkout_content is null then
    select * into v_project from public.wm_projects where id=v_order.project_id and owner_id=v_order.owner_id;
  end if;
  return jsonb_build_object('id',v_order.id,'projectId',v_order.project_id,'ownerId',v_order.owner_id,'mode',v_order.mode,
    'setupPriceId',v_order.setup_price_id,'monthlyPriceId',v_order.monthly_price_id,'amountTotal',v_order.amount_total,'currency',v_order.currency,
    'checkoutSessionId',v_order.checkout_session_id,'status',v_order.status,'domain',v_order.domain,'domainChallenge',v_order.domain_challenge,
    'content',coalesce(v_order.checkout_content,v_project.content),'siteRecord',(select jsonb_build_object('project_id',s.project_id,'owner_id',s.owner_id,'site_id',s.site_id,
      'site_name',s.site_name,'custom_domain',s.custom_domain,'current_deploy_id',s.current_deploy_id,'previous_deploy_ids',s.previous_deploy_ids,
      'site_url',s.site_url) from public.wm_customer_sites s where s.project_id=v_order.project_id));
end;
$$;

commit;
