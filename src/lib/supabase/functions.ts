import "server-only";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type QueryValue = string | number | undefined;

export type EdgeFunctionOptions = {
  method?: "GET" | "POST";
  query?: Record<string, QueryValue>;
  body?: unknown;
  accessToken?: string;
  headers?: Record<string, string>;
};

export class EdgeFunctionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EdgeFunctionError";
    this.status = status;
  }
}

export async function callEdgeFunction<T>(
  name: string,
  options: EdgeFunctionOptions = {},
): Promise<T> {
  const url = new URL(
    `/functions/v1/${encodeURIComponent(name)}`,
    env.NEXT_PUBLIC_SUPABASE_URL,
  );

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  let accessToken = options.accessToken;

  if (!accessToken) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  }

  const headers: Record<string, string> = {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ...options.headers,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Edge function "${name}" failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Non-JSON error response.
    }

    throw new EdgeFunctionError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function callAdminApi<T>(
  action: string,
  options: Omit<EdgeFunctionOptions, "query"> & {
    query?: Record<string, QueryValue>;
  } = {},
): Promise<T> {
  return callEdgeFunction<T>("admin-api", {
    ...options,
    query: { ...options.query, action },
  });
}
