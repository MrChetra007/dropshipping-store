import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { signOut } from "@/features/auth/auth-actions";

export function AccountPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [pending, setPending] = useState(false);

  if (!user) {
    return null;
  }

  async function handleLogout() {
    setPending(true);

    try {
      await signOut();
      navigate("/login", { replace: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {user.email}
        </p>
      </div>

      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 rounded-lg border border-zinc-200 p-5 text-sm dark:border-zinc-800">
        <dt className="text-zinc-500">Name</dt>
        <dd className="font-medium">{profile?.full_name || "—"}</dd>
        <dt className="text-zinc-500">Email</dt>
        <dd className="font-medium">{user.email}</dd>
        <dt className="text-zinc-500">Phone</dt>
        <dd className="font-medium">{profile?.phone || "—"}</dd>
        <dt className="text-zinc-500">Role</dt>
        <dd className="font-medium capitalize">
          {profile?.role ?? "customer"}
        </dd>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        {profile?.role === "admin" ? (
          <Link
            to="/admin"
            className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 px-5 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Admin dashboard
          </Link>
        ) : null}
        <Button
          type="button"
          loading={pending}
          loadingLabel="Logging out…"
          onClick={handleLogout}
          className="bg-transparent text-zinc-900 hover:bg-zinc-100 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Log out
        </Button>
      </div>
    </main>
  );
}
