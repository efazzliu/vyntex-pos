import { Link, useSearchParams } from "react-router-dom";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import {
  LayoutDashboard,
  Shield,
  User,
  Bell,
  Palette,
  CreditCard as CreditCardIcon,
} from "lucide-react";
import { DashboardSecuritySection } from "./_components/dashboard-security-section.tsx";
import { DashboardBillingSection } from "./_components/dashboard-billing-section.tsx";
import { DashboardNotificationsSection } from "./_components/dashboard-notifications-section.tsx";
import { DashboardAppearanceSection } from "./_components/dashboard-appearance-section.tsx";
import { DashboardAccountSection } from "./_components/dashboard-account-section.tsx";

const SETTINGS_TABS = ["account", "security", "billing", "notifications", "appearance"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function isSettingsTab(v: string | null): v is SettingsTab {
  return SETTINGS_TABS.includes(v as SettingsTab);
}

const TAB_META: Record<SettingsTab, { label: string; Icon: typeof User }> = {
  account: { label: "Account", Icon: User },
  security: { label: "Security", Icon: Shield },
  billing: { label: "Billing", Icon: CreditCardIcon },
  notifications: { label: "Notifications", Icon: Bell },
  appearance: { label: "Appearance", Icon: Palette },
};

const billingCheckoutUrl = import.meta.env.VITE_BILLING_CHECKOUT_URL as string | undefined;

export default function DashboardSettingsModern() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { restaurant, refresh: refreshRestaurant } = useDashboardRestaurant();
  const { isAdmin } = useUserRole();

  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : "account";
  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  if (restaurant === undefined) {
    return (
      <div className="w-full min-w-0 space-y-6 px-4 pb-12 pt-14 sm:px-5 sm:pt-16 md:px-6 lg:px-8 lg:pt-20 xl:px-10 2xl:px-12">
        <Skeleton className="h-9 w-36 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <Skeleton className="h-10 w-full rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  const hasRestaurant = restaurant !== null;
  const billingHref =
    billingCheckoutUrl?.trim() && !billingCheckoutUrl.includes("...")
      ? billingCheckoutUrl.trim()
      : null;

  return (
    <div className="w-full min-w-0 space-y-8 px-4 pb-16 pt-14 sm:px-5 sm:pt-16 md:px-6 lg:px-8 lg:pt-20 xl:px-10 2xl:px-12">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[1.75rem]">Settings</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Account, security, billing, and preferences.</p>
          </div>
          {isAdmin ? (
            <Button type="button" variant="ghost" size="sm" asChild className="h-9 shrink-0 self-start rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white sm:self-auto">
              <Link to="/admin" state={{ from: "/dashboard/settings" }}><LayoutDashboard className="mr-1.5 size-3.5" />Admin panel</Link>
            </Button>
          ) : null}
        </div>
        <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800" aria-label="Settings sections">
          {SETTINGS_TABS.map((id) => {
            const { label, Icon } = TAB_META[id];
            const disabled = id === "billing" && !hasRestaurant;
            const active = activeTab === id;
            return (
              <button key={id} type="button" disabled={disabled} onClick={() => setActiveTab(id)} className={cn("relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-0.5 text-sm font-medium transition-colors", active ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200", disabled && "cursor-not-allowed opacity-40")}>
                <Icon className={cn("size-4", active ? "text-[#0066FF] dark:text-cyan-400" : "opacity-70")} />
                {label}
                {active ? <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-[#0066FF] to-[#00AACC]" aria-hidden /> : null}
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
      {activeTab === "billing" && hasRestaurant ? <DashboardBillingSection restaurant={restaurant} billingCheckoutUrl={billingHref} /> : null}
      {activeTab === "billing" && !hasRestaurant ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700/80 dark:bg-slate-900/90">
          <p className="text-sm text-slate-600 dark:text-slate-400">Link a license or complete setup to manage billing.</p>
          <Button type="button" asChild className="mt-4 rounded-xl"><Link to="/">Go to setup</Link></Button>
        </section>
      ) : null}
      {activeTab === "notifications" ? <DashboardNotificationsSection /> : null}
      {activeTab === "appearance" ? <DashboardAppearanceSection /> : null}
    </div>
  );
}