import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductGrid } from "@/components/shop/product-grid";
import { VariantPicker } from "@/components/shop/variant-picker";
import { getProductDetail, getStoreSettings } from "@/lib/catalog";
import { sanitizeDescription } from "@/lib/sanitize";
import { absoluteUrl } from "@/lib/site";
import { formatCents, stripHtml, truncate } from "@/lib/utils";

export const instant = false;

type PageProps = {
  params: Promise<{ slug: string }>;
};

const countryNames: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  "*": "Other countries",
};

function shippingLabel(
  minDays: number | null,
  maxDays: number | null,
): string {
  if (minDays === null || maxDays === null) {
    return "Delivery time confirmed after dispatch";
  }

  return `${minDays}–${maxDays} business days`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getProductDetail(slug);

  if (!detail) {
    return { title: "Product not found" };
  }

  const { product, images } = detail;
  const description =
    product.seoDescription ||
    truncate(stripHtml(product.description), 160) ||
    `Shop ${product.title} with tracked delivery.`;
  const title = product.seoTitle || product.title;
  const image = images[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: absoluteUrl(`/products/${slug}`),
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const [detail, settings] = await Promise.all([
    getProductDetail(slug),
    getStoreSettings(),
  ]);

  if (!detail) {
    notFound();
  }

  const { product, variants, images, shippingRates, related } = detail;
  const currency = variants[0]?.currency ?? settings.currency;
  const plainDescription = stripHtml(product.description);
  const shippingEstimates = shippingRates.slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description:
      plainDescription || `Shop ${product.title} with tracked delivery.`,
    image: images.map((image) => image.url),
    sku: variants[0]?.sku,
    brand: { "@type": "Brand", name: settings.name },
    offers:
      variants.length > 0
        ? variants.map((variant) => ({
            "@type": "Offer",
            url: absoluteUrl(`/products/${product.slug}`),
            priceCurrency: variant.currency,
            price: (variant.priceCents / 100).toFixed(2),
            itemCondition: "https://schema.org/NewCondition",
            availability:
              variant.stock === null || variant.stock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
          }))
        : undefined,
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Home
        </Link>
        <span className="px-2">/</span>
        <Link
          href="/products"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Products
        </Link>
        {product.category ? (
          <>
            <span className="px-2">/</span>
            <Link
              href={`/categories/${product.category.slug}`}
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {product.category.name}
            </Link>
          </>
        ) : null}
        <span className="px-2">/</span>
        <span className="line-clamp-1 text-zinc-900 dark:text-zinc-100">
          {product.title}
        </span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={images} title={product.title} />

        <div className="space-y-6">
          <div className="space-y-2">
            {product.category ? (
              <Link
                href={`/categories/${product.category.slug}`}
                className="text-xs font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {product.category.name}
              </Link>
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight">
              {product.title}
            </h1>
          </div>

          <VariantPicker
            variants={variants.map((variant) => ({
              id: variant.id,
              sku: variant.sku,
              title: variant.title,
              options: variant.options,
              priceCents: variant.priceCents,
              compareAtCents: variant.compareAtCents,
              currency: variant.currency,
              stock: variant.stock,
            }))}
          />

          <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            <details className="group" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                Delivery &amp; shipping
                <span
                  aria-hidden
                  className="text-lg font-normal text-zinc-400"
                >
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <div className="space-y-3 px-5 pb-5 text-sm">
                <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
                  {shippingEstimates.map((rate) => (
                    <li key={`${rate.countryCode}-${rate.name}`}>
                      {countryNames[rate.countryCode] ?? rate.countryCode}:{" "}
                      {shippingLabel(rate.minDays, rate.maxDays)}
                      {rate.freeOverCents !== null
                        ? ` · free over ${formatCents(rate.freeOverCents, currency)}`
                        : ` · ${formatCents(rate.amountCents, currency)}`}
                    </li>
                  ))}
                  {shippingEstimates.length === 0 ? (
                    <li>
                      Delivery times are confirmed by email once your order
                      ships.
                    </li>
                  ) : null}
                </ul>
                <p className="text-xs text-zinc-500">
                  Orders are dispatched from our supplier. Tracking is added as
                  soon as your parcel is on its way.
                </p>
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                Returns &amp; support
                <span
                  aria-hidden
                  className="text-lg font-normal text-zinc-400"
                >
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <div className="space-y-2 px-5 pb-5 text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  If something arrives damaged or incorrect, contact support
                  with your order number and a photo, and we will make it right.
                </p>
                <p className="text-xs text-zinc-500">
                  Keep the packaging until your order is confirmed.
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>

      {product.description ? (
        <section className="mt-12 max-w-3xl space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Product details
          </h2>
          <div
            className="space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400 [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-5 [&_li]:list-disc [&_table]:w-full"
            dangerouslySetInnerHTML={{
              __html: sanitizeDescription(product.description),
            }}
          />
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              You may also like
            </h2>
            {product.category ? (
              <Link
                href={`/categories/${product.category.slug}`}
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                More in {product.category.name} →
              </Link>
            ) : null}
          </div>
          <div className="mt-5">
            <ProductGrid products={related} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
