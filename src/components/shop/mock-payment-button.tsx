
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { callEdgeFunction } from "@/lib/functions";
import { Spinner } from "@/components/ui/spinner";

export function MockPaymentButton({
  orderNumber,
  token,
  orderId,
}: {
  orderNumber: string;
  token: string;
  orderId: string;
}) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      await callEdgeFunction<{ status: string; orderNumber: string }>(
        "store-api",
        {
          method: "POST",
          query: { action: "payment.mockPay" },
          body: { orderId, accessToken: token },
        },
      );

      navigate({
        pathname: "/checkout/success",
        search: `?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(token)}`,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not simulate payment.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Spinner /> : null}
        {pending ? "Sending test webhookâ€¦" : "Simulate successful payment"}
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
