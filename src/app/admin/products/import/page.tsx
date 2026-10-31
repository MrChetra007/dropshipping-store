import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { callAdminApi } from "@/lib/supabase/functions";
import { sanitizeDescription } from "@/lib/sanitize";

import { ImportSelectionForm } from "./import-form";
import { ImportSingleForm } from "./import-single-form";
import { PreviewGallery } from "./preview-gallery";
import { PreviewSkeleton, SearchResultsSkeleton } from "./skeletons";

export const instant = false;

export const metadata: Metadata = {
  title: "Import products | Admin | CJ Dropshipping Store",
};

type CjSearchItem = {
  id: string;
  title: string;
  sku: string | null;
  image: string | null;
  price: number | null;
  category: string | null;
  inventory: number | null;
};

type CjSearchResponse = {
  products: CjSearchItem[];
  page: number;
  totalPages: number;
  totalRecords: number;
};

type CjProductDetail = {
  pid: string;
  title: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  images: string[];
  variants: Array<{
    vid: string;
    title: string;
    sku: string | null;
    cost: number | null;
    stock: number | null;
    weightG: number | null;
    image: string | null;
    options: Record<string, string>;
    rawKey: string | null;
  }>;
};

type SearchParams = Record<string, string | string[] | undefined>;

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

function pageHref(query: string, page: number, pid?: string): string {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  if (pid) {
    params.set("pid", pid);
  }

  const suffix = params.toString();

  return suffix
    ? `/admin/products/import?${suffix}`
    : "/admin/products/import";
}

export default async function ImportProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = param(params.q).trim();
  const requestedPage = Number.parseInt(param(params.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const pid = param(params.pid).trim();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin/products"
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

      <form
        action="/admin/products/import"
        method="get"
        className="flex flex-wrap gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search CJ products by keyword"
          className="h-11 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
        />
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Search
        </button>
      </form>

      {query ? (
        <Suspense
          key={`${query}:${page}`}
          fallback={<SearchResultsSkeleton />}
        >
          <SearchResults query={query} page={page} />
        </Suspense>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Enter a keyword to search the CJ catalog.
        </p>
      )}

      {pid ? (
        <Suspense
          key={pid}
          fallback={<PreviewSkeleton closeHref={pageHref(query, page)} />}
        >
          <Preview pid={pid} query={query} page={page} />
        </Suspense>
      ) : null}
    </div>
  );
}

async function SearchResults({
  query,
  page,
}: {
  query: string;
  page: number;
}) {
  let search: CjSearchResponse;

  try {
    search = await callAdminApi<CjSearchResponse>("cj.search", {
      query: { keyword: query, page },
    });
  } catch (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        CJ search failed:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </p>
    );
  }

  return (
    <ImportSelectionForm count={search.products.length}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">
          {search.totalRecords} result
          {search.totalRecords === 1 ? "" : "s"} for “{query}”
        </p>
        <div className="flex items-center gap-3 text-sm">
          {search.page > 1 ? (
            <Link
              href={pageHref(query, search.page - 1)}
              className="underline"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-zinc-500">
            Page {search.page} of {Math.max(search.totalPages, 1)}
          </span>
          {search.page < search.totalPages ? (
            <Link
              href={pageHref(query, search.page + 1)}
              className="underline"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>

      {search.products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No CJ products matched this search.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
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
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{product.title}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {product.sku ? `SKU ${product.sku} · ` : ""}
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
              <Link
                href={pageHref(query, page, product.id)}
                scroll={false}
                className="shrink-0 text-sm underline"
              >
                Preview
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ImportSelectionForm>
  );
}

async function Preview({
  pid,
  query,
  page,
}: {
  pid: string;
  query: string;
  page: number;
}) {
  const closeHref = pageHref(query, page);
  let preview: CjProductDetail;

  try {
    preview = await callAdminApi<CjProductDetail>("cj.product", {
      query: { pid },
    });
  } catch (error) {
    return (
      <PreviewError
        closeHref={closeHref}
        message={error instanceof Error ? error.message : "Unknown error"}
      />
    );
  }

  const costs = preview.variants
    .map((variant) => variant.cost)
    .filter((cost): cost is number => cost !== null);
  const minCost = costs.length > 0 ? Math.min(...costs) : null;
  const totalStock = preview.variants.reduce(
    (sum, variant) => sum + (variant.stock ?? 0),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/60 p-3 backdrop-blur-sm sm:p-6">
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close product preview"
        className="fixed inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        className="relative z-10 mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
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
              {preview.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-zinc-700">
                CJ {preview.pid}
              </span>
              {preview.sku ? (
                <span className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-zinc-700">
                  SKU {preview.sku}
                </span>
              ) : null}
              {preview.category ? (
                <span className="rounded-full border border-zinc-200 px-2.5 py-1 dark:border-zinc-700">
                  {preview.category}
                </span>
              ) : null}
            </div>
          </div>
          <Link
            href={closeHref}
            scroll={false}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </Link>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <PreviewGallery images={preview.images} title={preview.title} />

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Variants"
                value={String(preview.variants.length)}
              />
              <Stat
                label="From"
                value={minCost === null ? "—" : priceFormat.format(minCost)}
              />
              <Stat
                label="In stock"
                value={totalStock.toLocaleString("en-US")}
              />
              <Stat label="Images" value={String(preview.images.length)} />
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
                    {preview.variants.map((variant) => (
                      <tr
                        key={variant.vid}
                        className="border-t border-zinc-100 dark:border-zinc-900"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {variant.image ? (
                              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                                <Image
                                  src={variant.image}
                                  alt=""
                                  fill
                                  sizes="32px"
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
                        <td className="px-3 py-2.5 text-zinc-500">
                          {variant.sku ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {variant.cost === null
                            ? "—"
                            : priceFormat.format(variant.cost)}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-500">
                          {variant.weightG === null
                            ? "—"
                            : `${variant.weightG} g`}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-500">
                          {variant.stock === null ? "Unknown" : variant.stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {preview.description ? (
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
                    __html: sanitizeDescription(preview.description),
                  }}
                />
              </details>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <p className="text-sm text-zinc-500">
            Imported products start as drafts. Set status to active to publish.
          </p>
          <div className="w-full sm:w-64">
            <ImportSingleForm pid={preview.pid} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewError({
  closeHref,
  message,
}: {
  closeHref: string;
  message: string;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/60 p-3 backdrop-blur-sm sm:p-6">
      <Link
        href={closeHref}
        scroll={false}
        aria-label="Close product preview"
        className="fixed inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 mx-auto mt-24 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-lg font-semibold">Could not load CJ product</h2>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{message}</p>
        <Link
          href={closeHref}
          scroll={false}
          className="mt-5 inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Close
        </Link>
      </div>
    </div>
  );
}
