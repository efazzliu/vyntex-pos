import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronLeft, PackageX, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { usePhoneManagerSession } from "@/lib/supabase-pos/phone-manager-session.ts";
import { getStockItems } from "@/lib/supabase-pos/stock-ops.ts";
import { usePhoneAdminLoginNotifications } from "@/phone-app/hooks/use-phone-admin-login-notifications-context.tsx";
import { cn } from "@/lib/utils.ts";

const LOW_STOCK_NOTIFICATIONS_KEY = "vyntex_phone_low_stock_notifications";

export default function PhoneNotificationsPage() {
  const { t, i18n } = useTranslation("site");
  const { restaurant } = useDashboardRestaurant();
  const isPhoneManager = usePhoneManagerSession() === true;
  const {
    events,
    ownedRestaurantCount,
    loading: eventsLoading,
    error: eventsError,
    markNotificationsViewed,
  } = usePhoneAdminLoginNotifications();
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(LOW_STOCK_NOTIFICATIONS_KEY) !== "off";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<
    Array<{ id: string; name: string; categoryName: string; isOutOfStock: boolean }>
  >([]);

  const loadLowStock = useCallback(async () => {
    if (!restaurant?.licenseKey || !enabled) {
      setLowStockItems([]);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const rows = await getStockItems(restaurant.licenseKey);
      setLowStockItems(
        rows
          .filter((item) => item.isLowStock || item.isOutOfStock)
          .map((item) => ({
            id: item._id,
            name: item.name,
            categoryName: item.categoryName,
            isOutOfStock: item.isOutOfStock,
          })),
      );
    } catch {
      setError(true);
      setLowStockItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, restaurant?.licenseKey]);

  useEffect(() => {
    if (!isPhoneManager) {
      markNotificationsViewed();
    }
  }, [isPhoneManager, markNotificationsViewed]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOW_STOCK_NOTIFICATIONS_KEY, enabled ? "on" : "off");
    }
  }, [enabled]);

  useEffect(() => {
    void loadLowStock();
  }, [loadLowStock]);

  const lowCount = useMemo(() => lowStockItems.length, [lowStockItems]);
  const dateFmt = new Intl.DateTimeFormat(
    i18n.language.startsWith("sq") ? "sq-AL" : undefined,
    { dateStyle: "medium", timeStyle: "short" },
  );

  return (
    <div className="flex min-h-full flex-col bg-transparent">
      <header
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3",
          "pt-[max(0.5rem,env(safe-area-inset-top))]",
        )}
      >
        <Link
          to="/app/profile"
          className="flex size-10 items-center justify-center rounded-xl text-slate-700 hover:bg-[#0066FF]/10"
          aria-label={t("phone.notifications.backProfile")}
        >
          <ChevronLeft className="size-6" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">{t("phone.notifications.title")}</h1>
          <p className="text-xs text-slate-500">
            {isPhoneManager ? t("phone.notifications.subtitle") : t("phone.notifications.subtitleAdmin")}
          </p>
        </div>
      </header>

      <div className="flex-1 px-4 py-4">
        {isPhoneManager ? (
          <>
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {t("phone.notifications.lowStockToggleTitle")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{t("phone.notifications.lowStockToggleBody")}</p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(next) => setEnabled(Boolean(next))}
                  aria-label={t("phone.notifications.lowStockToggleTitle")}
                />
              </div>
            </div>

            {!enabled ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
                <PackageX className="size-10 text-slate-300" strokeWidth={1.5} />
                <p className="text-sm text-slate-600">{t("phone.notifications.disabledState")}</p>
              </div>
            ) : null}

            {enabled && loading ? (
              <p className="text-center text-sm text-slate-500">{t("phone.notifications.loading")}</p>
            ) : null}
            {enabled && error ? (
              <p className="text-center text-sm text-red-600">{t("phone.notifications.loadError")}</p>
            ) : null}
            {enabled && !loading && !error && lowCount === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
                <AlertTriangle className="size-10 text-slate-300" strokeWidth={1.5} />
                <p className="text-sm text-slate-600">{t("phone.notifications.emptyLowStock")}</p>
              </div>
            ) : null}

            {enabled && lowCount > 0 ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("phone.notifications.lowStockCount", { count: lowCount })}
              </p>
            ) : null}
            <ul className="flex flex-col gap-2">
              {lowStockItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
                >
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {item.isOutOfStock
                      ? t("phone.notifications.itemOutOfStock")
                      : t("phone.notifications.itemLowStock")}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{item.categoryName}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {eventsLoading && events.length === 0 ? (
              <p className="text-center text-sm text-slate-500">{t("phone.notifications.loading")}</p>
            ) : null}
            {eventsError && events.length === 0 ? (
              <p className="text-center text-sm text-red-600">{t("phone.notifications.loadError")}</p>
            ) : null}
            {!eventsLoading && !eventsError && events.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
                <Shield className="size-10 text-slate-300" strokeWidth={1.5} />
                {ownedRestaurantCount === 0 ? (
                  <>
                    <p className="text-sm font-medium text-slate-800">{t("phone.notifications.emptyNoVenuesTitle")}</p>
                    <p className="text-sm text-slate-600">{t("phone.notifications.emptyNoVenuesBody")}</p>
                    <Link
                      to="/app"
                      className="mt-1 text-sm font-semibold text-violet-700 underline-offset-2 hover:underline"
                    >
                      {t("phone.notifications.emptyNoVenuesCta")}
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">{t("phone.notifications.empty")}</p>
                    <p className="text-xs leading-relaxed text-slate-500">{t("phone.notifications.emptyHintTech")}</p>
                  </>
                )}
              </div>
            ) : null}

            <ul className="flex flex-col gap-2">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
                >
                  <p className="font-bold text-slate-900">{e.restaurant_name}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {e.is_device_admin
                      ? t("phone.notifications.lineDeviceAdmin", { name: e.staff_name })
                      : t("phone.notifications.lineAdmin", { name: e.staff_name })}
                  </p>
                  <p className="mt-2 text-xs tabular-nums text-slate-500">
                    {dateFmt.format(new Date(e.created_at))}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
