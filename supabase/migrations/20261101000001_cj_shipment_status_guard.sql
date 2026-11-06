-- CJ tracking pushes can arrive out of order. Keep a delivered shipment
-- delivered, and do not let a late in-transit update overwrite an exception.
--
-- Safe to run more than once.

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
          status            = case
                                when public.shipments.status = 'delivered' then 'delivered'
                                when excluded.status = 'delivered' then 'delivered'
                                when public.shipments.status = 'exception' then 'exception'
                                else excluded.status
                              end,
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

revoke all on function public.apply_supplier_order_update(uuid, uuid, text, text, text, text, public.supplier_order_status, public.order_status, public.fulfillment_status, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_supplier_order_update(uuid, uuid, text, text, text, text, public.supplier_order_status, public.order_status, public.fulfillment_status, text, text)
  to service_role;
