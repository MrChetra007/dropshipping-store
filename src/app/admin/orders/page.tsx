import type { Metadata } from "next";
import Link from "next/link";

import { callAdminApi } from "@/lib/supabase/functions";
import { cn, formatCents } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = {
  title: "Orders | Admin | CJ Dropshipping Store",
};

type AdminOrder = {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  totalCents: number;
  createdAt: string;
  supplierStatus: string | null;
  supplierError: string | null;
  supplierAttempts: number;
};

type OrdersResponse = {
  orders: AdminOrder[];
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function Badge({ value, tone }: { value: string; tone: "neutral" | "good" | "bad" }) {
  const styles = {
    neutral:
      "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
    good:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    bad: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles[tone]}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function toneFor(value: string): "neutral" | "good" | "bad" {
  if (["paid", "submitted", "confirmed", "shipped", "delivered"].includes(value)) {
    return "good";
  }

  if (["failed", "cancelled", "refunded"].includes(value)) {
    return "bad";
  }

  return "neutral";
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const failedOnly = firstParam(params.filter) === "failed";
  let orders: AdminOrder[] = [];
  let errorMessage: string | null = null;

  try {
    const data = await callAdminApi<OrdersResponse>("orders.list");
    orders = data.orders;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  const filtered = failedOnly
    ? orders.filter(
        (order) =>
          order.supplierStatus === "failed" ||
          order.fulfillmentStatus === "failed",
      )
    : orders;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Recent orders and their CJ fulfillment status. Failed CJ orders can be
          retried from the order page.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: "All orders", value: "" },
          { label: "Failed CJ", value: "failed" },
        ].map((filter) => {
          const active = (filter.value === "failed") === failedOnly;

          return (
            <Link
              key={filter.label}
              href={
                filter.value
                  ? `/admin/orders?filter=${filter.value}`
                  : "/admin/orders"
              }
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                active
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
        <span className="ml-auto text-xs text-zinc-500">
          {filtered.length} order{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Could not load orders</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      ) : null}

      {!errorMessage && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
          {failedOnly ? "No failed CJ orders." : "No orders yet."}
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Placed</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Fulfillment</th>
                <th className="px-4 py-3 font-medium">CJ</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono text-[13px] font-medium hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-zinc-500">{order.email}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {dateFormat.format(new Date(order.createdAt))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge value={order.paymentStatus} tone={toneFor(order.paymentStatus)} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      value={order.fulfillmentStatus}
                      tone={toneFor(order.fulfillmentStatus)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {order.supplierStatus ? (
                      <div className="space-y-1">
                        <Badge
                          value={order.supplierStatus}
                          tone={toneFor(order.supplierStatus)}
                        />
                        {order.supplierError ? (
                          <p className="max-w-[260px] truncate text-xs text-red-600 dark:text-red-400">
                            {order.supplierError}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatCents(order.totalCents, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
