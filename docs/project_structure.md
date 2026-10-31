# Project structure & UI guide

This document describes every page in the storefront and admin app, plus the
shared UI patterns and design language used across them. It reflects the
current implementation (Next.js App Router + Tailwind CSS).

## Tech & conventions

- **Framework:** Next.js 16 App Router, React Server Components by default.
- **Styling:** Tailwind CSS utility classes, no component library. Light and
  dark themes are both supported through `dark:` variants.
- **Fonts:** Geist Sans (`--font-geist-sans`) and Geist Mono
  (`--font-geist-mono`) loaded in the root layout.
- **Icons:** none — the UI uses text, badges, and arrows (`←`, `→`).
- **Rendering:** `cacheComponents` and partial prefetching are enabled. Pages
  that read auth/session or other runtime data call `await connection()` and set
  `export const instant = false`. Data that can suspend is wrapped in
  `<Suspense>` with skeletons.
- **Route groups:** `(shop)` and `(account)` are organizational only and do not
  appear in URLs.

## Route map

| URL | File | Purpose |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Storefront home |
| `/products` | `src/app/(shop)/products/page.tsx` | Product listing, search, filters |
| `/products/[slug]` | `src/app/(shop)/products/[slug]/page.tsx` | Product detail |
| `/categories/[slug]` | `src/app/(shop)/categories/[slug]/page.tsx` | Category listing |
| `/cart` | `src/app/(shop)/cart/page.tsx` | Cart |
| `/checkout` | `src/app/(shop)/checkout/page.tsx` | Checkout form |
| `/checkout/success` | `src/app/(shop)/checkout/success/page.tsx` | Post-payment confirmation |
| `/checkout/mock` | `src/app/(shop)/checkout/mock/page.tsx` | Dev-only mock payment |
| `/orders/[orderNumber]` | `src/app/(shop)/orders/[orderNumber]/page.tsx` | Order status & tracking |
| `/login` | `src/app/(account)/login/page.tsx` | Sign in |
| `/signup` | `src/app/(account)/signup/page.tsx` | Create account |
| `/account` | `src/app/(account)/account/page.tsx` | Account overview |
| `/admin` | `src/app/admin/page.tsx` | Admin dashboard |
| `/admin/products` | `src/app/admin/products/page.tsx` | Admin product list |
| `/admin/products/[id]` | `src/app/admin/products/[id]/page.tsx` | Edit imported product |
| `/admin/products/import` | `src/app/admin/products/import/page.tsx` | CJ catalog search & import |
| `/admin/orders` | `src/app/admin/orders/page.tsx` | Admin order list |
| `/admin/orders/[id]` | `src/app/admin/orders/[id]/page.tsx` | Admin order detail & CJ fulfillment |

Non-UI route handlers: `/api/cart`, `/api/checkout`, `/api/webhooks/payment`,
`/api/cron/fulfill`, `/api/cron/stock`, `/api/cron/tracking`, `/auth/callback`.

---

## Global shell

**Root layout — `src/app/layout.tsx`**

- Full-height flex column body with a sticky top header.
- Header: translucent white/`zinc-950` with blur, bottom border, centered
  `max-w-6xl` row with `px-6 py-4`.
  - Brand: **CJ Store** (semibold, tracking-tight) linking to `/`.
  - Nav links: Products, Cart, Account, and a pill-shaped “Log in” link. Muted
    `text-zinc-600` with hover to near-black/near-white.
- No global footer; the home page ends with a features band.
- All pages render inside this shell.

---

## Storefront pages

### Home — `/`

File: `src/app/page.tsx`

A marketing-style landing page built from full-width sections inside
`max-w-6xl`.

1. **Hero** (`border-b`, subtle gradient background)
   - Two-column grid on `lg` (`1.15fr / 0.85fr`), stacked on mobile.
   - Left: pill badge “Ships to the US, UK & more”, large store-name H1
     (`text-4xl`/`sm:text-5xl`), supporting paragraph, primary “Shop all
     products” button, secondary “Browse {first category}” button, and a
     trust bullet list (delivery window, free-shipping threshold, tracked
     orders).
   - Right: square product image card (hidden below `lg`) with rounded-2xl
     border; falls back to a gradient placeholder telling the admin to add
     products.
2. **Shop by category** — section heading plus a 2/3/4-column grid of
   `aspect-[4/3]` image tiles. Category name sits in a translucent pill at the
   bottom-left; image scales on hover.
