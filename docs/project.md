# project.md — CJ Dropshipping Store (Next.js + Supabase)

> Instructions for the AI building this app. Read fully before writing code.
> Build in the numbered steps below, in order. Finish and verify each step before starting the next.
> Do not add features that are not listed. Ask the owner when something is marked **DECISION**.

---

## 0. What we are building

A custom storefront that sells products to customers in the **USA and UK** (and similar countries).
Products are sourced from **CJ Dropshipping** through its official API. When a customer pays,
the app automatically places the order at CJ, then tracks shipment and shows tracking to the customer.

The owner is based in **Cambodia**. This drives the payment decision (see section 3).

**Money flow:** customer pays → payment provider → owner. Separately, the owner pays CJ from the
CJ account balance. The app must never place a CJ order before payment is confirmed by a verified webhook.

## 1. Tech stack (fixed)

- Next.js (latest stable), App Router, TypeScript (strict)
- Tailwind CSS
- Supabase (Postgres, Auth, RLS). Client libs: `@supabase/supabase-js`, `@supabase/ssr`
- Validation: `zod`
- Email: Resend (transactional emails) — **DECISION: confirm with owner before step 9**
- Hosting: Vercel (note: check the plan allows commercial use) — **DECISION**
- Package manager: npm

Database is defined in `schema.sql` (already written, run once in Supabase SQL Editor). Do **not** change table
names or columns without telling the owner. If a change is needed, output the SQL migration separately.

## 2. Hard rules (never break these)

1. **Secrets are server-only.** `SUPABASE_SERVICE_ROLE_KEY`, CJ credentials, payment secrets, `CRON_SECRET` must never be imported in client components or prefixed with `NEXT_PUBLIC_`. Put server-only code in files that start with `import "server-only"`.
2. **Never trust prices from the browser.** The client sends only `variant_id` + `quantity` + shipping address + shipping rate name + optional discount code. The server loads prices, shipping, discount from the DB and computes all totals.
3. **Idempotency everywhere.** Payment webhooks can arrive twice; CJ calls can be retried. Use `webhook_events` (unique provider+event_id), `payments` (unique provider+provider_payment_id), `supplier_orders` (unique order_id+supplier) and the SQL function `mark_order_paid`. Never create two CJ orders for one order.
4. **Verify webhook signatures** before touching the DB. Use the raw request body (`await req.text()`), compare with timing-safe equality.
5. **Costs are private.** `supplier_variants`, `order_item_costs`, `supplier_orders`, `payments` are service-role only. Never select them in code that runs with the anon/user client, and never return them in API responses to customers.
6. **Admin = server-side check.** Admin pages/routes call `requireAdmin()` (checks `profiles.role = 'admin'` using the session user) and then use the service-role client.
7. **Guest checkout is allowed.** Guests view an order via `/orders/[orderNumber]?token=<access_token>`, validated server-side with the service-role client. Logged-in users see their own orders via RLS.
8. All DB writes for orders, payments, fulfillment go through server code (route handlers / server actions). No direct client writes.
9. Money is `numeric(12,2)` in the DB. In TypeScript use integer **cents** for math (convert at the DB boundary), never floating-point dollars.
10. Do not guess CJ API endpoints, field names or auth flow. **Read the official CJ Dropshipping developer docs** (search "CJ Dropshipping API developer documentation") and implement exactly what they specify. If the docs are unclear, stop and ask the owner. Save any request/response examples you learn into `docs/cj-notes.md`.

## 3. Payments — IMPORTANT

**Lemon Squeezy cannot be used.** Its prohibited-products policy lists "physical goods of any kind", and it reviews stores and rejects or suspends those selling goods fulfilled outside Lemon Squeezy. A dropshipping store would be rejected or suspended. Do not integrate it.

Stripe does not onboard businesses located in Cambodia directly, and PayPal in Cambodia has withdrawal limits. The owner must pick a working route first. Possible routes (the owner verifies each):

- A US company (e.g. via Stripe Atlas) with Stripe + a US business bank account, with payouts onward to the owner (e.g. Payoneer)
- Another payment provider that accepts Cambodian merchants selling physical goods

**DECISION (owner): which provider.** Until decided, build against the interface below and use the `mock` provider.

### Payment abstraction (build this in step 6)

