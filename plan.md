# Refactor Plan: Next.js → React + TypeScript (Vite SPA)

Status: **IN PROGRESS — Phase 6 complete (web/ flattened to root), Phase 7 next**
Created: 2026-11-06
Scope: replace the Next.js frontend with a simpler React + TypeScript app.
Backend (Supabase Postgres, RLS, Edge Functions) and the database schema stay.

### Confirmed decisions

- **Frontend:** Vite + React SPA (client-rendered).
- **Backend:** keep the existing Supabase Edge Functions.
- **Hosting:** Vercel (static SPA + rewrite; workers scheduled with Supabase Cron).
- **Migration style:** build in `web/`, keep Next running, flatten at cutover.
- **Admin URL:** keep `/admin`.

---

## 1. Goal

Make the app a plain React + TypeScript single-page app that is easier to reason
about:

- No React Server Components, server actions, route handlers, middleware/proxy,
  `next/headers`, `next/cache`, or `next/image`.
- One frontend runtime: Vite dev server + static build.
- One data path: the browser talks to Supabase (anon key + RLS) and to the
  existing Edge Functions for privileged work.
- Keep the existing business logic in `supabase/functions/` untouched where
  possible.

### Success criteria

- All existing routes and flows still work:
  storefront, search, product detail, cart, checkout, manual payment page,
  guest order tracking, auth, account, admin products/import/orders,
  mark-paid, retry CJ.
- `npm run lint`, `tsc --noEmit`, and `vite build` pass.
- The service-role key is still never present in frontend code or env.
- No regression in the CJ fulfillment, manual payment, email, webhook, or cron
  behavior.
- The new app can be deployed as static files with SPA rewrites.

---

## 2. Non-goals

- No database schema rewrite and no RLS redesign.
- No rewrite of CJ integration, fulfillment, tracking, stock sync, or email.
- No new payment provider. `manual` stays the default; `mock` stays dev-only.
- No visual redesign. Port the existing Tailwind markup as-is.
- No change to admin API contracts (`admin-api`, `store-api` actions).

---

## 3. Architecture decision

### Recommended: Vite + React Router (SPA) + Supabase

| Layer | Current | Target |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Vite + React 19 + TypeScript |
| Rendering | RSC + SSR | Client-side SPA |
| Routing | file-based `src/app` | React Router `createBrowserRouter` |
| Server state | RSC fetches + `revalidatePath` | TanStack Query |
| Auth | `@supabase/ssr` cookies + middleware | `@supabase/supabase-js` browser session |
| Cart identity | httpOnly `cart_id` cookie | `localStorage` cart id |
| Privileged calls | Next server → Edge Functions | Browser → Edge Functions (JWT) |
| Public catalog | Next server + anon client | Browser + anon client (RLS) |
| Webhook | `/api/webhooks/payment` proxy | Supabase function URL directly |
| Cron | Next routes + `vercel.json` | Supabase Cron (`pg_cron` + `pg_net`) |
| Hosting | Vercel + Next | Vercel static SPA (`dist` + rewrite) |
| Styling | Tailwind v4 | Tailwind v4 (same) |
| Images | `next/image` | `<img>` + small `SmartImage` wrapper |
| HTML sanitize | `sanitize-html` (server) | `dompurify` (browser) |

### Why this is simpler

- One mental model: React components, hooks, and async functions.
- No server/client boundary rules, no `"use server"`, no cache invalidation
  semantics.
- The frontend is static and can be hosted anywhere (Vercel, Netlify, Cloudflare
  Pages, S3).
- Supabase already exposes the public data through RLS; the privileged API
  already exists as Edge Functions.

### Trade-off that must be accepted

**SEO.** Client-rendered product pages are weaker for search engines and social
previews than server-rendered pages. For a dropshipping store, organic search and
link previews matter.

Mitigations, in order of effort:

1. Add `react-helmet-async` (or equivalent) for titles, meta, canonical, OG, and
   Product JSON-LD. Works for users/social crawlers that execute JS, but not all
   crawlers.
2. Add build-time prerendering for static routes (`/`, `/products` shell,
   `/login`, etc.). Dynamic product/category pages still need runtime data.
3. If SEO is a hard requirement, use **React Router framework mode (SSR)**
   instead of SPA. The rest of this plan (data layer, edge functions, cart,
   auth, admin) is almost identical; loaders replace React Query for initial
   page data. This is more complex than an SPA.

