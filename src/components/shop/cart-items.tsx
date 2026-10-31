"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatCents } from "@/lib/utils";
import type { Cart } from "@/types/cart";

export function CartItems({ cart }: { cart: Cart }) {
  const router = useRouter();
  const [pendingVariant, setPendingVariant] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const changeQuantity = async (variantId: string, quantity: number) => {
    if (pendingVariant) {
      return;
    }

    setPendingVariant(variantId);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: quantity <= 0 ? "remove" : "update",
          variantId,
          quantity: Math.max(0, quantity),
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update your cart");
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update your cart",
      );
    } finally {
      setPendingVariant(null);
    }
  };

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      ) : null}

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {cart.items.map((item) => {
          const maxQuantity = Math.max(
            1,
            item.stock === null ? 99 : Math.min(99, item.stock),
          );
          const pending = pendingVariant === item.variantId;

          return (
            <li key={item.id} className="flex gap-4 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                    >
                      {item.productTitle}
                    </Link>
                    {item.variantTitle && item.variantTitle !== "Default" ? (
                      <p className="text-xs text-zinc-500">
                        {item.variantTitle}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium">
                    {formatCents(item.lineTotalCents, item.currency)}
                  </p>
                </div>

                {!item.isActive ? (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    This item is no longer available. Remove it to continue.
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                  <label
                    htmlFor={`quantity-${item.variantId}`}
                    className="text-xs text-zinc-500"
                  >
                    Qty
                  </label>
                  <select
                    id={`quantity-${item.variantId}`}
                    value={item.quantity}
                    disabled={pending || !item.isActive}
                    onChange={(event) =>
                      changeQuantity(item.variantId, Number(event.target.value))
                    }
                    className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {Array.from({ length: maxQuantity }, (_, index) => index + 1).map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => changeQuantity(item.variantId, 0)}
                    disabled={pending}
                    className="text-xs text-zinc-500 underline underline-offset-2 hover:text-red-600 disabled:opacity-60 dark:hover:text-red-400"
                  >
                    {pending ? "Updating…" : "Remove"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
