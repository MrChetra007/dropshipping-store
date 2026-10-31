import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { callAdminApi } from "@/lib/supabase/functions";
import { cn } from "@/lib/utils";

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

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
];

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

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

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = firstParam(params.q).trim();
  const status = firstParam(params.status).trim();
  let products: AdminProduct[] = [];
  let errorMessage: string | null = null;

  try {
    const data = await callAdminApi<ProductsResponse>("products.list");
    products = data.products;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  const filtered = products.filter((product) => {
    const matchesQuery =
      !query ||
      product.title.toLowerCase().includes(query.toLowerCase()) ||
      product.slug.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = !status || product.status === status;

    return matchesQuery && matchesStatus;
  });

  const filterHref = (nextStatus: string) => {
    const next = new URLSearchParams();

    if (query) {
      next.set("q", query);
    }

    if (nextStatus) {
      next.set("status", nextStatus);
    }

    const search = next.toString();
    return search ? `/admin/products?${search}` : "/admin/products";
  };

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
          className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Import products
        </Link>
      </div>

      <div className="space-y-3">
        <form
          action="/admin/products"
          method="get"
          className="flex flex-wrap gap-2"
        >
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by title or slug"
            aria-label="Search products"
            className="min-w-0 flex-1 sm:max-w-sm"
          />
          {status ? (
            <input type="hidden" name="status" value={status} />
          ) : null}
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Search
          </button>
          {query || status ? (
            <Link
              href="/admin/products"
              className="inline-flex h-11 items-center px-2 text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Clear
            </Link>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => {
            const active = status === filter.value;

            return (
              <Link
                key={filter.label}
                href={filterHref(filter.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
          <span className="ml-auto text-xs text-zinc-500">
            {filtered.length} product{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Could not load products: {errorMessage}
        </p>
      ) : null}

      {!errorMessage && products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="font-medium">No products imported yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Search the CJ catalog and import your first product.
          </p>
        </div>
      ) : null}

      {products.length > 0 && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="font-medium">No products match</p>
          <p className="mt-1 text-sm text-zinc-500">
            Try a different search or status filter.
          </p>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filtered.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
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
                      <span className="tabular-nums">
                        {product.minPrice === null
                          ? "No price"
                          : `from ${priceFormat.format(product.minPrice)}`}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate font-mono text-xs text-zinc-400">
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
