import { HttpError } from "./http.ts";
import { createAdminClient, createUserClient } from "./supabase.ts";

export type AdminUser = {
  id: string;
  email: string | null;
  role: "admin";
};

export async function requireAdmin(request: Request): Promise<AdminUser> {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
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