**Confirmed:** an SPA is acceptable for this project. SEO work is limited to
Helmet metadata + JSON-LD and a generated sitemap; revisit SSR only if organic
search becomes a priority later.

### Alternative considered and rejected

- **Keep Next.js and simplify internals**: does not meet the "plain React TS"
  request and keeps the Next-specific APIs the owner wants to avoid.
- **Single Node/Express server**: duplicates the existing Edge Functions and
  adds session/security/deployment work for no business benefit.

---

## 4. Current architecture inventory

### Next-specific features in use

- RSC pages and async data fetching (`src/app/**/page.tsx`).
- Server actions: `src/lib/auth-actions.ts`, `src/lib/admin-products-actions.ts`,
  `src/app/admin/orders/[id]/actions.ts`, `src/app/(shop)/checkout/mock/actions.ts`.
- Route handlers: `src/app/api/cart`, `src/app/api/checkout`,
  `src/app/api/webhooks/payment`, `src/app/api/cron/*`, `src/app/auth/callback`.
- Auth/session cookies and refresh: `src/lib/supabase/server.ts`,
  `src/lib/supabase/client.ts`, `src/proxy.ts`.
- Cart via httpOnly cookie: `src/lib/cart.ts`.
- Next APIs: `next/link`, `next/image`, `next/navigation`, `next/headers`,
  `next/cache`, `next/server` (`connection`), `next/font/google`, `Metadata`.
- Static config: `next.config.ts`, `vercel.json`, `eslint-config-next`.

### Backend that stays

- All of `supabase/functions/**`.
- All of `supabase/migrations/**` and `schema.sql`.
- Supabase Auth, RLS policies, `mark_order_paid`, fulfillment RPCs.
- `admin-api`, `store-api`, `fulfill-order`, `tracking-sync`, `stock-sync`,
  `cj-webhook`.

Edge functions already return CORS headers for browser calls
(`supabase/functions/_shared/http.ts`), including `OPTIONS` handling.

---

## 5. Target project structure

Start in a `web/` folder so the Next app keeps working during the migration.
Flatten `web/` to the repository root at cutover (optional; see Phase 8).

```text
web/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  eslint.config.js
  public/
  src/
    main.tsx
    App.tsx
    router.tsx
    index.css
    components/
      layout/            # header, footer, admin shell, cart feedback
      shop/              # ported storefront components
      ui/                # button, input, spinner, etc.
    features/
      auth/
      catalog/
      cart/
      checkout/
      orders/
      admin/
    lib/
      supabase.ts        # browser client (anon)
      functions.ts       # edge function caller
      env.ts
      money.ts
      sanitize.ts        # DOMPurify
      site.ts
      query-client.ts
    types/
      database.ts
      cart.ts
      order.ts
    pages/
      storefront/
      account/
      admin/
```

### Route map (URLs unchanged)

Storefront:

- `/` → `pages/storefront/home.tsx`
- `/products` → `pages/storefront/products.tsx`
- `/products/:slug` → `pages/storefront/product.tsx`
- `/categories/:slug` → `pages/storefront/category.tsx`
- `/cart` → `pages/storefront/cart.tsx`
- `/checkout` → `pages/storefront/checkout.tsx`
- `/checkout/manual` → `pages/storefront/checkout-manual.tsx`
- `/checkout/mock` → `pages/storefront/checkout-mock.tsx` (dev only)
- `/checkout/success` → `pages/storefront/checkout-success.tsx`
- `/orders/:orderNumber` → `pages/storefront/order.tsx`

Auth/account:

- `/login`, `/signup`, `/auth/callback`, `/account`

Admin:

- `/admin` → dashboard
- `/admin/products` → list
- `/admin/products/:id` → editor
- `/admin/products/import` → CJ import
- `/admin/orders` → list
- `/admin/orders/:id` → detail + mark paid/retry

Add a catch-all `*` route (404 page) and scroll restoration.

---

## 6. Data layer

### 6.1 Supabase browser client

`src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
```

- Only the anon key is shipped. Never add `SUPABASE_SERVICE_ROLE_KEY`.
- Public catalog queries move from `src/lib/catalog.ts` almost verbatim, using
  this browser client.
- Verify the same RLS-visible tables: `products`, `product_variants`,
  `product_images`, `categories`, `shipping_rates`, `settings` (`public.%`).

### 6.2 Edge function caller

Port `src/lib/supabase/functions.ts` to the browser:

- Remove `server-only`, `next` imports, and the server Supabase client.
- Resolve the token with `supabase.auth.getSession()`; guests use the anon key
  as `Authorization: Bearer` (same behavior as today).
