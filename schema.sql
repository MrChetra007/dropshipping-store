-- =====================================================================
-- schema.sql — CJ Dropshipping store (Next.js + Supabase)
-- Postgres 15+. Safe to RE-RUN: section 0 drops everything first.
--
-- !! WARNING !! Section 0 DELETES all store tables and their data
-- (products, orders, payments...). It does NOT delete auth.users.
-- Do not re-run on a live store with real orders.
--
-- Security model:
--   * Public (anon/authenticated) can only READ the active catalog,
--     and their OWN orders / addresses / profile.
--   * Everything else (supplier costs, CJ tokens, payments, webhooks,
--     carts, discount codes) is service-role only: RLS is enabled with
--     NO policies, so only the server (service_role key) can touch it.
--   * Admin panel and webhooks run on the server with the service-role
--     key, after checking profiles.role = 'admin'.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. RESET (makes the script re-runnable)
-- ---------------------------------------------------------------------
drop trigger  if exists on_auth_user_created on auth.users;

drop view     if exists public.v_order_profit cascade;

drop function if exists public.mark_order_paid(uuid, text, text, numeric, text, jsonb) cascade;
drop function if exists public.claim_supplier_orders(integer) cascade;
drop function if exists public.claim_supplier_order(uuid) cascade;
drop function if exists public.mark_supplier_order_created(uuid, text, jsonb, jsonb) cascade;
drop function if exists public.mark_supplier_order_submitted(uuid, text, text, numeric, jsonb, jsonb) cascade;
drop function if exists public.apply_supplier_order_update cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;

drop table if exists public.refunds           cascade;
drop table if exists public.order_events      cascade;
drop table if exists public.shipments         cascade;
drop table if exists public.supplier_orders   cascade;
drop table if exists public.webhook_events    cascade;
drop table if exists public.payments          cascade;
drop table if exists public.order_item_costs  cascade;
drop table if exists public.order_items       cascade;
drop table if exists public.orders            cascade;
drop table if exists public.cart_items        cascade;
drop table if exists public.carts             cascade;
drop table if exists public.addresses         cascade;
drop table if exists public.discount_codes    cascade;
drop table if exists public.shipping_rates    cascade;
drop table if exists public.supplier_variants cascade;
drop table if exists public.product_images    cascade;
drop table if exists public.product_variants  cascade;
drop table if exists public.products          cascade;
drop table if exists public.categories        cascade;
drop table if exists public.supplier_tokens   cascade;
drop table if exists public.settings          cascade;
drop table if exists public.profiles          cascade;

drop sequence if exists public.order_number_seq cascade;

drop function if exists public.set_updated_at() cascade;

drop type if exists public.user_role             cascade;
drop type if exists public.product_status        cascade;
drop type if exists public.order_status          cascade;
drop type if exists public.payment_status        cascade;
drop type if exists public.fulfillment_status    cascade;
drop type if exists public.supplier_order_status cascade;
drop type if exists public.refund_status         cascade;
drop type if exists public.discount_type         cascade;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
create type public.user_role             as enum ('customer', 'admin');
create type public.product_status        as enum ('draft', 'active', 'archived');
create type public.order_status          as enum ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
create type public.payment_status        as enum ('pending', 'paid', 'failed', 'partially_refunded', 'refunded');
create type public.fulfillment_status    as enum ('unfulfilled', 'queued', 'submitted', 'shipped', 'delivered', 'failed', 'cancelled');
create type public.supplier_order_status as enum ('queued', 'submitted', 'confirmed', 'shipped', 'delivered', 'failed', 'cancelled');
create type public.refund_status         as enum ('requested', 'approved', 'processed', 'rejected');
create type public.discount_type         as enum ('percent', 'fixed');

