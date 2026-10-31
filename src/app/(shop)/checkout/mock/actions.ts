"use server";

import { redirect } from "next/navigation";

import { callEdgeFunction } from "@/lib/supabase/functions";

export type MockPaymentState = { error: string } | null;

function formValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Development-only: asks the `store-api` edge function to sign and process a
 * mock `payment.paid` event. The webhook secret never leaves Supabase.
 */
export async function simulatePayment(
  _previousState: MockPaymentState,
  formData: FormData,
): Promise<MockPaymentState> {
  if (process.env.NODE_ENV === "production") {
    return { error: "Mock payments are disabled in production." };
  }

  const token = formValue(formData, "token");
  const orderId = formValue(formData, "orderId");

  if (!token || !orderId) {
    return { error: "This checkout link is incomplete. Start checkout again." };
  }

  let orderNumber: string;

  try {
    const result = await callEdgeFunction<{
      status: string;
      orderNumber: string;
    }>("store-api", {
      method: "POST",
      query: { action: "payment.mockPay" },
      body: { orderId, accessToken: token },
    });

    orderNumber = result.orderNumber;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not simulate payment.",
    };
  }

  const successPath = `/checkout/success?order=${encodeURIComponent(
    orderNumber,
  )}&token=${encodeURIComponent(token)}`;

  redirect(successPath);
}
