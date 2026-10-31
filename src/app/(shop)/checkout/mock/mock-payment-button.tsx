"use client";

import { useActionState } from "react";

import { simulatePayment, type MockPaymentState } from "./actions";

export function MockPaymentButton({
  orderNumber,
  token,
  orderId,
}: {
  orderNumber: string;
  token: string;
  orderId: string;
}) {
  const [state, formAction, pending] = useActionState<
    MockPaymentState,
    FormData
  >(simulatePayment, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="order" value={orderNumber} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending test webhook…" : "Simulate successful payment"}
      </button>
      {state?.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