-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. PROFILES (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 4. CATALOG
-- ---------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  parent_id   uuid references public.categories(id) on delete set null,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  description     text,                       -- HTML or markdown, sanitized on render
  category_id     uuid references public.categories(id) on delete set null,
  status          public.product_status not null default 'draft',
  tags            text[] not null default '{}',
  is_featured     boolean not null default false,
  seo_title       text,
  seo_description text,
  search          tsvector generated always as (
                    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
                  ) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.product_variants (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products(id) on delete cascade,
  sku              text not null unique,
  title            text not null default 'Default',   -- e.g. "Black / M"
  options          jsonb not null default '{}'::jsonb, -- {"Color":"Black","Size":"M"}
  price            numeric(12,2) not null check (price >= 0),   -- selling price (what customer pays)
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  currency         char(3) not null default 'USD',
  stock            integer,                           -- null = unknown / not tracked
  weight_g         integer,
  is_active        boolean not null default true,
  auto_disabled_at timestamptz,                       -- set when the stock sync disabled it
  needs_review     boolean not null default false,    -- e.g. margin below settings threshold
  review_reason    text,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  variant_id  uuid references public.product_variants(id) on delete set null,
  url         text not null,
  alt         text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Supplier mapping + COST. Service-role only (never exposed to customers).
create table public.supplier_variants (
  variant_id           uuid primary key references public.product_variants(id) on delete cascade,
  supplier             text not null default 'cj',
  supplier_product_id  text not null,
  supplier_variant_id  text not null,           -- CJ "vid"
  supplier_sku         text,
  cost_price           numeric(12,2) not null check (cost_price >= 0),
  cost_currency        char(3) not null default 'USD',
  last_synced_at       timestamptz,
  raw                  jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (supplier, supplier_variant_id)
);

-- ---------------------------------------------------------------------
-- 5. SHIPPING & DISCOUNTS
-- ---------------------------------------------------------------------
create table public.shipping_rates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                  -- "Standard (CJ Packet)"
  country_code  text not null default '*',      -- ISO-2 like 'US', 'GB', or '*' = everywhere else
  amount        numeric(12,2) not null check (amount >= 0),
  free_over     numeric(12,2),                  -- free shipping if subtotal >= this
  min_days      integer,
  max_days      integer,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (country_code, name)
);

create table public.discount_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  type          public.discount_type not null,
  value         numeric(12,2) not null check (value > 0),
  min_subtotal  numeric(12,2),
  max_uses      integer,
  used_count    integer not null default 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. CUSTOMER DATA
-- ---------------------------------------------------------------------
create table public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text,
  full_name     text not null,
  phone         text,
  line1         text not null,
  line2         text,
  city          text not null,
  state         text,
  postal_code   text not null,
  country_code  char(2) not null,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Server-managed carts (guest carts identified by cart id in an httpOnly cookie)
create table public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  currency    char(3) not null default 'USD',
  expires_at  timestamptz not null default (now() + interval '30 days'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references public.carts(id) on delete cascade,
  variant_id  uuid not null references public.product_variants(id) on delete cascade,
  quantity    integer not null check (quantity > 0 and quantity <= 99),
  created_at  timestamptz not null default now(),
  unique (cart_id, variant_id)
);

-- ---------------------------------------------------------------------
-- 7. ORDERS
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique default ('ST-' || nextval('public.order_number_seq')),
  user_id              uuid references auth.users(id) on delete set null,
  email                text not null,
  access_token         uuid not null default gen_random_uuid(),   -- guest order-status link secret
  status               public.order_status not null default 'pending_payment',
  payment_status       public.payment_status not null default 'pending',
  fulfillment_status   public.fulfillment_status not null default 'unfulfilled',
  currency             char(3) not null default 'USD',
  subtotal             numeric(12,2) not null default 0 check (subtotal >= 0),
  shipping_total       numeric(12,2) not null default 0 check (shipping_total >= 0),
  discount_total       numeric(12,2) not null default 0 check (discount_total >= 0),
  tax_total            numeric(12,2) not null default 0 check (tax_total >= 0),
  total                numeric(12,2) not null default 0 check (total >= 0),
  discount_code_id     uuid references public.discount_codes(id) on delete set null,
  shipping_rate_name   text,
  -- shipping address snapshot
  ship_name            text not null,
  ship_phone           text,
  ship_line1           text not null,
  ship_line2           text,
  ship_city            text not null,
  ship_state           text,
  ship_postal_code     text not null,
  ship_country_code    char(2) not null,
  -- payment provider references (provider-agnostic)
  payment_provider     text,
  provider_checkout_id text,
  customer_note        text,
  paid_at              timestamptz,
  cancelled_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  variant_id    uuid references public.product_variants(id) on delete set null,
  title         text not null,                 -- snapshot
  variant_title text,
  sku           text,
  image_url     text,
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    numeric(12,2) generated always as (unit_price * quantity) stored,
  created_at    timestamptz not null default now()
);

