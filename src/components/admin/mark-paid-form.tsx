import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  errorMessage,
  markOrderPaid,
} from "@/features/admin/admin-api";

export function MarkPaidForm({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const referenceValue = String(formData.get("reference") ?? "").trim();
    const reference = referenceValue
      ? referenceValue.slice(0, 120)
      : null;

    let status: Awaited<ReturnType<typeof markOrderPaid>>;

    try {
      status = await markOrderPaid({ orderId, reference });
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error) });
      setPending(false);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["admin", "order", orderId],
    });
    await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });

    const paid = status === "paid" || status === "duplicate";
    setResult({
      ok: paid,
      message:
        status === "paid"
          ? "Payment confirmed. The CJ order has been queued."
          : status === "duplicate"
            ? "This order was already confirmed. No second payment was recorded."
            : status === "mismatch"
              ? "The order total changed after the payment attempt. Review the order manually."
              : "The order is no longer awaiting payment. Review it manually.",
    });
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block max-w-md space-y-1 text-sm">
        <span className="font-medium">Payment reference (optional)</span>
        <Input
          name="reference"
          maxLength={120}
          placeholder="Bank transfer reference or memo"
        />
      </label>
      <Button
        type="submit"
        loading={pending}
        loadingLabel="Confirming payment…"
        className="h-10 px-4"
      >
        Mark as paid
      </Button>
      {result && !result.ok ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {result.message}
        </p>
      ) : null}
      {result && result.ok ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
