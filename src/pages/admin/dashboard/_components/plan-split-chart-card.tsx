import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  getAdminPlanDistribution,
  type AdminPlanDistributionRange,
} from "@/lib/supabase-pos/admin-ops.ts";

type PlanSplitChartCardProps = {
  period: AdminPlanDistributionRange;
};

export function PlanSplitChartCard({ period }: PlanSplitChartCardProps) {
  const planDistributionQuery = useQuery({
    queryKey: ["admin", "plan-distribution", period],
    queryFn: () => getAdminPlanDistribution(period),
  });

  const planData = useMemo(() => {
    const d = planDistributionQuery.data;
    if (!d) return [];
    return [
      { key: "starter", name: "Starter", value: d.starter, color: "#0066FF" },
      { key: "professional", name: "Professional", value: d.professional, color: "#44CC00" },
      { key: "enterprise", name: "Enterprise", value: d.enterprise, color: "#7C3AED" },
    ];
  }, [planDistributionQuery.data]);

  const planTotal = planDistributionQuery.data?.total ?? 0;
  const topPlan = useMemo(() => {
    if (!planData.length) return null;
    return planData.reduce((max, row) => (row.value > max.value ? row : max), planData[0]);
  }, [planData]);

  return (
    <div className="rounded-3xl border border-border/70 bg-gradient-to-b from-card via-card to-muted/25 p-4 shadow-[0_24px_56px_-28px_rgba(0,102,255,0.18)] dark:border-slate-700/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/50 dark:shadow-[0_24px_56px_-32px_rgba(0,0,0,0.65)]">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Plan Split</h3>
      </div>

      <div className="h-[196px]">
        {planDistributionQuery.isLoading ? (
          <Skeleton className="h-full w-full rounded-xl" />
        ) : planDistributionQuery.isError ? (
          <p className="flex h-full items-center justify-center text-center text-sm text-destructive">
            Could not load plan split.
          </p>
        ) : planTotal <= 0 ? (
          <p className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            No Paddle payments in selected range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={planData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={72}
                paddingAngle={3}
                strokeWidth={0}
              >
                {planData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value} (${((value / planTotal) * 100).toFixed(1)}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {planData.map((item) => (
          <div key={item.key} className="flex items-center justify-between text-xs">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </div>
            <span className="font-semibold tabular-nums text-foreground">
              {item.value}
              {planTotal > 0 ? ` (${((item.value / planTotal) * 100).toFixed(0)}%)` : ""}
            </span>
          </div>
        ))}
      </div>

      {topPlan && planTotal > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Top plan: <span className="font-semibold text-foreground">{topPlan.name}</span>
        </p>
      ) : null}
    </div>
  );
}