```ts
// src/lib/payments/types.ts
export type CreateCheckoutInput = {
  orderId: string;
  orderNumber: string;
  email: string;
  currency: string;
  amountCents: number;
  items: { title: string; quantity: number; unitAmountCents: number }[];
  shippingCents: number;
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutResult = { checkoutId: string; redirectUrl: string };

export type VerifiedPaymentEvent =
  | { kind: "paid"; eventId: string; orderId: string; paymentId: string; amountCents: number; currency: string; raw: unknown }
  | { kind: "failed"; eventId: string; orderId: string; raw: unknown }
  | { kind: "refunded"; eventId: string; orderId: string; paymentId: string; amountCents: number; raw: unknown }
  | { kind: "ignored"; eventId: string; raw: unknown };

export interface PaymentProvider {
  name: string; // stored in orders.payment_provider
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedPaymentEvent>; // throws if signature invalid
}
```

`src/lib/payments/index.ts` exports `getPaymentProvider()` which reads `PAYMENT_PROVIDER` env (`mock` | provider name).
The `mock` provider redirects to `/checkout/mock?order=...` where a dev-only button simulates a paid webhook (only enabled when `NODE_ENV !== "production"`).

## 4. Project structure

```
my-store/
├─ schema.sql
├─ project.md
├─ docs/
│  └─ cj-notes.md                 # API notes you learn from CJ docs
├─ .env.local                     # never commit
├─ .env.example
├─ vercel.json                    # cron schedules
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                          # home: featured + categories
│  │  ├─ (shop)/
│  │  │  ├─ products/page.tsx              # list, search, category filter, pagination
│  │  │  ├─ products/[slug]/page.tsx       # product detail (SSR, JSON-LD, variant picker)
│  │  │  ├─ categories/[slug]/page.tsx
│  │  │  ├─ cart/page.tsx
│  │  │  ├─ checkout/page.tsx
│  │  │  ├─ checkout/success/page.tsx
│  │  │  ├─ checkout/mock/page.tsx         # dev only
│  │  │  └─ orders/[orderNumber]/page.tsx  # guest (token) + logged-in view
│  │  ├─ (account)/
│  │  │  ├─ login/page.tsx
│  │  │  ├─ signup/page.tsx
│  │  │  └─ account/page.tsx               # profile, addresses, orders
│  │  ├─ (legal)/
│  │  │  ├─ shipping-policy/page.tsx
│  │  │  ├─ refund-policy/page.tsx
│  │  │  ├─ privacy/page.tsx
│  │  │  ├─ terms/page.tsx
│  │  │  └─ contact/page.tsx
│  │  ├─ admin/
│  │  │  ├─ layout.tsx                     # requireAdmin()
│  │  │  ├─ page.tsx                       # dashboard: orders today, revenue, profit, failed CJ orders
│  │  │  ├─ orders/page.tsx
│  │  │  ├─ orders/[id]/page.tsx           # timeline, retry CJ order, refund, cancel
│  │  │  ├─ products/page.tsx
│  │  │  ├─ products/import/page.tsx       # search CJ catalog → import
│  │  │  ├─ products/[id]/page.tsx         # edit title, desc, images, price, status
│  │  │  ├─ categories/page.tsx
│  │  │  ├─ shipping/page.tsx
│  │  │  └─ settings/page.tsx
│  │  ├─ api/
│  │  │  ├─ cart/route.ts
│  │  │  ├─ checkout/route.ts              # create order + payment checkout
│  │  │  ├─ webhooks/payment/route.ts
│  │  │  ├─ webhooks/cj/route.ts           # only if CJ offers webhooks; otherwise rely on cron
│  │  │  └─ cron/
│  │  │     ├─ fulfill/route.ts            # claim queued supplier_orders → create CJ orders
│  │  │     ├─ tracking/route.ts           # poll CJ for tracking/status
│  │  │     └─ stock/route.ts              # sync stock + CJ cost changes
│  ├─ components/
│  │  ├─ ui/                               # Button, Input, Badge, Modal...
│  │  ├─ shop/                             # ProductCard, VariantPicker, CartDrawer, PriceTag
│  │  └─ admin/
│  ├─ lib/
│  │  ├─ supabase/
│  │  │  ├─ client.ts                      # browser client (anon)
│  │  │  ├─ server.ts                      # server client (cookies, anon + user session)
│  │  │  └─ admin.ts                       # service-role client ("server-only")
│  │  ├─ cj/
│  │  │  ├─ client.ts                      # auth, token cache in supplier_tokens, fetch wrapper, retries
│  │  │  ├─ products.ts                    # search/list/detail
│  │  │  ├─ orders.ts                      # createOrder, getOrder
│  │  │  ├─ tracking.ts
│  │  │  └─ types.ts
│  │  ├─ payments/                         # see section 3
│  │  │  ├─ types.ts
│  │  │  ├─ index.ts
│  │  │  └─ providers/mock.ts
│  │  ├─ pricing.ts                        # markup rules, rounding, totals (cents)
│  │  ├─ orders.ts                         # createOrderFromCart, computeTotals, cancel
│  │  ├─ fulfillment.ts                    # processSupplierOrder(), retry/backoff
│  │  ├─ email.ts
│  │  ├─ auth.ts                           # getUser(), requireAdmin()
│  │  ├─ env.ts                            # zod-validated env
│  │  └─ utils.ts                          # money formatting, slugify
│  └─ types/
│     └─ database.ts                       # generated: npx supabase gen types typescript
└─ middleware.ts                           # Supabase session refresh
```