3. **Featured / New arrivals** — heading, “View all products →” link, and a
   responsive product grid (2 columns mobile, 4 on desktop).
4. **Features band** (`bg-zinc-50`, top border) — three columns: Tracked
   delivery, Secure checkout, Real support (support email becomes a mailto
   link when configured).

### Product listing — `/products`

File: `src/app/(shop)/products/page.tsx`

- Breadcrumb: Home / Products (or Home / Products / Category).
- Page title (`text-3xl`): “All products” or the active category name.
- Count line: total products, optional search term, optional page indicator.
- Search form (input + Search button, GET to `/products`) with 350 ms debounced
  navigation and an inline “×” clear button; results update without a full page
  reload.
- Category chips: pill-shaped links for “All” plus each category; active chip is
  solid dark (inverted in dark mode). Chips preserve the current search query.
- Product grid.
- Pagination (hidden when there is only one page).

Query params: `q`, `category`, `page`.

### Category listing — `/categories/[slug]`

File: `src/app/(shop)/categories/[slug]/page.tsx`

- Breadcrumb: Home / Products / Category.
- Header row: optional 80×80 category image thumbnail, category H1, and product
  count/page line.
- Product grid and pagination.
- Unknown slugs call `notFound()`.

### Product detail — `/products/[slug]`

File: `src/app/(shop)/products/[slug]/page.tsx`

- Breadcrumb: Home / Products / Category / Product title.
- Two-column layout on `lg` (`1fr / 1fr`, `gap-12`):
  - **Left:** interactive gallery — square main image with `object-cover` and
    a horizontal row of 16×16 thumbnails. The selected thumbnail has a dark
    ring/border. Empty images render a dashed placeholder.
  - **Right:**
    - Category link (uppercase, tracking-wide) and product H1.
    - Variant picker (client component): current price with optional
      compare-at strikethrough, stock status (green “In stock · N available” or
      red “Out of stock”), monospace SKU, option buttons grouped by option name
      (selected = solid dark, unavailable = dimmed/disabled), a −/+ quantity
      stepper (1–10 capped by stock), “Add to cart” button, and success/error
      messages with a link to the cart.
    - Accordion panel with two expandable rows: “Delivery & shipping” (up to
      three shipping rates with country names, delivery window, and either
      “free over …” or a shipping price) and “Returns & support”. The shipping
      row is open by default; the first falls back to a generic note.
- **Product details** section: sanitized HTML description with prose-like
  styles for headings, lists, images, and tables.
- **You may also like**: related product grid plus a “More in {category} →”
  link.
- Emits JSON-LD `Product` structured data (name, description, images, SKU,
  brand, offers/availability).
- `generateMetadata` builds title, description, canonical URL, Open Graph, and
  Twitter card from the product and first image.

### Cart — `/cart`

File: `src/app/(shop)/cart/page.tsx`

Three states:

1. **Load error** — H1 plus a red alert card.
2. **Empty** — H1 plus a dashed empty-state card (“Your cart is empty”) with a
   “Shop products” primary button.
3. **Populated** — header row (H1, item count, “Continue shopping” link) and a
   two-column grid (`1.4fr / 0.6fr`):
   - **Cart items** (client): bordered list; each row has an 80×80 thumbnail, a
     linked product title, variant label, line total, availability warning,
     quantity select, and a “Remove” text button. Rows show “Updating…” while a
     request is in flight and an inline red alert on failure.
   - **Order summary aside** (sticky on `lg`): Subtotal, Shipping
     (“Calculated at checkout”), Total, a dashed discount-code note, an amber
     warning when unavailable items exist, and either a disabled “Checkout
     unavailable” block or a primary “Checkout” link. A small note explains
     shipping/discounts are finalized at checkout.

### Checkout — `/checkout`

File: `src/app/(shop)/checkout/page.tsx` + `src/components/shop/checkout-form.tsx`

Guard states: empty cart and unavailable items each render a centered
`max-w-3xl` page with a dashed empty card or amber warning card and a CTA back
to products/cart.

Populated checkout:

- Header: H1, subtitle (“Shipping and totals are confirmed on the server before
  payment.”), “Back to cart” link.
