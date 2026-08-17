import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
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
import {
  ArrowRight,
  KeyRound,
  Plus,
  ShoppingBag,
  Store,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { useAdminCenter } from "@/pages/dashboard/_components/admin-center-context.tsx";
import {
  AdminPage,
  GrowthBadge,
  MiniSpark,
  StatusDot,
  acCard,
  acCardHover,
} from "@/pages/dashboard/_components/admin-center-ui.tsx";
import { loadAdminOverview } from "@/pages/dashboard/_lib/admin-center-data.ts";
import {
  firstName,
  formatEur,
  formatInt,
  greetingHour,
} from "@/pages/dashboard/_lib/admin-center-format.ts";
import type { ChartRange, VenueMetric, VenuePerformance } from "@/pages/dashboard/_lib/admin-center-types.ts";

const CHART_RANGES: { id: ChartRange; en: string; sq: string }[] = [
  { id: "7d", en: "7 Days", sq: "7 ditë" },
  { id: "30d", en: "30 Days", sq: "30 ditë" },
  { id: "3m", en: "3 Months", sq: "3 muaj" },
  { id: "1y", en: "1 Year", sq: "1 vit" },
];

const METRICS: { id: VenueMetric; en: string; sq: string }[] = [
  { id: "revenue", en: "Revenue", sq: "Të ardhura" },
  { id: "orders", en: "Orders", sq: "Porosi" },
  { id: "customers", en: "Customers", sq: "Klientë" },
  { id: "average", en: "Average Order", sq: "Porosia mesatare" },
];

function metricValue(row: VenuePerformance, metric: VenueMetric): number {
  if (metric === "orders") return row.orders;
  if (metric === "customers") return row.customers;
  if (metric === "average") return row.averageOrder;
  return row.revenue;
}

function formatMetric(value: number, metric: VenueMetric): string {
  if (metric === "orders" || metric === "customers") return formatInt(value);
  return formatEur(value);
}

function compactEur(value: number): string {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `€${Math.round(value)}`;
}

type TipProps = {
  active?: boolean;
  payload?: Array<{ payload: { date: string; revenue: number; orders: number } }>;
};

function RevenueTip({ active, payload }: TipProps) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-xl backdrop-blur">
      <p className="text-[11px] font-medium text-slate-500">{row.date}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{formatEur(row.revenue)}</p>
      <p className="text-xs text-slate-500">{formatInt(row.orders)} orders</p>
    </div>
  );
}

