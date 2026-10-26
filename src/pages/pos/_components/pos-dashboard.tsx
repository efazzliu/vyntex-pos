import { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
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
import EnterpriseCustomReports from "./enterprise-custom-reports.tsx";
import SystemStatusPanel from "./system-status-panel.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  CircleCheck,
  ShoppingCart,
  Users,
  UtensilsCrossed,
  Wine,
  Clock,
  BarChart2,
  CreditCard,
  Banknote,
  FileCheck,
  FileWarning,
  ReceiptText,
  UserCheck,
  Coins,
  Wallet,
  Package,
  Check,
  Pencil,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { BRAND } from "@/lib/brand-colors.ts";

type PosDashboardProps = {
  licenseKey: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  /** Professional+: emphasise full analytics pack (charts, staff, payment mix). */
  showAdvancedAnalytics?: boolean;
  /** Enterprise-only operational command center. */
  showEnterpriseOverview?: boolean;
  /** Opens order history / sales detail (e.g. from Sales analytics “View details”). */
  onOpenSalesDetail?: () => void;
  onOpenStock?: () => void;
  onOpenSettings?: () => void;
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

type DashboardKpis = {
  totalRevenue: number;
  previousRevenue: number;
  totalOrders: number;
  previousOrders: number;
  barRevenue: number;
  previousBarRevenue: number;
  kitchenRevenue: number;
  previousKitchenRevenue: number;
  series: {
    revenue: number[];
    orders: number[];
    bar: number[];
    kitchen: number[];
  };
};

type InventoryAlertItem = {
  id: string;
  name: string;
  currentStock: number;
  lowStockThreshold: number;
  stockUnit: string;
  imageUrl: string | null;
};

type TargetPulsePeriod = "month" | "six_months" | "custom";
type TargetPulseInput = {
  amount: number;
  startAt: string;
  endAt: string;
  period: TargetPulsePeriod;
};

type EnterpriseOverview = {
  liveOperations: {
    activeTables: number;
    totalTables: number;
    availableTables: number;
    occupiedTables: number;
    reservedTables: number;
    kitchenOrders: number;
    barOrders: number;
    activeOrders: number;
    kitchenQueueItems: number;
    barQueueItems: number;
    readyItems: number;
    delayedItems: number;
    averageQueueAgeMinutes: number;
  };
  targetPulse: {
    amount: number;
    currentRevenue: number;
    startAt: string | null;
    endAt: string | null;
    period: TargetPulsePeriod | null;
  };
  profitability: {
    revenue: number;
    estimatedStockCost: number;
    operatingExpenses: number;
    estimatedProfit: number;
    marginPercent: number;
  };
  performance: {
    averageOrderValue: number;
    previousAverageOrderValue: number;
    averagePreparationMinutes: number;
    preparationSampleCount: number;
    tableTurnsPerDay: number;
    cancellationRatePercent: number;
    dailySalesTarget: number;
    periodSalesTarget: number;
  };
  paymentMix: {
    cash: number;
    card: number;
    debt: number;
    other: number;
  };
  smartAlerts: {
    outOfStockCount: number;
    outOfStockNames: string[];
    outOfStockItems: InventoryAlertItem[];
    lowStockCount: number;
    lowStockNames: string[];
    lowStockItems: InventoryAlertItem[];
    delayedItems: number;
    cancelledOrders: number;
    voidedItems: number;
  };
};

type RevenueOverview = {
  currentTotal: number;
  previousTotal: number;
  points: Array<{
    currentRevenue: number;
    previousRevenue: number;
  }>;
};

const EMPTY_REVENUE_OVERVIEW: RevenueOverview = {
  currentTotal: 0,
  previousTotal: 0,
  points: [],
};

type RevenuePeriod = "day" | "week" | "month" | "year";

const EMPTY_ENTERPRISE_OVERVIEW: EnterpriseOverview = {
  liveOperations: {
    activeTables: 0,
    totalTables: 0,
    availableTables: 0,
    occupiedTables: 0,
    reservedTables: 0,
    kitchenOrders: 0,
    barOrders: 0,
    activeOrders: 0,
    kitchenQueueItems: 0,
    barQueueItems: 0,
    readyItems: 0,
    delayedItems: 0,
    averageQueueAgeMinutes: 0,
  },
  targetPulse: {
    amount: 0,
    currentRevenue: 0,
    startAt: null,
    endAt: null,
    period: null,
  },
  profitability: {
    revenue: 0,
    estimatedStockCost: 0,
    operatingExpenses: 0,
    estimatedProfit: 0,
    marginPercent: 0,
  },
  performance: {
    averageOrderValue: 0,
    previousAverageOrderValue: 0,
    averagePreparationMinutes: 0,
    preparationSampleCount: 0,
    tableTurnsPerDay: 0,
    cancellationRatePercent: 0,
    dailySalesTarget: 0,
    periodSalesTarget: 0,
  },
  paymentMix: {
    cash: 0,
    card: 0,
    debt: 0,
    other: 0,
  },
  smartAlerts: {
    outOfStockCount: 0,
    outOfStockNames: [],
    outOfStockItems: [],
    lowStockCount: 0,
    lowStockNames: [],
    lowStockItems: [],
    delayedItems: 0,
    cancelledOrders: 0,
    voidedItems: 0,
  },
};

const EMPTY_KPI_SERIES = Array.from({ length: 12 }, () => 0);
const EMPTY_DASHBOARD_KPIS: DashboardKpis = {
  totalRevenue: 0,
  previousRevenue: 0,
  totalOrders: 0,
  previousOrders: 0,
  barRevenue: 0,
  previousBarRevenue: 0,
  kitchenRevenue: 0,
  previousKitchenRevenue: 0,
  series: {
    revenue: EMPTY_KPI_SERIES,
    orders: EMPTY_KPI_SERIES,
    bar: EMPTY_KPI_SERIES,
    kitchen: EMPTY_KPI_SERIES,
  },
};

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
  ready: BRAND.accent,
  served: BRAND.primary,
  paid: "#00C2FF",
  cancelled: "#FF3B30",
};

const dashCanvas =
  "relative min-h-full min-w-0 overflow-x-hidden bg-[#f4f7fb] p-5 sm:p-6 lg:p-8";
/** Solid elevated card — crisp, readable KPIs. */
const dashCard =
  "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.12)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_40px_-16px_rgba(15,23,42,0.16)]";
/** Large chart / analytics panels. */
const dashPanel =
  "rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.13)] transition-[box-shadow] duration-200 ease-out hover:shadow-[0_2px_8px_rgba(15,23,42,0.05),0_20px_44px_-18px_rgba(15,23,42,0.15)] lg:p-5";
/** Inset well for charts inside a panel. */
const dashInnerWell =
  "rounded-xl border border-slate-100 bg-[#f4f8fb] p-4";
const dashMuted = "text-slate-500";
const dashLabel = "text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400";

const DONUT_PALETTE = [
  "#0d9488",
  "#0284c7",
  "#ea580c",
  "#059669",
  "#e11d48",
  "#ca8a04",
];

function parseYmdToLocalNoon(ymd: string): Date {
  const parts = ymd.split("-").map((x) => Number(x));
  const y = parts[0] ?? 1970;
  const mo = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

function addLocalCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfLocalWeekMonday(date: Date): Date {
  const day = new Date(date);
  day.setHours(12, 0, 0, 0);
  const weekDay = day.getDay();
  day.setDate(day.getDate() + (weekDay === 0 ? -6 : 1 - weekDay));
  return day;
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfLocalMonth(date: Date): Date {
  const next = startOfLocalDay(date);
  next.setDate(1);
  return next;
}

function startOfLocalYear(date: Date): Date {
  const next = startOfLocalMonth(date);
  next.setMonth(0);
  return next;
}

function addLocalMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function daysInLocalMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function boundaryIso(date: Date): string {
  return new Date(date).toISOString();
}

function buildRevenueBoundariesIso(period: RevenuePeriod): string[] {
  const now = new Date();
  if (period === "day") {
    const today = startOfLocalDay(now);
    const yesterday = addLocalCalendarDays(today, -1);
    const hourBoundary = (day: Date, hour: number) => {
      const next = new Date(day);
      next.setHours(hour, 0, 0, 0);
      return boundaryIso(next);
    };
    return [
      ...Array.from({ length: 24 }, (_, index) => hourBoundary(yesterday, index)),
      ...Array.from({ length: 25 }, (_, index) => hourBoundary(today, index)),
    ];
  }
  if (period === "week") {
    const weekStart = startOfLocalWeekMonday(now);
    const previousStart = addLocalCalendarDays(weekStart, -7);
    return Array.from({ length: 15 }, (_, index) =>
      boundaryIso(startOfLocalDay(addLocalCalendarDays(previousStart, index))),
    );
  }
  if (period === "month") {
    const monthStart = startOfLocalMonth(now);
    const previousStart = startOfLocalMonth(addLocalMonths(monthStart, -1));
    const days = Math.min(now.getDate(), daysInLocalMonth(previousStart));
    return [
      ...Array.from({ length: days }, (_, index) =>
        boundaryIso(startOfLocalDay(addLocalCalendarDays(previousStart, index))),
      ),
      ...Array.from({ length: days + 1 }, (_, index) =>
        boundaryIso(startOfLocalDay(addLocalCalendarDays(monthStart, index))),
      ),
    ];
  }
  const yearStart = startOfLocalYear(now);
  const previousStart = startOfLocalYear(addLocalMonths(yearStart, -12));
  return [
    ...Array.from({ length: 12 }, (_, index) =>
      boundaryIso(startOfLocalMonth(addLocalMonths(previousStart, index))),
    ),
    ...Array.from({ length: 13 }, (_, index) =>
      boundaryIso(startOfLocalMonth(addLocalMonths(yearStart, index))),
    ),
  ];
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

const CALENDAR_WEEKDAYS = {
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
  sq: ["Hë", "Ma", "Më", "En", "Pr", "Sh", "Di"],
} as const;

type CalendarLevel = "days" | "months" | "years";

const CALENDAR_YEAR_PAGE = 12;

function calendarMonthName(
  monthIndex: number,
  locale: string,
  width: "long" | "short",
): string {
  return new Date(2020, monthIndex, 1, 12).toLocaleDateString(locale, {
    month: width,
  });
}

function clampVisibleMonth(year: number, month: number, today: Date): Date {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  if (year > todayYear) return new Date(todayYear, todayMonth, 1, 12, 0, 0, 0);
  if (year === todayYear && month > todayMonth) {
    return new Date(year, todayMonth, 1, 12, 0, 0, 0);
  }
  return new Date(year, month, 1, 12, 0, 0, 0);
}

function yearPageStart(year: number, maxYear: number): number {
  const last = Math.min(maxYear, year);
  const offset = (maxYear - last) % CALENDAR_YEAR_PAGE;
  return last - (CALENDAR_YEAR_PAGE - 1 - offset);
}

function monthGridDays(monthAnchor: Date): Date[] {
  const first = new Date(
    monthAnchor.getFullYear(),
    monthAnchor.getMonth(),
    1,
    12,
    0,
    0,
    0,
  );
  const last = new Date(
    monthAnchor.getFullYear(),
    monthAnchor.getMonth() + 1,
    0,
    12,
    0,
    0,
    0,
  );
  const start = startOfLocalWeekMonday(first);
  const end = addLocalCalendarDays(startOfLocalWeekMonday(last), 6);
  const days: Date[] = [];
  for (
    let current = start;
    current.getTime() <= end.getTime();
    current = addLocalCalendarDays(current, 1)
  ) {
    days.push(current);
  }
  return days;
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
  const [draftFrom, setDraftFrom] = useState(fromYmd);
  const [draftTo, setDraftTo] = useState(toYmd);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfLocalMonth(parseYmdToLocalNoon(fromYmd)),
  );
  const [level, setLevel] = useState<CalendarLevel>("days");
  const displayLocaleTag = language === "sq" ? "sq-AL" : "en-GB";
  const todayNoon = startOfLocalTodayNoon();
  const todayYear = todayNoon.getFullYear();
  const todayMonth = todayNoon.getMonth();
  const visibleYear = visibleMonth.getFullYear();
  const weekdayLabels = CALENDAR_WEEKDAYS[language];
  const monthDays = useMemo(() => monthGridDays(visibleMonth), [visibleMonth]);
  const years = useMemo(() => {
    const start = yearPageStart(visibleYear, todayYear);
    return Array.from({ length: CALENDAR_YEAR_PAGE }, (_, index) => start + index);
  }, [todayYear, visibleYear]);
  const canGoNextMonth =
    visibleYear < todayYear ||
    (visibleYear === todayYear && visibleMonth.getMonth() < todayMonth);
  const canGoNextYear = visibleYear < todayYear;
  const canGoNextYearPage = years[years.length - 1] < todayYear;
  const shortDate = (ymd: string) => {
    if (!ymd) return "—";
    return parseYmdToLocalNoon(ymd).toLocaleDateString(displayLocaleTag, {
      day: "numeric",
      month: "short",
    });
  };
  const fullDate = (ymd: string) =>
    parseYmdToLocalNoon(ymd).toLocaleDateString(displayLocaleTag, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const triggerLabel =
    fromYmd === toYmd
      ? fullDate(fromYmd)
      : `${shortDate(fromYmd)} – ${fullDate(toYmd)}`;

  const presets = useMemo(() => {
    const today = new Date();
    const todayYmd = formatLocalYmd(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const last7 = new Date(today);
    last7.setDate(today.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return [
      {
        id: "today",
        label: t("dashboard.calendar_today"),
        from: todayYmd,
        to: todayYmd,
      },
      {
        id: "yesterday",
        label: t("dashboard.calendar_yesterday"),
        from: formatLocalYmd(yesterday),
        to: formatLocalYmd(yesterday),
      },
      {
        id: "last7",
        label: t("dashboard.calendar_last_7"),
        from: formatLocalYmd(last7),
        to: todayYmd,
      },
      {
        id: "month",
        label: t("dashboard.calendar_this_month"),
        from: formatLocalYmd(monthStart),
        to: todayYmd,
      },
    ];
  }, [t]);

  const hasDraft = Boolean(draftFrom);
  const draftChanged = draftFrom !== fromYmd || draftTo !== toYmd;
  const activePresetId = presets.find(
    (preset) => preset.from === fromYmd && preset.to === toYmd,
  )?.id;

  const applyRange = (from: string, to: string, close = true) => {
    const next = normalizeRangeYmd(from, to);
    setDraftFrom(next.from);
    setDraftTo(next.to);
    setPickingEnd(false);
    onRangeYmd(next.from, next.to);
    if (close) setOpen(false);
  };

  const pickDay = (clicked: string) => {
    if (pickingEnd && draftFrom) {
      if (clicked === draftFrom && draftFrom === draftTo) {
        setDraftFrom("");
        setDraftTo("");
        setPickingEnd(false);
        return;
      }
      const next = normalizeRangeYmd(draftFrom, clicked);
      setDraftFrom(next.from);
      setDraftTo(next.to);
      setPickingEnd(false);
      return;
    }
    setDraftFrom(clicked);
    setDraftTo(clicked);
    setPickingEnd(true);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setDraftFrom(fromYmd);
          setDraftTo(toYmd);
          setPickingEnd(false);
          setLevel("days");
          setVisibleMonth(startOfLocalMonth(parseYmdToLocalNoon(fromYmd)));
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex h-12 max-w-full shrink-0 items-center gap-2.5 rounded-2xl border border-white bg-white/95 px-1.5 pr-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.28)] outline-none ring-1 ring-slate-200/70 transition hover:-translate-y-px hover:ring-teal-200/90 focus-visible:ring-2 focus-visible:ring-teal-500/35"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-[0.9rem] bg-[linear-gradient(145deg,#0d9488_0%,#0891b2_100%)] text-[#ffffff] shadow-[0_8px_16px_-10px_rgba(13,148,136,0.9)]">
            <CalendarDays className="size-4" strokeWidth={2.25} />
          </span>
          <span className="min-w-0">
            <span className="block text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {t("dashboard.calendar_range_label")}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold tracking-[-0.02em] text-slate-950">
              {fromYmd === toYmd ? (
                <span className="truncate">{triggerLabel}</span>
              ) : (
                <>
                  <span className="truncate">{shortDate(fromYmd)}</span>
                  <span className="text-slate-300">→</span>
                  <span className="truncate">{shortDate(toYmd)}</span>
                </>
              )}
            </span>
          </span>
          <ChevronDown
            className={`size-3.5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        collisionPadding={16}
        className="dash-popover-balloon !w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.5rem] border border-white/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-0 shadow-[0_24px_70px_-20px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80"
      >
        <div className="relative border-b border-slate-100 px-4 pb-3 pt-4">
          <span
            className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/70 to-transparent"
            aria-hidden
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {t("dashboard.calendar_from")}
              </p>
              <p className="mt-0.5 text-[13px] font-bold text-slate-950">
                {shortDate(draftFrom)}
              </p>
            </div>
            <div
              className={`rounded-2xl border px-3 py-2 ${
                pickingEnd
                  ? "border-teal-300 bg-teal-50"
                  : "border-slate-200/80 bg-white"
              }`}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {t("dashboard.calendar_to")}
              </p>
              <p className="mt-0.5 text-[13px] font-bold text-slate-950">
                {shortDate(draftTo)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 px-4 pt-3">
          {presets.map((preset) => {
            const active = activePresetId === preset.id && !draftChanged;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyRange(preset.from, preset.to)}
                className={`h-8 rounded-xl px-1 text-[10px] font-bold transition ${
                  active
                    ? "bg-teal-600 text-[#ffffff] shadow-[0_8px_16px_-10px_rgba(13,148,136,0.8)]"
                    : "border border-slate-200 bg-white text-slate-500 hover:border-teal-200 hover:text-teal-700"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="px-3 pb-1 pt-2">
          <div className="relative mb-1 flex h-11 items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (level === "years") {
                  setVisibleMonth((month) =>
                    clampVisibleMonth(
                      month.getFullYear() - CALENDAR_YEAR_PAGE,
                      month.getMonth(),
                      todayNoon,
                    ),
                  );
                  return;
                }
                if (level === "months") {
                  setVisibleMonth((month) =>
                    clampVisibleMonth(
                      month.getFullYear() - 1,
                      month.getMonth(),
                      todayNoon,
                    ),
                  );
                  return;
                }
                setVisibleMonth((month) => addLocalMonths(month, -1));
              }}
              className="absolute left-1 text-slate-800 transition hover:text-teal-700"
              aria-label={
                level === "years"
                  ? t("dashboard.calendar_prev_years")
                  : level === "months"
                    ? t("dashboard.calendar_prev_year")
                    : t("dashboard.calendar_prev_month")
              }
            >
              <ChevronLeft className="size-5" strokeWidth={2.25} />
            </button>
            <div className="flex items-center gap-1.5">
              {level === "days" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setLevel("months")}
                    className="text-[16px] font-extrabold tracking-[-0.03em] text-slate-950 transition hover:text-teal-700"
                    aria-label={t("dashboard.calendar_choose_month")}
                  >
                    {calendarMonthName(
                      visibleMonth.getMonth(),
                      displayLocaleTag,
                      "long",
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLevel("years")}
                    className="text-[16px] font-extrabold tracking-[-0.03em] text-slate-950 transition hover:text-teal-700"
                    aria-label={t("dashboard.calendar_choose_year")}
                  >
                    {visibleYear}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setLevel(level === "months" ? "years" : "months")
                  }
                  className="text-[16px] font-extrabold tracking-[-0.03em] text-slate-950 transition hover:text-teal-700"
                  aria-label={
                    level === "months"
                      ? t("dashboard.calendar_choose_year")
                      : t("dashboard.calendar_choose_month")
                  }
                >
                  {level === "months"
                    ? visibleYear
                    : `${years[0]} – ${years[years.length - 1]}`}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (level === "years") {
                  setVisibleMonth((month) =>
                    clampVisibleMonth(
                      month.getFullYear() + CALENDAR_YEAR_PAGE,
                      month.getMonth(),
                      todayNoon,
                    ),
                  );
                  return;
                }
                if (level === "months") {
                  setVisibleMonth((month) =>
                    clampVisibleMonth(
                      month.getFullYear() + 1,
                      month.getMonth(),
                      todayNoon,
                    ),
                  );
                  return;
                }
                setVisibleMonth((month) => addLocalMonths(month, 1));
              }}
              disabled={
                level === "years"
                  ? !canGoNextYearPage
                  : level === "months"
                    ? !canGoNextYear
                    : !canGoNextMonth
              }
              className="absolute right-1 text-slate-800 transition hover:text-teal-700 disabled:text-slate-300"
              aria-label={
                level === "years"
                  ? t("dashboard.calendar_next_years")
                  : level === "months"
                    ? t("dashboard.calendar_next_year")
                    : t("dashboard.calendar_next_month")
              }
            >
              <ChevronRight className="size-5" strokeWidth={2.25} />
            </button>
          </div>

          {level === "months" ? (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {Array.from({ length: 12 }, (_, month) => {
                const isFuture =
                  visibleYear > todayYear ||
                  (visibleYear === todayYear && month > todayMonth);
                const selected = month === visibleMonth.getMonth();
                const isCurrent =
                  visibleYear === todayYear && month === todayMonth;
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={isFuture}
                    onClick={() => {
                      setVisibleMonth(
                        clampVisibleMonth(visibleYear, month, todayNoon),
                      );
                      setLevel("days");
                    }}
                    className={cn(
                      "h-11 rounded-xl text-[13px] font-semibold transition",
                      isFuture && "cursor-default text-slate-300",
                      !isFuture &&
                        selected &&
                        "bg-teal-600 text-[#ffffff] shadow-[0_8px_16px_-10px_rgba(13,148,136,0.85)]",
                      !isFuture &&
                        !selected &&
                        "text-slate-700 hover:bg-teal-50 hover:text-teal-800",
                      !isFuture &&
                        !selected &&
                        isCurrent &&
                        "text-teal-700",
                    )}
                  >
                    {calendarMonthName(month, displayLocaleTag, "short")}
                  </button>
                );
              })}
            </div>
          ) : null}

          {level === "years" ? (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {years.map((year) => {
                const isFuture = year > todayYear;
                const selected = year === visibleYear;
                const isCurrent = year === todayYear;
                return (
                  <button
                    key={year}
                    type="button"
                    disabled={isFuture}
                    onClick={() => {
                      setVisibleMonth(
                        clampVisibleMonth(
                          year,
                          visibleMonth.getMonth(),
                          todayNoon,
                        ),
                      );
                      setLevel("months");
                    }}
                    className={cn(
                      "h-11 rounded-xl text-[13px] font-semibold transition",
                      isFuture && "cursor-default text-slate-300",
                      !isFuture &&
                        selected &&
                        "bg-teal-600 text-[#ffffff] shadow-[0_8px_16px_-10px_rgba(13,148,136,0.85)]",
                      !isFuture &&
                        !selected &&
                        "text-slate-700 hover:bg-teal-50 hover:text-teal-800",
                      !isFuture &&
                        !selected &&
                        isCurrent &&
                        "text-teal-700",
                    )}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          ) : null}

          {level === "days" ? (
            <>
              <div className="grid grid-cols-7">
                {weekdayLabels.map((label) => (
                  <div
                    key={label}
                    className="h-8 text-center text-[11px] font-semibold leading-8 text-slate-500"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {monthDays.map((date) => {
                  const ymd = formatLocalYmd(date);
                  const isOutside = date.getMonth() !== visibleMonth.getMonth();
                  const isFuture = date.getTime() > todayNoon.getTime();
                  const isToday = ymd === formatLocalYmd(todayNoon);
                  const rangeFrom = draftFrom;
                  const rangeTo = draftTo || draftFrom;
                  const inRange = Boolean(
                    rangeFrom && ymd >= rangeFrom && ymd <= rangeTo,
                  );
                  const isStart = Boolean(rangeFrom && ymd === rangeFrom);
                  const isEnd = Boolean(rangeTo && ymd === rangeTo);
                  const isSingle = inRange && rangeFrom === rangeTo;
                  const isEdge = isStart || isEnd;
                  return (
                    <div
                      key={ymd}
                      className={cn(
                        "relative flex h-10 items-center justify-center",
                        inRange && !isSingle && "bg-teal-100/90",
                        isStart && !isSingle && "rounded-l-full",
                        isEnd && !isSingle && "rounded-r-full",
                      )}
                    >
                      <button
                        type="button"
                        disabled={isFuture}
                        onClick={() => pickDay(ymd)}
                        className={cn(
                          "relative z-10 grid size-9 place-items-center rounded-full text-[14px] transition",
                          isFuture && "cursor-default text-slate-300",
                          !isFuture &&
                            isOutside &&
                            !inRange &&
                            "font-medium text-slate-400",
                          !isFuture &&
                            !isOutside &&
                            !inRange &&
                            "font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800",
                          !isFuture &&
                            inRange &&
                            !isEdge &&
                            "font-semibold text-teal-800",
                          !isFuture &&
                            isToday &&
                            !inRange &&
                            "font-semibold text-teal-700",
                          !isFuture &&
                            isEdge &&
                            "bg-teal-600 font-semibold text-[#ffffff] shadow-[0_8px_16px_-8px_rgba(13,148,136,0.85)]",
                        )}
                      >
                        {date.getDate()}
                        {isToday && !isEdge ? (
                          <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-teal-500" />
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="min-w-0 text-[10px] font-medium text-slate-400">
            {!hasDraft
              ? t("dashboard.calendar_pick_start")
              : pickingEnd
                ? t("dashboard.calendar_pick_end")
                : draftChanged
                  ? t("dashboard.calendar_ready")
                  : t("dashboard.calendar_range_hint")}
          </p>
          <button
            type="button"
            onClick={() => applyRange(draftFrom, draftTo || draftFrom)}
            disabled={!hasDraft}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-teal-600 px-3 text-[10px] font-bold text-[#ffffff] shadow-[0_8px_16px_-10px_rgba(13,148,136,0.85)] transition hover:bg-teal-700 disabled:cursor-default disabled:opacity-40"
          >
            <Check className="size-3.5" />
            {t("dashboard.calendar_apply")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StockNotificationsPopover({
  alerts,
  loading,
  onOpenStock,
  t,
}: {
  alerts: EnterpriseOverview["smartAlerts"];
  loading: boolean;
  onOpenStock?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const count = Math.max(0, Math.round(alerts.outOfStockCount));
  const remainingCount = Math.max(0, count - alerts.outOfStockNames.length);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("dashboard.stock_notifications_aria", { count })}
          className="group relative grid size-12 shrink-0 place-items-center rounded-2xl border border-white bg-white/95 text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.28)] outline-none ring-1 ring-slate-200/70 transition hover:-translate-y-px hover:text-teal-700 hover:ring-teal-200/90 focus-visible:ring-2 focus-visible:ring-teal-500/35"
        >
          <Bell className="size-4" strokeWidth={2.15} />
          {!loading && count > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 py-px text-[9px] font-bold leading-4 text-[#ffffff] ring-2 ring-white">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        collisionPadding={16}
        className="dash-popover-balloon !w-[350px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-0 shadow-[0_24px_70px_-20px_rgba(15,23,42,0.28)]"
      >
        <div className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-br from-brand via-brand-sky to-brand-accent px-5 py-4 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full border-[18px] border-white/5" />
          <div className="relative flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {t("dashboard.stock_notifications_title")}
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                {t("dashboard.stock_notifications_subtitle")}
              </p>
            </div>
            {!loading && count > 0 ? (
              <span className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                {count}
              </span>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-500">
            <span className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
            {t("common.loading")}
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center px-5 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/10">
              <CircleCheck className="size-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {t("dashboard.stock_notifications_empty")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {t("dashboard.stock_notifications_empty_hint")}
            </p>
          </div>
        ) : (
          <>
            <div className="px-3 py-3">
              <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-rose-600">
                {t("dashboard.stock_notifications_count", { count })}
              </p>
              <div className="space-y-1.5">
                {alerts.outOfStockNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={onOpenStock}
                    disabled={!onOpenStock}
                    className="flex w-full items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2.5 text-left transition enabled:hover:border-rose-200 enabled:hover:bg-rose-50 disabled:cursor-default"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-rose-600 shadow-sm ring-1 ring-rose-600/10">
                      <Package className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                      {name}
                    </span>
                    {onOpenStock ? (
                      <ChevronRight className="size-4 shrink-0 text-slate-400" />
                    ) : null}
                  </button>
                ))}
              </div>
              {remainingCount > 0 ? (
                <p className="px-2 pt-2 text-[11px] font-medium text-slate-400">
                  {t("dashboard.stock_notifications_more", {
                    count: remainingCount,
                  })}
                </p>
              ) : null}
            </div>
            {onOpenStock ? (
              <div className="border-t border-slate-100 bg-slate-50/70 p-3">
                <Button
                  type="button"
                  onClick={onOpenStock}
                  className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-accent text-white hover:from-brand-hover hover:to-[#3bb300]"
                >
                  <Package className="size-4" />
                  {t("settings.open_stock")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function InventoryAlertsBanner({
  alerts,
  loading,
  onOpenStock,
  t,
}: {
  alerts: EnterpriseOverview["smartAlerts"];
  loading: boolean;
  onOpenStock?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (
    !loading &&
    alerts.outOfStockCount <= 0 &&
    alerts.lowStockCount <= 0
  ) {
    return null;
  }

  const fallbackItems = (names: string[]): InventoryAlertItem[] =>
    names.map((name, index) => ({
      id: `${name}-${index}`,
      name,
      currentStock: 0,
      lowStockThreshold: 0,
      stockUnit: "pc",
      imageUrl: null,
    }));
  const outOfStockItems =
    alerts.outOfStockItems.length > 0
      ? alerts.outOfStockItems
      : fallbackItems(alerts.outOfStockNames);
  const lowStockItems =
    alerts.lowStockItems.length > 0
      ? alerts.lowStockItems
      : fallbackItems(alerts.lowStockNames);
  const items = [
    ...outOfStockItems.map((item) => ({
      ...item,
      stockState: "out" as const,
    })),
    ...lowStockItems.map((item) => ({
      ...item,
      stockState: "low" as const,
    })),
  ].slice(0, 3);

  if (loading) {
    return (
      <div className="h-[76px] animate-pulse rounded-[1.4rem] border border-white bg-white/70 shadow-sm" />
    );
  }

  const outCount = Math.round(alerts.outOfStockCount);
  const lowCount = Math.round(alerts.lowStockCount);

  return (
    <section className="relative overflow-hidden rounded-[1.4rem] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(255,247,247,0.97)_58%,rgba(255,251,235,0.94)_100%)] px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_-24px_rgba(225,29,72,0.22)] ring-1 ring-rose-100/80 sm:px-4">
      <span
        className="pointer-events-none absolute -left-10 -top-16 size-32 rounded-full bg-rose-100/70 blur-3xl"
        aria-hidden
      />
      <span
        className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/70 to-transparent"
        aria-hidden
      />
      <div className="relative flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-[220px] shrink-0 items-center gap-3 lg:border-r lg:border-rose-100/80 lg:pr-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-[#ffffff] shadow-[0_8px_18px_-10px_rgba(225,29,72,0.85)]">
            <AlertTriangle className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-slate-950">
              {t("dashboard.inventory_alerts_title")}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
              <span className="size-1.5 shrink-0 rounded-full bg-rose-500" />
              {t("dashboard.inventory_alerts_summary", {
                outOfStock: outCount,
                lowStock: lowCount,
              })}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar pb-0.5 lg:pb-0">
          {items.slice(0, 3).map((item, index) => {
            const isOutOfStock = item.stockState === "out";
            return (
              <button
                type="button"
                key={`${item.stockState}-${item.id || `${item.name}-${index}`}`}
                onClick={onOpenStock}
                disabled={!onOpenStock}
                className={`group flex min-w-[176px] flex-1 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition enabled:hover:bg-white disabled:cursor-default ${
                  isOutOfStock
                    ? "border-rose-100/90 bg-white/80 enabled:hover:border-rose-200"
                    : "border-amber-100/90 bg-white/80 enabled:hover:border-amber-200"
                }`}
              >
                <span
                  className={`relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ${
                    isOutOfStock
                      ? "bg-rose-50 text-rose-600 ring-rose-600/10"
                      : "bg-amber-50 text-amber-600 ring-amber-600/10"
                  }`}
                >
                  <Package className="size-4" />
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-slate-800">
                    {item.name}
                  </span>
                  <span
                    className={`mt-0.5 block text-[10px] font-bold tabular-nums ${
                      isOutOfStock ? "text-rose-600" : "text-amber-600"
                    }`}
                  >
                    {isOutOfStock
                      ? t("dashboard.inventory_alerts_out_of_stock")
                      : t("dashboard.inventory_alerts_left", {
                          count: item.currentStock,
                          unit: item.stockUnit,
                        })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {onOpenStock ? (
          <button
            type="button"
            onClick={onOpenStock}
            aria-label={t("settings.open_stock")}
            className="hidden size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:text-rose-700 lg:flex"
          >
            <ChevronRight className="size-4" />
          </button>
        ) : null}
      </div>
    </section>
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
  showEnterpriseOverview = false,
  onOpenSalesDetail,
  onOpenStock,
  onOpenSettings,
}: PosDashboardProps) {
  const { t, formatPrice, language } = usePosLocale();
  const showStarterLayout = !showAdvancedAnalytics;
  const viewPeriod: DashboardPeriod = "day";
  const todayYmd = formatLocalYmd(new Date());
  const [dashboardRangeFromYmd, setDashboardRangeFromYmd] = useState(todayYmd);
  const [dashboardRangeToYmd, setDashboardRangeToYmd] = useState(todayYmd);
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("week");
  const setDashboardRangeYmd = useCallback((from: string, to: string) => {
    const n = normalizeRangeYmd(from, to);
    setDashboardRangeFromYmd(n.from);
    setDashboardRangeToYmd(n.to);
  }, []);
  const dashboardQueryBounds = useMemo(
    () => computeDashboardQueryBounds(dashboardRangeFromYmd, dashboardRangeToYmd),
    [dashboardRangeFromYmd, dashboardRangeToYmd],
  );
  const revenueDayBoundariesIso = useMemo(
    () => buildRevenueBoundariesIso(revenuePeriod),
    [revenuePeriod],
  );
  const updateTargetPulse = useMutation("pos.dashboard.updateTargetPulse");
  const statsQuery = useQuery("pos.dashboard.getDashboardStats", {
    licenseKey,
    viewPeriod,
    anchorDate: dashboardQueryBounds.anchorDate,
    rangeFromIso: dashboardQueryBounds.rangeFromIso,
    rangeToExclusiveIso: dashboardQueryBounds.rangeToExclusiveIso,
    operationalDayStartIso: dashboardQueryBounds.operationalDayStartIso,
    locale: language,
    staffId,
  });
  const revenueOverviewQuery = useQuery(
    showEnterpriseOverview
      ? "pos.dashboard.getRevenueOverview"
      : undefined,
    showEnterpriseOverview
      ? {
          licenseKey,
          dayBoundariesIso: revenueDayBoundariesIso,
        }
      : "skip",
  );
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
          paidCirculation: 0,
          openUnpaidTotal: 0,
          totalCirculation: 0,
          todayOrderCount: 0,
          todayPaidCount: 0,
          dashboardKpis: EMPTY_DASHBOARD_KPIS,
          enterpriseOverview: EMPTY_ENTERPRISE_OVERVIEW,
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
          categorySales: [],
          staffPerformance: [],
          recentOrders: [],
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

  const revenueOverview = useMemo<RevenueOverview>(() => {
    if (
      !revenueOverviewQuery ||
      typeof revenueOverviewQuery !== "object" ||
      Array.isArray(revenueOverviewQuery)
    ) {
      return EMPTY_REVENUE_OVERVIEW;
    }
    const record = revenueOverviewQuery as Record<string, unknown>;
    const value = (key: string) => {
      const number = Number(record[key] ?? 0);
      return Number.isFinite(number) ? number : 0;
    };
    const rawPoints = Array.isArray(record.points) ? record.points : [];
    const points = Array.from({ length: 7 }, (_, index) => {
      const raw = rawPoints[index];
      const point =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {};
      const currentRevenue = Number(point.currentRevenue ?? 0);
      const previousRevenue = Number(point.previousRevenue ?? 0);
      return {
        currentRevenue: Number.isFinite(currentRevenue) ? currentRevenue : 0,
        previousRevenue: Number.isFinite(previousRevenue)
          ? previousRevenue
          : 0,
      };
    });
    return {
      currentTotal: value("currentTotal"),
      previousTotal: value("previousTotal"),
      points,
    };
  }, [revenueOverviewQuery]);

  const weekDayRevenue = useMemo(() => {
    const raw =
      statsQuery &&
      typeof statsQuery === "object" &&
      !Array.isArray(statsQuery)
        ? (statsQuery as { weekDayRevenue?: unknown }).weekDayRevenue
        : undefined;
    if (!Array.isArray(raw)) return [] as { day: string; revenue: number }[];
    return raw
      .filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === "object",
      )
      .map((row) => {
        const revenue = Number(row.revenue ?? 0);
        return {
          day: String(row.day ?? ""),
          revenue: Number.isFinite(revenue) ? revenue : 0,
        };
      });
  }, [statsQuery]);

  const dashboardKpis = useMemo<DashboardKpis>(() => {
    const raw =
      statsQuery &&
      typeof statsQuery === "object" &&
      !Array.isArray(statsQuery)
        ? (statsQuery as { dashboardKpis?: unknown }).dashboardKpis
        : undefined;
    if (!raw || typeof raw !== "object") {
      return {
        ...EMPTY_DASHBOARD_KPIS,
        totalRevenue: Number(stats.todayRevenue ?? 0),
        totalOrders: Number(stats.todayPaidCount ?? 0),
      };
    }
    const record = raw as Record<string, unknown>;
    const numberValue = (key: string) => {
      const value = Number(record[key] ?? 0);
      return Number.isFinite(value) ? value : 0;
    };
    const seriesRecord =
      record.series && typeof record.series === "object"
        ? (record.series as Record<string, unknown>)
        : {};
    const numberSeries = (key: string) => {
      const value = seriesRecord[key];
      if (!Array.isArray(value)) return EMPTY_KPI_SERIES;
      const normalized = value.map((point) => {
        const number = Number(point ?? 0);
        return Number.isFinite(number) ? number : 0;
      });
      return normalized.length > 0 ? normalized : EMPTY_KPI_SERIES;
    };
    return {
      totalRevenue: numberValue("totalRevenue"),
      previousRevenue: numberValue("previousRevenue"),
      totalOrders: Math.round(numberValue("totalOrders")),
      previousOrders: Math.round(numberValue("previousOrders")),
      barRevenue: numberValue("barRevenue"),
      previousBarRevenue: numberValue("previousBarRevenue"),
      kitchenRevenue: numberValue("kitchenRevenue"),
      previousKitchenRevenue: numberValue("previousKitchenRevenue"),
      series: {
        revenue: numberSeries("revenue"),
        orders: numberSeries("orders"),
        bar: numberSeries("bar"),
        kitchen: numberSeries("kitchen"),
      },
    };
  }, [statsQuery, stats.todayPaidCount, stats.todayRevenue]);

  const enterpriseOverview = useMemo<EnterpriseOverview>(() => {
    const raw =
      statsQuery &&
      typeof statsQuery === "object" &&
      !Array.isArray(statsQuery)
        ? (statsQuery as { enterpriseOverview?: unknown }).enterpriseOverview
        : undefined;
    if (!raw || typeof raw !== "object") return EMPTY_ENTERPRISE_OVERVIEW;
    const root = raw as Record<string, unknown>;
    const objectValue = (key: string) =>
      root[key] && typeof root[key] === "object"
        ? (root[key] as Record<string, unknown>)
        : {};
    const live = objectValue("liveOperations");
    const targetPulse = objectValue("targetPulse");
    const profit = objectValue("profitability");
    const performance = objectValue("performance");
    const paymentMix = objectValue("paymentMix");
    const alerts = objectValue("smartAlerts");
    const numberValue = (source: Record<string, unknown>, key: string) => {
      const value = Number(source[key] ?? 0);
      return Number.isFinite(value) ? value : 0;
    };
    const names = (source: Record<string, unknown>, key: string) =>
      Array.isArray(source[key])
        ? (source[key] as unknown[])
            .map((value) => String(value ?? "").trim())
            .filter(Boolean)
            .slice(0, 3)
        : [];
    const inventoryItems = (key: string): InventoryAlertItem[] =>
      Array.isArray(alerts[key])
        ? (alerts[key] as unknown[])
          .filter(
            (item): item is Record<string, unknown> =>
              Boolean(item) && typeof item === "object",
          )
          .slice(0, 3)
          .map((item) => {
            const currentStock = Number(item.currentStock ?? 0);
            const lowStockThreshold = Number(item.lowStockThreshold ?? 0);
            return {
              id: String(item.id ?? ""),
              name: String(item.name ?? ""),
              currentStock: Number.isFinite(currentStock) ? currentStock : 0,
              lowStockThreshold: Number.isFinite(lowStockThreshold)
                ? lowStockThreshold
                : 0,
              stockUnit: String(item.stockUnit ?? "pc"),
              imageUrl: String(item.imageUrl ?? "").trim() || null,
            };
          })
        : [];
    const outOfStockItems = inventoryItems("outOfStockItems");
    const lowStockItems = inventoryItems("lowStockItems");
    const targetPeriod =
      targetPulse.period === "month" ||
      targetPulse.period === "six_months" ||
      targetPulse.period === "custom"
        ? targetPulse.period
        : null;
    const targetStartAt =
      typeof targetPulse.startAt === "string" &&
      Number.isFinite(Date.parse(targetPulse.startAt))
        ? targetPulse.startAt
        : null;
    const targetEndAt =
      typeof targetPulse.endAt === "string" &&
      Number.isFinite(Date.parse(targetPulse.endAt))
        ? targetPulse.endAt
        : null;

    return {
      liveOperations: {
        activeTables: numberValue(live, "activeTables"),
        totalTables: numberValue(live, "totalTables"),
        availableTables: numberValue(live, "availableTables"),
        occupiedTables: numberValue(live, "occupiedTables"),
        reservedTables: numberValue(live, "reservedTables"),
        kitchenOrders: numberValue(live, "kitchenOrders"),
        barOrders: numberValue(live, "barOrders"),
        activeOrders: numberValue(live, "activeOrders"),
        kitchenQueueItems: numberValue(live, "kitchenQueueItems"),
        barQueueItems: numberValue(live, "barQueueItems"),
        readyItems: numberValue(live, "readyItems"),
        delayedItems: numberValue(live, "delayedItems"),
        averageQueueAgeMinutes: numberValue(
          live,
          "averageQueueAgeMinutes",
        ),
      },
      targetPulse: {
        amount: numberValue(targetPulse, "amount"),
        currentRevenue: numberValue(targetPulse, "currentRevenue"),
        startAt: targetStartAt,
        endAt: targetEndAt,
        period: targetPeriod,
      },
      profitability: {
        revenue: numberValue(profit, "revenue"),
        estimatedStockCost: numberValue(profit, "estimatedStockCost"),
        operatingExpenses: numberValue(profit, "operatingExpenses"),
        estimatedProfit: numberValue(profit, "estimatedProfit"),
        marginPercent: numberValue(profit, "marginPercent"),
      },
      performance: {
        averageOrderValue: numberValue(performance, "averageOrderValue"),
        previousAverageOrderValue: numberValue(
          performance,
          "previousAverageOrderValue",
        ),
        averagePreparationMinutes: numberValue(
          performance,
          "averagePreparationMinutes",
        ),
        preparationSampleCount: numberValue(
          performance,
          "preparationSampleCount",
        ),
        tableTurnsPerDay: numberValue(performance, "tableTurnsPerDay"),
        cancellationRatePercent: numberValue(
          performance,
          "cancellationRatePercent",
        ),
        dailySalesTarget: numberValue(performance, "dailySalesTarget"),
        periodSalesTarget: numberValue(performance, "periodSalesTarget"),
      },
      paymentMix: {
        cash: numberValue(paymentMix, "cash"),
        card: numberValue(paymentMix, "card"),
        debt: numberValue(paymentMix, "debt"),
        other: numberValue(paymentMix, "other"),
      },
      smartAlerts: {
        outOfStockCount: numberValue(alerts, "outOfStockCount"),
        outOfStockNames: names(alerts, "outOfStockNames"),
        outOfStockItems,
        lowStockCount: numberValue(alerts, "lowStockCount"),
        lowStockNames: names(alerts, "lowStockNames"),
        lowStockItems,
        delayedItems: numberValue(alerts, "delayedItems"),
        cancelledOrders: numberValue(alerts, "cancelledOrders"),
        voidedItems: numberValue(alerts, "voidedItems"),
      },
    };
  }, [statsQuery]);

  const saveTargetPulse = useCallback(
    async (target: TargetPulseInput) => {
      await updateTargetPulse({
        licenseKey,
        staffId,
        ...target,
      });
    },
    [licenseKey, staffId, updateTargetPulse],
  );

  const loadingStats = statsQuery === undefined || Array.isArray(statsQuery);
  const comparisonLabel = t(
    dashboardRangeFromYmd === dashboardRangeToYmd
      ? "dashboard.kpi_vs_yesterday"
      : "dashboard.kpi_vs_previous_period",
  );
  return (
    <div className={dashCanvas}>
      <div className="space-y-8">
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700/80">
            Vyntex POS
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
            {String(t("dashboard.welcome_back", { name: staffName }))}
          </h1>
          <p className={`mt-1.5 max-w-xl text-sm ${dashMuted}`}>
            {t(
              showStarterLayout
                ? "starter_overview.subtitle"
                : showEnterpriseOverview
                  ? "dashboard.enterprise_subtitle"
                  : "dashboard.overview_subtitle",
            )}
          </p>
        </div>
        <div className="flex max-w-full items-center gap-2 self-start lg:self-auto">
          {showEnterpriseOverview ? (
            <>
              <EnterpriseCustomReports
                licenseKey={licenseKey}
                staffId={staffId}
                staffRole={staffRole}
                venueFallbackName="Vyntex POS"
                fromYmd={dashboardRangeFromYmd}
                toYmd={dashboardRangeToYmd}
                language={language}
                formatPrice={formatPrice}
                loading={loadingStats}
                kpis={{
                  totalRevenue: dashboardKpis.totalRevenue,
                  barRevenue: dashboardKpis.barRevenue,
                  kitchenRevenue: dashboardKpis.kitchenRevenue,
                  totalOrders: dashboardKpis.totalOrders,
                }}
                products={(stats.topItems ?? []) as TopItemRow[]}
                categories={(stats.categorySales ?? []) as CategorySalesRow[]}
                staff={(stats.staffPerformance ?? []) as StaffPerformanceRow[]}
                payments={enterpriseOverview.paymentMix}
                fiscal={{
                  fiscalCount: Number(stats.fiscalSummary.fiscalCount) || 0,
                  fiscalTotal: stats.fiscalSummary.fiscalTotal,
                  nonFiscalCount: Number(stats.fiscalSummary.nonFiscalCount) || 0,
                  nonFiscalTotal: stats.fiscalSummary.nonFiscalTotal,
                }}
                orders={((stats.recentOrders ?? []) as RecentOrderRow[]).map(
                  (order) => ({
                    orderNumber: order.orderNumber,
                    tableName: order.tableName,
                    staffName: order.staffName,
                    status: order.status,
                    total: order.total,
                  }),
                )}
                t={t}
              />
              <StockNotificationsPopover
                alerts={enterpriseOverview.smartAlerts}
                loading={loadingStats}
                onOpenStock={onOpenStock}
                t={t}
              />
            </>
          ) : null}
          <DashboardRangeCalendar
            fromYmd={dashboardRangeFromYmd}
            toYmd={dashboardRangeToYmd}
            onRangeYmd={setDashboardRangeYmd}
            language={language}
            t={t}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-stretch">
        <PremiumMetricCard
          title={t("dashboard.exec_kpi_total_revenue")}
          icon={Coins}
          value={formatPrice(dashboardKpis.totalRevenue)}
          trend={growthPercent(
            dashboardKpis.totalRevenue,
            dashboardKpis.previousRevenue,
          )}
          meta={comparisonLabel}
          series={dashboardKpis.series.revenue}
          tone="revenue"
          loading={loadingStats}
        />
        <PremiumMetricCard
          title={t("dashboard.kpi_bar_sales")}
          icon={Wine}
          value={formatPrice(dashboardKpis.barRevenue)}
          trend={growthPercent(
            dashboardKpis.barRevenue,
            dashboardKpis.previousBarRevenue,
          )}
          meta={comparisonLabel}
          series={dashboardKpis.series.bar}
          tone="bar"
          loading={loadingStats}
        />
        <PremiumMetricCard
          title={t("dashboard.kpi_kitchen_sales")}
          icon={ChefHat}
          value={formatPrice(dashboardKpis.kitchenRevenue)}
          trend={growthPercent(
            dashboardKpis.kitchenRevenue,
            dashboardKpis.previousKitchenRevenue,
          )}
          meta={comparisonLabel}
          series={dashboardKpis.series.kitchen}
          tone="kitchen"
          loading={loadingStats}
        />
        <PremiumMetricCard
          title={t("dashboard.kpi_total_orders")}
          icon={ShoppingCart}
          value={String(dashboardKpis.totalOrders)}
          trend={growthPercent(
            dashboardKpis.totalOrders,
            dashboardKpis.previousOrders,
          )}
          meta={comparisonLabel}
          series={dashboardKpis.series.orders}
          tone="orders"
          loading={loadingStats}
        />
      </div>

      {showEnterpriseOverview ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4 xl:items-start">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-3">
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:items-stretch">
              {loadingStats ? (
                <>
                  <div className="h-[310px] animate-pulse rounded-[1.5rem] border border-white bg-white/70 shadow-sm" />
                  <div className="h-[310px] animate-pulse rounded-[1.5rem] border border-white bg-white/70 shadow-sm" />
                </>
              ) : (
                <>
                  <RevenueOverviewCard
                    data={revenueOverview}
                    loading={revenueOverviewQuery === undefined}
                    period={revenuePeriod}
                    onPeriodChange={setRevenuePeriod}
                    formatPrice={formatPrice}
                    language={language}
                    panelClassName="relative h-full overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_2px_5px_rgba(15,23,42,0.03),0_18px_42px_-28px_rgba(15,23,42,0.3)]"
                    t={t}
                  />
                  <EnterpriseSalesBreakdownSection
                    categorySales={(stats.categorySales ?? []) as CategorySalesRow[]}
                    topItems={(stats.topItems ?? []) as TopItemRow[]}
                    formatPrice={formatPrice}
                    loading={loadingStats}
                    onViewDetails={onOpenSalesDetail}
                    show="category"
                    t={t}
                  />
                </>
              )}
            </section>
            <EnterpriseSalesBreakdownSection
              categorySales={(stats.categorySales ?? []) as CategorySalesRow[]}
              topItems={(stats.topItems ?? []) as TopItemRow[]}
              formatPrice={formatPrice}
              loading={loadingStats}
              onViewDetails={onOpenSalesDetail}
              show="products"
              t={t}
            />
            <EnterpriseStaffOrdersSection
              staffPerformance={
                (stats.staffPerformance ?? []) as StaffPerformanceRow[]
              }
              recentOrders={(stats.recentOrders ?? []) as RecentOrderRow[]}
              formatPrice={formatPrice}
              language={language}
              loading={loadingStats}
              onViewOrders={onOpenSalesDetail}
              t={t}
            />
            <InventoryAlertsBanner
              alerts={enterpriseOverview.smartAlerts}
              loading={loadingStats}
              onOpenStock={onOpenStock}
              t={t}
            />
            <SystemStatusPanel
              licenseKey={licenseKey}
              onOpenSettings={onOpenSettings}
            />
          </div>
          <aside className="order-first flex min-w-0 flex-col gap-3 xl:order-none xl:col-span-1">
            <EnterpriseLiveRail
              data={enterpriseOverview.liveOperations}
              loading={loadingStats}
              t={t}
            />
            <EnterpriseTargetPulseRail
              data={enterpriseOverview.targetPulse}
              canEdit={staffRole === "admin"}
              formatPrice={formatPrice}
              language={language}
              loading={loadingStats}
              onSave={saveTargetPulse}
              t={t}
            />
            <EnterprisePaymentMixRail
              data={enterpriseOverview.paymentMix}
              formatPrice={formatPrice}
              loading={loadingStats}
              t={t}
            />
            <EnterpriseDemandRail
              heatmap={
                (stats.visitorHeatmap as VisitorHeatmap | undefined) ?? {
                  dayLabels: [],
                  matrix24: [],
                }
              }
              weekDayRevenue={weekDayRevenue}
              formatPrice={formatPrice}
              loading={loadingStats}
              t={t}
            />
            <EnterpriseFiscalRail
              fiscalCount={Number(stats.fiscalSummary.fiscalCount) || 0}
              fiscalTotal={stats.fiscalSummary.fiscalTotal}
              nonFiscalCount={Number(stats.fiscalSummary.nonFiscalCount) || 0}
              nonFiscalTotal={stats.fiscalSummary.nonFiscalTotal}
              formatPrice={formatPrice}
              licenseKey={licenseKey}
              loading={loadingStats}
              staffId={staffId}
              staffName={staffName}
              staffRole={staffRole}
              t={t}
            />
          </aside>
        </div>
      ) : null}

      {!showEnterpriseOverview ? (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        {showStarterLayout ? (
          <div className="flex flex-col gap-4 lg:col-span-2">
            <StarterDashboardDetailColumn
              stats={stats}
              zReportToday={zReportToday}
              formatPrice={formatPrice}
              t={t}
              loading={loadingStats}
            />
          </div>
        ) : null}

        <div
          className={`flex flex-col gap-3 ${
            showStarterLayout ? "" : "lg:col-span-3"
          }`}
        >
          {!showStarterLayout ? (
            <>
              <DashboardInsights
                topItems={stats.topItems}
                t={t}
                formatPrice={formatPrice}
                loading={loadingStats}
              />
              <DemandFlowCard
                heatmap={(stats.visitorHeatmap as VisitorHeatmap | undefined) ?? { dayLabels: [], matrix24: [] }}
                weekDayRevenue={weekDayRevenue}
                formatPrice={formatPrice}
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
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700 ring-1 ring-teal-600/10">
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
              <FiscalSystemSection
                formatPrice={formatPrice}
                fiscalTotal={stats.fiscalSummary.fiscalTotal}
                nonFiscalTotal={stats.fiscalSummary.nonFiscalTotal}
                licenseKey={licenseKey}
                staffId={staffId}
                staffName={staffName}
                staffRole={staffRole}
                collapsible
              />
            </>
          ) : (
            <>
              <FiscalSystemSection
                formatPrice={formatPrice}
                fiscalTotal={stats.fiscalSummary.fiscalTotal}
                nonFiscalTotal={stats.fiscalSummary.nonFiscalTotal}
                licenseKey={licenseKey}
                staffId={staffId}
                staffName={staffName}
                staffRole={staffRole}
              />
              <StarterDashboardStaffColumn zReportToday={zReportToday} stats={stats} formatPrice={formatPrice} />
            </>
          )}
        </div>
      </div>
      ) : null}
      </div>
    </div>
  );
}

function EnterpriseLiveRail({
  data,
  loading,
  t,
}: {
  data: EnterpriseOverview["liveOperations"];
  loading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (loading) {
    return (
      <div className="h-[312px] animate-pulse rounded-[1.4rem] border border-white bg-white/70 shadow-sm" />
    );
  }

  const totalTables = Math.max(0, Math.round(data.totalTables));
  const tableRows = [
    {
      id: "available",
      label: t("dashboard.enterprise_table_available"),
      value: data.availableTables,
      valueClass: "text-emerald-700",
      dotClass: "bg-emerald-500",
      segmentClass: "bg-emerald-500",
    },
    {
      id: "occupied",
      label: t("dashboard.enterprise_table_occupied"),
      value: data.occupiedTables,
      valueClass: "text-rose-700",
      dotClass: "bg-rose-500",
      segmentClass: "bg-rose-500",
    },
    {
      id: "reserved",
      label: t("dashboard.enterprise_table_reserved"),
      value: data.reservedTables,
      valueClass: "text-amber-700",
      dotClass: "bg-amber-500",
      segmentClass: "bg-amber-500",
    },
  ];
  const stationRows = [
    {
      id: "kitchen",
      label: t("dashboard.enterprise_kitchen_queue"),
      value: data.kitchenOrders,
      valueClass: "text-orange-700",
      surfaceClass:
        "border-orange-100/90 bg-[linear-gradient(100deg,rgba(255,247,237,0.95),rgba(255,255,255,0.9))]",
      iconClass: "bg-white text-orange-600 ring-orange-600/10",
      icon: ChefHat,
    },
    {
      id: "bar",
      label: t("dashboard.enterprise_bar_queue"),
      value: data.barOrders,
      valueClass: "text-cyan-700",
      surfaceClass:
        "border-cyan-100/90 bg-[linear-gradient(100deg,rgba(236,254,255,0.95),rgba(255,255,255,0.9))]",
      iconClass: "bg-white text-cyan-600 ring-cyan-600/10",
      icon: Wine,
    },
  ];

  return (
    <article className="relative isolate overflow-hidden rounded-[1.4rem] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(249,252,254,0.97)_58%,rgba(239,250,250,0.94)_100%)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_-24px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/70">
      <span
        className="pointer-events-none absolute -right-12 -top-14 -z-10 size-36 rounded-full bg-cyan-100/70 blur-3xl"
        aria-hidden
      />
      <span
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white bg-white/90 text-cyan-700 shadow-[0_7px_18px_-10px_rgba(8,145,178,0.8)] ring-1 ring-cyan-600/10">
            <Activity className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-slate-950">
              {t("dashboard.enterprise_live_title")}
            </h2>
            <p className="truncate text-[9px] text-slate-400">
              {t("dashboard.enterprise_live_subtitle")}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-100 bg-white/85 px-2 py-1 text-[8px] font-bold tracking-[0.12em] text-emerald-700 shadow-sm">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          {t("dashboard.enterprise_live_badge")}
        </span>
      </div>

      <div className="relative mt-3 rounded-2xl border border-slate-200/70 bg-white/75 px-2.5 py-2.5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {t("dashboard.enterprise_live_tables")}
          </p>
          <p className="rounded-full bg-slate-100/80 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-slate-500">
            {t("dashboard.enterprise_live_tables_total", {
              count: totalTables,
            })}
          </p>
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-900/5">
          {tableRows.map((row) => {
            const share =
              totalTables > 0
                ? (Math.max(0, row.value) / totalTables) * 100
                : 0;
            return share > 0 ? (
              <span
                key={row.id}
                className={`${row.segmentClass} border-r border-white/70 last:border-r-0`}
                style={{ width: `${share}%` }}
              />
            ) : null;
          })}
        </div>
        <ul className="mt-1 divide-y divide-slate-100/90">
          {tableRows.map((row) => {
            const share =
              totalTables > 0
                ? (Math.max(0, row.value) / totalTables) * 100
                : 0;
            return (
              <li
                key={row.id}
                className="group flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-white/90"
              >
                <span className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-slate-600">
                  <span className="flex size-3 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                    <span
                      className={`size-1.5 rounded-full ${row.dotClass}`}
                    />
                  </span>
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[9px] font-medium tabular-nums text-slate-400">
                    {share.toFixed(0)}%
                  </span>
                  <span
                    className={`min-w-5 text-right text-[13px] font-extrabold tabular-nums ${row.valueClass}`}
                  >
                    {Math.round(row.value)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="relative mb-1.5 mt-3 px-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {t("dashboard.enterprise_live_stations")}
      </p>
      <ul className="relative space-y-1.5">
        {stationRows.map((row) => (
          <li
            key={row.id}
            className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 shadow-[0_7px_20px_-18px_rgba(15,23,42,0.55)] ${row.surfaceClass}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ${row.iconClass}`}
              >
                <row.icon className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-slate-700">
                  {row.label}
                </span>
                <span className="block text-[8px] text-slate-400">
                  {t("dashboard.enterprise_live_orders_made")}
                </span>
              </span>
            </span>
            <span
              className={`rounded-lg bg-white/80 px-2 py-1 text-[14px] font-extrabold tabular-nums shadow-sm ring-1 ring-slate-900/5 ${row.valueClass}`}
            >
              {Math.round(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function addLocalMonthsClamped(date: Date, months: number): Date {
  const targetMonth = date.getMonth() + months;
  const firstOfTargetMonth = new Date(date.getFullYear(), targetMonth, 1);
  const lastDay = new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth() + 1,
    0,
  ).getDate();
  return new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth(),
    Math.min(date.getDate(), lastDay),
  );
}

function parseLocalYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return formatLocalYmd(date) === value ? date : null;
}

function targetPeriodEndAt(
  period: TargetPulsePeriod,
  startDate: Date,
  customEndYmd: string,
): string | null {
  if (period === "month") {
    return new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      1,
    ).toISOString();
  }
  if (period === "six_months") {
    return addLocalMonthsClamped(startDate, 6).toISOString();
  }
  const customEnd = parseLocalYmd(customEndYmd);
  if (!customEnd) return null;
  customEnd.setDate(customEnd.getDate() + 1);
  return customEnd.toISOString();
}

function targetEndYmd(endAt: string | null): string {
  if (!endAt) return "";
  const endMs = Date.parse(endAt);
  if (!Number.isFinite(endMs)) return "";
  return formatLocalYmd(new Date(endMs - 1));
}

function EnterpriseTargetPulseRail({
  data,
  canEdit,
  formatPrice,
  language,
  loading,
  onSave,
  t,
}: {
  data: EnterpriseOverview["targetPulse"];
  canEdit: boolean;
  formatPrice: (value: number) => string;
  language: "en" | "sq";
  loading: boolean;
  onSave: (target: TargetPulseInput) => Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [period, setPeriod] = useState<TargetPulsePeriod>("month");
  const [customEndYmd, setCustomEndYmd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return (
      <div className="h-[248px] animate-pulse rounded-[1.4rem] border border-white bg-white/70 shadow-sm" />
    );
  }

  const startMs = Date.parse(data.startAt ?? "");
  const endMs = Date.parse(data.endAt ?? "");
  const hasTarget =
    data.amount > 0 &&
    Number.isFinite(startMs) &&
    Number.isFinite(endMs) &&
    endMs > startMs &&
    data.period !== null;
  const rawProgress =
    hasTarget && data.amount > 0
      ? Math.max(0, (data.currentRevenue / data.amount) * 100)
      : 0;
  const ringProgress = Math.min(100, rawProgress);
  const achieved = hasTarget && data.currentRevenue >= data.amount;
  const expired = hasTarget && Date.now() >= endMs;
  const daysRemaining =
    hasTarget && !expired
      ? Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000))
      : 0;
  const localeTag = language === "sq" ? "sq-AL" : "en-GB";
  const formatTargetDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(localeTag, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const todayYmd = formatLocalYmd(todayStart);
  const preservesExistingStart =
    hasTarget && endMs > Date.now() && period === data.period;

  const openEditor = () => {
    const existingStillOpen = hasTarget && endMs > Date.now();
    const initialStart = existingStillOpen
      ? new Date(startMs)
      : todayStart;
    setAmountInput(hasTarget ? String(data.amount) : "");
    setPeriod(data.period ?? "month");
    setCustomEndYmd(
      hasTarget
        ? targetEndYmd(data.endAt)
        : formatLocalYmd(addLocalMonthsClamped(initialStart, 1)),
    );
    setError("");
    setEditing(true);
  };

  const saveTarget = async () => {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t("dashboard.target_pulse_invalid_amount"));
      return;
    }
    const startDate = preservesExistingStart
      ? new Date(startMs)
      : todayStart;
    const endAt = targetPeriodEndAt(period, startDate, customEndYmd);
    if (!endAt || Date.parse(endAt) <= Math.max(startDate.getTime(), Date.now())) {
      setError(t("dashboard.target_pulse_invalid_date"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        amount,
        startAt: startDate.toISOString(),
        endAt,
        period,
      });
      setEditing(false);
    } catch {
      setError(t("dashboard.target_pulse_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const cardClass =
    "relative isolate overflow-hidden rounded-[1.4rem] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(251,249,255,0.97)_58%,rgba(245,243,255,0.94)_100%)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_-24px_rgba(76,29,149,0.28)] ring-1 ring-slate-200/70";

  return (
    <article className={cardClass}>
      <span
        className="pointer-events-none absolute -right-12 -top-14 -z-10 size-36 rounded-full bg-violet-100/80 blur-3xl"
        aria-hidden
      />
      <span
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white bg-white/90 text-violet-700 shadow-[0_7px_18px_-10px_rgba(124,58,237,0.75)] ring-1 ring-violet-600/10">
            <Target className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-slate-950">
              {t("dashboard.target_pulse_title")}
            </h2>
            <p className="truncate text-[9px] text-slate-400">
              {t("dashboard.target_pulse_subtitle")}
            </p>
          </div>
        </div>
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={openEditor}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-violet-100 bg-white/85 text-violet-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50"
            aria-label={
              hasTarget
                ? t("dashboard.enterprise_target_edit")
                : t("dashboard.enterprise_target_set")
            }
          >
            <Pencil className="size-3" />
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="relative mt-3 space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {t("dashboard.target_pulse_amount")}
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder="0.00"
              className="h-9 w-full rounded-xl border border-violet-100 bg-white/90 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
              autoFocus
            />
          </label>

          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
              {t("dashboard.target_pulse_period")}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ["month", "dashboard.target_pulse_this_month"],
                  ["six_months", "dashboard.target_pulse_six_months"],
                  ["custom", "dashboard.target_pulse_until_date"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`min-h-8 rounded-lg border px-1 text-[8px] font-semibold leading-tight transition ${
                    period === value
                      ? "border-violet-300 bg-violet-600 text-white shadow-sm"
                      : "border-slate-200 bg-white/80 text-slate-500 hover:border-violet-200"
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>

          {period === "custom" ? (
            <label className="block">
              <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {t("dashboard.target_pulse_end_date")}
              </span>
              <input
                type="date"
                min={todayYmd}
                value={customEndYmd}
                onChange={(event) => setCustomEndYmd(event.target.value)}
                className="h-9 w-full rounded-xl border border-violet-100 bg-white/90 px-3 text-[11px] font-semibold text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
              />
            </label>
          ) : null}

          <p className="text-[8px] leading-relaxed text-slate-400">
            {t(
              preservesExistingStart
                ? "dashboard.target_pulse_keeps_start"
                : "dashboard.target_pulse_starts_today",
            )}
          </p>
          {error ? (
            <p className="rounded-lg bg-rose-50 px-2 py-1.5 text-[9px] font-medium text-rose-600">
              {error}
            </p>
          ) : null}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => void saveTarget()}
              disabled={saving}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 text-[10px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(124,58,237,0.9)] transition hover:bg-violet-700 disabled:opacity-50"
            >
              <Check className="size-3.5" />
              {t("dashboard.enterprise_target_save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
              disabled={saving}
              className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-50"
              aria-label={t("dashboard.enterprise_target_cancel")}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : hasTarget ? (
        <>
          <div className="relative mt-3 flex items-center gap-3 rounded-2xl border border-violet-100/90 bg-[linear-gradient(110deg,rgba(245,243,255,0.94),rgba(255,255,255,0.96))] p-3 shadow-[0_10px_28px_-24px_rgba(124,58,237,0.7)]">
            <div
              className="grid size-[72px] shrink-0 place-items-center rounded-full shadow-[0_10px_24px_-15px_rgba(124,58,237,0.8)]"
              style={{
                background: `conic-gradient(#7c3aed ${ringProgress}%, #ede9fe ${ringProgress}% 100%)`,
              }}
            >
              <div className="grid size-[57px] place-items-center rounded-full border border-white bg-white shadow-inner">
                <div className="text-center">
                  <p className="text-base font-extrabold tracking-[-0.04em] text-violet-700 tabular-nums">
                    {rawProgress.toFixed(0)}%
                  </p>
                  <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    {t("dashboard.target_pulse_complete")}
                  </p>
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-violet-700/60">
                {t("dashboard.target_pulse_collected")}
              </p>
              <p className="mt-1 truncate text-[15px] font-extrabold tracking-[-0.02em] text-slate-950 tabular-nums">
                {formatPrice(data.currentRevenue)}
              </p>
              <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400 tabular-nums">
                / {formatPrice(data.amount)}
              </p>
              <span
                className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold ${
                  achieved
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10"
                    : expired
                      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-600/10"
                      : "bg-violet-50 text-violet-700 ring-1 ring-violet-600/10"
                }`}
              >
                {achieved
                  ? t("dashboard.target_pulse_achieved")
                  : expired
                    ? t("dashboard.target_pulse_expired")
                    : t("dashboard.target_pulse_days_left", {
                        count: daysRemaining,
                      })}
              </span>
            </div>
          </div>
          <div className="relative mt-2 flex items-center gap-2 rounded-xl border border-slate-100 bg-white/70 px-2.5 py-2 text-[9px] text-slate-500">
            <CalendarDays className="size-3 shrink-0 text-violet-500" />
            <span className="truncate">
              {formatTargetDate(startMs)} — {formatTargetDate(endMs - 1)}
            </span>
          </div>
        </>
      ) : (
        <div className="relative mt-3 rounded-2xl border border-dashed border-violet-200 bg-violet-50/45 px-3 py-4 text-center">
          <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-white text-violet-500 shadow-sm ring-1 ring-violet-600/10">
            <Target className="size-4" />
          </span>
          <p className="mt-2 text-[11px] font-bold text-slate-700">
            {t("dashboard.target_pulse_empty")}
          </p>
          <p className="mt-0.5 text-[9px] leading-relaxed text-slate-400">
            {canEdit
              ? t("dashboard.target_pulse_empty_hint")
              : t("dashboard.target_pulse_admin_only")}
          </p>
          {canEdit ? (
            <button
              type="button"
              onClick={openEditor}
              className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 text-[9px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(124,58,237,0.9)] transition hover:bg-violet-700"
            >
              <Target className="size-3" />
              {t("dashboard.enterprise_target_set")}
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}

function EnterprisePaymentMixRail({
  data,
  formatPrice,
  loading,
  t,
}: {
  data: EnterpriseOverview["paymentMix"];
  formatPrice: (value: number) => string;
  loading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (loading) {
    return (
      <div className="h-[268px] animate-pulse rounded-[1.4rem] border border-white bg-white/70 shadow-sm" />
    );
  }

  const rows = [
    {
      id: "cash",
      label: t("dashboard.enterprise_payment_cash"),
      value: data.cash,
      Icon: Banknote,
      valueClass: "text-emerald-700",
      iconClass: "text-emerald-600",
      ringColor: "#10b981",
      trackColor: "#d1fae5",
      surfaceClass: "border-emerald-100/80 from-emerald-50/75",
    },
    {
      id: "card",
      label: t("dashboard.enterprise_payment_card"),
      value: data.card,
      Icon: CreditCard,
      valueClass: "text-sky-700",
      iconClass: "text-sky-600",
      ringColor: "#0ea5e9",
      trackColor: "#e0f2fe",
      surfaceClass: "border-sky-100/80 from-sky-50/75",
    },
    {
      id: "debt",
      label: t("dashboard.enterprise_payment_debt"),
      value: data.debt,
      Icon: ReceiptText,
      valueClass: "text-amber-700",
      iconClass: "text-amber-600",
      ringColor: "#f59e0b",
      trackColor: "#fef3c7",
      surfaceClass: "border-amber-100/80 from-amber-50/75",
    },
  ];
  const paymentTotal = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <article className="relative isolate overflow-hidden rounded-[1.4rem] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(249,252,255,0.97)_58%,rgba(240,247,255,0.94)_100%)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_-24px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/70">
      <span
        className="pointer-events-none absolute -right-12 -top-14 -z-10 size-36 rounded-full bg-sky-100/80 blur-3xl"
        aria-hidden
      />
      <span
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent"
        aria-hidden
      />

      <div className="relative flex items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white bg-white/90 text-sky-700 shadow-[0_7px_18px_-10px_rgba(2,132,199,0.75)] ring-1 ring-sky-600/10">
            <Wallet className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-slate-950">
              {t("dashboard.enterprise_payment_mix_title")}
            </h2>
            <p className="truncate text-[9px] text-slate-400">
              {t("dashboard.enterprise_payment_mix_subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-3 rounded-2xl border border-sky-100/80 bg-[linear-gradient(110deg,rgba(240,249,255,0.92),rgba(255,255,255,0.94))] px-3 py-2.5 shadow-[0_10px_28px_-24px_rgba(2,132,199,0.65)]">
        <div className="flex items-end justify-between gap-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-700/60">
            {t("dashboard.exec_kpi_total_revenue")}
          </p>
          <p className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-slate-950 tabular-nums">
            {formatPrice(paymentTotal)}
          </p>
        </div>
      </div>

      <ul className="relative mt-2 grid grid-cols-3 gap-1.5">
        {rows.map((row) => {
          const share = Math.min(
            100,
            Math.max(
              0,
              paymentTotal > 0 ? (row.value / paymentTotal) * 100 : 0,
            ),
          );
          return (
            <li
              key={row.id}
              className={`min-w-0 rounded-xl border bg-gradient-to-b to-white/90 px-1.5 py-2 text-center shadow-[0_8px_22px_-20px_rgba(15,23,42,0.5)] transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_24px_-18px_rgba(15,23,42,0.35)] ${row.surfaceClass}`}
            >
              <span
                className="mx-auto grid size-12 place-items-center rounded-full shadow-[0_7px_18px_-12px_rgba(15,23,42,0.6)]"
                style={{
                  background: `conic-gradient(${row.ringColor} ${share}%, ${row.trackColor} ${share}% 100%)`,
                }}
                role="img"
                aria-label={`${row.label}: ${share.toFixed(0)}%`}
              >
                <span className="grid size-[36px] place-items-center rounded-full border border-white bg-white shadow-inner">
                  <row.Icon className={`size-4 ${row.iconClass}`} />
                </span>
              </span>
              <span className="mt-1.5 block truncate text-[9px] font-semibold text-slate-600">
                {row.label}
              </span>
              <span className={`mt-0.5 block text-[11px] font-extrabold tabular-nums ${row.valueClass}`}>
                {share.toFixed(0)}%
              </span>
              <span
                className="mt-0.5 block truncate text-[8px] font-semibold tracking-[-0.01em] text-slate-500 tabular-nums"
                title={formatPrice(row.value)}
              >
                {formatPrice(row.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function EnterpriseDemandRail({
  heatmap,
  weekDayRevenue,
  formatPrice,
  loading,
  t,
}: {
  heatmap: VisitorHeatmap;
  weekDayRevenue: { day: string; revenue: number }[];
  formatPrice: (value: number) => string;
  loading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [view, setView] = useState<"days" | "hours">("hours");
  const dayCount = Math.min(heatmap.dayLabels.length, heatmap.matrix24.length);
  const [dayIdx, setDayIdx] = useState(6);

  useEffect(() => {
    const n = Math.min(heatmap.dayLabels.length, heatmap.matrix24.length);
    if (n <= 0) return;
    setDayIdx((current) => Math.min(Math.max(0, current), n - 1));
  }, [heatmap.dayLabels, heatmap.matrix24]);

  const safeIdx = dayCount > 0 ? Math.min(dayIdx, dayCount - 1) : 0;
  const rowPadded = useMemo(() => {
    const row = Array.isArray(heatmap.matrix24[safeIdx])
      ? [...heatmap.matrix24[safeIdx]]
      : [];
    while (row.length < 24) row.push(0);
    return row.slice(0, 24).map((count) => Number(count) || 0);
  }, [heatmap.matrix24, safeIdx]);

  const hourPeak = useMemo(() => {
    let max = 0;
    let hour = 0;
    rowPadded.forEach((count, index) => {
      if (count > max) {
        max = count;
        hour = index;
      }
    });
    return max > 0 ? { hour, count: max } : null;
  }, [rowPadded]);

  const dailyPeakIndex = useMemo(() => {
    let best = -1;
    let max = 0;
    weekDayRevenue.forEach((row, index) => {
      if (row.revenue > max) {
        max = row.revenue;
        best = index;
      }
    });
    return best;
  }, [weekDayRevenue]);
  const dailyPeak =
    dailyPeakIndex >= 0 ? weekDayRevenue[dailyPeakIndex] : null;
  const dailyEmpty =
    !loading &&
    (weekDayRevenue.length === 0 ||
      !weekDayRevenue.some((row) => row.revenue > 0));
  const hoursEmpty = !loading && !rowPadded.some((count) => count > 0);

  if (loading) {
    return (
      <div className="h-[248px] animate-pulse rounded-[1.4rem] border border-white bg-white/70 shadow-sm" />
    );
  }

  return (
    <article className="relative isolate overflow-hidden rounded-[1.4rem] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(240,253,250,0.97)_58%,rgba(236,253,245,0.94)_100%)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_-24px_rgba(13,148,136,0.28)] ring-1 ring-slate-200/70">
      <span
        className="pointer-events-none absolute -right-12 -top-14 -z-10 size-36 rounded-full bg-teal-100/80 blur-3xl"
        aria-hidden
      />
      <span
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/70 to-transparent"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white bg-white/90 text-teal-700 shadow-[0_7px_18px_-10px_rgba(13,148,136,0.8)] ring-1 ring-teal-600/10">
            <Clock className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-slate-950">
              {t("dashboard.popular_times_title")}
            </h2>
            <p className="truncate text-[9px] text-slate-400">
              {t("dashboard.popular_times_sub")}
            </p>
          </div>
        </div>
        <div className="inline-flex shrink-0 rounded-lg border border-teal-100 bg-white/85 p-0.5 shadow-sm">
          {(["days", "hours"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={`rounded-md px-1.5 py-1 text-[8px] font-bold transition ${
                view === option
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-teal-700"
              }`}
            >
              {t(
                option === "days"
                  ? "dashboard.demand_view_days"
                  : "dashboard.demand_view_hours",
              )}
            </button>
          ))}
        </div>
      </div>

      {view === "hours" && dayCount > 0 ? (
        <div className="relative mt-3 flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {heatmap.dayLabels.slice(0, dayCount).map((label, index) => (
            <button
              key={`${label}-${index}`}
              type="button"
              onClick={() => setDayIdx(index)}
              className={`h-6 shrink-0 rounded-full px-2 text-[8px] font-bold transition ${
                index === safeIdx
                  ? "bg-teal-600 text-white shadow-[0_4px_12px_-4px_rgba(13,148,136,0.55)]"
                  : "border border-slate-200 bg-white/85 text-slate-500 hover:border-teal-200 hover:text-teal-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {view === "days" ? (
        dailyEmpty ? (
          <p className="relative py-8 text-center text-[10px] font-medium text-slate-400">
            {t("dashboard.week_activity_empty")}
          </p>
        ) : (
          <div className="relative mt-3 rounded-2xl border border-teal-100/80 bg-[linear-gradient(110deg,rgba(240,253,250,0.92),rgba(255,255,255,0.96))] px-2.5 py-2.5 shadow-[0_10px_28px_-24px_rgba(13,148,136,0.65)]">
            <div className="flex h-[92px] items-end gap-1">
              {weekDayRevenue.map((row, index) => {
                const peak = dailyPeak?.revenue || 1;
                const height = Math.max(8, (row.revenue / peak) * 100);
                const isPeak = index === dailyPeakIndex;
                return (
                  <div
                    key={`${row.day}-${index}`}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    title={`${row.day}: ${formatPrice(row.revenue)}`}
                  >
                    <span
                      className={`w-full max-w-6 rounded-t-md ${
                        isPeak
                          ? "bg-teal-600 shadow-[0_6px_12px_-6px_rgba(13,148,136,0.8)]"
                          : "bg-teal-200/90"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="truncate text-[8px] font-semibold text-slate-400">
                      {row.day.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : hoursEmpty || dayCount === 0 ? (
        <p className="relative py-8 text-center text-[10px] font-medium text-slate-400">
          {t("dashboard.popular_times_empty")}
        </p>
      ) : (
        <div className="relative mt-3 rounded-2xl border border-teal-100/80 bg-[linear-gradient(110deg,rgba(240,253,250,0.92),rgba(255,255,255,0.96))] px-2.5 py-2.5 shadow-[0_10px_28px_-24px_rgba(13,148,136,0.65)]">
          <div className="flex h-[92px] items-end gap-px">
            {rowPadded.map((count, hour) => {
              const peak = hourPeak?.count || 1;
              const height = Math.max(6, (count / peak) * 100);
              const isPeak = hourPeak?.hour === hour;
              return (
                <span
                  key={`hour-${hour}`}
                  className={`min-w-0 flex-1 rounded-t-[3px] ${
                    isPeak ? "bg-teal-600" : "bg-teal-300/85"
                  }`}
                  style={{ height: `${count > 0 ? height : 6}%` }}
                  title={`${formatHourSnapchat(hour)} · ${t(
                    popularTimesBusyLevelKey(count, peak),
                  )}`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[7px] font-semibold text-slate-300">
            <span>12a</span>
            <span>6a</span>
            <span>12p</span>
            <span>6p</span>
            <span>11p</span>
          </div>
        </div>
      )}

      {view === "hours" && hourPeak ? (
        <p className="relative mt-2 truncate text-center text-[9px] font-semibold text-teal-700">
          {t("dashboard.popular_times_peak", {
            hour: formatHourSnapchat(hourPeak.hour),
            level: t(popularTimesBusyLevelKey(hourPeak.count, hourPeak.count)),
          })}
        </p>
      ) : view === "days" && dailyPeak ? (
        <p className="relative mt-2 truncate text-center text-[9px] font-semibold text-teal-700">
          {t("dashboard.week_activity_peak", {
            day: dailyPeak.day,
            amount: formatPrice(dailyPeak.revenue),
          })}
        </p>
      ) : null}
    </article>
  );
}

function EnterpriseFiscalRail({
  fiscalCount,
  fiscalTotal,
  nonFiscalCount,
  nonFiscalTotal,
  formatPrice,
  licenseKey,
  loading,
  staffId,
  staffName,
  staffRole,
  t,
}: {
  fiscalCount: number;
  fiscalTotal: number;
  nonFiscalCount: number;
  nonFiscalTotal: number;
  formatPrice: (value: number) => string;
  licenseKey: string;
  loading: boolean;
  staffId: string;
  staffName: string;
  staffRole: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (loading) {
    return (
      <div className="h-[248px] animate-pulse rounded-[1.4rem] border border-white bg-white/70 shadow-sm" />
    );
  }

  const total = Math.max(0, fiscalTotal) + Math.max(0, nonFiscalTotal);
  const fiscalShare = total > 0 ? (fiscalTotal / total) * 100 : 0;
  const nonFiscalShare = total > 0 ? (nonFiscalTotal / total) * 100 : 0;
  const hasData = total > 0;
  const rows = [
    {
      id: "fiscal",
      label: t("dashboard.fiscal_short"),
      value: fiscalTotal,
      count: fiscalCount,
      share: fiscalShare,
      valueClass: "text-emerald-700",
      iconClass: "bg-white text-emerald-600 ring-emerald-600/10",
      surfaceClass:
        "border-emerald-100/90 bg-[linear-gradient(100deg,rgba(236,253,245,0.95),rgba(255,255,255,0.9))]",
      Icon: FileCheck,
    },
    {
      id: "nonFiscal",
      label: t("dashboard.non_fiscal_short"),
      value: nonFiscalTotal,
      count: nonFiscalCount,
      share: nonFiscalShare,
      valueClass: "text-amber-700",
      iconClass: "bg-white text-amber-600 ring-amber-600/10",
      surfaceClass:
        "border-amber-100/90 bg-[linear-gradient(100deg,rgba(255,251,235,0.95),rgba(255,255,255,0.9))]",
      Icon: FileWarning,
    },
  ];

  return (
    <article className="relative isolate overflow-hidden rounded-[1.4rem] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(236,253,245,0.97)_58%,rgba(240,253,250,0.94)_100%)] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_-24px_rgba(5,150,105,0.28)] ring-1 ring-slate-200/70">
      <span
        className="pointer-events-none absolute -right-12 -top-14 -z-10 size-36 rounded-full bg-emerald-100/80 blur-3xl"
        aria-hidden
      />
      <span
        className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white bg-white/90 text-emerald-700 shadow-[0_7px_18px_-10px_rgba(5,150,105,0.8)] ring-1 ring-emerald-600/10">
            <FileCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-slate-950">
              {t("dashboard.fiscal_system_title")}
            </h2>
            <p className="truncate text-[9px] text-slate-400">
              {t("dashboard.fiscal_system_subtitle")}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-100 bg-white/85 px-2 py-1 text-[8px] font-bold tracking-[0.12em] text-emerald-700 shadow-sm">
          {t("dashboard.today_badge")}
        </span>
      </div>

      {hasData ? (
        <>
          <div className="relative mt-3 rounded-2xl border border-emerald-100/80 bg-[linear-gradient(110deg,rgba(236,253,245,0.92),rgba(255,255,255,0.96))] px-2.5 py-2.5 shadow-[0_10px_28px_-24px_rgba(5,150,105,0.65)]">
            <div className="flex items-end justify-between gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700/60">
                {t("dashboard.fiscalization_rate")}
              </p>
              <p className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950 tabular-nums">
                {fiscalShare.toFixed(0)}%
              </p>
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-900/5">
              {fiscalShare > 0 ? (
                <span
                  className="bg-emerald-500"
                  style={{ width: `${fiscalShare}%` }}
                />
              ) : null}
              {nonFiscalShare > 0 ? (
                <span
                  className="bg-amber-400"
                  style={{ width: `${nonFiscalShare}%` }}
                />
              ) : null}
            </div>
          </div>

          <ul className="relative mt-2 space-y-1.5">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 shadow-[0_7px_20px_-18px_rgba(15,23,42,0.55)] ${row.surfaceClass}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ${row.iconClass}`}
                  >
                    <row.Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-slate-700">
                      {row.label}
                    </span>
                    <span className="block text-[8px] text-slate-400">
                      {t("dashboard.staff_orders", { count: row.count })}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={`block text-[12px] font-extrabold tabular-nums ${row.valueClass}`}
                  >
                    {formatPrice(row.value)}
                  </span>
                  <span className="block text-[8px] font-semibold tabular-nums text-slate-400">
                    {row.share.toFixed(0)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="relative py-8 text-center text-[10px] font-medium text-slate-400">
          {t("dashboard.fiscal_empty")}
        </p>
      )}

      <div className="relative mt-2.5">
        <BulkFiscalizationSheet
          compact
          licenseKey={licenseKey}
          staffId={staffId}
          staffName={staffName}
          staffRole={staffRole}
        />
      </div>
    </article>
  );
}

function RevenueXAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const [day = "", date = ""] = String(payload?.value ?? "").split("|");
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#475569" fontSize={9}>
        <tspan x={0} dy={10}>
          {day}
        </tspan>
        {date ? (
          <tspan x={0} dy={11} fill="#94a3b8" fontSize={8}>
            {date}
          </tspan>
        ) : null}
      </text>
    </g>
  );
}

function revenuePointLabel(
  period: RevenuePeriod,
  index: number,
  localeTag: string,
): { axisLabel: string; tooltipLabel: string } {
  const now = new Date();
  if (period === "day") {
    const hour = String(index).padStart(2, "0");
    return {
      axisLabel: `${hour}:00|`,
      tooltipLabel: `${hour}:00`,
    };
  }
  if (period === "week") {
    const date = addLocalCalendarDays(startOfLocalWeekMonday(now), index);
    return {
      axisLabel: `${date.toLocaleDateString(localeTag, {
        weekday: "short",
      })}|${date.toLocaleDateString(localeTag, {
        day: "numeric",
        month: "short",
      })}`,
      tooltipLabel: date.toLocaleDateString(localeTag, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    };
  }
  if (period === "month") {
    const date = addLocalCalendarDays(startOfLocalMonth(now), index);
    return {
      axisLabel: `${date.getDate()}|`,
      tooltipLabel: date.toLocaleDateString(localeTag, {
        day: "numeric",
        month: "short",
      }),
    };
  }
  const date = addLocalMonths(startOfLocalYear(now), index);
  return {
    axisLabel: `${date.toLocaleDateString(localeTag, { month: "short" })}|`,
    tooltipLabel: date.toLocaleDateString(localeTag, {
      month: "long",
      year: "numeric",
    }),
  };
}

function RevenueOverviewCard({
  data,
  loading,
  period,
  onPeriodChange,
  formatPrice,
  language,
  panelClassName,
  t,
}: {
  data: RevenueOverview;
  loading: boolean;
  period: RevenuePeriod;
  onPeriodChange: (period: RevenuePeriod) => void;
  formatPrice: (value: number) => string;
  language: "en" | "sq";
  panelClassName: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const localeTag = language === "sq" ? "sq-AL" : "en-GB";
  const currentSeriesLabel = t(`dashboard.revenue_overview_current_${period}`);
  const previousSeriesLabel = t(`dashboard.revenue_overview_previous_${period}`);
  const chartData = useMemo(
    () =>
      data.points.map((point, index) => {
        const labels = revenuePointLabel(period, index, localeTag);
        return {
          axisLabel: labels.axisLabel,
          tooltipLabel: labels.tooltipLabel,
          currentRevenue: point.currentRevenue,
          previousRevenue: point.previousRevenue,
        };
      }),
    [data.points, localeTag, period],
  );
  const xAxisInterval =
    chartData.length > 14 ? Math.ceil(chartData.length / 8) - 1 : 0;

  return (
    <article
      className={`${panelClassName} flex flex-col !border-brand-subtle/80 !bg-white !p-4 shadow-[0_18px_45px_-28px_rgba(30,64,175,0.35)]`}
    >
      <span
        className="pointer-events-none absolute -right-14 -top-24 size-56 rounded-full bg-brand-subtle/80 blur-3xl"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-bold tracking-tight text-slate-900">
            {t("dashboard.revenue_overview_title")}
          </h2>
          <p className="mt-1 truncate text-[10px] text-slate-400">
            {t(`dashboard.revenue_overview_subtitle_${period}`)}
          </p>
        </div>

        <div className="relative shrink-0">
          <select
            value={period}
            onChange={(event) => {
              onPeriodChange(event.target.value as RevenuePeriod);
            }}
            aria-label={t("dashboard.revenue_overview_select_range")}
            className="h-8 appearance-none rounded-lg border border-slate-200 bg-slate-50 py-0 pl-2.5 pr-7 text-[9px] font-semibold text-slate-600 outline-none transition hover:border-brand-soft hover:bg-white focus:ring-2 focus:ring-brand/25"
          >
            <option value="day">
              {t("dashboard.revenue_overview_period_day")}
            </option>
            <option value="week">
              {t("dashboard.revenue_overview_period_week")}
            </option>
            <option value="month">
              {t("dashboard.revenue_overview_period_month")}
            </option>
            <option value="year">
              {t("dashboard.revenue_overview_period_year")}
            </option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand-cyan shadow-[0_0_8px_rgba(0,198,255,0.65)]" />
          {currentSeriesLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-3 border-t-2 border-dashed border-[#8468db]" />
          {previousSeriesLabel}
        </span>
      </div>

      <div className="relative mt-2 h-[205px] w-full min-w-0">
        {loading ? (
          <div className="h-full animate-pulse rounded-xl bg-slate-100/80" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 12, right: 6, left: 4, bottom: 2 }}
            >
              <defs>
                <linearGradient
                  id="revenueOverviewArea"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#159dff" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#159dff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient
                  id="revenueOverviewPreviousArea"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#7454d3" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#7454d3" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="rgba(148,163,184,0.22)"
                strokeDasharray="0"
              />
              <XAxis
                dataKey="axisLabel"
                tick={<RevenueXAxisTick />}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.28)" }}
                interval={xAxisInterval}
                height={34}
                padding={{ left: 4, right: 4 }}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 8 }}
                tickLine={false}
                axisLine={false}
                width={72}
                tickCount={4}
                tickFormatter={(value) => formatPrice(Number(value))}
              />
              <Tooltip
                cursor={{
                  stroke: "rgba(100,116,139,0.4)",
                  strokeWidth: 1,
                }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as {
                    tooltipLabel: string;
                    currentRevenue: number;
                    previousRevenue: number;
                  };
                  return (
                    <div className="min-w-[145px] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-[0_14px_32px_rgba(15,23,42,0.18)] backdrop-blur">
                      <p className="text-[9px] font-medium text-slate-500">
                        {row.tooltipLabel || String(label ?? "")}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900 tabular-nums">
                        {formatPrice(row.currentRevenue)}
                      </p>
                      <div className="mt-1.5 border-t border-slate-100 pt-1.5 text-[9px]">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">
                            {previousSeriesLabel}
                          </span>
                          <span className="font-semibold text-violet-600 tabular-nums">
                            {formatPrice(row.previousRevenue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="previousRevenue"
                stroke="none"
                fill="url(#revenueOverviewPreviousArea)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="currentRevenue"
                stroke="none"
                fill="url(#revenueOverviewArea)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="previousRevenue"
                stroke="#765bd1"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="currentRevenue"
                stroke="#18a5ff"
                strokeWidth={2.2}
                dot={{ r: 2.5, fill: "#18a5ff", strokeWidth: 0 }}
                activeDot={{
                  r: 4.5,
                  fill: "#dff4ff",
                  stroke: "#18a5ff",
                  strokeWidth: 2.5,
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  );
}

type PremiumMetricTone = "revenue" | "bar" | "kitchen" | "orders";

const metricAccent: Record<
  PremiumMetricTone,
  { color: string; glow: string; icon: string; surface: string }
> = {
  revenue: {
    color: "#0d9488",
    glow: "rgba(13,148,136,0.12)",
    icon: "from-emerald-100 to-teal-50 text-emerald-700",
    surface:
      "border-emerald-100/90 bg-[linear-gradient(145deg,#ffffff_0%,#f7fffc_62%,#eefcf8_100%)]",
  },
  bar: {
    color: "#0891b2",
    glow: "rgba(8,145,178,0.11)",
    icon: "from-cyan-100 to-sky-50 text-cyan-700",
    surface:
      "border-cyan-100/90 bg-[linear-gradient(145deg,#ffffff_0%,#f7fdff_62%,#eefaff_100%)]",
  },
  kitchen: {
    color: "#ea580c",
    glow: "rgba(234,88,12,0.1)",
    icon: "from-orange-100 to-amber-50 text-orange-700",
    surface:
      "border-orange-100/90 bg-[linear-gradient(145deg,#ffffff_0%,#fffbf7_62%,#fff5e9_100%)]",
  },
  orders: {
    color: "#2563eb",
    glow: "rgba(37,99,235,0.1)",
    icon: "from-brand-subtle to-brand-light text-brand-hover",
    surface:
      "border-brand-subtle/90 bg-[linear-gradient(145deg,#ffffff_0%,#f8fbff_62%,#eef4ff_100%)]",
  },
};

function MetricSparkline({
  values,
  tone,
}: {
  values: number[];
  tone: PremiumMetricTone;
}) {
  const width = 84;
  const height = 30;
  const pad = 2;
  const safe =
    values.length > 1
      ? values.map((value) =>
          Number.isFinite(value) ? Math.max(0, value) : 0,
        )
      : [0, 0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min;
  const points = safe.map((value, index) => ({
    x: pad + (index / Math.max(1, safe.length - 1)) * (width - pad * 2),
    y:
      range === 0
        ? height - 5
        : pad + (1 - (value - min) / range) * (height - pad * 2 - 3),
  }));
  const line = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, "");
  const area = `${line} L ${points.at(-1)?.x ?? width - pad} ${height} L ${points[0].x} ${height} Z`;
  const accent = metricAccent[tone];
  const gradientId = `metric-spark-${tone}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[30px] w-[84px]" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent.color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={accent.color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={accent.color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PremiumMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  meta,
  series,
  tone,
  loading,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: number | null;
  meta: string;
  series: number[];
  tone: PremiumMetricTone;
  loading: boolean;
}) {
  const hasTrend = trend !== undefined && trend !== null;
  const trendUp = (trend ?? 0) >= 0;
  const accent = metricAccent[tone];

  return (
    <article
      className={`group relative flex min-h-[142px] flex-col justify-center overflow-hidden rounded-[1.35rem] border p-4 shadow-[0_2px_4px_rgba(15,23,42,0.03),0_18px_38px_-26px_rgba(15,23,42,0.28)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(15,23,42,0.05),0_24px_44px_-26px_rgba(15,23,42,0.32)] ${accent.surface}`}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full"
        style={{
          backgroundColor: accent.color,
          boxShadow: `0 0 14px 1px ${accent.glow}`,
        }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -left-8 -top-12 size-32 rounded-full blur-3xl"
        style={{ backgroundColor: accent.glow }}
        aria-hidden
      />

      <div className="relative flex items-center gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-white bg-gradient-to-br shadow-[0_8px_18px_-10px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/[0.04] ${accent.icon}`}
        >
          <Icon className="size-[17px]" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[11px] font-semibold tracking-wide text-slate-500">
              {title}
            </p>
            {loading ? (
              <div className="h-7 w-24 animate-pulse rounded-lg bg-slate-200/70" />
            ) : (
              <p className="truncate text-[1.45rem] font-bold leading-none tracking-[-0.035em] text-slate-950 tabular-nums">
                {value}
              </p>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            {hasTrend ? (
              <p className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[10px]">
                {trendUp ? (
                  <ArrowUpRight className="size-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="size-3.5 shrink-0 text-rose-600" />
                )}
                <span
                  className={`font-semibold tabular-nums ${
                    trendUp ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {trendUp ? "+" : ""}
                  {(trend ?? 0).toFixed(1)}%
                </span>
                <span className="truncate text-slate-400">{meta}</span>
              </p>
            ) : (
              <p className="truncate text-[10px] text-slate-400">{meta}</p>
            )}
            <MetricSparkline
              values={loading ? EMPTY_KPI_SERIES : series}
              tone={tone}
            />
          </div>
        </div>
      </div>
    </article>
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
        <div className={`${dashPanel} h-52 animate-pulse rounded-2xl bg-slate-100`} />
        <div className={`${dashPanel} h-44 animate-pulse rounded-2xl bg-slate-100`} />
        <div className={`${dashPanel} h-40 animate-pulse rounded-2xl bg-slate-100`} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`w-full min-w-0 ${dashPanel}`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-600/15">
              <BarChart2 className="size-5" strokeWidth={2} />
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
          <KpiCard icon={Banknote} label={t("starter_overview.today_cash_payments")} value={formatPrice(cashToday)} color={BRAND.accent} />
          <KpiCard icon={CreditCard} label={t("starter_overview.today_card_payments")} value={formatPrice(cardToday)} color={BRAND.primary} />
          <KpiCard
            icon={UtensilsCrossed}
            label={t("starter_overview.today_active_tables")}
            value={String(stats.activeTables)}
            color="#0d9488"
          />
        </div>
      </section>

      <section className={`w-full min-w-0 ${dashPanel}`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-600/15">
              <Clock className="size-5" strokeWidth={2} />
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
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-600/15">
              <Banknote className="size-5" strokeWidth={2} />
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
                className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-active ring-1 ring-brand/15"
              >
                <UserCheck className="size-3.5 shrink-0 text-brand-hover" />
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

type TopItemRow = {
  name: string;
  quantity: number;
  revenue: number;
  estimatedProfit?: number | null;
  marginPercent?: number | null;
  imageUrl?: string | null;
};

type CategorySalesRow = {
  name: string;
  color: string;
  quantity: number;
  revenue: number;
};

type StaffPerformanceRow = {
  name: string;
  orders: number;
  revenue: number;
};

type RecentOrderRow = {
  id: string;
  orderNumber: number;
  tableName: string;
  staffName: string;
  customerName: string;
  status: string;
  total: number;
  paymentMethod: string;
  activityAt: string;
};

function EnterpriseSalesBreakdownSection({
  categorySales,
  topItems,
  formatPrice,
  loading,
  onViewDetails,
  show = "both",
  t,
}: {
  categorySales: CategorySalesRow[];
  topItems: TopItemRow[];
  formatPrice: (value: number) => string;
  loading: boolean;
  onViewDetails?: () => void;
  show?: "category" | "products" | "both";
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const categoryRows = useMemo(() => {
    const sorted = categorySales
      .filter((row) => Number(row.revenue) > 0)
      .slice()
      .sort((a, b) => b.revenue - a.revenue);
    if (sorted.length <= 6) return sorted;
    const visible = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce(
      (aggregate, row) => ({
        name: t("dashboard.sales_category_other"),
        color: "#64748b",
        quantity: aggregate.quantity + row.quantity,
        revenue: aggregate.revenue + row.revenue,
      }),
      {
        name: t("dashboard.sales_category_other"),
        color: "#64748b",
        quantity: 0,
        revenue: 0,
      },
    );
    return [...visible, rest];
  }, [categorySales, t]);
  const totalCategoryRevenue = useMemo(
    () => categoryRows.reduce((sum, row) => sum + row.revenue, 0),
    [categoryRows],
  );
  const productRows = useMemo(
    () =>
      topItems
        .filter((item) => item.quantity > 0 || item.revenue > 0)
        .slice(0, 5),
    [topItems],
  );
  const rowColor = (row: CategorySalesRow, index: number) =>
    row.color.trim() || DONUT_PALETTE[index % DONUT_PALETTE.length];

  const categoryCard = (
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white p-4 shadow-[0_2px_5px_rgba(15,23,42,0.03),0_18px_42px_-28px_rgba(15,23,42,0.3)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold tracking-tight text-slate-900">
              {t("dashboard.sales_by_category_title")}
            </h2>
            <p className="mt-1 truncate text-[10px] text-slate-400">
              {t("dashboard.sales_by_category_subtitle")}
            </p>
          </div>
          {onViewDetails ? (
            <button
              type="button"
              onClick={onViewDetails}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[9px] font-semibold text-slate-600 transition hover:border-brand-soft hover:bg-white hover:text-brand-hover"
            >
              {t("dashboard.sales_analytics_detail")}
              <ArrowRight className="size-3" />
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-[34px] h-[205px] animate-pulse rounded-xl bg-slate-100/80" />
        ) : categoryRows.length === 0 || totalCategoryRevenue <= 0 ? (
          <p className="mt-[34px] flex h-[205px] items-center justify-center text-center text-sm text-slate-400">
            {t("dashboard.donut_empty")}
          </p>
        ) : (
          <div className="mt-[34px] flex h-[205px] items-center gap-3">
            <div className="flex shrink-0 items-center justify-start">
              <svg
                viewBox="0 0 220 220"
                className="h-[196px] w-[196px] drop-shadow-[0_16px_30px_rgba(30,64,175,0.12)]"
              >
                {(() => {
                  let angle = 0;
                  return categoryRows.map((row, index) => {
                    const slice =
                      totalCategoryRevenue > 0
                        ? (row.revenue / totalCategoryRevenue) * 360
                        : 0;
                    const start = angle + 1.2;
                    const end = angle + Math.max(1, slice - 1.2);
                    angle += slice;
                    return (
                      <path
                        key={`${row.name}-${index}`}
                        d={donutArcPath(110, 110, 66, 96, start, end)}
                        fill={rowColor(row, index)}
                      />
                    );
                  });
                })()}
                <circle cx="110" cy="110" r="57" fill="#ffffff" />
                <text
                  x="110"
                  y="104"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-900 text-[15px] font-bold"
                >
                  {formatPrice(totalCategoryRevenue)}
                </text>
                <text
                  x="110"
                  y="122"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-400 text-[9px] font-medium"
                >
                  {t("dashboard.sales_category_total")}
                </text>
              </svg>
            </div>

            <div className="min-w-0 shrink-0 space-y-0.5">
              {categoryRows.map((row, index) => {
                const percentage =
                  totalCategoryRevenue > 0
                    ? (row.revenue / totalCategoryRevenue) * 100
                    : 0;
                return (
                  <div
                    key={`${row.name}-legend-${index}`}
                    className="grid grid-cols-[minmax(72px,118px)_36px_minmax(64px,auto)] items-center gap-1.5 rounded-lg px-1 py-1 transition hover:bg-slate-50"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-slate-600">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: rowColor(row, index) }}
                      />
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="text-right text-[11px] font-semibold text-slate-500 tabular-nums">
                      {percentage.toFixed(0)}%
                    </span>
                    <span className="text-right text-[11px] font-semibold text-slate-800 tabular-nums">
                      {formatPrice(row.revenue)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </article>
  );

  const productsCard = (
      <article className={`min-w-0 ${dashPanel}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              {t("dashboard.top_products_title")}
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              {t("dashboard.top_products_subtitle")}
            </p>
          </div>
          {onViewDetails ? (
            <button
              type="button"
              onClick={onViewDetails}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-600 transition hover:border-brand-soft hover:bg-white hover:text-brand-hover"
            >
              {t("dashboard.top_products_view_all")}
              <ArrowRight className="size-3" />
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-4 h-[220px] animate-pulse rounded-2xl bg-slate-100/70" />
        ) : productRows.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            {t("dashboard.donut_empty")}
          </p>
        ) : (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between px-2 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
              <span>{t("dashboard.top_products_product")}</span>
              <div className="flex shrink-0 items-center gap-5">
                <span className="w-10 text-right">
                  {t("dashboard.top_products_qty")}
                </span>
                <span className="w-[72px] text-right">
                  {t("dashboard.top_products_revenue")}
                </span>
                <span className="w-[72px] text-right">
                  {t("dashboard.top_products_profit")}
                </span>
                <span className="w-12 text-right">
                  {t("dashboard.top_products_margin")}
                </span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {productRows.map((item, index) => {
                const hasProfit =
                  item.estimatedProfit !== null &&
                  item.estimatedProfit !== undefined &&
                  item.marginPercent !== null &&
                  item.marginPercent !== undefined;
                const margin = Number(item.marginPercent ?? 0);
                return (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex items-center justify-between gap-3 px-2 py-1.5 transition hover:bg-brand-light/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="w-4 shrink-0 text-[11px] font-semibold text-slate-400">
                        {index + 1}
                      </span>
                      <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-light to-cyan-50 text-[11px] font-bold text-brand-hover ring-1 ring-brand/10">
                        {item.name.trim().charAt(0).toUpperCase() || "•"}
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="absolute inset-0 size-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                      </span>
                      <span className="truncate text-xs font-semibold text-slate-700">
                        {item.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-5 text-xs font-semibold tabular-nums">
                      <span className="w-10 text-right text-slate-600">
                        {item.quantity}
                      </span>
                      <span className="w-[72px] text-right text-slate-800">
                        {formatPrice(item.revenue)}
                      </span>
                      <span
                        className={`w-[72px] text-right ${
                          hasProfit
                            ? Number(item.estimatedProfit) >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                            : "text-slate-300"
                        }`}
                        title={
                          hasProfit
                            ? undefined
                            : t("dashboard.top_products_cost_unavailable")
                        }
                      >
                        {hasProfit
                          ? formatPrice(Number(item.estimatedProfit))
                          : "—"}
                      </span>
                      <span
                        className={`w-12 text-right font-bold ${
                          hasProfit
                            ? margin >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                            : "text-slate-300"
                        }`}
                        title={
                          hasProfit
                            ? undefined
                            : t("dashboard.top_products_cost_unavailable")
                        }
                      >
                        {hasProfit ? `${margin.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </article>
  );

  if (show === "category") return categoryCard;
  if (show === "products") return productsCard;

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)]">
      {categoryCard}
      {productsCard}
    </section>
  );
}

function EnterpriseStaffOrdersSection({
  staffPerformance,
  recentOrders,
  formatPrice,
  language,
  loading,
  onViewOrders,
  t,
}: {
  staffPerformance: StaffPerformanceRow[];
  recentOrders: RecentOrderRow[];
  formatPrice: (value: number) => string;
  language: "en" | "sq";
  loading: boolean;
  onViewOrders?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const staffRows = useMemo(
    () =>
      staffPerformance
        .slice()
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    [staffPerformance],
  );
  const highestRevenue = Math.max(
    0,
    ...staffRows.map((staff) => Number(staff.revenue) || 0),
  );
  const avatarTones = [
    "bg-brand-light text-brand-hover ring-brand/10",
    "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    "bg-violet-50 text-violet-700 ring-violet-600/10",
    "bg-amber-50 text-amber-700 ring-amber-600/10",
    "bg-cyan-50 text-cyan-700 ring-cyan-600/10",
  ];
  const statusLabel = (status: string) => {
    const normalized = status.trim().toLowerCase();
    if (normalized === "paid") return t("dashboard.recent_status_paid");
    if (normalized === "cancelled" || normalized === "voided") {
      return t("dashboard.recent_status_cancelled");
    }
    if (normalized === "ready") return t("dashboard.recent_status_ready");
    if (normalized === "served") return t("dashboard.recent_status_served");
    if (normalized === "sent-to-kitchen" || normalized === "sent") {
      return t("dashboard.recent_status_sent");
    }
    return t("dashboard.recent_status_open");
  };
  const statusTone = (status: string) => {
    const normalized = status.trim().toLowerCase();
    if (normalized === "paid") {
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
    }
    if (normalized === "cancelled" || normalized === "voided") {
      return "bg-rose-50 text-rose-700 ring-rose-600/10";
    }
    if (normalized === "ready" || normalized === "served") {
      return "bg-brand-light text-brand-hover ring-brand/10";
    }
    return "bg-amber-50 text-amber-700 ring-amber-600/10";
  };
  const paymentLabel = (method: string) => {
    const normalized = method.trim().toLowerCase();
    if (normalized === "cash") {
      return t("dashboard.enterprise_payment_cash");
    }
    if (normalized === "card") {
      return t("dashboard.enterprise_payment_card");
    }
    return normalized
      ? t("dashboard.enterprise_payment_other")
      : "";
  };

  const staffCard =
    "relative isolate min-w-0 overflow-hidden rounded-[1.5rem] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(248,251,255,0.97)_58%,rgba(239,247,255,0.94)_100%)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_-24px_rgba(37,99,235,0.28)] ring-1 ring-slate-200/70";
  const ordersCard =
    "relative isolate min-w-0 overflow-hidden rounded-[1.5rem] border border-white/90 bg-[linear-gradient(145deg,rgba(255,255,255,0.99)_0%,rgba(250,249,255,0.97)_58%,rgba(245,243,255,0.94)_100%)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_-24px_rgba(124,58,237,0.28)] ring-1 ring-slate-200/70";
  const rankTone = [
    "bg-amber-50 text-amber-700 ring-amber-500/15",
    "bg-slate-100 text-slate-600 ring-slate-400/15",
    "bg-orange-50 text-orange-700 ring-orange-500/15",
  ];

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-stretch">
      <article className={staffCard}>
        <span
          className="pointer-events-none absolute -right-14 -top-16 -z-10 size-40 rounded-full bg-sky-100/80 blur-3xl"
          aria-hidden
        />
        <span
          className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent"
          aria-hidden
        />
        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white bg-white/90 text-sky-700 shadow-[0_7px_18px_-10px_rgba(2,132,199,0.75)] ring-1 ring-sky-600/10">
            <UserCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-slate-950">
              {t("dashboard.staff_performance")}
            </h2>
            <p className="truncate text-[10px] text-slate-400">
              {t("dashboard.staff_performance_subtitle")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 h-[248px] animate-pulse rounded-2xl bg-white/70" />
        ) : staffRows.length === 0 ? (
          <p className="py-16 text-center text-[12px] text-slate-400">
            {t("dashboard.empty_staff")}
          </p>
        ) : (
          <ul className="relative mt-3 space-y-1.5">
            {staffRows.map((staff, index) => {
              const initials =
                staff.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((part) => part.charAt(0))
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "•";
              const share =
                highestRevenue > 0
                  ? Math.min(100, (staff.revenue / highestRevenue) * 100)
                  : 0;
              return (
                <li
                  key={`${staff.name}-${index}`}
                  className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-2xl border border-slate-100/90 bg-white/75 px-2.5 py-2 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.5)] transition hover:-translate-y-px hover:border-sky-100 hover:bg-white"
                >
                  <span
                    className={`flex size-6 items-center justify-center rounded-lg text-[10px] font-extrabold ring-1 ${
                      rankTone[index] ?? "bg-slate-50 text-slate-400 ring-slate-200"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`flex size-8 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${
                      avatarTones[index % avatarTones.length]
                    }`}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold text-slate-800">
                        {staff.name}
                      </span>
                      <span className="shrink-0 text-[9px] font-medium text-slate-400">
                        {t("dashboard.staff_orders", {
                          count: staff.orders,
                        })}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                  <span className="min-w-[72px] text-right text-[12px] font-extrabold tracking-[-0.02em] text-slate-950 tabular-nums">
                    {formatPrice(staff.revenue)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </article>

      <article className={ordersCard}>
        <span
          className="pointer-events-none absolute -right-14 -top-16 -z-10 size-40 rounded-full bg-violet-100/75 blur-3xl"
          aria-hidden
        />
        <span
          className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent"
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white bg-white/90 text-violet-700 shadow-[0_7px_18px_-10px_rgba(124,58,237,0.75)] ring-1 ring-violet-600/10">
              <ReceiptText className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-bold tracking-[-0.01em] text-slate-950">
                {t("dashboard.recent_orders_title")}
              </h2>
              <p className="truncate text-[10px] text-slate-400">
                {t("dashboard.recent_orders_subtitle")}
              </p>
            </div>
          </div>
          {onViewOrders ? (
            <button
              type="button"
              onClick={onViewOrders}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-100 bg-white/85 px-2.5 py-1 text-[9px] font-bold text-violet-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50"
            >
              {t("dashboard.top_products_view_all")}
              <ArrowRight className="size-3" />
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-4 h-[248px] animate-pulse rounded-2xl bg-white/70" />
        ) : recentOrders.length === 0 ? (
          <p className="py-16 text-center text-[12px] text-slate-400">
            {t("dashboard.recent_orders_empty")}
          </p>
        ) : (
          <ul className="relative mt-3 space-y-1.5">
            {recentOrders.slice(0, 4).map((order) => {
              const activityDate = new Date(order.activityAt);
              const validDate = Number.isFinite(activityDate.getTime());
              const timeLabel = validDate
                ? activityDate.toLocaleTimeString(
                    language === "sq" ? "sq-AL" : "en-GB",
                    { hour: "2-digit", minute: "2-digit" },
                  )
                : "—";
              const placeLabel =
                order.customerName.trim() || order.tableName || "—";
              return (
                <li
                  key={order.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-2xl border border-slate-100/90 bg-white/75 px-2.5 py-2 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.5)] transition hover:-translate-y-px hover:border-violet-100 hover:bg-white"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[11px] font-extrabold text-violet-700 ring-1 ring-violet-600/10 tabular-nums">
                    #{order.orderNumber || order.id.slice(-4)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-semibold text-slate-800">
                        {placeLabel}
                      </span>
                      <span className="shrink-0 text-[9px] font-medium text-slate-400 tabular-nums">
                        {timeLabel}
                      </span>
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[9px] text-slate-400">
                      <span className="truncate">
                        {order.staffName || "—"}
                      </span>
                      {order.paymentMethod ? (
                        <>
                          <span className="size-0.5 shrink-0 rounded-full bg-slate-300" />
                          <span className="shrink-0">
                            {paymentLabel(order.paymentMethod)}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[12px] font-extrabold tracking-[-0.02em] text-slate-950 tabular-nums">
                      {formatPrice(order.total)}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ring-1 ${statusTone(
                        order.status,
                      )}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </section>
  );
}

function formatHourSnapchat(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

function DemandFlowCard({
  heatmap,
  weekDayRevenue,
  formatPrice,
  loading,
}: {
  heatmap: VisitorHeatmap;
  weekDayRevenue: { day: string; revenue: number }[];
  formatPrice: (value: number) => string;
  loading: boolean;
}) {
  const { t } = usePosLocale();
  const [view, setView] = useState<"days" | "hours">("hours");
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
  const dailyPeakIndex = useMemo(() => {
    let best = -1;
    let max = 0;
    for (let index = 0; index < weekDayRevenue.length; index += 1) {
      if (weekDayRevenue[index].revenue > max) {
        max = weekDayRevenue[index].revenue;
        best = index;
      }
    }
    return best;
  }, [weekDayRevenue]);
  const dailyPeak =
    dailyPeakIndex >= 0 ? weekDayRevenue[dailyPeakIndex] : null;
  const dailyEmpty =
    !loading &&
    (weekDayRevenue.length === 0 ||
      !weekDayRevenue.some((row) => row.revenue > 0));

  return (
    <section className={`w-full min-w-0 ${dashPanel}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-600/15">
            <Clock className="size-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              {t("dashboard.popular_times_title")}
            </h3>
            <p className={`text-xs ${dashMuted}`}>{t("dashboard.popular_times_sub")}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["days", "hours"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${
                  view === option
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-700"
                }`}
              >
                {t(
                  option === "days"
                    ? "dashboard.demand_view_days"
                    : "dashboard.demand_view_hours",
                )}
              </button>
            ))}
          </div>
          {view === "hours" && peakMeta ? (
            <p className="text-right text-xs font-medium text-teal-700 tabular-nums">
              {t("dashboard.popular_times_peak", {
                hour: formatHourSnapchat(peakMeta.hour),
                level: t(popularTimesBusyLevelKey(peakMeta.count, peakMeta.count)),
              })}
            </p>
          ) : view === "days" && dailyPeak ? (
            <p className="text-right text-xs font-medium text-teal-700 tabular-nums">
              {t("dashboard.week_activity_peak", {
                day: dailyPeak.day,
                amount: formatPrice(dailyPeak.revenue),
              })}
            </p>
          ) : null}
        </div>
      </div>

      {view === "hours" && dayCount > 0 ? (
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {heatmap.dayLabels.slice(0, dayCount).map((label, i) => (
            <button
              key={`${label}-${i}`}
              type="button"
              onClick={() => setDayIdx(i)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-[transform,background,color] ${
                i === safeIdx
                  ? "bg-teal-600 text-white shadow-[0_4px_14px_-4px_rgba(13,148,136,0.55)]"
                  : "border border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {view === "days" ? (
        loading ? (
          <div className="h-[220px] animate-pulse rounded-xl bg-slate-100" />
        ) : dailyEmpty ? (
          <p className={`py-10 text-center text-sm ${dashMuted}`}>
            {t("dashboard.week_activity_empty")}
          </p>
        ) : (
          <div className={`h-[220px] w-full min-w-0 ${dashInnerWell} !p-2`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weekDayRevenue}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                barCategoryGap="18%"
              >
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  width={46}
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatPrice(Number(value))}
                />
                <Tooltip
                  cursor={{ fill: "rgba(13, 148, 136, 0.08)" }}
                  formatter={(value: number | string) =>
                    formatPrice(Number(value))
                  }
                />
                <Bar
                  dataKey="revenue"
                  radius={[10, 10, 0, 0]}
                  maxBarSize={42}
                  isAnimationActive={false}
                >
                  {weekDayRevenue.map((_, index) => (
                    <Cell
                      key={`demand-day-${index}`}
                      fill={index === dailyPeakIndex ? "#0d9488" : "#bae6e1"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      ) : loading ? (
        <div className="h-[220px] animate-pulse rounded-xl bg-slate-100" />
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
                  <stop offset="0%" stopColor="#99f6e4" stopOpacity={0.4} />
                  <stop offset="55%" stopColor="#2dd4bf" />
                  <stop offset="100%" stopColor="#0d9488" />
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
                cursor={{ fill: "rgba(13, 148, 136, 0.08)" }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const c = Number((payload[0]?.payload as { count?: number })?.count ?? 0);
                  const peakCount = peakMeta?.count ?? 0;
                  const levelKey = popularTimesBusyLevelKey(c, peakCount);
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.16)]">
                      <p className="text-xs font-medium text-slate-500">{formatHourSnapchat(Number(label))}</p>
                      <p className="text-sm font-semibold text-teal-700">{t(levelKey)}</p>
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

function popularTimesBusyLevelKey(count: number, peakCount: number): string {
  if (count <= 0 || peakCount <= 0) return "dashboard.popular_times_no_traffic";
  const ratio = count / peakCount;
  if (ratio < 0.25) return "dashboard.popular_times_little_busy";
  if (ratio < 0.5) return "dashboard.popular_times_moderately_busy";
  if (ratio < 0.8) return "dashboard.popular_times_usually_busy";
  return "dashboard.popular_times_very_busy";
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
  formatPrice,
  loading,
}: {
  topItems: TopItemRow[];
  t: (key: string, options?: Record<string, unknown>) => string;
  formatPrice: (value: number) => string;
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
        revenue: i.revenue,
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
        <div className="mx-auto h-[220px] w-[220px] rounded-full bg-slate-100 animate-pulse" />
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
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-semibold text-slate-900 tabular-nums">
                    {formatPrice(row.revenue)}
                  </span>
                  <span className="block text-[9px] text-slate-400 tabular-nums">
                    {t("dashboard.donut_row_qty", { count: row.value })}
                  </span>
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
  collapsible = false,
}: {
  fiscalTotal: number;
  nonFiscalTotal: number;
  formatPrice: (n: number) => string;
  licenseKey: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  collapsible?: boolean;
}) {
  const { t } = usePosLocale();
  const hasData = fiscalTotal > 0 || nonFiscalTotal > 0;
  const todayData = useMemo(
    () => [{ label: t("dashboard.period_day"), fiscal: fiscalTotal, nonFiscal: nonFiscalTotal }],
    [fiscalTotal, nonFiscalTotal, t],
  );
  const Container = collapsible ? "details" : "section";
  return (
    <Container className={`group w-full min-w-0 ${dashPanel}`}>
      {collapsible ? (
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {t("dashboard.fiscal_system_title")}
            </h3>
            <p className={`mt-0.5 text-[11px] ${dashMuted}`}>
              {t("dashboard.fiscal_system_subtitle")}
            </p>
          </div>
          <ChevronDown className="size-4 text-slate-400 transition group-open:rotate-180" />
        </summary>
      ) : null}
      <div className={collapsible ? "mt-4" : undefined}>
        <div className={`${collapsible ? "hidden" : "mb-3 flex"} items-start justify-between gap-2`}>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{t("dashboard.fiscal_system_title")}</h3>
            <p className={`text-xs ${dashMuted}`}>{t("dashboard.fiscal_system_subtitle")}</p>
          </div>
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
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
    </Container>
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
          className="flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="size-5" style={{ color }} />
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
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600 ring-1 ring-slate-200/80">
          <Icon className="size-4" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}
