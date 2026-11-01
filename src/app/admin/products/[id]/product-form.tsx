"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminProductDetail } from "@/lib/admin-products-types";
import {
  updateProduct,
  type UpdateProductState,
} from "@/lib/admin-products-actions";
import { cn } from "@/lib/utils";

const initialState: UpdateProductState = {};

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function ProductEditForm({
  product,
}: {
  product: AdminProductDetail;
}) {
  const [state, formAction, pending] = useActionState(
    updateProduct,
    initialState,
  );
  const [images, setImages] = useState(product.images);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function moveImage(index: number, offset: number) {
    const target = index + offset;

    if (target < 0 || target >= images.length) {
      return;
    }

    setImages((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function moveImageTo(from: number, to: number) {
    if (from === to) {
      return;
    }

    setImages((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="productId" value={product.product.id} />

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      {state.message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="title"
            name="title"
            defaultValue={product.product.title}
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={product.product.status}
            className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="categoryId" className="text-sm font-medium">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={product.product.categoryId ?? ""}
            className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
          >
            <option value="">Uncategorized</option>
            {product.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description HTML
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={product.product.description ?? ""}
            rows={14}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none transition-colors focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-300"
          />
          <p className="text-xs text-zinc-500">
            Stored as HTML and sanitized before rendering on the storefront.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Variant prices</h2>
            <p className="text-sm text-zinc-500">
              Supplier cost is read-only. Prices are what customers pay.
            </p>
          </div>
          <p className="text-sm text-zinc-500">
            {product.variants.length} variant
            {product.variants.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">Variant</th>
                <th className="px-4 py-3 font-medium">CJ SKU</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Selling price</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => {
                const margin =
                  variant.costPrice !== null && variant.price > 0
                    ? ((variant.price - variant.costPrice) / variant.price) * 100
                    : null;

                return (
                  <tr
                    key={variant.id}
                    className="border-t border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="hidden"
                        name="variant_id"
                        value={variant.id}
                      />
                      <p className="font-medium">{variant.title}</p>
                      {!variant.isActive ? (
                        <p className="text-xs text-amber-600">
                          {variant.autoDisabled
                            ? "Inactive (stock sync)"
                            : "Inactive"}
                        </p>
                      ) : null}
                      {variant.needsReview ? (
                        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                          Needs review
                          {variant.reviewReason
                            ? `: ${variant.reviewReason}`
                            : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {variant.sku}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 tabular-nums">
                      {variant.stock === null ? "Unknown" : variant.stock}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 tabular-nums">
                      {variant.costPrice === null
                        ? "—"
                        : priceFormat.format(variant.costPrice)}
                      {margin === null ? null : (
                        <span
                          className={`ml-2 text-xs font-medium ${
                            margin < 0
                              ? "text-red-600 dark:text-red-400"
                              : variant.needsReview || margin < 15
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {margin.toFixed(0)}% margin
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        name={`variant_price_${variant.id}`}
                        defaultValue={variant.price.toFixed(2)}
                        min="0"
                        max="1000000"
                        step="0.01"
                        aria-label={`Price for ${variant.title}`}
                        className="h-9 w-32 font-mono tabular-nums"
                        required
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Images</h2>
          <p className="text-sm text-zinc-500">
            The first image is the main product image. Drag rows or use the
            arrows to change gallery order.
          </p>
        </div>

        {images.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No images imported.
          </p>
        ) : (
          <ol className="space-y-3">
            {images.map((image, index) => (
              <li
                key={image.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) {
                    moveImageTo(dragIndex, index);
                  }

                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  "flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-3 transition-opacity dark:border-zinc-800 dark:bg-zinc-950",
                  dragIndex === index && "opacity-50",
                )}
              >
                <input type="hidden" name="image_id" value={image.id} />
                <input
                  type="hidden"
                  name={`image_order_${image.id}`}
                  value={index}
                />
                <span
                  aria-hidden
                  className="cursor-grab select-none text-lg leading-none text-zinc-300 dark:text-zinc-600"
                >
                  ⠿
                </span>
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <Image
                    src={image.url}
                    alt={image.alt ?? ""}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {index === 0 ? "Main image" : `Image ${index + 1}`}
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-400">
                    {image.url}
                  </p>
                  {image.variantId ? (
                    <p className="text-xs text-zinc-400">Variant image</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => moveImage(index, -1)}
                    disabled={index === 0}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-700"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(index, 1)}
                    disabled={index === images.length - 1}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-700"
                  >
                    Down
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <Button type="submit" loading={pending} loadingLabel="Saving…">
          Save product
        </Button>
        <Link
          href="/admin/products"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Back to products
        </Link>
        <Link
          href={`/products`}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          View storefront
        </Link>
      </div>
    </form>
  );
}
