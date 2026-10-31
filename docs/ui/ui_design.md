web application/stitch/projects/6770367955141559256/screens/922237aef7a94dc88d038b188ae73d66

# Product Requirements Document (PRD) & Product Brief

**Project Name:** CJ Store  
**Version:** 1.0.0  
**Status:** Active Development / In Progress  
**Document Type:** Product Brief & Technical PRD  
**Target Viewports:** Desktop (1440px baseline), Mobile Responsive (390px)

---

## 1. Executive Summary & Vision

**CJ Store** is a modern, minimal, editorial direct-to-consumer (DTC) dropshipping storefront coupled with a unified back-office administration panel. The platform bridges end-customer commerce with CJ Dropshipping's automated product sourcing, catalog synchronization, and order fulfillment engine.

### Core Objectives

1. **Curated Editorial Shopping Experience:** Present dropshipped merchandise with the aesthetic dignity, visual restraint, and elevated typography of luxury industrial design brands (e.g., Teenage Engineering, Braun, Rimowa).
2. **Seamless Sourcing & Automated Fulfillment:** Empower store operators to browse, preview, price-adjust, and import CJ Dropshipping items with margin calculators, then automatically dispatch customer orders to CJ fulfillment endpoints.
3. **Resilient Dual-Surface Architecture:** Deliver a high-contrast, lightning-fast storefront alongside a data-dense, audit-ready operational admin portal.

---

## 2. Target Audience & Personas

| Persona                            | Role               | Key Pain Points & Objectives                                                                                                                                                      |
| :--------------------------------- | :----------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The Minimalist Shopper**         | End Consumer       | Values clean UX, transparent shipping windows, precise product specifications, and frictionless checkout without visual clutter or popup gimmicks.                                |
| **The Store Merchant / Operator**  | Store Admin        | Needs quick CJ catalog search, transparent supplier cost vs. retail margin analysis, automated inventory sync, and instant visibility into stuck or failed CJ fulfillment orders. |
| **Fulfillment Support Specialist** | Operations Support | Requires clear order timelines, monospace shipment tracking codes, raw error inspection, and one-click manual retry triggers.                                                     |

---

## 3. Visual Identity & Design System Specification

The application adheres strictly to the **Monochrome Editorial Commerce** design language.

### 3.1 Color Palette & Contrast Tokens

- **Light Theme (Primary Baseline):**
  - `Primary / Headings`: `#09090B` (Pitch Zinc)
  - `Background`: `#FFFFFF`
  - `Surface / Cards`: `#FAFAFA`
  - `Borders / Dividers`: `#E4E4E7` (Subtle 1px architectural lines)
  - `Muted / Label Text`: `#71717A`
  - `Body Text`: `#52525B`
- **Dark Theme:**
  - `Background`: `#09090B`
  - `Surface`: `#18181B`
  - `Borders`: `#27272A`
  - `Primary Button`: Inverted `#F4F4F5` with `#09090B` typography
- **Accent & Semantic Signals (Used Sparingly):**
  - `Interactive Accent`: `#4F46E5` (Indigo, strictly for active focus rings and inline hyper-references)
  - `Success / Active`: `#10B981` (Emerald — in-stock badges, paid status, delivered packages)
  - `Warning / Draft`: `#F59E0B` (Amber — draft items, pending review, balance alerts)
  - `Error / Out of Stock`: `#EF4444` (Rose / Red — out of stock, failed API sync, negative margin)

### 3.2 Typography & Hierarchy

- **Primary Typeface:** `Geist Sans`
  - Hero Display: `48px – 56px`, tight letter tracking (`-0.03em`), semibold weight.
  - Storefront Title / Section: `30px`, semibold.
  - Admin Title / Header: `24px`, semibold.
  - Form Labels & Metadata: `14px`, medium weight.
  - Footnotes & Disclaimers: `12px`, muted.
- **Secondary / Monospace Typeface:** `Geist Mono`
  - Used exclusively for SKUs, CJ IDs, order numbers, shipping tracking numbers, raw payload previews, and pricing calculations.
- **Iconography Rule:** Zero icon fonts or generic SVG kits. Pure typographic reliance on text badges, standard symbols, and directional typographic arrows (`←`, `→`).

### 3.3 Layout Constraints & Geometry

- **Border Radii:**
  - Inputs, interactive pills, and buttons: `8px`
  - Standard cards: `12px`
  - Product media gallery tiles: `16px`
  - Full inspection modals & overlays: `24px`
  - Filter & tag chips: Fully rounded (`9999px`)
- **Component Dimensions:**
  - Storefront button & input target height: `44px`
  - Compact admin utility buttons & controls: `36px`
- **Max Layout Widths:**
  - Authentication: `384px`
  - Customer Account: `576px`
  - Cart, Orders, Admin Tables: `1024px`
  - Home, Catalog Listings, Product Detail, Checkout: `1152px`

---

## 4. Information Architecture & Navigation Shells

The system is partitioned into two persistent shell archetypes:

