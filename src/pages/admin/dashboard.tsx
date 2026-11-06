import { useQuery } from "@tanstack/react-query";

import { getAdminSession } from "@/features/admin/admin-api";
import { usePageMetadata } from "@/lib/metadata";

export function AdminDashboardPage() {
  const sessionQuery = useQuery({
    queryKey: ["admin", "session"],
    queryFn: getAdminSession,
  });

  usePageMetadata({
    title: "Admin dashboard | KinetiCore Labs",
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Admin access is working. Sales, profit, and fulfillment widgets arrive
          in a later step.
        </p>
      </div>

      {sessionQuery.isLoading ? (
        <div className="h-[76px] animate-pulse rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
      ) : sessionQuery.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Edge Function check failed</p>
          <p className="mt-1">
            {sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : "Unknown error"}
          </p>
        </div>
      ) : sessionQuery.data ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <p className="font-medium">Edge Functions connected</p>
          <p className="mt-1">
            Verified admin session for{" "}
            {sessionQuery.data.user.email ?? sessionQuery.data.user.id}.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Orders today", value: "—" },
          { label: "Revenue (7 days)", value: "—" },
          { label: "CJ balance reserve", value: "—" },
          { label: "Failed CJ orders", value: "—" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
