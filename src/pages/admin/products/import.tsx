import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ImportSearchForm } from "@/components/admin/import-search-form";
import { ImportSelectionForm } from "@/components/admin/import-selection-form";
import { ImportSingleForm } from "@/components/admin/import-single-form";
import { PreviewGallery, Stat } from "@/components/admin/preview-gallery";
import { SmartImage } from "@/components/ui/smart-image";
import {
  getCjProduct,
  searchCjProducts,
} from "@/features/admin/admin-api";
import { usePageMetadata } from "@/lib/metadata";
import { sanitizeDescription } from "@/lib/sanitize";
import { parsePage } from "@/lib/utils";

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function AdminImportPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const page = parsePage(searchParams.get("page") ?? undefined);
  const [previewPid, setPreviewPid] = useState<string | null>(null);

  const searchQuery = useQuery({
    queryKey: ["admin", "cj-search", query, page],
    queryFn: () => searchCjProducts(query, page),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });

  usePageMetadata({
    title: "Import products | Admin | CJ Dropshipping Store",
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/admin/products"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to products
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Import CJ products
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Search the CJ catalog, preview costs and variants, then import as
          drafts. Selling prices use the markup rule in settings.
        </p>
      </div>

      <ImportSearchForm query={query} />

      {query ? (
        <SearchResults
          query={query}
          searchQuery={searchQuery}
          onPreview={setPreviewPid}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Enter a keyword to search the CJ catalog.
        </p>
      )}

      {previewPid ? (
        <Preview pid={previewPid} onClose={() => setPreviewPid(null)} />
      ) : null}
    </div>
  );
}

