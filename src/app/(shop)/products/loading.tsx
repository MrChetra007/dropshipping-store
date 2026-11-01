export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading products"
      className="mx-auto w-full max-w-6xl px-6 py-12"
    >
      <div className="space-y-3">
        <div className="h-3.5 w-32 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-8 w-56 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>

      <div className="mt-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-9 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900"
          />
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="aspect-square animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
