export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading admin page" className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-16 animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}
