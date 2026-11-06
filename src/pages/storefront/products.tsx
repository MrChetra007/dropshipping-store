import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { CategoryChips } from "@/components/shop/category-chips";
import { Pagination } from "@/components/shop/pagination";
import { ProductGrid } from "@/components/shop/product-grid";
import { SearchForm } from "@/components/shop/search-form";
import { PageSpinner } from "@/components/ui/page-spinner";
import { listCategories, listProductCards } from "@/lib/catalog";
import { usePageMetadata } from "@/lib/metadata";
import { parsePage } from "@/lib/utils";
import { NotFoundPage } from "@/pages/not-found";

export function ProductsPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const categorySlug = searchParams.get("category") ?? undefined;
  const page = parsePage(searchParams.get("page") ?? undefined);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });
  const productsQuery = useQuery({
    queryKey: ["catalog", "products", q, categorySlug, page],
    queryFn: () => listProductCards({ q, categorySlug, page, perPage: 12 }),
    placeholderData: keepPreviousData,
  });

  const result = productsQuery.data;
  const activeCategory = result?.category ?? null;
  const categories = categoriesQuery.data ?? [];

  usePageMetadata({
    title: activeCategory
      ? `${activeCategory.name} · Shop all products`
      : "Shop all products",
    description:
      "Browse every product in our store. Tracked delivery to the US, UK, and more.",
    canonical: categorySlug
      ? `/products?category=${encodeURIComponent(categorySlug)}`
      : "/products",
  });

  if (productsQuery.isLoading) {
    return <PageSpinner label="Loading products…" />;
  }

  if (productsQuery.error) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {productsQuery.error.message}
        </p>
      </main>
    );
  }

  if (!result) {
    return <PageSpinner label="Loading products…" />;
  }

  if (categorySlug && !activeCategory) {
    return <NotFoundPage />;
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
        <Link to="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Home
        </Link>
        <span className="px-2">/</span>
        {activeCategory ? (
          <>
            <Link
              to="/products"
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Products
            </Link>
            <span className="px-2">/</span>
            <span className="text-zinc-900 dark:text-zinc-100">
              {activeCategory.name}
            </span>
          </>
        ) : (
          <span className="text-zinc-900 dark:text-zinc-100">Products</span>
        )}
      </nav>

      <div className="mt-6 flex flex-col gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {activeCategory ? activeCategory.name : "All products"}
          </h1>
          <p className="text-sm text-zinc-500">
            {result.total} product{result.total === 1 ? "" : "s"}
            {q ? ` matching “${q}”` : ""}
            {result.pageCount > 1
              ? ` · page ${result.page} of ${result.pageCount}`
              : ""}
          </p>
        </div>

        <div className="max-w-xl">
          <SearchForm
            key={q}
            defaultValue={q}
            category={activeCategory?.slug}
          />
        </div>

        <CategoryChips
          categories={categories}
          activeSlug={activeCategory?.slug}
          query={q || undefined}
        />

        <ProductGrid
          products={result.products}
          emptyMessage={
            q
              ? `No products match “${q}”. Try a different search.`
              : "No products in this category yet."
          }
        />

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          basePath="/products"
          query={{ q: q || undefined, category: activeCategory?.slug }}
        />
      </div>
    </main>
  );
}
