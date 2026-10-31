import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderSummary } from "@/components/shop/order-summary";
import { getOrderPreview } from "@/lib/orders";
import { firstParam } from "@/lib/utils";
import type { OrderPreview } from "@/types/order";

export const instant = false;

export const metadata: Metadata = {
  title: "Your order | CJ Dropshipping Store",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const orderStatusLabels: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const fulfillmentLabels: Record<string, string> = {
  unfulfilled: "Not started",
  queued: "Queued",
  submitted: "At the warehouse",
  shipped: "Shipped",
  delivered: "Delivered",
  failed: "Needs attention",
  cancelled: "Cancelled",
};

const shipmentStatusLabels: Record<string, string> = {
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  exception: "Delivery exception",
};

const eventLabels: Record<string, string> = {
  fulfillment_submitted: "Sent to warehouse",
  fulfillment_failed: "Fulfillment issue",
  fulfillment_retry_requested: "Fulfillment retry requested",
  order_processing: "Being prepared",
  order_shipped: "Shipped",
  order_delivered: "Delivered",
  order_cancelled: "Cancelled",
  payment_mismatch: "Payment review",
};

function statusTone(status: string): string {
  if (["paid", "processing", "shipped", "delivered"].includes(status)) {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  }

  if (["cancelled", "refunded", "failed"].includes(status)) {
    return "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
  }

  return "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
}

function eventLabel(type: string): string {
  return eventLabels[type] ?? type.replaceAll("_", " ");
}

export default async function OrderPage({ params, searchParams }: PageProps) {
  const { orderNumber } = await params;
  const token = firstParam((await searchParams).token);

  let order: OrderPreview | null = null;

  try {
    order = await getOrderPreview(decodeURIComponent(orderNumber), token);
  } catch {
    notFound();
  }

  if (!order) {
    notFound();
  }

  const statusLabel = orderStatusLabels[order.status] ?? order.status;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm text-zinc-500">Order</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {order.orderNumber}
          </h1>
          <p className="text-sm text-zinc-500">
            Placed {dateFormat.format(new Date(order.createdAt))} ·{" "}
            {order.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(
              order.status,
            )}`}
          >
            {statusLabel}
          </span>
          <span className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {fulfillmentLabels[order.fulfillmentStatus] ??
              order.fulfillmentStatus.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      <div className="mt-8">
        <OrderSummary order={order} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-medium">Tracking</h2>
          {order.shipments.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              {order.status === "shipped" || order.status === "delivered"
                ? "The carrier has not provided a tracking number yet. Check back soon."
                : "Tracking appears here as soon as your order ships. Delivery usually takes 7–25 days depending on the destination."}
            </p>
          ) : (
            <ul className="mt-3 space-y-4">
              {order.shipments.map((shipment) => (
                <li
                  key={shipment.trackingNumber}
                  className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {shipment.carrier ?? "Carrier"}
                      </p>
                      <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {shipment.trackingNumber}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                      {shipmentStatusLabels[shipment.status] ??
                        shipment.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  {shipment.trackingUrl ? (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-flex text-sm font-medium underline underline-offset-4"
                    >
                      Track this package
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-medium">Timeline</h2>
          {order.events.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Order updates will appear here.
            </p>
          ) : (
            <ol className="mt-3 space-y-4">
              {order.events.map((event, index) => (
                <li key={`${event.type}-${index}`} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                  <div>
                    <p className="text-sm font-medium">
                      {event.message ?? eventLabel(event.type)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {dateFormat.format(new Date(event.createdAt))}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/products"
          className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Continue shopping
        </Link>
        <Link
          href="/account"
          className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 px-5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Your account
        </Link>
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        Keep this page link private — it includes the access token for this
        order.
      </p>
    </main>
  );
}
