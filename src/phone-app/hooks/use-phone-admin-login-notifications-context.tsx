import { createContext, useContext, type ReactNode } from "react";
import type { MobileAdminLoginEventRow } from "@/lib/supabase-pos/phone-notify-ops.ts";

export type PhoneAdminLoginNotificationContextValue = {
  events: MobileAdminLoginEventRow[];
  /** Restaurants this account owns (same Supabase session). If 0, notification list is always empty. */
  ownedRestaurantCount: number;
  unreadCount: number;
  loading: boolean;
  error: boolean;
  markNotificationsViewed: () => void;
  refresh: () => Promise<void>;
};

export const PhoneAdminLoginNotificationContext =
  createContext<PhoneAdminLoginNotificationContextValue | null>(null);

export function usePhoneAdminLoginNotifications(): PhoneAdminLoginNotificationContextValue {
  const ctx = useContext(PhoneAdminLoginNotificationContext);
  if (!ctx) {
    throw new Error("usePhoneAdminLoginNotifications must be used inside PhoneNotificationProvider");
  }
  return ctx;
}

/** @internal */
export function PhoneAdminLoginNotificationContextProvider({
  value,
  children,
}: {
  value: PhoneAdminLoginNotificationContextValue;
  children: ReactNode;
}) {
  return (
    <PhoneAdminLoginNotificationContext.Provider value={value}>
      {children}
    </PhoneAdminLoginNotificationContext.Provider>
  );
}
