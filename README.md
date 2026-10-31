# CJ Dropshipping Store

Storefront built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase.
Products are sourced from CJ Dropshipping; orders are fulfilled through the CJ API.

## Stack

- Next.js 16 + React 19, TypeScript strict
- Tailwind CSS v4
- Supabase (Postgres, Auth, RLS)
- Zod validation
- Payment provider abstraction (`mock` until the owner picks a provider)

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values.
3. Run `schema.sql` once in the Supabase SQL Editor.
4. Start the dev server: `npm run dev`

After signing up in the app, make yourself an admin:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Edge Functions (privileged backend)

The Next.js app **never** holds `SUPABASE_SERVICE_ROLE_KEY`. All privileged
(supplier cost, admin CRUD, fulfillment, webhooks, cron) operations run in
Supabase Edge Functions under `supabase/functions/`, where the service-role key
is injected by the Supabase runtime.

- `admin-api` — admin-only actions (`session`, `settings`, CJ catalog search,
  product import, product editing, and order detail/retry). Verifies the
  caller's JWT and `profiles.role = 'admin'` before using the service-role
  client.
- `store-api` — guest/customer actions: cart (`cart.get`, `cart.add`,
  `cart.update`, `cart.remove`), checkout (`checkout.create`,
  `checkout.attachPayment`, `checkout.abort`), guest order preview
  (`order.preview`), and payment webhook processing (`payment.webhook`).
- `fulfill-order` — cron/internal worker that claims queued `supplier_orders`
  and submits them to CJ. It authenticates with `Authorization: Bearer
  CRON_SECRET` instead of a Supabase JWT (`verify_jwt = false` in
  `supabase/config.toml`).
- `tracking-sync` — cron/internal worker that polls CJ for active supplier
  orders, upserts `shipments`, updates order statuses, adds public timeline
  events, and sends the shipped email once per tracking number. It uses the
  same `CRON_SECRET` bearer auth (`verify_jwt = false`).
- Shared helpers live in `supabase/functions/_shared/`.
- The CJ client lives in `supabase/functions/_shared/cj/`. `CJ_API_KEY` is a
  Supabase function secret and is never added to the Next.js environment.
- Next.js calls functions through `src/lib/supabase/functions.ts`
  (`callEdgeFunction`, `callEdgeFunctionRaw`, `callAdminApi`).

Deploy:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy admin-api
npx supabase functions deploy store-api
npx supabase functions deploy fulfill-order
npx supabase functions deploy tracking-sync
```

Set the function secrets for deployed functions:

```bash
npx supabase secrets set CJ_API_KEY=... --project-ref <your-project-ref>
npx supabase secrets set \
  PAYMENT_PROVIDER=mock \
  PAYMENT_WEBHOOK_SECRET=... \
  RESEND_API_KEY=... \
  EMAIL_FROM="My Store <orders@yourdomain.com>" \
  SITE_URL=https://yourdomain.com \
  CRON_SECRET=... \
  --project-ref <your-project-ref>
```

For local `supabase start`, put the same values in
`supabase/functions/.env`. The Next.js `.env.local` needs
`PAYMENT_WEBHOOK_SECRET` with the **same** value so the dev-only mock payment
button can sign a webhook the edge function accepts. It also needs
`CRON_SECRET` with the same value as the function secret so `/api/cron/fulfill`
and `/api/cron/tracking` can call the workers.

Cron functions reuse `CRON_SECRET`; payment and CJ webhooks verify the provider
signature. No extra shared secret is needed.

## Step 1 — Project setup

Test: open `http://localhost:3000`. The page reads the `public.store`
setting from Supabase with the server (anon) client and shows the store name,
currency, and support email.

Commands:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Step 2 — Auth + roles

- Email/password signup, login, and logout via Supabase Auth.
- `getUser()`, `getProfile()`, `requireUser()`, and `requireAdmin()` live in
  `src/lib/auth.ts`.
- Profile rows are created by the `handle_new_user` trigger from `schema.sql`.

Test:

1. Visit `/signup`, create an account, then log in at `/login`.
2. Open `/account` — it shows your email, profile name, and role.
3. Promote yourself:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

4. Log out and back in, then open `/admin` — it loads only for admins.
5. A non-admin visiting `/admin` is redirected to `/`.
6. Logged-out users visiting `/account` or `/admin` are redirected to `/login`.

