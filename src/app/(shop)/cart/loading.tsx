export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading cart"
      className="mx-auto w-full max-w-5xl px-6 py-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex gap-4 p-4">
              <div className="h-20 w-20 shrink-0 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
                <div className="h-8 w-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
            />
          ))}
          <div className="h-11 w-full animate-pulse rounded-lg bg-zinc-300 dark:bg-zinc-700" />
        </div>
      </div>
    </div>
  );
}
