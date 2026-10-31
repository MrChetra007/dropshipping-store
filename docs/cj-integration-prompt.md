# CJ Dropshipping integration — working prompt

Use this document as the source of truth when working on this store. It explains
how the Next.js app, Supabase, and CJ Dropshipping fit together, which rules must
never be broken, and where each flow lives in the repo.

---

## 0. Short mental model

```text
Customer browser
   │
   ▼
Next.js (App Router, server components + thin route handlers)
   │  anon key only, never service role, never CJ key
   ▼
Supabase Edge Functions  ──►  CJ Dropshipping API
   │  service role key           products, orders, tracking, balance
   ▼
Postgres (RLS for public reads, service role for writes)
```

- The storefront reads the catalog directly from Supabase with the **anon** key
  and RLS.
- Every privileged write (cart, checkout, payment webhook, CJ import, CJ
  fulfillment, CJ tracking, CJ stock sync) runs in a **Supabase Edge Function**.
- `CJ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and Resend keys live
  only in Supabase function secrets. They must never appear in `.env.local`,
  Vercel env vars, client bundles, logs, or public responses.
- Supplier cost (`supplier_variants.cost_price`, `order_item_costs.unit_cost`,
  `supplier_orders.supplier_cost_total`, `payments`) is **never** returned to the
  storefront or to a customer.

---

## 1. Hard rules

1. **Never trust browser prices.** The browser sends variant ids and quantities;
   the server reloads variants, stock, shipping, and discounts and recomputes all
   totals in integer cents.
2. **Idempotency is mandatory** for payment events, CJ order creation, and
   supplier-order processing. Replaying the same event must not create a second
   payment, a second CJ order, or a second email.
3. **Guest checkout is allowed.** Guests receive an `orders.access_token` and
   view their order at `/orders/<order_number>?token=<token>`. A wrong or missing
   token returns `404`.
4. **CJ is the supplier, not the storefront.** Customers see our `products` and
   `product_variants`; CJ `pid`/`vid` and costs stay in `supplier_variants`.
5. **Statuses only move forward** (except explicit admin actions). A late
   tracking poll must not downgrade a shipped or delivered order.
6. **All external input is validated with zod**, including CJ responses and
   webhook payloads. TypeScript is strict; do not introduce `any`.
7. **Do not add features that are not requested.** Ask before changing business
   behavior such as auto-repricing, refunds, or payment providers.

---

## 2. Repository map

| Concern | Location |
| --- | --- |
| Next.js pages / route handlers | `src/app/` |
| Shared UI | `src/components/` |
| Storefront data access (anon) | `src/lib/catalog.ts`, `src/lib/cart.ts`, `src/lib/orders.ts` |
| Edge function caller | `src/lib/supabase/functions.ts` |
| DB types | `src/types/database.ts` |
| Full reset schema | `schema.sql` |
| Non-destructive migrations | `supabase/migrations/` |
| CJ client | `supabase/functions/_shared/cj/` |
| Shared pricing rules | `supabase/functions/_shared/pricing.ts` |
| Shared money helpers | `supabase/functions/_shared/money.ts` |
| Fulfillment worker logic | `supabase/functions/_shared/fulfillment/process.ts` |
| Tracking worker logic | `supabase/functions/_shared/tracking/sync.ts` |
| Stock sync worker logic | `supabase/functions/_shared/stock/sync.ts` |
| Emails (Resend) | `supabase/functions/_shared/email.ts` |
| Payment abstraction | `supabase/functions/_shared/payments/` (edge only) |
| Site URL helper | `supabase/functions/_shared/site.ts` |
| Edge function entrypoints | `supabase/functions/*/index.ts` |

---

## 3. Supabase Edge Functions

All functions are deployed from `supabase/functions/`. The Supabase runtime
injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

### `admin-api`

Admin-only. Verifies the caller's JWT, checks `profiles.role = 'admin'` with the
service-role client, then performs the action.

| Action | Method | Purpose |
| --- | --- | --- |
| `session` | GET | Return the current admin profile |
| `cj.search` | GET | Search CJ catalog (`/product/listV2`) |
| `cj.product` | GET | Preview one CJ product (`/product/query`) |
| `products.list` | GET | List imported products |
| `products.get` | GET | Product detail incl. supplier cost and review flags |
| `products.import` | POST | Import 1–20 CJ products as drafts |
| `products.update` | POST | Edit title, description, category, status, prices, image order |
| `orders.list` | GET | Admin order list |
| `orders.get` | GET | Admin order detail incl. CJ/supplier state |
| `orders.retryFulfillment` | POST | Reset a failed supplier order and re-kick the worker |
| `settings` | GET | Read settings |
| `setting` | POST | Update one setting |

### `store-api`

Guest/customer actions. Derives the user from the bearer JWT; anon is treated as
signed out.

| Action | Method | Purpose |
| --- | --- | --- |
| `cart.get` | GET | Load a cart by id |
| `cart.add` | POST | Add a variant |
| `cart.update` | POST | Change quantity |
| `cart.remove` | POST | Remove a variant |
| `checkout.create` | POST | Validate cart and create a `pending_payment` order |
| `checkout.startPayment` | POST | Select the provider, create checkout, store provider id, clear cart |
| `order.preview` | GET | Customer order lookup by number + guest token |
| `payment.webhook` | POST | Verify and process a payment event |
| `payment.mockPay` | POST | Dev-only: sign and process a mock `payment.paid` event |

### Workers

| Function | Auth | Purpose |
| --- | --- | --- |
| `fulfill-order` | `Authorization: Bearer CRON_SECRET` | Submit paid orders to CJ |
| `tracking-sync` | `Authorization: Bearer CRON_SECRET` | Poll CJ tracking and update shipments |
| `stock-sync` | `Authorization: Bearer CRON_SECRET` | Refresh stock/cost and flag low margins |

The three workers are deployed with `verify_jwt = false` in
`supabase/config.toml`, so the Supabase gateway does not require a Supabase JWT.
They verify `CRON_SECRET` themselves.

---

## 4. Next.js routes

| Route | Purpose |
| --- | --- |
| `POST /api/cart` | Cart add/update/remove; `GET` loads the cart |
| `POST /api/checkout` | Calls `store-api` `checkout.create`, then `checkout.startPayment` |
| `POST /api/webhooks/payment` | Forwards the **raw body** and signature headers to `store-api` `payment.webhook` |
| `GET /api/cron/fulfill` | Forwards the caller's bearer to `fulfill-order` |
| `GET /api/cron/tracking` | Forwards the caller's bearer to `tracking-sync` |
| `GET /api/cron/stock` | Forwards the caller's bearer to `stock-sync` |

`vercel.json` schedules:

```json
{ "path": "/api/cron/fulfill",  "schedule": "*/5 * * * *" }
{ "path": "/api/cron/tracking", "schedule": "0 */3 * * *" }
{ "path": "/api/cron/stock",    "schedule": "0 */6 * * *" }
```

Cron routes return `401` without an `Authorization` header. They do not read
`CRON_SECRET`; the worker function verifies the forwarded bearer itself. When
Vercel Cron invokes them, `CRON_SECRET` must be set in the Vercel project's
server-side environment so Vercel sends the header. To keep the secret only in
Supabase, schedule the workers with `pg_cron` + `pg_net` instead.

---

## 5. CJ API facts used by this app

Base URL: `https://developers.cjdropshipping.com/api2.0/v1`