## 5. Environment variables (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# CJ_API_KEY is a Supabase Edge Function secret, not a Next.js env var.
# See section 11.

PAYMENT_PROVIDER=mock
PAYMENT_WEBHOOK_SECRET=
PAYMENT_API_KEY=

RESEND_API_KEY=
EMAIL_FROM="My Store <orders@yourdomain.com>"

CRON_SECRET=                # long random string; cron routes require "Authorization: Bearer <CRON_SECRET>"
```

`src/lib/env.ts` validates these with zod and throws a clear error at startup if missing.

## 6. Build steps

### Step 1 — Project setup
- `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir`
- Install: `@supabase/supabase-js @supabase/ssr zod server-only`
- Create `env.ts`, `.env.example`, supabase clients (`client.ts`, `server.ts`, `admin.ts`), `middleware.ts`.
- Generate DB types into `src/types/database.ts`.
- **Done when:** `npm run dev` runs; a test server component can read `settings` key `public.store`.

### Step 2 — Auth + roles
- Email/password signup, login, logout (Supabase Auth). Profile row is auto-created by DB trigger.
- `getUser()` and `requireAdmin()` in `lib/auth.ts`.
- **Done when:** a user can sign up/log in; after the owner runs the `update profiles set role='admin'` SQL, `/admin` opens for them and redirects everyone else.

### Step 3 — CJ client
- Implement `supabase/functions/_shared/cj/client.ts` per the **official CJ docs**: authentication, token caching in `supplier_tokens` (refresh before expiry), a fetch wrapper with timeout, retry with backoff on 5xx/429, and typed errors. Respect CJ rate limits.
- Implement `products.ts` (search/list/detail with variants), `orders.ts` (create, get), `tracking.ts`.
- Create `scripts/cj-smoke.ts` that authenticates and lists 5 products.
- Write findings to `docs/cj-notes.md`.
- **Done when:** the smoke script prints 5 products with variant ids and prices.

### Step 4 — Product import (admin)
- `/admin/products/import`: search CJ catalog, preview, choose products, click Import.
- Import creates: `products` (status `draft`), `product_variants` (price = cost × markup from `settings.pricing.markup`, rounded per rule), `product_images`, and `supplier_variants` (cost, CJ ids).
- `/admin/products/[id]`: edit title, description, images order, variant prices, category, status (draft/active/archived). Sanitize description HTML on render.
- **Done when:** importing a CJ product shows it in `/admin/products`; setting it `active` makes it appear on the public site; cost is NOT visible in any public API response.

### Step 5 — Storefront
- Home, product list (search via `products.search` tsvector, category filter, pagination), product detail (SSR, variant picker, image gallery, `generateMetadata`, Product JSON-LD), category pages.
- Server-rendered, fast, mobile-first. Show estimated delivery from `shipping_rates`.
- **Done when:** Lighthouse mobile performance ≥ 85 on product page; pages render without JS for crawlers.

### Step 6 — Cart + checkout + order creation
- Cart via `carts`/`cart_items` (cookie `cart_id`, httpOnly). API: add, update quantity, remove. Validate variant is active and stock isn't 0.
- `/api/checkout` (POST): validate with zod → load variants → check price/stock → pick shipping rate by country → validate discount code → compute totals in cents → insert `orders` (status `pending_payment`) + `order_items` + `order_item_costs` (from `supplier_variants.cost_price`) → `getPaymentProvider().createCheckout(...)` → save `payment_provider`, `provider_checkout_id` → return redirect URL.
- Margin guard: if estimated cost (+ shipping cost estimate) ≥ selling price for any item, add an `order_events` row (internal) and still allow the order but flag it in admin.
- Build payment abstraction + `mock` provider (section 3).
- **Done when:** with the mock provider a full checkout creates a pending order with correct totals, and tampering with prices in the request has no effect.

### Step 7 — Payment webhook
- `/api/webhooks/payment` (POST): read raw body → `provider.verifyWebhook` → insert into `webhook_events` (unique conflict ⇒ return 200 "duplicate") → if `paid`: call RPC `mark_order_paid(...)` → mark webhook event `processed` (or `failed` with error) → return 200 quickly.
- RPC returns `paid | duplicate | mismatch | ignored`; handle `mismatch`/`ignored` by leaving the order for manual review (admin sees the internal event).
- On `paid`, send confirmation email and trigger fulfillment (call the same function the cron uses, don't block the webhook response on failure).
- **Done when:** replaying the same webhook twice produces exactly one payment row, one supplier_orders row, and one email.

### Step 8 — Fulfillment to CJ
- `lib/fulfillment.ts` → `processSupplierOrder(row)`: load order + items + `supplier_variants`, map to CJ order payload per docs (customer address, CJ variant ids, quantities, shipping method from `settings.fulfillment.cj`), call CJ createOrder, store `request`/`response`, set `supplier_order_id`, `supplier_cost_total`, status `submitted`, order `fulfillment_status = 'submitted'`, add public timeline event "Order sent to warehouse".
- On error: store `error`, set `status = 'queued'` with exponential `next_attempt_at` until `max_attempts`, then `status = 'failed'`, order `fulfillment_status = 'failed'`, internal event (admin dashboard shows a red alert).
- `/api/cron/fulfill`: requires `Authorization: Bearer CRON_SECRET`; calls RPC `claim_supplier_orders(5)` and processes each.
- Check CJ account balance errors explicitly (insufficient balance must produce a clear admin alert, not a silent retry loop).
- Admin order page: "Retry CJ order" button for failed rows.
- **Done when:** a paid test order results in exactly one CJ order (use CJ sandbox/test if available, otherwise a real low-cost order shipped to the owner).

### Step 9 — Tracking + emails
- `/api/cron/tracking`: for `supplier_orders` in `submitted/confirmed/shipped`, query CJ for status/tracking; upsert `shipments`; update `orders.status/fulfillment_status`; add public events; send "Your order has shipped" email with tracking link (once per tracking number).
- Emails (Resend): order confirmation, shipped, refund processed. Plain, clean HTML templates in `src/lib/email.ts`.
- Order page `/orders/[orderNumber]` shows timeline (public events), items, shipping address, tracking link.
- **Done when:** a tracking number appearing in CJ shows up on the customer order page and triggers exactly one email.

### Step 10 — Stock & cost sync
- `/api/cron/stock` (every 6 hours): update `product_variants.stock` and `supplier_variants.cost_price` from CJ. If cost rose such that margin < threshold (`settings`), flag the variant in admin and optionally auto-reprice using markup rules. Disable variants that CJ reports as unavailable.
- **Done when:** changing stock in the CJ response (mocked) updates the storefront within one cron run.

### Step 11 — Admin dashboard
- Dashboard cards: orders today, revenue (7/30 days), profit from `v_order_profit`, failed CJ orders, orders needing review (payment mismatch).
- Orders list with filters (status, date), order detail with full timeline, internal events, cancel (only before CJ submit), refund request (record in `refunds`; actual provider refund per provider capability).
- Categories, shipping rates, discount codes, settings pages (simple CRUD).
- **Done when:** the owner can run the store day-to-day without touching the DB.

### Step 12 — Legal pages, SEO, launch checklist
- Shipping policy (state honest delivery windows, e.g. 7–25 days), refund policy, privacy, terms, contact page with a working support email. Ad platforms and payment providers check these.
- `sitemap.xml`, `robots.txt`, OpenGraph tags, canonical URLs.
- Launch checklist (output as `docs/launch-checklist.md`): domain + SPF/DKIM for email, RLS verified, service-role key not in client bundle, cron secrets set, real test order end-to-end, refund tested, 404/error pages, analytics.

## 7. Cron schedule (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/fulfill",  "schedule": "*/5 * * * *" },
    { "path": "/api/cron/tracking", "schedule": "0 */3 * * *" },
    { "path": "/api/cron/stock",    "schedule": "0 */6 * * *" }
  ]
}
```

