import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-20">
      <p className="text-sm font-medium text-zinc-500">404</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        The page you are looking for does not exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Back home
      </Link>
    </main>
  );
}
