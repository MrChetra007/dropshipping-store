import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const instant = false;

export const metadata: Metadata = {
  title: "Products | CJ Dropshipping Store",
};

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
};

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id,slug,title,description")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Could not load products: {error.message}
        </p>
      </main>
    );
  }

  const rows = (products ?? []) as ProductRow[];
  const ids = rows.map((product) => product.id);
  const pricesByProduct = new Map<string, number>();
  const imageByProduct = new Map<string, string>();

  if (ids.length > 0) {
    const { data: variants, error: variantError } = await supabase
      .from("product_variants")
      .select("product_id,price")
      .in("product_id", ids);

    if (variantError) {
      return (
        <main className="mx-auto w-full max-w-5xl px-6 py-16">
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Could not load product prices: {variantError.message}
          </p>
        </main>
      );
    }

    for (const variant of variants ?? []) {
      const price = Number(variant.price);
      const current = pricesByProduct.get(variant.product_id);

      if (!current || price < current) {
        pricesByProduct.set(variant.product_id, price);
      }
    }

    const { data: images, error: imageError } = await supabase
      .from("product_images")
      .select("product_id,url,sort_order")
      .in("product_id", ids)
      .order("sort_order", { ascending: true });

    if (imageError) {
      return (
        <main className="mx-auto w-full max-w-5xl px-6 py-16">
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            Could not load product images: {imageError.message}
          </p>
        </main>
      );
    }

    for (const image of images ?? []) {
      if (!imageByProduct.has(image.product_id)) {
        imageByProduct.set(image.product_id, image.url);
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {rows.length} product{rows.length === 1 ? "" : "s"} available.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No active products yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((product) => {
            const image = imageByProduct.get(product.id);
            const price = pricesByProduct.get(product.id);

            return (
              <li key={product.id}>
                <Link
                  href={`/products/${product.slug}`}
                  className="group block overflow-hidden rounded-lg border border-zinc-200 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900">
                    {image ? (
                      <Image
                        src={image}
                        alt={product.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="line-clamp-2 font-medium">{product.title}</p>
                    <p className="text-sm text-zinc-500">
                      {price === undefined
                        ? "Price unavailable"
                        : `From ${priceFormat.format(price)}`}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