If email confirmation is enabled in Supabase, signup sends a confirmation link
that returns through `/auth/callback`. Otherwise signup logs you in directly.

## Step 3 — CJ client

- The shared CJ client is in `supabase/functions/_shared/cj/`.
- Auth uses `CJ_API_KEY` only. Tokens are cached in `supplier_tokens` for the
  deployed edge runtime.
- Request API notes and verified CJ docs details are in `docs/cj-notes.md`.

Run the smoke test with a real CJ API key:

```powershell
$env:CJ_API_KEY="..."
npm run cj:smoke
```

It prints the CJ balance, then 5 products with variant IDs and prices. The
script uses an in-memory token store; the deployed client uses
`supplier_tokens`.

## Step 4 — Product import (admin)

Deploy the updated admin function after pulling this step:

```bash
npx supabase functions deploy admin-api
```

Admin pages:

- `/admin/products` — imported products with status, variant count, and price.
- `/admin/products/import` — search the CJ catalog (`/product/listV2`), preview
  a product and its CJ costs/variants (`/product/query`), then select up to 20
  products and import them.
- `/admin/products/[id]` — edit title, description HTML, category, status,
  variant selling prices, and image order.

Import behavior:

- Creates `products` as `draft`, `product_variants` (selling price = CJ cost ×
  `settings.pricing.markup.multiplier`, rounded up to `round_to`), `product_images`,
  and `supplier_variants` with CJ `pid`/`vid` and cost.
- Re-importing the same CJ product is skipped.
- Failed imports clean up the partially created product.
- CJ cost is only returned to admin actions and never selected by the public
  storefront queries.

Public verification pages:

- `/products` lists only `active` products.
- `/products/[slug]` renders only `active` products and sanitizes description
  HTML with `sanitize-html` before rendering.

Test:

1. Log in as an admin and open `/admin/products/import`.
2. Search for a product, preview its variants, select it, and click
   **Import selected**.
3. Open `/admin/products`, edit the product, set **Status** to `active`, and save.
4. Open `/products` and `/products/[slug]` in a private window — the active
   product is visible.
5. Confirm no public response includes `supplier_variants`, `cost_price`, or CJ
   variant IDs. Only the admin editor shows cost.

## Step 5 — Storefront

Storefront pages are server-rendered and use the public (anon) Supabase client,
so only RLS-visible catalog rows are read. No supplier cost data is fetched or
rendered.

- `/` — store name, featured products (falls back to newest), category tiles,
  delivery window, and free-shipping threshold from `shipping_rates`.
- `/products` — search (Postgres `products.search` tsvector), category filter,
  and pagination. Filters live in the URL so they are shareable and work
  without JavaScript.
- `/products/[slug]` — image gallery, variant picker, stock status, shipping
  estimates, sanitized description, related products, `generateMetadata`,
  canonical URL, OpenGraph/Twitter tags, and Product JSON-LD.
- `/categories/[slug]` — category landing page with the same product grid and
  pagination.

Shared storefront code:

- `src/lib/catalog.ts` — public catalog queries and DTOs (no cost fields).
- `src/lib/utils.ts` — cents conversion, money formatting, slugify, HTML
  stripping.
- `src/components/shop/` — product card, grid, gallery, variant picker,
  search form, category chips, pagination.

Test:

1. Set a product to `active` in `/admin/products/[id]` and give it a category.
2. Open `/products` — search by title and filter by category; the URL keeps
   `q`, `category`, and `page`.
3. Open a product page — pick different variants and confirm price and stock
   update. View source: title, description, canonical URL, JSON-LD, and product
   content are present in the server HTML.
4. Open `/categories/[slug]` for the assigned category.
5. Run Lighthouse mobile on a product page (production build: `npm run build`
   then `npm start`) and confirm performance is at least 85.


## Step 6 — Cart + checkout + order creation

All privileged cart and order writes run in the `store-api` edge function. The
Next.js routes only validate input and forward the request.

- Cart identity is the httpOnly `cart_id` cookie (30 days). Guests get a cart;
  logged-in users get their Supabase user id attached when they add an item.
- `/api/cart` supports `add`, `update`, and `remove`. The server loads the
  variant, checks it is active and in stock, and stores only
  `variant_id` + `quantity`.