- Two-column form layout (`1.3fr / 0.7fr`):
  - **Left column**
    - Contact: email field (prefilled for signed-in users) with helper text.
    - Shipping address: full name (prefilled), address lines 1–2, city, state,
      postal code, country select (30 countries), optional phone. Inputs are
      `h-11`, rounded-lg, dark-mode aware.
    - Shipping: radio cards per rate showing method name, delivery window, price
      or green “Free”, and “Free over …” when applicable. Selected card gets a
      dark border via `has-checked:`. Amber notice when no rates exist.
    - Discount & notes: optional discount code input and order-note textarea.
  - **Right column (sticky on `lg`)**: item list with 48×48 thumbnails,
    title, variant, quantity, and line total; totals (Subtotal, Shipping, Total)
    with a divider before Total; inline error alert; primary “Continue to
    payment” button (disabled while submitting or without a rate); note that
    totals are recalculated server-side.

Shipping cost is computed live from the selected country/rate and subtotal.

### Checkout success — `/checkout/success`

File: `src/app/(shop)/checkout/success/page.tsx`

- Requires `order` and `token` query params; otherwise 404.
- Emerald pill with the order number.
- H1 switches between “Payment confirmed” and “Thank you for your order” based
  on payment status, with a tailored message including the customer email.
- Shared `OrderSummary` component (items + totals + address).
- Buttons: “View order & tracking” and “Continue shopping”.
- `noindex` metadata.

### Mock checkout — `/checkout/mock`

File: `src/app/(shop)/checkout/mock/page.tsx`

- Dev-only; 404 in production.
- Amber pill “Development mode · mock payment provider”.
- Order number H1 and a line showing the order status; notes that no real
  payment was taken.
- Card “Test the payment webhook” explaining signature verification and
  idempotency, with a green “Simulate successful payment” button (client
  action). Shows a message when the order is already paid (replays should
  return `duplicate`), or an amber warning when the order id is missing.
- Shared `OrderSummary` and “Continue shopping” link.
- `noindex` metadata.

### Order status — `/orders/[orderNumber]`

File: `src/app/(shop)/orders/[orderNumber]/page.tsx`

Token-protected customer order page.

- Header: “Order” label, order number H1, placed date + email, and two pills —
  order status (green for paid/processing/shipped/delivered, red for
  cancelled/refunded/failed, neutral otherwise) and fulfillment status.
- Shared `OrderSummary`.
- Two-column section:
  - **Tracking**: empty-state copy until a shipment exists; otherwise shipment
    cards with carrier, monospace tracking number, status pill, and an external
    “Track this package” link.
  - **Timeline**: vertical list with dot markers, event message/label, and
    timestamp; empty-state copy when there are no events.
- Buttons: “Continue shopping” (primary) and “Your account” (secondary).
- Privacy note: keep the page link private because it contains the order token.
- `noindex` metadata.

---

## Account pages

All account pages are centered and narrow.

### Log in — `/login`

File: `src/app/(account)/login/page.tsx` + `login-form.tsx`

- `max-w-sm`, vertical stack, `py-16`.
- H1 “Log in” + subtitle.
- Form: Email, Password, full-width “Sign in” button (shows “Signing in…” while
  pending), inline red error alert, and a “No account? Create one” link.

### Create account — `/signup`

File: `src/app/(account)/signup/page.tsx` + `signup-form.tsx`

- Same narrow layout and typography as login.
- H1 “Create account” + subtitle.
- Form: optional full name, email, password (min 8), full-width “Create
  account” button, red error and green success alerts, and an “Already have an
  account? Sign in” link.

### Account — `/account`

File: `src/app/(account)/account/page.tsx`

- Requires authentication (`requireUser`) and calls `connection()`.
- `max-w-xl`, `py-16`.
- H1 “Your account” + “Signed in as {email}”.
- Definition list card (`grid-cols-[8rem_1fr]`) showing Name, Email, Phone, and
  Role (capitalized, defaults to “customer”).
- Actions: “Admin dashboard” secondary link when the profile role is `admin`,
  plus a “Log out” button (transparent variant).

---

## Admin pages

### Admin shell — `src/app/admin/layout.tsx`

- Requires an admin session (`requireAdmin`) and calls `connection()`.
- Full-height flex column with its own header.
- Header: **Admin** brand, links to Dashboard, Products, Orders, and “View
  store”; right side shows the profile name (or email), a circular initials
  avatar, and a transparent “Log out” button. The header is sticky and
  translucent.
- Content area: centered `max-w-5xl`, `px-6 py-10`.
- All admin pages inherit this shell; the storefront header is not shown.

