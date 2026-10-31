import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/components/shop/pagination";
import { ProductGrid } from "@/components/shop/product-grid";
import { getCategoryBySlug, listProductCards } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";
import { firstParam, parsePage } from "@/lib/utils";

export const instant = false;

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return { title: "Category not found" };
  }

  return {
    title: category.name,
    description: `Shop ${category.name} with tracked delivery.`,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: {
      title: category.name,
      description: `Shop ${category.name} with tracked delivery.`,
      url: absoluteUrl(`/categories/${category.slug}`),
      images: category.imageUrl ? [{ url: category.imageUrl }] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const page = parsePage(firstParam((await searchParams).page));
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const result = await listProductCards({
    categoryId: category.id,
    page,
    perPage: 12,
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
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
        <span className="px-2">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {category.name}
        </span>
      </nav>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        {category.imageUrl ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
            <Image
              src={category.imageUrl}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {category.name}
          </h1>
          <p className="text-sm text-zinc-500">
            {result.total} product{result.total === 1 ? "" : "s"}
            {result.pageCount > 1
              ? ` · page ${result.page} of ${result.pageCount}`
              : ""}
          </p>
        </div>
      </header>

      <div className="mt-8">
        <ProductGrid
          products={result.products}
          emptyMessage="No products in this category yet."
        />
      </div>

      <div className="mt-10">
        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          basePath={`/categories/${category.slug}`}
        />
      </div>
    </main>
  );
}