-- Cost snapshot per order item (service-role only; keeps cost private from customers)
create table public.order_item_costs (
  order_item_id uuid primary key references public.order_items(id) on delete cascade,
  unit_cost     numeric(12,2) not null check (unit_cost >= 0),
  currency      char(3) not null default 'USD'
);

create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders(id) on delete cascade,
  provider             text not null,
  provider_payment_id  text not null,
  amount               numeric(12,2) not null,
  currency             char(3) not null,
  status               public.payment_status not null default 'paid',
  raw                  jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  unique (provider, provider_payment_id)       -- idempotency
);

-- Every incoming webhook is stored first (dedupe + debugging)
create table public.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,                  -- payment provider name, or 'cj'
  event_id      text not null,
  event_type    text,
  payload       jsonb not null,
  status        text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  error         text,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  unique (provider, event_id)
);

-- One row per order sent to CJ. UNIQUE(order_id, supplier) = never double-order.
create table public.supplier_orders (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders(id) on delete cascade,
  supplier             text not null default 'cj',
  supplier_order_id    text,
  status               public.supplier_order_status not null default 'queued',
  shipping_method      text,
  supplier_cost_total  numeric(12,2),           -- what CJ actually charged (products + shipping)
  request              jsonb,
  response             jsonb,
  error                text,
  attempts             integer not null default 0,
  next_attempt_at      timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (order_id, supplier),
  unique (supplier, supplier_order_id)
);

create table public.shipments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  supplier_order_id  uuid references public.supplier_orders(id) on delete set null,
  carrier            text,
  tracking_number    text not null,
  tracking_url       text,
  status             text not null default 'in_transit',
  shipped_at         timestamptz,
  delivered_at       timestamptz,
  notified_at        timestamptz,                 -- set after the shipped email is sent
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (order_id, tracking_number)
);

-- Timeline. is_public = visible to the customer on the order page.
create table public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  type        text not null,
  message     text,
  is_public   boolean not null default false,
  data        jsonb,
  created_at  timestamptz not null default now()
);

create table public.refunds (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  payment_id          uuid references public.payments(id) on delete set null,
  amount              numeric(12,2) not null check (amount > 0),
  currency            char(3) not null default 'USD',
  reason              text,
  status              public.refund_status not null default 'requested',
  provider_refund_id  text,
  created_at          timestamptz not null default now(),
  processed_at        timestamptz
);

