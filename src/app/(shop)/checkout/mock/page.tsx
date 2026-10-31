import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderSummary } from "@/components/shop/order-summary";
import { getOrderPreview } from "@/lib/orders";
import { firstParam } from "@/lib/utils";
import type { OrderPreview } from "@/types/order";

import { MockPaymentButton } from "./mock-payment-button";

export const instant = false;

export const metadata: Metadata = {
  title: "Mock checkout",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MockCheckoutPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const orderNumber = firstParam(params.order);
  const token = firstParam(params.token);
  const orderId = firstParam(params.orderId);

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

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="space-y-2">
        <p className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Development mode · mock payment provider
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Order {order.orderNumber}
        </h1>
        <p className="text-sm text-zinc-500">
          The order was created as <strong>{order.status}</strong>. No real
          payment has been taken.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium">Test the payment webhook</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          This button signs a <code>payment.paid</code> event and sends it
          through the real webhook handler, including signature verification and
          idempotency. Use it more than once to confirm a replay does not create
          a second payment.
        </p>
        {order.paymentStatus === "paid" ? (
          <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            This order is already paid. Clicking again replays the same webhook
            and should return <code>duplicate</code>.
          </p>
        ) : null}
        <div className="mt-4">
          {orderId ? (
            <MockPaymentButton
              orderNumber={order.orderNumber}
              token={token}
              orderId={orderId}
            />
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              This link is missing its order id. Start checkout again to
              simulate a payment.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <OrderSummary order={order} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
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
