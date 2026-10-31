"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PriceTag } from "@/components/shop/price-tag";
import { cn } from "@/lib/utils";

export type PickerVariant = {
  id: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  stock: number | null;
};

function isAvailable(variant: PickerVariant): boolean {
  return variant.stock === null || variant.stock > 0;
}

export function VariantPicker({
  variants,
}: {
  variants: PickerVariant[];
}) {
  const initial = variants.find(isAvailable) ?? variants[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selected = variants.find((variant) => variant.id === selectedId) ?? initial;

  const optionGroups = useMemo(() => {
    const groups = new Map<string, string[]>();

    for (const variant of variants) {
      for (const [name, value] of Object.entries(variant.options)) {
        const values = groups.get(name) ?? [];

        if (!values.includes(value)) {
          values.push(value);
        }

        groups.set(name, values);
      }
    }

    return [...groups.entries()].map(([name, values]) => ({ name, values }));
  }, [variants]);

  if (!selected) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        This product is currently unavailable.
      </p>
    );
  }

  const available = isAvailable(selected);
  const maxQuantity = Math.max(
    1,
    selected.stock === null ? 10 : Math.min(10, selected.stock),
  );

  const selectVariant = (id: string) => {
    setSelectedId(id);
    setStatus("idle");
    setErrorMessage(null);
    setQuantity(1);
  };

  const addToCart = async () => {
    if (!available || status === "adding") {
      return;
    }

    setStatus("adding");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          variantId: selected.id,
          quantity,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not add this item to your cart");
      }

      setStatus("added");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Could not add this item",
      );
    }
  };

  const matches = (options: Record<string, string>) =>
    variants.filter((variant) =>
      Object.entries(options).every(
        ([name, value]) => variant.options[name] === value,
      ),
    );

  const chooseOption = (name: string, value: string) => {
    const desired = { ...selected.options, [name]: value };
    const candidates = matches(desired);
    const next = candidates.find(isAvailable) ?? candidates[0];

    if (next) {
      selectVariant(next.id);
    }
  };

  const optionAvailable = (name: string, value: string) => {
    const desired = { ...selected.options, [name]: value };
    return matches(desired).some(isAvailable);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <PriceTag
          priceCents={selected.priceCents}
          compareAtCents={selected.compareAtCents}
          currency={selected.currency}
          className="text-2xl"
        />
        <p
          className={cn(
            "text-sm font-medium",
            available
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400",
          )}
        >
          {available
            ? selected.stock === null
              ? "In stock"
              : `In stock · ${selected.stock} available`
            : "Out of stock"}
        </p>
        {selected.sku ? (
          <p className="font-mono text-xs text-zinc-500">SKU {selected.sku}</p>
        ) : null}
      </div>

      {optionGroups.length > 0 ? (
        <div className="space-y-4">
          {optionGroups.map((group) => (
            <div key={group.name} className="space-y-2">
              <p className="text-sm font-medium">{group.name}</p>
              <div className="flex flex-wrap gap-2">
                {group.values.map((value) => {
                  const isSelected = selected.options[group.name] === value;
                  const canSelect = optionAvailable(group.name, value);

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => chooseOption(group.name, value)}
                      disabled={!canSelect}
                      aria-pressed={isSelected}
                      className={cn(
                        "inline-flex h-9 items-center rounded-lg border px-3 text-sm transition-colors",
                        isSelected
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900",
                        !canSelect && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : variants.length > 1 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Options</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const isSelected = variant.id === selected.id;
              const canSelect = isAvailable(variant);

              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => selectVariant(variant.id)}
                  disabled={!canSelect}
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex h-9 items-center rounded-lg border px-3 text-sm transition-colors",
                    isSelected
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900",
                    !canSelect && "cursor-not-allowed opacity-40",
                  )}
                >
                  {variant.title}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">{selected.title}</p>
      )}

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="inline-flex h-11 items-center rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={!available || quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-full w-10 items-center justify-center text-lg text-zinc-600 transition-colors hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              −
            </button>
            <span
              aria-live="polite"
              className="w-8 text-center text-sm tabular-nums"
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() =>
                setQuantity((current) => Math.min(maxQuantity, current + 1))
              }
              disabled={!available || quantity >= maxQuantity}
              aria-label="Increase quantity"
              className="flex h-full w-10 items-center justify-center text-lg text-zinc-600 transition-colors hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={!available || status === "adding"}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {status === "adding"
              ? "Adding…"
              : available
                ? "Add to cart"
                : "Out of stock"}
          </button>
        </div>
        {status === "added" ? (
          <p
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          >
            Added to cart.{" "}
            <Link href="/cart" className="underline underline-offset-2">
              View cart
            </Link>
          </p>
        ) : null}
        {status === "error" && errorMessage ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
