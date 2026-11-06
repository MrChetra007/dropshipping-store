import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  errorMessage,
  importCjProducts,
} from "@/features/admin/admin-api";

export function ImportSingleForm({ pid }: { pid: string }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<{
    productId: string;
    title: string;
  } | null>(null);
  const [skippedReason, setSkippedReason] = useState<string | null>(null);
  const [failedError, setFailedError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setImported(null);
    setSkippedReason(null);
    setFailedError(null);
    setPending(true);

    try {
      const result = await importCjProducts([pid]);

      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      setImported(result.imported[0] ?? null);
      setSkippedReason(result.skipped[0]?.reason ?? null);
      setFailedError(result.failed[0]?.error ?? null);
    } catch (submitError) {
      setError(errorMessage(submitError));
    }

    setPending(false);
  }

  const done = Boolean(imported) || Boolean(skippedReason);

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      {imported ? (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        >
          Imported as draft.{" "}
          <Link
            to={`/admin/products/${imported.productId}`}
            className="font-medium underline"
          >
            Edit product
          </Link>
        </p>
      ) : null}

      {skippedReason ? (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        >
          {skippedReason}
        </p>
      ) : null}

      {failedError ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {failedError}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={() => {
          void handleClick();
        }}
        loading={pending}
        loadingLabel="Importing…"
        disabled={done}
        className="w-full"
      >
        {imported ? "Imported" : "Import this product"}
      </Button>
    </div>
  );
}
