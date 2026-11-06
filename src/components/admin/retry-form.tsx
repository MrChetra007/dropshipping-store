import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { errorMessage, retryCjOrder } from "@/features/admin/admin-api";

export function RetryCjForm({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  async function handleClick() {
    setResult(null);
    setPending(true);

    try {
      await retryCjOrder(orderId);
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error) });
      setPending(false);
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["admin", "order", orderId],
    });
    await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });

    setResult({
      ok: true,
      message: "Retry queued. Refresh in a moment to see the CJ result.",
    });
    setPending(false);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={() => {
          void handleClick();
        }}
        loading={pending}
        loadingLabel="Queueing retry…"
        className="h-10 px-4"
      >
        Retry CJ order
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
    </div>
  );
}