- Keep `callEdgeFunction` and `callAdminApi`.
- Drop `callEdgeFunctionRaw` (only used by the removed webhook route).

### 6.3 Server state

Use **TanStack Query** instead of RSC caching + `revalidatePath`.

Suggested query keys:

- `["settings"]`, `["payment-instructions"]`
- `["categories"]`, `["shipping-rates"]`
- `["products", filters]`, `["product", slug]`
- `["cart"]`
- `["order", orderNumber, token]`
- `["admin", "dashboard"]`, `["admin", "orders"]`, `["admin", "order", id]`
- `["admin", "products"]`, `["admin", "product", id]`
- `["admin", "cj-search", query, page]`, `["admin", "cj-product", pid]`

Mutations invalidate the relevant keys (`cart`, `admin.products`,
`admin.orders`, `admin.order`). This replaces `revalidatePath`.

### 6.4 Cart (cookie → localStorage)

- Store the cart UUID under `localStorage["cart_id"]`.
- `getCartId()` validates the UUID shape (reuse the existing regex).
- `cart.get/add/update/remove` call `store-api` directly with `cartId`.
- On `cart.add` with no cart id, the edge function returns a new `cartId`; save
  it.
- Keep the existing `CartFeedback` UI; replace `fetch("/api/cart")` with the
  cart module + query invalidation.
- This removes `src/app/api/cart/route.ts` and `src/lib/cart.ts` server code.

### 6.5 Auth

- `AuthProvider` wraps the app, subscribes to `supabase.auth.onAuthStateChange`,
  and exposes `user`, `session`, `loading`.
- `useProfile()` queries `profiles` for the current user.
- `RequireAuth` / `RequireAdmin` route elements redirect to
  `/login?next=...` or `/`.
- Sign in/up/out become plain async functions:
  `supabase.auth.signInWithPassword`, `signUp`, `signOut`.
- Sign-up keeps `emailRedirectTo: `${siteUrl()}/auth/callback``.
- `/auth/callback` renders a small "Signing you in…" page and redirects to
  `next`/`/account`. Supabase JS handles the code exchange when
  `detectSessionInUrl` is on; if not, call `exchangeCodeForSession`.
- UX guard only. `admin-api` still verifies the JWT and `profiles.role` on every
  call.

### 6.6 Checkout and payment

- Port `checkout-form.tsx` as-is (it already uses React state).
- Replace `fetch("/api/checkout")` with a `startCheckout(input)` module:
  1. `checkout.create` → `{ orderId, accessToken, orderNumber, ... }`
  2. `checkout.startPayment` with `{ orderId, accessToken, cartId }`
  3. `window.location.assign(redirectUrl)`.
- `manual` redirects to `/checkout/manual?order=...&token=...`; that page reads
  `public.payment_instructions` and `store-api` `order.preview`.
- `mock` page calls `store-api` `payment.mockPay` directly, then navigates to
  the success page. Remove the server action.
- Remove `src/app/api/checkout/route.ts`.
- Validation remains in the edge functions; keep light Zod checks in the client
  for immediate feedback.

### 6.7 Admin

- Port admin pages to route components with TanStack Query.
- Replace server actions with async functions:
  - `products.import`, `products.update`
  - `orders.markPaid`, `orders.retryFulfillment`
  - `cj.search`, `cj.product`
- Replace `useActionState` + form actions with `useState` / `useTransition` and
  plain submit handlers.
- After mutations, invalidate queries instead of `revalidatePath`.
- Admin navigation shell becomes a layout route with `<Outlet />`.

### 6.8 Webhooks and cron

Webhook:

- Point the payment provider (future real provider) at:
  `https://<project>.supabase.co/functions/v1/store-api?action=payment.webhook`
- Signature verification and raw-body handling already live in `store-api`.
- `manual` has no webhook; `mock` uses `payment.mockPay` from the browser.
- Delete `src/app/api/webhooks/payment/route.ts`.

Cron (recommended):

- Use Supabase Cron (`pg_cron` + `pg_net`) to POST directly to
  `fulfill-order`, `tracking-sync`, and `stock-sync` with
  `Authorization: Bearer <CRON_SECRET>`.
- Store the secret in Supabase Vault; do not put it in the frontend.
- Schedules stay: fulfill `*/5 * * * *`, tracking `0 */3 * * *`, stock
  `0 */6 * * *`.
