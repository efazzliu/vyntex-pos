import { useId, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  getAdminPayingMrrTrendEurByRange,
  type AdminMrrTrendPoint,
  type AdminPlanDistributionRange,
} from "@/lib/supabase-pos/admin-ops.ts";

const headlineFmt = new Intl.NumberFormat("en-EU", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const deltaFmt = new Intl.NumberFormat("en-EU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function compactEurAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `€${(value / 1_000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `€${Math.round(value)}`;
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: AdminMrrTrendPoint }>;
};

function RevenueTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-border/60 bg-popover/90 px-3.5 py-2.5 shadow-[0_16px_40px_-20px_rgba(0,102,255,0.35)] backdrop-blur-md dark:border-slate-600/60 dark:bg-slate-950/90">
      <p className="text-[11px] font-medium text-muted-foreground">{row.monthTitle}</p>
      <div className="mt-1 flex items-center justify-between gap-8 text-sm">
        <span className="text-muted-foreground">Total Revenue</span>
        <span className="font-semibold tabular-nums text-foreground">
          {headlineFmt.format(row.mrrEur)}
        </span>
      </div>
    </div>
  );
}

type TotalRevenueChartCardProps = {
  /** Live MRR (current); shown as headline to match platform snapshot. */
  currentMrrEur: number;
  period: AdminPlanDistributionRange;
};

export function TotalRevenueChartCard({ currentMrrEur, period }: TotalRevenueChartCardProps) {
  const fillId = useId().replace(/:/g, "");
  const strokeId = `${fillId}-stroke`;

  const trendQuery = useQuery({
    queryKey: ["admin", "mrr-trend", period],
    queryFn: () => getAdminPayingMrrTrendEurByRange(period),
  });

  const { pctChange, deltaEur, positive } = useMemo(() => {
    const s = trendQuery.data;
    if (!s || s.length < 2) {
      return { pctChange: null as number | null, deltaEur: null as number | null, positive: true };
    }
    const last = s[s.length - 1].mrrEur;
    const prev = s[s.length - 2].mrrEur;
    const delta = last - prev;
    const pct = prev > 0 ? (delta / prev) * 100 : last > 0 ? 100 : 0;
    return { pctChange: pct, deltaEur: delta, positive: delta >= 0 };
  }, [trendQuery.data]);

  const yMax = useMemo(() => {
    const s = trendQuery.data;
    if (!s?.length) return 1;
    const max = Math.max(...s.map((d) => d.mrrEur), currentMrrEur);
    return Math.max(max * 1.12, 1);
  }, [trendQuery.data, currentMrrEur]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-b from-card via-card to-muted/25 shadow-[0_24px_56px_-28px_rgba(0,102,255,0.18)] dark:border-slate-700/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/50 dark:shadow-[0_24px_56px_-32px_rgba(0,0,0,0.65)]">
      <div
        className="pointer-events-none absolute -right-24 -top-24 size-[320px] rounded-full bg-[#0066FF]/[0.07] blur-3xl dark:bg-[#0066FF]/10"
        aria-hidden
      />
      <div className="relative p-6 pb-2 sm:p-7 sm:pb-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Total Revenue</h2>
          <p className="text-xs text-muted-foreground sm:text-[13px]">
            Paddle cash collected per month — live MRR headline from active subscriptions.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3 sm:mt-6">
          {trendQuery.isLoading ? (
            <Skeleton className="h-10 w-48 rounded-lg" />
          ) : (
            <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
              {headlineFmt.format(currentMrrEur)}
            </p>
          )}
          {!trendQuery.isLoading && pctChange !== null && deltaEur !== null && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                  positive
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-500/12 text-rose-700 dark:text-rose-400",
                )}
              >
                {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {positive ? "+" : ""}
                {pctChange.toFixed(2)}%
              </span>
              <span className="text-xs text-muted-foreground sm:text-sm">
                <span className="font-medium text-foreground tabular-nums">
                  {positive ? "+" : ""}
                  {deltaFmt.format(deltaEur)}
                </span>{" "}
                vs prior month-end
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="relative h-[240px] w-full px-2 pb-4 sm:h-[280px] sm:px-4 sm:pb-5">
        {trendQuery.isLoading ? (
          <div className="flex h-full items-center justify-center px-6">
            <Skeleton className="h-full w-full rounded-xl" />
          </div>
        ) : trendQuery.isError ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
            Could not load revenue history.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendQuery.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0066FF" stopOpacity={0.35} />
                  <stop offset="55%" stopColor="#0066FF" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#0066FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0066FF" />
                  <stop offset="100%" stopColor="#00C2FF" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="4 6"
                vertical={false}
                className="stroke-border/80 dark:stroke-slate-700/80"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                className="text-[11px] fill-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={compactEurAxis}
                className="text-[11px] fill-muted-foreground"
                width={44}
                domain={[0, yMax]}
              />
              <Tooltip
                content={<RevenueTooltip />}
                cursor={{
                  stroke: "hsl(var(--muted-foreground) / 0.35)",
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                }}
              />
              <Area
                type="monotone"
                dataKey="mrrEur"
                stroke={`url(#${strokeId})`}
                strokeWidth={2.5}
                fill={`url(#${fillId})`}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "#0066FF",
                  stroke: "var(--card, #ffffff)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
