import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { AdminProductSearchForm } from "@/components/admin/product-search-form";
import { StatusBadge } from "@/components/admin/badge";
import { SmartImage } from "@/components/ui/smart-image";
import { ButtonLink } from "@/components/ui/button-link";
import { PageSpinner } from "@/components/ui/page-spinner";
import { listAdminProducts } from "@/features/admin/admin-api";
import { usePageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

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

export function AdminProductsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";

  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: listAdminProducts,
    placeholderData: keepPreviousData,
  });

  usePageMetadata({
    title: "Products | Admin | KinetiCore Labs",
  });

  if (productsQuery.isLoading) {
    return <PageSpinner label="Loading products…" />;
  }

  if (productsQuery.error || !productsQuery.data) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        Could not load products:{" "}
        {productsQuery.error instanceof Error
          ? productsQuery.error.message
          : "Unknown error"}
      </p>
    );
  }

  const products = productsQuery.data.products;

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
        <ButtonLink to="/admin/products/import" variant="primary">
          Import products
        </ButtonLink>
      </div>

      <div className="space-y-3">
        <AdminProductSearchForm query={query} status={status} />

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => {
            const active = status === filter.value;

            return (
              <Link
                key={filter.label}
                to={filterHref(filter.value)}
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

      {!productsQuery.error && products.length === 0 ? (
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
                  to={`/admin/products/${product.id}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    {product.image ? (
                      <SmartImage
                        src={product.image}
                        alt=""
                        fill
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
                  <span className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                    Edit
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
