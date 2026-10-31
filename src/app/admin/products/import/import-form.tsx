"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  importCjProducts,
  type ImportProductsState,
} from "@/lib/admin-products-actions";

const initialState: ImportProductsState = {};

export function ImportSelectionForm({
  children,
  count,
}: {
  children: ReactNode;
  count: number;
}) {
  const [state, formAction, pending] = useActionState(
    importCjProducts,
    initialState,
  );
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <form
      action={formAction}
      className="space-y-4"
      onChange={(event) => {
        setSelectedCount(
          event.currentTarget.querySelectorAll<HTMLInputElement>(
            'input[name="pids"]:checked',
          ).length,
        );
      }}
    >
      {children}

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      {state.result ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {state.result.imported.length > 0 ? (
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-300">
                Imported {state.result.imported.length} product
                {state.result.imported.length === 1 ? "" : "s"} as draft.
              </p>
              <ul className="mt-2 space-y-1">
                {state.result.imported.map((item) => (
                  <li key={item.pid}>
                    <Link
                      href={`/admin/products/${item.productId}`}
                      className="text-zinc-900 underline dark:text-zinc-100"
                    >
                      {item.title}
                    </Link>{" "}
                    <span className="text-zinc-500">
                      ({item.variantCount} variant
                      {item.variantCount === 1 ? "" : "s"})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.result.skipped.length > 0 ? (
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-300">
                Skipped
              </p>
              <ul className="mt-1 space-y-1 text-zinc-600 dark:text-zinc-400">
                {state.result.skipped.map((item) => (
                  <li key={item.pid}>
                    {item.pid}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.result.failed.length > 0 ? (
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">
                Failed
              </p>
              <ul className="mt-1 space-y-1 text-zinc-600 dark:text-zinc-400">
                {state.result.failed.map((item) => (
                  <li key={item.pid}>
                    {item.pid}: {item.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-white/95 py-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <Button type="submit" disabled={pending || selectedCount === 0}>
          {pending ? "Importing…" : "Import selected"}
        </Button>
        <span className="text-sm text-zinc-500">
          {selectedCount} of {count} selected. Select up to 20 per import.
        </span>
      </div>
    </form>
  );
}
