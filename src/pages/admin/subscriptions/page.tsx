import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Euro, RefreshCcw, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  getAdminActiveMrrEur,
  getAdminEstimatedLifetimeSubscriptionRevenueEur,
  getAdminPlanDistribution,
  getAdminRecentTransactions,
  getAdminStats,
} from "@/lib/supabase-pos/admin-ops.ts";

const eur0 = new Intl.NumberFormat("en-EU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eur2 = new Intl.NumberFormat("en-EU", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function planLabel(plan: string): string {
  if (plan === "starter") return "Starter";
  if (plan === "professional") return "Professional";
  return "Enterprise";
}

export default function AdminSubscriptionsPage() {
  const kpiQuery = useQuery({
    queryKey: ["admin", "revenue-kpis"],
    queryFn: async () => {
      const [stats, mrr, totalRevenue] = await Promise.all([
        getAdminStats(),
        getAdminActiveMrrEur(),
        getAdminEstimatedLifetimeSubscriptionRevenueEur(),
      ]);
      return { stats, mrr, totalRevenue, arr: mrr * 12 };
    },
  });

  const planSplitQuery = useQuery({
    queryKey: ["admin", "revenue-plan-split", "12m"],
    queryFn: () => getAdminPlanDistribution("last_12_months"),
  });

  const txQuery = useQuery({
    queryKey: ["admin", "revenue-recent-transactions"],
    queryFn: () => getAdminRecentTransactions(6),
  });

  const planRows = useMemo(() => {
    const d = planSplitQuery.data;
    if (!d || d.total <= 0) return [];
    return [
      { label: "Starter", value: d.starter, pct: (d.starter / d.total) * 100, color: "bg-[#0066FF]" },
      {
        label: "Professional",
        value: d.professional,
        pct: (d.professional / d.total) * 100,
        color: "bg-[#44CC00]",
      },
      { label: "Enterprise", value: d.enterprise, pct: (d.enterprise / d.total) * 100, color: "bg-[#7C3AED]" },
    ];
  }, [planSplitQuery.data]);

  return (
    <section className="space-y-5 p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(140deg,#ffffff_0%,#f3f9ff_52%,#f5fff1_100%)] p-6 shadow-[0_26px_64px_-40px_rgba(2,6,23,0.38)] dark:border-slate-700/70 dark:bg-[linear-gradient(140deg,#070d1f_0%,#08142c_50%,#0b1824_100%)]">
        <div
          className="pointer-events-none absolute -right-10 -top-8 h-44 w-44 rounded-full bg-[#0066FF]/20 blur-3xl dark:bg-[#0066FF]/30"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-14 left-4 h-44 w-44 rounded-full bg-[#44CC00]/15 blur-3xl dark:bg-[#44CC00]/20"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300/70">
              Revenue Command
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Subscriptions Revenue
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
              MRR, ARR, plan mix dhe pagesat e fundit ne nje panel modern.
            </p>
          </div>
          <Badge className="rounded-full bg-[#0066FF] px-3 py-1 text-white">Live Snapshot</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric3DCard
          icon={<RefreshCcw className="size-4" />}
          title="MRR"
          value={kpiQuery.isLoading ? "..." : eur2.format(kpiQuery.data?.mrr ?? 0)}
          hint="From active Paddle subscriptions"
          tone="blue"
          loading={kpiQuery.isLoading}
        />
        <Metric3DCard
          icon={<Wallet className="size-4" />}
          title="ARR"
          value={kpiQuery.isLoading ? "..." : eur0.format(kpiQuery.data?.arr ?? 0)}
          hint="MRR x 12 run-rate"
          tone="green"
          loading={kpiQuery.isLoading}
        />
        <Metric3DCard
          icon={<Euro className="size-4" />}
          title="Total Revenue"
          value={kpiQuery.isLoading ? "..." : eur0.format(kpiQuery.data?.totalRevenue ?? 0)}
          hint="Paddle charges collected (minus refunds)"
          tone="violet"
          loading={kpiQuery.isLoading}
        />
        <Metric3DCard
          icon={<CreditCard className="size-4" />}
          title="Active Licenses"
          value={kpiQuery.isLoading ? "..." : String(kpiQuery.data?.stats.activeLicenses ?? 0)}
          hint="Paying active accounts"
          tone="slate"
          loading={kpiQuery.isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.4)] dark:border-slate-700/70 dark:bg-slate-900/80">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Plan Mix (last 12 months)</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300/70">
            Distribution of clients by subscription plan.
          </p>
          <div className="mt-4 space-y-3">
            {planSplitQuery.isLoading ? (
              <>
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </>
            ) : planRows.length ? (
              planRows.map((row) => (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{row.label}</span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-300/80">
                      {row.value} ({row.pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700/70">
                    <div
                      className={`h-2 rounded-full ${row.color}`}
                      style={{ width: `${Math.max(6, Math.min(100, row.pct))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-300/70">No plan data available.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.4)] dark:border-slate-700/70 dark:bg-slate-900/80">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Revenue Transactions</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300/70">
            Latest paid subscription events from active licenses.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/70">
            <div className="grid grid-cols-[1fr_1fr_0.8fr_0.7fr] bg-slate-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/70 dark:text-slate-300/80">
              <span>Client</span>
              <span>Plan</span>
              <span>Cycle</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="max-h-[320px] overflow-auto">
              {txQuery.isLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-lg" />
                  ))}
                </div>
              ) : txQuery.data?.length ? (
                txQuery.data.map((tx) => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[1fr_1fr_0.8fr_0.7fr] items-center gap-2 border-t border-slate-200/70 px-3 py-2.5 text-xs dark:border-slate-700/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                        {tx.customerName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-300/70">
                        {tx.customerEmail}
                      </p>
                    </div>
                    <span className="text-slate-600 dark:text-slate-300">{planLabel(tx.plan)}</span>
                    <span className="text-slate-500 dark:text-slate-300/80">
                      {tx.cycle === "yearly" ? "Yearly" : "Monthly"}
                    </span>
                    <span className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {eur0.format(tx.amountEur)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300/70">
                  No transactions found.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric3DCard({
  icon,
  title,
  value,
  hint,
  tone,
  loading,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  hint: string;
  tone: "blue" | "green" | "violet" | "slate";
  loading: boolean;
}) {
  const toneClass =
    tone === "blue"
      ? "from-[#0066FF]/16 to-cyan-400/12 dark:from-[#0066FF]/24 dark:to-cyan-400/14"
      : tone === "green"
        ? "from-[#44CC00]/14 to-emerald-400/10 dark:from-[#44CC00]/22 dark:to-emerald-400/12"
        : tone === "violet"
          ? "from-violet-500/14 to-fuchsia-400/10 dark:from-violet-500/22 dark:to-fuchsia-400/12"
          : "from-slate-400/14 to-slate-300/10 dark:from-slate-500/22 dark:to-slate-400/10";

  return (
    <div className="group relative [transform-style:preserve-3d] [transform:perspective(1200px)_rotateX(0deg)_translateY(0)] transition-transform duration-300 hover:[transform:perspective(1200px)_rotateX(6deg)_translateY(-6px)]">
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${toneClass} blur-xl`} aria-hidden />
      <div className="relative rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_46px_-36px_rgba(2,6,23,0.4)] dark:border-slate-700/70 dark:bg-slate-900/80">
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 dark:border-slate-600/80 dark:bg-slate-800 dark:text-slate-200">
          {icon}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300/70">
          {title}
        </p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-24 rounded-lg" />
        ) : (
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
        )}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300/70">{hint}</p>
      </div>
    </div>
  );
}
