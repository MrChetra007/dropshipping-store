import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  errorMessage,
  importCjProducts,
} from "@/features/admin/admin-api";
import type { AdminImportResult } from "@/types/admin";

export function ImportSelectionForm({
  children,
  count,
}: {
  children: ReactNode;
  count: number;
}) {
  const queryClient = useQueryClient();
  const [selectedCount, setSelectedCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminImportResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);

    try {
      const data = await importCjProducts(formData.getAll("pids"));

      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      setResult(data);
    } catch (submitError) {
      setError(errorMessage(submitError));
    }

    setPending(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
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

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {result.imported.length > 0 ? (
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Imported {result.imported.length} product
              {result.imported.length === 1 ? "" : "s"} as draft.
            </p>
          ) : null}

          {result.skipped.length > 0 ? (
            <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
              {result.skipped.map((item) => (
                <li key={item.pid}>
                  Skipped {item.pid}: {item.reason}
                </li>
              ))}
            </ul>
          ) : null}

          {result.failed.length > 0 ? (
            <ul className="space-y-1 text-red-600 dark:text-red-400">
              {result.failed.map((item) => (
                <li key={item.pid}>
                  Failed {item.pid}: {item.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-white/95 py-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <Button
          type="submit"
          loading={pending}
          loadingLabel="Importing…"
          disabled={selectedCount === 0}
        >
          Import selected
        </Button>
        <span className="text-sm text-zinc-500">
          {selectedCount} of {count} selected. Select up to 20 per import.
        </span>
      </div>
    </form>
  );
}
