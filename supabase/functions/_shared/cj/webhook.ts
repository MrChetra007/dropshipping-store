import { z } from "npm:zod@4";

import { sendShippedEmail } from "../email.ts";
import { waitUntil } from "../fulfillment-trigger.ts";
import { HttpError } from "../http.ts";
import type { createAdminClient } from "../supabase.ts";
import { createCjClient } from "./factory.ts";
import {
  canAdvance,
  FULFILLMENT_RANK,
  mapCjOrderStatus,
  mapLogisticsStatus,
  mapShipmentStatus,
  mapTrackingStatusNumber,
  ORDER_RANK,
  SUPPLIER_RANK,
  type FulfillmentStatus,
  type MappedStatus,
  type OrderStatus,
  type SupplierOrderStatus,
} from "./status.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export type CjWebhookStatus =
  | "processed"
  | "duplicate"
  | "ignored"
  | "failed";

export type CjWebhookResult = {
  status: CjWebhookStatus;
  error?: string;
};

const orderParamsSchema = z
  .object({
    cjOrderId: z.string().trim().min(1).max(200),
    orderNumber: z.string().trim().max(200).nullish(),
    orderStatus: z.string().trim().min(1).max(100),
    logisticName: z.string().max(200).nullish(),
    trackNumber: z.string().max(200).nullish(),
    trackingUrl: z.string().max(1_000).nullish(),
    trackingProvider: z.string().max(200).nullish(),
    privateOutboundOrder: z.boolean().nullish(),
  })
  .passthrough();

const logisticsParamsSchema = z
  .object({
    orderId: z.string().trim().min(1).max(200),
    storeOrderNumbers: z.array(z.string()).nullish(),
    logisticName: z.string().max(200).nullish(),
    trackingNumber: z.string().trim().min(1).max(200),
    trackingUrl: z.string().max(1_000).nullish(),
    trackingProvider: z.string().max(200).nullish(),
    trackingStatus: z.number().int().min(0).max(14),
  })
  .passthrough();

const webhookEnvelopeSchema = z
  .object({
    messageId: z.string().trim().min(1).max(200),
    type: z.string().trim().min(1).max(50),
    messageType: z.string().max(50).nullish(),
    params: z.unknown(),
  })
  .passthrough();

type SupplierRow = {
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

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;

  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }

  return btoa(binary);
}

async function hmacBase64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );

  return bytesToBase64(new Uint8Array(signature));
}

