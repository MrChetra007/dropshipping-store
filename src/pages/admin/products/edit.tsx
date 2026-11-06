import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ProductEditForm } from "@/components/admin/product-edit-form";
import { ButtonLink } from "@/components/ui/button-link";
import { NotFoundPage } from "@/pages/not-found";
import { getAdminProduct } from "@/features/admin/admin-api";
import { usePageMetadata } from "@/lib/metadata";
import { sanitizeDescription } from "@/lib/sanitize";
import { EdgeFunctionError } from "@/lib/functions";

export function AdminProductEditPage() {
  const { id = "" } = useParams();
  const productQuery = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: () => getAdminProduct(id),
  });

  usePageMetadata({
    title: "Edit product | Admin | CJ Dropshipping Store",
  });

  if (productQuery.isLoading) {
    return (
      <div className="h-[400px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
    );
  }

  if (productQuery.error) {
    if (
      productQuery.error instanceof EdgeFunctionError &&
      productQuery.error.status === 404
    ) {
      return <NotFoundPage />;
    }

    return (
      <div className="space-y-4">
        <ButtonLink to="/admin/products" variant="ghost" size="sm">
          ← Back to products
        </ButtonLink>
        <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Could not load product:{" "}
          {productQuery.error instanceof Error
            ? productQuery.error.message
            : "Unknown error"}
        </p>
      </div>
    );
  }

  if (!productQuery.data) {
    return <NotFoundPage />;
  }

  const product = productQuery.data;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <ButtonLink to="/admin/products" variant="ghost" size="sm">
          ← Back to products
        </ButtonLink>
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
              Rendered after client-side sanitization with DOMPurify.
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
