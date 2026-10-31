import { createCjClient } from "../cj/factory.ts";
import { getOrder } from "../cj/orders.ts";
import { getTrackingInfo } from "../cj/tracking.ts";
import type { CjOrder } from "../cj/types.ts";
import { sendShippedEmail } from "../email.ts";
import type { createAdminClient } from "../supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export type SupplierOrderStatus =
  | "queued"
  | "submitted"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "failed"
  | "cancelled";

type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

type FulfillmentStatus =
  | "unfulfilled"
  | "queued"
  | "submitted"
  | "shipped"
  | "delivered"
  | "failed"
  | "cancelled";

type TrackingRow = {
  id: string;
  order_id: string;
  supplier_order_id: string | null;
  status: SupplierOrderStatus;
  orders:
    | {
        order_number: string;
        status: OrderStatus;
        fulfillment_status: FulfillmentStatus;
      }
    | Array<{
        order_number: string;
        status: OrderStatus;
        fulfillment_status: FulfillmentStatus;
      }>
    | null;
};

type MappedStatus = {
  supplier: SupplierOrderStatus;
  order: OrderStatus;
  fulfillment: FulfillmentStatus;
  event: { type: string; message: string };
};

export type TrackingOutcome =
  | {
      status: "updated";
      orderId: string;
      supplierOrderId: string;
      supplierStatus: SupplierOrderStatus;
      trackingNumber: string | null;
      emailed: boolean;
    }
  | {
      status: "error";
      orderId: string;
      supplierOrderId: string;
      error: string;
    };

const SUPPLIER_RANK: Record<SupplierOrderStatus, number> = {
  queued: 0,
  failed: 0,
  submitted: 1,
  confirmed: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
};

const ORDER_RANK: Record<OrderStatus, number> = {
  pending_payment: 0,
  paid: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
  refunded: 6,
};