function SearchResults({
  query,
  searchQuery,
  onPreview,
}: {
  query: string;
  searchQuery: UseQueryResult<Awaited<ReturnType<typeof searchCjProducts>>, Error>;
  onPreview: (pid: string) => void;
}) {
  const navigate = useNavigate();

  if (searchQuery.isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
    );
  }

  if (searchQuery.error || !searchQuery.data) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        CJ search failed:{" "}
        {searchQuery.error instanceof Error
          ? searchQuery.error.message
          : "Unknown error"}
      </p>
    );
  }

  const search = searchQuery.data;

  const pageHref = (nextPage: number) => {
    const params: Record<string, string> = { q: query };

    if (nextPage > 1) {
      params.page = String(nextPage);
    }

    const search = new URLSearchParams(params).toString();
    navigate(search ? `/admin/products/import?${search}` : "/admin/products/import");
  };

  return (
    <ImportSelectionForm count={search.products.length}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">
          {search.totalRecords} result
          {search.totalRecords === 1 ? "" : "s"} for “{query}”
        </p>
        <div className="flex items-center gap-3 text-sm">
          {search.page > 1 ? (
            <button
              type="button"
              onClick={() => pageHref(search.page - 1)}
              className="underline"
            >
              Previous
            </button>
          ) : null}
          <span className="text-zinc-500">
            Page {search.page} of {Math.max(search.totalPages, 1)}
          </span>
          {search.page < search.totalPages ? (
            <button
              type="button"
              onClick={() => pageHref(search.page + 1)}
              className="underline"
            >
              Next
            </button>
          ) : null}
        </div>
      </div>

      {search.products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No CJ products matched this search.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          {search.products.map((product) => (
            <li
              key={product.id}
              className="flex items-start gap-4 border-b border-zinc-200 p-4 last:border-b-0 dark:border-zinc-800"
            >
              <input
                type="checkbox"
                name="pids"
                value={product.id}
                aria-label={`Select ${product.title}`}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {product.image ? (
                  <SmartImage
                    src={product.image}
                    alt=""
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{product.title}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {product.sku ? (
                    <span className="font-mono text-xs">SKU {product.sku}</span>
                  ) : null}
                  {product.sku ? " · " : ""}
                  {product.price === null
                    ? "Price unavailable"
                    : `CJ ${priceFormat.format(product.price)}`}
                  {product.inventory === null
                    ? ""
                    : ` · ${product.inventory} in stock`}
                </p>
                {product.category ? (
                  <p className="mt-0.5 truncate text-xs text-zinc-400">
                    {product.category}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onPreview(product.id)}
                className="shrink-0 text-sm underline"
              >
                Preview
              </button>
            </li>
          ))}
        </ul>
      )}
    </ImportSelectionForm>
  );
}

function Preview({
  pid,
  onClose,
}: {
  pid: string;
  onClose: () => void;
}) {
  const previewQuery = useQuery({
    queryKey: ["admin", "cj-product", pid],
    queryFn: () => getCjProduct(pid),
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/60 p-3 backdrop-blur-sm sm:p-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close product preview"
        className="fixed inset-0 cursor-default"
      />
      {previewQuery.isLoading ? (
        <div
          role="dialog"
          aria-modal="true"
          className="relative z-10 mx-auto mt-24 h-64 w-full max-w-lg animate-pulse rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        />
      ) : previewQuery.error ? (
        <PreviewError
          message={
            previewQuery.error instanceof Error
              ? previewQuery.error.message
              : "Unknown error"
          }
          onClose={onClose}
        />
      ) : previewQuery.data ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          className="relative z-10 mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5 dark:border-zinc-800">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                CJ product preview
              </p>
              <h2
                id="preview-title"
                className="mt-1 text-xl font-semibold tracking-tight"
              >
                {previewQuery.data.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-200 px-2.5 py-1 font-mono dark:border-zinc-700">
                  CJ {previewQuery.data.pid}
                </span>
                {previewQuery.data.sku ? (
                  <span className="rounded-full border border-zinc-200 px-2.5 py-1 font-mono dark:border-zinc-700">
                    SKU {previewQuery.data.sku}
                  </span>
                ) : null}
                {previewQuery.data.category ? (
                  <span className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-zinc-700">
                    {previewQuery.data.category}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
            <PreviewGallery
              images={previewQuery.data.images}
              title={previewQuery.data.title}
            />

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Variants"
                  value={String(previewQuery.data.variants.length)}
                />
                <Stat label="From" value={minCost(previewQuery.data)} />
                <Stat
                  label="In stock"
                  value={totalStock(previewQuery.data).toLocaleString("en-US")}
                />
                <Stat
                  label="Images"
                  value={String(previewQuery.data.images.length)}
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="max-h-80 overflow-auto">
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                      <tr>
                        <th className="px-3 py-2 font-medium">Variant</th>
                        <th className="px-3 py-2 font-medium">CJ SKU</th>
                        <th className="px-3 py-2 font-medium">Cost</th>
                        <th className="px-3 py-2 font-medium">Weight</th>
                        <th className="px-3 py-2 font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewQuery.data.variants.map((variant) => (
                        <tr
                          key={variant.vid}
                          className="border-t border-zinc-100 dark:border-zinc-900"
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              {variant.image ? (
                                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                                  <SmartImage
                                    src={variant.image}
                                    alt=""
                                    className="object-cover"
                                  />
                                </span>
                              ) : null}
                              <span>
                                <p>{variant.title}</p>
                                {variant.rawKey ? (
                                  <p className="text-xs text-zinc-400">
                                    {variant.rawKey}
                                  </p>
                                ) : null}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">
                            {variant.sku ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {variant.cost === null
                              ? "—"
                              : priceFormat.format(variant.cost)}
                          </td>
                          <td className="px-3 py-2.5 text-zinc-500 tabular-nums">
                            {variant.weightG === null
                              ? "—"
                              : `${variant.weightG} g`}
                          </td>
                          <td className="px-3 py-2.5 text-zinc-500 tabular-nums">
                            {variant.stock === null ? "Unknown" : variant.stock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {previewQuery.data.description ? (
                <details
                  className="group rounded-xl border border-zinc-200 dark:border-zinc-800"
                  open
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    Description
                    <span className="text-xs font-normal text-zinc-400">
                      <span className="group-open:hidden">Show</span>
                      <span className="hidden group-open:inline">Hide</span>
                    </span>
                  </summary>
                  <div
                    className="max-h-72 overflow-y-auto border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 [&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeDescription(previewQuery.data.description),
                    }}
                  />
                </details>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <p className="text-sm text-zinc-500">
              Imported products start as drafts. Set status to active to
              publish.
            </p>
            <div className="w-full sm:w-64">
              <ImportSingleForm pid={previewQuery.data.pid} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreviewError({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="relative z-10 mx-auto mt-24 w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-lg font-semibold">Could not load CJ product</h2>
      <p className="mt-2 text-sm text-red-600 dark:text-red-400">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Close
      </button>
    </div>
  );
}

function minCost(preview: {
  variants: Array<{ cost: number | null }>;
}): string {
  const costs = preview.variants
    .map((variant) => variant.cost)
    .filter((cost): cost is number => cost !== null);
  return costs.length > 0 ? priceFormat.format(Math.min(...costs)) : "—";
}

function totalStock(preview: {
  variants: Array<{ stock: number | null }>;
}): number {
  return preview.variants.reduce(
    (sum, variant) => sum + (variant.stock ?? 0),
    0,
  );
}
