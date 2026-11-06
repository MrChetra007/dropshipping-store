import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { CartItems } from "@/components/shop/cart-items";
import { ButtonLink } from "@/components/ui/button-link";
import { PageSpinner } from "@/components/ui/page-spinner";
import { getCart } from "@/features/cart/cart-api";
import { usePageMetadata } from "@/lib/metadata";
import { formatCents } from "@/lib/utils";

export function CartPage() {
  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: getCart,
  });

  usePageMetadata({
    title: "Your cart · KinetiCore Labs",
    description: "Review the items in your cart before checkout.",
    canonical: "/cart",
  });

  if (cartQuery.isLoading) {
    return <PageSpinner label="Loading your cart…" />;
  }

  if (cartQuery.error) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {cartQuery.error.message}
        </p>
      </main>
    );
  }

  const cart = cartQuery.data;

  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
          <p className="font-medium">Your cart is empty</p>
          <p className="mt-1 text-sm text-slate-500">
            Browse the store and add something you like.
          </p>
          <Link
            to="/products"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Shop products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
          <p className="text-sm text-slate-500">
            {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <ButtonLink to="/products" variant="secondary" size="sm">
          Continue shopping
        </ButtonLink>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <CartItems cart={cart} />

        <aside className="h-fit space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5 lg:sticky lg:top-24 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium tabular-nums">
                {formatCents(cart.subtotalCents, cart.currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Shipping</dt>
              <dd className="text-slate-500">Calculated at checkout</dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-800">
              <dt className="font-medium">Total</dt>
              <dd className="font-semibold tabular-nums">
                {formatCents(cart.subtotalCents, cart.currency)}
              </dd>
            </div>
          </dl>

          <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">
            Have a discount code? Apply it at checkout.
          </div>

          {cart.hasUnavailableItems ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Remove unavailable items before checking out.
            </p>
          ) : null}

          {cart.hasUnavailableItems ? (
            <span className="flex h-11 items-center justify-center rounded-lg bg-slate-200 px-5 text-sm font-medium text-slate-500 dark:bg-slate-800">
              Checkout unavailable
            </span>
          ) : (
            <Link
              to="/checkout"
              className="flex h-11 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              Checkout
            </Link>
          )}

          <p className="text-xs text-slate-500">
            Shipping and any discount are calculated on the checkout page.
          </p>
          <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs text-slate-600 dark:bg-cyan-500/5 dark:text-slate-400">
            Every order is covered by our{" "}
            <span className="font-medium">60-day money-back guarantee</span>.
          </p>
        </aside>
      </div>
    </main>
  );
}
