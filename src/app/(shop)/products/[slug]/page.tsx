import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { sanitizeDescription } from "@/lib/sanitize";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type PageProps = {
  params: Promise<{ slug: string }>;
};

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("title")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  return {
    title: data?.title
      ? `${data.title} | CJ Dropshipping Store`
      : "Product | CJ Dropshipping Store",
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("id,slug,title,description")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Could not load product: {error.message}
        </p>
      </main>
    );
  }

  if (!product) {
    notFound();
  }

  const { data: variants, error: variantError } = await supabase
    .from("product_variants")
    .select("id,title,price,stock,sort_order")
    .eq("product_id", product.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: images, error: imageError } = await supabase
    .from("product_images")
    .select("id,url,alt,sort_order")
    .eq("product_id", product.id)
    .order("sort_order", { ascending: true });

  if (variantError || imageError) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Could not load product details:{" "}
          {variantError?.message ?? imageError?.message}
        </p>
      </main>
    );
  }

  const variantRows = variants ?? [];
  const imageRows = images ?? [];
  const prices = variantRows.map((variant) => Number(variant.price));
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const available = variantRows.some(
    (variant) => variant.stock === null || variant.stock > 0,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/products"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← Back to products
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          {imageRows.length > 0 ? (
            imageRows.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Image
                  src={image.url}
                  alt={image.alt ?? product.title}
                  fill
                  priority={index === 0}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            ))
          ) : (
            <div className="aspect-square rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700" />
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {product.title}
            </h1>
            <p className="text-xl font-medium">
              {minPrice === null
                ? "Price unavailable"
                : `From ${priceFormat.format(minPrice)}`}
            </p>
            <p
              className={`text-sm ${
                available
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {available ? "In stock" : "Out of stock"}
            </p>
          </div>

          {variantRows.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Variants</h2>
              <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
                {variantRows.map((variant) => (
                  <li
                    key={variant.id}
                    className="flex items-center justify-between gap-4 px-4 py-2"
                  >
                    <span>{variant.title}</span>
                    <span className="text-zinc-500">
                      {priceFormat.format(Number(variant.price))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {product.description ? (
            <div
              className="prose prose-sm max-w-none space-y-3 text-sm text-zinc-600 dark:text-zinc-400 [&_img]:h-auto [&_img]:max-w-full"
              dangerouslySetInnerHTML={{
                __html: sanitizeDescription(product.description),
              }}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
