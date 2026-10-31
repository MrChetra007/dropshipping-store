import { HttpError } from "./http.ts";
import { createAdminClient, createUserClient } from "./supabase.ts";

export type AdminUser = {
  id: string;
  email: string | null;
  role: "admin";
};

/**
 * Cheap check for a user access token. The anon/service keys are also JWTs (or
 * opaque keys) but have no `sub` claim, so skip the network call for them. The
 * signature is still verified by `auth.getUser()` below.
 */
export function hasUserSubject(authorization: string | null): boolean {
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const parts = authorization.slice("Bearer ".length).trim().split(".");

  if (parts.length !== 3) {
    return false;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(atob(padded)) as { sub?: unknown };

    return typeof payload.sub === "string" && payload.sub.length > 0;
  } catch {
    return false;
  }
}

export async function requireAdmin(request: Request): Promise<AdminUser> {
  const authorization = request.headers.get("Authorization");

  if (!authorization || !hasUserSubject(authorization)) {
    throw new HttpError(401, "Missing bearer token");
  }

  const userClient = createUserClient(authorization);
  const { data, error } = await userClient.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "Invalid session");
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new HttpError(500, "Could not verify admin role");
  }

  if (profile?.role !== "admin") {
    throw new HttpError(403, "Admin access required");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: "admin",
  };
}