### Dashboard — `/admin`

File: `src/app/admin/page.tsx`

- H1 “Dashboard” + subtitle noting widgets are placeholders.
- **Backend status** card (async): calls the `session` admin API action.
  - Success: emerald card “Edge Functions connected” with the verified identity.
  - Failure: red card “Edge Function check failed” with the error message.
- Four placeholder stat cards in a responsive grid: Orders today, Revenue
  (7 days), CJ balance reserve, and Failed CJ orders — all showing “—” in
  monospace tabular numerals.

### Products — `/admin/products`

File: `src/app/admin/products/page.tsx`

- Header row: H1 “Products” + description (“Drafts are hidden from the
  storefront.”) and a primary “Import products” button linking to the import
  page.
- Toolbar: GET search form (title or slug), status filter chips (All / Active /
  Draft / Archived), and a live result count. Filters preserve the search query.
- Error state: red card with the API error.
- Empty state: dashed card “No products imported yet” with guidance; a separate
  “No products match” state appears when filters return nothing.
- Product list: bordered, divided rows; each row is a link to the edit page with
  a 64×64 image, title, status badge (green active / amber draft / neutral
  archived), optional amber “N to review” badge, variant stats (total, active,
  “from $X”), a monospace storefront slug, and an “Edit” label.

### Edit product — `/admin/products/[id]`

File: `src/app/admin/products/[id]/page.tsx` + `product-form.tsx`

- Back link, title, `/products/{slug}` and CJ id, plus a status pill.
- Missing product → 404; other load errors → red card.
- **Edit form** (client, server action):
  - Inline red error / green success alerts.
  - Fields: Title, Status select (Draft/Active/Archived), Category select
    (including “Uncategorized”), Description HTML textarea (monospace, 14 rows)
    with a note that it is sanitized before rendering.
  - **Variant prices** table: variant name, CJ SKU, stock, supplier cost with a
    computed margin percentage (red if negative, amber if needs review or below
    15%, emerald if healthy), inactive/review annotations, and a monospace
    selling-price input per variant.
  - **Images**: ordered list with drag handles, 64×64 thumbnails, “Main
    image”/“Image N” labels, monospace URL, optional “Variant image” note, and
    Up/Down buttons. Rows can be dragged to reorder (arrows remain for
    accessibility); changes apply locally before saving. Empty state is a
    dashed card.
  - Footer actions: “Save product” (shows “Saving…”), “Back to products”, and
    “View storefront”.
- **Description preview** section below the form: sanitized HTML rendered with
  prose-like styles and a note that it is server-sanitized.

### Import products — `/admin/products/import`

File: `src/app/admin/products/import/page.tsx` (plus `import-form.tsx`,
`import-single-form.tsx`, `preview-gallery.tsx`, `skeletons.tsx`, `loading.tsx`)

- Header: back link, H1 “Import CJ products”, description of search → preview →
  import-as-draft flow.
- GET search form: keyword input + Search button.
- **Search results** are streamed inside a keyed `<Suspense>`:
  - While loading, `SearchResultsSkeleton` shows a header placeholder and five
    shimmering product rows, plus a sticky shimmer bar.
  - Error state: red card “CJ search failed”.
  - Results header: total count for the query, Previous/Next links, and page
    indicator.
  - Result rows: checkbox, 80×80 image, title, SKU/CJ price/stock line, category,
    and a “Preview” link (opens the modal without scrolling).
  - Empty state: dashed “No CJ products matched this search.”
  - **Sticky import bar** at the bottom of the form: “Import selected” button
    (disabled until at least one box is ticked) and a live “N of M selected”
    counter. Import results render above the bar with imported links, skipped
    reasons, and failed items.
- **Product preview modal** (streamed in its own keyed `<Suspense>`):
  - While loading, `PreviewSkeleton` renders the full modal shell with pulsing
    gallery, stat cards, table, and footer.
  - Overlay: dark translucent backdrop with blur; clicking the backdrop or the
    “Close” button removes the `pid` param (`scroll={false}`).
  - Panel: rounded-3xl (24px), `max-w-6xl`, bordered, shadowed.
  - Header: “CJ product preview” label, product title, and pill badges for CJ id,
    SKU, and category.
  - Body grid (`400px / 1fr`):
    - Interactive gallery with thumbnails (`preview-gallery.tsx`).
    - Four stat cards: Variants, lowest “From” cost, total stock, image count.
    - Scrollable variant table with sticky header, variant thumbnails, CJ SKU,
      cost, weight, and stock.
    - Collapsible “Description” block (open by default) with sanitized HTML in a
      scrollable area.
  - Footer: note that imports start as drafts and a single-product import form
    (`import-single-form.tsx`) that shows success/skip/fail feedback and links to
    the edit page after import.
  - Load failure renders a smaller modal with the error and a Close button.
