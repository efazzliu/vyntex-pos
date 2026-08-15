import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  Copy,
  CreditCard,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  fetchAllRestaurantsOwnedBySession,
  type OwnedRestaurantRow,
} from "@/lib/supabase-pos/phone-pos-session.ts";
import {
  effectiveMaxTerminals,
  parseRegisteredDeviceIds,
} from "@/lib/dashboard-overview-data.ts";
import { dashboardPlanLabel, dashboardTypeLabel } from "@/lib/dashboard-i18n.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysRemaining(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const expiry = new Date(iso).getTime();
  if (!Number.isFinite(expiry)) return null;
  return Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
}

function getStatus(row: OwnedRestaurantRow): { labelKey: string; active: boolean } {
  const expiry = row.license_expiry ? new Date(row.license_expiry).getTime() : 0;
  const active = row.license_status === "active" && expiry > Date.now();
  if (active) return { labelKey: "licenses.status_active", active: true };
  if (row.license_status === "suspended") {
    return { labelKey: "licenses.status_suspended", active: false };
  }
  return { labelKey: "licenses.status_expired", active: false };
}

export default function DashboardLicensesPage() {
  const { lang, t } = useDashboardLocale();
  const locale = lang === "sq" ? "sq-AL" : "en-US";
  const [licenses, setLicenses] = useState<OwnedRestaurantRow[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAllRestaurantsOwnedBySession()
      .then((rows) => {
        if (!cancelled) setLicenses(rows);
      })
      .catch(() => {
        if (!cancelled) setLicenses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (licenses === null) return;
    const id = window.requestAnimationFrame(() => setReveal(true));
    return () => window.cancelAnimationFrame(id);
  }, [licenses]);

  const orderedLicenses = useMemo(() => {
    return [...(licenses ?? [])].sort((a, b) => {
      const aActive = getStatus(a).active ? 1 : 0;
      const bActive = getStatus(b).active ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
    });
  }, [licenses]);

  if (licenses === null) {
    return (
      <div className="w-full space-y-5 px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <Skeleton className="h-28 rounded-[1.75rem]" />
        <Skeleton className="h-72 rounded-[1.75rem]" />
      </div>
    );
  }

  if (licenses.length === 0) {
    return (
      <div className="flex min-h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e8f3ff_0%,_#f4f7fb_45%,_#eef2f7_100%)] px-6">
        <p className="text-base font-medium text-slate-500">{t("licenses.empty")}</p>
      </div>
    );
  }

  const current = orderedLicenses[0];
  const currentStatus = getStatus(current);
  const devices = parseRegisteredDeviceIds(current.registered_devices, current.device_id);
  const maxDevices = effectiveMaxTerminals(
    current.plan ?? "professional",
    current.max_terminals,
  );
  const licenseKey = current.license_key.trim().toUpperCase();
  const remaining = daysRemaining(current.license_expiry);
  const devicePct = maxDevices > 0 ? Math.min(100, (devices.length / maxDevices) * 100) : 0;
  const termPct =
    remaining != null && remaining > 0
      ? Math.min(100, Math.max(8, (remaining / 30) * 100))
      : currentStatus.active
        ? 100
        : 0;

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      toast.success(t("toast.license_copied"));
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("toast.copy_failed"));
    }
  };

  const facts = [
    { label: t("licenses.field_status"), value: t(currentStatus.labelKey) },
    {
      label: t("licenses.field_plan"),
      value: dashboardPlanLabel(current.plan ?? "professional", lang),
    },
    { label: t("licenses.field_activated"), value: formatDate(current.created_at, locale) },
    {
      label: t("licenses.field_expires"),
      value: formatDate(current.license_expiry, locale),
    },
    {
      label: t("licenses.field_renewal"),
      value: currentStatus.active ? formatDate(current.license_expiry, locale) : "—",
    },
    {
      label: t("licenses.field_devices"),
      value: t("licenses.devices_used", {
        used: devices.length,
        max: maxDevices,
      }),
    },
  ];

  return (
    <div className="licenses-page relative min-h-full w-full overflow-x-hidden px-4 pb-14 pt-16 text-slate-900 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_10%_-10%,_#d7ebff_0%,_transparent_55%),radial-gradient(ellipse_90%_70%_at_100%_0%,_#c8f1ef_0%,_transparent_50%),linear-gradient(180deg,_#f3f7fc_0%,_#eef2f7_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(15,40,80,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,40,80,0.04)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]"
      />

      <div
        className={cn(
          "relative mx-auto w-full max-w-5xl space-y-6 transition-all duration-700 ease-out",
          reveal ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0a7ea4]">
            {t("licenses.eyebrow")}
          </p>
          <h1 className="font-sans text-[1.85rem] font-bold leading-tight tracking-tight text-[#0b1f3a] sm:text-4xl">
            {t("licenses.title")}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-[15px]">
            {t("licenses.subtitle")}
          </p>
        </header>

        {/* Digital credential / pass */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-[#16325a]/80 bg-[#07182e] text-white shadow-[0_30px_80px_-48px_rgba(7,24,46,0.85)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[#00a8c7]/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-10 size-64 rounded-full bg-[#0066ff]/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-40 [background:repeating-linear-gradient(-45deg,transparent,transparent_10px,rgba(255,255,255,0.035)_10px,rgba(255,255,255,0.035)_11px)]"
          />

          <div className="relative flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066ff] to-[#00a8c7] text-white shadow-[0_12px_30px_-12px_rgba(0,168,199,0.9)]">
                  <ShieldCheck className="size-6" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#7ec8dc]">
                    {dashboardTypeLabel(current.type, lang)}
                  </p>
                  <h2 className="mt-1 truncate font-sans text-2xl font-bold tracking-tight sm:text-3xl">
                    {dashboardPlanLabel(current.plan ?? "professional", lang)}
                  </h2>
                </div>
              </div>

              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tracking-wide",
                  currentStatus.active
                    ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30"
                    : "bg-rose-400/15 text-rose-300 ring-1 ring-rose-300/30",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    currentStatus.active
                      ? "animate-pulse bg-emerald-400"
                      : "bg-rose-400",
                  )}
                />
                {t(currentStatus.labelKey).toUpperCase()}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.04] p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a8d5e2]">
                    {t("licenses.field_key")}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void copyKey()}
                    className="h-8 rounded-lg px-2.5 text-xs text-[#b7e4ef] hover:bg-white/10 hover:text-white"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1.5 size-3.5 text-emerald-300" />
                        {t("licenses.copied")}
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 size-3.5" />
                        {t("licenses.copy")}
                      </>
                    )}
                  </Button>
                </div>
                <code className="mt-3 block break-all font-mono text-[15px] font-semibold tracking-[0.14em] text-white sm:text-lg">
                  {licenseKey}
                </code>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a8d5e2]">
                    {t("licenses.field_term")}
                  </p>
                  <span className="text-xs font-medium text-[#b7e4ef]">
                    {remaining != null && remaining >= 0
                      ? t("licenses.days_left", { count: remaining })
                      : t(currentStatus.labelKey)}
                  </span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-1000 ease-out",
                      currentStatus.active
                        ? "bg-gradient-to-r from-[#0066ff] to-[#00d4c8]"
                        : "bg-rose-400",
                    )}
                    style={{ width: reveal ? `${termPct}%` : "0%" }}
                  />
                </div>
                <p className="mt-3 text-xs font-medium text-[#c5e6ef]">
                  {t("licenses.valid_until", {
                    date: formatDate(current.license_expiry, locale),
                  })}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Facts — single surface, no nested card clutter */}
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,40,80,0.45)] backdrop-blur-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-[#0b1f3a]">{t("licenses.details_title")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t("licenses.details_subtitle")}</p>
          </div>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((fact, index) => (
              <div
                key={fact.label}
                className={cn(
                  "px-5 py-4 sm:px-6",
                  index < facts.length - 1 && "border-b border-slate-100",
                  "sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0",
                  "lg:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0",
                )}
              >
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 text-[15px] font-semibold text-[#13253f]">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="size-4 text-[#0a7ea4]" />
              <p className="text-sm font-semibold text-[#0b1f3a]">
                {t("licenses.capacity_title")}
              </p>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="text-xs text-slate-500">
                {t("licenses.capacity_hint")}
              </p>
              <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[#0b1f3a]">
                {devices.length}
                <span className="text-slate-400"> / {maxDevices}</span>
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0066ff] to-[#00a8c7] transition-[width] duration-1000 ease-out"
                style={{ width: reveal ? `${devicePct}%` : "0%" }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:px-6">
            <Button
              asChild
              className="h-11 flex-1 rounded-xl bg-gradient-to-r from-[#0066ff] to-[#00a8c7] text-white shadow-sm hover:opacity-95"
            >
              <Link to="/dashboard/settings?tab=billing">
                <CreditCard className="mr-2 size-4" />
                {t("licenses.renew")}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 flex-1 rounded-xl border-[#9fd3e0] bg-white text-[#0a6f8f] hover:bg-[#f0fafc]"
            >
              <Link to="/pricing">
                <Sparkles className="mr-2 size-4" />
                {t("licenses.upgrade")}
              </Link>
            </Button>
          </div>
        </section>

        {/* History — mobile-first rows */}
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_-40px_rgba(15,40,80,0.35)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-[#0b1f3a]">{t("licenses.history_title")}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{t("licenses.history_subtitle")}</p>
            </div>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600">
              {orderedLicenses.length}
            </span>
          </div>

          <ul className="divide-y divide-slate-100">
            {orderedLicenses.map((row, index) => {
              const status = getStatus(row);
              return (
                <li
                  key={row.id}
                  className={cn(
                    "group px-5 py-4 transition-colors hover:bg-[#f7fbff] sm:px-6",
                    "animate-in fade-in slide-in-from-bottom-1 fill-mode-both",
                  )}
                  style={{ animationDelay: `${120 + index * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <code className="font-mono text-[12px] font-semibold tracking-wide text-[#1a3358] sm:text-[13px]">
                        {row.license_key.trim().toUpperCase()}
                      </code>
                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {dashboardTypeLabel(row.type, lang)}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {dashboardPlanLabel(row.plan ?? "professional", lang)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold",
                        status.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          status.active ? "bg-emerald-500" : "bg-slate-400",
                        )}
                      />
                      {t(status.labelKey)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      {t("licenses.field_activated")}:{" "}
                      <strong className="font-medium text-slate-700">
                        {formatDate(row.created_at, locale)}
                      </strong>
                    </span>
                    <span>
                      {t("licenses.field_expires")}:{" "}
                      <strong className="font-medium text-slate-700">
                        {formatDate(row.license_expiry, locale)}
                      </strong>
                    </span>
                    {index === 0 ? (
                      <Link
                        to="/dashboard/settings?tab=billing"
                        className="inline-flex items-center gap-1 font-medium text-[#0a7ea4] hover:text-[#06607e]"
                      >
                        {t("licenses.manage")}
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
