import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { OrderSummary } from "@/components/shop/order-summary";
import { PageSpinner } from "@/components/ui/page-spinner";
import { usePageMetadata } from "@/lib/metadata";
import { getOrderPreview } from "@/lib/orders";
import { firstParam } from "@/lib/utils";
import { NotFoundPage } from "@/pages/not-found";

export function CheckoutSuccessPage() {
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

  const order = orderQuery.data;
  const paid = order?.paymentStatus === "paid";

  usePageMetadata({
    title: paid ? "Payment confirmed" : "Thank you for your order",
    description: paid
      ? "Your payment was confirmed. We will email tracking details as soon as your order ships."
      : "We are confirming your payment. You will receive an email once it is confirmed.",
    canonical: orderNumber ? `/checkout/success?order=${encodeURIComponent(orderNumber)}` : "/checkout/success",
  });

  if (!orderNumber || !token) {
    return <NotFoundPage />;
  }

  if (orderQuery.isLoading) {
    return <PageSpinner label="Loading your order…" />;
  }

  if (orderQuery.error || !order) {
    return <NotFoundPage />;
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="space-y-2">
        <p className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Order {order.orderNumber}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {paid ? "Payment confirmed" : "Thank you for your order"}
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          {paid
            ? `We received your payment and sent a confirmation to ${order.email}. We will email tracking details as soon as your order ships.`
            : `We are confirming your payment. You will receive an email at ${order.email} once it is confirmed.`}
        </p>
      </div>

      <div className="mt-8">
        <OrderSummary order={order} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={{
            pathname: `/orders/${encodeURIComponent(order.orderNumber)}`,
            search: `?token=${encodeURIComponent(token ?? "")}`,
          }}
          className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          View order & tracking
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