- `loading.tsx` renders `ImportPageSkeleton` (page header, search bar, results
  skeleton) during initial route navigation.

### Orders — `/admin/orders`

File: `src/app/admin/orders/page.tsx`

- H1 “Orders” + description.
- Filter chips: “All orders” and “Failed CJ” (supplier or fulfillment status
  `failed`), with a live count.
- Error card and dashed empty card (“No orders yet.” / “No failed CJ orders.”).
- Horizontal-scroll table (`min-w-[880px]`) with columns: Order (number link +
  email), Placed, Payment, Fulfillment, CJ, Total.
  - Status cells use pills: green for paid/submitted/confirmed/shipped/delivered,
    red for failed/cancelled/refunded, neutral otherwise.
  - The CJ column shows the supplier status pill and a truncated supplier error
    when present.
  - Total is right-aligned and formatted with the order currency.

### Order detail — `/admin/orders/[id]`

File: `src/app/admin/orders/[id]/page.tsx` + `retry-button.tsx`

- Back link; header with order number, email, placed date, and status/payment/
  fulfillment pills.
- Two-column cards: **Shipping** (name, address lines, city/state/postal,
  country, phone, optional customer note) and **Totals** (subtotal, shipping,
  optional discount, tax, bold total).
- **CJ fulfillment** card:
  - Status badge (or “not queued”).
  - Red “CJ balance is insufficient” notice when the supplier error starts with
    `cj_insufficient_balance`.
  - Supplier details: CJ order id, shipping method, attempts, supplier cost,
    next attempt, updated time.
  - Amber supplier error message.
  - “Retry CJ order” button when status is `failed` (client action with
    pending/success/error feedback).
  - Empty-state copy when no supplier row exists yet.
- **Items** table: item title/variant, SKU, quantity, unit price, line total.
- **Timeline** list: event type (underscores replaced with spaces), optional
  message, timestamp, and Public/Internal label.
- Missing order → 404; other load errors → red card with back link.

---

## Shared components

### UI primitives

| Component | File | Design |
| --- | --- | --- |
| `Button` | `src/components/ui/button.tsx` | `h-11`, rounded-lg, solid zinc-900 (inverted in dark), disabled opacity |
| `Input` | `src/components/ui/input.tsx` | `h-11`, rounded-lg, bordered, indigo focus outline, dark-mode colors |
| `PriceTag` | `src/components/shop/price-tag.tsx` | Semibold price + optional strikethrough compare-at; “Price unavailable” fallback |

### Storefront components

| Component | File | Design |
| --- | --- | --- |
| `ProductGrid` | `product-grid.tsx` | 2/4-column grid, dashed empty-state card |
| `ProductCard` | `product-card.tsx` | Rounded-xl bordered card, square image with hover zoom, out-of-stock pill, category, 2-line title, price; lifts and shadows on hover |
| `ProductGallery` | `product-gallery.tsx` | Client; square main image + horizontal thumbnails, selected ring |
| `VariantPicker` | `variant-picker.tsx` | Client; price/stock, monospace SKU, option buttons, −/+ quantity stepper, add-to-cart with status messages |
| `CategoryChips` | `category-chips.tsx` | Rounded-full filter links, solid active state, preserves query |
| `SearchForm` | `search-form.tsx` | Client; debounced input + primary Search button, GET to `/products`, inline clear, optional hidden category |
| `Pagination` | `pagination.tsx` | Previous/Next + numbered window with ellipses, solid current page |
| `CartItems` | `cart-items.tsx` | Client; thumbnail rows, quantity select, remove, inline errors |
| `CheckoutForm` | `checkout-form.tsx` | Client; contact/address/shipping/notes sections + live summary aside |
| `OrderSummary` | `order-summary.tsx` | Item list card + summary card + optional shipping address card |

### Admin components