- Delete `src/app/api/cron/*` and `vercel.json` crons.
- Alternative if Supabase Cron is not available: GitHub Actions / external cron
  making the same POST requests.

---

## 7. UI, assets, and SEO

### Replacements

| Next | React |
| --- | --- |
| `next/link` | `Link` from `react-router-dom` |
| `next/image` | `<img>` + `SmartImage` (lazy, async decode, `object-cover`) |
| `next/navigation` (`useRouter`, `usePathname`) | `useNavigate`, `useLocation` |
| `useSearchParams` | `useSearchParams` from `react-router-dom` |
| `notFound()` | 404 route / `<Navigate>` |
| `next/font/google` | `@fontsource-variable/geist` + `geist-mono` |
| `Metadata` export | `Seo` component (Helmet) |
| `revalidatePath` | React Query invalidation |
| `redirect()` | `<Navigate>` or `navigate()` |
| `connection()` | not needed |
| `Suspense` for RSC | React Query `isLoading` or `<Suspense>` with query |
| `sanitize-html` | `dompurify` with the same tag/attribute allowlist |

### Images

- Product/CJ images are remote URLs. Plain `<img>` avoids the `next.config`
  remote-pattern allowlist.
- Keep `loading="lazy"`, `decoding="async"`, explicit dimensions or aspect
  wrappers to avoid layout shift.
- Consider Supabase image transforms only if needed later; not required for the
  migration.

### SEO (SPA baseline)

- `Seo` component sets `document.title`, description, canonical, OG/Twitter, and
  Product JSON-LD.
- Add `public/robots.txt` and a static `public/sitemap.xml` generator script, or
  generate the sitemap at build time from Supabase.
- If the SEO decision is "must be server-rendered", pivot Phase 1 to React
  Router framework mode with SSR before porting pages.

---

## 8. Dependencies and environment

### Remove

- `next`, `eslint-config-next`
- `@supabase/ssr`
- `server-only`
- `sanitize-html`, `@types/sanitize-html`
- `@tailwindcss/turbopack`
- `next.config.ts`, `src/proxy.ts`, `src/app/**`

### Add

- `react`, `react-dom`, `react-router-dom`
- `@tanstack/react-query`
- `@supabase/supabase-js`
- `dompurify`
- `zod`
- `tailwindcss`, `@tailwindcss/vite`
- `vite`, `@vitejs/plugin-react`, `typescript`
- `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`
- `react-helmet-async` (or a tiny custom head hook)
- ESLint + `typescript-eslint` (Vite template defaults)

### Environment variables

