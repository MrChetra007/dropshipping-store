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

export type RawEdgeFunctionOptions = {
  query?: Record<string, QueryValue>;
  body: string;
  headers?: Record<string, string>;
  accessToken?: string;
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
    env.NEXT_PUBLIC_SUPABASE_URL,
  );

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function resolveAccessToken(
  explicitToken?: string,
): Promise<string> {
  if (explicitToken) {
    return explicitToken;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();

  // Supabase Edge Functions verify the bearer JWT by default. Guests have no
  // session, so send the anon key as the bearer token; the functions that allow
  // guest access derive the user from the token and treat anon as signed out.
  return data.session?.access_token ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
  const accessToken = await resolveAccessToken(options.accessToken);

  const headers: Record<string, string> = {
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
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

/**
 * Forward a body byte-for-byte. Used by the payment webhook route because
 * signature verification must run against the exact raw request body.
 */
export async function callEdgeFunctionRaw<T>(
  name: string,
  options: RawEdgeFunctionOptions,
): Promise<T> {
  const url = functionUrl(name, options.query);
  // Raw forwarding is server-to-server only (webhooks). It never needs the
  // caller's session, so use the anon key directly and avoid reading cookies.
  const accessToken = options.accessToken ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body,
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
