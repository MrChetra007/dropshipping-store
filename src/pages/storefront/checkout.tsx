import { useQuery } from "@tanstack/react-query";

import { CheckoutForm, type CheckoutShippingRate } from "@/components/shop/checkout-form";
import { ButtonLink } from "@/components/ui/button-link";
import { PageSpinner } from "@/components/ui/page-spinner";
import { getCart } from "@/features/cart/cart-api";
import { useAuth } from "@/features/auth/auth-context";
import { getShippingEstimates } from "@/lib/catalog";
import { usePageMetadata } from "@/lib/metadata";

export function CheckoutPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: getCart,
  });
  const shippingQuery = useQuery({
    queryKey: ["shipping-estimates"],
    queryFn: getShippingEstimates,
  });

  const cart = cartQuery.data;
  const shippingRates = shippingQuery.data ?? [];
  const rates: CheckoutShippingRate[] = shippingRates.map((rate) => ({
    name: rate.name,
    countryCode: rate.countryCode,
    amountCents: rate.amountCents,
    freeOverCents: rate.freeOverCents,
    minDays: rate.minDays,
    maxDays: rate.maxDays,
  }));

  usePageMetadata({
    title: "Checkout",
    description:
      "Review your shipping details and totals before completing your order.",
    canonical: "/checkout",
  });

  if (authLoading || cartQuery.isLoading || shippingQuery.isLoading) {
    return <PageSpinner label="Loading checkout…" />;
  }

  if (cartQuery.error) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {cartQuery.error.message}
        </p>
      </main>
    );
  }

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
            to="/products"
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
          <ButtonLink to="/cart" variant="primary" className="mt-4">
            Review cart
          </ButtonLink>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
          <p className="text-sm text-zinc-500">
            Shipping and totals are confirmed on the server before payment.
          </p>
        </div>
        <ButtonLink to="/cart" variant="ghost" size="sm">
          Back to cart
        </ButtonLink>
      </div>

      <div className="mt-8">
        <CheckoutForm
          cart={cart}
          rates={rates}
          defaults={{
            email: user?.email ?? "",
            name: profile?.full_name ?? "",
          }}
        />
      </div>
    </main>
  );
}