function timingSafeEqual(received: string, expected: string): boolean {
  if (received.length !== expected.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return difference === 0;
}

async function markEvent(
  admin: AdminClient,
  eventRowId: string,
  status: "processed" | "failed" | "ignored",
  error?: string,
): Promise<void> {
  const { error: updateError } = await admin
    .from("webhook_events")
    .update({
      status,
      error: error ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventRowId);

  if (updateError) {
    console.error(
      `Could not update CJ webhook event ${eventRowId}: ${updateError.message}`,
    );
  }
}

async function findSupplierOrder(
  admin: AdminClient,
  cjOrderId: string,
  orderNumber: string | null,
): Promise<SupplierRow | null> {
  const select =
    "id,order_id,supplier_order_id,status,orders(order_number,status,fulfillment_status)";

  const { data, error } = await admin
    .from("supplier_orders")
    .select(select)
    .eq("supplier", "cj")
    .eq("supplier_order_id", cjOrderId)
    .maybeSingle<SupplierRow>();

  if (error) {
    throw new HttpError(500, `Could not load supplier order: ${error.message}`);
  }

  if (data) {
    return data;
  }

  if (!orderNumber) {
    return null;
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id")
    .eq("order_number", orderNumber)
    .maybeSingle<{ id: string }>();

  if (orderError) {
    throw new HttpError(500, `Could not load order: ${orderError.message}`);
  }

  if (!order) {
    return null;
  }

  const { data: supplierOrder, error: supplierError } = await admin
    .from("supplier_orders")
    .select(select)
    .eq("supplier", "cj")
    .eq("order_id", order.id)
    .maybeSingle<SupplierRow>();

  if (supplierError) {
    throw new HttpError(
      500,
      `Could not load supplier order: ${supplierError.message}`,
    );
  }

  return supplierOrder ?? null;
}

function eventAllowed(
  mapped: MappedStatus | null,
  row: SupplierRow,
  order: {
    status: OrderStatus;
    fulfillment_status: FulfillmentStatus;
  } | null,
): boolean {
  if (!mapped) {
    return false;
  }

  return (
    SUPPLIER_RANK[mapped.supplier] >= SUPPLIER_RANK[row.status] &&
    (!order || ORDER_RANK[mapped.order] >= ORDER_RANK[order.status])
  );
}

async function applyUpdate(
  admin: AdminClient,
  row: SupplierRow,
  input: {
    mapped: MappedStatus | null;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shipmentStatus: string | null;
  },
): Promise<void> {
  const order = firstRelation(row.orders);
  const allowEvent = eventAllowed(input.mapped, row, order);
  let supplierStatus = row.status;
  let orderStatus: OrderStatus | null = null;
  let fulfillmentStatus: FulfillmentStatus | null = null;

  if (input.mapped) {
    if (canAdvance(row.status, input.mapped.supplier, SUPPLIER_RANK)) {
      supplierStatus = input.mapped.supplier;
    }

    if (order) {
      if (canAdvance(order.status, input.mapped.order, ORDER_RANK)) {
        orderStatus = input.mapped.order;
      }

      if (
        canAdvance(
          order.fulfillment_status,
          input.mapped.fulfillment,
          FULFILLMENT_RANK,
        )
      ) {
        fulfillmentStatus = input.mapped.fulfillment;
      }
    }
  }

  const { data, error } = await admin.rpc("apply_supplier_order_update", {
    p_order_id: row.order_id,
    p_supplier_order_id: row.id,
    p_carrier: input.carrier,
    p_tracking_number: input.trackingNumber,
    p_tracking_url: input.trackingUrl,
    p_shipment_status: input.trackingNumber ? input.shipmentStatus : null,
    p_supplier_status: supplierStatus,
    p_order_status: orderStatus,
    p_fulfillment_status: fulfillmentStatus,
    p_event_type: allowEvent && input.mapped ? input.mapped.event.type : null,
    p_event_message: allowEvent && input.mapped
      ? input.mapped.event.message
      : null,
  });

  if (error) {
    throw new HttpError(500, `Could not apply CJ update: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;
  const shipmentId = result?.shipment_id ?? null;
  const shouldNotify =
    Boolean(result?.should_notify) &&
    Boolean(shipmentId) &&
    Boolean(input.trackingNumber);

  if (!shouldNotify || !shipmentId || !input.trackingNumber) {
    return;
  }

  waitUntil(
    (async () => {
      const emailResult = await sendShippedEmail(admin, row.order_id, {
        trackingNumber: input.trackingNumber as string,
        trackingUrl: input.trackingUrl,
        carrier: input.carrier,
      });

      if (emailResult.sent) {
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
    })(),
  );
}

async function handleOrder(
  admin: AdminClient,
  params: unknown,
): Promise<CjWebhookResult> {
  const parsed = orderParamsSchema.safeParse(params);

  if (!parsed.success) {
    return { status: "ignored", error: "Unrecognised ORDER payload" };
  }

  const data = parsed.data;
  const row = await findSupplierOrder(
    admin,
    data.cjOrderId,
    data.orderNumber?.trim() || null,
  );

  if (!row) {
    return { status: "ignored", error: "Order not found" };
  }

  if (row.supplier_order_id !== data.cjOrderId) {
    const { error } = await admin
      .from("supplier_orders")
      .update({ supplier_order_id: data.cjOrderId })
      .eq("id", row.id);

    if (error) {
      console.error(
        `Could not update CJ order id for supplier order ${row.id}: ${error.message}`,
      );
    }
  }

  const trackingNumber = data.trackNumber?.trim() || null;

  await applyUpdate(admin, row, {
    mapped: mapCjOrderStatus(data.orderStatus),
    carrier:
      data.trackingProvider?.trim() || data.logisticName?.trim() || null,
    trackingNumber,
    trackingUrl: data.trackingUrl?.trim() || null,
    shipmentStatus: trackingNumber
      ? mapShipmentStatus(null, data.orderStatus)
      : null,
  });

  return { status: "processed" };
}

async function handleLogistics(
  admin: AdminClient,
  params: unknown,
): Promise<CjWebhookResult> {
  const parsed = logisticsParamsSchema.safeParse(params);

  if (!parsed.success) {
    return { status: "ignored", error: "Unrecognised LOGISTIC payload" };
  }

  const data = parsed.data;
  const row = await findSupplierOrder(
    admin,
    data.orderId,
    data.storeOrderNumbers?.[0]?.trim() || null,
  );

  if (!row) {
    return { status: "ignored", error: "Order not found" };
  }

  await applyUpdate(admin, row, {
    mapped: mapLogisticsStatus(data.trackingStatus),
    carrier:
      data.trackingProvider?.trim() || data.logisticName?.trim() || null,
    trackingNumber: data.trackingNumber.trim(),
    trackingUrl: data.trackingUrl?.trim() || null,
    shipmentStatus: mapTrackingStatusNumber(data.trackingStatus),
  });

  return { status: "processed" };
}

async function handleEvent(
  admin: AdminClient,
  type: string,
  params: unknown,
): Promise<CjWebhookResult> {
  switch (type.trim().toUpperCase()) {
    case "ORDER":
      return handleOrder(admin, params);
    case "LOGISTIC":
      return handleLogistics(admin, params);
    default:
      return { status: "ignored", error: `Unsupported CJ topic: ${type}` };
  }
}

/**
 * Verify the CJ signature against the raw body, dedupe by messageId, and apply
 * the order/logistics update. The signing secret is the CJ openId, and the
 * signature is Base64(HMAC-SHA256(openId, rawBody)) per the official docs.
 */
export async function processCjWebhook(
  admin: AdminClient,
  rawBody: string,
  headers: Headers,
): Promise<CjWebhookResult> {
  const signature = headers.get("sign")?.trim();

  if (!signature) {
    throw new HttpError(401, "Missing CJ webhook signature");
  }

  const openId = await createCjClient().getOpenId();
  const expected = await hmacBase64(openId, rawBody);

  if (!timingSafeEqual(signature, expected)) {
    throw new HttpError(401, "Invalid CJ webhook signature");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, "Invalid CJ webhook JSON");
  }

  const envelope = webhookEnvelopeSchema.safeParse(payload);

  if (!envelope.success) {
    throw new HttpError(400, "Invalid CJ webhook payload");
  }

  const message = envelope.data;
  const { data: inserted, error } = await admin
    .from("webhook_events")
    .insert({
      provider: "cj",
      event_id: message.messageId,
      event_type: `cj.${message.type.toLowerCase()}`,
      payload,
      status: "received",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { status: "duplicate" };
    }

    throw new HttpError(
      500,
      `Could not store CJ webhook event: ${error.message}`,
    );
  }

  try {
    const outcome = await handleEvent(admin, message.type, message.params);
    await markEvent(
      admin,
      inserted.id,
      outcome.status === "failed"
        ? "failed"
        : outcome.status === "ignored"
          ? "ignored"
          : "processed",
      outcome.error,
    );

    return outcome;
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "CJ webhook failed";
    await markEvent(admin, inserted.id, "failed", messageText);
    console.error(`CJ webhook ${message.messageId} failed: ${messageText}`);

    // The event is persisted as failed so it can be replayed. Acknowledge CJ
    // anyway: CJ does not retry failed pushes, and a 500 can disable the hook.
    return { status: "failed", error: messageText };
  }
}
