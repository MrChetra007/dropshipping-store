import { toCents } from "./money.ts";
import type { createAdminClient } from "./supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

type EmailOrder = {
  orderNumber: string;
  accessToken: string;
  email: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  shipName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipState: string | null;
  shipPostalCode: string;
  shipCountryCode: string;
  items: Array<{
    title: string;
    variantTitle: string | null;
    quantity: number;
    lineTotalCents: number;
  }>;
};

type StoreSettings = {
  name: string;
  supportEmail: string | null;
};

export type ShippedEmailInput = {
  trackingNumber: string;
  trackingUrl: string | null;
  carrier: string | null;
};

export type RefundProcessedEmailInput = {
  amountCents: number;
  currency: string;
  reason: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function siteUrl(): string {
  return (Deno.env.get("SITE_URL") ?? "").trim().replace(/\/+$/, "");
}

/**
 * Guests open the order page with the same access token used at checkout. The
 * link only goes to the order email, so putting the token in it is safe.
 */
function orderUrl(order: EmailOrder): string | null {
  const base = siteUrl();

  if (!base) {
    return null;
  }

  return `${base}/orders/${encodeURIComponent(
    order.orderNumber,
  )}?token=${encodeURIComponent(order.accessToken)}`;
}

async function loadStoreSettings(admin: AdminClient): Promise<StoreSettings> {
  const { data } = await admin
    .from("settings")
    .select("value")
    .eq("key", "public.store")
    .maybeSingle();

  const value =
    data?.value && typeof data.value === "object" && !Array.isArray(data.value)
      ? (data.value as Record<string, unknown>)
      : {};

  return {
    name: typeof value.name === "string" ? value.name : "Our store",
    supportEmail:
      typeof value.support_email === "string" ? value.support_email : null,
  };
}

async function loadOrder(
  admin: AdminClient,
  orderId: string,
): Promise<EmailOrder | null> {
  const { data: order, error } = await admin
    .from("orders")
    .select(
      "order_number,access_token,email,currency,subtotal,shipping_total,discount_total,total,ship_name,ship_line1,ship_line2,ship_city,ship_state,ship_postal_code,ship_country_code",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load order for email: ${error.message}`);
  }

  if (!order) {
    return null;
  }

  const { data: items, error: itemError } = await admin
    .from("order_items")
    .select("title,variant_title,quantity,line_total")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (itemError) {
    throw new Error(`Could not load order items for email: ${itemError.message}`);
  }

  return {
    orderNumber: order.order_number,
    accessToken: order.access_token,
    email: order.email,
    currency: order.currency,
    subtotalCents: toCents(order.subtotal) ?? 0,
    shippingCents: toCents(order.shipping_total) ?? 0,
    discountCents: toCents(order.discount_total) ?? 0,
    totalCents: toCents(order.total) ?? 0,
    shipName: order.ship_name,
    shipLine1: order.ship_line1,
    shipLine2: order.ship_line2,
    shipCity: order.ship_city,
    shipState: order.ship_state,
    shipPostalCode: order.ship_postal_code,
    shipCountryCode: order.ship_country_code,
    items: (items ?? []).map((item) => ({
      title: item.title,
      variantTitle: item.variant_title,
      quantity: item.quantity,
      lineTotalCents: toCents(item.line_total) ?? 0,
    })),
  };
}

function emailShell(
  store: StoreSettings,
  content: string,
): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#171717;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:24px;">
        <p style="margin:0 0 4px;color:#666;font-size:13px;">${escapeHtml(store.name)}</p>
        ${content}
      </div>
      <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">
        This is a transactional email about your order.
      </p>
    </div>
  </body>
</html>`;
}

function supportLine(store: StoreSettings): string {
  return store.supportEmail
    ? `<p style="color:#666;font-size:13px;">Questions? Reply to this email or contact <a href="mailto:${escapeHtml(
        store.supportEmail,
      )}">${escapeHtml(store.supportEmail)}</a>.</p>`
    : "";
}

function viewOrderLine(order: EmailOrder): string {
  const url = orderUrl(order);

  if (!url) {
    return "";
  }

  return `<p style="margin:20px 0 0;font-size:14px;">
    <a href="${escapeHtml(url)}" style="color:#171717;">View your order</a>
  </p>`;
}

function addressBlock(order: EmailOrder): string {
  return [
    order.shipName,
    order.shipLine1,
    order.shipLine2,
    `${order.shipCity}${order.shipState ? `, ${order.shipState}` : ""} ${order.shipPostalCode}`,
    order.shipCountryCode,
  ]
    .filter(Boolean)
    .map((line) => `<div>${escapeHtml(String(line))}</div>`)
    .join("");
}

function renderOrderConfirmation(
  order: EmailOrder,
  store: StoreSettings,
): string {
  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            <strong>${escapeHtml(item.title)}</strong>
            ${
              item.variantTitle && item.variantTitle !== "Default"
                ? `<br><span style="color:#666;font-size:13px;">${escapeHtml(item.variantTitle)}</span>`
                : ""
            }
            <br><span style="color:#666;font-size:13px;">Qty ${item.quantity}</span>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;vertical-align:top;">
            ${formatCents(item.lineTotalCents, order.currency)}
          </td>
        </tr>`,
    )
    .join("");

  const discountRow =
    order.discountCents > 0
      ? `<tr><td style="color:#666;">Discount</td><td style="text-align:right;">−${formatCents(
          order.discountCents,
          order.currency,
        )}</td></tr>`
      : "";

  return emailShell(
    store,
    `<h1 style="margin:0 0 8px;font-size:22px;">Thanks for your order</h1>
        <p style="margin:0 0 20px;color:#444;font-size:14px;">
          Order <strong>${escapeHtml(order.orderNumber)}</strong> is confirmed. We will email tracking details as soon as it ships.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${itemRows}
          <tr><td style="padding:8px 0;color:#666;">Subtotal</td><td style="text-align:right;">${formatCents(
            order.subtotalCents,
            order.currency,
          )}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Shipping</td><td style="text-align:right;">${formatCents(
            order.shippingCents,
            order.currency,
          )}</td></tr>
          ${discountRow}
          <tr>
            <td style="padding:10px 0 0;font-weight:bold;border-top:1px solid #ddd;">Total</td>
            <td style="padding:10px 0 0;text-align:right;font-weight:bold;border-top:1px solid #ddd;">${formatCents(
              order.totalCents,
              order.currency,
            )}</td>
          </tr>
        </table>

        <h2 style="margin:24px 0 8px;font-size:14px;">Shipping address</h2>
        <div style="color:#444;font-size:14px;line-height:1.5;">${addressBlock(order)}</div>

        ${viewOrderLine(order)}
        ${supportLine(store)}`,
  );
}

function renderShipped(
  order: EmailOrder,
  store: StoreSettings,
  shipment: ShippedEmailInput,
): string {
  const trackingLink = shipment.trackingUrl
    ? `<p style="margin:8px 0 0;font-size:14px;">
        <a href="${escapeHtml(shipment.trackingUrl)}" style="color:#171717;">Track your package</a>
      </p>`
    : "";

  return emailShell(
    store,
    `<h1 style="margin:0 0 8px;font-size:22px;">Your order has shipped</h1>
        <p style="margin:0 0 20px;color:#444;font-size:14px;">
          Good news — order <strong>${escapeHtml(order.orderNumber)}</strong> is on its way.
        </p>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#666;">Carrier</td>
            <td style="padding:8px 0;text-align:right;">${escapeHtml(
              shipment.carrier ?? "—",
            )}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;">Tracking number</td>
            <td style="padding:8px 0;text-align:right;font-family:monospace;">${escapeHtml(
              shipment.trackingNumber,
            )}</td>
          </tr>
        </table>
        ${trackingLink}

        <h2 style="margin:24px 0 8px;font-size:14px;">Shipping address</h2>
        <div style="color:#444;font-size:14px;line-height:1.5;">${addressBlock(order)}</div>

        <p style="margin:20px 0 0;color:#666;font-size:13px;">
          Delivery can take 7–25 days depending on the destination. The tracking
          page usually updates within a few days of dispatch.
        </p>

        ${viewOrderLine(order)}
        ${supportLine(store)}`,
  );
}

function renderRefundProcessed(
  order: EmailOrder,
  store: StoreSettings,
  refund: RefundProcessedEmailInput,
): string {
  const reason = refund.reason
    ? `<p style="margin:0 0 16px;color:#444;font-size:14px;">Reason: ${escapeHtml(
        refund.reason,
      )}</p>`
    : "";

  return emailShell(
    store,
    `<h1 style="margin:0 0 8px;font-size:22px;">Refund processed</h1>
        <p style="margin:0 0 16px;color:#444;font-size:14px;">
          We processed a refund of
          <strong>${formatCents(refund.amountCents, refund.currency)}</strong>
          for order <strong>${escapeHtml(order.orderNumber)}</strong>.
        </p>
        ${reason}
        <p style="margin:0 0 16px;color:#444;font-size:14px;">
          The refund is sent to your original payment method. Banks and card
          issuers usually take 5–10 business days to post it.
        </p>
        ${viewOrderLine(order)}
        ${supportLine(store)}`,
  );
}

export type EmailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "order_not_found" };

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<EmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");

  if (!apiKey || !from) {
    console.warn(
      `Email "${subject}" skipped: RESEND_API_KEY/EMAIL_FROM not set`,
    );
    return { sent: false, reason: "not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Resend responded with ${response.status}`);
  }

  return { sent: true };
}

