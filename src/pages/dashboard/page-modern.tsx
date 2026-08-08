import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import {
  dashboardDateLocale,
  dashboardPlanLabel,
  dashboardTypeLabel,
} from "@/lib/dashboard-i18n.ts";
import {
  fetchDashboardMonthlyOverview,
  fetchDashboardRecentActivity,
  fetchDashboardSetupProgress,
  type DashboardActivityItem,
  type DashboardMonthlyOverview,
  type DashboardSetupProgress,
} from "@/lib/dashboard-overview-data.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import {
  triggerInstallerDownload,
  windowsInstallerArm64Href,
  windowsInstallerX64Href,
} from "@/lib/installer-download-urls.ts";
import {
  APP_VERSION_LABEL,
  formattedInstallerMtime,
  formatInstallerDisplayFromIso,
} from "@/lib/site-constants.ts";
import { useLiveBuildMeta } from "@/hooks/use-live-build-meta.ts";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bell,
  BellRing,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  CreditCard,
  Download,
  HardDriveDownload,
  KeyRound,
  Layers,
  MapPin,
  Monitor,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  Timer,
  TrendingUp,
} from "lucide-react";

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(iso: string, locale: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const shell =
  "w-full min-w-0 px-4 pb-10 pt-16 sm:px-5 md:px-6 lg:px-7";

const card =
  "rounded-2xl border border-slate-200/90 bg-white shadow-sm";

const cardHover =
  "transition-shadow duration-200 hover:shadow-md";

const SETUP_STEP_KEYS = [
  "setup.install",
  "setup.activate",
  "setup.printer",
  "setup.tables",
  "setup.products",
] as const;

function StatPill({
  label,
  value,
  subtitle,
  icon: Icon,
  warn,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        card,
        "flex min-h-[92px] items-center gap-3 px-4 py-3.5",
        warn && "border-amber-200 bg-amber-50/80",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="truncate text-base font-semibold text-slate-900">{value}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[10px] text-slate-400">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function SalesSparkline({ points }: { points: number[] }) {
  const width = 560;
  const height = 118;
  const max = Math.max(...points, 1);
  const coordinates = points.map((value, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
    const y = height - (value / max) * (height - 16) - 8;
    return `${x},${y}`;
  });

  return (
    <div className="relative mt-4 h-[126px] overflow-hidden rounded-lg bg-[linear-gradient(to_bottom,transparent_24%,#e2e8f0_25%,transparent_26%,transparent_49%,#e2e8f0_50%,transparent_51%,transparent_74%,#e2e8f0_75%,transparent_76%)]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-label="Monthly sales trend"
      >
        <polyline
          points={coordinates.join(" ")}
          fill="none"
          stroke="#1787f7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function DashboardOverviewModern() {
  const { restaurant } = useDashboardRestaurant();
  const { user } = useUserRole();
  const { t, lang } = useDashboardLocale();
  const [copied, setCopied] = useState(false);
  const [installTab, setInstallTab] = useState<"windows" | "mac" | "android">("windows");
  const [setup, setSetup] = useState<DashboardSetupProgress | null>(null);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [monthly, setMonthly] = useState<DashboardMonthlyOverview>({
    sales: 0,
    orders: 0,
    averageOrder: 0,
    points: [],
  });
  const live = useLiveBuildMeta();
  const versionLabel = live?.appVersion ?? APP_VERSION_LABEL;
  const installerFileMtime =
    formatInstallerDisplayFromIso(live?.installerUpdatedAt) ??
    formattedInstallerMtime();
  const installerUrlX64 = windowsInstallerX64Href(versionLabel);
  const installerUrlArm64 = windowsInstallerArm64Href(versionLabel);
  const dateLocale = dashboardDateLocale(lang);

  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    void (async () => {
      const [progress, logs, monthlyOverview] = await Promise.all([
        fetchDashboardSetupProgress(restaurant.id, {
          licenseActive: restaurant.licenseStatus === "active",
          hasRegisteredDevice: restaurant.registeredDeviceIds.length > 0,
        }),
        fetchDashboardRecentActivity(restaurant.id, 5),
        fetchDashboardMonthlyOverview(restaurant.id),
      ]);
      if (cancelled) return;
      setSetup(progress);
      setActivity(logs);
      setMonthly(monthlyOverview);
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurant?.id, restaurant?.licenseStatus, restaurant?.registeredDeviceIds.length]);

  if (restaurant === undefined) {
    return (
      <div className={cn(shell, "space-y-4")}>
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const openInstallerDownload = (url: string, arch: "x64" | "arm64") => {
    triggerInstallerDownload(url, arch, versionLabel);
    toast.success(t("toast.download_started"));
  };

  if (!restaurant) {
    return (
      <div data-dashboard-overview className="min-h-full w-full bg-slate-50/80 text-slate-900">
        <div className={shell}>
          <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Welcome back, {user?.name?.trim() || "User"} 👋
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Set up your first Vyntex POS venue from this dashboard.
              </p>
            </div>
            <Button asChild className="h-10 self-start rounded-xl bg-[#087cf0] px-4 text-white">
              <Link to="/dashboard/get-started">
                <Plus className="mr-1.5 size-4" />
                Activate license
              </Link>
            </Button>
          </header>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatPill label="Active license" value="Not activated" subtitle="Setup required" icon={Shield} />
            <StatPill label={t("stat.plan")} value="—" subtitle="Choose during activation" icon={Layers} />
            <StatPill label={t("stat.days_remaining")} value="—" subtitle="No active license" icon={Timer} />
            <StatPill label={t("devices.title")} value="0" subtitle="No connected devices" icon={Monitor} />
            <StatPill label={t("venue.last_sync")} value="Not yet" subtitle="Activate POS first" icon={RefreshCw} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className={cn(card, "p-5 xl:col-span-4")}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">
                Active venue
              </p>
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                <Shield className="mx-auto size-8 text-slate-300" />
                <h2 className="mt-3 text-base font-semibold text-slate-900">No venue linked yet</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Activate a new trial or link an existing POS license to this account.
                </p>
                <Button asChild className="mt-4 rounded-xl bg-sky-600 text-white hover:bg-sky-700">
                  <Link to="/dashboard/get-started">Activate your license</Link>
                </Button>
              </div>
            </section>

            <section className={cn(card, "flex flex-col p-5 xl:col-span-5")}>
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <HardDriveDownload className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold">Get Vyntex POS</h3>
                  <p className="text-xs text-slate-500">Install the Windows app before activation.</p>
                </div>
              </div>
              <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1">
                {(["windows", "mac", "android"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setInstallTab(tab)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-2 text-xs font-medium capitalize",
                      installTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {installTab === "windows" ? (
                <Button
                  type="button"
                  onClick={() => openInstallerDownload(installerUrlX64, "x64")}
                  className="mt-6 h-11 rounded-xl bg-sky-600 text-white hover:bg-sky-700"
                >
                  <Download className="mr-2 size-4" />
                  {t("install.win_x64")}
                </Button>
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">Coming soon</p>
              )}
            </section>

            <section className={cn(card, "p-5 xl:col-span-3")}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">
                Setup checklist
              </p>
              <p className="mt-1 text-sm font-semibold">Let&apos;s get you started</p>
              <div className="mt-4 h-1.5 rounded-full bg-slate-100">
                <div className="h-full w-0 rounded-full bg-sky-500" />
              </div>
              <ul className="mt-5 space-y-3 text-xs">
                {["Activate your license", "Download & install app", "Connect printer", "Configure tables", "Add products"].map(
                  (label) => (
                    <li key={label} className="flex items-center gap-2.5 text-slate-600">
                      <Circle className="size-4 text-slate-300" />
                      {label}
                    </li>
                  ),
                )}
              </ul>
            </section>
          </div>

          <section className="mt-4 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50 px-5 py-4">
            <p className="text-sm font-semibold text-slate-900">Start with one month free</p>
            <p className="mt-1 text-xs text-slate-500">
              Create your venue, receive a license key, and manage everything from this dashboard.
            </p>
          </section>
        </div>
      </div>
    );
  }

  const daysLeft = daysUntil(restaurant.licenseExpiry);
  const isExpiringSoon = daysLeft <= 7;
  const deviceCount = restaurant.registeredDeviceIds.length;
  const maxDevices = restaurant.maxTerminals;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(restaurant.licenseKey);
      setCopied(true);
      toast.success(t("toast.license_copied"));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("toast.copy_failed"));
    }
  };

  const typeLabel = dashboardTypeLabel(restaurant.type, lang);
  const planLabel = dashboardPlanLabel(restaurant.plan, lang);

  const lastSyncLabel = restaurant.lastPosSyncAt
    ? formatDateTime(restaurant.lastPosSyncAt, dateLocale)
    : t("venue.last_sync_never");

  return (
    <div
      data-dashboard-overview
      className="min-h-full w-full bg-slate-50/80 text-slate-900"
    >
      <div className={shell}>
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome back, {user?.name?.trim() || "User"} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Here&apos;s what&apos;s happening with your POS system today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative hidden w-64 lg:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search anything..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
            </button>
            <Button asChild className="h-10 rounded-xl bg-[#087cf0] px-4 text-white hover:bg-[#066bd0]">
              <Link to="/dashboard/business-settings">
                <Plus className="mr-1.5 size-4" />
                Quick action
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatPill
            label="Active license"
            value={typeLabel}
            subtitle={restaurant.licenseStatus === "active" ? "Active" : restaurant.licenseStatus}
            icon={Shield}
          />
          <StatPill
            label={t("stat.plan")}
            value={planLabel}
            subtitle={`${maxDevices} device limit`}
            icon={Layers}
          />
          <StatPill
            label={t("stat.days_remaining")}
            value={t("stat.days_value", { count: daysLeft })}
            subtitle={`Until ${formatDate(restaurant.licenseExpiry, dateLocale)}`}
            icon={Timer}
            warn={isExpiringSoon}
          />
          <StatPill
            label={t("devices.title")}
            value={`${deviceCount} / ${maxDevices}`}
            subtitle="Active devices"
            icon={Monitor}
          />
          <StatPill
            label={t("venue.last_sync")}
            value={restaurant.lastPosSyncAt ? formatDateTime(restaurant.lastPosSyncAt, dateLocale) : "Not yet"}
            subtitle="Cloud synchronization"
            icon={RefreshCw}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <section className={cn(card, cardHover, "p-5 xl:col-span-4")}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {t("venue.label")}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">
                  {restaurant.name}
                </h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/80">
                {t("venue.active")}
              </span>
            </div>

            {restaurant.address?.trim() ? (
              <p className="mt-4 flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                {restaurant.address}
              </p>
            ) : null}

            <div
              className={cn(
                "mt-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                isExpiringSoon
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-slate-100 bg-slate-50 text-slate-600",
              )}
            >
              <Calendar className="size-4 shrink-0 text-sky-500" strokeWidth={1.5} />
              <span>
                {t("venue.expires")}{" "}
                <span className="font-medium text-slate-900">
                  {formatDate(restaurant.licenseExpiry, dateLocale)}
                </span>
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {t("venue.devices")}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {t("venue.devices_value", { active: deviceCount, max: maxDevices })}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {t("venue.last_sync")}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <RefreshCw className="size-3.5 shrink-0 text-sky-500" />
                  {lastSyncLabel}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              {t("venue.cloud_hint")}
            </p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                <KeyRound className="size-3.5" strokeWidth={1.5} />
                {t("venue.license_key")}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center font-mono text-xs tracking-wider text-slate-800 sm:text-left sm:text-sm">
                  {restaurant.licenseKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopy()}
                  className="h-10 shrink-0 rounded-lg"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </section>

          <section className={cn(card, cardHover, "flex flex-col p-5 xl:col-span-5")}>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <HardDriveDownload className="size-5" strokeWidth={1.5} />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t("install.title")}
                </h3>
                <p className="text-xs text-slate-500">{t("install.subtitle")}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: "windows" as const, label: t("install.tab_windows"), icon: Monitor },
                  { id: "mac" as const, label: t("install.tab_mac"), icon: Layers },
                  { id: "android" as const, label: t("install.tab_android"), icon: Smartphone },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInstallTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                    installTab === tab.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-1 flex-col justify-center gap-3 py-6">
              {installTab === "windows" ? (
                <>
                  <Button
                    type="button"
                    onClick={() => openInstallerDownload(installerUrlX64, "x64")}
                    className="h-11 w-full rounded-xl bg-sky-600 text-white hover:bg-sky-700"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Download className="size-5" />
                      {t("install.win_x64")}
                    </span>
                  </Button>
                  <p className="text-center text-xs text-slate-500">
                    {t("install.win_x64_hint")}
                  </p>
                  {installerUrlArm64 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openInstallerDownload(installerUrlArm64, "arm64")}
                      className="h-10 w-full rounded-xl"
                    >
                      {t("install.win_arm")}
                    </Button>
                  ) : null}
                </>
              ) : (
                <p className="text-center text-sm text-slate-500 py-8">
                  {installTab === "mac"
                    ? t("install.tab_mac_soon")
                    : t("install.tab_android_soon")}
                </p>
              )}
            </div>

            <p className="mt-auto border-t border-slate-100 pt-4 text-center text-[11px] text-slate-500">
              <span className="font-mono">{t("install.app_version", { version: versionLabel })}</span>
              {installerFileMtime ? (
                <>
                  <span className="text-slate-300"> · </span>
                  {t("install.file_label")}: {installerFileMtime}
                </>
              ) : null}
            </p>
          </section>

          <section className={cn(card, "p-5 xl:col-span-3")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">
                  {t("setup.title")}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {setup?.percent === 100 ? "You’re all set!" : "You’re on the right track!"}
                </p>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-4 border-sky-100 text-xs font-bold text-sky-600">
                {setup?.percent ?? 0}%
              </span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-500"
                style={{ width: `${setup?.percent ?? 0}%` }}
              />
            </div>
            <ul className="mt-5 space-y-3">
              {(setup?.steps ?? []).map((step, i) => (
                <li key={step.id} className="flex items-center gap-2.5 text-xs">
                  {step.done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-slate-300" />
                  )}
                  <span className={step.done ? "text-slate-500" : "font-medium text-slate-800"}>
                    {t(SETUP_STEP_KEYS[i] ?? "setup.install")}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              to="/dashboard/get-started"
              className="mt-5 inline-flex text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              View full guide <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </section>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <section className={cn(card, "p-5 xl:col-span-3")}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">
                Notifications
              </p>
              <Link to="/dashboard/settings?tab=notifications" className="text-[10px] text-sky-600">
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {isExpiringSoon ? (
                <div className="flex gap-3 rounded-xl bg-amber-50 p-3">
                  <BellRing className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      License expires in {daysLeft} days
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Renew to avoid interruption.</p>
                  </div>
                </div>
              ) : null}
              <div className="flex gap-3 rounded-xl bg-sky-50 p-3">
                <PackageCheck className="mt-0.5 size-4 shrink-0 text-sky-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">POS is up to date</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Version {versionLabel} is available.</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl bg-emerald-50 p-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Cloud sync enabled</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{lastSyncLabel}</p>
                </div>
              </div>
            </div>
          </section>

          <section className={cn(card, "p-5 xl:col-span-3")}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">
                {t("activity.title")}
              </p>
              <Link to="/dashboard/support" className="text-[10px] text-sky-600">
                View all
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-slate-500">{t("activity.empty")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {activity.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-500">
                      <TrendingUp className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold capitalize text-slate-800">
                        {item.action.replace(/_/g, " ")}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {formatDateTime(item.createdAt, dateLocale)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={cn(card, "p-5 xl:col-span-6")}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">
                Monthly overview
              </p>
              <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] text-slate-500">
                This month
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-slate-400">Sales</p>
                <p className="mt-0.5 text-base font-bold text-slate-900">
                  {monthly.sales.toLocaleString(dateLocale, { maximumFractionDigits: 2 })} {restaurant.currency}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Orders</p>
                <p className="mt-0.5 text-base font-bold text-slate-900">{monthly.orders}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Avg. order</p>
                <p className="mt-0.5 text-base font-bold text-slate-900">
                  {monthly.averageOrder.toLocaleString(dateLocale, { maximumFractionDigits: 2 })} {restaurant.currency}
                </p>
              </div>
            </div>
            <SalesSparkline points={monthly.points.length ? monthly.points : [0]} />
          </section>
        </div>

        <section className="mt-4 flex flex-col gap-4 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <TrendingUp className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Upgrade your plan</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Unlock more devices, advanced reporting, cloud backup, and priority support.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0 rounded-xl border-sky-200 bg-white text-sky-700">
            <Link to="/dashboard/settings?tab=billing">
              Upgrade now <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
