import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

type StoreSettings = {
  name?: string;
  currency?: string;
  support_email?: string;
};

async function StoreSettingsPanel() {
  await connection();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "public.store")
    .maybeSingle();

  if (error) {
    return (
      <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not read settings: {error.message}
      </p>
    );
  }

  if (!data) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        No <code>public.store</code> setting found. Run <code>schema.sql</code> in
        your Supabase SQL editor.
      </p>
    );
  }

  const store = data.value as unknown as StoreSettings;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt className="text-zinc-500">Store</dt>
      <dd className="font-medium">{store.name ?? "—"}</dd>
      <dt className="text-zinc-500">Currency</dt>
      <dd className="font-medium">{store.currency ?? "—"}</dd>
      <dt className="text-zinc-500">Support</dt>
      <dd className="font-medium">{store.support_email ?? "—"}</dd>
    </dl>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Storefront setup
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        CJ Dropshipping Store
      </h1>
      <p className="text-zinc-600">
        Browse imported products. Admin tools can import from the CJ catalog and
        publish products to the storefront.
      </p>
      <Link
        href="/products"
        className="inline-flex h-11 w-fit items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Browse products
      </Link>
      <Suspense
        fallback={<p className="text-sm text-zinc-500">Loading store settings…</p>}
      >
        <StoreSettingsPanel />
      </Suspense>
    </main>
  );
}
