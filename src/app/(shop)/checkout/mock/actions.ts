"use server";

import { redirect } from "next/navigation";

import { getOrderPreview } from "@/lib/orders";
import { signMockWebhook } from "@/lib/payments/providers/mock";
import { callEdgeFunctionRaw } from "@/lib/supabase/functions";
import type { OrderPreview } from "@/types/order";

export type MockPaymentState = { error: string } | null;

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Development-only: signs a mock `payment.paid` webhook with the same secret the
 * edge function uses and sends it through the real webhook path.
 */
export async function simulatePayment(
  _previousState: MockPaymentState,
  formData: FormData,
): Promise<MockPaymentState> {
  if (process.env.NODE_ENV === "production") {
    return { error: "Mock payments are disabled in production." };
  }

  const orderNumber = formValue(formData, "order");
  const token = formValue(formData, "token");
  const orderId = formValue(formData, "orderId");

  if (!orderNumber || !token || !orderId) {
    return { error: "This checkout link is incomplete. Start checkout again." };
  }

  let order: OrderPreview | null;

  try {
    order = await getOrderPreview(orderNumber, token);
  } catch {
    return { error: "Could not load this order." };
  }

  if (!order) {
    return { error: "Order not found." };
  }

  const successPath = `/checkout/success?order=${encodeURIComponent(
    orderNumber,
  )}&token=${encodeURIComponent(token)}`;

  const rawBody = JSON.stringify({
    eventId: `mock_paid_${orderId}`,
    type: "payment.paid",
    orderId,
    paymentId: `mock_pay_${orderId}`,
    amountCents: order.totalCents,
    currency: order.currency,
  });

  let signature: string;

  try {
    signature = signMockWebhook(rawBody);
  } catch {
    return {
      error:
        "PAYMENT_WEBHOOK_SECRET is not set. Add it to .env.local and to the edge function secrets.",
    };
  }

  try {
    await callEdgeFunctionRaw("store-api", {
      query: { action: "payment.webhook" },
      body: rawBody,
      headers: { "x-mock-signature": signature },
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not simulate payment.",
    };
  }

  redirect(successPath);
}