const FULFILLMENT_RANK: Record<FulfillmentStatus, number> = {
  unfulfilled: 0,
  failed: 0,
  queued: 1,
  submitted: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

/**
 * CJ order statuses are documented in `docs/cj-notes.md`. They are not a
 * numeric enum, so compare case-insensitively and ignore anything unknown.
 */
function mapCjOrderStatus(status: string): MappedStatus | null {
  switch (status.trim().toUpperCase()) {
    case "SHIPPED":
      return {
        supplier: "shipped",
        order: "shipped",
        fulfillment: "shipped",
        event: {
          type: "order_shipped",
          message: "Your order has shipped",
        },
      };
    case "DELIVERED":
      return {
        supplier: "delivered",
        order: "delivered",
        fulfillment: "delivered",
        event: {
          type: "order_delivered",
          message: "Your order was delivered",
        },
      };
    case "CANCELLED":
      return {
        supplier: "cancelled",
        order: "cancelled",
        fulfillment: "cancelled",
        event: {
          type: "order_cancelled",
          message: "Your order was cancelled",
        },
      };
    case "UNSHIPPED":
    case "PROCESSING":
    case "PENDING":
      return {
        supplier: "confirmed",
        order: "processing",
        fulfillment: "submitted",
        event: {
          type: "order_processing",
          message: "Your order is being prepared",
        },
      };
    default:
      return null;
  }
}

function canAdvance<T extends string>(
  current: T,
  next: T,
  rank: Record<T, number>,
): boolean {
  return rank[next] > rank[current];
}

/**
 * CJ `trackingStatus` is free text. Map only the obvious states and keep the
 * raw value out of the customer-facing status field.
 */
function mapShipmentStatus(
  trackingStatus: string | null,
  cjOrderStatus: string,
): string {
  const normalized = (trackingStatus ?? "").toLowerCase();
  const orderStatus = cjOrderStatus.trim().toUpperCase();

  if (orderStatus === "DELIVERED" || normalized.includes("deliver")) {
    return "delivered";
  }

  if (
    normalized.includes("return") ||
    normalized.includes("exception") ||
    normalized.includes("fail") ||
    normalized.includes("refused")
  ) {
    return "exception";
  }

  if (normalized.includes("out for delivery")) {
    return "out_for_delivery";
  }

  return "in_transit";
}

function trackingUrlFrom(order: CjOrder): string | null {
  return order.trackingUrl?.trim() || null;
}

async function loadTrackingRows(
  admin: AdminClient,
  limit: number,
): Promise<TrackingRow[]> {
  const { data, error } = await admin
    .from("supplier_orders")
    .select(
      "id,order_id,supplier_order_id,status,orders(order_number,status,fulfillment_status)",
    )
    .eq("supplier", "cj")
    .in("status", ["submitted", "confirmed", "shipped"])
    .not("supplier_order_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Could not load supplier orders: ${error.message}`);
  }

  return (data ?? []) as TrackingRow[];
}

async function syncOne(
  admin: AdminClient,
  client: ReturnType<typeof createCjClient>,
  row: TrackingRow,
): Promise<TrackingOutcome> {
  if (!row.supplier_order_id) {
    return {
      status: "error",
      orderId: row.order_id,
      supplierOrderId: row.id,
      error: "Supplier order has no CJ order id",
    };
  }

  try {
    const cjOrder = await getOrder(client, {
      orderId: row.supplier_order_id,
    });
    const order = firstRelation(row.orders);
    const mapped = mapCjOrderStatus(cjOrder.orderStatus);

    let supplierStatus = row.status;
    let orderStatus: OrderStatus | null = null;
    let fulfillmentStatus: FulfillmentStatus | null = null;

    if (mapped) {
      if (canAdvance(row.status, mapped.supplier, SUPPLIER_RANK)) {
        supplierStatus = mapped.supplier;
      }

      if (order) {
        if (canAdvance(order.status, mapped.order, ORDER_RANK)) {
          orderStatus = mapped.order;
        }

        if (
          canAdvance(
            order.fulfillment_status,
            mapped.fulfillment,
            FULFILLMENT_RANK,
          )
        ) {
          fulfillmentStatus = mapped.fulfillment;
        }
      }
    }

    const trackingNumber = cjOrder.trackNumber?.trim() || null;
    let carrier =
      cjOrder.trackingProvider?.trim() ||
      cjOrder.logisticName?.trim() ||
      null;
    const trackingUrl = trackingUrlFrom(cjOrder);
    let shipmentStatus = mapShipmentStatus(null, cjOrder.orderStatus);

    if (
      trackingNumber &&
      cjOrder.orderStatus.trim().toUpperCase() !== "DELIVERED"
    ) {
      try {
        const [info] = await getTrackingInfo(client, [trackingNumber]);

        if (info) {
          carrier =
            info.lastMileCarrier?.trim() ||
            info.logisticName?.trim() ||
            carrier;
          shipmentStatus = mapShipmentStatus(
            info.trackingStatus,
            cjOrder.orderStatus,
          );
        }
      } catch (error) {
        // A missing tracking feed should not hide a valid CJ tracking number.
        console.warn(
          `Could not load tracking info for ${trackingNumber}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }

    // Only emit an event when CJ is moving the order forward. A late
    // "processing" poll must not overwrite a shipped timeline.
    const eventAllowed =
      mapped !== null &&
      SUPPLIER_RANK[mapped.supplier] >= SUPPLIER_RANK[row.status] &&
      (!order || ORDER_RANK[mapped.order] >= ORDER_RANK[order.status]);

    const { data, error } = await admin.rpc("apply_supplier_order_update", {
      p_order_id: row.order_id,
      p_supplier_order_id: row.id,
      p_carrier: carrier,
      p_tracking_number: trackingNumber,
      p_tracking_url: trackingUrl,
      p_shipment_status: trackingNumber ? shipmentStatus : null,
      p_supplier_status: supplierStatus,
      p_order_status: orderStatus,
      p_fulfillment_status: fulfillmentStatus,
      p_event_type: eventAllowed ? mapped.event.type : null,
      p_event_message: eventAllowed ? mapped.event.message : null,
    });

    if (error) {
      throw new Error(`Could not store tracking: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const shipmentId = result?.shipment_id ?? null;
    const shouldNotify =
      Boolean(result?.should_notify) && Boolean(shipmentId) && Boolean(trackingNumber);
    let emailed = false;

    if (shouldNotify && shipmentId && trackingNumber) {
      try {
        const emailResult = await sendShippedEmail(admin, row.order_id, {
          trackingNumber,
          trackingUrl,
          carrier,
        });

        if (emailResult.sent) {
          emailed = true;

          const { error: notifiedError } = await admin
            .from("shipments")
            .update({ notified_at: new Date().toISOString() })
            .eq("id", shipmentId);

          if (notifiedError) {
            console.error(
              `Could not mark shipment ${shipmentId} as notified: ${notifiedError.message}`,
            );
          }
        }
      } catch (error) {
        // Leave notified_at empty so the next cron run retries the email.
        console.error(
          `Could not send the shipped email for order ${row.order_id}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }

    return {
      status: "updated",
      orderId: row.order_id,
      supplierOrderId: row.id,
      supplierStatus,
      trackingNumber,
      emailed,
    };
  } catch (error) {
    return {
      status: "error",
      orderId: row.order_id,
      supplierOrderId: row.id,
      error: error instanceof Error ? error.message : "Unknown tracking error",
    };
  }
}

/**
 * Poll CJ for every active supplier order and apply status/tracking changes.
 * The cron route calls this every three hours.
 */
export async function syncTracking(
  admin: AdminClient,
  limit = 20,
): Promise<TrackingOutcome[]> {
  const rows = await loadTrackingRows(admin, limit);

  if (rows.length === 0) {
    return [];
  }

  const client = createCjClient();
  const results: TrackingOutcome[] = [];

  for (const row of rows) {
    results.push(await syncOne(admin, client, row));
  }

  return results;
}