Note: Vercel cron limits depend on plan. If limits are too tight, use Supabase `pg_cron` + `pg_net` to call the same routes with the `CRON_SECRET` header. Cron routes must reject requests without the bearer secret.

## 8. Coding standards

- TypeScript strict, no `any` (use `unknown` + zod parsing for external data: CJ responses, webhooks).
- Every route handler validates input with zod and returns consistent JSON errors `{ error: string }` with proper status codes.
- Never log secrets, full card data (we never receive it), or full webhook bodies containing personal data in production logs.
- Small, single-purpose functions; business logic in `lib/`, not in route handlers or components.
- Server Components by default; Client Components only for interactivity (variant picker, cart drawer, forms).
- Accessible, mobile-first UI; Tailwind only; consistent spacing and a restrained, modern look.
- After each step: run `npm run lint` and `npm run build`; fix all errors before moving on.
- Write a short `README.md` section per step describing how to test it.

## 9. Testing checklist (run before launch)

1. Tampered checkout request (changed price/qty) → totals still correct.
2. Same payment webhook sent twice → one payment, one CJ order, one email.
3. Invalid webhook signature → 401, nothing written.
4. Amount mismatch → order stays pending, internal alert created.
5. CJ API down → order retries with backoff, then flagged failed; retry button works.
6. CJ insufficient balance → clear admin alert.
7. Customer A cannot read customer B's orders (RLS test with two accounts).
8. Anonymous user cannot read `supplier_variants`, `payments`, `supplier_orders`, `order_item_costs`.
9. Guest order link with wrong token → 404.
10. Out-of-stock variant cannot be checked out.

