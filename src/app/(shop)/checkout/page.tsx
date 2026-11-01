import type { Metadata } from "next";
import { connection } from "next/server";

import { CheckoutForm } from "@/components/shop/checkout-form";
import { ButtonLink } from "@/components/ui/button-link";
import { getProfile, getUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { getShippingEstimates } from "@/lib/catalog";
import type { Cart } from "@/types/cart";

export const instant = false;

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  await connection();

  const [cart, rates, user, profile] = await Promise.all([
    getCart(),
    getShippingEstimates(),
    getUser(),
    getProfile(),
  ]);

  if (!cart || cart.items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="font-medium">Your cart is empty</p>
          <p className="mt-1 text-sm text-zinc-500">
            Add a product before checking out.
          </p>
          <ButtonLink
            href="/products"
            variant="primary"
            className="mt-5"
          >
            Shop products
          </ButtonLink>
        </div>
      </main>
    );
  }

  if (cart.hasUnavailableItems) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">Some items are unavailable</p>
          <p className="mt-1">
            Remove unavailable items from your cart before checking out.
          </p>
          <ButtonLink
            href="/cart"
            variant="primary"
            className="mt-4"
          >
            Review cart
          </ButtonLink>
        </div>
      </main>
    );
  }

  const defaults = {
    email: user?.email ?? "",
    name: profile?.full_name ?? "",
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
          <p className="text-sm text-zinc-500">
            Shipping and totals are confirmed on the server before payment.
          </p>
        </div>
        <ButtonLink
          href="/cart"
          variant="ghost"
          size="sm"
        >
          Back to cart
        </ButtonLink>
      </div>

      <div className="mt-8">
        <CheckoutForm
          cart={cart as Cart}
          rates={rates.map((rate) => ({
            name: rate.name,
            countryCode: rate.countryCode,
            amountCents: rate.amountCents,
            freeOverCents: rate.freeOverCents,
            minDays: rate.minDays,
            maxDays: rate.maxDays,
          }))}
          defaults={defaults}
        />
      </div>
    </main>
  );
}
