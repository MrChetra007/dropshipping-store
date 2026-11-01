export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading order"
      className="mx-auto w-full max-w-5xl px-6 py-12"
    >
      <div className="space-y-3">
        <div className="h-3.5 w-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="h-8 w-56 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="h-48 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
      </div>
    </div>
  );
}
