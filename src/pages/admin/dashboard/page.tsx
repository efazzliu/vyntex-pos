import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  Euro,
  KeyRound,
  LifeBuoy,
  Repeat,
  Users,
  UsersRound,
} from "lucide-react";
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
import { AdminKpiCard } from "@/pages/admin/_components/admin-card.tsx";
import { adminCardClass, adminPageSectionClass } from "@/pages/admin/_lib/admin-ui.ts";

const DASHBOARD_PERIOD_OPTIONS: { value: AdminPlanDistributionRange; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_6_months", label: "6 months" },
  { value: "last_12_months", label: "12 months" },
  { value: "all_time", label: "All time" },
];

const QUICK_LINKS = [
  {
    group: "Business",
    items: [
      {
        label: "Clients",
        href: "/admin/businesses",
        hint: "Accounts & venues",
        icon: Building2,
      },
      {
        label: "Licenses",
        href: "/admin/licenses",
        hint: "Keys & renewals",
        icon: KeyRound,
      },
    ],
  },
  {
    group: "Finance",
    items: [
      {
        label: "Revenue",
        href: "/admin/subscriptions",
        hint: "MRR & charges",
        icon: Euro,
      },
      {
        label: "Analytics",
        href: "/admin/reports",
        hint: "Trends & reports",
        icon: BarChart3,
      },
    ],
  },
  {
    group: "Ops",
    items: [
      {
        label: "Support",
        href: "/admin/support",
        hint: "Inbox & replies",
        icon: LifeBuoy,
      },
      {
        label: "Team",
        href: "/admin/team",
        hint: "Admin access",
        icon: UsersRound,
      },
    ],
  },
] as const;

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
    <section className={adminPageSectionClass}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/35">
            Overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-500 dark:text-white/45">
            Snapshot of revenue, clients, and licenses — jump to the right section when you need detail.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiQuery.isLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn(adminCardClass, "p-5")}>
                <Skeleton className="mb-3 h-8 w-8 rounded-lg" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-8 w-28" />
              </div>
            ))}
          </>
        ) : kpiQuery.isError ? (
          <div
            className={cn(
              adminCardClass,
              "col-span-full border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive",
            )}
          >
            Could not load KPIs. Check your connection and try refreshing the page.
          </div>
        ) : kpiQuery.data ? (
          <>
            <KpiCard
              icon={<Euro className="size-4 text-[#0066FF]" />}
              label="Lifetime revenue"
              value={eurFmt.format(kpiQuery.data.totalRevenueEst)}
              hint="Paddle net collected"
            />
            <KpiCard
              icon={<Repeat className="size-4 text-[#44CC00]" />}
              label="MRR"
              value={eurFmtDecimals.format(kpiQuery.data.mrr)}
              hint="Active subscriptions"
            />
            <KpiCard
              icon={<Users className="size-4 text-[#0066FF]" />}
              label="Active clients"
              value={String(kpiQuery.data.totalClients)}
              hint="Distinct owners"
            />
            <KpiCard
              icon={<KeyRound className="size-4 text-[#44CC00]" />}
              label="Active licenses"
              value={String(kpiQuery.data.activeLicenses)}
              hint="Non-expired venues"
            />
          </>
        ) : null}
      </div>

      <div className={cn(adminCardClass, "p-4 sm:p-5")}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/35">
              Shortcuts
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-white/85">
              Go where you need to work
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {QUICK_LINKS.map((group) => (
            <div key={group.group} className="space-y-2">
              <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
                {group.group}
              </p>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5",
                      "transition-colors hover:border-slate-300 hover:bg-white",
                      "dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.06]",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
                      <item.icon className="size-3.5 text-slate-600 dark:text-white/70" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-slate-800 dark:text-white/90">
                        {item.label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400 dark:text-white/35">
                        {item.hint}
                      </span>
                    </span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-slate-300 transition-colors group-hover:text-[#0066FF] dark:text-white/25" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {kpiQuery.data ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-white/85">Performance</p>
              <p className="text-xs text-slate-400 dark:text-white/35">
                Charts update with the selected reporting period
              </p>
            </div>
            <div
              role="tablist"
              aria-label="Reporting period"
              className="inline-flex w-full flex-wrap gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:w-auto dark:border-white/10 dark:bg-white/[0.04]"
            >
              {DASHBOARD_PERIOD_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={dashboardPeriod === value}
                  onClick={() => setDashboardPeriod(value)}
                  className={cn(
                    "flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:flex-none",
                    dashboardPeriod === value
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80",
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
    <AdminKpiCard>
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        {icon}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </AdminKpiCard>
  );
}
