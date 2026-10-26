import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Check,
  Clock,
  Download,
  Info,
  Laptop,
  Layers,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { getOfflineQueueCount } from "@/lib/local-db.ts";
import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";
import {
  checkForPosAppUpdate,
  downloadPosAppUpdate,
  exportPosDiagnostics,
  installPosAppUpdate,
  readPosSystemInfo,
  readStoredUpdateCheck,
  type PosAppUpdateCheck,
  type PosSystemInfo,
} from "@/lib/pos-app-update.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsSystemPanelProps = {
  t: Translate;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
};

type UpdateUiState =
  | "idle"
  | "checking"
  | "uptodate"
  | "available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "browser_download"
  | "error";

function formatStamp(ms: number | null, language: string): string {
  if (!ms) return "";
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(language === "sq" ? "sq-AL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCheckLabel(ms: number | null, language: string, t: Translate): string {
  if (!ms) return t("settings.sys_last_checked_never");
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return t("settings.sys_last_checked_never");
  const locale = language === "sq" ? "sq-AL" : "en-GB";
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) {
    return t("settings.sys_bar_today", { time });
  }
  return formatStamp(ms, language);
}

function formatArch(arch: string): string {
  const value = arch.trim().toLowerCase();
  if (value === "x64" || value === "amd64") return "64-bit (x64)";
  if (value === "arm64" || value === "aarch64") return "ARM64";
  if (value === "ia32" || value === "x86") return "32-bit (x86)";
  return arch.trim() || "—";
}

function formatOs(osLabel: string, platform: string): string {
  const raw = (osLabel || platform || "").trim();
  if (!raw) return "—";
  if (/^Windows_NT\b/i.test(raw)) {
    const release = raw.replace(/^Windows_NT\s*/i, "").trim();
    return release ? `Windows ${release}` : "Windows";
  }
  return raw;
}

