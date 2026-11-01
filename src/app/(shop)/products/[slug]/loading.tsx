export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading product"
      className="mx-auto w-full max-w-6xl px-6 py-12"
    >
      <div className="h-3.5 w-64 max-w-full animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />

      <div className="mt-6 grid gap-12 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-square animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-16 w-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-9 w-3/4 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-7 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
