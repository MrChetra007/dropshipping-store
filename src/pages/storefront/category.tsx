import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Pagination } from "@/components/shop/pagination";
import { ProductGrid } from "@/components/shop/product-grid";
import { PageSpinner } from "@/components/ui/page-spinner";
import { SmartImage } from "@/components/ui/smart-image";
import { Spinner } from "@/components/ui/spinner";
import { getCategoryBySlug, listProductCards } from "@/lib/catalog";
import { usePageMetadata } from "@/lib/metadata";
import { parsePage } from "@/lib/utils";
import { NotFoundPage } from "@/pages/not-found";

export function CategoryPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const page = parsePage(searchParams.get("page") ?? undefined);

  const categoryQuery = useQuery({
    queryKey: ["category", slug],
    queryFn: () => getCategoryBySlug(slug),
    enabled: Boolean(slug),
  });
  const category = categoryQuery.data;
  const productsQuery = useQuery({
    queryKey: ["catalog", "category", slug, page],
    queryFn: () => listProductCards({ categoryId: category?.id, page, perPage: 12 }),
    enabled: Boolean(category),
    placeholderData: keepPreviousData,
  });

  usePageMetadata({
    title: category ? `${category.name} · KinetiCore Labs` : "Category",
    description: category
      ? `Shop ${category.name} with tracked delivery.`
      : undefined,
    canonical: `/categories/${slug}`,
    image: category?.imageUrl,
  });

  if (categoryQuery.isLoading) {
    return <PageSpinner label="Loading category…" />;
  }

  if (categoryQuery.error) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {categoryQuery.error.message}
        </p>
      </main>
    );
  }

  if (!category) {
    return <NotFoundPage />;
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

  const result = productsQuery.data;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link to="/" className="hover:text-slate-900 dark:hover:text-slate-100">
          Home
        </Link>
        <span className="px-2">/</span>
        <Link
          to="/products"
          className="hover:text-slate-900 dark:hover:text-slate-100"
        >
          Products
        </Link>
        <span className="px-2">/</span>
        <span className="text-slate-900 dark:text-slate-100">
          {category.name}
        </span>
      </nav>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        {category.imageUrl ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900">
            <SmartImage
              src={category.imageUrl}
              alt=""
              sizes="80px"
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {category.name}
          </h1>
          <p className="text-sm text-slate-500">
            {result ? result.total : 0} product
            {result?.total === 1 ? "" : "s"}
            {result && result.pageCount > 1
              ? ` · page ${result.page} of ${result.pageCount}`
              : ""}
          </p>
        </div>
      </header>

      <div className="mt-8">
        {productsQuery.isLoading || !result ? (
          <p className="flex items-center gap-2 py-10 text-sm text-slate-500">
            <Spinner />
            Loading products…
          </p>
        ) : (
          <ProductGrid
            products={result.products}
            emptyMessage="Relief devices for this pain point are being added - check back shortly."
          />
        )}
      </div>

      <div className="mt-10">
        {result ? (
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            basePath={`/categories/${category.slug}`}
          />
        ) : null}
      </div>
    </main>
  );
}