- `/api/checkout` validates the address with zod, then calls
  `store-api` `checkout.create`. The edge function:
  1. loads the cart and current variant prices,
  2. picks the shipping rate by country (falling back to `*`),
  3. validates the discount code and its limits,
  4. computes subtotal, shipping, discount, and total in integer cents,
  5. inserts `orders` (`pending_payment`), `order_items`, and
     `order_item_costs` from `supplier_variants.cost_price`,
  6. writes an internal `margin_guard` event when cost + allocated shipping is
     greater than or equal to the selling price.
- The Next route then calls `getPaymentProvider().createCheckout(...)`, saves
  `payment_provider` + `provider_checkout_id`, and clears the cart items. The
  cart is cleared only after the payment checkout is attached, so a failed
  retry does not lose the cart.
- `mock` is the only provider until the owner makes the payment decision. It
  redirects to the dev-only `/checkout/mock` page.

Test:

1. Deploy the function (`npx supabase functions deploy store-api`) and set the
   function secrets listed above.
2. Add a product to the cart, change the quantity, remove an item, and confirm
   the cart totals update.
3. Start checkout and confirm the order row is `pending_payment` with the
   expected subtotal/shipping/total in `numeric(12,2)`.
4. Send a checkout request with extra `price`/`total` fields — they are ignored;
   the server still uses DB prices.
5. Try an out-of-stock variant and confirm checkout is rejected.

## Step 7 — Payment webhook

`POST /api/webhooks/payment` reads the **raw** request body and forwards it,
byte-for-byte, with the provider signature headers to `store-api`
`payment.webhook`. The edge function:

1. verifies the signature with `PAYMENT_PROVIDER` + `PAYMENT_WEBHOOK_SECRET`
   before writing anything (invalid signature → `401`, no rows written),
2. inserts `webhook_events` and returns `200 { "status": "duplicate" }` on the
   unique `(provider, event_id)` conflict,
3. for `paid`, calls `mark_order_paid(...)`, which atomically inserts
   `payments` (unique provider payment id), marks the order paid, queues one
   `supplier_orders` row, and adds the public `paid` timeline event,
4. updates the webhook event to `processed`, `ignored`, or `failed`,
5. sends the confirmation email through Resend and kicks the fulfillment
   worker without blocking the webhook response.

`mismatch` and `ignored` leave the order for manual review and create internal
`order_events` rows; the admin dashboard shows them in step 11. A duplicate
payment id never sends a second email and never creates a second supplier order.

The mock page has a **Simulate successful payment** button. It signs a
deterministic `payment.paid` event (`eventId` and `paymentId` are derived from
the order id) with the same secret and sends it through the real webhook path.
Click it twice to test replay idempotency.

Test:

1. Set `PAYMENT_WEBHOOK_SECRET` in both `.env.local` and the edge function
   secrets (local functions read `supabase/functions/.env`).
2. Complete a checkout with the mock provider, then click **Simulate successful
   payment**. Confirm the success page shows `Payment confirmed`.
3. Check the database:

   ```sql
   select count(*) from public.payments where order_id = '<order-id>';       -- 1
   select count(*) from public.supplier_orders where order_id = '<order-id>'; -- 1
   select status, error from public.webhook_events order by received_at desc;
   ```

4. Click the button again. The response is `duplicate`; the counts above stay
   at 1 and no second email is sent.
5. Send an unsigned request and confirm `401` with no new `webhook_events` row:

   ```bash
   curl -i -X POST http://localhost:3000/api/webhooks/payment \
     -H "content-type: application/json" \
     -H "x-mock-signature: bad" \
     --data '{"eventId":"bad","type":"payment.paid","orderId":"<order-id>","paymentId":"bad","amountCents":1,"currency":"USD"}'
   ```

6. For an amount mismatch, sign a payload with a different amount and send it.
   The order stays `pending_payment`, a `payment_mismatch` internal event is
   added, and the webhook event records the review note.
7. If `RESEND_API_KEY` and `EMAIL_FROM` are set, confirm exactly one
   confirmation email. Otherwise the function logs that email is not configured
   and continues.

The fulfillment kick targets the `fulfill-order` worker added in step 8. Until
that function is deployed the supplier order stays `queued` and the step 8 cron
picks it up.

## Step 8 — Fulfillment to CJ

Paid orders are submitted to CJ by the `fulfill-order` edge function. The Next.js
app never talks to CJ directly.

Flow:

