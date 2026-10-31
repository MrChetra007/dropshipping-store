"use server";

import { revalidatePath } from "next/cache";

import { callAdminApi } from "@/lib/supabase/functions";

export type RetryFulfillmentState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | null;

export async function retryCjOrder(
  _previousState: RetryFulfillmentState,
  formData: FormData,
): Promise<RetryFulfillmentState> {
  const orderId = formData.get("orderId");

  if (typeof orderId !== "string" || !orderId) {
    return { ok: false, error: "Missing order id." };
  }

  try {
    await callAdminApi("orders.retryFulfillment", {
      method: "POST",
      body: { orderId },
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not retry the CJ order.",
    };
  }

  revalidatePath(`/admin/orders/${orderId}`);

  return {
    ok: true,
    message: "Retry queued. Refresh in a moment to see the CJ result.",
  };
}
