import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  markAllNotificationsRead,
  markNotificationRead,
  relativeTime,
  unreadCount,
  useAdminNotificationRealtime,
  useAdminNotifications,
  type AdminNotification,
} from "@/features/admin/notifications";

const typeColors: Record<AdminNotification["type"], string> = {
  order_created:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  order_paid:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  fulfillment_failed:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

const typeLabels: Record<AdminNotification["type"], string> = {
  order_created: "New order",
  order_paid: "Paid",
  fulfillment_failed: "Failed",
};

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const notificationsQuery = useAdminNotifications();

  useAdminNotificationRealtime();

  const notifications = notificationsQuery.data ?? [];
  const unread = unreadCount(notifications);

  async function handleItemClick(notification: AdminNotification) {
    if (!notification.read_at) {
      await markNotificationRead(notification.id);
    }

    setOpen(false);

    if (notification.order_id) {
      navigate(`/admin/orders/${notification.order_id}`);
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          unread === 0
            ? "Notifications"
            : `${unread} unread notification${unread === 1 ? "" : "s"}`
        }
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-2 w-96 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
              <p className="text-sm font-medium">Notifications</p>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleMarkAllRead();
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            {notificationsQuery.isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">
                Loading…
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">
                No notifications yet.
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => {
                        void handleItemClick(notification);
                      }}
                      className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                        notification.read_at ? "" : "bg-zinc-50/60 dark:bg-zinc-900/40"
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {notification.title}
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            typeColors[notification.type]
                          }`}
                        >
                          {typeLabels[notification.type]}
                        </span>
                      </span>
                      {notification.body ? (
                        <span className="w-full truncate text-xs text-zinc-500">
                          {notification.body}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-zinc-400">
                        {relativeTime(notification.created_at)}
                        {notification.read_at ? "" : " · unread"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
