import type { Metadata } from "next";
import Link from "next/link";

import { CartItems } from "@/components/shop/cart-items";
import { getCart } from "@/lib/cart";
import { formatCents } from "@/lib/utils";
import type { Cart } from "@/types/cart";

export const instant = false;

export const metadata: Metadata = {
  title: "Your cart",
};

export default async function CartPage() {
  let cart: Cart | null = null;
  let errorMessage: string | null = null;

  try {
    cart = await getCart();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Could not load your cart";
  }

  if (errorMessage) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="font-medium">Your cart is empty</p>
          <p className="mt-1 text-sm text-zinc-500">
            Browse the store and add something you like.
          </p>
          <Link
            href="/products"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
          <p className="text-sm text-zinc-500">
            {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/products"
          className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Continue shopping
        </Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <CartItems cart={cart} />

        <aside className="h-fit space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 lg:sticky lg:top-24 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">Subtotal</dt>
              <dd className="font-medium tabular-nums">
                {formatCents(cart.subtotalCents, cart.currency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">Shipping</dt>
              <dd className="text-zinc-500">Calculated at checkout</dd>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <dt className="font-medium">Total</dt>
              <dd className="font-semibold tabular-nums">
                {formatCents(cart.subtotalCents, cart.currency)}
              </dd>
            </div>
          </dl>

          <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700">
            Have a discount code? Apply it at checkout.
          </div>

          {cart.hasUnavailableItems ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Remove unavailable items before checking out.
            </p>
          ) : null}

          {cart.hasUnavailableItems ? (
            <span className="flex h-11 items-center justify-center rounded-lg bg-zinc-200 px-5 text-sm font-medium text-zinc-500 dark:bg-zinc-800">
              Checkout unavailable
            </span>
          ) : (
            <Link
              href="/checkout"
              className="flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Checkout
            </Link>
          )}

          <p className="text-xs text-zinc-500">
            Shipping and any discount are calculated on the checkout page.
          </p>
        </aside>
      </div>
    </main>
  );
}
