import { Spinner } from "@/components/ui/spinner";

export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center gap-3 px-6 py-20 text-sm text-zinc-500">
      <Spinner label={label} />
      <span>{label}</span>
    </main>
  );
}