export default function DashboardOverviewModern() {
  const { t, lang } = useDashboardLocale();
  const { user } = useUserRole();
  const { rawVenues, venueFilterId, datePreset, customRange, openRenew } = useAdminCenter();
  const [chartRange, setChartRange] = useState<ChartRange>("30d");
  const [metric, setMetric] = useState<VenueMetric>("revenue");

  const overviewQuery = useQuery({
    queryKey: [
      "admin-center",
      "overview",
      venueFilterId,
      datePreset,
      customRange?.from.toISOString(),
      customRange?.to.toISOString(),
      chartRange,
      lang,
      rawVenues.map((v) => v.id).join(","),
    ],
    queryFn: () =>
      loadAdminOverview({
        venues: rawVenues,
        venueFilterId,
        preset: datePreset,
        customRange,
        chartRange,
        lang,
      }),
    enabled: rawVenues.length > 0,
  });

  const data = overviewQuery.data;
  const name = firstName(user?.name, user?.email);
  const greetKey =
    greetingHour() === "morning"
      ? "ac.overview.greet_morning"
      : greetingHour() === "afternoon"
        ? "ac.overview.greet_afternoon"
        : "ac.overview.greet_evening";

  const ranked = data?.performance ?? [];
  const totalRevenue = data?.totals.revenue ?? 0;
  const maxMetric = Math.max(...ranked.map((row) => metricValue(row, metric)), 1);
  const fillId = useMemo(() => `ac-rev-${chartRange}`, [chartRange]);

  if (overviewQuery.isLoading || (rawVenues.length > 0 && !data)) {
    return (
      <AdminPage className="space-y-4">
        <Skeleton className="h-12 w-80 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
        {t("ac.nav.admin_center")}
        <span className="font-medium normal-case tracking-normal text-indigo-400">
          {t("ac.hierarchy.badge")}
        </span>
      </div>

      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.85rem]">
            {t(greetKey, { name })} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("ac.overview.subtitle")}</p>
        </div>
        <Button asChild className="h-10 self-start rounded-xl bg-indigo-600 px-4 text-white hover:bg-indigo-700">
          <Link to="/app">
            <Plus className="size-4" />
            {t("ac.overview.add_venue")}
          </Link>
        </Button>
      </header>

      {rawVenues.length === 0 ? (
        <section className={cn(acCard, "p-10 text-center")}>
          <Store className="mx-auto size-10 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold">{t("ac.venues.empty_title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("ac.venues.empty_body")}</p>
          <Button asChild className="mt-5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
            <Link to="/app">{t("ac.overview.add_venue")}</Link>
          </Button>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label={t("ac.kpi.revenue")}
              value={formatEur(data?.totals.revenue ?? 0)}
              hint={<GrowthBadge value={data?.totals.growth ?? 0} suffix={` ${t("ac.kpi.vs_last")}`} />}
              icon={Wallet}
              spark={ranked[0]?.spark ?? []}
            />
            <KpiCard
              label={t("ac.kpi.orders")}
              value={formatInt(data?.totals.orders ?? 0)}
              hint={<GrowthBadge value={data?.totals.orderGrowth ?? 0} suffix={` ${t("ac.kpi.vs_last")}`} />}
              icon={ShoppingBag}
              spark={ranked[0]?.spark.map((n) => n * 0.7) ?? []}
            />
            <KpiCard
              label={t("ac.kpi.customers")}
              value={formatInt(data?.totals.customers ?? 0)}
              hint={<GrowthBadge value={data?.totals.customerGrowth ?? 0} suffix={` ${t("ac.kpi.vs_last")}`} />}
              icon={Users}
            />
            <KpiCard
              label={t("ac.kpi.active_venues")}
              value={String(data?.totals.activeVenues ?? 0)}
              hint={<span className="text-xs text-slate-500">{t("ac.kpi.active_venues_hint")}</span>}
              icon={Store}
            />
            <KpiCard
              label={t("ac.kpi.licenses")}
              value={`${data?.totals.licenses.healthy ?? 0} / ${data?.totals.licenses.total ?? 0}`}
              hint={
                <span className="text-xs text-slate-500">
                  {t("ac.kpi.licenses_hint", {
                    healthy: data?.totals.licenses.healthy ?? 0,
                    expiring: data?.totals.licenses.expiring ?? 0,
                  })}
                </span>
              }
              icon={KeyRound}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className={cn(acCard, "p-5 xl:col-span-8")}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t("ac.chart.title")}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                    {formatEur(data?.totals.revenue ?? 0)}
                  </p>
                  <div className="mt-1">
                    <GrowthBadge value={data?.totals.growth ?? 0} suffix={` ${t("ac.chart.vs_prev")}`} />
                  </div>
                </div>
                <div className="flex rounded-xl bg-slate-100 p-1">
                  {CHART_RANGES.map((range) => (
                    <button
                      key={range.id}
                      type="button"
                      onClick={() => setChartRange(range.id)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                        chartRange === range.id
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800",
                      )}
                    >
                      {lang === "sq" ? range.sq : range.en}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.chart ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4F6BFF" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#4F6BFF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: "#94A3B8", fontSize: 11 }} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={compactEur}
                      tick={{ fill: "#94A3B8", fontSize: 11 }}
                    />
                    <Tooltip content={<RevenueTip />} cursor={{ stroke: "#94A3B8", strokeDasharray: "4 4" }} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#4F6BFF"
                      strokeWidth={2.5}
                      fill={`url(#${fillId})`}
                      activeDot={{ r: 6, fill: "#4F6BFF", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className={cn(acCard, "p-5 xl:col-span-4")}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{t("ac.top.title")}</h2>
                <Trophy className="size-4 text-amber-500" />
              </div>
              <ul className="mt-4 space-y-4">
                {ranked.map((row, index) => {
                  const share = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
                  return (
                    <li key={row.venueId} className={cn(index === 0 && "rounded-2xl bg-gradient-to-r from-amber-50 to-white p-3 ring-1 ring-amber-100")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {index === 0 ? "🏆 " : `${index + 1}. `}
                            {row.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {share.toFixed(1)}% {t("ac.top.of_total")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">{formatEur(row.revenue)}</p>
                          <GrowthBadge value={row.growth} />
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full rounded-full", index === 0 ? "bg-amber-400" : "bg-indigo-500")}
                          style={{ width: `${Math.max(6, share)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section className={cn(acCard, "mt-4 p-5")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{t("ac.by_venue.title")}</h2>
              <div className="flex flex-wrap rounded-xl bg-slate-100 p-1">
                {METRICS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMetric(item.id)}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-medium",
                      metric === item.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
                    )}
                  >
                    {lang === "sq" ? item.sq : item.en}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {ranked.map((row) => {
                const value = metricValue(row, metric);
                const width = (value / maxMetric) * 100;
                return (
                  <div key={row.venueId} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{row.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatInt(row.orders)} {t("ac.kpi.orders").toLowerCase()} · {formatEur(row.averageOrder)} avg
                      </p>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400" style={{ width: `${Math.max(4, width)}%` }} />
                    </div>
                    <div className="flex items-center justify-end gap-3 text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">{formatMetric(value, metric)}</span>
                      <GrowthBadge value={row.growth} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={cn(acCard, "mt-4 overflow-hidden")}>
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">{t("ac.table.title")}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-y border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">{t("ac.table.venue")}</th>
                    <th className="px-3 py-3">{t("ac.kpi.revenue")}</th>
                    <th className="px-3 py-3">{t("ac.kpi.orders")}</th>
                    <th className="px-3 py-3">{t("ac.table.avg")}</th>
                    <th className="px-3 py-3">{t("ac.kpi.customers")}</th>
                    <th className="px-3 py-3">{t("ac.table.growth")}</th>
                    <th className="px-3 py-3">{t("ac.table.status")}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ranked.map((row) => (
                    <tr key={row.venueId} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{row.name}</td>
                      <td className="px-3 py-3.5 tabular-nums">{formatEur(row.revenue, true)}</td>
                      <td className="px-3 py-3.5 tabular-nums">{formatInt(row.orders)}</td>
                      <td className="px-3 py-3.5 tabular-nums">{formatEur(row.averageOrder)}</td>
                      <td className="px-3 py-3.5 tabular-nums">{formatInt(row.customers)}</td>
                      <td className="px-3 py-3.5">
                        <GrowthBadge value={row.growth} />
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusDot
                          health={row.health}
                          label={t(`ac.license.${row.health}`)}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/admin-center/venues?focus=${row.venueId}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          {t("ac.table.view")}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className={cn(acCard, "p-5 xl:col-span-7")}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{t("ac.license.title")}</h2>
                <Link to="/admin-center/licenses" className="text-xs font-medium text-indigo-600">
                  {t("ac.common.manage")}
                </Link>
              </div>
              {(data?.venues ?? []).some((v) => v.health === "expiring" && (v.daysRemaining ?? 99) < 7) ? (
                <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-amber-900">
                    ⚠️ {t("ac.license.critical_banner")}
                  </p>
                  <Button
                    size="sm"
                    className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                    onClick={() => {
                      const urgent = (data?.venues ?? []).find(
                        (v) => v.health === "expiring" && (v.daysRemaining ?? 99) < 7,
                      );
                      if (!urgent) return;
                      openRenew({
                        venueId: urgent.id,
                        venueName: urgent.name,
                        plan: urgent.planLabel,
                        expiry: urgent.license_expiry,
                      });
                    }}
                  >
                    {t("ac.license.renew_now")}
                  </Button>
                </div>
              ) : null}
              <ul className="mt-4 divide-y divide-slate-100">
                {(data?.venues ?? []).map((venue) => (
                  <li key={venue.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{venue.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {venue.planLabel}
                        {venue.daysRemaining != null
                          ? ` · ${t("ac.license.days_left", { count: Math.max(venue.daysRemaining, 0) })}`
                          : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusDot health={venue.health} label={t(`ac.license.${venue.health}`)} />
                      <Button
                        variant={venue.health === "active" ? "outline" : "default"}
                        size="sm"
                        className="rounded-lg"
                        onClick={() =>
                          openRenew({
                            venueId: venue.id,
                            venueName: venue.name,
                            plan: venue.planLabel,
                            expiry: venue.license_expiry,
                          })
                        }
                      >
                        {venue.health === "active" ? t("ac.license.manage") : t("ac.license.renew")}
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={cn(acCard, "p-5 xl:col-span-5")}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{t("ac.activity.title")}</h2>
                <Link to="/admin-center/activity" className="text-xs font-medium text-indigo-600">
                  {t("ac.activity.view_all")}
                </Link>
              </div>
              <ul className="mt-4 space-y-4">
                {(data?.activity ?? []).slice(0, 5).map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span
                      className={cn(
                        "mt-1 size-2.5 shrink-0 rounded-full",
                        item.tone === "green" && "bg-emerald-500",
                        item.tone === "blue" && "bg-sky-500",
                        item.tone === "violet" && "bg-violet-500",
                        item.tone === "orange" && "bg-amber-500",
                        item.tone === "red" && "bg-rose-500",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize text-slate-800">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.venue}</p>
                      <p className="text-[11px] text-slate-400">{item.relative}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </AdminPage>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  spark,
}: {
  label: string;
  value: string;
  hint: ReactNode;
  icon: typeof Wallet;
  spark?: number[];
}) {
  return (
    <div className={cn(acCard, acCardHover, "p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
          <div className="mt-1">{hint}</div>
        </div>
        <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
      </div>
      {spark && spark.length > 1 ? <MiniSpark points={spark} className="mt-3 w-full" /> : null}
    </div>
  );
}
