# CJ Dropshipping Store

Storefront built as a Vite + React 19 + TypeScript SPA with React Router,
Tailwind CSS v4, and TanStack Query, on top of Supabase (Postgres, Auth, RLS,
Edge Functions). Products are sourced from CJ Dropshipping; orders are
fulfilled through the CJ API.

Previously the frontend was Next.js (App Router). It was replaced by the SPA in
this repo; see `plan.md` for the migration record.

## Stack

- Vite + React 19 SPA, TypeScript strict, React Router v7
- TanStack Query for server state
- Tailwind CSS v4
- Supabase (Postgres, Auth, RLS, Edge Functions)
- Zod validation
- Payment provider abstraction (`manual` bank transfer; `mock` for local dev)

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in the values
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`).
3. Run `schema.sql` once in the Supabase SQL Editor (or `npx supabase db push`
   for the incremental migrations).
4. Start the dev server: `npm run dev` (http://localhost:5173)

After signing up in the app, make yourself an admin:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Architecture

One data path: the browser talks to Supabase directly.

- Public catalog reads use the **anon key + RLS** (`src/lib/catalog.ts`).
- Cart identity is a UUID persisted in `localStorage` (`src/features/cart/`).
- All privileged work (admin CRUD, CJ import/fulfillment, checkout,
  email, webhook) runs in **Supabase Edge Functions** under
  `supabase/functions/`. The browser calls them with the signed-in user's JWT
  (`src/lib/functions.ts`: `callEdgeFunction`, `callAdminApi`).
- Auth state lives in `src/features/auth/` (`AuthProvider`, `RequireAuth`,
  `RequireAdmin`); sign-in/up/out are plain `supabase.auth` calls.
- The SPA is a static build (`dist/`) and can be hosted anywhere; `vercel.json`
  contains only the SPA rewrite. Update Supabase Auth `site_url` and the
  redirect allow-list to the deployed domain plus `/auth/callback`.

## Edge Functions (privileged backend)

The frontend **never** holds `SUPABASE_SERVICE_ROLE_KEY`. All privileged
(supplier cost, admin CRUD, fulfillment, webhooks, cron) operations run in
Supabase Edge Functions, where the service-role key is injected by the
Supabase runtime.

- `admin-api` — admin-only actions (`session`, `settings`, CJ catalog search,
  product import, product editing, and order detail/retry). Verifies the
  caller's JWT and `profiles.role = 'admin'` before using the service-role
  client.
- `store-api` — guest/customer actions: cart (`cart.get`, `cart.add`,
  `cart.update`, `cart.remove`), checkout (`checkout.create`,
  `checkout.startPayment`), guest order preview (`order.preview`), payment
  webhook processing (`payment.webhook`), and the dev-only mock payment helper
  (`payment.mockPay`).
- `fulfill-order` — cron/internal worker that claims queued `supplier_orders`
  and submits them to CJ. It authenticates with `Authorization: Bearer
  CRON_SECRET` instead of a Supabase JWT (`verify_jwt = false` in
  `supabase/config.toml`).
- `tracking-sync` — cron/internal worker that polls CJ for active supplier
  orders, upserts `shipments`, updates order statuses, adds public timeline
  events, and sends the shipped email once per tracking number.
- `stock-sync` — cron/internal worker that refreshes supplier stock and cost
  from CJ, disables sold-out variants, and flags margin problems.
- `cj-webhook` — CJ payment/status callbacks.
- Shared helpers live in `supabase/functions/_shared/`; the CJ client is in
  `supabase/functions/_shared/cj/`. `CJ_API_KEY` is a Supabase function secret
  and is never part of the frontend environment.

Deploy:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy admin-api
npx supabase functions deploy store-api
npx supabase functions deploy fulfill-order
npx supabase functions deploy tracking-sync
npx supabase functions deploy stock-sync
```

Set the function secrets for deployed functions:

```bash
npx supabase secrets set CJ_API_KEY=... --project-ref <your-project-ref>
npx supabase secrets set \
  PAYMENT_PROVIDER=manual \
  PAYMENT_WEBHOOK_SECRET=... \
  RESEND_API_KEY=... \
  EMAIL_FROM="My Store <orders@yourdomain.com>" \
  SITE_URL=https://yourdomain.com \
  CRON_SECRET=... \
  --project-ref <your-project-ref>
```

For local `supabase start`, put the same values in
`supabase/functions/.env`.

The frontend environment holds **only** public values:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SITE_URL
```

`PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_API_KEY`, and
`CRON_SECRET` are Supabase function secrets only. Checkout, mock webhook
signing, and cron authentication all run inside `store-api` or the worker
functions, so the SPA never reads those values.

## Cron

Workers are scheduled with Supabase Cron (`pg_cron` + `pg_net`) POSTing
directly to the functions with `Authorization: Bearer <CRON_SECRET>` (secret in
Supabase Vault):

- `fulfill-order`: every 5 minutes (`*/5 * * * *`)
- `tracking-sync`: every 3 hours (`0 */3 * * *`)
- `stock-sync`: every 6 hours (`0 */6 * * *`)

Payment webhooks point directly at
`https://<project>.supabase.co/functions/v1/store-api?action=payment.webhook`;
`store-api` verifies the provider signature over the raw body.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

Manual smoke checklist: browse/search/filter/paginate products; add/update/
remove cart; checkout with manual payment → instructions page → admin mark
paid; guest order page with token (wrong token → 404); sign up / log in /
log out; admin import a CJ product, publish it, see it on the storefront; retry
a failed CJ order; `PAYMENT_PROVIDER=mock` double-click is duplicate-safe;
workers still respond; `grep -r service_role dist/` finds nothing.

Deeper backend behavior docs (CJ integration, fulfillment, tracking, stock
sync, emails) live in `docs/` and the SQL in `schema.sql` +
`supabase/migrations/`.
