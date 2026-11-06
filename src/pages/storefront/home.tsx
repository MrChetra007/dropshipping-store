import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ProductGrid } from "@/components/shop/product-grid";
import { ButtonLink } from "@/components/ui/button-link";
import { PageSpinner } from "@/components/ui/page-spinner";
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

  return `${minDays}-${maxDays} days`;
}

const mechanism = [
  {
    step: "01",
    title: "Targeted recovery",
    copy: "Focused devices for the places that carry the most tension through your day.",
  },
  {
    step: "02",
    title: "A consistent routine",
    copy: "Easy, wearable sessions make it practical to build recovery into your day.",
  },
  {
    step: "03",
    title: "Everyday movement",
    copy: "A few focused minutes can help you feel more prepared for the activities you enjoy.",
  },
];

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
    title: "KinetiCore Labs",
    description:
      "Non-invasive recovery tech designed to support everyday movement from your living room.",
    canonical: "/",
  });

  if (settingsQuery.isLoading || featuredQuery.isLoading) {
    return <PageSpinner label="Loading store..." />;
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
  const painPoints = categories.slice(0, 4);
  const currency = settings?.currency ?? "USD";

  return (
    <main className="flex-1">
      {/* Hero -------------------------------------------------------------- */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 sm:py-24 lg:grid-cols-[3fr_2fr] lg:items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-cyan-500"
              />
              Non-invasive recovery tech
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Reclaim pain-free movement in{" "}
              <span className="text-cyan-600 dark:text-cyan-400">
                15 minutes a day.
              </span>
            </h1>
            <p className="max-w-xl text-lg text-slate-600 dark:text-slate-400">
              Non-invasive recovery tech engineered to soothe stubborn joints,
              release deep muscular knots, and decompress chronic tension -
              from your living room. No appointments, no clunky devices.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-slate-900 px-6 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
              >
                Shop Targeted Relief -&gt;
              </Link>
              <a
                href="#pain-points"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-sm font-medium transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                Find my pain point
              </a>
            </div>
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Built for active adults and desk workers.
              </p>
              <p className="text-xs uppercase tracking-widest text-slate-400">
                60-day at-home trial | tracked delivery | direct support
              </p>
            </div>
          </div>

          <div
            aria-hidden
            className="relative hidden aspect-square overflow-hidden rounded-2xl bg-slate-900 lg:block"
          >
            <svg
              viewBox="0 0 400 400"
              className="absolute inset-0 h-full w-full"
              fill="none"
            >
              {[36, 66, 96, 126, 156].map((r) => (
                <circle
                  key={r}
                  cx="200"
                  cy="200"
                  r={r}
                  stroke="#22d3ee"
                  strokeOpacity={0.35 - r / 700}
                  strokeWidth="1.5"
                />
              ))}
              <circle
                cx="200"
                cy="200"
                r="18"
                fill="#22d3ee"
                fillOpacity="0.9"
              />
              <circle
                cx="200"
                cy="200"
                r="30"
                stroke="#22d3ee"
                strokeOpacity="0.6"
                strokeWidth="2"
              />
            </svg>
            <div className="absolute left-6 top-6 rounded-lg bg-slate-800/80 px-3 py-1.5 font-mono text-xs text-cyan-300 ring-1 ring-cyan-400/30">
              660nm + 850nm
            </div>
            <div className="absolute bottom-6 right-6 rounded-lg bg-slate-800/80 px-3 py-1.5 font-mono text-xs text-cyan-300 ring-1 ring-cyan-400/30">
              15 min / day
            </div>
            <div className="absolute bottom-6 left-6 rounded-lg bg-slate-800/80 px-3 py-1.5 font-mono text-xs text-slate-300 ring-1 ring-slate-600/50">
              60-day trial
            </div>
          </div>
        </div>
      </section>

      {/* Shop by pain point ------------------------------------------------ */}
      {painPoints.length > 0 ? (
        <section
          id="pain-points"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-16"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Shop by pain point
              </h2>
              <p className="text-sm text-slate-500">
                You don&apos;t shop device names. Tell us where it hurts and
                we&apos;ll target it.
              </p>
            </div>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {painPoints.map((category, index) => (
              <li key={category.id}>
                <Link
                  to={`/categories/${category.slug}`}
                  className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-cyan-500/60 hover:bg-cyan-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800"
                >
                  <span className="font-mono text-xs font-medium text-cyan-600 dark:text-cyan-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="space-y-3 py-6">
                    <p className="text-lg font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100">
                      {category.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Targeted relief program -&gt;
                    </p>
                  </div>
                  <span className="text-xs font-medium text-cyan-600 underline-offset-4 group-hover:underline dark:text-cyan-400">
                    Shop relief -&gt;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Why it works ------------------------------------------------------ */}
      <section className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
              Clinical mechanism
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Why it works
            </h2>
            <p className="max-w-2xl text-sm text-slate-500">
              A simple at-home routine designed to support the way you move
              and recover.
            </p>
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {mechanism.map((item) => (
              <li
                key={item.step}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="font-mono text-sm font-semibold text-cyan-600 dark:text-cyan-400">
                  {item.step}
                </span>
                <p className="mt-3 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {item.copy}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Devices ----------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Targeted relief devices
            </h2>
            <p className="text-sm text-slate-500">
              Clinical-grade engineering. No gadgets, no gimmicks.
            </p>
          </div>
          <ButtonLink to="/products" variant="secondary" size="sm">
            View all products →
          </ButtonLink>
        </div>
        <div className="mt-6">
          <ProductGrid
            products={products}
            emptyMessage="New devices are being added - check back shortly."
          />
        </div>
      </section>

      {/* Trust strip -------------------------------------------------------- */}
      <section className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="font-medium">60-day guarantee</p>
            <p className="text-sm text-slate-500">
              Walk, climb stairs or run pain-free - or get a 100% refund.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Non-invasive recovery</p>
            <p className="text-sm text-slate-500">
              Recovery technology designed for daily at-home routines.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Free tracked shipping</p>
            <p className="text-sm text-slate-500">
              {freeShippingCents !== null && delivery
                ? `Free over ${formatCents(freeShippingCents, currency)} | arrives in ${delivery} | fully tracked.`
                : "Every order is tracked from dispatch to your door."}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Real support</p>
            <p className="text-sm text-slate-500">
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
