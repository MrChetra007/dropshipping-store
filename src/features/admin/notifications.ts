import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/lib/supabase";

export type AdminNotification = {
  id: string;
  order_id: string | null;
  order_number: string;
  type: "order_created" | "order_paid" | "fulfillment_failed";
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listAdminNotifications(): Promise<AdminNotification[]> {
  const { data, error } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AdminNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

/** Re-fetches the list whenever a new notification row is pushed. */
export function useAdminNotificationRealtime(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_notifications" },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["admin", "notifications"],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function useAdminNotifications() {
  return useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: listAdminNotifications,
  });
}

export function unreadCount(notifications: AdminNotification[]): number {
  return notifications.filter((notification) => !notification.read_at).length;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}
