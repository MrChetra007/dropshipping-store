import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

import type { Tables } from "@/types/database";

export type Profile = Tables<"profiles">;

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