| Component | File | Design |
| --- | --- | --- |
| `ImportSelectionForm` | `admin/products/import/import-form.tsx` | Client; wraps results, tracks checked count, sticky import bar, result panels |
| `ImportSingleForm` | `admin/products/import/import-single-form.tsx` | Client; one-click import for the preview modal |
| `PreviewGallery` | `admin/products/import/preview-gallery.tsx` | Client; modal image gallery with thumbnails |
| `Skeletons` | `admin/products/import/skeletons.tsx` | `SearchResultsSkeleton`, `PreviewSkeleton`, `ImportPageSkeleton` using `animate-pulse` |
| `ProductEditForm` | `admin/products/[id]/product-form.tsx` | Client; metadata, variant pricing table, drag-and-drop image reordering |
| `RetryCjOrderButton` | `admin/orders/[id]/retry-button.tsx` | Client; server action with pending/success/error states |
| `MockPaymentButton` | `checkout/mock/mock-payment-button.tsx` | Client; green dev-only webhook trigger |

---

## Design language

### Color

- **Base:** zinc scale (`zinc-50` → `zinc-950`). Cards use the surface tint
  `zinc-50` / `zinc-900` with `zinc-200` / `zinc-800` borders; the page
  background is white / `zinc-950`.
- **Accent:** indigo `#4F46E5` for focus-visible outlines and the text
  selection tint only.
- **Primary action:** `bg-zinc-900` with white text; inverted to `zinc-100` with
  `zinc-900` text in dark mode.
- **Secondary action:** transparent/white with a zinc border.
- **Semantic tints:** emerald (success/paid/in stock/healthy margin), amber
  (drafts, warnings, review), red (errors, failed, out of stock, negative
  margin).
- **Muted text:** `text-zinc-500` / `text-zinc-600`; body copy
  `text-zinc-600 dark:text-zinc-400`.

### Typography

- Geist Sans everywhere; Geist Mono for SKUs, CJ IDs, order numbers, tracking
  numbers, slugs, description HTML textareas, and tabular price/stock figures.
- Headings use `font-semibold tracking-tight`; page titles are `text-2xl`
  (admin/account) or `text-3xl` (storefront), with `text-4xl`/`text-5xl` on the
  home hero.
- Labels are `text-sm font-medium`; helper text is `text-xs text-zinc-500`.

### Shape & spacing

- Radius: `rounded-lg` (8px) for inputs/buttons, `rounded-xl` (12px) for
  cards/tables/asides, `rounded-2xl` (16px) for product media and category
  tiles, `rounded-3xl` (24px) for the preview modal, `rounded-full` for pills
  and chips.
- Buttons and inputs share `h-11`; compact admin actions use `h-8`/`h-9`.
- Card padding is typically `p-5`; list rows `p-4`; page padding `px-6 py-10`
  or `py-12`/`py-16`.
- Max widths: `max-w-5xl` for the admin shell, cart, orders, and success pages;
  `max-w-6xl` for the global header, home, listings, product detail, and
  checkout; `max-w-3xl` for checkout guard states; `max-w-sm` for auth;
  `max-w-xl` for account.

### States

- **Empty:** dashed border card with centered muted text and an optional CTA.
- **Error:** red-tinted card/alert with a bold title and message.
- **Warning:** amber-tinted card/alert (unavailable items, drafts, review,
  insufficient CJ balance).
- **Success:** emerald-tinted card/alert.
- **Loading:** `animate-pulse` zinc blocks; search results and the preview modal
  each have dedicated skeletons; the import route has a page-level skeleton.

### Responsive behavior

- Storefront product grids: 2 columns on mobile, 4 on `lg`.
- Hero and product detail: stacked on mobile, two columns on `lg`.
- Checkout: stacked on mobile, form + summary on `lg`.
- Admin tables scroll horizontally inside `overflow-x-auto` with explicit
  `min-w-*` values.
- Header navigation stays on one row; long profile names are hidden below `sm`
  in the admin header.

### Interaction patterns

- Primary flows use server actions with `useActionState` for pending, error, and
  success feedback.
- Cart and variant picker use client `fetch` to `/api/cart` with optimistic
  pending states and inline messages.
- The catalog search debounces navigation by 350 ms and clears inline.
- Product media and editor images support drag-to-reorder (with arrow buttons
  as a fallback).
- Hover feedback is consistent: borders darken, backgrounds tint, images zoom
  slightly, and cards lift (`hover:-translate-y-0.5`).
- Focus styling uses a global indigo `:focus-visible` outline with a 2px offset,
  paired with zinc border changes on inputs.