1. `mark_order_paid` creates one `supplier_orders` row (`queued`).
2. The payment webhook kicks `fulfill-order` immediately with the supplier order
   id. `/api/cron/fulfill` runs every 5 minutes as a safety net.
3. The worker claims a row with `claim_supplier_order(id)` (webhook kick) or
   `claim_supplier_orders(5)` (cron). Both increment `attempts` and push
   `next_attempt_at` forward, so two workers cannot process the same row.
4. `processSupplierOrder` loads the order, items, and `supplier_variants`, builds
   the CJ `createOrderV2` payload (`vid`, quantities, customer address,
   `payType=2`), and calls CJ.
5. On success `mark_supplier_order_submitted` atomically stores
   `supplier_order_id`, `request`, `response`, `supplier_cost_total`, sets the
   supplier row to `submitted`, the order to `fulfillment_status = 'submitted'`,
   and adds the public **Order sent to warehouse** event.
6. On failure the row stays `queued` with an exponential `next_attempt_at`
   (5, 10, 20, 40 minutes…). After `settings.fulfillment.cj.max_attempts` it
   becomes `failed`, the order becomes `fulfillment_status = 'failed'`, and an
   internal `fulfillment_failed` event is added.
7. CJ `1604000` / `1604001` (insufficient or restricted balance) fails
   immediately with a clear `fulfillment_balance_error` event instead of looping.
   Permanent errors (missing variant mapping, invalid payload, bad API key) also
   fail immediately.

Settings (`settings` table, key `fulfillment.cj`):

```json
{
  "auto_place_orders": true,
  "default_shipping_method": "CJPacket Ordinary",
  "max_attempts": 5,
  "from_country_code": "CN",
  "sandbox": false
}
```

`default_shipping_method` must be a CJ `logisticName`. The seed value is
`CJPacket`; replace it with a logistics name that CJ returns for your account
(for example `CJPacket Ordinary`). Set `sandbox: true` to send `isSandbox=1` if
sandbox orders are enabled on the CJ account. The `orderNumber` sent to CJ is our
own `orders.order_number`, so a retried request is idempotent (`1603003`
re-queries the existing CJ order instead of creating a second one).

Admin:

- `/admin/orders` lists recent orders with payment, fulfillment, and CJ status.
- `/admin/orders/[id]` shows the CJ order id, attempts, next attempt, supplier
  cost, error, and a **Retry CJ order** button for failed rows. Retrying resets
  attempts to 0, sets the row back to `queued`, and kicks the worker.

Cron:

- `src/app/api/cron/fulfill/route.ts` requires `Authorization: Bearer
  CRON_SECRET`, then calls the worker with the same secret.
- `vercel.json` schedules it every 5 minutes. Vercel sends `CRON_SECRET` as the
  bearer automatically when the env var is set. Tracking/stock cron entries are
  added in steps 9 and 10.
- `fulfill-order` is deployed with `verify_jwt = false`, so the Supabase gateway
  does not reject the non-JWT cron secret. The function checks the secret itself.

Deploy and test:

```bash
npx supabase functions deploy fulfill-order
npx supabase secrets set CRON_SECRET=... CJ_API_KEY=... --project-ref <your-project-ref>
```

1. Put the same `CRON_SECRET` in `.env.local` (and `supabase/functions/.env`
   for local functions).
2. Complete a checkout and simulate a successful payment (step 7).
3. Check the supplier row:

   ```sql
   select status, attempts, supplier_order_id, supplier_cost_total, error
     from public.supplier_orders
    where order_id = '<order-id>';
   ```

   It should be `submitted` with a CJ order id and stored request/response.

4. Confirm exactly one row exists for the order and that
   `orders.fulfillment_status = 'submitted'`.
5. Open `/admin/orders/<order-id>` and confirm the CJ panel and the public
   timeline event.
