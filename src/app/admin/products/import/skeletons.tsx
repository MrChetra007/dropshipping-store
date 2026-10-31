import Link from "next/link";

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`}
    />
  );
}

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-start gap-4 border-b border-zinc-200 p-4 last:border-b-0 dark:border-zinc-800"
          >
            <Skeleton className="mt-1 h-4 w-4 shrink-0" />
            <Skeleton className="h-20 w-20 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-14 shrink-0" />
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-zinc-200 bg-white/95 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <Skeleton className="h-11 w-36" />
        <Skeleton className="h-4 w-44" />
      </div>
    </div>
  );
}

export function PreviewSkeleton({ closeHref }: { closeHref: string }) {
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
        aria-busy="true"
        className="relative z-10 mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5 dark:border-zinc-800">
          <div className="w-full max-w-xl space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-3/4" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-16 shrink-0" />
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <div className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-16 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-11 w-full sm:w-64" />
        </div>
      </div>
    </div>
  );
}

export function ImportPageSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 min-w-0 flex-1" />
        <Skeleton className="h-11 w-24" />
      </div>

      <SearchResultsSkeleton />
    </div>
  );
}
