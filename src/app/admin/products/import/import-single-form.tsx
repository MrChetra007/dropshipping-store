"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  importCjProducts,
  type ImportProductsState,
} from "@/lib/admin-products-actions";

const initialState: ImportProductsState = {};

export function ImportSingleForm({ pid }: { pid: string }) {
  const [state, formAction, pending] = useActionState(
    importCjProducts,
    initialState,
  );

  const imported = state.result?.imported[0];
  const skipped = state.result?.skipped[0];
  const failed = state.result?.failed[0];

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="pids" value={pid} />

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      {imported ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Imported as draft.{" "}
          <Link
            href={`/admin/products/${imported.productId}`}
            className="font-medium underline"
          >
            Edit product
          </Link>
        </p>
      ) : null}

      {skipped ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {skipped.reason}
        </p>
      ) : null}

      {failed ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {failed.error}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || Boolean(imported) || Boolean(skipped)}
        className="w-full"
      >
        {pending ? "Importing…" : imported ? "Imported" : "Import this product"}
      </Button>
    </form>
  );
}
