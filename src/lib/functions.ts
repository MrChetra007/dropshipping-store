import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

type QueryValue = string | number | undefined;

export type EdgeFunctionOptions = {
  method?: "GET" | "POST";
  query?: Record<string, QueryValue>;
  body?: unknown;
  accessToken?: string;
  authorization?: string;
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

function functionUrl(
  name: string,
  query: Record<string, QueryValue> = {},
): URL {
  const url = new URL(
    `/functions/v1/${encodeURIComponent(name)}`,
    env.VITE_SUPABASE_URL,
  );

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function resolveAccessToken(explicitToken?: string): Promise<string> {
  if (explicitToken) {
    return explicitToken;
  }

  const { data } = await supabase.auth.getSession();

  // Edge functions verify the bearer JWT. Guests send the anon key; functions
  // that allow guest access treat anon as signed out.
  return data.session?.access_token ?? env.VITE_SUPABASE_ANON_KEY;
}

async function readError(response: Response, name: string): Promise<never> {
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

export async function callEdgeFunction<T>(
  name: string,
  options: EdgeFunctionOptions = {},
): Promise<T> {
  const url = functionUrl(name, options.query);
  const authorization =
    options.authorization ??
    `Bearer ${await resolveAccessToken(options.accessToken)}`;

  const headers: Record<string, string> = {
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: authorization,
    ...options.headers,
  };

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
    return readError(response, name);
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
