import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { PageSpinner } from "@/components/ui/page-spinner";
import { useAuth } from "@/features/auth/auth-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageSpinner label="Checking your session…" />;
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;

    return (
      <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
    );
  }

  return children;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading || (user && profileLoading)) {
    return <PageSpinner label="Checking your permissions…" />;
  }

  if (!user) {
    return <Navigate to="/login?next=%2Fadmin" replace />;
  }

  if (profile?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
