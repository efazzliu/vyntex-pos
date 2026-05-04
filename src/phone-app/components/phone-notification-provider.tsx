import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase.ts";
import { fetchMobileAdminLoginEventsForSession } from "@/lib/supabase-pos/phone-notify-ops.ts";
import {
  PhoneAdminLoginNotificationContextProvider,
  type PhoneAdminLoginNotificationContextValue,
} from "@/phone-app/hooks/use-phone-admin-login-notifications-context.tsx";

const STORAGE_KEY = "vyntex.phone.adminLogin.lastViewedAt";

function readLastViewedAt(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLastViewedAt(iso: string) {
  try {
    localStorage.setItem(STORAGE_KEY, iso);
  } catch {
    /* ignore */
  }
}

/** Unread = events newer than last open of the notifications screen, or last 7 days if never opened. */
function unreadCutoffMs(lastViewedAt: string | null): number {
  if (lastViewedAt) return new Date(lastViewedAt).getTime();
  return Date.now() - 7 * 24 * 60 * 60 * 1000;
}

const FRESH_LOGIN_MAX_AGE_MS = 120_000;

export function PhoneNotificationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("site");
  const queryClient = useQueryClient();
  const [lastViewedAt, setLastViewedAt] = useState<string | null>(() => readLastViewedAt());
  const firstEventsSyncDone = useRef(false);
  const lastAnnouncedEventId = useRef<string | null>(null);

  const announceAdminLoginToast = useCallback(
    (row: {
      id: string;
      restaurant_name: string;
      staff_name: string;
      is_device_admin: boolean;
    }) => {
      if (!row.id || lastAnnouncedEventId.current === row.id) return;
      lastAnnouncedEventId.current = row.id;
      const venue = row.restaurant_name.trim() || "—";
      const name = row.staff_name.trim() || "—";
      const device = row.is_device_admin;
      toast.info(t("phone.notifications.toastTitle"), {
        description: device
          ? t("phone.notifications.toastDescDevice", { venue, name })
          : t("phone.notifications.toastDescAdmin", { venue, name }),
        duration: 6_000,
      });
    },
    [t],
  );

  const query = useQuery({
    queryKey: ["phone", "mobileAdminLoginEvents"],
    queryFn: fetchMobileAdminLoginEventsForSession,
    staleTime: 10_000,
    /** Fallback kur Realtime nuk është i aktivizuar në Supabase (~15s). */
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("phone-mobile-admin-login")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mobile_admin_login_events" },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: ["phone", "mobileAdminLoginEvents"] });
          const row = payload.new as Record<string, unknown> | null;
          if (!row?.id) return;
          announceAdminLoginToast({
            id: String(row.id),
            restaurant_name: String(row.restaurant_name ?? ""),
            staff_name: String(row.staff_name ?? ""),
            is_device_admin: Boolean(row.is_device_admin),
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, announceAdminLoginToast]);

  const events = useMemo(() => query.data?.events ?? [], [query.data]);
  const ownedRestaurantCount = query.data?.ownedRestaurantCount ?? 0;

  /** Toast edhe pa Realtime: rifreskimi zbulon rresht të ri në krye (brenda ~2 min). */
  useEffect(() => {
    if (events.length === 0) return;
    const top = events[0];
    if (!firstEventsSyncDone.current) {
      firstEventsSyncDone.current = true;
      lastAnnouncedEventId.current = top.id;
      return;
    }
    if (lastAnnouncedEventId.current === top.id) return;
    const age = Date.now() - new Date(top.created_at).getTime();
    if (age > FRESH_LOGIN_MAX_AGE_MS) {
      lastAnnouncedEventId.current = top.id;
      return;
    }
    announceAdminLoginToast({
      id: top.id,
      restaurant_name: top.restaurant_name,
      staff_name: top.staff_name,
      is_device_admin: top.is_device_admin,
    });
  }, [events, announceAdminLoginToast]);

  const unreadCount = useMemo(() => {
    const cutoff = unreadCutoffMs(lastViewedAt);
    return events.filter((e) => new Date(e.created_at).getTime() > cutoff).length;
  }, [events, lastViewedAt]);

  const markNotificationsViewed = useCallback(() => {
    const iso = new Date().toISOString();
    writeLastViewedAt(iso);
    setLastViewedAt(iso);
  }, []);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["phone", "mobileAdminLoginEvents"] });
  }, [queryClient]);

  const value = useMemo<PhoneAdminLoginNotificationContextValue>(
    () => ({
      events,
      ownedRestaurantCount,
      unreadCount,
      loading: query.isLoading,
      error: query.isError,
      markNotificationsViewed,
      refresh,
    }),
    [
      events,
      ownedRestaurantCount,
      unreadCount,
      query.isLoading,
      query.isError,
      markNotificationsViewed,
      refresh,
    ],
  );

  return (
    <PhoneAdminLoginNotificationContextProvider value={value}>
      {children}
    </PhoneAdminLoginNotificationContextProvider>
  );
}
