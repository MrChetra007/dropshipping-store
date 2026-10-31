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
  product import, and product editing). Verifies the caller's JWT and
  `profiles.role = 'admin'` before using the service-role client.
- Shared helpers live in `supabase/functions/_shared/`.
- The CJ client lives in `supabase/functions/_shared/cj/`. `CJ_API_KEY` is a
  Supabase function secret and is never added to the Next.js environment.
- Next.js calls functions through `src/lib/supabase/functions.ts`
  (`callEdgeFunction`, `callAdminApi`).

Deploy:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy admin-api
```

Set the CJ key for deployed functions:

```bash
npx supabase secrets set CJ_API_KEY=... --project-ref <your-project-ref>
```

Cron functions will reuse `CRON_SECRET`; payment and CJ webhooks will verify the
provider signature. No extra shared secret is needed.

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