-- ---------------------------------------------------------------------
-- 8. SYSTEM TABLES
-- ---------------------------------------------------------------------
-- CJ access/refresh tokens (service-role only)
create table public.supplier_tokens (
  supplier            text primary key,
  open_id             text,
  access_token        text,
  refresh_token       text,
  access_expires_at   timestamptz,
  refresh_expires_at  timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Key/value settings. Keys starting with 'public.' are readable by everyone.
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. INDEXES
-- ---------------------------------------------------------------------
create index idx_products_status_created   on public.products (status, created_at desc);
create index idx_products_category         on public.products (category_id);
create index idx_products_search           on public.products using gin (search);
create index idx_products_tags             on public.products using gin (tags);
create index idx_variants_product          on public.product_variants (product_id);
create index idx_supplier_variants_sync    on public.supplier_variants (supplier, last_synced_at);
create index idx_images_product            on public.product_images (product_id, sort_order);
create index idx_cart_items_cart           on public.cart_items (cart_id);
create index idx_addresses_user            on public.addresses (user_id);
create index idx_orders_user               on public.orders (user_id, created_at desc);
create index idx_orders_email              on public.orders (lower(email));
create index idx_orders_status             on public.orders (status, created_at desc);
create index idx_order_items_order         on public.order_items (order_id);
create index idx_payments_order            on public.payments (order_id);
create index idx_supplier_orders_queue     on public.supplier_orders (status, next_attempt_at);
create index idx_shipments_order           on public.shipments (order_id);
create index idx_order_events_order        on public.order_events (order_id, created_at);
create index idx_webhook_events_received   on public.webhook_events (received_at desc);

-- ---------------------------------------------------------------------
-- 10. updated_at TRIGGERS
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','products','product_variants','supplier_variants',
    'shipping_rates','discount_codes','addresses','carts','orders',
    'supplier_orders','shipments','supplier_tokens','settings'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 11. BUSINESS FUNCTIONS (service-role only)
-- ---------------------------------------------------------------------

-- Called by the payment webhook after signature verification.
-- Atomic + idempotent. Returns: 'paid' | 'duplicate' | 'mismatch' | 'ignored'
create or replace function public.mark_order_paid(
  p_order_id            uuid,
  p_provider            text,
  p_provider_payment_id text,
  p_amount              numeric,
  p_currency            text,
  p_raw                 jsonb default '{}'::jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_rows  integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order % not found', p_order_id;
  end if;

  insert into public.payments (order_id, provider, provider_payment_id, amount, currency, status, raw)
  values (p_order_id, p_provider, p_provider_payment_id, p_amount, upper(p_currency), 'paid', coalesce(p_raw, '{}'::jsonb))
  on conflict (provider, provider_payment_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return 'duplicate';
  end if;

  if v_order.status <> 'pending_payment' then
    insert into public.order_events (order_id, type, message, is_public)
    values (p_order_id, 'payment_ignored', 'Payment received while order was in status ' || v_order.status || ' — review manually', false);
    return 'ignored';
  end if;

  if p_amount <> v_order.total or upper(p_currency) <> v_order.currency then
    insert into public.order_events (order_id, type, message, is_public, data)
    values (p_order_id, 'payment_mismatch', 'Paid amount/currency does not match order total — review manually', false,
            jsonb_build_object('paid', p_amount, 'paid_currency', p_currency, 'expected', v_order.total, 'expected_currency', v_order.currency));
    return 'mismatch';
  end if;

  update public.orders
     set status = 'paid',
         payment_status = 'paid',
         fulfillment_status = 'queued',
         paid_at = now()
   where id = p_order_id;

  if v_order.discount_code_id is not null then
    update public.discount_codes set used_count = used_count + 1 where id = v_order.discount_code_id;
  end if;

  insert into public.supplier_orders (order_id, supplier)
  values (p_order_id, 'cj')
  on conflict (order_id, supplier) do nothing;

  insert into public.order_events (order_id, type, message, is_public)
  values (p_order_id, 'paid', 'Payment received', true);

  return 'paid';
end $$;

-- Worker claims queued CJ orders. SKIP LOCKED = safe with parallel workers.
-- Pushes next_attempt_at forward 10 min so a crashed worker's job is retried later.
create or replace function public.claim_supplier_orders(p_limit integer default 5)
returns setof public.supplier_orders
language sql security definer set search_path = public as $$
  with c as (
    select id from public.supplier_orders
     where status = 'queued' and next_attempt_at <= now()
     order by created_at
     limit p_limit
     for update skip locked
  )
  update public.supplier_orders s
     set attempts = s.attempts + 1,
         next_attempt_at = now() + interval '10 minutes',
         updated_at = now()
    from c
   where s.id = c.id
  returning s.*;
$$;

-- Claim one specific queued order (used by the post-payment kick). Same
-- semantics as claim_supplier_orders: increment attempts and push the claim
-- window forward so a concurrent cron run cannot pick it up.
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

-- Atomic success transition: supplier order + customer order + public timeline
-- event. Idempotent, so a retry after a partial failure cannot duplicate events.
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

-- Persist the CJ order id as soon as the draft order is created (payType=3),
-- before payment. A retry can then pay the existing order instead of creating
-- a duplicate.
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

-- Apply one CJ tracking poll result atomically:
--   * upsert the shipment row (unique per order + tracking number)
--   * move the supplier order / customer order forward without downgrading
--   * add one public timeline event per tracking number
-- Returns the shipment id and whether the shipped email still needs to be sent.
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

revoke all on function public.mark_order_paid(uuid, text, text, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.claim_supplier_orders(integer) from public, anon, authenticated;
revoke all on function public.claim_supplier_order(uuid) from public, anon, authenticated;
revoke all on function public.mark_supplier_order_created(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.mark_supplier_order_submitted(uuid, text, text, numeric, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.apply_supplier_order_update(uuid, uuid, text, text, text, text, public.supplier_order_status, public.order_status, public.fulfillment_status, text, text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text, text, numeric, text, jsonb) to service_role;
grant execute on function public.claim_supplier_orders(integer) to service_role;
grant execute on function public.claim_supplier_order(uuid) to service_role;
grant execute on function public.mark_supplier_order_created(uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.mark_supplier_order_submitted(uuid, text, text, numeric, jsonb, jsonb) to service_role;
grant execute on function public.apply_supplier_order_update(uuid, uuid, text, text, text, text, public.supplier_order_status, public.order_status, public.fulfillment_status, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 12. PROFIT VIEW (service-role only)
-- ---------------------------------------------------------------------
create view public.v_order_profit with (security_invoker = true) as
select
  o.id as order_id,
  o.order_number,
  o.created_at,
  o.currency,
  o.total,
  o.tax_total,
  coalesce(so.supplier_cost_total, 0) as supplier_cost,
  coalesce((select sum(r.amount) from public.refunds r
             where r.order_id = o.id and r.status = 'processed'), 0) as refunded,
  o.total - o.tax_total
    - coalesce(so.supplier_cost_total, 0)
    - coalesce((select sum(r.amount) from public.refunds r
                 where r.order_id = o.id and r.status = 'processed'), 0) as gross_profit
from public.orders o
left join public.supplier_orders so on so.order_id = o.id and so.supplier = 'cj'
where o.payment_status in ('paid', 'partially_refunded', 'refunded');

revoke all on public.v_order_profit from anon, authenticated;

-- ---------------------------------------------------------------------
-- 13. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.product_images    enable row level security;
alter table public.supplier_variants enable row level security;   -- no policy = service-role only
alter table public.shipping_rates    enable row level security;
alter table public.discount_codes    enable row level security;   -- no policy = service-role only
alter table public.addresses         enable row level security;
alter table public.carts             enable row level security;   -- no policy = service-role only
alter table public.cart_items        enable row level security;   -- no policy = service-role only
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.order_item_costs  enable row level security;   -- no policy = service-role only
alter table public.payments          enable row level security;   -- no policy = service-role only
alter table public.webhook_events    enable row level security;   -- no policy = service-role only
alter table public.supplier_orders   enable row level security;   -- no policy = service-role only
alter table public.shipments         enable row level security;
alter table public.order_events      enable row level security;
alter table public.refunds           enable row level security;   -- no policy = service-role only
alter table public.supplier_tokens   enable row level security;   -- no policy = service-role only
alter table public.settings          enable row level security;

-- profiles: read own; update only name/phone (role can never be changed by the client)
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant  update (full_name, phone) on public.profiles to authenticated;

-- public catalog (read-only)
create policy "categories_public_read" on public.categories for select using (is_active);
create policy "products_public_read"   on public.products   for select using (status = 'active');
create policy "variants_public_read"   on public.product_variants for select using (
  is_active and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
);
create policy "images_public_read"     on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
);
create policy "shipping_rates_public_read" on public.shipping_rates for select using (is_active);
create policy "settings_public_read"   on public.settings for select using (key like 'public.%');

-- addresses: full control of own rows
create policy "addresses_own_all" on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders: logged-in customers read their own. Guests use a server route + access_token (service role).
create policy "orders_select_own" on public.orders for select using (user_id = auth.uid());
create policy "order_items_select_own" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "shipments_select_own" on public.shipments for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
create policy "order_events_select_own_public" on public.order_events for select using (
  is_public and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);

-- Customers can never write orders/payments directly: all writes go through the server (service role).

-- ---------------------------------------------------------------------
-- 14. BACKFILL PROFILES (for users created before this script / re-runs)
-- ---------------------------------------------------------------------
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 15. SEED DATA (edit freely)
-- ---------------------------------------------------------------------
insert into public.settings (key, value) values
  ('public.store',        '{"name": "My Store", "currency": "USD", "support_email": "support@example.com"}'),
  ('pricing.markup',      '{"multiplier": 2.5, "round_to": 0.99}'),
  ('pricing.margin_guard', '{"min_margin_percent": 20, "auto_reprice": false}'),
  ('fulfillment.cj',      '{"auto_place_orders": true, "default_shipping_method": "CJPacket", "max_attempts": 5}'),
  ('public.payment_instructions', '{"bank_name": "", "account_name": "", "account_number": "", "swift": "", "instructions": ""}')
on conflict (key) do nothing;

insert into public.shipping_rates (name, country_code, amount, free_over, min_days, max_days) values
  ('Standard',  'US', 4.99, 75, 7, 14),
  ('Standard',  'GB', 5.99, 75, 8, 16),
  ('Standard',  '*',  7.99, 100, 10, 25)
on conflict do nothing;

-- After you sign up in the app, make yourself admin:
--   update public.profiles set role = 'admin' where email = 'you@example.com';