Auth: `CJ-Access-Token: <accessToken>` on every authenticated call. Auth is
**API-key only**; there is no email/password login and no `CJ_EMAIL`.

Endpoints used:

| CJ endpoint | Used for |
| --- | --- |
| `POST /authentication/getAccessToken` | First auth |
| `POST /authentication/refreshAccessToken` | Refresh before expiry |
| `GET /product/listV2` | Admin catalog search |
| `GET /product/query` | Product detail, variants, inventory, import, stock sync |
| `POST /shopping/order/createOrderV2` | Create + pay a CJ order (`payType=2`) |
| `GET /shopping/order/getOrderDetail` | Order status, tracking number, amounts |
| `GET /shopping/pay/getBalance` | Account balance checks |
| `GET /logistic/trackInfo` | Detailed tracking status |

CJ responses use HTTP 200 even for failures. Check `code` / `result`, not only
HTTP status.

Client behavior in `supabase/functions/_shared/cj/client.ts`:

- Access/refresh tokens are cached in `supplier_tokens`; refresh when the access
  token is within 24 hours of expiry.
- 15-second timeout.
- Requests are serialized to **1 request/second** (safe for free/level 0-1 CJ
  accounts).
- Retries HTTP `429` / `5xx`, CJ `1600000`, `1600200`, and `1600301` with
  exponential backoff and jitter.
