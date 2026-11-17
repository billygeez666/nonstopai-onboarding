-- Reuse the already-existing active £99 GBP live Website Machine Starter
-- price. Keep the offer inactive; the test-only RPC still rejects live mode.
do $$
declare
  v_setup_count integer;
begin
  select count(*) into v_setup_count
  from public.wm_offer_prices
  where mode = 'live' and purpose = 'setup';
  if v_setup_count <> 1 then
    raise exception 'Expected exactly one existing live Website Machine setup offer row';
  end if;
  if exists (select 1 from public.wm_orders where mode = 'live') then
    raise exception 'Live Website Machine orders exist; inspect them before changing the inactive setup mapping';
  end if;
  if exists (
    select 1 from public.wm_offer_prices
    where stripe_price_id = 'price_1TtvtIEWP0eV3FnnXUMIwPwG'
      and not (mode = 'live' and purpose = 'setup')
  ) then
    raise exception 'The verified live Starter Website price is already mapped to another offer';
  end if;
end;
$$;

update public.wm_offer_prices
set stripe_price_id = 'price_1TtvtIEWP0eV3FnnXUMIwPwG',
    product_id = 'prod_UtjLC5f9iSAD94',
    unit_amount = 9900,
    currency = 'gbp',
    recurring_interval = null,
    active = false
where mode = 'live' and purpose = 'setup';
