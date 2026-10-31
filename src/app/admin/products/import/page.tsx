import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { callAdminApi } from "@/lib/supabase/functions";
import { sanitizeDescription } from "@/lib/sanitize";

import { ImportSelectionForm } from "./import-form";

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

  let search: CjSearchResponse | null = null;
  let searchError: string | null = null;

  if (query) {
    try {
      search = await callAdminApi<CjSearchResponse>("cj.search", {
        query: { keyword: query, page },
      });
    } catch (error) {
      searchError = error instanceof Error ? error.message : "Unknown error";
    }
  }

  let preview: CjProductDetail | null = null;
  let previewError: string | null = null;

  if (pid) {
    try {
      preview = await callAdminApi<CjProductDetail>("cj.product", {
        query: { pid },
      });
    } catch (error) {
      previewError = error instanceof Error ? error.message : "Unknown error";
    }
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

      {searchError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          CJ search failed: {searchError}
        </p>
      ) : null}

      {previewError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Could not load CJ product: {previewError}
        </p>
      ) : null}

      {query && search ? (
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
      ) : null}

      {!query ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Enter a keyword to search the CJ catalog.
        </p>
      ) : null}

      {preview ? (
        <section className="space-y-5 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{preview.title}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                CJ ID {preview.pid}
                {preview.sku ? ` · SKU ${preview.sku}` : ""}
              </p>
              {preview.category ? (
                <p className="mt-0.5 text-sm text-zinc-500">
                  {preview.category}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              {preview.images.slice(0, 5).map((image) => (
                <div
                  key={image}
                  className="relative h-16 w-16 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800"
                >
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-4 font-medium">Variant</th>
                  <th className="py-2 pr-4 font-medium">CJ SKU</th>
                  <th className="py-2 pr-4 font-medium">CJ cost</th>
                  <th className="py-2 pr-4 font-medium">Weight</th>
                  <th className="py-2 pr-4 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {preview.variants.map((variant) => (
                  <tr
                    key={variant.vid}
                    className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900"
                  >
                    <td className="py-2 pr-4">
                      <p>{variant.title}</p>
                      {variant.rawKey ? (
                        <p className="text-xs text-zinc-400">
                          {variant.rawKey}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {variant.sku ?? "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {variant.cost === null
                        ? "—"
                        : priceFormat.format(variant.cost)}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {variant.weightG === null ? "—" : `${variant.weightG} g`}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {variant.stock === null ? "Unknown" : variant.stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.description ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Description preview</h3>
              <div
                className="prose prose-sm max-w-none space-y-3 text-sm text-zinc-600 dark:text-zinc-400 [&_img]:h-auto [&_img]:max-w-full"
                dangerouslySetInnerHTML={{
                  __html: sanitizeDescription(preview.description),
                }}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
