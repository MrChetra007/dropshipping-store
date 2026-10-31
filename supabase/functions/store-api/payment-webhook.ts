import { sendOrderConfirmationEmail } from "../_shared/email.ts";
import { triggerFulfillment, waitUntil } from "../_shared/fulfillment-trigger.ts";
import { HttpError } from "../_shared/http.ts";
import { centsToAmount } from "../_shared/money.ts";
import { getPaymentProvider } from "../_shared/payments/index.ts";
import type { VerifiedPaymentEvent } from "../_shared/payments/types.ts";
import type { createAdminClient } from "../_shared/supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export type WebhookStatus =
  | "paid"
  | "duplicate"
  | "mismatch"
  | "ignored"
  | "failed"
  | "refunded";

export type WebhookResult = {
  status: WebhookStatus;
  error?: string;
};

type EventOutcome = {
  status: WebhookStatus;
  error?: string;
};

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
      `Could not update webhook event ${eventRowId}: ${updateError.message}`,
    );
  }
}

function statusFor(outcome: EventOutcome): "processed" | "failed" | "ignored" {
  if (outcome.status === "failed") {
    return "failed";
  }

  if (outcome.status === "ignored") {
    return "ignored";
  }

  return "processed";
}

async function handlePaid(
  admin: AdminClient,
  provider: string,
  event: Extract<VerifiedPaymentEvent, { kind: "paid" }>,
): Promise<EventOutcome> {
  const { data, error } = await admin.rpc("mark_order_paid", {
    p_order_id: event.orderId,
    p_provider: provider,
    p_provider_payment_id: event.paymentId,
    p_amount: centsToAmount(event.amountCents),
    p_currency: event.currency,
    p_raw: event.raw,
  });

  if (error) {
    throw new HttpError(500, `Could not mark order paid: ${error.message}`);
  }

  const result = String(data);

  if (result === "paid") {
    const { data: supplierOrder } = await admin
      .from("supplier_orders")
      .select("id")
      .eq("order_id", event.orderId)
      .eq("supplier", "cj")
      .maybeSingle();

    // Do not block the webhook response on email or the fulfillment kick.
    waitUntil(sendOrderConfirmationEmail(admin, event.orderId));

    if (supplierOrder?.id) {
      waitUntil(triggerFulfillment(supplierOrder.id));
    }

    return { status: "paid" };
  }

  if (result === "duplicate") {
    return { status: "duplicate" };
  }

  if (result === "mismatch") {
    return {
      status: "mismatch",
      error: "Amount/currency mismatch — manual review required",
    };
  }

  if (result === "ignored") {
    return {
      status: "ignored",
      error: "Payment ignored because the order is no longer pending",
    };
  }

  throw new HttpError(500, `Unexpected mark_order_paid result: ${result}`);
}

async function handleFailed(
  admin: AdminClient,
  event: Extract<VerifiedPaymentEvent, { kind: "failed" }>,
): Promise<EventOutcome> {
  const { data: order, error } = await admin
    .from("orders")
    .select("id,status,payment_status")
    .eq("id", event.orderId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Could not load order: ${error.message}`);
  }

  if (!order) {
    return { status: "failed", error: "Order not found" };
  }

  if (order.status === "pending_payment" && order.payment_status !== "paid") {
    const { error: updateError } = await admin
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", event.orderId);

    if (updateError) {
      throw new HttpError(500, `Could not update order: ${updateError.message}`);
    }

    await admin.from("order_events").insert({
      order_id: event.orderId,
      type: "payment_failed",
      message: "Payment failed at the provider",
      is_public: false,
    });
  }

  return { status: "failed" };
}

async function handleRefunded(
  admin: AdminClient,
  event: Extract<VerifiedPaymentEvent, { kind: "refunded" }>,
): Promise<EventOutcome> {
  const { data: order, error } = await admin
    .from("orders")
    .select("id")
    .eq("id", event.orderId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, `Could not load order: ${error.message}`);
  }

  if (!order) {
    return { status: "ignored", error: "Order not found" };
  }

  await admin.from("order_events").insert({
    order_id: event.orderId,
    type: "payment_refunded",
    message: "Refund notification received — process in admin",
    is_public: false,
    data: {
      providerPaymentId: event.paymentId,
      amountCents: event.amountCents,
    },
  });

  return { status: "refunded" };
}

async function handleEvent(
  admin: AdminClient,
  provider: string,
  event: VerifiedPaymentEvent,
): Promise<EventOutcome> {
  switch (event.kind) {
    case "paid":
      return handlePaid(admin, provider, event);
    case "failed":
      return handleFailed(admin, event);
    case "refunded":
      return handleRefunded(admin, event);
    case "ignored":
      return { status: "ignored" };
  }
}

/**
 * Verify the provider signature, dedupe by (provider, event_id), and process the
 * event. The signature is checked before anything is written.
 */
export async function processPaymentWebhook(
  admin: AdminClient,
  rawBody: string,
  headers: Headers,
): Promise<WebhookResult> {
  const provider = getPaymentProvider();
  const event = await provider.verifyWebhook(rawBody, headers);

  const { data: inserted, error } = await admin
    .from("webhook_events")
    .insert({
      provider: provider.name,
      event_id: event.eventId,
      event_type: `payment.${event.kind}`,
      payload: event.raw,
      status: "received",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { status: "duplicate" };
    }

    throw new HttpError(500, `Could not store webhook event: ${error.message}`);
  }

  try {
    const outcome = await handleEvent(admin, provider.name, event);
    await markEvent(admin, inserted.id, statusFor(outcome), outcome.error);
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    await markEvent(admin, inserted.id, "failed", message);
    throw error;
  }
}
