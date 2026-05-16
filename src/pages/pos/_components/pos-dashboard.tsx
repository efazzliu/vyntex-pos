import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { enUS, sq as sqDateLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import BulkFiscalizationSheet from "./bulk-fiscalization.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Clock,
  BarChart2,
  CreditCard,
  Banknote,
  FileCheck,
  FileWarning,
  ReceiptText,
  UserCheck,
  Wallet,
  Package,
  type LucideIcon,
} from "lucide-react";

type PosDashboardProps = {
  licenseKey: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  /** Professional+: emphasise full analytics pack (charts, staff, payment mix). */
  showAdvancedAnalytics?: boolean;
  /** Opens order history / sales detail (e.g. from Sales analytics “View details”). */
  onOpenSalesDetail?: () => void;
};

function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type DashboardPeriod = "day" | "week" | "month" | "year";

type SalesChartMode = "day" | "week" | "month" | "all";

type ChartPoint = { label: string; revenue: number; orders: number };
type VisitorHeatmap = { dayLabels: string[]; matrix24: number[][] };
type FiscalTrendPoint = { label: string; fiscal: number; nonFiscal: number };

type SupplyProfitPoint = {
  label: string;
  revenue: number;
  supplyIntake: number;
  stockExpense: number;
  estimatedProfit: number;
};

type SalesChartSeries = { current: ChartPoint[]; previous: ChartPoint[] };

const EMPTY_SALES_CHART: Record<SalesChartMode, SalesChartSeries> = {
  day: { current: [], previous: [] },
  week: { current: [], previous: [] },
  month: { current: [], previous: [] },
  all: { current: [], previous: [] },
};

const EMPTY_SUPPLY_PROFIT_CHART: SupplyProfitPoint[] = Array.from(
  { length: 6 },
  () => ({
    label: "—",
    revenue: 0,
    supplyIntake: 0,
    stockExpense: 0,
    estimatedProfit: 0,
  }),
);

const EMPTY_PERIOD_SUMMARY = {
  revenue: 0,
  paidCount: 0,
  avgOrderValue: 0,
};

const STATUS_COLORS: Record<string, string> = {
  open: "#FFB800",
  "sent-to-kitchen": "#FF6B00",
  ready: "#44CC00",
  served: "#0066FF",
  paid: "#00C2FF",
  cancelled: "#FF3B30",
};

/** Dashboard shell — layered mesh + depth (CSS “3D” glass panels). */
const dashCanvas =
  "relative isolate min-h-full min-w-0 bg-slate-100 p-6 lg:p-8 before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(ellipse_120%_85%_at_50%_-35%,rgba(99,102,241,0.2),transparent),radial-gradient(ellipse_70%_55%_at_100%_0%,rgba(236,72,153,0.14),transparent),radial-gradient(ellipse_55%_45%_at_0%_105%,rgba(14,165,233,0.12),transparent)]";
/** Raised glass card (KPIs, section bodies). */
const dashCard =
  "rounded-3xl border border-white/70 bg-white/75 p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.95)_inset,0_2px_4px_-1px_rgba(15,23,42,0.05),0_20px_50px_-22px_rgba(15,23,42,0.18)] backdrop-blur-xl backdrop-saturate-150 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_1px_0_0_rgba(255,255,255,1)_inset,0_10px_28px_-10px_rgba(99,102,241,0.25),0_28px_64px_-24px_rgba(15,23,42,0.22)]";
/** Large chart / analytics panels. */
const dashPanel =
  "rounded-3xl border border-white/70 bg-white/72 p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.92)_inset,0_14px_44px_-16px_rgba(15,23,42,0.16)] backdrop-blur-xl backdrop-saturate-150 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_22px_52px_-18px_rgba(79,70,229,0.2)] lg:p-5";
/** Inset well for charts inside a panel. */
const dashInnerWell =
  "rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white/95 via-slate-50/85 to-indigo-50/25 p-4 shadow-[inset_0_2px_8px_rgba(15,23,42,0.06)]";
const dashMuted = "text-slate-600";
const dashLabel = "text-[10px] font-semibold uppercase tracking-wider text-slate-500";
const ACCENT = "#3b82f6";
const ORANGE_SERIES = "#fb923c";

const DONUT_PALETTE = [
  "#fb923c",
  ACCENT,
  "#14b8a6",
  "#a855f7",
  "#ec4899",
  "#eab308",
];