- Refreshes/re-auths once for `1600001` / `1600002`.
- CJ `1603003` on order create means “order already exists”; re-query it instead
  of creating a second order.

Important CJ error codes:

| Code | Meaning | Handling |
| --- | --- | --- |
| `1600000` | System busy | Retry |
| `1600200` | Too many requests | Retry |
| `1600201` | Daily quota exhausted | Do not loop |
| `1600300` | Parameter error | Permanent failure |
| `1600301` | Read timeout | Retry |
| `1602000` / `1602001` | Variant/product not found | Permanent |
| `1602002` / `1602003` | Product/variant removed | Treat as unavailable |
| `1603003` | Order already exists | Re-query existing order |
| `1604000` | Insufficient CJ balance | Fail with admin alert |
| `1604001` | Balance payment restricted | Fail with admin alert |

---

## 6. Database map

Key tables:

| Table | Role |
| --- | --- |
| `profiles` | User profile; `role = 'admin'` gates admin access |
| `products` | Storefront product (`draft`, `active`, `archived`) |
| `product_variants` | Sellable variants: price, stock, `is_active`, review flags |
| `product_images` | Gallery, ordered by `sort_order` |
| `supplier_variants` | CJ mapping: `supplier_product_id` (pid), `supplier_variant_id` (vid), `cost_price` |
| `categories` | Storefront categories |
| `shipping_rates` | Our shipping prices and delivery windows (not CJ freight) |
| `discount_codes` | Percent/fixed discounts with usage limits |
| `carts` / `cart_items` | Guest and customer carts, cookie `cart_id` |
| `orders` | Customer order, totals, address, statuses, guest `access_token` |
| `order_items` | Immutable snapshot of title/SKU/price/quantity at purchase |
| `order_item_costs` | Supplier cost snapshot per item (never public) |
| `order_events` | Timeline; `is_public` controls customer visibility |
| `payments` | Provider payment records, unique on `(provider, provider_payment_id)` |
| `webhook_events` | Raw webhook dedupe, unique on `(provider, event_id)` |
| `supplier_orders` | One CJ order per order: status, attempts, request/response, cost |
| `shipments` | Tracking numbers, carrier, status, `notified_at` |
| `supplier_tokens` | CJ access/refresh tokens |
| `settings` | Key/value JSON config |
| `refunds` | Refund records (admin flow) |

### Product variant fields added by the stock sync

| Field | Meaning |
| --- | --- |
| `stock` | Latest CJ inventory total; `null` = unknown |
| `auto_disabled_at` | Set when the sync disabled the variant because CJ reported it unavailable |
| `needs_review` | Admin flag, e.g. margin below threshold |
| `review_reason` | Human-readable reason |

---

## 7. End-to-end flows

### 7.1 Product import (admin)

1. Admin opens `/admin/products/import`.
2. `admin-api` `cj.search` calls CJ `/product/listV2`.
3. `cj.product` calls CJ `/product/query` for the preview.
4. `products.import` creates, in order:
   - `products` with `status = 'draft'`
   - `product_variants` with `sku = "CJ-<vid>"`, selling price from
     `settings.pricing.markup`, stock, weight, options
   - `product_images`
   - `supplier_variants` with CJ `pid`/`vid` and `cost_price`
5. Re-importing the same CJ `pid` is skipped. A failed import deletes the
   partially created product.
6. The product stays hidden until the owner sets `status = 'active'` in
   `/admin/products/[id]`.

Pricing rule (`supabase/functions/_shared/pricing.ts`):

```text
raw = cost × settings.pricing.markup.multiplier
price = round up to end in settings.pricing.markup.round_to
```

Default: multiplier `2.5`, round_to `0.99`.

### 7.2 Storefront

- `/`, `/products`, `/categories/[slug]`, `/products/[slug]` are server-rendered.
- Only `products.status = 'active'` and `product_variants.is_active = true` are
  visible.
- Variant `stock = 0` renders as “Out of stock”; `null` means unknown.
- Public queries never select `supplier_variants`, `cost_price`, CJ ids, or
  `order_item_costs`.
- Product pages include Product JSON-LD and sanitized description HTML.

### 7.3 Cart

- Cookie `cart_id` is httpOnly; guests get a cart without an account.
- `/api/cart` validates input and calls `store-api` `cart.*`.
- Adding/updating checks that the variant exists, belongs to an active product,
  and is in stock.
- `loadCart` recomputes prices from `product_variants`, not from the client.

