-- Admin in-app notifications.
--
-- The admin bell (admin UI) shows alerts for:
--   - order_created:       a guest or customer completed checkout (pending_payment)
--   - order_paid:          payment confirmed (manual mark-paid or webhook)
--   - fulfillment_failed:  the CJ supplier order exhausted its attempts or an
--                          immediate permanent error (e.g. CJ balance) occurred
--
-- Rows are written by triggers so every code path (edge function, RPC, cron
-- worker) is covered without touching the functions. Admin-only visibility is
-- enforced with RLS; realtime pushes respect the same policies.
-- Reset (makes the migration re-runnable)
drop trigger if exists notify_order_created      on public.orders;
drop trigger if exists notify_order_paid         on public.orders;
drop trigger if exists notify_fulfillment_failed on public.supplier_orders;

drop function if exists public.admin_notify_order_created();
drop function if exists public.admin_notify_order_paid();
drop function if exists public.admin_notify_fulfillment_failed();

drop table if exists public.admin_notifications cascade;
drop type  if exists public.admin_notification_type;

create type public.admin_notification_type as enum (
  'order_created',
  'order_paid',
  'fulfillment_failed'
);

create table public.admin_notifications (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references public.orders(id) on delete cascade,
  order_number text not null,
  type         public.admin_notification_type not null,
  title        text not null,
  body         text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index admin_notifications_recent_idx
  on public.admin_notifications (created_at desc);
create index admin_notifications_unread_idx
  on public.admin_notifications (created_at desc)
  where read_at is null;

alter table public.admin_notifications enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy "admin_notifications_admin_read"
  on public.admin_notifications for select
  using (public.is_admin());

create policy "admin_notifications_admin_update"
  on public.admin_notifications for update
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.admin_notifications from anon;
grant select on public.admin_notifications to authenticated;
grant update (read_at) on public.admin_notifications to authenticated;

-- Realtime: the bell subscribes to INSERTs; deliveries honor the RLS policies
-- above for the subscriber's JWT.
alter publication supabase_realtime add table public.admin_notifications;

create or replace function public.admin_notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_notifications (order_id, order_number, type, title, body)
  values (
    NEW.id,
    NEW.order_number,
    'order_created',
    'New order ' || NEW.order_number,
    NEW.email || ' — ' || to_char(NEW.total, 'FM99999990.00') || ' ' || NEW.currency
  );
  return NEW;
end;
$$;

create trigger notify_order_created
  after insert on public.orders
  for each row
  execute function public.admin_notify_order_created();

create or replace function public.admin_notify_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_notifications (order_id, order_number, type, title, body)
  values (
    NEW.id,
    NEW.order_number,
    'order_paid',
    'Order ' || NEW.order_number || ' paid',
    NEW.email || ' — ' || to_char(NEW.total, 'FM99999990.00') || ' ' || NEW.currency
  );
  return NEW;
end;
$$;

create trigger notify_order_paid
  after update on public.orders
  for each row
  when (NEW.payment_status = 'paid' and OLD.payment_status is distinct from 'paid')
  execute function public.admin_notify_order_paid();

create or replace function public.admin_notify_fulfillment_failed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_notifications (order_id, order_number, type, title, body)
  values (
    NEW.order_id,
    (select order_number from public.orders where id = NEW.order_id),
    'fulfillment_failed',
    'CJ fulfillment failed ' || (select order_number from public.orders where id = NEW.order_id),
    left(coalesce(NEW.error, 'max attempts reached'), 400)
  );
  return NEW;
end;
$$;

create trigger notify_fulfillment_failed
  after update on public.supplier_orders
  for each row
  when (NEW.status = 'failed' and OLD.status is distinct from 'failed')
  execute function public.admin_notify_fulfillment_failed();