### 4.1 Customer Storefront Shell (`web_standard`)

- **Header:** Minimal bottom-bordered bar.
  - _Left:_ "CJ Store" typographic brand mark (semibold).
  - _Right:_ Navigation links: `Products`, `Cart`, `Account`, `Log in`, accompanied by an accessible profile avatar indicator.
- **Footer:** Suppressed on core transaction flows to maintain editorial whitespace and zero friction.

### 4.2 Admin Portal Shell

- **Header:** High-density operational navigation bar.
  - _Left:_ "Admin" brand identifier, quick links to `Dashboard`, `Products`, `Orders`, and external `View store` link.
  - _Right:_ Authenticated merchant profile details and ghost `Log out` action.

---

## 5. Detailed Screen Matrix & Functional Requirements

### Part 1: Customer Storefront (8 Screens)

#### 1. Storefront Home (`Storefront - Home`) [COMPLETED]

- **Hero Split (60/40):** Left column features "Ships to the US, UK & more" pill, H1 value proposition, dual CTAs ("Shop all products", "Browse Living & Decor"), and 3 logistical trust indicators. Right column showcases a high-contrast hero product showcase.
- **Category Grid:** 4-column responsive grid with 4:3 image cards and translucent category pills.
- **Curated Releases:** 4-column product grid with 1px borders, subtle hover elevation, SKU badges, and price indicators.
- **Trust & Logistics Strip:** 3-column verification band detailing carrier integrations, Stripe encryption, and direct support.

#### 2. Products Listing (`Storefront - Products Listing`) [COMPLETED]

- **Catalog Header:** Breadcrumbs (`Home / Products`), dynamic catalog counter, search bar with debounce, clear button, and category chip carousel.
- **Product Grid & Pagination:** 4-column product display (2 columns on mobile) displaying pricing tiers, stock status, and numeric pagination bar (`← Previous`, active black pill, `Next →`).

#### 3. Product Detail Page (`Storefront - Product Detail`) [COMPLETED]

- **Dual-Column Architecture:** Left column hosts a square media gallery with 64px micro-bordered thumbnail selector. Right column contains SKU identifiers, comparison strikethrough pricing, stock level tag, variant selectors (finish, material), quantity stepper, and primary "Add to cart" CTA.
- **Logistics & Specs Accordion:** Real-time delivery rate selector (CJ Express, Priority Air, Courier Overnight), material breakdown, and warranty specifications.
- **Companion Recommendations:** Cross-sell carousel ("You may also like").

#### 4. Shopping Cart (`Storefront - Cart`) [PLANNED]

- **Itemized Ledger (70%):** 80px square product imagery, selected variant summary, unit price, quantity incrementer, and inline "Remove" action.
- **Sticky Order Summary (30%):** Calculated subtotal, estimated shipping breakdown, promotional voucher slot, and primary black "Checkout" CTA.
- **Edge States:** Empty cart dashed state with "Shop products" CTA; amber alert banner for out-of-stock or supplier-modified variants.

#### 5. Multi-Step Express Checkout (`Storefront - Checkout`) [PLANNED]

- **Customer Information & Shipping Form (65%):** Email contact capture, shipping address form fields, and radio card delivery options (Economy vs. Express).
- **Summary & Payment Gateway (35%):** Monospace line-item recapitulation, dynamic sales tax computation, Stripe Elements container, and "Continue to payment" CTA.

#### 6. Order Confirmation (`Storefront - Checkout Success`) [PLANNED]

- **Confirmation Banner:** Emerald pill with generated order ID (`#CJS-XXXXX`), payment success heading, and customer receipt email dispatch notification.
- **Logistics Preview:** Recapitulation of shipping destination, estimated transit window, and direct "View order & tracking" button.

#### 7. Live Order & Shipment Status (`Storefront - Order Status`) [PLANNED]

- **Tracking Dashboard:** Monospace CJ courier tracking number, real-time carrier status pill (In Transit, Customs Cleared, Out for Delivery), and direct tracking webhook sync.
- **Fulfillment Timeline:** Chronological vertical milestone ledger with timestamped tracking pings.

#### 8. Authentication & Customer Account (`Storefront - Auth`) [PLANNED]

- **Sign In / Sign Up:** Narrow centered form (`384px`) with email/password authentication, validation states, and password reset links.
- **Account Dashboard:** Overview (`576px`) showing profile details, default shipping address book, previous order history, and admin shortcut (if role is admin).

---

### Part 2: CJ Admin & Fulfillment Portal (6 Screens)

#### 9. Admin Operational Dashboard (`Admin - Dashboard`) [PLANNED]

- **Edge Service Status:** Emerald indicator confirming connection to CJ Dropshipping REST endpoints and automated synchronization workers.
- **Key Metrics Cards:** Orders today, 7-day gross merchandise value (GMV), CJ balance reserve, and alert card for failed auto-fulfillments.

#### 10. Catalog & Product Inventory (`Admin - Products List`) [PLANNED]

