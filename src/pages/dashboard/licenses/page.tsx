import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Copy,
  CreditCard,
  History,
  KeyRound,
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

function getStatus(row: OwnedRestaurantRow): { label: string; active: boolean } {
  const expiry = row.license_expiry ? new Date(row.license_expiry).getTime() : 0;
  const active = row.license_status === "active" && expiry > Date.now();
  if (active) return { label: "Active", active: true };
  if (row.license_status === "suspended") return { label: "Suspended", active: false };
  return { label: "Expired", active: false };
}

export default function DashboardLicensesPage() {
  const { lang } = useDashboardLocale();
  const locale = lang === "sq" ? "sq-AL" : "en-US";
  const [licenses, setLicenses] = useState<OwnedRestaurantRow[] | null>(null);
  const [copied, setCopied] = useState(false);

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
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (licenses.length === 0) {
    return (
      <div className="flex min-h-full w-full items-center justify-center bg-slate-50/80 px-6">
        <p className="text-base font-medium text-slate-500">
          You don&apos;t have any licenses.
        </p>
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

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      toast.success("License key copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the license key.");
    }
  };

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-slate-50 via-white to-sky-50/50 px-4 pb-12 pt-16 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600">
            Licenses
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            License Overview
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Review your current plan, activation details, device usage, and license history.
          </p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-45px_rgba(14,116,202,0.35)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-sky-50 via-white to-emerald-50/50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
                <ShieldCheck className="size-6" />
              </span>
              <div>
                <p className="text-xs font-medium text-sky-700">
                  {dashboardTypeLabel(current.type, lang)}
                </p>
                <h2 className="mt-0.5 text-xl font-bold">
                  {dashboardPlanLabel(current.plan ?? "professional", lang)}
                </h2>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex self-start items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1",
                currentStatus.active
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-red-50 text-red-700 ring-red-200",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  currentStatus.active ? "bg-emerald-500" : "bg-red-500",
                )}
              />
              {currentStatus.label.toUpperCase()}
            </span>
          </div>

          <div className="p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 md:col-span-2">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <KeyRound className="size-3.5 text-sky-500" />
                  License Key
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold tracking-wider">
                    {licenseKey}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void copyKey()}
                    className="size-8 shrink-0 rounded-lg"
                  >
                    {copied ? (
                      <Check className="size-4 text-emerald-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Detail label="Status" value={currentStatus.label} />
              <Detail label="Plan" value={dashboardPlanLabel(current.plan ?? "professional", lang)} />
              <Detail label="Activated Date" value={formatDate(current.created_at, locale)} />
              <Detail label="Expiration Date" value={formatDate(current.license_expiry, locale)} />
              <Detail
                label="Renewal Date"
                value={currentStatus.active ? formatDate(current.license_expiry, locale) : "—"}
              />
              <Detail label="Number of devices" value={`${devices.length}`} />
              <Detail label="Devices used" value={`${devices.length} active`} />
              <Detail label="Maximum devices" value={`${maxDevices}`} />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-xl bg-sky-600 text-white hover:bg-sky-700">
                <Link to="/dashboard/settings?tab=billing">
                  <CreditCard className="mr-2 size-4" />
                  Renew License
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl border-sky-200 text-sky-700">
                <Link to="/pricing">
                  <Sparkles className="mr-2 size-4" />
                  Upgrade Plan
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <History className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">License History</h2>
              <p className="text-xs text-slate-500">All licenses purchased by this account.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">License</th>
                  <th className="px-5 py-3">VYN Type</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Activated</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {orderedLicenses.map((row) => {
                  const status = getStatus(row);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <code className="font-mono text-xs font-semibold tracking-wide text-slate-700">
                          {row.license_key.trim().toUpperCase()}
                        </code>
                      </td>
                      <td className="px-5 py-4 font-medium">
                        {dashboardTypeLabel(row.type, lang)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {dashboardPlanLabel(row.plan ?? "professional", lang)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(row.created_at, locale)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(row.license_expiry, locale)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            status.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <CalendarDays className="size-3.5 text-sky-500" />
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