## 10. Known risks (keep in mind while building)

- **Payments from Cambodia** are the largest business risk; the payment provider must explicitly allow physical goods and Cambodian merchants.
- **Margins:** CJ shipping + payment fees + ads can erase profit. Always show profit per order in admin.
- **Delivery times** from CJ are long; policies and product pages must state them honestly to avoid chargebacks.
- **Chargebacks/disputes:** keep order timeline, tracking proof, and customer emails stored per order.

---

## 11. Architecture update — Supabase Edge Functions (owner decision)

This supersedes section 4 (`lib/supabase/admin.ts`) and the service-role parts of
step 6-11 where they conflict.

- The Next.js app **never** receives `SUPABASE_SERVICE_ROLE_KEY` or
  `CJ_API_KEY`. Remove them from `.env.local` and never add them to Vercel.
  `CJ_API_KEY` is a Supabase function secret (`supabase secrets set`).
- CJ auth uses only `apiKey`; there is no email/password login and no
  `CJ_EMAIL`.
- All privileged operations run in Supabase Edge Functions in `supabase/functions/`.
  The Supabase runtime injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` into the functions.
- `admin-api` handles admin CRUD: it verifies the caller's JWT, checks
  `profiles.role = 'admin'` with the service-role client, then performs the action.
- The CJ client (step 3) lives in `supabase/functions/_shared/cj/`, not
  `src/lib/cj/`, so `CJ_API_KEY` never enters the Next.js runtime.
- Future steps add functions for checkout/order creation, payment webhooks, CJ
  fulfillment/tracking/stock, and guest order lookup. Next.js route handlers stay
  thin (validation + calls into `src/lib/supabase/functions.ts`).
- Cron-invoked functions require `Authorization: Bearer <CRON_SECRET>`. Payment
  and CJ webhooks verify the provider signature. Add another shared secret only
  if a future server-to-server function genuinely needs one.
- Public reads (active catalog, own orders) keep using RLS with the user/anon client.
- After each step, deploy changed functions:
  `npx supabase functions deploy <name> --project-ref <ref>`.
