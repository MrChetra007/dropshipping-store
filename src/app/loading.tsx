export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto w-full max-w-6xl px-6 py-12"
    >
      <div className="space-y-3">
        <div className="h-3.5 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-8 w-64 max-w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}
