import { useSearchParams } from "react-router-dom";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { Shield, User, Bell, SlidersHorizontal } from "lucide-react";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { DashboardSecuritySection } from "@/pages/dashboard/settings/_components/dashboard-security-section.tsx";
import { DashboardNotificationsSection } from "@/pages/dashboard/settings/_components/dashboard-notifications-section.tsx";
import { DashboardAppearanceSection } from "@/pages/dashboard/settings/_components/dashboard-appearance-section.tsx";
import { DashboardAccountSection } from "@/pages/dashboard/settings/_components/dashboard-account-section.tsx";
import { AdminPage } from "@/pages/dashboard/_components/admin-center-ui.tsx";

const SETTINGS_TABS = ["account", "security", "notifications", "preferences"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function resolveTab(v: string | null): SettingsTab {
  if (v === "appearance" || v === "preferences") return "preferences";
  if (v === "security") return "security";
  if (v === "notifications") return "notifications";
  return "account";
}

const TAB_META: Record<SettingsTab, { labelKey: string; Icon: typeof User }> = {
  account: { labelKey: "ac.nav.profile", Icon: User },
  security: { labelKey: "ac.nav.security", Icon: Shield },
  notifications: { labelKey: "ac.nav.notifications", Icon: Bell },
  preferences: { labelKey: "ac.nav.preferences", Icon: SlidersHorizontal },
};

export default function DashboardSettingsModern() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { restaurant, refresh: refreshRestaurant } = useDashboardRestaurant();
  const { t } = useDashboardLocale();

  const activeTab = resolveTab(searchParams.get("tab"));
  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  if (restaurant === undefined) {
    return (
      <AdminPage className="space-y-6">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-80 rounded-2xl" />
      </AdminPage>
    );
  }

  const hasRestaurant = restaurant !== null;

  return (
    <AdminPage className="space-y-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
              {t("ac.nav.account")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {t("settings.title")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{t("ac.settings.subtitle")}</p>
          </div>
        </div>
        <nav
          className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200"
          aria-label={t("settings.sections_aria")}
        >
          {SETTINGS_TABS.map((id) => {
            const { labelKey, Icon } = TAB_META[id];
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-0.5 text-sm font-medium transition-colors",
                  active ? "text-slate-900" : "text-slate-500 hover:text-slate-700",
                )}
              >
                <Icon className={cn("size-4", active ? "text-indigo-600" : "opacity-70")} />
                {t(labelKey)}
                {active ? (
                  <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-indigo-500" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
      {activeTab === "account" ? (
        <DashboardAccountSection
          hasRestaurant={hasRestaurant}
          restaurantName={restaurant?.name}
          onVenueLinked={() => void refreshRestaurant()}
        />
      ) : null}
      {activeTab === "security" ? <DashboardSecuritySection /> : null}
      {activeTab === "notifications" ? <DashboardNotificationsSection /> : null}
      {activeTab === "preferences" ? <DashboardAppearanceSection /> : null}
    </AdminPage>
  );
}
