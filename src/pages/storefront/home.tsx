import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ProductGrid } from "@/components/shop/product-grid";
import { ButtonLink } from "@/components/ui/button-link";
import { PageSpinner } from "@/components/ui/page-spinner";
import { SmartImage } from "@/components/ui/smart-image";
import {
  getShippingEstimates,
  getStoreSettings,
  listCategories,
  listProductCards,
  type ShippingEstimate,
} from "@/lib/catalog";
import { usePageMetadata } from "@/lib/metadata";
import { formatCents } from "@/lib/utils";

function deliveryWindow(rates: ShippingEstimate[]): string | null {
  if (rates.length === 0) {
    return null;
  }

  const minDays = Math.min(
    ...rates.map((rate) => rate.minDays ?? Number.POSITIVE_INFINITY),
  );
  const maxDays = Math.max(
    ...rates.map((rate) => rate.maxDays ?? Number.NEGATIVE_INFINITY),
  );

  if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) {
    return null;
  }

  return `${minDays}–${maxDays} days`;
}

export function HomePage() {
  const settingsQuery = useQuery({
    queryKey: ["settings", "store"],
    queryFn: getStoreSettings,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });
  const featuredQuery = useQuery({
    queryKey: ["catalog", "featured"],
    queryFn: () => listProductCards({ featuredOnly: true, perPage: 8 }),
  });
  const shippingQuery = useQuery({
    queryKey: ["shipping-estimates"],
    queryFn: getShippingEstimates,
  });
  const fallbackQuery = useQuery({
    queryKey: ["catalog", "new"],
    queryFn: () => listProductCards({ perPage: 8 }),
    enabled:
      featuredQuery.isSuccess && featuredQuery.data.products.length === 0,
  });

  const settings = settingsQuery.data;
  const categories = categoriesQuery.data ?? [];
  const featured = featuredQuery.data?.products ?? [];
  const products =
    featured.length > 0 ? featured : (fallbackQuery.data?.products ?? []);
  const shippingRates = shippingQuery.data ?? [];

  usePageMetadata({
    title: settings?.name ?? "CJ Dropshipping Store",
    description: "Storefront powered by CJ Dropshipping.",
    canonical: "/",
  });

  if (settingsQuery.isLoading || featuredQuery.isLoading) {
    return <PageSpinner label="Loading store…" />;
  }

  const freeShippingCents = shippingRates.reduce<number | null>(
    (lowest, rate) => {
      if (rate.freeOverCents === null) {
        return lowest;
      }

      return lowest === null
        ? rate.freeOverCents
        : Math.min(lowest, rate.freeOverCents);
    },
    null,
  );

  const delivery = deliveryWindow(shippingRates);
  const categoryTiles = categories.slice(0, 8);

  return (
    <main className="flex-1">
      <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:py-24 lg:grid-cols-[3fr_2fr] lg:items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Ships to the US, UK &amp; more
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              {settings?.name ?? "CJ Store"}
            </h1>
            <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
              Carefully selected products at fair prices, delivered to your
              door. Every order is tracked from dispatch to delivery.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Shop all products
              </Link>
              {categoryTiles[0] ? (
                <Link
                  to={`/categories/${categoryTiles[0].slug}`}
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-300 bg-white px-6 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Browse {categoryTiles[0].name}
                </Link>
              ) : null}
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
              {delivery ? <li>Estimated delivery {delivery}</li> : null}
              {freeShippingCents !== null ? (
                <li>
                  Free shipping over{" "}
                  {formatCents(freeShippingCents, settings?.currency ?? "USD")}
                </li>
              ) : null}
              <li>Tracked orders</li>
            </ul>
          </div>

          <div className="relative hidden aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:block dark:border-zinc-800 dark:bg-zinc-900">
            {products[0]?.imageUrl ? (
              <SmartImage
                src={products[0].imageUrl}
                alt={products[0].imageAlt ?? products[0].title}
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800">
                <span className="text-sm text-zinc-500">
                  Add products in the admin to fill your storefront
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {categoryTiles.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                Shop by category
              </h2>
              <p className="text-sm text-zinc-500">
                Find what you need without the scroll.
              </p>
            </div>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categoryTiles.map((category) => (
              <li key={category.id}>
                <Link
                  to={`/categories/${category.slug}`}
                  className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  {category.imageUrl ? (
                    <SmartImage
                      src={category.imageUrl}
                      alt=""
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover opacity-80 transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : null}
                  <span className="relative rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-zinc-900 backdrop-blur dark:bg-zinc-950/80 dark:text-zinc-100">
                    {category.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {featured.length > 0 ? "Featured products" : "New arrivals"}
            </h2>
            <p className="text-sm text-zinc-500">
              Hand-picked products our customers love.
            </p>
          </div>
          <ButtonLink to="/products" variant="secondary" size="sm">
            View all products →
          </ButtonLink>
        </div>
        <div className="mt-6">
          <ProductGrid
            products={products}
            emptyMessage="No products published yet. Check back soon."
          />
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-12 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="font-medium">Tracked delivery</p>
            <p className="text-sm text-zinc-500">
              {delivery
                ? `Orders typically arrive in ${delivery}.`
                : "Tracking is added as soon as your parcel ships."}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Secure checkout</p>
            <p className="text-sm text-zinc-500">
              Your payment details are handled by our payment provider.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Real support</p>
            <p className="text-sm text-zinc-500">
              {settings?.support_email ? (
                <>
                  Questions? Email{" "}
                  <a
                    href={`mailto:${settings.support_email}`}
                    className="underline underline-offset-2"
                  >
                    {settings.support_email}
                  </a>
                </>
              ) : (
                "Reach out any time and we will help."
              )}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
