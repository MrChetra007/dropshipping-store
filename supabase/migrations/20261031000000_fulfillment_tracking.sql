-- Non-destructive migration for databases that already ran the original
-- schema.sql. It adds the step 8 fulfillment RPCs and the step 9 tracking
-- changes without dropping or recreating existing tables.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------
-- Step 9: remember whether the shipped email was already sent.
-- ---------------------------------------------------------------------
alter table public.shipments
  add column if not exists notified_at timestamptz;

-- Drop any earlier version of these functions so a changed signature cannot
-- leave an old overload behind. No other objects depend on them.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'claim_supplier_order',
         'mark_supplier_order_submitted',
         'apply_supplier_order_update'
       )
  loop
    execute format(
      'drop function %I.%I(%s) cascade',
      r.schema_name,
      r.function_name,
      r.args
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Step 8: claim one specific queued supplier order (post-payment kick).
-- ---------------------------------------------------------------------
create or replace function public.claim_supplier_order(p_id uuid)
returns public.supplier_orders
language sql security definer set search_path = public as $$
  update public.supplier_orders s
     set attempts = s.attempts + 1,
         next_attempt_at = now() + interval '10 minutes',
         updated_at = now()
   where s.id = p_id
     and s.status = 'queued'
     and s.next_attempt_at <= now()
  returning s.*;
$$;

-- ---------------------------------------------------------------------
-- Step 8: atomic success transition for a submitted CJ order.
-- ---------------------------------------------------------------------
create or replace function public.mark_supplier_order_submitted(
  p_supplier_order_id uuid,
  p_cj_order_id        text,
  p_shipping_method    text,
  p_supplier_cost      numeric,
  p_request            jsonb,
  p_response           jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
begin
  update public.supplier_orders
     set supplier_order_id = p_cj_order_id,
         status = 'submitted',
         shipping_method = coalesce(p_shipping_method, shipping_method),
         supplier_cost_total = coalesce(p_supplier_cost, supplier_cost_total),
         request = coalesce(p_request, request),
         response = coalesce(p_response, response),
         error = null,
         next_attempt_at = now(),
         updated_at = now()
   where id = p_supplier_order_id
   returning order_id into v_order_id;

  if v_order_id is null then
    raise exception 'supplier order % not found', p_supplier_order_id;
  end if;

  update public.orders
     set fulfillment_status = 'submitted'
   where id = v_order_id;

  insert into public.order_events (order_id, type, message, is_public)
  select v_order_id, 'fulfillment_submitted', 'Order sent to warehouse', true
  where not exists (
    select 1 from public.order_events
     where order_id = v_order_id and type = 'fulfillment_submitted'
  );
end $$;

-- ---------------------------------------------------------------------
-- Step 9: apply one CJ tracking poll result atomically.
-- ---------------------------------------------------------------------
create or replace function public.apply_supplier_order_update(
  p_order_id          uuid,
  p_supplier_order_id uuid,
  p_carrier           text,
  p_tracking_number   text,
  p_tracking_url      text,
  p_shipment_status   text,
  p_supplier_status   public.supplier_order_status,
  p_order_status      public.order_status,
  p_fulfillment_status public.fulfillment_status,
  p_event_type        text,
  p_event_message     text
) returns table (shipment_id uuid, should_notify boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_shipment_id uuid;
  v_notified_at timestamptz;
begin
  if p_tracking_number is not null then
    insert into public.shipments (
      order_id, supplier_order_id, carrier, tracking_number, tracking_url,
      status, shipped_at
    )
    values (
      p_order_id, p_supplier_order_id, p_carrier, p_tracking_number,
      p_tracking_url, coalesce(p_shipment_status, 'in_transit'), now()
    )
    on conflict (order_id, tracking_number) do update
      set supplier_order_id = coalesce(excluded.supplier_order_id, public.shipments.supplier_order_id),
          carrier           = coalesce(excluded.carrier, public.shipments.carrier),
          tracking_url      = coalesce(excluded.tracking_url, public.shipments.tracking_url),
          status            = excluded.status,
          delivered_at      = case
                                when excluded.status = 'delivered'
                                  then coalesce(public.shipments.delivered_at, now())
                                else public.shipments.delivered_at
                              end,
          updated_at        = now()
    returning id, notified_at into v_shipment_id, v_notified_at;
  end if;

  update public.supplier_orders
     set status = p_supplier_status,
         updated_at = now()
   where id = p_supplier_order_id
     and status not in ('delivered', 'cancelled');

  update public.orders
     set status = coalesce(p_order_status, status),
         fulfillment_status = coalesce(p_fulfillment_status, fulfillment_status),
         updated_at = now()
   where id = p_order_id
     and status not in ('delivered', 'cancelled', 'refunded');

  if p_event_type is not null then
    insert into public.order_events (order_id, type, message, is_public, data)
    select p_order_id,
           p_event_type,
           p_event_message,
           true,
           jsonb_build_object('trackingNumber', p_tracking_number)
    where not exists (
      select 1 from public.order_events e
       where e.order_id = p_order_id
         and e.type = p_event_type
         and coalesce(e.data->>'trackingNumber', '') = coalesce(p_tracking_number, '')
    );
  end if;

  return query select v_shipment_id, v_notified_at is null and v_shipment_id is not null;
end $$;

-- ---------------------------------------------------------------------
-- Lock down the new RPCs: service-role only.
-- ---------------------------------------------------------------------
revoke all on function public.claim_supplier_order(uuid) from public, anon, authenticated;
revoke all on function public.mark_supplier_order_submitted(uuid, text, text, numeric, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.apply_supplier_order_update(uuid, uuid, text, text, text, text, public.supplier_order_status, public.order_status, public.fulfillment_status, text, text) from public, anon, authenticated;

grant execute on function public.claim_supplier_order(uuid) to service_role;
grant execute on function public.mark_supplier_order_submitted(uuid, text, text, numeric, jsonb, jsonb) to service_role;
grant execute on function public.apply_supplier_order_update(uuid, uuid, text, text, text, text, public.supplier_order_status, public.order_status, public.fulfillment_status, text, text) to service_role;