Rename and move to `web/.env.local`:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SITE_URL=http://localhost:5173
```

Deploy-time:

- Build output: `web/dist`
- Vercel project root: `web` (or repo root after flattening).
- Vercel SPA rewrite (`vercel.json`):

  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

- Do **not** keep the old cron entries in `vercel.json`. Vercel Cron only sends
  GET requests; the workers expect POST + `CRON_SECRET`. Use Supabase Cron
  instead (Phase 7).
- Update Supabase Auth `site_url` / redirect allow-list to the new domain and
  `/auth/callback`.
- Keep `SITE_URL` (edge function secret) in sync for emails and payment
  redirects.
- `PAYMENT_PROVIDER=manual` stays a Supabase function secret.

---

## 9. Phased execution

Each phase ends with a runnable checkpoint.

### Phase 0 — Confirm decisions

- [x] SPA (Vite) confirmed.
- [x] Keep Supabase Edge Functions confirmed.
- [x] Vercel hosting confirmed.
- [x] Build in `web/` and flatten at cutover confirmed.
- **Done when:** `plan.md` decisions are approved.

### Phase 1 — Scaffold

- [x] Create `web/` with Vite + React + TypeScript.
- [x] Add Tailwind v4, fonts, env schema, path alias `@/`.
- [x] Add `QueryClientProvider`, `AuthProvider`, router, root layout/header.
- [x] Add root `web:*` scripts and ignore/exclude `web/` from the Next config.
- **Done when:** `npm --prefix web run dev` shows a placeholder page and
  `vite build` passes. ✅ verified with `npm run lint` + `npm run build`.

### Phase 2 — Core libs and auth

- [x] Port `types/*`, `utils`, `env`, `site`, `supabase.ts`, `functions.ts`.
- [x] Implement `AuthProvider`, `useProfile`, `RequireAuth`, `RequireAdmin`.
- [x] Port login/signup/callback/account pages.
- [x] `npm run lint` + `npm run build` pass.
- **Done when:** sign up, log in, log out, session refresh, and redirects work;
  a non-admin cannot reach `/admin` UI (and admin-api still rejects them).
  Manual auth smoke still pending until Supabase dev creds are exercised.

### Phase 3 — Cart and catalog

- [x] Port `catalog.ts` to browser queries.
- [x] Add React Query hooks for settings, categories, shipping, products, product.
- [x] Port home, products, product detail, category, cart pages and components.
- [x] Implement localStorage cart + `CartFeedback`.
- [x] `npm run lint` + `npm run build` pass.
- **Done when:** browse/search/filter/paginate, variants, add/update/remove cart,
  and cart count all work against Supabase.
  Manual storefront/cart smoke still pending until Supabase dev creds are
  exercised.

### Phase 4 — Checkout, manual payment, orders

- [x] Port checkout form and `startCheckout`.
- [x] Port `/checkout/manual`, `/checkout/mock`, `/checkout/success`.
- [x] Port `/orders/:orderNumber` guest/customer view with token.
- [x] `npm run lint` + `npm run build` pass.
- **Done when:** a real order can be created, manual instructions render, an
  order can be previewed with/without token, and the mock flow works when
  `PAYMENT_PROVIDER=mock`.
  Real order/payment smoke still pending until Supabase dev creds and payment
  provider configuration are exercised.

### Phase 5 — Admin

- [x] Port admin layout/dashboard/products/products edit/import/orders/order detail.
- [x] Replace server actions with admin API calls + React Query invalidation.
- [x] Port mark-paid and retry buttons.
- [x] `npm run lint` + `npm run typecheck` + `npm run build` pass.
- **Done when:** import, edit/publish, order list/detail, mark paid, and retry CJ
  all work; CJ search/preview works.
  Manual admin smoke still pending until Supabase dev creds are exercised.
  Notes: admin routes live outside the store shell (`App`) as a sibling route
  group to mirror the Next layout; server actions were ported to plain async
  handlers in `web/src/features/admin/admin-api.ts`; the CJ preview is local
  component state (not a URL param).

### Phase 6 — Remove Next runtime dependencies

- [x] Delete `src/app/**`, `src/proxy.ts`, `next.config.ts`, `vercel.json`
  crons, and all Next-only libs (server Supabase client, cookie cart, auth
  server helpers, webhook/cron routes).
- [x] Flatten `web/*` to the repo root (done together with Phase 6 since the
  repo now contains only the Vite app + `supabase/`).
- [x] Update ESLint/TS configs, `package.json` scripts/deps, `.gitignore`,
  `vercel.json` (SPA rewrite only), `.env.local`/`.env.example`
  (`NEXT_PUBLIC_*` → `VITE_*`), and README.
- [x] `npm run lint` + `npm run typecheck` + `npm run build` pass at the repo
  root; `dist/` bundle contains no `service_role` reference.
- **Done when:** the repo contains only the Vite app + Supabase functions, and
  `npm run lint && tsc --noEmit && vite build` pass. ✅
  Full manual regression (section 10) still pending.

### Phase 7 — Infra cutover (Vercel + Supabase)

- Deploy `web/dist` to Vercel with the SPA rewrite above.
- Configure Supabase Cron for fulfill/tracking/stock (POST + `CRON_SECRET`):
  - fulfill: `*/5 * * * *`
  - tracking: `0 */3 * * *`
  - stock: `0 */6 * * *`
- Point any future payment provider webhook at the `store-api` URL.
- Update Supabase Auth URLs and the `SITE_URL` function secret.
- **Done when:** cron runs, emails still send, and manual payments still work in
  production.

### Phase 8 — Flatten and launch

- [x] `web/*` moved to the repo root (done during Phase 6 cutover).
- [ ] Run the full manual regression checklist (section 10).
- [ ] Tag/Release; keep the old Next branch until the new app has been stable.
- **Done when:** production traffic is served by the React app with no
  rollback.

---

## 10. Verification checklist

Automated:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Optional: `vitest` for `utils`, `money`, `sanitize`, cart-id validation.

Manual smoke:

1. Home, products, search, category, product variants, pagination.
2. Add/update/remove cart; cart count and toast.
3. Checkout with manual payment → instructions page → admin mark paid.
4. Confirmation email and CJ fulfillment kick.
5. Guest order page with correct token; wrong token → 404.
6. Sign up, confirm email (if enabled), log in, log out, account page.
7. Admin: import a CJ product, edit/publish it, see it on the storefront.
8. Admin: order list/detail, mark paid, retry failed CJ order.
9. `PAYMENT_PROVIDER=mock`: mock payment button twice → duplicate safe.
10. Cron workers: fulfill/tracking/stock respond and update rows.
11. No `service_role` key in the built bundle: search `dist/`.
12. Mobile layout and Lighthouse smoke (note expected SEO trade-off).

---

## 11. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| SEO regression | Decide SPA vs SSR in Phase 0; add Helmet/JSON-LD; prerender static routes; pivot to SSR if required |
| Auth/session bugs | Central `AuthProvider`, test email confirmation and refresh; admin API still enforces role |
| Cart identity loss | Persist UUID in localStorage; handle a missing cart on first add |
| CORS issues | Edge functions already send CORS headers; verify `OPTIONS` on all browser-called actions |
| Public data exposure | Keep anon key + RLS; never select cost/supplier tables; verify RLS before launch |
| Webhook signature breakage | Forward provider directly to the existing `store-api` endpoint; do not re-serialize the body |
| Cron not running | Verify Supabase Cron/pg_net logs; keep the CRON_SECRET only in Vault/functions |
| Admin import page complexity | Port last; use React Query + plain handlers; keep the same API contracts |
| Bundle size | DOMPurify replaces sanitize-html; lazy-load admin routes |
| Two app versions during migration | Work in `web/`, keep Next until parity, cut over in Phase 7 |

---

## 12. File disposition (high level)

| Current | Action |
| --- | --- |
| `src/types/*` | Copy to `web/src/types` unchanged |
| `src/lib/utils.ts`, `money` helpers | Copy |
| `src/lib/env.ts` | Rewrite with `import.meta.env` |
| `src/lib/site.ts` | Rewrite with `VITE_SITE_URL` |
| `src/lib/catalog.ts` | Port to browser Supabase; keep types and query logic |
| `src/lib/orders.ts` | Port to browser `callEdgeFunction` |
| `src/lib/supabase/client.ts` | Replace with `web/src/lib/supabase.ts` |
| `src/lib/supabase/server.ts` | Delete |
| `src/lib/supabase/functions.ts` | Port, remove server-only/raw |
| `src/lib/auth.ts` | Replace with `AuthProvider` + hooks/guards |
| `src/lib/auth-actions.ts` | Replace with auth functions in `features/auth` |
| `src/lib/cart.ts` | Replace with localStorage cart module |
| `src/lib/sanitize.ts` | Replace with DOMPurify |
| `src/lib/admin-products-actions.ts` | Convert to async admin API functions |
| `src/lib/navigation-events.ts` | Remove; use router navigation state |
| `src/components/ui/*` | Port; replace Link/Image |
| `src/components/shop/*` | Port; replace Next APIs and fetches |
| `src/app/(shop)/**` | Port pages to `web/src/pages/storefront` |
| `src/app/(account)/**` | Port to `web/src/pages/account` |
| `src/app/admin/**` | Port to `web/src/pages/admin` + feature modules |
| `src/app/layout.tsx` | Replace with `App.tsx` + layout components |
| `src/app/globals.css` | Move to `web/src/index.css` |
| `src/app/api/cart/route.ts` | Delete; call `store-api` directly |
| `src/app/api/checkout/route.ts` | Delete; call `store-api` directly |
| `src/app/api/webhooks/payment/route.ts` | Delete; provider calls `store-api` URL |
| `src/app/api/cron/*` | Delete; Supabase Cron calls workers |
| `src/app/auth/callback/route.ts` | Replace with SPA callback page |
| `src/proxy.ts` | Delete |
| `next.config.ts` | Delete |
| `vercel.json` | Delete (or keep only SPA rewrite if hosted on Vercel) |
| `supabase/**` | Keep unchanged (except optional cron SQL + docs) |

---

## 13. Resolved decisions

1. **SEO:** SPA accepted; add Helmet/JSON-LD + sitemap.
2. **Backend:** keep Supabase Edge Functions.
3. **Deployment:** Vercel static SPA.
4. **Migration style:** build in `web/`, then flatten at cutover.
5. **Admin URL:** keep `/admin`.

No open questions block Phase 1.

---

## 14. Definition of done

- The app runs on Vite + React + TypeScript with no Next.js imports or
  dependencies.
- All routes and flows in section 10 pass.
- Supabase functions and schema are unchanged and still deployed.
- Env vars and docs are updated; no service-role secret is in the frontend.
- The old Next app is deleted (or archived) after a stable release.