6. To test the cron path, queue a row and call:

   ```bash
   curl -i http://localhost:3000/api/cron/fulfill \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

   A request without the bearer returns `401`.
7. Transient CJ failures (network errors, `429`, or `5xx`) leave the row
   `queued` with an error and a future `next_attempt_at`; after `max_attempts`
   it becomes `failed`. Permanent failures (invalid payload, missing variant
   mapping, bad API key) fail immediately. To exercise the retry path, block
   the CJ host or return `503` from a test proxy, then fix the cause and click
   **Retry CJ order** on the admin page.
8. To test the balance alert, use a CJ account with a zero balance. The row
   becomes `failed` immediately with `cj_insufficient_balance` and the admin
   page shows the red balance alert.

## Step 9 — Tracking, order page, emails

The `tracking-sync` edge function keeps shipments and customer statuses up to
date. The Next.js app only calls it through a protected cron route.

Flow:

1. `/api/cron/tracking` requires `Authorization: Bearer CRON_SECRET`, then calls
   `tracking-sync` with the same secret. `vercel.json` runs it every 3 hours.
2. The worker loads `supplier_orders` in `submitted`, `confirmed`, or `shipped`
   with a CJ order id.
3. For each row it calls CJ `getOrderDetail` and, when a tracking number exists,
   `logistic/trackInfo` for the latest tracking status. CJ errors on one order
   do not stop the rest of the batch.
4. `apply_supplier_order_update` atomically:
   - upserts `shipments` on `(order_id, tracking_number)`
   - moves `supplier_orders.status` forward (`confirmed`, `shipped`,
     `delivered`, `cancelled`)
   - moves `orders.status` / `orders.fulfillment_status` forward without
     downgrading a delivered or refunded order
   - adds one public timeline event per tracking number (`order_shipped`,
     `order_delivered`, `order_cancelled`, `order_processing`)
5. When a new tracking number appears, the worker sends the **Your order has
   shipped** email and then sets `shipments.notified_at`. A retry after a failed
   send leaves `notified_at` empty, so the next run retries without sending a
   second email for the same tracking number.
6. `/orders/[orderNumber]` shows the public timeline, items, shipping address,
   totals, and tracking links. Guests use `?token=<order access token>`; signed-in
   customers can open the same URL without a token and `order.preview` authorizes
   by `user_id`. A wrong token or another customer's order returns `404`.
7. Emails live in `supabase/functions/_shared/email.ts` (the service-role key and
   `RESEND_API_KEY` never reach Next.js): order confirmation, shipped, and
   refund processed. Order links in emails use `SITE_URL` and include the guest
   access token. The spec's `src/lib/email.ts` path is intentionally replaced by
   this edge helper so the Resend key stays a Supabase function secret.

Deploy and test:

```bash
npx supabase functions deploy tracking-sync
npx supabase secrets set SITE_URL=https://yourdomain.com --project-ref <your-project-ref>
```

If your database already ran the original `schema.sql`, apply the
non-destructive migration instead of re-running the reset script:

```bash
npx supabase db push
```

or paste `supabase/migrations/20261031000000_fulfillment_tracking.sql` into the
Supabase SQL editor. It adds `shipments.notified_at`, the step 8 fulfillment
RPCs (`claim_supplier_order`, `mark_supplier_order_submitted`), and the step 9
`apply_supplier_order_update` RPC. It is safe to run more than once.

1. Make sure `SITE_URL` is set in the function secrets (or
   `supabase/functions/.env` locally) and `RESEND_API_KEY` / `EMAIL_FROM` are
   configured if you want real emails.
2. Simulate a CJ shipment by setting a tracking number on the CJ order (CJ
   sandbox or a test order), or temporarily mock `getOrderDetail` to return
   `orderStatus: "SHIPPED"` and a `trackNumber`.
3. Run the cron route manually:

   ```bash
   curl -i http://localhost:3000/api/cron/tracking \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

   Without the bearer it returns `401`. With it, the response includes
   `checked`, `updated`, `emailed`, and `failed` counts.

4. Check the database:

   ```sql
   select tracking_number, carrier, status, notified_at
     from public.shipments
    where order_id = '<order-id>';

   select status, fulfillment_status from public.orders where id = '<order-id>';
   ```

   The order should be `shipped` / `shipped`, and the shipment should have
   `notified_at` set after the email is sent.

5. Open the customer page with the order token:

   ```text
   http://localhost:3000/orders/<order-number>?token=<access-token>
   ```

   The timeline shows **Your order has shipped** and the tracking link appears.
   Remove or change the token and the page returns `404`.

6. Run the cron a second time. The shipment row must not change, and
   `notified_at` must stay set (no second email). A second tracking number on
   the same order produces its own shipment row and its own email.

7. Signed-in customers can open `/orders/<order-number>` without a token. A
   different customer's order number returns `404`.

8. The refund email template (`sendRefundProcessedEmail`) is ready for step 11's
   refund flow; no refund action calls it yet.
