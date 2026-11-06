import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Badge, toneFor } from "@/components/admin/badge";
import { MarkPaidForm } from "@/components/admin/mark-paid-form";
import { RetryCjForm } from "@/components/admin/retry-form";
import { NotFoundPage } from "@/pages/not-found";
import { getAdminOrder } from "@/features/admin/admin-api";
import { EdgeFunctionError } from "@/lib/functions";
import { usePageMetadata } from "@/lib/metadata";
import { formatCents } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>
        {value}
      </span>
    </div>
  );
}

export function AdminOrderDetailPage() {
  const { id = "" } = useParams();
  const orderQuery = useQuery({
    queryKey: ["admin", "order", id],
    queryFn: () => getAdminOrder(id),
  });

  usePageMetadata({
    title: "Order | Admin | KinetiCore Labs",
  });

  if (orderQuery.isLoading) {
    return (
      <div className="h-[400px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
    );
  }

  if (orderQuery.error) {
    if (
      orderQuery.error instanceof EdgeFunctionError &&
      orderQuery.error.status === 404
    ) {
      return <NotFoundPage />;
    }

    return (
      <div className="space-y-4">
        <Link
          to="/admin/orders"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to orders
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Could not load the order</p>
          <p className="mt-1">
            {orderQuery.error instanceof Error
              ? orderQuery.error.message
              : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  if (!orderQuery.data) {
    return <NotFoundPage />;
  }

  const order = orderQuery.data.order;
  const supplier = order.supplierOrder;
  const balanceProblem = supplier?.error?.startsWith("cj_insufficient_balance");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          to="/admin/orders"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to orders
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {order.orderNumber}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {order.email} · placed {dateFormat.format(new Date(order.createdAt))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge value={order.status} tone={toneFor(order.status)} />
            <Badge
              value={order.paymentStatus}
              tone={toneFor(order.paymentStatus)}
            />
            <Badge
              value={order.fulfillmentStatus}
              tone={toneFor(order.fulfillmentStatus)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-medium">Shipping</h2>
          <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {order.shipName}
            </p>
            <p>{order.shipLine1}</p>
            {order.shipLine2 ? <p>{order.shipLine2}</p> : null}
            <p>
              {order.shipCity}
              {order.shipState ? `, ${order.shipState}` : ""}{" "}
              {order.shipPostalCode}
            </p>
            <p>{order.shipCountryCode}</p>
            {order.shipPhone ? <p>{order.shipPhone}</p> : null}
          </div>
          {order.customerNote ? (
            <div className="mt-4 rounded-md bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                Customer note
              </p>
              <p className="mt-1 whitespace-pre-line">{order.customerNote}</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="font-medium">Totals</h2>
          <div className="mt-3 space-y-1 text-sm">
            <Line
              label="Subtotal"
              value={formatCents(order.subtotalCents, order.currency)}
            />
            <Line
              label="Shipping"
              value={formatCents(order.shippingCents, order.currency)}
            />
            {order.discountCents > 0 ? (
              <Line
                label="Discount"
                value={`−${formatCents(order.discountCents, order.currency)}`}
              />
            ) : null}
            <Line
              label="Tax"
              value={formatCents(order.taxCents, order.currency)}
            />
            <div className="border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <Line
                label="Total"
                value={formatCents(order.totalCents, order.currency)}
                strong
              />
            </div>
          </div>
        </section>
      </div>

      {order.status === "pending_payment" && order.paymentStatus !== "paid" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <h2 className="font-medium">Manual payment</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Confirm only after the bank transfer has arrived. This records the
            payment, emails the customer, and queues the CJ order
            automatically.
          </p>
          <div className="mt-4">
            <MarkPaidForm orderId={order.id} />
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">CJ fulfillment</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              The CJ order is created automatically after payment. Failed
              orders can be retried here.
            </p>
          </div>
          {supplier ? (
            <Badge value={supplier.status} tone={toneFor(supplier.status)} />
          ) : (
            <Badge value="not queued" tone="neutral" />
          )}
        </div>

        {supplier ? (
          <div className="mt-4 space-y-3 text-sm">
            {balanceProblem ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                CJ balance is insufficient. Top up the CJ account, then retry
                this order.
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 text-zinc-600 dark:text-zinc-400">
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    CJ order id:
                  </span>{" "}
                  {supplier.supplierOrderId ? (
                    <span className="font-mono">{supplier.supplierOrderId}</span>
                  ) : (
                    "—"
                  )}
                </p>
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Shipping method:
                  </span>{" "}
                  {supplier.shippingMethod ?? "—"}
                </p>
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Attempts:
                  </span>{" "}
                  {supplier.attempts}
                </p>
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Supplier cost:
                  </span>{" "}
                  {supplier.supplierCostCents === null
                    ? "—"
                    : formatCents(supplier.supplierCostCents, order.currency)}
                </p>
              </div>
              <div className="space-y-1 text-zinc-600 dark:text-zinc-400">
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Next attempt:
                  </span>{" "}
                  {dateFormat.format(new Date(supplier.nextAttemptAt))}
                </p>
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Updated:
                  </span>{" "}
                  {dateFormat.format(new Date(supplier.updatedAt))}
                </p>
              </div>
            </div>

            {supplier.error ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {supplier.error}
              </p>
            ) : null}

            {supplier.status === "failed" ? (
              <RetryCjForm orderId={order.id} />
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            No CJ order row exists yet. It is created when payment is
            confirmed.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <h2 className="border-b border-zinc-200 px-5 py-3 font-medium dark:border-zinc-800">
          Items
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-2 font-medium">Item</th>
                <th className="px-5 py-2 font-medium">SKU</th>
                <th className="px-5 py-2 text-right font-medium">Qty</th>
                <th className="px-5 py-2 text-right font-medium">Unit</th>
                <th className="px-5 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{item.title}</p>
                    {item.variantTitle && item.variantTitle !== "Default" ? (
                      <p className="text-xs text-zinc-500">
                        {item.variantTitle}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {item.sku ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right">{item.quantity}</td>
                  <td className="px-5 py-3 text-right">
                    {formatCents(item.unitPriceCents, order.currency)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    {formatCents(item.lineTotalCents, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <h2 className="border-b border-zinc-200 px-5 py-3 font-medium dark:border-zinc-800">
          Timeline
        </h2>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {order.events.length === 0 ? (
            <li className="px-5 py-3 text-sm text-zinc-500">No events yet.</li>
          ) : (
            order.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{event.type.replaceAll("_", " ")}</p>
                  {event.message ? (
                    <p className="text-zinc-600 dark:text-zinc-400">
                      {event.message}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <p>{dateFormat.format(new Date(event.createdAt))}</p>
                  <p>{event.isPublic ? "Public" : "Internal"}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
