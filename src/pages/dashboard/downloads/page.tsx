import { Link } from "react-router-dom";
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
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Cpu,
  Download,
  FileDown,
  HardDriveDownload,
  Laptop,
  Monitor,
  ShieldAlert,
} from "lucide-react";

export default function DashboardDownloadsPage() {
  const { t } = useDashboardLocale();
  const live = useLiveBuildMeta();
  const versionLabel = live?.appVersion ?? APP_VERSION_LABEL;
  const installerFileMtime =
    formatInstallerDisplayFromIso(live?.installerUpdatedAt) ??
    formattedInstallerMtime();

  const installerUrlX64 = windowsInstallerX64Href(versionLabel);
  const installerUrlArm64 = windowsInstallerArm64Href(versionLabel);

  const openInstallerDownload = (
    url: string,
    arch: "x64" | "arm64",
  ) => {
    triggerInstallerDownload(url, arch, versionLabel);
    toast.success(t("downloads.toast_started"));
  };

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-slate-50 via-white to-sky-50/60 px-4 pb-12 pt-16 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600">
              {t("downloads.eyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("downloads.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              {t("downloads.subtitle")}
            </p>
          </div>
          <div className="inline-flex self-start items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            {t("downloads.latest_version", { version: versionLabel })}
          </div>
        </header>

        <section className="relative overflow-hidden rounded-3xl border border-sky-100 bg-white p-5 shadow-[0_24px_70px_-40px_rgba(14,116,202,0.35)] sm:p-7">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-sky-100/70 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.8fr] lg:items-center">
            <div>
              <div className="flex items-start gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-200">
                  <HardDriveDownload className="size-7" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                    {t("downloads.recommended")}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{t("downloads.setup_name")}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("downloads.x64_hint")}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    {t("downloads.version")}
                  </p>
                  <p className="mt-1 text-sm font-semibold">v{versionLabel}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    {t("downloads.platform")}
                  </p>
                  <p className="mt-1 text-sm font-semibold">Windows 10 / 11</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    {t("downloads.architecture")}
                  </p>
                  <p className="mt-1 text-sm font-semibold">x64 (Intel / AMD)</p>
                </div>
              </div>

              <Button
                size="lg"
                onClick={() => openInstallerDownload(installerUrlX64, "x64")}
                className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-base font-semibold text-white shadow-lg shadow-blue-200/70 hover:from-blue-700 hover:to-cyan-600 sm:w-auto sm:min-w-72"
              >
                <Download className="mr-2 size-5" />
                {t("downloads.download_windows")}
              </Button>

              <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                <FileDown className="size-3.5" />
                <span className="font-mono">RestaurantPOSSetup.exe</span>
                {installerFileMtime ? (
                  <>
                    <span>•</span>
                    <span>{t("downloads.updated", { date: installerFileMtime })}</span>
                  </>
                ) : null}
              </p>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold">{t("downloads.requirements")}</p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-center gap-3 text-sm text-slate-600">
                  <Laptop className="size-4 text-sky-600" />
                  {t("downloads.req_os")}
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600">
                  <Cpu className="size-4 text-sky-600" />
                  {t("downloads.req_cpu")}
                </li>
                <li className="flex items-center gap-3 text-sm text-slate-600">
                  <Monitor className="size-4 text-sky-600" />
                  {t("downloads.req_ram")}
                </li>
              </ul>
              <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-relaxed text-sky-800">
                {t("downloads.offline_note")}
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          {installerUrlArm64 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Cpu className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{t("downloads.arm_title")}</h3>
                  <p className="text-xs text-slate-500">{t("downloads.arm_hint")}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => openInstallerDownload(installerUrlArm64, "arm64")}
                className="mt-5 w-full rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50"
              >
                <Download className="mr-2 size-4" />
                {t("downloads.arm_cta")}
              </Button>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold">{t("downloads.help_title")}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {t("downloads.help_hint")}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                to="/dashboard/restaurant-pos"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {t("downloads.install_guide")}
                <ArrowUpRight className="size-3.5 text-slate-400" />
              </Link>
              <Link
                to="/dashboard/support"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <ShieldAlert className="size-3.5 text-amber-500" />
                  {t("downloads.contact_support")}
                </span>
                <ArrowUpRight className="size-3.5 text-slate-400" />
              </Link>
            </div>
          </section>
        </div>

        <section className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-sky-600" />
          <p>
            {t("downloads.keep_updated")}
          </p>
        </section>
      </div>
    </div>
  );
}