### 7.4 Checkout and order creation

`POST /api/checkout`:

1. Reads `cart_id` from the cookie.
2. Validates the address, email, shipping rate name, discount code, and note.
3. Calls `store-api` `checkout.create`.
4. `checkout.create`:
   - loads the cart and rejects empty/unavailable carts
   - loads the selected `shipping_rates` row (country-specific first, then `*`)
   - applies free shipping over `free_over`
   - validates the discount code and computes the discount
   - computes `subtotal`, `shipping`, `discount`, `total` in **integer cents**
   - inserts `orders` with `status = 'pending_payment'`
   - inserts `order_items` (snapshot)
   - inserts `order_item_costs` from `supplier_variants.cost_price`
   - adds an internal `margin_guard` event when cost + allocated shipping ≥
     selling price (the order is still allowed, but admin sees it)
   - adds the public `order_created` event
   - returns the order id, order number, guest `access_token`, and totals
5. The Next route calls `store-api` `checkout.startPayment`. The edge function:
   - selects the provider from the `PAYMENT_PROVIDER` function secret
   - builds success/cancel URLs from the `SITE_URL` function secret
   - calls `provider.createCheckout(...)`
   - stores `payment_provider` and `provider_checkout_id`
   - clears the cart items
   - returns the provider redirect URL to Next.js

If the provider cannot start a checkout, the edge function deletes the pending
order so no orphan `pending_payment` row remains. The cart is cleared only after
the checkout is attached, so a failed retry keeps the cart.

### 7.5 Payment webhook

`POST /api/webhooks/payment` forwards the raw body plus signature headers to
`store-api` `payment.webhook`.

`processPaymentWebhook`:

1. Verifies the provider signature **before writing anything**.
2. Inserts `webhook_events` with unique `(provider, event_id)`.
   - Conflict ⇒ return `{ status: "duplicate" }`, HTTP 200.
3. Dispatches by event kind:
   - **paid** ⇒ RPC `mark_order_paid`
   - **failed** ⇒ mark payment failed + internal event
   - **refunded** ⇒ internal `payment_refunded` event for admin review
4. Marks the webhook event `processed`, `failed`, or `ignored`.

`mark_order_paid` is atomic and returns one of:

| Result | Meaning |
| --- | --- |
| `paid` | Payment inserted, order moved to `paid`, supplier order queued |
| `duplicate` | This `(provider, payment_id)` already exists |
| `mismatch` | Amount or currency differs; order stays `pending_payment`, internal event added |
| `ignored` | Order was no longer `pending_payment`; internal event added |

On `paid`, the webhook:
- creates one `supplier_orders` row (`queued`) via the RPC
- sends the confirmation email in the background
- kicks `fulfill-order` for that supplier order in the background

The webhook response is not blocked on email or fulfillment.

Mock provider:
- `PAYMENT_PROVIDER=mock`
- signature header `x-mock-signature` = HMAC-SHA256 hex of the raw body using
  `PAYMENT_WEBHOOK_SECRET`
- the dev-only `/checkout/mock` page calls `store-api` `payment.mockPay`; the
  edge function loads the order total, signs the event, and runs it through the
  real `payment.webhook` verification path. Next.js never sees the secret.

### 7.6 Fulfillment to CJ

`fulfill-order` is triggered by the payment webhook and by `/api/cron/fulfill`
every 5 minutes.

1. Claim a row with `claim_supplier_order(id)` (webhook kick) or
   `claim_supplier_orders(5)` (cron). Both increment `attempts` and push
   `next_attempt_at` forward 10 minutes, so two workers cannot process the same
   row.
2. `processSupplierOrder` loads the order, items, and `supplier_variants`.
3. It builds the CJ `createOrderV2` payload:
   - `orderNumber` = our `orders.order_number` (idempotency key)
   - each line: CJ `vid`, quantity, store line item id, product snapshot
   - customer address, email, phone
   - `logisticName` = `settings.fulfillment.cj.default_shipping_method`
   - `fromCountryCode` = `settings.fulfillment.cj.from_country_code`
   - `payType = 2` (create and pay from CJ balance)
   - `isSandbox` from `settings.fulfillment.cj.sandbox`
4. On success `mark_supplier_order_submitted` stores the CJ order id,
   request/response, supplier cost, sets the supplier row to `submitted`, sets
   `orders.fulfillment_status = 'submitted'`, and adds the public
   **Order sent to warehouse** event.
