import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { OrderSummary } from "@/components/shop/order-summary";
import { PageSpinner } from "@/components/ui/page-spinner";
import { getPaymentInstructions, getStoreSettings } from "@/lib/catalog";
import { usePageMetadata } from "@/lib/metadata";
import { getOrderPreview } from "@/lib/orders";
import { formatCents, firstParam } from "@/lib/utils";
import { NotFoundPage } from "@/pages/not-found";

function InstructionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 py-2 text-sm last:border-0 dark:border-zinc-800">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

export function CheckoutManualPage() {
  const [searchParams] = useSearchParams();
  const orderParam = searchParams.get("order") ?? undefined;
  const tokenParam = searchParams.get("token") ?? undefined;
  const orderNumber = firstParam(orderParam);
  const token = firstParam(tokenParam);

  const orderQuery = useQuery({
    queryKey: ["order", orderNumber, token],
    queryFn: () => getOrderPreview(orderNumber ?? "", token ?? ""),
    enabled: Boolean(orderNumber && token),
  });
  const instructionsQuery = useQuery({
    queryKey: ["settings", "payment-instructions"],
    queryFn: getPaymentInstructions,
  });
  const storeQuery = useQuery({
    queryKey: ["settings", "store"],
    queryFn: getStoreSettings,
  });

  const order = orderQuery.data;
  const instructions = instructionsQuery.data ?? null;
  const store = storeQuery.data ?? null;
  const paid = order?.paymentStatus === "paid";
  const hasBankDetails = Boolean(instructions?.accountNumber);

  usePageMetadata({
    title: "Payment instructions",
    description:
      "Complete your manual bank transfer to secure your dropshipping order.",
    canonical: orderNumber ? `/checkout/manual?order=${encodeURIComponent(orderNumber)}` : "/checkout/manual",
  });

  if (!orderNumber || !token) {
    return <NotFoundPage />;
  }

  if (orderQuery.isLoading) {
    return <PageSpinner label="Loading payment details…" />;
  }

  if (orderQuery.error || !order) {
    return <NotFoundPage />;
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="space-y-2">
        <p className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Manual payment · bank transfer
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Order {order.orderNumber}
        </h1>
        <p className="text-sm text-zinc-500">
          {paid
            ? "Payment has been confirmed. Your order is being prepared."
            : `Transfer the amount due below and use ${order.orderNumber} as the payment reference.`}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Amount due</h2>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCents(order.totalCents, order.currency)}
          </p>
        </div>

        {paid ? (
          <p
            role="status"
            className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          >
            Payment confirmed. You will receive tracking details by email when
            the order ships.
          </p>
        ) : hasBankDetails ? (
          <div className="mt-4">
            {instructions?.bankName ? (
              <InstructionRow label="Bank" value={instructions.bankName} />
            ) : null}
            {instructions?.accountName ? (
              <InstructionRow
                label="Account name"
                value={instructions.accountName}
              />
            ) : null}
            <InstructionRow
              label="Account number"
              value={instructions?.accountNumber ?? ""}
            />
            {instructions?.swift ? (
              <InstructionRow label="SWIFT / BIC" value={instructions.swift} />
            ) : null}
            <InstructionRow label="Reference" value={order.orderNumber} />

            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              {instructions?.instructions ??
                "After transferring the full amount, keep this page. We confirm payments within one business day and email you when the order is queued."}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-medium">Payment details are not configured yet.</p>
            <p className="mt-1">
              Contact{" "}
              {store?.support_email ? (
                <a
                  href={`mailto:${store.support_email}`}
                  className="underline underline-offset-4"
                >
                  {store.support_email}
                </a>
              ) : (
                "our support team"
              )}{" "}
              to complete the transfer for order {order.orderNumber}.
            </p>
          </div>
        )}

        <p className="mt-4 text-xs text-zinc-500">
          Keep this page link private — it contains the access token for this
          order.
        </p>
      </div>

      <div className="mt-8">
        <OrderSummary order={order} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={{
            pathname: `/orders/${encodeURIComponent(order.orderNumber)}`,
            search: `?token=${encodeURIComponent(token)}`,
          }}
          className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          View order
        </Link>
        <Link
          to="/products"
          className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 px-5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900 dark:text-zinc-100"
        >
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
