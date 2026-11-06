import { SmartImage } from "@/components/ui/smart-image";
import { formatCents } from "@/lib/utils";
import type { OrderPreview } from "@/types/order";

export function OrderSummary({
  order,
  showAddress = true,
}: {
  order: OrderPreview;
  showAddress?: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {order.items.map((item, index) => (
          <li key={`${item.title}-${index}`} className="flex gap-4 p-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900">
              {item.imageUrl ? (
                <SmartImage
                  src={item.imageUrl}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.variantTitle && item.variantTitle !== "Default" ? (
                <p className="text-xs text-slate-500">{item.variantTitle}</p>
              ) : null}
              <p className="text-xs text-slate-500">Qty {item.quantity}</p>
            </div>
            <p className="text-sm font-medium tabular-nums">
              {formatCents(item.lineTotalCents, order.currency)}
            </p>
          </li>
        ))}
      </ul>

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums">
                {formatCents(order.subtotalCents, order.currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Shipping</dt>
              <dd className="tabular-nums">
                {formatCents(order.shippingCents, order.currency)}
              </dd>
            </div>
            {order.discountCents > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Discount</dt>
                <dd className="tabular-nums">
                  −{formatCents(order.discountCents, order.currency)}
                </dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-semibold dark:border-slate-800">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {formatCents(order.totalCents, order.currency)}
              </dd>
            </div>
          </dl>
          {order.shippingRateName ? (
            <p className="mt-3 text-xs text-slate-500">
              Shipping method: {order.shippingRateName}
            </p>
          ) : null}
        </div>

        {showAddress ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-medium">Shipping address</h2>
            <address className="mt-2 space-y-0.5 not-italic text-slate-600 dark:text-slate-400">
              <p>{order.shippingAddress.name}</p>
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 ? (
                <p>{order.shippingAddress.line2}</p>
              ) : null}
              <p>
                {order.shippingAddress.city}
                {order.shippingAddress.state
                  ? `, ${order.shippingAddress.state}`
                  : ""}{" "}
                {order.shippingAddress.postalCode}
              </p>
              <p>{order.shippingAddress.countryCode}</p>
            </address>
          </div>
        ) : null}
      </div>
    </div>
  );
}
