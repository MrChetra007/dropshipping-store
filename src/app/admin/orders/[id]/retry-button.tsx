"use client";

import { useActionState } from "react";

import { retryCjOrder, type RetryFulfillmentState } from "./actions";

export function RetryCjOrderButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState<
    RetryFulfillmentState,
    FormData
  >(retryCjOrder, null);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Queueing retry…" : "Retry CJ order"}
      </button>
      {state?.ok === false ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}
      {state?.ok === true ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
