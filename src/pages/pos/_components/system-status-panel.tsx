import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  Settings2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import {
  getOfflineQueueCount,
  getPrintQueueCount,
} from "@/lib/local-db.ts";
import {
  getDesktopSystemPrintersInvoker,
  type DesktopSystemPrinterInfo,
} from "@/lib/print-html.ts";
import { flushPrintQueueNow } from "@/lib/print-queue.ts";
import { getRestaurantByLicense } from "@/lib/supabase-pos/restaurant.ts";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { useSyncState } from "./offline-sync-manager.tsx";

type ServiceKey = "printer" | "internet" | "cloud" | "storage";
type ServiceState = "healthy" | "warning" | "error" | "checking";

type SystemService = {
  key: ServiceKey;
  title: string;
  detail: string;
  state: ServiceState;
  latencyMs: number | null;
  icon: ComponentType<{ className?: string }>;
  canReset: boolean;
  actionLabel?: string;
};

type ConfiguredPrinter = {
  id: string;
  name: string;
  type: string;
  address: string;
  isActive: boolean;
};

const INITIAL_STATES: Record<ServiceKey, ServiceState> = {
  printer: "checking",
  internet: "checking",
  cloud: "checking",
  storage: "checking",
};

function elapsedSince(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function printerNameKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function isConfiguredPrinterAvailable(
  printer: ConfiguredPrinter,
  physicalPrinters: DesktopSystemPrinterInfo[],
): boolean {
  const address = printerNameKey(printer.address);
  const name = printerNameKey(printer.name);
  return physicalPrinters.some((physical) => {
    const deviceName = printerNameKey(physical.deviceName);
    const displayName = printerNameKey(physical.displayName);
    return (
      address === deviceName ||
      address === displayName ||
      name === deviceName ||
      name === displayName
    );
  });
}

function stateClasses(state: ServiceState) {
  if (state === "healthy") {
    return {
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-600/10",
      dot: "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]",
      label: "text-emerald-700 bg-emerald-50 border-emerald-100",
    };
  }
  if (state === "warning") {
    return {
      icon: "bg-amber-50 text-amber-600 ring-amber-600/10",
      dot: "bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.12)]",
      label: "text-amber-700 bg-amber-50 border-amber-100",
    };
  }
  if (state === "error") {
    return {
      icon: "bg-rose-50 text-rose-600 ring-rose-600/10",
      dot: "bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.12)]",
      label: "text-rose-700 bg-rose-50 border-rose-100",
    };
  }
  return {
    icon: "bg-slate-100 text-slate-400 ring-slate-500/10",
    dot: "animate-pulse bg-slate-300",
    label: "text-slate-500 bg-slate-50 border-slate-200",
  };
}

export default function SystemStatusPanel({
  licenseKey,
  onOpenSettings,
  compact = false,
}: {
  licenseKey: string;
  onOpenSettings?: () => void;
  compact?: boolean;
}) {
  const { t, language } = usePosLocale();
  const isOnline = useOnlineStatus();
  const { queueCount, isSyncing, lastSyncError, retrySync } = useSyncState();
  const rawPrinters = useQuery("pos.settings.getPrinters", {
    licenseKey,
  }) as unknown;
  const mountedRef = useRef(true);
  const [states, setStates] =
    useState<Record<ServiceKey, ServiceState>>(INITIAL_STATES);
  const [details, setDetails] = useState<Record<ServiceKey, string>>({
    printer: t("dashboard.system_status_checking"),
    internet: t("dashboard.system_status_checking"),
    cloud: t("dashboard.system_status_checking"),
    storage: t("dashboard.system_status_checking"),
  });
  const [latencies, setLatencies] = useState<
    Record<ServiceKey, number | null>
  >({
    printer: null,
    internet: null,
    cloud: null,
    storage: null,
  });
  const [printQueueCount, setPrintQueueCount] = useState(0);
  const [checking, setChecking] = useState(true);
  const [resetting, setResetting] = useState<ServiceKey | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const configuredPrinters = useMemo<ConfiguredPrinter[]>(() => {
    if (!Array.isArray(rawPrinters)) return [];
    return rawPrinters
      .filter(
        (printer): printer is Record<string, unknown> =>
          Boolean(printer) && typeof printer === "object",
      )
      .map((printer) => ({
        id: String(printer._id ?? printer.id ?? ""),
        name: String(printer.name ?? ""),
        type: String(printer.type ?? ""),
        address: String(printer.address ?? ""),
        isActive: printer.isActive !== false,
      }))
      .filter((printer) => printer.isActive);
  }, [rawPrinters]);

  const runChecks = useCallback(async () => {
    if (!mountedRef.current) return;
    setChecking(true);
    setStates((current) => ({
      ...current,
      printer: "checking",
      cloud: "checking",
      storage: "checking",
      internet: "checking",
    }));

    const nextStates: Record<ServiceKey, ServiceState> = {
      ...INITIAL_STATES,
    };
    const nextDetails: Record<ServiceKey, string> = {
      printer: "",
      internet: "",
      cloud: "",
      storage: "",
    };
    const nextLatencies: Record<ServiceKey, number | null> = {
      printer: null,
      internet: null,
      cloud: null,
      storage: null,
    };

    const localStartedAt = performance.now();
    const localCheck = await Promise.allSettled([
      getOfflineQueueCount(),
      getPrintQueueCount(),
    ]);
    nextLatencies.storage = elapsedSince(localStartedAt);
    if (
      localCheck[0].status === "fulfilled" &&
      localCheck[1].status === "fulfilled"
    ) {
      const pendingPrints = localCheck[1].value;
      setPrintQueueCount(pendingPrints);
      nextStates.storage = "healthy";
      nextDetails.storage = t("dashboard.system_status_storage_ready");
    } else {
      nextStates.storage = "error";
      nextDetails.storage = t("dashboard.system_status_storage_error");
    }

    nextStates.internet = isOnline ? "healthy" : "error";
    nextDetails.internet = isOnline
      ? t("dashboard.system_status_internet_online")
      : t("dashboard.system_status_internet_offline");
    nextLatencies.internet = 0;

    const cloudStartedAt = performance.now();
    if (!isOnline) {
      nextStates.cloud = "error";
      nextDetails.cloud = t("dashboard.system_status_cloud_offline");
    } else {
      try {
        await getRestaurantByLicense(licenseKey, { fresh: true });
        if (lastSyncError) {
          nextStates.cloud = "error";
          nextDetails.cloud = t("dashboard.system_status_sync_error");
        } else if (queueCount > 0) {
          nextStates.cloud = "warning";
          nextDetails.cloud = t("dashboard.system_status_sync_pending", {
            count: queueCount,
          });
        } else {
          nextStates.cloud = "healthy";
          nextDetails.cloud = t("dashboard.system_status_cloud_ready");
        }
      } catch {
        nextStates.cloud = "error";
        nextDetails.cloud = t("dashboard.system_status_cloud_error");
      }
    }
    nextLatencies.cloud = elapsedSince(cloudStartedAt);

    const printerStartedAt = performance.now();
    const printerInvoker = getDesktopSystemPrintersInvoker();
    if (!printerInvoker) {
      nextStates.printer = "warning";
      nextDetails.printer = t(
        "dashboard.system_status_printer_desktop_required",
      );
    } else {
      try {
        const result = await printerInvoker();
        if (!result.ok) {
          nextStates.printer = "error";
          nextDetails.printer = t(
            "dashboard.system_status_printer_check_failed",
          );
        } else {
          const physicalPrinters = result.printers;
          const offlinePrinters = physicalPrinters.filter(
            (printer) => printer.isOffline,
          );
          const configuredSystemPrinters = configuredPrinters.filter(
            (printer) => printer.type === "usb",
          );
          const missingPrinters = configuredSystemPrinters.filter(
            (printer) =>
              !isConfiguredPrinterAvailable(printer, physicalPrinters),
          );

          if (offlinePrinters.length > 0 || missingPrinters.length > 0) {
            nextStates.printer = "error";
            nextDetails.printer = t(
              "dashboard.system_status_printer_problem",
              {
                count: offlinePrinters.length + missingPrinters.length,
              },
            );
          } else if (configuredPrinters.length === 0) {
            nextStates.printer = "warning";
            nextDetails.printer = t(
              "dashboard.system_status_printer_not_configured",
            );
          } else if (
            configuredSystemPrinters.length > 0 &&
            physicalPrinters.length === 0
          ) {
            nextStates.printer = "error";
            nextDetails.printer = t(
              "dashboard.system_status_printer_not_found",
            );
          } else {
            nextStates.printer = "healthy";
            nextDetails.printer = t(
              "dashboard.system_status_printer_ready",
              {
                count: configuredPrinters.length,
              },
            );
          }

          if (localCheck[1].status === "fulfilled" && localCheck[1].value > 0) {
            nextStates.printer = "warning";
            nextDetails.printer = t(
              "dashboard.system_status_prints_pending",
              {
                count: localCheck[1].value,
              },
            );
          }
        }
      } catch {
        nextStates.printer = "error";
        nextDetails.printer = t(
          "dashboard.system_status_printer_check_failed",
        );
      }
    }
    nextLatencies.printer = elapsedSince(printerStartedAt);

    if (!mountedRef.current) return;
    setStates(nextStates);
    setDetails(nextDetails);
    setLatencies(nextLatencies);
    setLastCheckedAt(new Date());
    setChecking(false);
  }, [
    configuredPrinters,
    isOnline,
    lastSyncError,
    licenseKey,
    queueCount,
    t,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    void runChecks();
    const interval = window.setInterval(() => {
      void runChecks();
    }, 60_000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [runChecks]);

  const resetService = useCallback(
    async (key: ServiceKey) => {
      if (resetting) return;
      setResetting(key);
      try {
        if (key === "printer") {
          const result = await flushPrintQueueNow();
          if (result.failed > 0) {
            toast.error(t("dashboard.system_status_reset_failed"));
          } else {
            toast.success(t("dashboard.system_status_printer_reset_done"));
          }
        } else if (key === "cloud") {
          await retrySync();
          toast.success(t("dashboard.system_status_sync_retry_done"));
        } else if (key === "storage") {
          window.location.reload();
          return;
        }
        await runChecks();
      } catch {
        toast.error(t("dashboard.system_status_reset_failed"));
      } finally {
        if (mountedRef.current) setResetting(null);
      }
    },
    [resetting, retrySync, runChecks, t],
  );

  const services = useMemo<SystemService[]>(
    () => [
      {
        key: "printer",
        title: t("dashboard.system_status_printers"),
        detail: details.printer,
        state: states.printer,
        latencyMs: latencies.printer,
        icon: Printer,
        canReset: states.printer !== "healthy",
        actionLabel:
          configuredPrinters.length === 0 && onOpenSettings
            ? t("dashboard.system_status_configure")
            : printQueueCount > 0
              ? t("dashboard.system_status_retry")
              : t("dashboard.system_status_reset"),
      },
      {
        key: "internet",
        title: t("dashboard.system_status_internet"),
        detail: details.internet,
        state: states.internet,
        latencyMs: latencies.internet,
        icon: isOnline ? Wifi : WifiOff,
        canReset: states.internet !== "healthy",
        actionLabel: t("dashboard.system_status_retry"),
      },
      {
        key: "cloud",
        title: t("dashboard.system_status_cloud"),
        detail: details.cloud,
        state: states.cloud,
        latencyMs: latencies.cloud,
        icon: Cloud,
        canReset: states.cloud !== "healthy",
        actionLabel: t("dashboard.system_status_retry"),
      },
      {
        key: "storage",
        title: t("dashboard.system_status_storage"),
        detail: details.storage,
        state: states.storage,
        latencyMs: latencies.storage,
        icon: Database,
        canReset: states.storage === "error",
        actionLabel: t("dashboard.system_status_restart"),
      },
    ],
    [
      configuredPrinters.length,
      details,
      isOnline,
      latencies,
      onOpenSettings,
      printQueueCount,
      states,
      t,
    ],
  );

  const issueCount = services.filter(
    (service) =>
      service.state === "warning" || service.state === "error",
  ).length;
  const allHealthy = !checking && issueCount === 0;

  const statusLabel = (state: ServiceState) => {
    if (state === "healthy") return t("dashboard.system_status_operational");
    if (state === "warning") return t("dashboard.system_status_attention");
    if (state === "error") return t("dashboard.system_status_problem");
    return t("dashboard.system_status_checking");
  };

  if (compact) {
    return (
      <section className="relative isolate overflow-hidden rounded-[1.4rem] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(249,251,255,0.97)_58%,rgba(241,245,249,0.94)_100%)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_-24px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/70">
        <span
          className="pointer-events-none absolute -right-12 -top-14 -z-10 size-36 rounded-full bg-slate-200/70 blur-3xl"
          aria-hidden
        />
        <span
          className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-400/70 to-transparent"
          aria-hidden
        />

        <header className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-[0_7px_18px_-10px_rgba(15,23,42,0.9)]">
              <ActivityStatusIcon healthy={allHealthy} checking={checking} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-slate-950">
                {t("dashboard.system_status_title")}
              </h2>
              <p
                className={`mt-0.5 flex items-center gap-1.5 truncate text-[8px] font-semibold ${
                  allHealthy
                    ? "text-emerald-600"
                    : checking
                      ? "text-slate-400"
                      : "text-amber-600"
                }`}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    allHealthy
                      ? "bg-emerald-500"
                      : checking
                        ? "animate-pulse bg-slate-400"
                        : "bg-amber-500"
                  }`}
                />
                <span className="truncate">
                  {checking
                    ? t("dashboard.system_status_checking")
                    : allHealthy
                      ? t("dashboard.system_status_all_operational")
                      : t("dashboard.system_status_needs_attention", {
                          count: issueCount,
                        })}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void runChecks()}
            disabled={checking || resetting !== null || isSyncing}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:border-sky-200 hover:text-sky-700 disabled:opacity-50"
            aria-label={t("dashboard.system_status_run_diagnostics")}
            title={t("dashboard.system_status_run_diagnostics")}
          >
            <RefreshCw
              className={`size-3 ${checking ? "animate-spin" : ""}`}
            />
          </button>
        </header>

        <ul className="relative mt-3 space-y-1.5" aria-live="polite">
          {services.map((service) => {
            const colors = stateClasses(service.state);
            const Icon = service.icon;
            const isResetting = resetting === service.key;
            const configurePrinter =
              service.key === "printer" &&
              configuredPrinters.length === 0 &&
              Boolean(onOpenSettings);

            return (
              <li
                key={service.key}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-100/90 bg-white/75 px-2 py-2 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.5)] transition hover:border-slate-200 hover:bg-white"
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-lg ring-1 ${colors.icon}`}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-bold text-slate-700">
                    {service.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[8px] text-slate-400">
                    {service.detail}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[7px] font-bold ${colors.label}`}
                  >
                    <span className={`size-1 rounded-full ${colors.dot}`} />
                    {statusLabel(service.state)}
                  </span>
                  {service.canReset ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (configurePrinter && onOpenSettings) {
                          onOpenSettings();
                          return;
                        }
                        void resetService(service.key);
                      }}
                      disabled={resetting !== null || checking || isSyncing}
                      className="inline-flex h-5 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[7px] font-bold text-slate-500 shadow-sm transition hover:border-sky-200 hover:text-sky-700 disabled:opacity-50"
                    >
                      {isResetting ? (
                        <Loader2 className="size-2 animate-spin" />
                      ) : configurePrinter ? (
                        <Settings2 className="size-2" />
                      ) : (
                        <RotateCcw className="size-2" />
                      )}
                      {service.actionLabel}
                    </button>
                  ) : (
                    <span className="text-[7px] font-medium tabular-nums text-slate-300">
                      {service.latencyMs == null
                        ? "—"
                        : `${service.latencyMs} ms`}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <footer className="relative mt-2.5 border-t border-slate-100 pt-2 text-[7px] font-medium text-slate-300">
          {lastCheckedAt
            ? t("dashboard.system_status_last_checked", {
                time: lastCheckedAt.toLocaleTimeString(
                  language === "sq" ? "sq-AL" : "en-US",
                  { hour: "2-digit", minute: "2-digit" },
                ),
              })
            : t("dashboard.system_status_checking")}
        </footer>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.35)] sm:p-5">
      <span
        className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-sky-100/50 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-[0_9px_24px_-12px_rgba(15,23,42,0.9)]">
              <ActivityStatusIcon healthy={allHealthy} checking={checking} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-slate-950">
                  {t("dashboard.system_status_title")}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                    allHealthy
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                      : checking
                        ? "border-slate-200 bg-slate-50 text-slate-500"
                        : "border-amber-100 bg-amber-50 text-amber-700"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      allHealthy
                        ? "bg-emerald-500"
                        : checking
                          ? "animate-pulse bg-slate-400"
                          : "bg-amber-500"
                    }`}
                  />
                  {checking
                    ? t("dashboard.system_status_checking")
                    : allHealthy
                      ? t("dashboard.system_status_all_operational")
                      : t("dashboard.system_status_needs_attention", {
                          count: issueCount,
                        })}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                {t("dashboard.system_status_subtitle")}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void runChecks()}
            disabled={checking || resetting !== null || isSyncing}
            className="h-8 rounded-xl border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw
              className={`mr-1.5 size-3.5 ${checking ? "animate-spin" : ""}`}
            />
            {t("dashboard.system_status_run_diagnostics")}
          </Button>
        </header>

        <div
          className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4"
          aria-live="polite"
        >
          {services.map((service) => {
            const colors = stateClasses(service.state);
            const Icon = service.icon;
            const isResetting = resetting === service.key;
            const configurePrinter =
              service.key === "printer" &&
              configuredPrinters.length === 0 &&
              Boolean(onOpenSettings);

            return (
              <article
                key={service.key}
                className="group flex min-h-[126px] flex-col rounded-2xl border border-slate-200/75 bg-slate-50/65 p-3 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`flex size-9 items-center justify-center rounded-xl ring-1 ${colors.icon}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[8px] font-bold ${colors.label}`}
                  >
                    <span className={`size-1.5 rounded-full ${colors.dot}`} />
                    {statusLabel(service.state)}
                  </span>
                </div>

                <div className="mt-2.5 min-w-0">
                  <h3 className="truncate text-[11px] font-bold text-slate-800">
                    {service.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 min-h-7 text-[9px] leading-3.5 text-slate-400">
                    {service.detail}
                  </p>
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <span className="text-[8px] font-medium text-slate-300">
                    {service.latencyMs == null
                      ? "—"
                      : `${service.latencyMs} ms`}
                  </span>
                  {service.canReset ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (configurePrinter && onOpenSettings) {
                          onOpenSettings();
                          return;
                        }
                        void resetService(service.key);
                      }}
                      disabled={resetting !== null || checking || isSyncing}
                      className="inline-flex h-6 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[8px] font-bold text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-700 disabled:opacity-50"
                    >
                      {isResetting ? (
                        <Loader2 className="size-2.5 animate-spin" />
                      ) : configurePrinter ? (
                        <Settings2 className="size-2.5" />
                      ) : (
                        <RotateCcw className="size-2.5" />
                      )}
                      {service.actionLabel}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[8px] font-medium text-slate-300">
          <span>
            {lastCheckedAt
              ? t("dashboard.system_status_last_checked", {
                  time: lastCheckedAt.toLocaleTimeString(
                    language === "sq" ? "sq-AL" : "en-US",
                    { hour: "2-digit", minute: "2-digit", second: "2-digit" },
                  ),
                })
              : t("dashboard.system_status_checking")}
          </span>
          <span>{t("dashboard.system_status_auto_refresh")}</span>
        </footer>
      </div>
    </section>
  );
}

function ActivityStatusIcon({
  healthy,
  checking,
}: {
  healthy: boolean;
  checking: boolean;
}) {
  if (checking) return <Loader2 className="size-5 animate-spin" />;
  if (healthy) return <CheckCircle2 className="size-5" />;
  return <AlertTriangle className="size-5" />;
}