5. If a previous attempt already stored `supplier_order_id`, the worker finalizes
   that order instead of creating a second CJ order.
6. On failure:
   - transient errors retry with exponential backoff
     (`5, 10, 20, 40…` minutes, capped at 80) until
     `settings.fulfillment.cj.max_attempts`
   - permanent errors fail immediately
   - `1604000` / `1604001` fail immediately with a clear
     `fulfillment_balance_error` admin event
   - final failure sets `supplier_orders.status = 'failed'`,
     `orders.fulfillment_status = 'failed'`, and an internal event
7. Admin can retry from `/admin/orders/[id]`.

### 7.7 Tracking and emails

`tracking-sync` runs every 3 hours.

1. Load `supplier_orders` in `submitted`, `confirmed`, or `shipped` that have a
   CJ order id.
2. Call CJ `getOrderDetail`; if a tracking number exists, call `trackInfo`.
3. `apply_supplier_order_update` atomically:
   - upserts `shipments` on `(order_id, tracking_number)`
   - moves `supplier_orders.status` forward
   - moves `orders.status` / `orders.fulfillment_status` forward without
     downgrading delivered/refunded orders
   - adds one public event per tracking number
4. When a new tracking number appears, send **Your order has shipped**, then set
   `shipments.notified_at`. A failed send leaves it empty so the next run
   retries without sending a second email.
5. Customer page: `/orders/[orderNumber]?token=<access_token>` shows timeline,
   items, address, totals, and tracking. Signed-in customers can omit the token.

CJ order status mapping:

| CJ status | Supplier order | Customer order | Fulfillment | Public event |
| --- | --- | --- | --- | --- |
| `PENDING` / `PROCESSING` / `UNSHIPPED` | `confirmed` | `processing` | `submitted` | `order_processing` |
| `SHIPPED` | `shipped` | `shipped` | `shipped` | `order_shipped` |
| `DELIVERED` | `delivered` | `delivered` | `delivered` | `order_delivered` |
| `CANCELLED` | `cancelled` | `cancelled` | `cancelled` | `order_cancelled` |

Unknown CJ statuses are ignored. `trackingStatus` is free text; only obvious
states are mapped.

### 7.8 Stock and cost sync

`stock-sync` runs every 6 hours.

1. Group `supplier_variants` by CJ `pid`.
2. Sync the 40 products with the oldest `last_synced_at` (`null` first).
3. For each product call CJ `/product/query` and, per variant:
   - update `product_variants.stock` from the sum of
     `inventories[].totalInventory`
   - update `supplier_variants.cost_price` from `variantSellPrice` (fallback to
     product price) and `last_synced_at`
4. Unavailable rule:
   - `stock = 0` ⇒ disable
   - variant missing from CJ response ⇒ disable
   - CJ reports the product gone (`1602000`–`1602003`) ⇒ disable all its variants
   - `stock = null` (unknown) ⇒ leave availability unchanged
5. `auto_disabled_at` marks variants the sync disabled. They are re-enabled only
   when CJ reports known positive stock again; variants disabled by the owner
   stay disabled.
6. Margin guard (`settings.pricing.margin_guard`):
   - `min_margin_percent` (default `20`)
   - `auto_reprice` (default `false`)
   - margin = `(price - cost) / price`
   - below threshold ⇒ `needs_review = true` and a reason
   - `auto_reprice = true` ⇒ recalculate with `pricing.markup`; flag only if the
     new price still misses the threshold
7. Admin sees flags on `/admin/products` and `/admin/products/[id]`.

---

## 8. Settings

| Key | Shape | Purpose |
| --- | --- | --- |
| `public.store` | `{ name, currency, support_email }` | Public store identity |
| `pricing.markup` | `{ multiplier, round_to }` | Import and reprice rule |
| `pricing.margin_guard` | `{ min_margin_percent, auto_reprice }` | Stock sync margin policy |
| `fulfillment.cj` | `{ auto_place_orders, default_shipping_method, max_attempts, from_country_code, sandbox }` | CJ order submission |

`fulfillment.cj.default_shipping_method` must be a valid CJ `logisticName` for
the account. The seed value `CJPacket` is only a placeholder.

---

## 9. Secrets and deployment

Supabase function secrets:

```text
CJ_API_KEY
CRON_SECRET
PAYMENT_PROVIDER=mock
PAYMENT_WEBHOOK_SECRET
RESEND_API_KEY
EMAIL_FROM
SITE_URL
```

