import type { Metadata } from "next";
import { connection } from "next/server";

import { callAdminApi } from "@/lib/supabase/functions";

export const instant = false;

export const metadata: Metadata = {
  title: "Admin dashboard | CJ Dropshipping Store",
};

type SessionResponse = {
  user: {
    id: string;
    email: string | null;
    role: string;
  };
};

async function BackendStatus() {
  await connection();

  let identity: string | null = null;
  let errorMessage: string | null = null;

  try {
    const { user } = await callAdminApi<SessionResponse>("session");
    identity = user.email ?? user.id;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  if (errorMessage) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        <p className="font-medium">Edge Function check failed</p>
        <p className="mt-1">{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
      <p className="font-medium">Edge Functions connected</p>
      <p className="mt-1">Verified admin session for {identity}.</p>
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Admin access is working. Sales, profit, and fulfillment widgets arrive
          in a later step.
        </p>
      </div>

      <BackendStatus />

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
