import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryChips } from "@/components/shop/category-chips";
import { Pagination } from "@/components/shop/pagination";
import { ProductGrid } from "@/components/shop/product-grid";
import { SearchForm } from "@/components/shop/search-form";
import { listCategories, listProductCards } from "@/lib/catalog";
import { firstParam, parsePage } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = {
  title: "Shop all products",
  description:
    "Browse every product in our store. Tracked delivery to the US, UK, and more.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = firstParam(params.q)?.trim() ?? "";
  const categorySlug = firstParam(params.category);
  const page = parsePage(firstParam(params.page));

  const [categories, result] = await Promise.all([
    listCategories(),
    listProductCards({ q, categorySlug, page, perPage: 12 }),
  ]);

  if (categorySlug && !result.category) {
    notFound();
  }

  const activeCategory = result.category;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Home
        </Link>
        <span className="px-2">/</span>
        {activeCategory ? (
          <>
            <Link
              href="/products"
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
          <SearchForm defaultValue={q} category={activeCategory?.slug} />
          {q ? (
            <Link
              href={
                activeCategory
                  ? `/products?category=${encodeURIComponent(activeCategory.slug)}`
                  : "/products"
              }
              className="mt-2 inline-block text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Clear search
            </Link>
          ) : null}
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