- **Catalog Table:** Searchable table with 64px product thumbnails, title, SKU, variant count, storefront publication status (Active, Draft, Archived), and supplier stock indicators.
- **Batch Actions:** Quick actions to import new CJ products, update markups, or archive catalog items.

#### 11. Product Editor & Margin Calculator (`Admin - Edit Product`) [PLANNED]

- **Metadata Editor:** Product title, slug, category assignment, and monospace raw HTML/Markdown product description editor with sanitized preview.
- **Variant & Margin Matrix Table:** Variant name, CJ SKU, supplier base cost, calculated margin percentage (highlighted in red if below minimum threshold, amber if tight, green if healthy), and public storefront retail price input.
- **Media Asset Manager:** Draggable thumbnail ordering with "Main image" badge and reorder triggers.

#### 12. CJ Sourcing & Direct Importer (`Admin - Import CJ Products`) [PLANNED]

- **CJ Dropshipping API Search:** Keyword and category catalog search querying CJ Dropshipping inventory directly.
- **Item Selection Matrix:** Checkbox selector, supplier image, wholesale cost, live inventory count, and instant "Inspect Modal" trigger.
- **Sticky Import Drawer:** Floating action bar tracking "N of M selected" with "Import as draft" and automated pricing rule application.
- **Detailed Preview Modal:** 24px-radius modal displaying CJ factory specs, warehouse origins, package weight/dimensions, and full variant breakdowns before importing.

#### 13. Orders & Fulfillment Matrix (`Admin - Orders List`) [PLANNED]

- **Order Ledger:** Columns for Storefront Order #, Customer Email, Payment Status (Stripe), Storefront Fulfillment Status, and CJ API Status (Pending, Syncing, Dispatched, Failed).
- **Direct Filters:** Rapid filters for "Failed CJ Orders" to allow immediate resolution of supplier stock or balance issues.

#### 14. Order Fulfillment Detail & Manual Override (`Admin - Order Detail`) [PLANNED]

- **Customer & Shipping Card:** Shipping destination, address verification status, and ordered line items.
- **CJ API Sync Card:** Real-time supplier status, CJ Order ID, tracking dispatch details, balance sufficiency warnings (e.g. "CJ balance is insufficient"), and a "Retry CJ Order" manual retry button.
- **Internal Audit Timeline:** Detailed log tracking customer checkout, Stripe payment intent, CJ API payload dispatch, carrier webhook updates, and internal admin notes.

---

## 6. Technical Architecture & Data Models

### 6.1 Core Entities & Schema Draft

```typescript
// Product Entity
interface Product {
  id: string;
  cj_product_id: string;
  title: string;
  slug: string;
  description_html: string;
  category: string;
  status: "active" | "draft" | "archived";
  images: string[];
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
}

// Variant & Pricing Entity
interface ProductVariant {
  id: string;
  cj_sku: string;
  title: string;
  supplier_cost: number; // Wholesale USD
  retail_price: number; // Customer price USD
  compare_at_price?: number;
  stock_quantity: number;
  weight_grams: number;
  margin_percentage: number;
}

// Order & Fulfillment Entity
interface Order {
  id: string;
  order_number: string; // e.g. CJS-10928
  customer_email: string;
  shipping_address: Address;
  line_items: OrderItem[];
  subtotal: number;
  shipping_fee: number;
  total: number;
  payment_status: "paid" | "pending" | "failed";
  stripe_payment_id: string;
  cj_fulfillment: {
    status: "unsubmitted" | "processing" | "dispatched" | "failed";
    cj_order_id?: string;
    tracking_number?: string;
    carrier_name?: string;
    last_error?: string;
  };
  timeline: {
    timestamp: string;
    event: string;
    type: "public" | "internal";
  }[];
}
```

---

## 7. Implementation Roadmap & Milestones

1. **Milestone 1 — Storefront Exploration & Foundation (Completed):**
   - High-contrast design system token definition.
   - `Storefront - Home`, `Storefront - Products Listing`, and `Storefront - Product Detail` screens published to the canvas.
2. **Milestone 2 — Customer Purchasing Flow (Next Phase):**
   - `Storefront - Cart` (interactive item rows, delivery note, empty state variant).
   - `Storefront - Checkout` (two-column shipping and Stripe payment form).
   - `Storefront - Checkout Success` & `Storefront - Order Status` (live carrier tracking timeline).
   - `Storefront - Auth & Account` (Login, Registration, Customer Profile).
3. **Milestone 3 — Sourcing & Admin Operations:**
   - `Admin - Dashboard` & `Admin - Orders List`.
   - `Admin - Import CJ Products` (search, skeleton states, and inspection modal).
   - `Admin - Edit Product` (margin calculator and image ordering).
   - `Admin - Order Detail` (CJ API diagnostics and manual re-dispatch).
4. **Milestone 4 — System Polish & Mobile Breakpoints:**
   - 390px mobile responsive viewports for primary checkout and catalog screens.
   - Dark theme variants across all storefront and admin surfaces.
