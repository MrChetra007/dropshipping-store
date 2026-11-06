import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  AuthContext,
  type AuthContextValue,
  type Profile,
} from "@/features/auth/auth-context";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }

      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const userId = user?.id;

  const { data: profile = null, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) {
        return null;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle<Profile>();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile: userId ? profile : null,
      loading,
      profileLoading: Boolean(userId) && profileLoading,
    }),
    [loading, profile, profileLoading, session, user, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