export default function SettingsSystemPanel({
  t,
  theme,
  onThemeChange,
}: SettingsSystemPanelProps) {
  const { language } = usePosLocale();
  const isOnline = useOnlineStatus();
  const stored = readStoredUpdateCheck();
  const [state, setState] = useState<UpdateUiState>("idle");
  const [currentVersion, setCurrentVersion] = useState(
    stored?.currentVersion || APP_VERSION_LABEL,
  );
  const [latestVersion, setLatestVersion] = useState<string | null>(
    stored?.latestVersion ?? null,
  );
  const [progress, setProgress] = useState(0);
  const [errorKey, setErrorKey] = useState<"check" | "install" | "download" | "dev" | "web">(
    "check",
  );
  const [viaElectron, setViaElectron] = useState(Boolean(window.desktop?.isElectron));
  const [packaged, setPackaged] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(stored?.at ?? null);
  const [info, setInfo] = useState<PosSystemInfo | null>(null);
  const [exporting, setExporting] = useState(false);
  const [queueCount, setQueueCount] = useState<number | null>(null);

  useEffect(() => {
    const unsub = window.desktop?.onAppUpdateProgress?.((percent) => {
      setProgress(percent);
      setState("downloading");
    });
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    void readPosSystemInfo().then(setInfo);
    void getOfflineQueueCount()
      .then(setQueueCount)
      .catch(() => setQueueCount(null));
  }, []);

  const applyCheck = (result: PosAppUpdateCheck) => {
    setCurrentVersion(result.currentVersion);
    setLatestVersion(result.latestVersion);
    setViaElectron(result.viaElectron);
    setPackaged(result.packaged);
    setDownloaded(result.downloaded);
    setReleaseNotes(result.releaseNotes);
    setLastChecked(result.checkedAt);
    setState(
      result.updateAvailable
        ? result.downloaded
          ? "downloaded"
          : "available"
        : "uptodate",
    );
  };

  const runCheck = useCallback(async () => {
    setState("checking");
    setProgress(0);
    try {
      applyCheck(await checkForPosAppUpdate());
    } catch {
      setErrorKey("check");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const busy =
    state === "checking" || state === "downloading" || state === "installing";

  const runDownload = async () => {
    if (viaElectron && !packaged) {
      setErrorKey("dev");
      setState("error");
      return;
    }
    if (!viaElectron) {
      const result = await downloadPosAppUpdate();
      if (result.ok) setState("browser_download");
      else {
        setErrorKey("download");
        setState("error");
      }
      return;
    }
    setState("downloading");
    setProgress(0);
    try {
      const result = await downloadPosAppUpdate();
      if (!result.ok) {
        setErrorKey(result.error === "dev" ? "dev" : result.error === "none" ? "check" : "download");
        if (result.error === "none") {
          setState("uptodate");
          return;
        }
        setState("error");
        return;
      }
      setDownloaded(true);
      setState("downloaded");
    } catch {
      setErrorKey("download");
      setState("error");
    }
  };

  const runInstall = async () => {
    if (!viaElectron) {
      setErrorKey("web");
      setState("error");
      return;
    }
    if (!packaged) {
      setErrorKey("dev");
      setState("error");
      return;
    }
    setState("downloading");
    setProgress(0);
    try {
      const result = await installPosAppUpdate();
      if (!result.ok) {
        if (result.error === "dev") setErrorKey("dev");
        else if (result.error === "none") {
          setState("uptodate");
          return;
        } else setErrorKey("install");
        setState("error");
        return;
      }
      setState("installing");
    } catch {
      setErrorKey("install");
      setState("error");
    }
  };

  const statusKey =
    state === "checking"
      ? "settings.sys_status_checking"
      : state === "uptodate"
        ? "settings.sys_status_uptodate"
        : state === "available"
          ? "settings.sys_status_available"
          : state === "downloading"
            ? "settings.sys_status_downloading"
            : state === "downloaded"
              ? "settings.sys_status_downloaded"
              : state === "installing"
                ? "settings.sys_status_installing"
                : state === "browser_download"
                  ? "settings.sys_status_web_download"
                  : state === "error"
                    ? errorKey === "dev"
                      ? "settings.sys_status_dev"
                      : errorKey === "web"
                        ? "settings.sys_status_web_install"
                        : errorKey === "install"
                          ? "settings.sys_status_error_install"
                          : errorKey === "download"
                            ? "settings.sys_status_error_download"
                            : "settings.sys_status_error"
                    : "settings.sys_status_idle";

  const runtimeShort =
    info?.runtime === "electron-packaged"
      ? t("settings.sys_runtime_short_desktop")
      : info?.runtime === "electron-dev"
        ? t("settings.sys_runtime_short_dev")
        : t("settings.sys_runtime_short_web");

  const runtimeValue = info?.electron
    ? `Electron v${info.electron}`
    : runtimeShort;

  const checkLabel = formatCheckLabel(lastChecked, language, t);
  const archLabel = formatArch(info?.arch || "");
  const osLabel = formatOs(info?.osLabel || "", info?.platform || "");
  const queueLabel =
    queueCount == null ? "—" : t("settings.sys_queue_count", { count: queueCount });
  const notesVersion = latestVersion || currentVersion;
  const updateReady =
    state === "available" || state === "downloaded" || state === "browser_download";
  const publishedHint = updateReady && latestVersion
    ? t("settings.sys_has_update", { version: latestVersion })
    : state === "uptodate"
      ? t("settings.sys_no_updates")
      : state === "checking"
        ? t("settings.sys_status_checking")
        : state === "error"
          ? t(statusKey, { version: latestVersion ?? "", percent: progress })
          : t("settings.sys_last_checked_never");

  const exportLogs = async () => {
    setExporting(true);
    try {
      await exportPosDiagnostics({
        updateState: state,
        currentVersion,
        latestVersion,
      });
      const count = await getOfflineQueueCount();
      setQueueCount(count);
    } finally {
      setExporting(false);
    }
  };

  const canDownload = !busy && updateReady;
  const canInstall =
    !busy && viaElectron && packaged && (state === "available" || state === "downloaded" || downloaded);

  return (
    <div className="space-y-4">
      <header className="flex items-start gap-3 px-1">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-light">
          <Monitor className="size-5 text-brand" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-[#0f172a]">
            {t("settings.cat.other")}
          </h1>
          <p className="mt-0.5 text-sm text-[#64748b]">{t("settings.sys_page_lead")}</p>
        </div>
      </header>

      <section className="flex flex-col gap-4 rounded-[22px] border border-[#e6edf5] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:gap-0 lg:px-2">
        <BarCell
          icon={
            isOnline ? (
              <span className="flex size-9 items-center justify-center rounded-full bg-[#ecfdf3] text-[#16a34a]">
                <Check className="size-4" strokeWidth={2.5} />
              </span>
            ) : (
              <span className="flex size-9 items-center justify-center rounded-full bg-[#fff7ed] text-[#d97706]">
                <WifiOff className="size-4" />
              </span>
            )
          }
          label={t("settings.sys_status_bar")}
          value={isOnline ? t("settings.sys_status_online") : t("settings.sys_status_offline")}
        />
        <BarRule />
        <BarCell
          icon={<Layers className="size-4 text-[#94a3b8]" />}
          label={t("settings.sys_bar_version")}
          value={currentVersion}
          strong
        />
        <BarRule />
        <BarCell
          icon={<Laptop className="size-4 text-[#94a3b8]" />}
          label={t("settings.sys_bar_runtime")}
          value={runtimeShort}
        />
        <BarRule />
        <BarCell
          icon={<Clock className="size-4 text-[#94a3b8]" />}
          label={t("settings.sys_bar_last")}
          value={checkLabel}
        />
        <div className="lg:ml-auto lg:pl-3 lg:pr-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runCheck()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e6edf5] bg-white px-3.5 text-sm font-medium text-[#0f172a] disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4 text-[#64748b]", state === "checking" && "animate-spin")} />
            {t("settings.update_check")}
          </button>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <section className="rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardTitle
              icon={<Sun className="size-4 text-brand" />}
              iconBg="bg-brand-light"
              title={t("settings.sys_theme_title")}
              lead={t("settings.sys_appearance_lead")}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ThemeChoice
                active={theme === "light"}
                icon={<Sun className="size-4" />}
                title={t("settings.light")}
                desc={t("settings.sys_light_desc")}
                onClick={() => onThemeChange("light")}
              />
              <ThemeChoice
                active={theme === "dark"}
                icon={<Moon className="size-4" />}
                title={t("settings.night")}
                desc={t("settings.sys_night_desc")}
                onClick={() => onThemeChange("dark")}
              />
            </div>
          </section>

          <section className="rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardTitle
              icon={<Layers className="size-4 text-brand" />}
              iconBg="bg-brand-light"
              title={t("settings.sys_version_card_title")}
              lead={t("settings.sys_version_card_lead")}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-lg font-bold text-brand">
                  V
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-[#64748b]">{t("settings.sys_installed")}</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-[#0f172a]">
                    {currentVersion}
                  </p>
                  <p
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 text-xs font-semibold",
                      state === "uptodate"
                        ? "text-[#16a34a]"
                        : state === "error"
                          ? "text-[#dc2626]"
                          : updateReady
                            ? "text-[#d97706]"
                            : "text-[#64748b]",
                    )}
                  >
                    {state === "uptodate" ? <Check className="size-3.5" /> : null}
                    {t(statusKey, { version: latestVersion ?? "", percent: progress })}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#64748b]">{t("settings.sys_published")}</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-[#0f172a]">
                  {latestVersion || "—"}
                </p>
                <p className="mt-1 text-xs text-[#64748b]">{publishedHint}</p>
              </div>
            </div>
            {state === "downloading" ? (
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <OutlineAction disabled={busy} onClick={() => void runCheck()}>
                <RefreshCw className={cn("size-4", state === "checking" && "animate-spin")} />
                {t("settings.update_check")}
              </OutlineAction>
              <OutlineAction disabled={!canDownload} onClick={() => void runDownload()}>
                <Download className="size-4" />
                {t("settings.sys_download")}
              </OutlineAction>
              <OutlineAction disabled={!canInstall} onClick={() => void runInstall()}>
                <RotateCcw className="size-4" />
                {t("settings.sys_install")}
              </OutlineAction>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#64748b]">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>{t("settings.sys_install_rules")}</span>
            </p>
          </section>

          <section className="rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <CardTitle
                icon={<Info className="size-4 text-brand" />}
                iconBg="bg-brand-light"
                title={t("settings.sys_notes_title")}
                lead={t("settings.sys_notes_sub")}
              />
              <span className="shrink-0 rounded-full border border-[#e6edf5] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">
                {notesVersion}
              </span>
            </div>
            {releaseNotes ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#334155]">
                {releaseNotes}
              </p>
            ) : (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
                <Info className="mt-0.5 size-4 shrink-0 text-[#94a3b8]" />
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">{t("settings.sys_unavailable")}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{t("settings.sys_notes_lead")}</p>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardTitle
              icon={<Info className="size-4 text-brand" />}
              iconBg="bg-brand-light"
              title={t("settings.sys_info_title")}
              lead={t("settings.sys_info_lead")}
            />
            <dl className="mt-2 divide-y divide-[#eef2f6]">
              <InfoRow label={t("settings.sys_info_app_type")} value={runtimeShort} accent />
              <InfoRow label={t("settings.sys_info_program")} value={info?.appVersion || currentVersion} />
              <InfoRow label={t("settings.sys_info_os")} value={osLabel} />
              <InfoRow label={t("settings.sys_info_arch")} value={archLabel} />
              <InfoRow label={t("settings.sys_info_runtime_row")} value={runtimeValue} />
            </dl>
          </section>

          <section className="rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardTitle
              icon={<Activity className="size-4 text-brand" />}
              iconBg="bg-brand-light"
              title={t("settings.sys_diag_title")}
              lead={t("settings.sys_diag_sub")}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <DiagTile icon={<Layers className="size-4 text-brand" />} label={t("settings.sys_diag_version")} value={currentVersion} />
              <DiagTile icon={<Laptop className="size-4 text-brand" />} label={t("settings.sys_diag_runtime")} value={info?.electron ? "Electron" : runtimeShort} />
              <DiagTile icon={<Clock className="size-4 text-brand" />} label={t("settings.sys_diag_last")} value={checkLabel} />
              <DiagTile icon={<span className="text-sm font-semibold text-brand">#</span>} label={t("settings.sys_diag_queue")} value={queueLabel} />
            </div>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void exportLogs()}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold disabled:opacity-60"
              style={{ color: "#ffffff" }}
            >
              <Download className="size-4" />
              {t("settings.sys_diag_export_btn")}
            </button>
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#64748b]">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>{t("settings.sys_diag_note")}</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function BarRule() {
  return <div className="hidden h-10 w-px shrink-0 bg-[#e6edf5] lg:block" />;
}

function BarCell({
  icon,
  label,
  value,
  strong,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
      <span className="flex size-9 shrink-0 items-center justify-center">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#94a3b8]">{label}</p>
        <p className={cn("truncate text-sm text-[#0f172a]", strong ? "font-semibold" : "font-medium")}>
          {value}
        </p>
      </div>
    </div>
  );
}

function CardTitle({
  icon,
  iconBg,
  title,
  lead,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", iconBg)}>
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-[#0f172a]">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{lead}</p>
      </div>
    </div>
  );
}

function ThemeChoice({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left",
        active ? "border-brand bg-brand-light" : "border-[#e6edf5] bg-white",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          active ? "bg-brand" : "bg-[#f1f5f9] text-[#64748b]",
        )}
        style={active ? { color: "#ffffff" } : undefined}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#0f172a]">{title}</span>
        <span className="mt-0.5 block text-xs text-[#64748b]">{desc}</span>
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          active ? "border-brand bg-brand" : "border-[#d5dbe6] bg-white",
        )}
      >
        {active ? <Check className="size-3" style={{ color: "#ffffff" }} /> : null}
      </span>
    </button>
  );
}

function OutlineAction({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e6edf5] bg-white px-3 text-sm font-medium text-[#0f172a] disabled:text-[#94a3b8] disabled:opacity-70"
    >
      {children}
    </button>
  );
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-sm text-[#64748b]">{label}</dt>
      <dd className={cn("text-right text-sm font-medium", accent ? "text-[#16a34a]" : "text-[#0f172a]")}>
        {value}
      </dd>
    </div>
  );
}

function DiagTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] px-2 py-3 text-center">
      <div className="mx-auto flex size-8 items-center justify-center">{icon}</div>
      <p className="mt-1 text-[11px] text-[#94a3b8]">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-[#0f172a]">{value}</p>
    </div>
  );
}
