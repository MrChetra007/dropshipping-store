-- CJ wallet payment (payType=3 create, then payBalance/payBalanceV2) and CJ
-- webhook signature verification (the signing secret is the CJ openId).
--
-- Safe to run more than once.

alter table public.supplier_tokens
  add column if not exists open_id text;

-- Persist the CJ order id as soon as the draft order is created, before
-- payment. A retry can then pay the existing order instead of creating a
-- duplicate.
create or replace function public.mark_supplier_order_created(
  p_supplier_order_id uuid,
  p_cj_order_id        text,
  p_request            jsonb,
  p_response           jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.supplier_orders
     set supplier_order_id = p_cj_order_id,
         request = coalesce(p_request, request),
         response = coalesce(p_response, response),
         error = null,
         updated_at = now()
   where id = p_supplier_order_id;

  if not found then
    raise exception 'supplier order % not found', p_supplier_order_id;
  end if;
end $$;

revoke all on function public.mark_supplier_order_created(uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_supplier_order_created(uuid, text, jsonb, jsonb)
  to service_role;