export async function sendOrderConfirmationEmail(
  admin: AdminClient,
  orderId: string,
): Promise<EmailResult> {
  const order = await loadOrder(admin, orderId);

  if (!order) {
    return { sent: false, reason: "order_not_found" };
  }

  const store = await loadStoreSettings(admin);

  return sendEmail(
    order.email,
    `Order ${order.orderNumber} confirmed`,
    renderOrderConfirmation(order, store),
  );
}

export async function sendShippedEmail(
  admin: AdminClient,
  orderId: string,
  shipment: ShippedEmailInput,
): Promise<EmailResult> {
  const order = await loadOrder(admin, orderId);

  if (!order) {
    return { sent: false, reason: "order_not_found" };
  }

  const store = await loadStoreSettings(admin);

  return sendEmail(
    order.email,
    `Order ${order.orderNumber} has shipped`,
    renderShipped(order, store, shipment),
  );
}

export async function sendRefundProcessedEmail(
  admin: AdminClient,
  orderId: string,
  refund: RefundProcessedEmailInput,
): Promise<EmailResult> {
  const order = await loadOrder(admin, orderId);

  if (!order) {
    return { sent: false, reason: "order_not_found" };
  }

  const store = await loadStoreSettings(admin);

  return sendEmail(
    order.email,
    `Refund processed for order ${order.orderNumber}`,
    renderRefundProcessed(order, store, refund),
  );
}
