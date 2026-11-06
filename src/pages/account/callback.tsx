import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { PageSpinner } from "@/components/ui/page-spinner";
import { safeNext } from "@/features/auth/auth-utils";
import { supabase } from "@/lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");
  const error = errorDescription ?? exchangeError;
  const next = safeNext(searchParams.get("next"));

  useEffect(() => {
    if (errorDescription) {
      return;
    }

    let active = true;

    async function finish() {
      if (code) {
        const { error: codeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (codeError) {
          if (active) {
            setExchangeError(codeError.message);
          }

          return;
        }
      }

      if (active) {
        navigate(next, { replace: true });
      }
    }

    void finish();

    return () => {
      active = false;
    };
  }, [code, errorDescription, navigate, next]);

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          Could not sign you in
        </h1>
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
        <Link
          to="/login"
          className="font-medium text-zinc-900 underline dark:text-zinc-100"
        >
          Back to login
        </Link>
      </main>
    );
  }

  return <PageSpinner label="Signing you in…" />;
}
