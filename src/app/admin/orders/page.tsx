import type { Metadata } from "next";
import Link from "next/link";

import { callAdminApi } from "@/lib/supabase/functions";
import { formatCents } from "@/lib/utils";

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

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

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

export default async function AdminOrdersPage() {
  let orders: AdminOrder[] = [];
  let errorMessage: string | null = null;

  try {
    const data = await callAdminApi<OrdersResponse>("orders.list");
    orders = data.orders;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Recent orders and their CJ fulfillment status. Failed CJ orders can be
          retried from the order page.
        </p>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Could not load orders</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      ) : null}

      {!errorMessage && orders.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">
          No orders yet.
        </div>
      ) : null}

      {orders.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
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
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium hover:underline"
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
                  <td className="px-4 py-3 text-right font-medium">
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
