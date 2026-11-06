import type { AdminUser } from "../_shared/auth.ts";
import { sendOrderConfirmationEmail } from "../_shared/email.ts";
import {
  triggerFulfillment,
  waitUntil,
} from "../_shared/fulfillment-trigger.ts";
import { HttpError } from "../_shared/http.ts";
import { toCents } from "../_shared/money.ts";
import type { createAdminClient } from "../_shared/supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

type OrderListRow = {
  id: string;
  order_number: string;
  email: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  currency: string;
  total: unknown;
  created_at: string;
  supplier_orders:
    | Array<{ status: string; error: string | null; attempts: number }>
    | null;
};

type OrderItemRow = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  image_url: string | null;
  unit_price: unknown;
  quantity: number;
  line_total: unknown;
  created_at: string;
};

type OrderEventRow = {
  id: number;
  type: string;
  message: string | null;
  is_public: boolean;
  created_at: string;
};

type SupplierOrderRow = {
  id: string;
  status: string;
  supplier_order_id: string | null;
  shipping_method: string | null;
  supplier_cost_total: unknown;
  attempts: number;
  next_attempt_at: string;
  error: string | null;
  updated_at: string;
};

type OrderDetailRow = {
  id: string;
  order_number: string;
  email: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  currency: string;
  subtotal: unknown;
  shipping_total: unknown;
  discount_total: unknown;
  tax_total: unknown;
  total: unknown;
  ship_name: string;
  ship_phone: string | null;
  ship_line1: string;
  ship_line2: string | null;
  ship_city: string;
  ship_state: string | null;
  ship_postal_code: string;
  ship_country_code: string;
  customer_note: string | null;
  created_at: string;
  paid_at: string | null;
  order_items: OrderItemRow[] | null;
  order_events: OrderEventRow[] | null;
  supplier_orders: SupplierOrderRow[] | null;
};

function byCreatedAt(
  a: { createdAt: string },
  b: { createdAt: string },
): number {
  return a.createdAt.localeCompare(b.createdAt);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireOrderId(orderId: string): string {
  if (!UUID_PATTERN.test(orderId)) {
    throw new HttpError(400, "Invalid order id");
  }

  return orderId;
}

export async function listAdminOrders(admin: AdminClient) {
  const { data, error } = await admin
    .from("orders")
    .select(
      "id,order_number,email,status,payment_status,fulfillment_status,currency,total,created_at,supplier_orders(status,error,attempts)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new HttpError(500, error.message);
  }

  return ((data ?? []) as OrderListRow[]).map((order) => {
    const supplierOrder = order.supplier_orders?.[0] ?? null;

    return {
      id: order.id,
      orderNumber: order.order_number,
      email: order.email,
      status: order.status,
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status,
      currency: order.currency,
      totalCents: toCents(order.total) ?? 0,
      createdAt: order.created_at,
      supplierStatus: supplierOrder?.status ?? null,
      supplierError: supplierOrder?.error ?? null,
      supplierAttempts: supplierOrder?.attempts ?? 0,
    };
  });
}

export async function getAdminOrder(admin: AdminClient, orderId: string) {
  const id = requireOrderId(orderId);

  const { data, error } = await admin
    .from("orders")
    .select(
      "id,order_number,email,status,payment_status,fulfillment_status,currency,subtotal,shipping_total,discount_total,tax_total,total,ship_name,ship_phone,ship_line1,ship_line2,ship_city,ship_state,ship_postal_code,ship_country_code,customer_note,created_at,paid_at,order_items(id,title,variant_title,sku,image_url,unit_price,quantity,line_total,created_at),order_events(id,type,message,is_public,created_at),supplier_orders(id,status,supplier_order_id,shipping_method,supplier_cost_total,attempts,next_attempt_at,error,updated_at)",
    )
    .eq("id", id)
    .maybeSingle<OrderDetailRow>();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    throw new HttpError(404, "Order not found");
  }

  const supplierOrder = data.supplier_orders?.[0] ?? null;

  return {
    order: {
      id: data.id,
      orderNumber: data.order_number,
      email: data.email,
      status: data.status,
      paymentStatus: data.payment_status,
      fulfillmentStatus: data.fulfillment_status,
      currency: data.currency,
      subtotalCents: toCents(data.subtotal) ?? 0,
      shippingCents: toCents(data.shipping_total) ?? 0,
      discountCents: toCents(data.discount_total) ?? 0,
      taxCents: toCents(data.tax_total) ?? 0,
      totalCents: toCents(data.total) ?? 0,
      shipName: data.ship_name,
      shipPhone: data.ship_phone,
      shipLine1: data.ship_line1,
      shipLine2: data.ship_line2,
      shipCity: data.ship_city,
      shipState: data.ship_state,
      shipPostalCode: data.ship_postal_code,
      shipCountryCode: data.ship_country_code,
      customerNote: data.customer_note,
      createdAt: data.created_at,
      paidAt: data.paid_at,
      items: (data.order_items ?? [])
        .map((item) => ({
          id: item.id,
          title: item.title,
          variantTitle: item.variant_title,
          sku: item.sku,
          imageUrl: item.image_url,
          unitPriceCents: toCents(item.unit_price) ?? 0,
          quantity: item.quantity,
          lineTotalCents: toCents(item.line_total) ?? 0,
          createdAt: item.created_at,
        }))
        .sort(byCreatedAt),
      events: (data.order_events ?? [])
        .map((event) => ({
          id: event.id,
          type: event.type,
          message: event.message,
          isPublic: event.is_public,
          createdAt: event.created_at,
        }))
        .sort(byCreatedAt),
      supplierOrder: supplierOrder
        ? {
            id: supplierOrder.id,
            status: supplierOrder.status,
            supplierOrderId: supplierOrder.supplier_order_id,
            shippingMethod: supplierOrder.shipping_method,
            supplierCostCents:
              toCents(supplierOrder.supplier_cost_total) ?? null,
            attempts: supplierOrder.attempts,
            nextAttemptAt: supplierOrder.next_attempt_at,
            error: supplierOrder.error,
            updatedAt: supplierOrder.updated_at,
          }
        : null,
    },
  };
}

