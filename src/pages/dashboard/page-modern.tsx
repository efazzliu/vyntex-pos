import { useState } from "react";
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
import {
  ArrowRight,
  Calendar,
  Check,
  Copy,
  Cpu,
  CreditCard,
  Download,
  HardDriveDownload,
  KeyRound,
  Layers,
  Monitor,
  Shield,
  Timer,
} from "lucide-react";

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Full-width column; extra top padding clears floating header icons */
const shell =
  "w-full min-w-0 px-4 pb-16 pt-14 sm:px-5 sm:pt-16 md:px-6 md:pt-[4.5rem] lg:px-8 lg:pt-20 xl:px-10 2xl:px-12";

/** Dark panel + blue rim glow (Argus-style cards) */
const cosmicPanel =
  "rounded-3xl border border-sky-500/20 bg-[#040912]/95 shadow-[0_0_0_1px_rgba(56,189,248,0.06)_inset,0_0_48px_-12px_rgba(37,99,235,0.35)] backdrop-blur-sm";

const cosmicPanelHover =
  "transition-[border-color,box-shadow] duration-300 hover:border-sky-400/35 hover:shadow-[0_0_0_1px_rgba(56,189,248,0.1)_inset,0_0_64px_-8px_rgba(56,189,248,0.28)]";

function CosmicBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Deep space base */}
      <div className="absolute inset-0 bg-[#02040a]" />
      {/* Soft blue wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-30%,rgba(37,99,235,0.35),transparent_55%)]" />
      {/* Planet / portal arc — bright ring */}
      <div
        className="absolute left-1/2 top-[-42%] h-[min(95vh,900px)] w-[min(220vw,3200px)] -translate-x-1/2 rounded-[50%]"
        style={{
          border: "1px solid rgba(56, 189, 248, 0.45)",
          boxShadow:
            "0 0 80px 24px rgba(56, 189, 248, 0.12), inset 0 -40px 80px -20px rgba(14, 165, 233, 0.15)",
          background:
            "linear-gradient(180deg, rgba(59, 130, 246, 0.12) 0%, transparent 45%)",
        }}
      />
      {/* Inner glow core */}
      <div className="absolute left-1/2 top-[-8%] h-[55%] w-[min(140vw,2000px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(147,197,253,0.25),transparent_58%)]" />
      {/* Stars / dust */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.4), transparent),
            radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.25), transparent),
            radial-gradient(1px 1px at 80% 20%, rgba(255,255,255,0.35), transparent),
            radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.2), transparent),
            radial-gradient(1px 1px at 10% 60%, rgba(255,255,255,0.3), transparent)`,
          backgroundSize: "100% 100%",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#02040a]/90" />
    </div>
  );
}

export default function DashboardOverviewModern() {
  const { restaurant } = useDashboardRestaurant();
  const { t, lang } = useDashboardLocale();
  const [copied, setCopied] = useState(false);
  const live = useLiveBuildMeta();
  const versionLabel = live?.appVersion ?? APP_VERSION_LABEL;
  const installerFileMtime =
    formatInstallerDisplayFromIso(live?.installerUpdatedAt) ??
    formattedInstallerMtime();
  const installerUrlX64 = windowsInstallerX64Href();
  const installerUrlArm64 = windowsInstallerArm64Href();
  const dateLocale = dashboardDateLocale(lang);

  if (restaurant === undefined) {
    return (
      <div data-dashboard-overview className="relative min-h-full w-full min-w-0 overflow-hidden text-white">
        <CosmicBackdrop />
        <div className={cn("relative z-[1]", shell)}>
          <Skeleton className="h-48 w-full rounded-3xl border border-sky-500/20 bg-[#040912]/60" />
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <Skeleton className="h-28 rounded-2xl border border-sky-500/15 bg-[#040912]/50" />
            <Skeleton className="h-28 rounded-2xl border border-sky-500/15 bg-[#040912]/50" />
            <Skeleton className="h-28 rounded-2xl border border-sky-500/15 bg-[#040912]/50" />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Skeleton className="min-h-[220px] rounded-3xl border border-sky-500/15 bg-[#040912]/50" />
            <Skeleton className="min-h-[220px] rounded-3xl border border-sky-500/15 bg-[#040912]/50" />
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) return null;

  const daysLeft = daysUntil(restaurant.licenseExpiry);
  const isExpiringSoon = daysLeft <= 7;

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

  const openInstallerDownload = (
    url: string,
    arch: "x64" | "arm64",
  ) => {
    triggerInstallerDownload(url, arch, versionLabel);
    toast.success(t("toast.download_started"));
  };

  const typeLabel = dashboardTypeLabel(restaurant.type, lang);
  const planLabel = dashboardPlanLabel(restaurant.plan, lang);

  const statItems = [
    { label: t("stat.license_type"), value: typeLabel, icon: Cpu },
    { label: t("stat.plan"), value: planLabel, icon: Layers },
    {
      label: t("stat.days_remaining"),
      value: t("stat.days_value", { count: daysLeft }),
      icon: Timer,
      warn: isExpiringSoon,
    },
  ] as const;

  return (
    <div data-dashboard-overview className="relative min-h-full w-full min-w-0 overflow-x-hidden text-white">
      <CosmicBackdrop />

      <div className={cn("relative z-[1]", shell)}>
        {/* Hero — full width, large type like reference */}
        <header className="relative pt-2 text-center sm:pt-4 lg:pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/70">
            {t("overview.eyebrow")}
          </p>
          <h1 className="mt-4 w-full text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-white drop-shadow-[0_0_40px_rgba(56,189,248,0.15)] sm:text-4xl md:text-5xl lg:text-[3.25rem]">
            {t("overview.title")}
          </h1>
          <p className="mt-4 w-full max-w-none text-balance text-sm leading-relaxed text-white/55 sm:text-[15px]">
            {t("overview.subtitle")}
          </p>
        </header>

        {/* Metric pills */}
        <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-3 sm:gap-4 lg:gap-5">
          {statItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3.5 backdrop-blur-md",
                "shadow-[0_0_32px_-8px_rgba(56,189,248,0.2)]",
                item.warn && "border-amber-400/30 shadow-[0_0_28px_-6px_rgba(251,191,36,0.2)]",
              )}
            >
              <item.icon className="size-5 shrink-0 text-sky-300/80" strokeWidth={1.5} />
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {item.label}
                </p>
                <p className="truncate text-sm font-semibold text-white sm:text-base">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main cosmic cards */}
        <div className="mt-10 grid w-full grid-cols-1 gap-6 lg:mt-12 lg:grid-cols-2 lg:gap-8 xl:gap-10">
          {/* Venue */}
          <section className={cn(cosmicPanel, cosmicPanelHover, "p-6 sm:p-8")}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sky-500/15 pb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200/50">
                  {t("venue.label")}
                </p>
                <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {restaurant.name}
                </h2>
              </div>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {t("venue.active")}
              </span>
            </div>

            <div
              className={cn(
                "mt-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm",
                isExpiringSoon
                  ? "border-amber-400/35 bg-amber-500/10 text-amber-50"
                  : "border-white/10 bg-black/30 text-white/60",
              )}
            >
              <Calendar className="size-4 shrink-0 text-sky-300/70" strokeWidth={1.5} />
              <span>
                {t("venue.expires")}{" "}
                <span className="font-medium text-white">{formatDate(restaurant.licenseExpiry, dateLocale)}</span>
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-500/15 bg-black/40 p-4 ring-1 ring-inset ring-sky-400/5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-sky-200/60">
                <KeyRound className="size-3.5" strokeWidth={1.5} />
                {t("venue.license_key")}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-h-10 flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-center font-mono text-xs tracking-[0.14em] text-white/90 sm:text-left sm:text-sm">
                  {restaurant.licenseKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopy()}
                  className="h-10 shrink-0 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/15 sm:h-10 sm:w-10 sm:px-0"
                >
                  {copied ? (
                    <Check className="mx-auto size-4 text-emerald-400" />
                  ) : (
                    <Copy className="mx-auto size-4" />
                  )}
                </Button>
              </div>
            </div>
          </section>

          {/* Install */}
          <section className={cn(cosmicPanel, cosmicPanelHover, "flex flex-col p-6 sm:p-8")}>
            <div className="flex items-center gap-3 border-b border-sky-500/15 pb-5">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/10 text-sky-200">
                <HardDriveDownload className="size-5" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-white">{t("install.title")}</h3>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-3 py-8">
              <Button
                type="button"
                onClick={() => openInstallerDownload(installerUrlX64, "x64")}
                className="h-12 w-full rounded-full border-0 bg-white text-base font-semibold text-zinc-950 shadow-[0_0_40px_-4px_rgba(255,255,255,0.35)] transition hover:bg-sky-50"
              >
                <span className="flex items-center justify-center gap-2">
                  <Download className="size-5" strokeWidth={2} />
                  {t("install.win_x64")}
                </span>
              </Button>
              <p className="text-center text-xs text-white/45">{t("install.win_x64_hint")}</p>

              {installerUrlArm64 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openInstallerDownload(installerUrlArm64, "arm64")}
                  className="h-11 w-full rounded-full border-white/20 bg-transparent text-sm text-white/90 hover:bg-white/10"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Monitor className="size-4" strokeWidth={1.5} />
                    {t("install.win_arm")}
                  </span>
                </Button>
              ) : null}
              {installerUrlArm64 ? (
                <p className="text-center text-xs text-white/40">{t("install.win_arm_hint")}</p>
              ) : null}
            </div>

            <p className="mt-auto border-t border-sky-500/15 pt-4 text-center text-[11px] text-white/40">
              <span className="font-mono text-white/55">
                {t("install.app_version", { version: versionLabel })}
              </span>
              {installerFileMtime ? (
                <>
                  <span className="text-white/25"> · </span>
                  {t("install.file_label")}: <span className="text-white/50">{installerFileMtime}</span>
                </>
              ) : (
                <>
                  <span className="text-white/25"> · </span>
                  {t("install.file_hint")}
                </>
              )}
            </p>
          </section>
        </div>

        {/* Shortcuts */}
        <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:mt-10 lg:gap-5">
          <Link
            to="/dashboard/settings"
            className={cn(
              cosmicPanel,
              cosmicPanelHover,
              "group flex items-center justify-between gap-4 px-5 py-4 sm:px-6",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-200">
                <CreditCard className="size-4" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-white">{t("action.business")}</p>
                <p className="truncate text-sm text-white/45">{t("action.business_desc")}</p>
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-sky-300" />
          </Link>
          <Link
            to="/contact"
            className={cn(
              cosmicPanel,
              cosmicPanelHover,
              "group flex items-center justify-between gap-4 px-5 py-4 sm:px-6",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-200">
                <Shield className="size-4" strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-white">{t("action.support")}</p>
                <p className="truncate text-sm text-white/45">{t("action.support_desc")}</p>
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-sky-300" />
          </Link>
        </div>
      </div>
    </div>
  );
}