Next.js `.env.local` holds public values only:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

Payment provider selection, mock webhook signing, and cron authentication all
run in Supabase, so `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, and
`CRON_SECRET` are never read by Next.js.

Cron routes forward the caller's `Authorization` header to the workers. When
Vercel Cron calls them, `CRON_SECRET` must be set in the Vercel project's
server-side environment so Vercel sends the bearer. To keep it only in
Supabase, schedule the workers with `pg_cron` + `pg_net`.

Deploy:

```bash
npx supabase functions deploy admin-api
npx supabase functions deploy store-api
npx supabase functions deploy fulfill-order
npx supabase functions deploy tracking-sync
npx supabase functions deploy stock-sync
```

Database:

- `schema.sql` is a **full reset** (drops and recreates).
- Existing databases must use the migrations in `supabase/migrations/`:
  - `20261031000000_fulfillment_tracking.sql`
  - `20261031010000_stock_sync.sql`
- Migrations are non-destructive and safe to rerun.

---

## 10. Admin surface

| Page | Purpose |
| --- | --- |
| `/admin` | Admin entry |
| `/admin/products` | Imported products, review badges |
| `/admin/products/import` | Search CJ, preview, import |
| `/admin/products/[id]` | Edit title, description, category, status, prices, images; see cost, margin, review flags |
| `/admin/orders` | Recent orders with payment/fulfillment/CJ status |
| `/admin/orders/[id]` | CJ details, attempts, errors, retry button |

Admin access requires `profiles.role = 'admin'`. Promote a user with:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

---

## 11. Failure and idempotency matrix

| Situation | Expected behavior |
| --- | --- |
| Same payment webhook twice | One `payments` row, one supplier order, one email; second returns `duplicate` |
| Invalid webhook signature | `401`, nothing written |
| Paid amount/currency mismatch | Order stays `pending_payment`, internal `payment_mismatch` event |
| CJ down / 5xx | Supplier order retries with backoff, then `failed` |
| CJ insufficient balance | Immediate `failed` with `fulfillment_balance_error` |
| Duplicate CJ create (`1603003`) | Re-query and reuse the existing CJ order |
| CJ tracking poll returns older status | Status is not downgraded |
| Same tracking number polled again | No second shipped email (`notified_at`) |
| CJ stock drops to 0 | Variant auto-disabled; storefront hides it |
| CJ stock returns | Only auto-disabled variants are re-enabled |
| Cost rises below margin | Variant flagged for admin review (or repriced if enabled) |
| Guest order with wrong token | `404` |
| Customer A opens Customer B's order | `404` |
| Out-of-stock variant checkout | Rejected server-side |

---

## 12. How to extend safely

- **New CJ endpoint:** add a typed function under
  `supabase/functions/_shared/cj/` using `client.request` and a zod schema. Do not
  call CJ from Next.js.
- **New admin action:** add it to `admin-api`, verify admin first, then use the
  service-role client. Add a typed wrapper in `src/lib/`.
- **New customer action:** add it to `store-api`; derive the user from the JWT;
  never accept prices from the request.
- **New background job:** add a shared module under
  `supabase/functions/_shared/`, a worker entrypoint with `requireCronSecret`,
  a Next route that forwards the caller's `Authorization` header, a
  `vercel.json` entry, and `verify_jwt = false` in `supabase/config.toml`.
- **Schema change:** update `schema.sql` for fresh installs **and** add a
  non-destructive migration for existing databases.
- **Money:** store and compare integer cents; use `money.ts` helpers at the
  boundary.
- **Public data:** if a column contains cost, supplier ids, payment data, or
  internal notes, never select it in `src/lib/catalog.ts` or `src/lib/orders.ts`.

---

## 13. Known limitations

- Only the `mock` payment provider is implemented. A real provider must support
  physical goods and Cambodian merchants.
- Shipping rates are configured manually in `shipping_rates`; CJ
  `freightCalculate` is not used.
- CJ order status is polled; CJ order webhooks are not consumed.
- Emails are skipped with a log if `RESEND_API_KEY` / `EMAIL_FROM` are missing.
- CJ account balance must be topped up; otherwise fulfillment fails immediately
  with a clear admin alert.
- `fulfillment.cj.default_shipping_method` must match a real CJ `logisticName`.
- The stock sync processes 40 products per run; larger catalogs rotate over
  multiple runs.
