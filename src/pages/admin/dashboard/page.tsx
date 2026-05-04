import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Euro, KeyRound, Repeat, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  getAdminActiveMrrEur,
  getAdminEstimatedLifetimeSubscriptionRevenueEur,
  getAdminStats,
  type AdminPlanDistributionRange,
} from "@/lib/supabase-pos/admin-ops.ts";
import { PlanSplitChartCard } from "./_components/plan-split-chart-card.tsx";
import { RecentTransactionsCard } from "./_components/recent-transactions-card.tsx";
import { TotalRevenueChartCard } from "./_components/total-revenue-chart-card.tsx";

const DASHBOARD_PERIOD_OPTIONS: { value: AdminPlanDistributionRange; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "all_time", label: "All time" },
];

const eurFmt = new Intl.NumberFormat("en-EU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurFmtDecimals = new Intl.NumberFormat("en-EU", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function AdminDashboardPage() {
  const [dashboardPeriod, setDashboardPeriod] =
    useState<AdminPlanDistributionRange>("last_12_months");

  const kpiQuery = useQuery({
    queryKey: ["admin", "dashboard-kpis"],
    queryFn: async () => {
      const [stats, mrr, totalRevenueEst] = await Promise.all([
        getAdminStats(),
        getAdminActiveMrrEur(),
        getAdminEstimatedLifetimeSubscriptionRevenueEur(),
      ]);
      return { ...stats, mrr, totalRevenueEst };
    },
  });

  return (
    <section className="space-y-4 px-6 pb-6 pt-0 lg:px-8 lg:pb-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiQuery.isLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_20px_-16px_rgba(2,6,23,0.12)] dark:shadow-none"
              >
                <Skeleton className="mb-3 h-9 w-9 rounded-full" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-8 w-32" />
                <Skeleton className="mt-2 h-3 w-full max-w-[200px]" />
              </div>
            ))}
          </>
        ) : kpiQuery.isError ? (
          <div className="col-span-full rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Could not load KPIs. Check your connection and try refreshing the page.
          </div>
        ) : kpiQuery.data ? (
          <>
            <KpiCard
              icon={<Euro className="size-4 text-[#0066FF]" />}
              label="Lifetime revenue"
              value={eurFmt.format(kpiQuery.data.totalRevenueEst)}
              hint="Estimated lifetime subscription revenue (list prices × tenure)."
            />
            <KpiCard
              icon={<Repeat className="size-4 text-[#44CC00]" />}
              label="MRR"
              value={eurFmtDecimals.format(kpiQuery.data.mrr)}
              hint="Monthly recurring revenue — estimated EUR/month from active, paying plans (MRR × 12 ≈ annual run rate)."
            />
            <KpiCard
              icon={<Users className="size-4 text-[#0066FF]" />}
              label="Active Clients"
              value={String(kpiQuery.data.totalClients)}
              hint="Distinct owner accounts (by email) across all venues."
            />
            <KpiCard
              icon={<KeyRound className="size-4 text-[#44CC00]" />}
              label="Active Licenses"
              value={String(kpiQuery.data.activeLicenses)}
              hint="Venues with an active, non-expired license."
            />
          </>
        ) : null}
      </div>

      {kpiQuery.data ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-muted-foreground">Reporting period</p>
            <div className="flex flex-wrap gap-2">
              {DASHBOARD_PERIOD_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDashboardPeriod(value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-sm transition-colors",
                    dashboardPeriod === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/80 bg-card text-muted-foreground hover:bg-muted/70 dark:border-slate-600/80 dark:hover:bg-slate-800/80",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <TotalRevenueChartCard currentMrrEur={kpiQuery.data.mrr} period={dashboardPeriod} />
            <PlanSplitChartCard period={dashboardPeriod} />
          </div>
          <RecentTransactionsCard />
        </>
      ) : null}
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_20px_-16px_rgba(2,6,23,0.12)] transition-shadow hover:shadow-[0_12px_28px_-18px_rgba(2,6,23,0.18)] dark:border-slate-700/80 dark:bg-card dark:shadow-none dark:hover:shadow-none">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/90 dark:border-slate-600/80 dark:bg-slate-900/60">
        {icon}
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}