function parseYmdToLocalNoon(ymd: string): Date {
  const parts = ymd.split("-").map((x) => Number(x));
  const y = parts[0] ?? 1970;
  const mo = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

function compareYmd(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function normalizeRangeYmd(from: string, to: string): { from: string; to: string } {
  return compareYmd(from, to) <= 0 ? { from, to } : { from: to, to: from };
}

function ymdParts(ymd: string): { y: number; m: number; d: number } {
  const p = ymd.split("-").map(Number);
  return { y: p[0] ?? 0, m: p[1] ?? 1, d: p[2] ?? 1 };
}

/** Local calendar bounds as ISO strings for Convex / Supabase filters. */
function computeDashboardQueryBounds(fromYmd: string, toYmd: string) {
  const { from: f, to: t } = normalizeRangeYmd(fromYmd, toYmd);
  const a = ymdParts(f);
  const b = ymdParts(t);
  const rangeStart = new Date(a.y, a.m - 1, a.d, 0, 0, 0, 0);
  const rangeToExclusive = new Date(b.y, b.m - 1, b.d + 1, 0, 0, 0, 0);
  const anchorEnd = new Date(b.y, b.m - 1, b.d, 12, 0, 0, 0);
  const operationalDayStart = new Date(b.y, b.m - 1, b.d, 0, 0, 0, 0);
  return {
    rangeFromIso: rangeStart.toISOString(),
    rangeToExclusiveIso: rangeToExclusive.toISOString(),
    anchorDate: anchorEnd.toISOString(),
    operationalDayStartIso: operationalDayStart.toISOString(),
  };
}

function startOfLocalTodayNoon(): Date {
  const x = new Date();
  x.setHours(12, 0, 0, 0);
  return x;
}

function DashboardRangeCalendar({
  fromYmd,
  toYmd,
  onRangeYmd,
  language,
  t,
}: {
  fromYmd: string;
  toYmd: string;
  onRangeYmd: (from: string, to: string) => void;
  language: "en" | "sq";
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [open, setOpen] = useState(false);
  const displayLocaleTag = language === "sq" ? "sq-AL" : "en-GB";
  const pickerLocale = language === "sq" ? sqDateLocale : enUS;
  const selected: DateRange = useMemo(
    () => ({
      from: parseYmdToLocalNoon(fromYmd),
      to: parseYmdToLocalNoon(toYmd),
    }),
    [fromYmd, toYmd],
  );
  const label = useMemo(() => {
    const a = selected.from ?? parseYmdToLocalNoon(fromYmd);
    const b = selected.to ?? selected.from ?? parseYmdToLocalNoon(toYmd);
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    };
    if (fromYmd === toYmd) {
      return a.toLocaleDateString(displayLocaleTag, opts);
    }
    return `${a.toLocaleDateString(displayLocaleTag, { day: "numeric", month: "short" })} – ${b.toLocaleDateString(displayLocaleTag, opts)}`;
  }, [displayLocaleTag, fromYmd, selected.from, selected.to, toYmd]);
  const todayNoon = startOfLocalTodayNoon();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex min-w-[220px] max-w-full shrink-0 items-center gap-3 rounded-2xl border border-white/70 bg-white/75 px-4 py-2.5 text-left shadow-[0_10px_28px_-12px_rgba(15,23,42,0.15),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-xl outline-none transition hover:border-indigo-200/80 hover:bg-white/90 hover:shadow-[0_14px_36px_-12px_rgba(99,102,241,0.22)] focus-visible:ring-2 focus-visible:ring-indigo-400/50"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-600/10 ring-1 ring-indigo-500/15">
            <CalendarDays className="size-5 text-indigo-700" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t("dashboard.calendar_range_label")}
            </span>
            <span className="block truncate text-sm font-semibold tracking-tight text-slate-900">{label}</span>
          </span>
          <ChevronDown className={`size-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-auto max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-0 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.28)] backdrop-blur-xl"
      >
        <div className="border-b border-slate-200/70 bg-gradient-to-r from-slate-50/90 to-indigo-50/40 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{t("dashboard.calendar_range_label")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{t("dashboard.calendar_range_hint")}</p>
        </div>
        <div className="p-2">
          <DayPickerCalendar
            mode="range"
            numberOfMonths={1}
            selected={selected}
            onSelect={(range) => {
              if (!range?.from) return;
              if (!range.to) {
                onRangeYmd(formatLocalYmd(range.from), formatLocalYmd(range.from));
                return;
              }
              let a = formatLocalYmd(range.from);
              let b = formatLocalYmd(range.to);
              if (compareYmd(a, b) > 0) {
                const tmp = a;
                a = b;
                b = tmp;
              }
              onRangeYmd(a, b);
              setOpen(false);
            }}
            locale={pickerLocale}
            defaultMonth={selected.to ?? selected.from}
            disabled={(date) => {
              const c = new Date(date);
              c.setHours(12, 0, 0, 0);
              return c.getTime() > todayNoon.getTime();
            }}
            className="rounded-xl [--cell-size:2.25rem]"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200/70 bg-slate-50/50 px-3 py-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-slate-200/80 bg-white/90 text-xs font-semibold"
            onClick={() => {
              const y = formatLocalYmd(new Date());
              onRangeYmd(y, y);
              setOpen(false);
            }}
          >
            {t("dashboard.period_day")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function growthPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  if (previous < 0) return null;
  return ((current - previous) / previous) * 100;
}

export default function PosDashboard({
  licenseKey,
  staffId,
  staffName,
  staffRole,
  showAdvancedAnalytics = true,
  onOpenSalesDetail,
}: PosDashboardProps) {
  const { t, formatPrice, language } = usePosLocale();
  const showStarterLayout = !showAdvancedAnalytics;
  const viewPeriod: DashboardPeriod = "day";
  const todayYmd = formatLocalYmd(new Date());
  const [dashboardRangeFromYmd, setDashboardRangeFromYmd] = useState(todayYmd);
  const [dashboardRangeToYmd, setDashboardRangeToYmd] = useState(todayYmd);
  const setDashboardRangeYmd = useCallback((from: string, to: string) => {
    const n = normalizeRangeYmd(from, to);
    setDashboardRangeFromYmd(n.from);
    setDashboardRangeToYmd(n.to);
  }, []);
  const dashboardQueryBounds = useMemo(
    () => computeDashboardQueryBounds(dashboardRangeFromYmd, dashboardRangeToYmd),
    [dashboardRangeFromYmd, dashboardRangeToYmd],
  );
  const [ordersAnalyticsMode, setOrdersAnalyticsMode] = useState<SalesChartMode>("month");
  const statsQuery = useQuery("pos.dashboard.getDashboardStats", {
    licenseKey,
    viewPeriod,
    anchorDate: dashboardQueryBounds.anchorDate,
    rangeFromIso: dashboardQueryBounds.rangeFromIso,
    rangeToExclusiveIso: dashboardQueryBounds.rangeToExclusiveIso,
    operationalDayStartIso: dashboardQueryBounds.operationalDayStartIso,
    locale: language,
  });
  const zReportToday = useQuery(
    showStarterLayout ? "pos.dashboard.getZReport" : undefined,
    showStarterLayout
      ? { licenseKey, date: dashboardQueryBounds.anchorDate }
      : "skip",
  );
  const stats =
    statsQuery &&
    typeof statsQuery === "object" &&
    !Array.isArray(statsQuery) &&
    "todayRevenue" in statsQuery
      ? statsQuery
      : {
          periodSummaries: {
            day: { ...EMPTY_PERIOD_SUMMARY },
            week: { ...EMPTY_PERIOD_SUMMARY },
            month: { ...EMPTY_PERIOD_SUMMARY },
            year: { ...EMPTY_PERIOD_SUMMARY },
          },
          viewPeriod: "day" as DashboardPeriod,
          todayRevenue: 0,
          todayOrderCount: 0,
          todayPaidCount: 0,
          activeOrders: 0,
          avgOrderValue: 0,
          activeTables: 0,
          totalTables: 0,
          fiscalSummary: {
            fiscalCount: 0,
            fiscalTotal: 0,
            nonFiscalCount: 0,
            nonFiscalTotal: 0,
          },
          revenueByPaymentType: {},
          revenueByMethod: {},
          ordersByStatus: {},
          topItems: [],
          staffPerformance: [],
          salesChart: EMPTY_SALES_CHART,
          fiscalTrend: [],
          visitorBuckets: { h16: [], h24: [], peakHour24: 0, peakCount24: 0 },
          visitorHeatmap: { dayLabels: [], matrix24: [] },
          weekDayRevenue: [],
          supplyProfitChart: EMPTY_SUPPLY_PROFIT_CHART,
          inventorySnapshot: {
            totalValue: 0,
            kitchenValue: 0,
            barValue: 0,
            trackedItemCount: 0,
          },
        };

  const salesChart = useMemo(() => {
    const ok =
      statsQuery &&
      typeof statsQuery === "object" &&
      !Array.isArray(statsQuery) &&
      "todayRevenue" in statsQuery;
    const raw = ok ? (statsQuery as { salesChart?: unknown }).salesChart : undefined;
    if (!raw || typeof raw !== "object" || raw === null) return EMPTY_SALES_CHART;
    const o = raw as Record<string, unknown>;
    const pick = (k: SalesChartMode): SalesChartSeries => {
      const v = o[k];
      if (!v || typeof v !== "object") return { current: [], previous: [] };
      const s = v as { current?: unknown; previous?: unknown };
      const cur = Array.isArray(s.current) ? (s.current as ChartPoint[]) : [];
      const prev = Array.isArray(s.previous) ? (s.previous as ChartPoint[]) : [];
      return { current: cur, previous: prev };
    };
    return {
      day: pick("day"),
      week: pick("week"),
      month: pick("month"),
      all: pick("all"),
    };
  }, [statsQuery]);

  const weekDayRevenue = useMemo(() => {
    const ok =
      statsQuery &&
      typeof statsQuery === "object" &&
      !Array.isArray(statsQuery) &&
      "todayRevenue" in statsQuery;
    const raw = ok ? (statsQuery as { weekDayRevenue?: unknown }).weekDayRevenue : undefined;
    if (!Array.isArray(raw)) return [] as { day: string; revenue: number }[];
    const out: { day: string; revenue: number }[] = [];
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const day = typeof r.day === "string" ? r.day : "";
      const rev = typeof r.revenue === "number" ? r.revenue : Number(r.revenue);
      out.push({ day, revenue: Number.isFinite(rev) ? rev : 0 });
    }
    return out;
  }, [statsQuery]);

  const supplyProfitChart = useMemo(() => {
    const ok =
      statsQuery &&
      typeof statsQuery === "object" &&
      !Array.isArray(statsQuery) &&
      "todayRevenue" in statsQuery;
    const raw = ok
      ? (statsQuery as { supplyProfitChart?: unknown }).supplyProfitChart
      : undefined;
    if (!Array.isArray(raw)) return EMPTY_SUPPLY_PROFIT_CHART;
    const out: SupplyProfitPoint[] = [];
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const num = (k: string) => {
        const v = r[k];
        return typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
      };
      out.push({
        label: typeof r.label === "string" ? r.label : "—",
        revenue: num("revenue"),
        supplyIntake: num("supplyIntake"),
        stockExpense: num("stockExpense"),
        estimatedProfit: num("estimatedProfit"),
      });
    }
    return out.length > 0 ? out : EMPTY_SUPPLY_PROFIT_CHART;
  }, [statsQuery]);

  const inventorySnapshot = useMemo(() => {
    const ok =
      statsQuery &&
      typeof statsQuery === "object" &&
      !Array.isArray(statsQuery) &&
      "todayRevenue" in statsQuery;
    const raw = ok
      ? (statsQuery as { inventorySnapshot?: unknown }).inventorySnapshot
      : undefined;
    if (!raw || typeof raw !== "object") {
      return {
        totalValue: 0,
        kitchenValue: 0,
        barValue: 0,
        trackedItemCount: 0,
      };
    }
    const r = raw as Record<string, unknown>;
    const n = (k: string) => {
      const v = r[k];
      return typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
    };
    return {
      totalValue: n("totalValue"),
      kitchenValue: n("kitchenValue"),
      barValue: n("barValue"),
      trackedItemCount: Math.round(n("trackedItemCount")),
    };
  }, [statsQuery]);

  const periodSummaries =
    stats.periodSummaries &&
    typeof stats.periodSummaries === "object" &&
    "day" in stats.periodSummaries
      ? (stats.periodSummaries as Record<
          DashboardPeriod,
          { revenue: number; paidCount: number; avgOrderValue: number }
        >)
      : {
          day: { ...EMPTY_PERIOD_SUMMARY },
          week: { ...EMPTY_PERIOD_SUMMARY },
          month: { ...EMPTY_PERIOD_SUMMARY },
          year: { ...EMPTY_PERIOD_SUMMARY },
        };

  const monthCurrentRevenue = salesChart.month.current.reduce((s, p) => s + p.revenue, 0);
  const monthPreviousRevenue = salesChart.month.previous.reduce((s, p) => s + p.revenue, 0);
  const monthCurrentOrders = salesChart.month.current.reduce((s, p) => s + p.orders, 0);
  const monthPreviousOrders = salesChart.month.previous.reduce((s, p) => s + p.orders, 0);
  const monthCurrentAvg = monthCurrentOrders > 0 ? monthCurrentRevenue / monthCurrentOrders : 0;
  const monthPreviousAvg = monthPreviousOrders > 0 ? monthPreviousRevenue / monthPreviousOrders : 0;
  const weekCurrentOrders = salesChart.week.current.reduce((s, p) => s + p.orders, 0);
  const weekPreviousOrders = salesChart.week.previous.reduce((s, p) => s + p.orders, 0);

  const loadingStats = statsQuery === undefined || Array.isArray(statsQuery);
  const starterOrderCount = stats.todayOrderCount ?? stats.todayPaidCount;
  const starterMetricFootnote = t("dashboard.starter_metric_context");

  return (
    <div className={`${dashCanvas} space-y-8`}>
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-3xl font-bold tracking-tight text-transparent drop-shadow-[0_2px_12px_rgba(99,102,241,0.15)]">
            {String(t("dashboard.welcome_back", { name: staffName }))}
          </h1>
          {showStarterLayout ? (
            <p className={`mt-1 text-sm ${dashMuted}`}>{t("starter_overview.subtitle")}</p>
          ) : null}
        </div>
        <DashboardRangeCalendar
          fromYmd={dashboardRangeFromYmd}
          toYmd={dashboardRangeToYmd}
          onRangeYmd={setDashboardRangeYmd}
          language={language}
          t={t}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
        {showStarterLayout ? (
          <>
            <MetricTrendCard
              title={t("starter_overview.today_total_sales")}
              icon={Wallet}
              value={formatPrice(stats.todayRevenue)}
              trend={null}
              trendLabel={starterMetricFootnote}
              accent="emerald"
            />
            <MetricTrendCard
              title={t("starter_overview.today_orders_count")}
              icon={ShoppingCart}
              value={String(starterOrderCount)}
              trend={null}
              trendLabel={starterMetricFootnote}
              accent="blue"
            />
            <MetricTrendCard
              title={t("starter_overview.today_avg_order_value")}
              icon={TrendingUp}
              value={formatPrice(stats.avgOrderValue)}
              trend={null}
              trendLabel={starterMetricFootnote}
              accent="violet"
            />
            <MetricTrendCard
              title={t("dashboard.exec_kpi_active_orders")}
              icon={Clock}
              value={String(stats.activeOrders)}
              trend={null}
              trendLabel={starterMetricFootnote}
              accent="amber"
            />
          </>
        ) : (
          <>
            <MetricTrendCard
              title={t("dashboard.exec_kpi_total_revenue")}
              icon={Wallet}
              value={formatPrice(periodSummaries.month.revenue)}
              trend={growthPercent(monthCurrentRevenue, monthPreviousRevenue)}
              trendLabel={t("dashboard.metric_trend_this_month")}
              accent="emerald"
            />
            <MetricTrendCard
              title={t("dashboard.exec_kpi_orders")}
              icon={ShoppingCart}
              value={String(periodSummaries.month.paidCount)}
              trend={growthPercent(monthCurrentOrders, monthPreviousOrders)}
              trendLabel={t("dashboard.metric_trend_this_month")}
              accent="blue"
            />
            <MetricTrendCard
              title={t("dashboard.exec_kpi_avg_order_value")}
              icon={TrendingUp}
              value={formatPrice(periodSummaries.month.avgOrderValue)}
              trend={growthPercent(monthCurrentAvg, monthPreviousAvg)}
              trendLabel={t("dashboard.metric_trend_this_month")}
              accent="violet"
            />
            <MetricTrendCard
              title={t("dashboard.exec_kpi_active_orders")}
              icon={Clock}
              value={String(stats.activeOrders)}
              trend={growthPercent(weekCurrentOrders, weekPreviousOrders)}
              trendLabel={t("dashboard.metric_trend_this_month")}
              accent="amber"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {showStarterLayout ? (
            <StarterDashboardDetailColumn
              stats={stats}
              zReportToday={zReportToday}
              formatPrice={formatPrice}
              t={t}
              loading={loadingStats}
            />
          ) : (
            <>
              <OrdersAnalyticsSection
                salesChart={salesChart}
                mode={ordersAnalyticsMode}
                onModeChange={setOrdersAnalyticsMode}
                formatPrice={formatPrice}
                loading={loadingStats}
              />
              <SalesAnalyticsBarCard
                monthlyCurrent={salesChart.month.current}
                monthlyPrevious={salesChart.month.previous}
                formatPrice={formatPrice}
                loading={loadingStats}
                onViewDetails={onOpenSalesDetail}
              />
              <SupplyProfitChartSection
                data={supplyProfitChart}
                inventory={inventorySnapshot}
                formatPrice={formatPrice}
                t={t}
                loading={loadingStats}
              />
              <WeeklyActivityByDayCard
                weekDayRevenue={weekDayRevenue}
                formatPrice={formatPrice}
                loading={loadingStats}
              />
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {!showStarterLayout ? (
            <DashboardInsights topItems={stats.topItems} t={t} loading={loadingStats} />
          ) : null}
          <FiscalSystemSection
            formatPrice={formatPrice}
            fiscalTotal={stats.fiscalSummary.fiscalTotal}
            nonFiscalTotal={stats.fiscalSummary.nonFiscalTotal}
            licenseKey={licenseKey}
            staffId={staffId}
            staffName={staffName}
            staffRole={staffRole}
          />
          {!showStarterLayout ? (
            <>
              <PopularTimesCard
                heatmap={(stats.visitorHeatmap as VisitorHeatmap | undefined) ?? { dayLabels: [], matrix24: [] }}
                loading={loadingStats}
              />
              <SectionCard title={t("dashboard.staff_performance")} icon={Users}>
                {stats.staffPerformance.length === 0 ? (
                  <p className={`text-sm ${dashMuted} py-4`}>{t("dashboard.empty_staff")}</p>
                ) : (
                  <div className="space-y-2">
                    {stats.staffPerformance.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between border-b border-slate-200/45 py-1.5 last:border-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-400">
                            {s.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="truncate text-sm text-slate-900">{s.name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <span className={`text-xs ${dashMuted}`}>
                            {t("dashboard.staff_orders", { count: s.orders })}
                          </span>
                          <span className="w-20 text-right text-sm font-semibold text-slate-900">
                            {formatPrice(s.revenue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title={t("dashboard.top_selling")} icon={UtensilsCrossed}>
                {stats.topItems.length === 0 ? (
                  <p className={`text-sm ${dashMuted} py-2`}>{t("dashboard.empty_sales")}</p>
                ) : (
                  <div className="divide-y divide-slate-200/40 rounded-2xl border border-white/60 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm">
                    {stats.topItems.map((item, idx) => (
                      <div
                        key={`${item.name}-${idx}`}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="truncate font-medium text-slate-900">{item.name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
                          <span className={`text-xs tabular-nums ${dashMuted}`}>
                            {t("dashboard.top_item_qty", { count: item.quantity })}
                          </span>
                          <span className="w-[88px] text-right text-sm font-semibold text-slate-900 tabular-nums sm:w-28">
                            {formatPrice(item.revenue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          ) : (
            <StarterDashboardStaffColumn zReportToday={zReportToday} stats={stats} formatPrice={formatPrice} />
          )}
        </div>
      </div>
    </div>
  );
}

function SupplyProfitChartSection({
  data,
  inventory,
  formatPrice,
  t,
  loading,
}: {
  data: SupplyProfitPoint[];
  inventory: {
    totalValue: number;
    kitchenValue: number;
    barValue: number;
    trackedItemCount: number;
  };
  formatPrice: (n: number) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  loading: boolean;
}) {
  return (
    <div className={dashPanel}>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700 ring-1 ring-teal-500/20">
              <Package className="size-4" />
            </span>
            <h3 className="text-base font-bold tracking-tight text-slate-900">
              {t("dashboard.supply_chart_title")}
            </h3>
          </div>
          <p className={`mt-2 max-w-3xl text-xs leading-relaxed ${dashMuted}`}>
            {t("dashboard.supply_chart_sub")}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={`rounded-2xl border border-slate-200/60 bg-white/60 px-3 py-2.5 ${dashInnerWell} !p-3`}>
          <p className={dashLabel}>{t("dashboard.inventory_total")}</p>
          <p className="text-sm font-bold text-slate-900 tabular-nums">
            {loading ? "…" : formatPrice(inventory.totalValue)}
          </p>
        </div>
        <div className={`rounded-2xl border border-orange-200/50 bg-orange-50/40 px-3 py-2.5`}>
          <p className={dashLabel}>{t("dashboard.inventory_kitchen")}</p>
          <p className="text-sm font-bold text-slate-900 tabular-nums">
            {loading ? "…" : formatPrice(inventory.kitchenValue)}
          </p>
        </div>
        <div className={`rounded-2xl border border-violet-200/50 bg-violet-50/40 px-3 py-2.5`}>
          <p className={dashLabel}>{t("dashboard.inventory_bar")}</p>
          <p className="text-sm font-bold text-slate-900 tabular-nums">
            {loading ? "…" : formatPrice(inventory.barValue)}
          </p>
        </div>
        <div className={`rounded-2xl border border-slate-200/60 bg-white/60 px-3 py-2.5`}>
          <p className={dashLabel}>{t("dashboard.inventory_count_label")}</p>
          <p className="text-sm font-bold text-slate-900 tabular-nums">
            {loading ? "…" : t("dashboard.inventory_items", { count: inventory.trackedItemCount })}
          </p>
        </div>
      </div>

      <div className={`${dashInnerWell} min-h-[300px] w-full`}>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
            …
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v) => {
                  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
                  return String(Math.round(v));
                }}
              />
              <Tooltip
                formatter={(value: number | string) =>
                  formatPrice(typeof value === "number" ? value : Number(value))
                }
                labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 10px 40px -12px rgba(15,23,42,0.2)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                dataKey="revenue"
                name={t("dashboard.supply_legend_revenue")}
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="supplyIntake"
                name={t("dashboard.supply_legend_intake")}
                fill="#14b8a6"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="stockExpense"
                name={t("dashboard.supply_legend_expense")}
                fill="#f97316"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Line
                type="monotone"
                dataKey="estimatedProfit"
                name={t("dashboard.supply_legend_profit")}
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function MetricTrendCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent,
  sub,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  trend: number | null;
  trendLabel: string;
  accent: "emerald" | "blue" | "violet" | "amber" | "cyan";
  sub?: string;
}) {
  const trendUp = (trend ?? 0) >= 0;
  const tone =
    accent === "emerald"
      ? "bg-emerald-500/15 text-emerald-300"
      : accent === "blue"
        ? "bg-blue-500/15 text-blue-300"
        : accent === "violet"
          ? "bg-violet-500/15 text-violet-300"
          : accent === "amber"
            ? "bg-amber-500/15 text-amber-300"
            : "bg-cyan-500/15 text-cyan-300";

  return (
    <div className={`h-full min-h-[118px] ${dashCard} !p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <span
          className={`inline-flex size-9 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-white/50 ${tone}`}
        >
          <Icon className="size-4 drop-shadow-sm" />
        </span>
      </div>
      <p className="truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {trend === null ? null : trendUp ? (
          <ArrowUpRight className="size-3.5 text-emerald-400" />
        ) : (
          <ArrowDownRight className="size-3.5 text-red-400" />
        )}
        {trend === null ? (
          <span
            className={
              trendLabel.trim().startsWith("+")
                ? "font-semibold text-emerald-500"
                : trendLabel.trim().startsWith("-")
                  ? "font-semibold text-red-500"
                  : "text-slate-400"
            }
          >
            {trendLabel}
          </span>
        ) : (
          <>
            <span className={trendUp ? "font-semibold text-emerald-400" : "font-semibold text-red-400"}>
              {trendUp ? "+" : ""}
              {trend.toFixed(1)}%
            </span>
            <span className="text-slate-500">{trendLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

type StarterDashStats = {
  todayRevenue: number;
  todayOrderCount?: number;
  todayPaidCount: number;
  avgOrderValue: number;
  revenueByMethod: Record<string, { count: number; total: number }>;
  activeTables: number;
  activeOrders: number;
  ordersByStatus: Record<string, number>;
  staffPerformance: Array<{ name: string; orders: number; revenue: number }>;
};

type ZReportTodayShape = {
  openingCash?: number;
  totalToHandOver?: number;
  staffBreakdown?: Array<{ staffName: string; revenue: number }>;
  shiftDetails?: Array<{ staffName: string; clockOut?: string | null }>;
};

function parseZReportToday(raw: unknown): ZReportTodayShape | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  return raw as ZReportTodayShape;
}

function StarterDashboardDetailColumn({
  stats,
  zReportToday,
  formatPrice,
  t,
  loading,
}: {
  stats: StarterDashStats;
  zReportToday: unknown;
  formatPrice: (n: number) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  loading: boolean;
}) {
  const z = parseZReportToday(zReportToday);
  const cashToday = stats.revenueByMethod?.cash?.total ?? 0;
  const cardToday = stats.revenueByMethod?.card?.total ?? 0;
  const openingCash = z?.openingCash ?? 0;
  const cashInDrawer = openingCash + cashToday;
  const closingBalance = z?.totalToHandOver ?? cashInDrawer;
  const pendingOrders = stats.activeOrders;
  const completedOrders = stats.todayPaidCount;
  const cancelledOrders = stats.ordersByStatus?.cancelled ?? 0;
  const takeawayOrders = 0;

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className={`${dashPanel} h-52 animate-pulse rounded-3xl bg-slate-200/40`} />
        <div className={`${dashPanel} h-44 animate-pulse rounded-3xl bg-slate-200/40`} />
        <div className={`${dashPanel} h-40 animate-pulse rounded-3xl bg-slate-200/40`} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`w-full min-w-0 ${dashPanel}`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400/25 to-teal-700/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ring-1 ring-white/55">
              <BarChart2 className="size-5 text-emerald-700 drop-shadow-sm" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                {t("dashboard.starter_payments_section")}
              </h3>
              <p className={`text-xs ${dashMuted}`}>{t("dashboard.starter_payments_sub")}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard icon={Banknote} label={t("starter_overview.today_cash_payments")} value={formatPrice(cashToday)} color="#44CC00" />
          <KpiCard icon={CreditCard} label={t("starter_overview.today_card_payments")} value={formatPrice(cardToday)} color="#0066FF" />
          <KpiCard
            icon={UtensilsCrossed}
            label={t("starter_overview.today_active_tables")}
            value={String(stats.activeTables)}
            color="#a855f7"
          />
        </div>
      </section>

      <section className={`w-full min-w-0 ${dashPanel}`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-orange-700/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ring-1 ring-white/55">
              <Clock className="size-5 text-amber-700 drop-shadow-sm" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">{t("starter_overview.orders_section")}</h3>
              <p className={`text-xs ${dashMuted}`}>{t("dashboard.starter_metric_context")}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={Clock} label={t("starter_overview.orders_pending")} value={String(pendingOrders)} color="#f59e0b" />
          <KpiCard icon={FileCheck} label={t("starter_overview.orders_completed")} value={String(completedOrders)} color="#22c55e" />
          <KpiCard icon={ShoppingCart} label={t("starter_overview.orders_takeaway")} value={String(takeawayOrders)} color="#0ea5e9" />
          <KpiCard icon={FileWarning} label={t("starter_overview.orders_cancelled")} value={String(cancelledOrders)} color="#ef4444" />
        </div>
      </section>

      <section className={`w-full min-w-0 ${dashPanel}`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-sky-700/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ring-1 ring-white/55">
              <Banknote className="size-5 text-cyan-800 drop-shadow-sm" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">{t("starter_overview.cash_register_section")}</h3>
              <p className={`text-xs ${dashMuted}`}>{t("dashboard.starter_metric_context")}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <KpiCard icon={Banknote} label={t("starter_overview.cash_opening")} value={formatPrice(openingCash)} color="#14b8a6" />
          <KpiCard icon={Wallet} label={t("starter_overview.cash_in_drawer")} value={formatPrice(cashInDrawer)} color="#eab308" />
          <KpiCard icon={ReceiptText} label={t("starter_overview.cash_closing_balance")} value={formatPrice(closingBalance)} color="#8b5cf6" />
        </div>
      </section>
    </div>
  );
}

function StarterDashboardStaffColumn({
  zReportToday,
  stats,
  formatPrice,
}: {
  zReportToday: unknown;
  stats: StarterDashStats;
  formatPrice: (n: number) => string;
}) {
  const { t } = usePosLocale();
  const z = parseZReportToday(zReportToday);
  const loggedInStaff = Array.from(
    new Set(
      (z?.shiftDetails ?? [])
        .filter((s) => !s.clockOut)
        .map((s) => s.staffName)
        .filter(Boolean),
    ),
  );

  const fromBreakdown = (z?.staffBreakdown ?? []).map((r) => ({
    name: r.staffName,
    revenue: r.revenue,
  }));
  const fromPerf = stats.staffPerformance.map((r) => ({ name: r.name, revenue: r.revenue }));
  const staffSales = (fromBreakdown.length > 0 ? fromBreakdown : fromPerf).slice(0, 8);

  return (
    <div className="flex flex-col gap-3">
      <SectionCard title={t("starter_overview.staff_logged_in")} icon={UserCheck}>
        {loggedInStaff.length === 0 ? (
          <p className={`text-sm ${dashMuted}`}>{t("starter_overview.staff_none_logged_in")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {loggedInStaff.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-800 ring-1 ring-blue-500/15"
              >
                <UserCheck className="size-3.5 shrink-0 text-blue-700" />
                {name}
              </span>
            ))}
          </div>
        )}
      </SectionCard>
      <SectionCard title={t("starter_overview.staff_sales_by_person")} icon={Users}>
        {staffSales.length === 0 ? (
          <p className={`text-sm ${dashMuted}`}>{t("starter_overview.staff_no_sales_today")}</p>
        ) : (
          <div className="space-y-2">
            {staffSales.map((s, idx) => (
              <div key={`${s.name}-${idx}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-slate-700">{s.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatPrice(s.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

type TopItemRow = { name: string; quantity: number; revenue: number };

function formatHourSnapchat(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

function WeeklyActivityByDayCard({
  weekDayRevenue,
  formatPrice,
  loading,
}: {
  weekDayRevenue: { day: string; revenue: number }[];
  formatPrice: (n: number) => string;
  loading: boolean;
}) {
  const { t } = usePosLocale();
  const chartData = weekDayRevenue;

  const maxIdx = useMemo(() => {
    let best = 0;
    let max = -1;
    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].revenue > max) {
        max = chartData[i].revenue;
        best = i;
      }
    }
    return max > 0 ? best : -1;
  }, [chartData]);

  const peakDay = maxIdx >= 0 ? chartData[maxIdx] : null;
  const isEmpty = !loading && chartData.length > 0 && maxIdx < 0;

  return (
    <section className={`w-full min-w-0 ${dashPanel}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400/25 to-violet-700/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ring-1 ring-white/55">
            <BarChart2 className="size-5 text-indigo-600 drop-shadow-sm" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              {t("dashboard.week_activity_title")}
            </h3>
            <p className={`text-xs ${dashMuted}`}>{t("dashboard.week_activity_sub")}</p>
          </div>
        </div>
        {peakDay ? (
          <p className="text-right text-xs font-semibold text-indigo-700 tabular-nums">
            {t("dashboard.week_activity_peak", {
              day: peakDay.day,
              amount: formatPrice(peakDay.revenue),
            })}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="h-[200px] animate-pulse rounded-2xl bg-gradient-to-br from-slate-200/50 via-slate-100/80 to-indigo-100/25" />
      ) : chartData.length === 0 ? (
        <p className={`py-10 text-center text-sm ${dashMuted}`}>{t("dashboard.week_activity_empty")}</p>
      ) : isEmpty ? (
        <p className={`py-10 text-center text-sm ${dashMuted}`}>{t("dashboard.week_activity_empty")}</p>
      ) : (
        <div className={`h-[200px] w-full min-w-0 ${dashInnerWell} !p-2`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                width={44}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatPrice(Number(v))}
              />
              <Tooltip
                cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const revenue = Number((payload[0]?.payload as { revenue?: number })?.revenue ?? 0);
                  return (
                    <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.18)] backdrop-blur-md">
                      <p className="text-xs font-medium text-slate-500">{String(label)}</p>
                      <p className="text-sm font-semibold text-indigo-700 tabular-nums">{formatPrice(revenue)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="revenue" radius={[10, 10, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                {chartData.map((_, i) => (
                  <Cell key={`wk-${i}`} fill={i === maxIdx ? "#4f46e5" : "#cbd5e1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function PopularTimesCard({
  heatmap,
  loading,
}: {
  heatmap: VisitorHeatmap;
  loading: boolean;
}) {
  const { t } = usePosLocale();
  const dayCount = Math.min(heatmap.dayLabels.length, heatmap.matrix24.length);
  /** Default to last column = today (see buildVisitorHeatmap7d). */
  const [dayIdx, setDayIdx] = useState(6);

  useEffect(() => {
    const n = Math.min(heatmap.dayLabels.length, heatmap.matrix24.length);
    if (n <= 0) return;
    setDayIdx((d) => Math.min(Math.max(0, d), n - 1));
  }, [heatmap.dayLabels, heatmap.matrix24]);

  const safeIdx = dayCount > 0 ? Math.min(dayIdx, dayCount - 1) : 0;
  const rowRaw = heatmap.matrix24[safeIdx];
  const rowPadded = useMemo(() => {
    const r = Array.isArray(rowRaw) ? [...rowRaw] : [];
    while (r.length < 24) r.push(0);
    return r.slice(0, 24);
  }, [rowRaw]);

  const chartData = useMemo(
    () => rowPadded.map((count, hour) => ({ hour, count: Number(count) || 0 })),
    [rowPadded],
  );

  const peakMeta = useMemo(() => {
    let max = -1;
    let hour = 0;
    for (const d of chartData) {
      if (d.count > max) {
        max = d.count;
        hour = d.hour;
      }
    }
    return max <= 0 ? null : { hour, count: max };
  }, [chartData]);

  const isEmpty = !loading && chartData.length > 0 && !chartData.some((d) => d.count > 0);

  return (
    <section className={`w-full min-w-0 ${dashPanel}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400/30 to-fuchsia-600/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ring-1 ring-white/55">
            <Clock className="size-5 text-violet-600 drop-shadow-sm" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              {t("dashboard.popular_times_title")}
            </h3>
            <p className={`text-xs ${dashMuted}`}>{t("dashboard.popular_times_sub")}</p>
          </div>
        </div>
        {peakMeta ? (
          <p className="text-right text-xs font-medium text-violet-700 tabular-nums">
            {t("dashboard.popular_times_peak", {
              hour: formatHourSnapchat(peakMeta.hour),
              level: t(popularTimesBusyLevelKey(peakMeta.count, peakMeta.count)),
            })}
          </p>
        ) : null}
      </div>

      {dayCount > 0 ? (
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {heatmap.dayLabels.slice(0, dayCount).map((label, i) => (
            <button
              key={`${label}-${i}`}
              type="button"
              onClick={() => setDayIdx(i)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-[transform,box-shadow,background] ${
                i === safeIdx
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]"
                  : "border border-white/50 bg-white/50 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-sm hover:-translate-y-0.5 hover:bg-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="h-[220px] animate-pulse rounded-2xl bg-gradient-to-br from-slate-200/50 via-violet-100/40 to-fuchsia-100/30" />
      ) : dayCount === 0 || chartData.length === 0 ? (
        <p className={`py-10 text-center text-sm ${dashMuted}`}>{t("dashboard.popular_times_empty")}</p>
      ) : isEmpty ? (
        <p className={`py-10 text-center text-sm ${dashMuted}`}>{t("dashboard.popular_times_empty")}</p>
      ) : (
        <div className={`h-[220px] w-full min-w-0 ${dashInnerWell} !p-2`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="12%">
              <defs>
                <linearGradient id="popularTimesBarFill" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#c4b5fd" stopOpacity={0.35} />
                  <stop offset="55%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                tickFormatter={formatHourSnapchat}
                interval={2}
              />
              <YAxis
                width={32}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(139, 92, 246, 0.08)" }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const c = Number((payload[0]?.payload as { count?: number })?.count ?? 0);
                  const peakCount = peakMeta?.count ?? 0;
                  const levelKey = popularTimesBusyLevelKey(c, peakCount);
                  return (
                    <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.18)] backdrop-blur-md">
                      <p className="text-xs font-medium text-slate-500">{formatHourSnapchat(Number(label))}</p>
                      <p className="text-sm font-semibold text-violet-700">{t(levelKey)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[10, 10, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                {chartData.map((_, i) => (
                  <Cell key={`pt-${i}`} fill="url(#popularTimesBarFill)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function OrdersAnalyticsSection({
  salesChart,
  mode,
  onModeChange,
  formatPrice,
  loading,
}: {
  salesChart: Record<SalesChartMode, SalesChartSeries>;
  mode: SalesChartMode;
  onModeChange: (mode: SalesChartMode) => void;
  formatPrice: (n: number) => string;
  loading: boolean;
}) {
  const { t } = usePosLocale();
  const ordersAnalyticsModes = useMemo(
    () =>
      (["month", "week", "day", "all"] as const).map((value) => ({
        value,
        label:
          value === "month"
            ? t("dashboard.chart_month")
            : value === "week"
              ? t("dashboard.chart_week")
              : value === "day"
                ? t("dashboard.chart_day")
                : t("dashboard.chart_all"),
      })),
    [t],
  );
  const series = salesChart[mode];
  const data = useMemo(
    () =>
      series.current.map((p, i) => ({
        label: p.label,
        revenue: p.revenue,
        orders: p.orders,
        priorRevenue: series.previous[i]?.revenue ?? 0,
        priorOrders: series.previous[i]?.orders ?? 0,
      })),
    [series],
  );

  const totalRevenue = useMemo(
    () => data.reduce((s, d) => s + (Number(d.revenue) || 0), 0),
    [data],
  );
  const totalPrevious = useMemo(
    () => data.reduce((s, d) => s + (Number(d.priorRevenue) || 0), 0),
    [data],
  );
  const growth = growthPercent(totalRevenue, totalPrevious);

  const isEmpty =
    !loading &&
    (data.length === 0 || !data.some((d) => (Number(d.revenue) || 0) > 0 || (Number(d.priorRevenue) || 0) > 0));

  return (
    <section className={`w-full min-w-0 ${dashPanel}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400/25 to-indigo-700/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-white/55">
            <TrendingUp className="size-5 text-blue-600 drop-shadow-sm" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              {t("dashboard.chart_title")}
            </h3>
            <p className={`text-xs ${dashMuted}`}>{t("dashboard.sales_trend_subtitle")}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-full bg-blue-600" />
                {t("dashboard.chart_series_current")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0 w-3 shrink-0 border-t-2 border-dashed border-slate-400" aria-hidden />
                {t("dashboard.chart_series_previous")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4 sm:gap-5">
          {!loading && !isEmpty ? (
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">
                {formatPrice(totalRevenue)}
              </p>
              {growth !== null ? (
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    growth >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {growth >= 0 ? "+" : ""}
                  {growth.toFixed(1)}%
                </p>
              ) : null}
            </div>
          ) : null}
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as SalesChartMode)}
            className="h-9 shrink-0 rounded-xl border border-white/60 bg-white/55 px-3 text-sm font-medium text-slate-800 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md outline-none transition hover:border-indigo-200/70 hover:bg-white/80"
          >
            {ordersAnalyticsModes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-[240px] animate-pulse rounded-2xl bg-gradient-to-br from-slate-200/50 via-slate-100/80 to-indigo-100/30" />
      ) : isEmpty ? (
        <p className={`py-12 text-center text-sm ${dashMuted}`}>{t("dashboard.chart_empty")}</p>
      ) : (
        <div className={`h-[240px] w-full min-w-0 ${dashInnerWell} !p-2`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="salesTrendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => {
                  const n = Number(v);
                  return n <= 0 ? "0" : formatPrice(n);
                }}
              />
              <Tooltip
                cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as {
                    revenue: number;
                    orders: number;
                    priorRevenue: number;
                    priorOrders: number;
                  };
                  return (
                    <div className="min-w-[180px] rounded-xl border border-white/70 bg-white/85 px-3 py-2.5 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.18)] backdrop-blur-md">
                      <p className="text-xs font-medium text-slate-500">
                        {t("dashboard.sales_tooltip_period", { label: String(label ?? "") })}
                      </p>
                      <div className="mt-2 space-y-1.5 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600">{t("dashboard.chart_series_current")}</span>
                          <span className="font-semibold tabular-nums text-blue-600">{formatPrice(row.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600">{t("dashboard.chart_series_previous")}</span>
                          <span className="font-semibold tabular-nums text-slate-600">{formatPrice(row.priorRevenue)}</span>
                        </div>
                      </div>
                      {row.orders > 0 || row.priorOrders > 0 ? (
                        <p className={`mt-2 border-t border-slate-100 pt-2 text-[11px] ${dashMuted}`}>
                          {[
                            row.orders > 0 ? t("dashboard.chart_tooltip_orders", { count: row.orders }) : null,
                            row.priorOrders > 0
                              ? t("dashboard.sales_tooltip_prior_orders", { count: row.priorOrders })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="priorRevenue"
                name={String(t("dashboard.chart_series_previous"))}
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4, fill: "#94a3b8", stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="none"
                fill="url(#salesTrendArea)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name={String(t("dashboard.chart_series_current"))}
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
                activeDot={{
                  r: 5,
                  fill: "#ffffff",
                  stroke: "#2563eb",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

const SALES_BAR_ACTIVE = "#7B89F4";

function shortMonthTickLabel(full: string): string {
  const t = full.trim();
  if (!t) return "";
  const first = t.split(/\s+/)[0] ?? t;
  return first.length > 5 ? first.slice(0, 3) : first;
}

function popularTimesBusyLevelKey(count: number, peakCount: number): string {
  if (count <= 0 || peakCount <= 0) return "dashboard.popular_times_no_traffic";
  const ratio = count / peakCount;
  if (ratio < 0.25) return "dashboard.popular_times_little_busy";
  if (ratio < 0.5) return "dashboard.popular_times_moderately_busy";
  if (ratio < 0.8) return "dashboard.popular_times_usually_busy";
  return "dashboard.popular_times_very_busy";
}

function salesBarAxisTick(v: number): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function SalesBarTooltipContent({
  payload,
  formatPrice,
  t,
}: {
  payload: Array<{ payload: { fullLabel: string; revenue: number; prevRevenue: number } }>;
  formatPrice: (n: number) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const row = payload[0]?.payload;
  if (!row) return null;
  const vs = growthPercent(row.revenue, row.prevRevenue);
  return (
    <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2.5 shadow-[0_14px_32px_-10px_rgba(15,23,42,0.2)] backdrop-blur-md ring-1 ring-indigo-100/40">
      <div className="mb-1 flex items-center gap-2">
        <Wallet className="size-3.5 text-slate-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {t("dashboard.sales_analytics_income")}
        </span>
      </div>
      <p className="text-xs text-slate-500">{row.fullLabel}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full bg-indigo-500" />
        <span className="text-lg font-bold tabular-nums text-slate-900">{formatPrice(row.revenue)}</span>
      </div>
      {vs !== null ? (
        <p
          className={`mt-1.5 flex items-center gap-1 text-xs font-semibold tabular-nums ${
            vs >= 0 ? "text-emerald-600" : "text-red-500"
          }`}
        >
          {vs >= 0 ? (
            <ArrowUpRight className="size-3.5 shrink-0" />
          ) : (
            <ArrowDownRight className="size-3.5 shrink-0" />
          )}
          {vs >= 0 ? "+" : ""}
          {vs.toFixed(0)}%
        </p>
      ) : null}
    </div>
  );
}

function SalesAnalyticsBarCard({
  monthlyCurrent,
  monthlyPrevious,
  formatPrice,
  loading,
  onViewDetails,
}: {
  monthlyCurrent: ChartPoint[];
  monthlyPrevious: ChartPoint[];
  formatPrice: (n: number) => string;
  loading: boolean;
  onViewDetails?: () => void;
}) {
  const { t } = usePosLocale();
  const patternId = "salesBarStripeFill";

  const data = useMemo(
    () =>
      monthlyCurrent.map((p, i) => ({
        label: shortMonthTickLabel(p.label),
        fullLabel: p.label,
        revenue: p.revenue,
        orders: p.orders,
        prevRevenue: monthlyPrevious[i]?.revenue ?? 0,
      })),
    [monthlyCurrent, monthlyPrevious],
  );

  const peakIndex = useMemo(() => {
    if (data.length === 0) return 0;
    let best = 0;
    let max = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i].revenue > max) {
        max = data[i].revenue;
        best = i;
      }
    }
    return best;
  }, [data]);

  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(peakIndex);
  }, [peakIndex]);

  const isEmpty = !loading && (data.length === 0 || !data.some((d) => d.revenue > 0));

  return (
    <section className={`w-full min-w-0 ${dashPanel}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-slate-900">
          {t("dashboard.sales_analytics_title")}
        </h3>
        {onViewDetails ? (
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-white/70 bg-gradient-to-b from-white to-slate-100/90 text-slate-700 shadow-[0_4px_14px_-6px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:-translate-y-0.5 hover:text-indigo-700 hover:shadow-[0_8px_22px_-6px_rgba(99,102,241,0.35)] active:translate-y-0"
            aria-label={String(t("dashboard.sales_analytics_detail"))}
          >
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="h-[260px] animate-pulse rounded-2xl bg-gradient-to-br from-slate-200/50 via-slate-100/80 to-violet-100/25" />
      ) : isEmpty ? (
        <p className="py-12 text-center text-sm text-slate-500">{t("dashboard.chart_empty")}</p>
      ) : (
        <div className={`h-[260px] w-full min-w-0 ${dashInnerWell} !p-3`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 2 }}>
              <defs>
                <pattern
                  id={patternId}
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#f1f5f9" />
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" strokeWidth="3" />
                </pattern>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={salesBarAxisTick}
              />
              <Tooltip
                cursor={{ fill: "rgba(15, 30, 115, 0.06)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <SalesBarTooltipContent
                      payload={payload as Array<{ payload: { fullLabel: string; revenue: number; prevRevenue: number } }>}
                      formatPrice={formatPrice}
                      t={t}
                    />
                  );
                }}
              />
              <Bar
                dataKey="revenue"
                radius={[10, 10, 10, 10]}
                maxBarSize={34}
                isAnimationActive={false}
                onClick={(_entry, index) => setActiveIndex(index)}
              >
                {data.map((_, i) => (
                  <Cell
                    key={`bar-${i}`}
                    fill={i === activeIndex ? SALES_BAR_ACTIVE : `url(#${patternId})`}
                    className="outline-none"
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
) {
  const startOuter = polarPoint(cx, cy, outerR, startDeg);
  const endOuter = polarPoint(cx, cy, outerR, endDeg);
  const startInner = polarPoint(cx, cy, innerR, endDeg);
  const endInner = polarPoint(cx, cy, innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

function DashboardInsights({
  topItems,
  t,
  loading,
}: {
  topItems: TopItemRow[];
  t: (key: string, options?: Record<string, unknown>) => string;
  loading: boolean;
}) {
  const donutData = useMemo(() => {
    if (topItems.length === 0) return [];
    return topItems
      .slice()
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
      .filter((i) => i.quantity > 0)
      .map((i) => ({
        name: i.name,
        value: i.quantity,
      }));
  }, [topItems]);

  const donutTotalQty = useMemo(
    () => donutData.reduce((s, d) => s + d.value, 0),
    [donutData],
  );
  const allProductsTotalQty = useMemo(
    () => topItems.reduce((s, item) => s + Math.max(0, Number(item.quantity) || 0), 0),
    [topItems],
  );

  return (
    <div className={dashCard}>
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-900">{t("dashboard.top5_products_title")}</h2>
        <p className={`text-[11px] ${dashMuted} mt-0.5`}>{t("dashboard.top5_products_subtitle")}</p>
      </div>
      {loading ? (
        <div className="mx-auto h-[220px] w-[220px] rounded-full bg-gradient-to-br from-slate-200/60 to-indigo-100/40 shadow-[inset_0_4px_12px_rgba(15,23,42,0.08)] animate-pulse" />
      ) : donutData.length === 0 || donutTotalQty <= 0 ? (
        <p className={`text-sm ${dashMuted} py-16 text-center`}>{t("dashboard.donut_empty")}</p>
      ) : (
        <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[220px_1fr]">
          <div className="flex items-center justify-center drop-shadow-[0_18px_36px_-12px_rgba(15,23,42,0.2)]">
            <svg viewBox="0 0 220 220" className="h-[220px] w-[220px]">
              {(() => {
                let angle = 0;
                const outer = 92;
                const inner = 62;
                return donutData.map((row, i) => {
                  const slice = (row.value / donutTotalQty) * 360;
                  const start = angle + 1.25;
                  const end = angle + Math.max(1, slice - 1.25);
                  angle += slice;
                  return (
                    <path
                      key={`${row.name}-${i}`}
                      d={donutArcPath(110, 110, inner, outer, start, end)}
                      fill={DONUT_PALETTE[i % DONUT_PALETTE.length]}
                    />
                  );
                });
              })()}
              <circle cx="110" cy="110" r="48" fill="#ffffff" />
              <text
                x="110"
                y="104"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-500 text-[10px] font-medium"
              >
                {t("dashboard.donut_total_qty_label")}
              </text>
              <text
                x="110"
                y="118"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-900 text-[20px] font-semibold"
              >
                {allProductsTotalQty}
              </text>
            </svg>
          </div>
          <div className="space-y-1.5 pr-1">
            {donutData.map((row, i) => (
              <div key={`legend-${row.name}`} className="flex items-center justify-between gap-2 px-1 py-1">
                <span className="inline-flex min-w-0 items-center gap-2 text-xs text-slate-600">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: DONUT_PALETTE[i % DONUT_PALETTE.length] }}
                  />
                  <span className="truncate">{row.name}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-900 tabular-nums">
                  {t("dashboard.donut_row_qty", { count: row.value })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FiscalSystemSection({
  fiscalTotal,
  nonFiscalTotal,
  formatPrice,
  licenseKey,
  staffId,
  staffName,
  staffRole,
}: {
  fiscalTotal: number;
  nonFiscalTotal: number;
  formatPrice: (n: number) => string;
  licenseKey: string;
  staffId: string;
  staffName: string;
  staffRole: string;
}) {
  const { t } = usePosLocale();
  const hasData = fiscalTotal > 0 || nonFiscalTotal > 0;
  const todayData = useMemo(
    () => [{ label: t("dashboard.period_day"), fiscal: fiscalTotal, nonFiscal: nonFiscalTotal }],
    [fiscalTotal, nonFiscalTotal, t],
  );
  return (
    <section className={`w-full min-w-0 ${dashPanel}`}>
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{t("dashboard.fiscal_system_title")}</h3>
            <p className={`text-xs ${dashMuted}`}>{t("dashboard.fiscal_system_subtitle")}</p>
          </div>
          <span className="rounded-full border border-white/60 bg-white/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm">
            {t("dashboard.today_badge")}
          </span>
        </div>
        {!hasData ? (
          <p className="py-10 text-center text-sm text-slate-500">{t("dashboard.fiscal_empty")}</p>
        ) : (
          <div className={`w-full min-w-0 ${dashInnerWell}`}>
            <div className="mb-3 flex items-center gap-5 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {t("dashboard.fiscal_short")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                {t("dashboard.non_fiscal_short")}
              </span>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={todayData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatPrice(Number(v))} />
                  <Bar dataKey="fiscal" name={t("dashboard.fiscal_short")} fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={20}>
                    <LabelList
                      dataKey="fiscal"
                      position="bottom"
                      formatter={(v: number) => formatPrice(Number(v))}
                      fill="#059669"
                      fontSize={11}
                      fontWeight={700}
                    />
                  </Bar>
                  <Bar dataKey="nonFiscal" name={t("dashboard.non_fiscal_short")} fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={20}>
                    <LabelList
                      dataKey="nonFiscal"
                      position="bottom"
                      formatter={(v: number) => formatPrice(Number(v))}
                      fill="#d97706"
                      fontSize={11}
                      fontWeight={700}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end border-t border-slate-200/40 pt-3">
        <BulkFiscalizationSheet
          licenseKey={licenseKey}
          staffId={staffId}
          staffName={staffName}
          staffRole={staffRole}
        />
      </div>
    </section>
  );
}

// ── Helper Components ────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className={dashCard}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={dashLabel}>{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
          {sub ? <p className={`text-xs ${dashMuted} mt-1`}>{sub}</p> : null}
        </div>
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-white/50"
          style={{ backgroundColor: `${color}28` }}
        >
          <Icon className="size-5 drop-shadow-sm" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className={dashCard}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-white/60">
          <Icon className="size-4 text-slate-600 drop-shadow-sm" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}
