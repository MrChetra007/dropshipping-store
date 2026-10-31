import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderSummary } from "@/components/shop/order-summary";
import { getOrderPreview } from "@/lib/orders";
import { firstParam } from "@/lib/utils";
import type { OrderPreview } from "@/types/order";

export const instant = false;

export const metadata: Metadata = {
  title: "Thank you for your order",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const orderNumber = firstParam(params.order);
  const token = firstParam(params.token);

  if (!orderNumber || !token) {
    notFound();
  }

  let order: OrderPreview | null = null;

  try {
    order = await getOrderPreview(orderNumber, token);
  } catch {
    notFound();
  }

  if (!order) {
    notFound();
  }

  const paid = order.paymentStatus === "paid";

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
          href={`/orders/${encodeURIComponent(order.orderNumber)}?token=${encodeURIComponent(token)}`}
          className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          View order & tracking
        </Link>
        <Link
          href="/products"
          className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 px-5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
