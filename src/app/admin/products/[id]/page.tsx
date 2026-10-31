import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { AdminProductDetail } from "@/lib/admin-products-types";
import { sanitizeDescription } from "@/lib/sanitize";
import { callAdminApi, EdgeFunctionError } from "@/lib/supabase/functions";

import { ProductEditForm } from "./product-form";

export const instant = false;

export const metadata: Metadata = {
  title: "Edit product | Admin | CJ Dropshipping Store",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let product: AdminProductDetail | null = null;
  let errorMessage: string | null = null;

  try {
    product = await callAdminApi<AdminProductDetail>("products.get", {
      query: { id },
    });
  } catch (error) {
    if (error instanceof EdgeFunctionError && error.status === 404) {
      notFound();
    }

    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  if (errorMessage || !product) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/products"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to products
        </Link>
        <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Could not load product: {errorMessage ?? "Product not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin/products"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to products
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {product.product.title}
            </h1>
            <p className="mt-1 font-mono text-sm text-zinc-500">
              /products/{product.product.slug}
              {product.supplierProductId
                ? ` · CJ ${product.supplierProductId}`
                : ""}
            </p>
          </div>
          <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium capitalize text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            {product.product.status}
          </span>
        </div>
      </div>

      <ProductEditForm product={product} />

      {product.product.description ? (
        <section className="space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold">Description preview</h2>
            <p className="text-sm text-zinc-500">
              Rendered after server-side sanitization.
            </p>
          </div>
          <div
            className="prose prose-sm max-w-none space-y-3 text-sm text-zinc-600 dark:text-zinc-400 [&_img]:h-auto [&_img]:max-w-full"
            dangerouslySetInnerHTML={{
              __html: sanitizeDescription(product.product.description),
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
