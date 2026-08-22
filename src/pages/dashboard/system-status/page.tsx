import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  CreditCard,
  Download,
  History,
  KeyRound,
  Loader2,
  RefreshCw,
  Server,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  checkVyntexServices,
  fetchStatusIncidents,
  type ServiceHealth,
  type ServiceStatusKey,
  type StatusIncident,
} from "@/lib/system-status.ts";
import { dashboardDateLocale } from "@/lib/dashboard-i18n.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { cn } from "@/lib/utils.ts";

const SERVICE_ICONS: Record<ServiceStatusKey, typeof Server> = {
  pos: Server,
  cloud: Cloud,
  api: Server,
  payments: CreditCard,
  downloads: Download,
  authentication: KeyRound,
};

export default function DashboardSystemStatusPage() {
  const { t, lang } = useDashboardLocale();
  const dateLocale = dashboardDateLocale(lang);
  const [services, setServices] = useState<ServiceHealth[] | null>(null);
  const [incidents, setIncidents] = useState<StatusIncident[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    const [health, history] = await Promise.all([
      checkVyntexServices(),
      fetchStatusIncidents(),
    ]);
    setServices(health);
    setIncidents(history);
    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const allOperational =
    services != null &&
    services.length > 0 &&
    services.every((service) => service.operational);
  const affectedCount =
    services?.filter((service) => !service.operational).length ?? 0;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4 pb-12 pt-16 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header
          className={cn(
            "relative overflow-hidden rounded-3xl border p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)] sm:p-8",
            allOperational
              ? "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50"
              : services
                ? "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50"
                : "border-slate-200 bg-white",
          )}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg",
                  allOperational
                    ? "bg-emerald-500 shadow-emerald-200"
                    : services
                      ? "bg-amber-500 shadow-amber-200"
                      : "bg-slate-500 shadow-slate-200",
                )}
              >
                {services === null ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : allOperational ? (
                  <CheckCircle2 className="size-6" />
                ) : (
                  <TriangleAlert className="size-6" />
                )}
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  {t("status.eyebrow")}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  {services === null
                    ? t("status.checking")
                    : allOperational
                      ? t("status.all_ok")
                      : affectedCount === 1
                        ? t("status.issues_one")
                        : t("status.issues_many", { count: affectedCount })}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {t("status.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Button
                variant="outline"
                onClick={() => void refresh()}
                disabled={checking}
                className="rounded-xl bg-white/80"
              >
                <RefreshCw className={cn("mr-2 size-4", checking && "animate-spin")} />
                {t("status.refresh")}
              </Button>
              <p className="text-[10px] text-slate-400">
                {lastChecked
                  ? t("status.last_checked", {
                      time: lastChecked.toLocaleTimeString(dateLocale),
                    })
                  : t("status.running_checks")}
              </p>
            </div>
          </div>
        </header>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold">{t("status.services")}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("status.auto_refresh")}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {services === null
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
                  />
                ))
              : services.map((service) => (
                  <ServiceCard key={service.key} service={service} />
                ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <History className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">{t("status.incident_title")}</h2>
              <p className="text-xs text-slate-500">
                {t("status.incident_subtitle")}
              </p>
            </div>
          </div>

          {incidents.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center p-8 text-center">
              <CheckCircle2 className="size-8 text-emerald-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {t("status.no_incidents")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t("status.no_incidents_hint")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {incidents.map((incident) => (
                <IncidentRow key={incident.id} incident={incident} />
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-[11px] text-slate-400">
          {t("status.footer")}
        </p>
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const { t } = useDashboardLocale();
  const Icon = SERVICE_ICONS[service.key];
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            service.operational
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600",
          )}
        >
          <Icon className="size-5" />
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            service.operational
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              service.operational ? "bg-emerald-500" : "bg-red-500",
            )}
          />
          {service.operational ? t("status.operational") : t("status.disruption")}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-semibold">{t(`status.service.${service.key}`)}</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        {service.latencyMs == null
          ? t("status.availability_check")
          : t("status.response_ms", { ms: service.latencyMs })}
      </p>
    </article>
  );
}

function incidentStatusLabel(
  status: StatusIncident["status"],
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (status === "investigating") return t("status.investigating");
  if (status === "resolved" || status === "completed") return t("status.resolved");
  return status;
}

function IncidentRow({ incident }: { incident: StatusIncident }) {
  const { t } = useDashboardLocale();
  const resolved =
    incident.status === "resolved" || incident.status === "completed";
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="w-24 shrink-0">
        <p className="text-xs font-semibold text-slate-700">
          {new Date(incident.startedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">
          {new Date(incident.startedAt).getFullYear()}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{incident.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {incident.service}
          {incident.details ? ` — ${incident.details}` : ""}
        </p>
      </div>
      <span
        className={cn(
          "inline-flex self-start rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize sm:self-auto",
          resolved
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700",
        )}
      >
        {incidentStatusLabel(incident.status, t)}
      </span>
    </div>
  );
}