export async function retrySupplierOrder(
  admin: AdminClient,
  orderId: string,
): Promise<{ supplierOrderId: string }> {
  const id = requireOrderId(orderId);

  const { data: supplierOrder, error } = await admin
    .from("supplier_orders")
    .select("id,status")
    .eq("order_id", id)
    .eq("supplier", "cj")
    .maybeSingle<{ id: string; status: string }>();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!supplierOrder) {
    throw new HttpError(404, "This order has no CJ order yet");
  }

  if (supplierOrder.status !== "failed") {
    throw new HttpError(409, "Only failed CJ orders can be retried");
  }

  const { error: updateError } = await admin
    .from("supplier_orders")
    .update({
      status: "queued",
      attempts: 0,
      error: null,
      next_attempt_at: new Date().toISOString(),
    })
    .eq("id", supplierOrder.id);

  if (updateError) {
    throw new HttpError(500, updateError.message);
  }

  const { error: orderError } = await admin
    .from("orders")
    .update({ fulfillment_status: "queued" })
    .eq("id", id);

  if (orderError) {
    throw new HttpError(500, orderError.message);
  }

  const { error: eventError } = await admin.from("order_events").insert({
    order_id: id,
    type: "fulfillment_retry_requested",
    message: "Admin requested a CJ order retry",
    is_public: false,
  });

  if (eventError) {
    console.error(
      `Could not add the retry event for order ${id}: ${eventError.message}`,
    );
  }

  return { supplierOrderId: supplierOrder.id };
}

type ManualPaymentOrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  currency: string;
  total: unknown;
};

export type ManualPaymentResult = {
  status: "paid" | "duplicate" | "mismatch" | "ignored";
  orderId: string;
  orderNumber: string;
  supplierOrderId: string | null;
};

/**
 * Confirm a bank transfer from the admin order page. This runs through the same
 * atomic `mark_order_paid` RPC as a provider webhook, so it queues the CJ order
 * and is idempotent. The deterministic manual payment id means clicking twice
 * cannot create a second payment.
 */
export async function markOrderPaidManually(
  admin: AdminClient,
  orderId: string,
  adminUser: AdminUser,
  reference: string | null,
): Promise<ManualPaymentResult> {
  const id = requireOrderId(orderId);

  const { data: order, error } = await admin
    .from("orders")
    .select("id,order_number,status,payment_status,currency,total")
    .eq("id", id)
    .maybeSingle<ManualPaymentOrderRow>();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!order) {
    throw new HttpError(404, "Order not found");
  }

  if (order.status !== "pending_payment" || order.payment_status === "paid") {
    throw new HttpError(409, "Order is not awaiting payment");
  }

  const { data, error: paidError } = await admin.rpc("mark_order_paid", {
    p_order_id: order.id,
    p_provider: "manual",
    p_provider_payment_id: `manual_${order.id}`,
    p_amount: Number(order.total),
    p_currency: order.currency,
    p_raw: {
      source: "admin_manual",
      reference,
      marked_by: adminUser.id,
      marked_by_email: adminUser.email,
    },
  });

  if (paidError) {
    throw new HttpError(500, `Could not mark the order paid: ${paidError.message}`);
  }

  const status = String(data);

  if (
    status !== "paid" &&
    status !== "duplicate" &&
    status !== "mismatch" &&
    status !== "ignored"
  ) {
    throw new HttpError(500, `Unexpected mark_order_paid result: ${status}`);
  }

  let supplierOrderId: string | null = null;

  if (status === "paid") {
    const { error: eventError } = await admin.from("order_events").insert({
      order_id: order.id,
      type: "payment_confirmed_manual",
      message: reference
        ? `Manual payment confirmed (reference: ${reference})`
        : "Manual payment confirmed by an admin",
      is_public: false,
      data: {
        reference,
        marked_by: adminUser.id,
      },
    });

    if (eventError) {
      console.error(
        `Could not add the manual payment event for order ${order.id}: ${eventError.message}`,
      );
    }

    const { data: supplierOrder } = await admin
      .from("supplier_orders")
      .select("id")
      .eq("order_id", order.id)
      .eq("supplier", "cj")
      .maybeSingle<{ id: string }>();

    supplierOrderId = supplierOrder?.id ?? null;

    // Match the payment webhook: do not block the admin response on email or
    // the CJ worker kick.
    waitUntil(sendOrderConfirmationEmail(admin, order.id));

    if (supplierOrderId) {
      waitUntil(triggerFulfillment(supplierOrderId));
    }
  }

  return {
    status,
    orderId: order.id,
    orderNumber: order.order_number,
    supplierOrderId,
  };
}
