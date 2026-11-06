export type SupplierOrderStatus =
  | "queued"
  | "submitted"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "failed"
  | "cancelled";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type FulfillmentStatus =
  | "unfulfilled"
  | "queued"
  | "submitted"
  | "shipped"
  | "delivered"
  | "failed"
  | "cancelled";

export type MappedStatus = {
  supplier: SupplierOrderStatus;
  order: OrderStatus;
  fulfillment: FulfillmentStatus;
  event: { type: string; message: string };
};

export const SUPPLIER_RANK: Record<SupplierOrderStatus, number> = {
  queued: 0,
  failed: 0,
  submitted: 1,
  confirmed: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
};

export const ORDER_RANK: Record<OrderStatus, number> = {
  pending_payment: 0,
  paid: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
  refunded: 6,
};

export const FULFILLMENT_RANK: Record<FulfillmentStatus, number> = {
  unfulfilled: 0,
  failed: 0,
  queued: 1,
  submitted: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 5,
};

export function canAdvance<T extends string>(
  current: T,
  next: T,
  rank: Record<T, number>,
): boolean {
  return rank[next] > rank[current];
}

/**
 * CJ order statuses are documented in `docs/cj-notes.md`. They are not a
 * numeric enum, so compare case-insensitively and ignore anything unknown.
 */
export function mapCjOrderStatus(status: string): MappedStatus | null {
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

/**
 * CJ `trackingStatus` is free text. Map only the obvious states and keep the
 * raw value out of the customer-facing status field.
 */
export function mapShipmentStatus(
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

/**
 * Logistics webhook `trackingStatus` numeric enum (official CJ docs):
 * 0 no info, 1 warehouse shipped, ... 10 out for delivery, 11 ready for pickup,
 * 12 delivered, 13 failed/exception, 14 return.
 */
export function mapTrackingStatusNumber(code: number): string {
  if (code === 12) {
    return "delivered";
  }

  if (code === 13 || code === 14) {
    return "exception";
  }

  if (code === 10) {
    return "out_for_delivery";
  }

  return "in_transit";
}

/**
 * A logistics webhook means CJ has a tracking number. Advance to shipped, or
 * delivered when trackingStatus=12. Exception updates must not downgrade a
 * delivered order.
 */
export function mapLogisticsStatus(code: number): MappedStatus | null {
  if (code === 12) {
    return {
      supplier: "delivered",
      order: "delivered",
      fulfillment: "delivered",
      event: {
        type: "order_delivered",
        message: "Your order was delivered",
      },
    };
  }

  if (code >= 0) {
    return {
      supplier: "shipped",
      order: "shipped",
      fulfillment: "shipped",
      event: {
        type: "order_shipped",
        message: "Your order has shipped",
      },
    };
  }

  return null;
}
