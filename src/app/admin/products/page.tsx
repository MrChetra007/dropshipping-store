import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { callAdminApi } from "@/lib/supabase/functions";

export const instant = false;

export const metadata: Metadata = {
  title: "Products | Admin | CJ Dropshipping Store",
};

type AdminProduct = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updatedAt: string;
  variantCount: number;
  activeVariantCount: number;
  minPrice: number | null;
  image: string | null;
  needsReviewCount: number;
};

type ProductsResponse = {
  products: AdminProduct[];
};

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    draft:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    archived:
      "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
        styles[status] ?? styles.archived
      }`}
    >
      {status}
    </span>
  );
}

export default async function AdminProductsPage() {
  let products: AdminProduct[] = [];
  let errorMessage: string | null = null;

  try {
    const data = await callAdminApi<ProductsResponse>("products.list");
    products = data.products;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Imported CJ products. Drafts are hidden from the storefront.
          </p>
        </div>
        <Link
          href="/admin/products/import"
          className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Import products
        </Link>
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Could not load products: {errorMessage}
        </p>
      ) : null}

      {!errorMessage && products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="font-medium">No products imported yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Search the CJ catalog and import your first product.
          </p>
        </div>
      ) : null}

      {products.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{product.title}</p>
                      <StatusBadge status={product.status} />
                      {product.needsReviewCount > 0 ? (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                          {product.needsReviewCount} to review
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {product.variantCount} variant
                      {product.variantCount === 1 ? "" : "s"} ·{" "}
                      {product.activeVariantCount} active ·{" "}
                      {product.minPrice === null
                        ? "No price"
                        : `from ${priceFormat.format(product.minPrice)}`}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      /products/{product.slug}
                    </p>
                  </div>
                  <span className="text-sm text-zinc-500">Edit</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
