import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getRestaurantByLicense } from "./helpers";

// ── Dashboard Stats ─────────────────────────────────

const dashboardPeriodValidator = v.union(
  v.literal("day"),
  v.literal("week"),
  v.literal("month"),
  v.literal("year"),
);
const dashboardTargetPeriodValidator = v.union(
  v.literal("month"),
  v.literal("six_months"),
  v.literal("custom"),
);

type DashboardPeriod = "day" | "week" | "month" | "year";

function chartLocaleTag(locale?: string): string {
  return locale === "sq" ? "sq-AL" : "en-US";
}

function localPeriodStarts(now: Date): Record<DashboardPeriod, string> {
  const dayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const weekStart = new Date(dayStart);
  const dow = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + (dow === 0 ? -6 : 1 - dow));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  return {
    day: dayStart.toISOString(),
    week: weekStart.toISOString(),
    month: monthStart.toISOString(),
    year: yearStart.toISOString(),
  };
}

function summarizePaidOrders(
  paid: { total: number }[],
): { revenue: number; paidCount: number; avgOrderValue: number } {
  const revenue = paid.reduce((sum, o) => sum + o.total, 0);
  const avg = paid.length > 0 ? revenue / paid.length : 0;
  return {
    revenue: Math.round(revenue * 100) / 100,
    paidCount: paid.length,
    avgOrderValue: Math.round(avg * 100) / 100,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const DASHBOARD_KPI_BUCKETS = 12;

function kpiBucketIndex(at: string, startIso: string, endIso: string): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  const value = Date.parse(at);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(value) ||
    end <= start ||
    value < start ||
    value >= end
  ) {
    return -1;
  }
  return Math.min(
    DASHBOARD_KPI_BUCKETS - 1,
    Math.floor(((value - start) / (end - start)) * DASHBOARD_KPI_BUCKETS),
  );
}

type OrderForChart = {
  createdAt: string;
  total: number;
  paymentType?: string;
  originalTotal?: number;
};

function reportedOrderRevenue(o: OrderForChart): number {
  const type = o.paymentType ?? "fiscal";
  return type === "complimentary" ? (o.originalTotal ?? 0) : o.total;
}

function startLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startLocalWeekMonday(d: Date): Date {
  const day = startLocalDay(d);
  const dow = day.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  return addLocalDays(day, delta);
}

function startLocalMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addLocalMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

type ChartBucket = { label: string; revenue: number; orders: number };

function sumBucketPaid(
  paid: OrderForChart[],
  startIso: string,
  endIso: string,
): { revenue: number; orders: number } {
  let revenue = 0;
  let orders = 0;
  for (const o of paid) {
    if (o.createdAt >= startIso && o.createdAt < endIso) {
      revenue += reportedOrderRevenue(o);
      orders += 1;
    }
  }
  return { revenue: round2(revenue), orders };
}

function buildSalesChartDay(
  paid: OrderForChart[],
  now: Date,
  lc: string,
): { current: ChartBucket[]; previous: ChartBucket[] } {
  const today = startLocalDay(now);
  const current: ChartBucket[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addLocalDays(today, -i);
    const next = addLocalDays(day, 1);
    const s = sumBucketPaid(paid, day.toISOString(), next.toISOString());
    current.push({
      label: day.toLocaleDateString(lc, { month: "short", day: "numeric" }),
      ...s,
    });
  }
  const previous: ChartBucket[] = [];
  for (let i = 27; i >= 14; i--) {
    const day = addLocalDays(today, -i);
    const next = addLocalDays(day, 1);
    const s = sumBucketPaid(paid, day.toISOString(), next.toISOString());
    previous.push({
      label: day.toLocaleDateString(lc, { month: "short", day: "numeric" }),
      ...s,
    });
  }
  return { current, previous };
}

function buildSalesChartWeek(
  paid: OrderForChart[],
  now: Date,
  lc: string,
): { current: ChartBucket[]; previous: ChartBucket[] } {
  const thisWeekStart = startLocalWeekMonday(now);
  const current: ChartBucket[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = addLocalDays(thisWeekStart, -7 * i);
    const weekEnd = addLocalDays(weekStart, 7);
    const s = sumBucketPaid(paid, weekStart.toISOString(), weekEnd.toISOString());
    current.push({
      label: weekStart.toLocaleDateString(lc, {
        month: "short",
        day: "numeric",
      }),
      ...s,
    });
  }
  const previous: ChartBucket[] = [];
  for (let i = 15; i >= 8; i--) {
    const weekStart = addLocalDays(thisWeekStart, -7 * i);
    const weekEnd = addLocalDays(weekStart, 7);
    const s = sumBucketPaid(paid, weekStart.toISOString(), weekEnd.toISOString());
    previous.push({
      label: weekStart.toLocaleDateString(lc, {
        month: "short",
        day: "numeric",
      }),
      ...s,
    });
  }
  return { current, previous };
}

function buildSalesChartMonth(
  paid: OrderForChart[],
  now: Date,
  lc: string,
): { current: ChartBucket[]; previous: ChartBucket[] } {
  const curMonth = startLocalMonth(now);
  const current: ChartBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = addLocalMonths(curMonth, -i);
    const monthEnd = addLocalMonths(monthStart, 1);
    const s = sumBucketPaid(paid, monthStart.toISOString(), monthEnd.toISOString());
    current.push({
      label: monthStart.toLocaleDateString(lc, {
        month: "short",
        year: "2-digit",
      }),
      ...s,
    });
  }
  const previous: ChartBucket[] = [];
  for (let i = 23; i >= 12; i--) {
    const monthStart = addLocalMonths(curMonth, -i);
    const monthEnd = addLocalMonths(monthStart, 1);
    const s = sumBucketPaid(paid, monthStart.toISOString(), monthEnd.toISOString());
    previous.push({
      label: monthStart.toLocaleDateString(lc, {
        month: "short",
        year: "2-digit",
      }),
      ...s,
    });
  }
  return { current, previous };
}

function buildSalesChartAllTime(
  paid: OrderForChart[],
  now: Date,
  lc: string,
): { current: ChartBucket[]; previous: ChartBucket[] } {
  if (paid.length === 0) {
    return { current: [], previous: [] };
  }
  let minIso = paid[0].createdAt;
  for (const o of paid) {
    if (o.createdAt < minIso) minIso = o.createdAt;
  }
  const firstMonth = startLocalMonth(new Date(minIso));
  const curMonth = startLocalMonth(now);
  const months: Date[] = [];
  for (let m = new Date(firstMonth); m <= curMonth; m = addLocalMonths(m, 1)) {
    months.push(new Date(m));
  }
  let slice = months;
  if (slice.length > 36) {
    slice = slice.slice(-36);
  }
  const current: ChartBucket[] = slice.map((monthStart) => {
    const monthEnd = addLocalMonths(monthStart, 1);
    const s = sumBucketPaid(paid, monthStart.toISOString(), monthEnd.toISOString());
    return {
      label: monthStart.toLocaleDateString(lc, {
        month: "short",
        year: "2-digit",
      }),
      ...s,
    };
  });
  const previous: ChartBucket[] = [];
  if (slice.length > 0) {
    const beforeFirst = addLocalMonths(slice[0], -slice.length);
    for (let i = 0; i < slice.length; i++) {
      const monthStart = addLocalMonths(beforeFirst, i);
      const monthEnd = addLocalMonths(monthStart, 1);
      const s = sumBucketPaid(paid, monthStart.toISOString(), monthEnd.toISOString());
      previous.push({
        label: monthStart.toLocaleDateString(lc, {
          month: "short",
          year: "2-digit",
        }),
        ...s,
      });
    }
  }
  return { current, previous };
}

function buildSalesChartBundle(paid: OrderForChart[], now: Date, lc: string) {
  return {
    day: buildSalesChartDay(paid, now, lc),
    week: buildSalesChartWeek(paid, now, lc),
    month: buildSalesChartMonth(paid, now, lc),
    all: buildSalesChartAllTime(paid, now, lc),
  };
}

/** Paid revenue per calendar day for the last 7 days (oldest → today). */
type SupplyProfitMonthPoint = {
  label: string;
  revenue: number;
  supplyIntake: number;
  stockExpense: number;
  estimatedProfit: number;
};

/** Last 6 calendar months: paid revenue vs stock-based intake & expense (price × qty, current item prices). */
function buildSupplyProfitLast6Months(
  now: Date,
  paid: OrderForChart[],
  stockLogs: Doc<"stockLogs">[],
  menuItems: Doc<"menuItems">[],
  lc: string,
): SupplyProfitMonthPoint[] {
  const priceByItem = new Map<string, number>(
    menuItems.map((m) => [m._id as string, m.price]),
  );
  const curMonthStart = startLocalMonth(now);
  const out: SupplyProfitMonthPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = addLocalMonths(curMonthStart, -i);
    const monthEnd = addLocalMonths(monthStart, 1);
    const periodEnd = now < monthEnd ? now : monthEnd;
    const startIso = monthStart.toISOString();
    const endIso = periodEnd.toISOString();
    if (periodEnd < monthStart) {
      out.push({
        label: monthStart.toLocaleDateString(lc, {
          month: "short",
          year: "2-digit",
        }),
        revenue: 0,
        supplyIntake: 0,
        stockExpense: 0,
        estimatedProfit: 0,
      });
      continue;
    }
    let revenue = 0;
    for (const o of paid) {
      if (o.createdAt >= startIso && o.createdAt < endIso) {
        revenue += reportedOrderRevenue(o);
      }
    }
    let supplyIntake = 0;
    let stockExpense = 0;
    for (const log of stockLogs) {
      if (log.createdAt < startIso || log.createdAt >= endIso) continue;
      const price = priceByItem.get(log.menuItemId as string) ?? 0;
      if (log.type === "manual_addition" && log.change > 0) {
        supplyIntake += log.change * price;
      }
      if (
        (log.type === "sale" ||
          log.type === "staff_consumption" ||
          log.type === "recipe_sale" ||
          log.type === "adjustment") &&
        log.change < 0
      ) {
        stockExpense += Math.abs(log.change) * price;
      }
    }
    revenue = round2(revenue);
    supplyIntake = round2(supplyIntake);
    stockExpense = round2(stockExpense);
    out.push({
      label: monthStart.toLocaleDateString(lc, {
        month: "short",
        year: "2-digit",
      }),
      revenue,
      supplyIntake,
      stockExpense,
      estimatedProfit: round2(revenue - stockExpense),
    });
  }
  return out;
}

function buildLast7DaysPaidRevenueByDay(
  paid: OrderForChart[],
  now: Date,
  lc: string,
): { day: string; revenue: number }[] {
  const today = startLocalDay(now);
  const out: { day: string; revenue: number }[] = [];
  for (let d = 6; d >= 0; d--) {
    const dayStart = addLocalDays(today, -d);
    const dayEnd = addLocalDays(dayStart, 1);
    const s = sumBucketPaid(
      paid,
      dayStart.toISOString(),
      dayEnd.toISOString(),
    );
    out.push({
      day: dayStart.toLocaleDateString(lc, { weekday: "short" }),
      revenue: s.revenue,
    });
  }
  return out;
}

type RevenueOverviewPoint = {
  currentRevenue: number;
  previousRevenue: number;
};

function parseRevenueDayBoundaries(dayBoundariesIso: string[]): string[] {
  if (dayBoundariesIso.length < 3 || dayBoundariesIso.length % 2 === 0) {
    throw new ConvexError(
      "Revenue overview requires an odd number of ordered boundaries",
    );
  }
  const boundaries = dayBoundariesIso.map((value) => String(value).trim());
  for (let index = 0; index < boundaries.length; index += 1) {
    if (!Number.isFinite(Date.parse(boundaries[index]))) {
      throw new ConvexError("Invalid revenue overview date");
    }
    if (index > 0 && boundaries[index] <= boundaries[index - 1]) {
      throw new ConvexError("Revenue overview dates must be ordered");
    }
  }
  return boundaries;
}

function buildRevenueOverview(
  paid: OrderForChart[],
  dayBoundariesIso: string[],
) {
  const boundaries = parseRevenueDayBoundaries(dayBoundariesIso);
  const bucketCount = (boundaries.length - 1) / 2;
  const points: RevenueOverviewPoint[] = [];
  let currentTotal = 0;
  let previousTotal = 0;

  for (let dayIndex = 0; dayIndex < bucketCount; dayIndex += 1) {
    const previous = sumBucketPaid(
      paid,
      boundaries[dayIndex],
      boundaries[dayIndex + 1],
    );
    const current = sumBucketPaid(
      paid,
      boundaries[dayIndex + bucketCount],
      boundaries[dayIndex + bucketCount + 1],
    );
    points.push({
      currentRevenue: current.revenue,
      previousRevenue: previous.revenue,
    });
    currentTotal += current.revenue;
    previousTotal += previous.revenue;
  }

  return {
    currentTotal: round2(currentTotal),
    previousTotal: round2(previousTotal),
    points,
  };
}

export const getRevenueOverview = query({
  args: {
    licenseKey: v.string(),
    dayBoundariesIso: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    const paid = orders
      .filter((order) => order.status === "paid")
      .map((order) => ({
        createdAt: String(order.paidAt ?? "").trim() || order.createdAt,
        total: order.total,
        paymentType: order.paymentType,
        originalTotal: order.originalTotal,
      }));

    return buildRevenueOverview(paid, args.dayBoundariesIso);
  },
});

export const getDashboardStats = query({
  args: {
    licenseKey: v.string(),
    viewPeriod: v.optional(dashboardPeriodValidator),
    anchorDate: v.optional(v.string()),
    locale: v.optional(v.union(v.literal("en"), v.literal("sq"))),
    /** Inclusive start of filter window (ISO), from the client browser local midnight as UTC instant. */
    rangeFromIso: v.optional(v.string()),
    /** Exclusive end of filter window (ISO), start of day after last selected day. */
    rangeToExclusiveIso: v.optional(v.string()),
    /** Start of the last calendar day in the range (ISO), for open-order / status widgets. */
    operationalDayStartIso: v.optional(v.string()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    // Get all orders for this restaurant
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const parsedAnchor = args.anchorDate ? new Date(args.anchorDate) : null;
    const now =
      parsedAnchor && Number.isFinite(parsedAnchor.getTime())
        ? parsedAnchor
        : new Date();
    const starts = localPeriodStarts(now);
    const todayStart = starts.day;

    const rangeFromIso = String(args.rangeFromIso ?? "").trim();
    const rangeToExclusiveIso = String(args.rangeToExclusiveIso ?? "").trim();
    const operationalDayStartIso = String(args.operationalDayStartIso ?? "").trim();
    const useRangeFilter =
      rangeFromIso.length > 0 &&
      rangeToExclusiveIso.length > 0 &&
      rangeToExclusiveIso > rangeFromIso;

    const kpiStartIso = useRangeFilter ? rangeFromIso : starts.day;
    const kpiEndIso = useRangeFilter
      ? rangeToExclusiveIso
      : addLocalDays(new Date(starts.day), 1).toISOString();
    const kpiDurationMs = Math.max(
      1,
      Date.parse(kpiEndIso) - Date.parse(kpiStartIso),
    );
    const kpiDayCount = Math.max(
      1,
      Math.round(kpiDurationMs / 86_400_000),
    );
    const previousKpiStartIso = new Date(
      Date.parse(kpiStartIso) - kpiDurationMs,
    ).toISOString();
    const previousKpiEndIso = kpiStartIso;

    const collectedAt = (o: { createdAt: string; paidAt?: string }) =>
      String(o.paidAt ?? "").trim() || o.createdAt;

    const configuredTargetAmount = Number(
      restaurant.dashboardTargetAmount ?? 0,
    );
    const targetStartMs = Date.parse(
      String(restaurant.dashboardTargetStartAt ?? ""),
    );
    const targetEndMs = Date.parse(
      String(restaurant.dashboardTargetEndAt ?? ""),
    );
    const configuredTargetStartAt = Number.isFinite(targetStartMs)
      ? new Date(targetStartMs).toISOString()
      : null;
    const configuredTargetEndAt = Number.isFinite(targetEndMs)
      ? new Date(targetEndMs).toISOString()
      : null;
    const configuredTargetPeriod =
      restaurant.dashboardTargetPeriod ?? null;
    const hasConfiguredTarget =
      Number.isFinite(configuredTargetAmount) &&
      configuredTargetAmount > 0 &&
      configuredTargetStartAt !== null &&
      configuredTargetEndAt !== null &&
      configuredTargetEndAt > configuredTargetStartAt &&
      configuredTargetPeriod !== null;
    const targetRevenue = hasConfiguredTarget
      ? allOrders.reduce((sum, order) => {
          if (order.status !== "paid") return sum;
          const paidAt = collectedAt(order);
          if (
            paidAt < configuredTargetStartAt! ||
            paidAt >= configuredTargetEndAt!
          ) {
            return sum;
          }
          return sum + Math.max(0, Number(order.total ?? 0));
        }, 0)
      : 0;

    const paidInRange = (at: string) =>
      at >= rangeFromIso && at < rangeToExclusiveIso;

    const lc = chartLocaleTag(args.locale);

    const paidOrdersForCharts = (
      useRangeFilter
        ? allOrders.filter(
            (o) => o.status === "paid" && paidInRange(collectedAt(o)),
          )
        : allOrders.filter((o) => o.status === "paid")
    ) as OrderForChart[];

    const salesChart = buildSalesChartBundle(paidOrdersForCharts, now, lc);

    const paidFrom = (startIso: string) =>
      allOrders.filter(
        (o) => o.status === "paid" && collectedAt(o) >= startIso,
      );

    const periodSummaries = useRangeFilter
      ? (() => {
          const s = summarizePaidOrders(paidOrdersForCharts);
          return {
            day: s,
            week: s,
            month: s,
            year: s,
          };
        })()
      : {
          day: summarizePaidOrders(paidFrom(starts.day)),
          week: summarizePaidOrders(paidFrom(starts.week)),
          month: summarizePaidOrders(paidFrom(starts.month)),
          year: summarizePaidOrders(paidFrom(starts.year)),
        };

    const detailPeriod: DashboardPeriod = args.viewPeriod ?? "day";
    const detailPaid = useRangeFilter
      ? allOrders.filter(
          (o) => o.status === "paid" && paidInRange(collectedAt(o)),
        )
      : paidFrom(starts[detailPeriod]);

    const todayRevenue = periodSummaries.day.revenue;
    const todayPaidCount = periodSummaries.day.paidCount;
    const avgOrderValue = periodSummaries.day.avgOrderValue;
    const kpiCurrentPaid = allOrders.filter((o) => {
      if (o.status !== "paid") return false;
      const at = collectedAt(o);
      return at >= kpiStartIso && at < kpiEndIso;
    });
    const kpiPreviousPaid = allOrders.filter((o) => {
      if (o.status !== "paid") return false;
      const at = collectedAt(o);
      return at >= previousKpiStartIso && at < previousKpiEndIso;
    });
    const currentKpiSummary = summarizePaidOrders(kpiCurrentPaid);
    const previousKpiSummary = summarizePaidOrders(kpiPreviousPaid);
    const kpiSeries = {
      revenue: Array.from({ length: DASHBOARD_KPI_BUCKETS }, () => 0),
      orders: Array.from({ length: DASHBOARD_KPI_BUCKETS }, () => 0),
      bar: Array.from({ length: DASHBOARD_KPI_BUCKETS }, () => 0),
      kitchen: Array.from({ length: DASHBOARD_KPI_BUCKETS }, () => 0),
    };
    const currentKpiOrderIds = new Set(
      kpiCurrentPaid.map((order) => order._id as string),
    );
    for (const order of kpiCurrentPaid) {
      const bucket = kpiBucketIndex(
        collectedAt(order),
        kpiStartIso,
        kpiEndIso,
      );
      if (bucket < 0) continue;
      kpiSeries.revenue[bucket] += order.total;
      kpiSeries.orders[bucket] += 1;
    }

    const openSales = allOrders.filter(
      (o) => o.status !== "paid" && o.status !== "cancelled",
    );
    const openUnpaidTotal = openSales.reduce(
      (sum, o) => sum + Math.max(0, Number(o.total ?? 0)),
      0,
    );
    const paidCirculation = todayRevenue;
    const totalCirculation = paidCirculation + openUnpaidTotal;

    // Filter today's orders (operational widgets) — last day of selected range, or real "today"
    const todayOrders =
      useRangeFilter && operationalDayStartIso.length > 0
        ? allOrders.filter(
            (o) =>
              o.createdAt >= operationalDayStartIso &&
              o.createdAt < rangeToExclusiveIso,
          )
        : allOrders.filter((o) => o.createdAt >= todayStart);

    // Revenue by payment type (selected period)
    const revenueByPaymentType: Record<string, { count: number; total: number }> = {};
    for (const order of detailPaid) {
      const type = order.paymentType ?? "fiscal";
      if (!revenueByPaymentType[type]) {
        revenueByPaymentType[type] = { count: 0, total: 0 };
      }
      revenueByPaymentType[type].count++;
      // For complimentary, use originalTotal for reporting
      const amount =
        type === "complimentary" ? (order.originalTotal ?? 0) : order.total;
      revenueByPaymentType[type].total += amount;
    }

    // Revenue by payment method
    const revenueByMethod: Record<string, { count: number; total: number }> = {};
    for (const order of detailPaid) {
      const method = order.paymentMethod ?? "cash";
      if (!revenueByMethod[method]) {
        revenueByMethod[method] = { count: 0, total: 0 };
      }
      revenueByMethod[method].count++;
      revenueByMethod[method].total += order.total;
    }

    const paymentMix = { cash: 0, card: 0, debt: 0, other: 0 };
    for (const order of detailPaid) {
      const amount = Math.max(0, Number(order.total ?? 0));
      if (order.paymentType === "debt") paymentMix.debt += amount;
      else if (order.paymentMethod === "card") paymentMix.card += amount;
      else if (
        order.paymentMethod === "cash" ||
        order.paymentMethod === undefined
      ) {
        paymentMix.cash += amount;
      } else paymentMix.other += amount;
    }

    // Active tables
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const occupiedTables = tables.filter(
      (t) => t.status === "occupied" || t.status === "bill-printed"
    ).length;
    const reservedTables = tables.filter((t) => t.status === "reserved").length;
    const availableTables = Math.max(
      0,
      tables.length - occupiedTables - reservedTables,
    );
    const activeTables = occupiedTables;
    const totalTables = tables.length;

    // Active orders (not paid, not cancelled)
    const activeOrders = todayOrders.filter(
      (o) => o.status !== "paid" && o.status !== "cancelled"
    );

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    for (const order of todayOrders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
    }

    // Top selling items today
    const itemCounts: Record<
      string,
      { menuItemId: string; name: string; quantity: number; revenue: number }
    > = {};
    let barRevenue = 0;
    let kitchenRevenue = 0;
    let previousBarRevenue = 0;
    let previousKitchenRevenue = 0;
    let voidedItemsInPeriod = 0;
    let totalPreparationMinutes = 0;
    let preparationSampleCount = 0;
    const kitchenOrderIds = new Set<string>();
    const barOrderIds = new Set<string>();
    for (const order of detailPaid) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      for (const item of items) {
        if (item.status === "voided" || item.status === "cancelled") {
          if (
            item.status === "voided" &&
            currentKpiOrderIds.has(order._id as string)
          ) {
            voidedItemsInPeriod += item.quantity;
          }
          continue;
        }
        const sentMs = Date.parse(String(item.sentAt ?? ""));
        const readyMs = Date.parse(String(item.readyAt ?? ""));
        if (
          Number.isFinite(sentMs) &&
          Number.isFinite(readyMs) &&
          readyMs >= sentMs
        ) {
          const minutes = (readyMs - sentMs) / 60_000;
          if (minutes <= 12 * 60) {
            totalPreparationMinutes += minutes;
            preparationSampleCount += 1;
          }
        }
        const itemRevenue = item.price * item.quantity;
        if (item.station === "bar") {
          barOrderIds.add(order._id as string);
        } else {
          kitchenOrderIds.add(order._id as string);
        }
        if (currentKpiOrderIds.has(order._id as string)) {
          const bucket = kpiBucketIndex(
            collectedAt(order),
            kpiStartIso,
            kpiEndIso,
          );
          if (item.station === "bar") {
            barRevenue += itemRevenue;
            if (bucket >= 0) kpiSeries.bar[bucket] += itemRevenue;
          } else {
            kitchenRevenue += itemRevenue;
            if (bucket >= 0) kpiSeries.kitchen[bucket] += itemRevenue;
          }
        }
        const key = item.menuItemId as string;
        if (!itemCounts[key]) {
          itemCounts[key] = {
            menuItemId: key,
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        itemCounts[key].quantity += item.quantity;
        itemCounts[key].revenue += itemRevenue;
      }
    }
    const averagePreparationMinutes =
      preparationSampleCount > 0
        ? totalPreparationMinutes / preparationSampleCount
        : 0;

    for (const order of kpiPreviousPaid) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      for (const item of items) {
        if (item.status === "voided" || item.status === "cancelled") continue;
        const itemRevenue = item.price * item.quantity;
        if (item.station === "bar") previousBarRevenue += itemRevenue;
        else previousKitchenRevenue += itemRevenue;
      }
    }

    // Staff performance today
    const staffPerf: Record<
      string,
      { name: string; orders: number; revenue: number }
    > = {};
    for (const order of detailPaid) {
      const staff = await ctx.db.get(order.staffId);
      const key = order.staffId;
      if (!staffPerf[key]) {
        staffPerf[key] = {
          name: staff?.name ?? "Unknown",
          orders: 0,
          revenue: 0,
        };
      }
      staffPerf[key].orders++;
      staffPerf[key].revenue += order.total;
    }

    const staffPerformance = Object.values(staffPerf).sort(
      (a, b) => b.revenue - a.revenue
    );
    const recentOrderCandidates = allOrders
      .filter((order) => {
        const activityAt =
          order.status === "paid" ? collectedAt(order) : order.createdAt;
        return activityAt >= kpiStartIso && activityAt < kpiEndIso;
      })
      .sort((a, b) => {
        const aAt = a.status === "paid" ? collectedAt(a) : a.createdAt;
        const bAt = b.status === "paid" ? collectedAt(b) : b.createdAt;
        return bAt.localeCompare(aAt);
      })
      .slice(0, 6);
    const recentOrders = await Promise.all(
      recentOrderCandidates.map(async (order) => {
        const [table, staff] = await Promise.all([
          ctx.db.get(order.tableId),
          ctx.db.get(order.staffId),
        ]);
        return {
          id: order._id as string,
          orderNumber: order.orderNumber,
          tableName: table?.name ?? "—",
          staffName: staff?.name ?? "—",
          customerName: order.customerName ?? "",
          status: order.status,
          total:
            order.paymentType === "complimentary"
              ? (order.originalTotal ?? 0)
              : order.total,
          paymentMethod: order.paymentMethod ?? "",
          activityAt:
            order.status === "paid" ? collectedAt(order) : order.createdAt,
        };
      }),
    );

    // ── Fiscal vs Non-Fiscal summary ──
    // Uses fiscalStatus field which reflects both initial fiscal payments
    // and late fiscalization via the Manager button
    const fiscalOrders = detailPaid.filter((o) => o.fiscalStatus === true);
    const nonFiscalOrders = detailPaid.filter((o) => o.fiscalStatus !== true);

    const fiscalSummary = {
      fiscalCount: fiscalOrders.length,
      fiscalTotal: Math.round(
        fiscalOrders.reduce((sum, o) => sum + o.total, 0) * 100
      ) / 100,
      nonFiscalCount: nonFiscalOrders.length,
      nonFiscalTotal: Math.round(
        nonFiscalOrders.reduce((sum, o) => sum + o.total, 0) * 100
      ) / 100,
    };

    const weekDayRevenue = buildLast7DaysPaidRevenueByDay(
      paidOrdersForCharts,
      now,
      lc,
    );

    const menuItems = await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id),
      )
      .collect();
    const menuCategories = await ctx.db
      .query("menuCategories")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id),
      )
      .collect();
    const menuItemById = new Map(
      menuItems.map((item) => [item._id as string, item]),
    );
    const priceByMenuItem = new Map(
      menuItems.map((item) => [item._id as string, item.price]),
    );
    const categoryById = new Map(
      menuCategories.map((category) => [
        category._id as string,
        category,
      ]),
    );
    const fallbackCategoryName =
      args.locale === "sq" ? "Të tjera" : "Other";
    const categorySalesById = new Map<
      string,
      { name: string; color: string; quantity: number; revenue: number }
    >();
    const enrichedItems = Object.values(itemCounts).map((item) => {
      const menuItem = menuItemById.get(item.menuItemId);
      const categoryId = menuItem?.categoryId as string | undefined;
      const category = categoryId ? categoryById.get(categoryId) : undefined;
      const categoryKey = categoryId ?? "__other__";
      const categoryRow = categorySalesById.get(categoryKey) ?? {
        name: category?.name ?? fallbackCategoryName,
        color: category?.color ?? "#64748b",
        quantity: 0,
        revenue: 0,
      };
      categoryRow.quantity += item.quantity;
      categoryRow.revenue += item.revenue;
      categorySalesById.set(categoryKey, categoryRow);

      const recipe = menuItem?.supplyRecipe ?? [];
      let estimatedUnitCost = 0;
      let hasCostEstimate = false;
      for (const recipeLine of recipe) {
        const supplyPrice = priceByMenuItem.get(
          recipeLine.supplyMenuItemId as string,
        );
        if (supplyPrice === undefined || recipeLine.qtyPerUnit <= 0) continue;
        estimatedUnitCost += supplyPrice * recipeLine.qtyPerUnit;
        hasCostEstimate = true;
      }
      const estimatedCost = estimatedUnitCost * item.quantity;
      const estimatedProfit = hasCostEstimate
        ? round2(item.revenue - estimatedCost)
        : null;
      const marginPercent =
        estimatedProfit !== null && item.revenue > 0
          ? round2((estimatedProfit / item.revenue) * 100)
          : null;

      return {
        ...item,
        quantity: Math.round(item.quantity * 1000) / 1000,
        revenue: round2(item.revenue),
        estimatedProfit,
        marginPercent,
      };
    });
    const topItems = enrichedItems
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    const categorySales = [...categorySalesById.values()]
      .map((category) => ({
        ...category,
        quantity: Math.round(category.quantity * 1000) / 1000,
        revenue: round2(category.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const stockLogs = await ctx.db
      .query("stockLogs")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id),
      )
      .collect();

    const liveOrderItemGroups = await Promise.all(
      openSales.map((order) =>
        ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect(),
      ),
    );
    const liveOrderItems = liveOrderItemGroups.flat();
    const liveQueueStatuses = new Set(["sent", "preparing"]);
    let kitchenQueueItems = 0;
    let barQueueItems = 0;
    let readyItems = 0;
    let delayedItems = 0;
    let totalQueueAgeMinutes = 0;
    let agedQueueItems = 0;
    const liveNowMs = Date.now();
    for (const item of liveOrderItems) {
      if (item.status === "voided") voidedItemsInPeriod += item.quantity;
      if (item.status === "ready") readyItems += item.quantity;
      if (!liveQueueStatuses.has(item.status)) continue;
      if (item.station === "bar") barQueueItems += item.quantity;
      else kitchenQueueItems += item.quantity;
      const ageMinutes = Math.max(
        0,
        (liveNowMs - item._creationTime) / 60_000,
      );
      totalQueueAgeMinutes += ageMinutes;
      agedQueueItems += 1;
      if (ageMinutes >= 15) delayedItems += item.quantity;
    }
    const averageQueueAgeMinutes =
      agedQueueItems > 0 ? totalQueueAgeMinutes / agedQueueItems : 0;

    const trackedMenuItems = menuItems.filter((item) => item.trackStock);
    const outOfStockItems = trackedMenuItems.filter(
      (item) => Number(item.currentStock ?? 0) <= 0,
    );
    const lowStockItems = trackedMenuItems.filter((item) => {
      const current = Number(item.currentStock ?? 0);
      const threshold = Number(item.lowStockThreshold ?? 5);
      return current > 0 && current <= threshold;
    });
    const costMovementTypes = new Set([
      "sale",
      "recipe_sale",
      "staff_consumption",
    ]);
    let estimatedStockCost = 0;
    for (const log of stockLogs) {
      if (
        log.createdAt < kpiStartIso ||
        log.createdAt >= kpiEndIso ||
        log.change >= 0 ||
        !costMovementTypes.has(log.type)
      ) {
        continue;
      }
      estimatedStockCost +=
        Math.abs(log.change) *
        (priceByMenuItem.get(log.menuItemId as string) ?? 0);
    }
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id),
      )
      .collect();
    const operatingExpenses = expenses
      .filter(
        (expense) =>
          expense.createdAt >= kpiStartIso &&
          expense.createdAt < kpiEndIso,
      )
      .reduce((sum, expense) => sum + Math.max(0, expense.amount), 0);
    const estimatedProfit =
      currentKpiSummary.revenue - estimatedStockCost - operatingExpenses;
    const marginPercent =
      currentKpiSummary.revenue > 0
        ? (estimatedProfit / currentKpiSummary.revenue) * 100
        : 0;
    const cancelledOrdersInPeriod = allOrders.filter(
      (order) =>
        order.status === "cancelled" &&
        order.createdAt >= kpiStartIso &&
        order.createdAt < kpiEndIso,
    ).length;
    const ordersCreatedInPeriod = allOrders.filter(
      (order) =>
        order.createdAt >= kpiStartIso &&
        order.createdAt < kpiEndIso,
    ).length;
    const cancellationRatePercent =
      ordersCreatedInPeriod > 0
        ? (cancelledOrdersInPeriod / ordersCreatedInPeriod) * 100
        : 0;
    const tableTurnsPerDay =
      totalTables > 0
        ? kpiCurrentPaid.length / totalTables / kpiDayCount
        : 0;
    const dailySalesTarget =
      Number.isFinite(Number(restaurant.dailySalesTarget)) &&
      Number(restaurant.dailySalesTarget) > 0
        ? Number(restaurant.dailySalesTarget)
        : 0;
    const periodSalesTarget = dailySalesTarget * kpiDayCount;

    const supplyProfitChart = buildSupplyProfitLast6Months(
      now,
      paidOrdersForCharts,
      stockLogs,
      menuItems,
      lc,
    );

    let inventoryTotal = 0;
    let inventoryKitchen = 0;
    let inventoryBar = 0;
    let trackedItemCount = 0;
    for (const m of menuItems) {
      if (!m.trackStock || m.currentStock === undefined) continue;
      trackedItemCount += 1;
      const line = (m.currentStock ?? 0) * m.price;
      inventoryTotal += line;
      if (m.station === "bar") inventoryBar += line;
      else inventoryKitchen += line;
    }

    const inventorySnapshot = {
      totalValue: round2(inventoryTotal),
      kitchenValue: round2(inventoryKitchen),
      barValue: round2(inventoryBar),
      trackedItemCount,
    };

    for (const series of Object.values(kpiSeries)) {
      for (let i = 0; i < series.length; i++) {
        series[i] = round2(series[i]);
      }
    }

    return {
      periodSummaries,
      viewPeriod: detailPeriod,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      paidCirculation: Math.round(paidCirculation * 100) / 100,
      openUnpaidTotal: Math.round(openUnpaidTotal * 100) / 100,
      totalCirculation: Math.round(totalCirculation * 100) / 100,
      todayOrderCount: todayOrders.length,
      todayPaidCount,
      dashboardKpis: {
        totalRevenue: currentKpiSummary.revenue,
        previousRevenue: previousKpiSummary.revenue,
        totalOrders: currentKpiSummary.paidCount,
        previousOrders: previousKpiSummary.paidCount,
        barRevenue: round2(barRevenue),
        previousBarRevenue: round2(previousBarRevenue),
        kitchenRevenue: round2(kitchenRevenue),
        previousKitchenRevenue: round2(previousKitchenRevenue),
        series: kpiSeries,
      },
      enterpriseOverview: {
        liveOperations: {
          activeTables,
          totalTables,
          availableTables,
          occupiedTables,
          reservedTables,
          kitchenOrders: kitchenOrderIds.size,
          barOrders: barOrderIds.size,
          activeOrders: openSales.length,
          kitchenQueueItems: Math.round(kitchenQueueItems),
          barQueueItems: Math.round(barQueueItems),
          readyItems: Math.round(readyItems),
          delayedItems: Math.round(delayedItems),
          averageQueueAgeMinutes: round2(averageQueueAgeMinutes),
        },
        targetPulse: {
          amount: hasConfiguredTarget
            ? round2(configuredTargetAmount)
            : 0,
          currentRevenue: round2(targetRevenue),
          startAt: hasConfiguredTarget
            ? configuredTargetStartAt
            : null,
          endAt: hasConfiguredTarget ? configuredTargetEndAt : null,
          period: hasConfiguredTarget
            ? configuredTargetPeriod
            : null,
        },
        profitability: {
          revenue: currentKpiSummary.revenue,
          estimatedStockCost: round2(estimatedStockCost),
          operatingExpenses: round2(operatingExpenses),
          estimatedProfit: round2(estimatedProfit),
          marginPercent: round2(marginPercent),
        },
        performance: {
          averageOrderValue: currentKpiSummary.avgOrderValue,
          previousAverageOrderValue: previousKpiSummary.avgOrderValue,
          averagePreparationMinutes: round2(averagePreparationMinutes),
          preparationSampleCount,
          tableTurnsPerDay: round2(tableTurnsPerDay),
          cancellationRatePercent: round2(cancellationRatePercent),
          dailySalesTarget: round2(dailySalesTarget),
          periodSalesTarget: round2(periodSalesTarget),
        },
        paymentMix: {
          cash: round2(paymentMix.cash),
          card: round2(paymentMix.card),
          debt: round2(paymentMix.debt),
          other: round2(paymentMix.other),
        },
        smartAlerts: {
          outOfStockCount: outOfStockItems.length,
          outOfStockNames: outOfStockItems
            .slice(0, 3)
            .map((item) => item.name),
          outOfStockItems: outOfStockItems.slice(0, 3).map((item) => ({
            id: item._id as string,
            name: item.name,
            currentStock: round2(Number(item.currentStock ?? 0)),
            lowStockThreshold: round2(
              Number(item.lowStockThreshold ?? 0),
            ),
            stockUnit: item.stockUnit ?? "pc",
            imageUrl: null,
          })),
          lowStockCount: lowStockItems.length,
          lowStockNames: lowStockItems
            .slice(0, 3)
            .map((item) => item.name),
          lowStockItems: lowStockItems.slice(0, 3).map((item) => ({
            id: item._id as string,
            name: item.name,
            currentStock: round2(Number(item.currentStock ?? 0)),
            lowStockThreshold: round2(
              Number(item.lowStockThreshold ?? 0),
            ),
            stockUnit: item.stockUnit ?? "pc",
            imageUrl: null,
          })),
          delayedItems: Math.round(delayedItems),
          cancelledOrders: cancelledOrdersInPeriod,
          voidedItems: Math.round(voidedItemsInPeriod),
        },
      },
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      activeOrders: activeOrders.length,
      activeTables,
      totalTables,
      revenueByPaymentType,
      revenueByMethod,
      ordersByStatus,
      topItems,
      categorySales,
      staffPerformance,
      recentOrders,
      fiscalSummary,
      salesChart,
      weekDayRevenue,
      supplyProfitChart,
      inventorySnapshot,
    };
  },
});

export const updateDailySalesTarget = mutation({
  args: {
    licenseKey: v.string(),
    dailyTarget: v.number(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (!Number.isFinite(args.dailyTarget) || args.dailyTarget < 0) {
      throw new ConvexError(
        "Daily sales target must be zero or greater.",
      );
    }
    await ctx.db.patch(restaurant._id, {
      dailySalesTarget:
        args.dailyTarget > 0 ? round2(args.dailyTarget) : 0,
    });
    return { ok: true as const };
  },
});

export const updateTargetPulse = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.string(),
    amount: v.number(),
    startAt: v.string(),
    endAt: v.string(),
    period: dashboardTargetPeriodValidator,
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const startMs = Date.parse(args.startAt);
    const endMs = Date.parse(args.endAt);
    if (!Number.isFinite(args.amount) || args.amount <= 0) {
      throw new ConvexError("Target amount must be greater than zero.");
    }
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs
    ) {
      throw new ConvexError("Target dates are invalid.");
    }

    if (args.staffId !== "local-admin") {
      let admin: Doc<"staff"> | null = null;
      try {
        admin = await ctx.db.get(args.staffId as Id<"staff">);
      } catch {
        admin = null;
      }
      if (
        !admin ||
        admin.restaurantId !== restaurant._id ||
        !admin.isActive ||
        admin.role !== "admin"
      ) {
        throw new ConvexError("Only an active admin can update Target Pulse.");
      }
    }

    await ctx.db.patch(restaurant._id, {
      dashboardTargetAmount: round2(args.amount),
      dashboardTargetStartAt: new Date(startMs).toISOString(),
      dashboardTargetEndAt: new Date(endMs).toISOString(),
      dashboardTargetPeriod: args.period,
    });
    return { ok: true as const };
  },
});

export const getReportSchedules = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    return {
      venueName: restaurant.name,
      schedules: Array.isArray(restaurant.dashboardReportSchedules)
        ? restaurant.dashboardReportSchedules
        : [],
    };
  },
});

export const saveReportSchedules = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.string(),
    schedules: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (args.staffId !== "local-admin") {
      let admin: Doc<"staff"> | null = null;
      try {
        admin = await ctx.db.get(args.staffId as Id<"staff">);
      } catch {
        admin = null;
      }
      if (
        !admin ||
        admin.restaurantId !== restaurant._id ||
        !admin.isActive ||
        admin.role !== "admin"
      ) {
        throw new ConvexError("Only an active admin can update report schedules.");
      }
    }
    await ctx.db.patch(restaurant._id, {
      dashboardReportSchedules: args.schedules,
    });
    return { ok: true as const, schedules: args.schedules };
  },
});

export const markReportSchedulesSent = mutation({
  args: {
    licenseKey: v.string(),
    sentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const sent = new Set(args.sentIds);
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const current = Array.isArray(restaurant.dashboardReportSchedules)
      ? restaurant.dashboardReportSchedules
      : [];
    const schedules = current.map((item) => {
      if (!item || typeof item !== "object") return item;
      const row = item as { id?: string };
      if (!row.id || !sent.has(String(row.id))) return item;
      return { ...row, lastSentYmd: todayYmd };
    });
    await ctx.db.patch(restaurant._id, {
      dashboardReportSchedules: schedules,
    });
    return { ok: true as const, schedules };
  },
});

// ── Z-Report (End of Day) ───────────────────────────

export const getZReport = query({
  args: {
    licenseKey: v.string(),
    date: v.optional(v.string()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    // Determine date range
    const targetDate = args.date ? new Date(args.date) : new Date();
    const dayStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    ).toISOString();
    const dayEnd = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate() + 1
    ).toISOString();

    // All orders for the day
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const dayOrders = allOrders.filter(
      (o) => o.createdAt >= dayStart && o.createdAt < dayEnd
    );

    const paidOrders = dayOrders.filter((o) => o.status === "paid");
    const cancelledOrders = dayOrders.filter((o) => o.status === "cancelled");

    // ── Station revenue breakdown (bar vs kitchen) ──
    let barRevenue = 0;
    let kitchenRevenue = 0;

    // Also collect voided data and top items in same loop
    let voidedCount = 0;
    let voidedValue = 0;
    const itemCounts: Record<
      string,
      { name: string; quantity: number; revenue: number; station?: string }
    > = {};

    for (const order of dayOrders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      for (const item of items) {
        if (item.status === "voided") {
          voidedCount += item.quantity;
          voidedValue += item.price * item.quantity;
          continue;
        }
        if (item.status === "cancelled") continue;

        // Only count items from paid orders for station revenue
        if (order.status === "paid") {
          const itemTotal = item.price * item.quantity;
          if (item.station === "bar") {
            barRevenue += itemTotal;
          } else {
            // Default to kitchen
            kitchenRevenue += itemTotal;
          }

          // Track item sales
          const key = item.menuItemId as string;
          if (!itemCounts[key]) {
            itemCounts[key] = {
              name: item.name,
              quantity: 0,
              revenue: 0,
              station: item.station,
            };
          }
          itemCounts[key].quantity += item.quantity;
          itemCounts[key].revenue += itemTotal;
        }
      }
    }

    // Round station totals
    barRevenue = Math.round(barRevenue * 100) / 100;
    kitchenRevenue = Math.round(kitchenRevenue * 100) / 100;
    const grossRevenue = Math.round((barRevenue + kitchenRevenue) * 100) / 100;

    // ── Deductions ──
    // Card payments
    const cardOrders = paidOrders.filter(
      (o) => o.paymentMethod === "card" && o.paymentType !== "complimentary"
    );
    const cardTotal = Math.round(
      cardOrders.reduce((sum, o) => sum + o.total, 0) * 100
    ) / 100;

    // Debt orders
    const debtOrders = paidOrders.filter((o) => o.paymentType === "debt");
    const debtTotal = Math.round(
      debtOrders.reduce((sum, o) => sum + o.total, 0) * 100
    ) / 100;

    // Complimentary
    const compOrders = paidOrders.filter(
      (o) => o.paymentType === "complimentary"
    );
    const complimentaryTotal = Math.round(
      compOrders.reduce((sum, o) => sum + (o.originalTotal ?? 0), 0) * 100
    ) / 100;

    // Waste = cancelled orders' total
    const wasteTotal = Math.round(
      cancelledOrders.reduce((sum, o) => sum + o.total, 0) * 100
    ) / 100;

    // Voids
    voidedValue = Math.round(voidedValue * 100) / 100;

    // Cash to hand over:
    // Gross Revenue - Card - Debt - Complimentary - Waste - Voids
    // (cash expenses is added at close time by admin)
    const totalToHandOver = Math.round(
      (grossRevenue - cardTotal - debtTotal - complimentaryTotal - wasteTotal - voidedValue) * 100
    ) / 100;

    // ── Payment type breakdown ──
    const paymentTypeLabels: Record<string, string> = {
      fiscal: "Fiscal Receipt",
      non_fiscal: "Non-Fiscal Receipt",
      no_receipt: "No Receipt",
      debt: "Debt / Account",
      complimentary: "On the House",
    };
    const ptMap: Record<string, { count: number; total: number }> = {};
    for (const order of paidOrders) {
      const type = order.paymentType ?? "fiscal";
      if (!ptMap[type]) ptMap[type] = { count: 0, total: 0 };
      ptMap[type].count++;
      ptMap[type].total +=
        type === "complimentary" ? (order.originalTotal ?? 0) : order.total;
    }
    const byPaymentType = Object.entries(ptMap).map(([type, data]) => ({
      type,
      label: paymentTypeLabels[type] ?? type,
      count: data.count,
      total: Math.round(data.total * 100) / 100,
    }));

    // ── Payment method breakdown ──
    const pmMap: Record<string, { count: number; total: number }> = {};
    for (const order of paidOrders) {
      const method = order.paymentMethod ?? "cash";
      if (!pmMap[method]) pmMap[method] = { count: 0, total: 0 };
      pmMap[method].count++;
      pmMap[method].total += order.total;
    }
    const byPaymentMethod = Object.entries(pmMap).map(([method, data]) => ({
      method,
      count: data.count,
      total: Math.round(data.total * 100) / 100,
    }));

    // ── Debt details ──
    const debtDetails = await Promise.all(
      debtOrders.map(async (o) => {
        const table = await ctx.db.get(o.tableId);
        return {
          orderNumber: o.orderNumber,
          customerName: o.customerName ?? "Unknown",
          total: o.total,
          tableName: table?.name ?? "Unknown",
        };
      })
    );

    // ── Top items ──
    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 15);

    // ── Staff breakdown (paid + open tickets, same idea as floor plan) ──
    // Exclude cancelled only so "Active Shifts" shows live table totals before payment.
    const staffMap: Record<
      string,
      {
        staffId: string;
        name: string;
        orders: number;
        revenue: number;
        paidCash: number;
        paidCard: number;
        paidDebt: number;
        paidComplimentary: number;
      }
    > = {};
    for (const order of dayOrders) {
      if (order.status === "cancelled") continue;
      const staff = await ctx.db.get(order.staffId);
      const key = order.staffId as string;
      if (!staffMap[key]) {
        staffMap[key] = {
          staffId: key,
          name: staff?.name ?? "Unknown",
          orders: 0,
          revenue: 0,
          paidCash: 0,
          paidCard: 0,
          paidDebt: 0,
          paidComplimentary: 0,
        };
      }
      staffMap[key].orders++;
      staffMap[key].revenue += order.total;

      if (order.status === "paid") {
        const pt = order.paymentType ?? "fiscal";
        const pm = order.paymentMethod ?? "cash";
        const t = order.total;
        if (pt === "debt") {
          staffMap[key].paidDebt += t;
        } else if (pt === "complimentary") {
          staffMap[key].paidComplimentary += order.originalTotal ?? t;
        } else if (pm === "card") {
          staffMap[key].paidCard += t;
        } else {
          staffMap[key].paidCash += t;
        }
      }
    }
    const staffBreakdown = Object.values(staffMap)
      .map((s) => ({
        staffId: s.staffId,
        name: s.name,
        orders: s.orders,
        revenue: Math.round(s.revenue * 100) / 100,
        paidCash: Math.round(s.paidCash * 100) / 100,
        paidCard: Math.round(s.paidCard * 100) / 100,
        paidDebt: Math.round(s.paidDebt * 100) / 100,
        paidComplimentary: Math.round(s.paidComplimentary * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── Shift data ──
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    const dayShifts = shifts.filter(
      (s) => s.clockIn >= dayStart && s.clockIn < dayEnd
    );
    const shiftDetails = await Promise.all(
      dayShifts.map(async (s) => {
        const staff = await ctx.db.get(s.staffId);
        return {
          staffId: s.staffId,
          shiftId: s._id,
          staffName: staff?.name ?? "Unknown",
          staffRole: staff?.role ?? "waiter",
          clockIn: s.clockIn,
          clockOut: s.clockOut ?? null,
          openingCash: s.openingCash ?? 0,
        };
      })
    );

    // ── Z-Number (sequential) ──
    const existingReports = await ctx.db
      .query("zReports")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    const nextZNumber = existingReports.length + 1;

    // Revenue totals
    const totalRevenue = Math.round(
      paidOrders.reduce((sum, o) => sum + o.total, 0) * 100
    ) / 100;
    const totalSubtotal = Math.round(
      paidOrders.reduce((sum, o) => sum + o.subtotal, 0) * 100
    ) / 100;
    const totalTax = Math.round(
      paidOrders.reduce((sum, o) => sum + o.tax, 0) * 100
    ) / 100;

    // Find earliest and latest shift times for the day
    const earliestShift = dayShifts.length > 0
      ? dayShifts.reduce((min, s) => (s.clockIn < min ? s.clockIn : min), dayShifts[0].clockIn)
      : dayStart;
    const latestShift = dayShifts.length > 0
      ? dayShifts.reduce((max, s) => {
          const end = s.clockOut ?? new Date().toISOString();
          return end > max ? end : max;
        }, dayShifts[0].clockIn)
      : new Date().toISOString();

    // Sum opening cash from all open shifts for the day
    let totalOpeningCash = 0;
    for (const s of dayShifts) {
      if (s.openingCash) {
        totalOpeningCash += s.openingCash;
      }
    }

    return {
      date: dayStart,
      restaurantName: restaurant.name,
      currency: restaurant.currency,
      zNumber: nextZNumber,
      shiftStart: earliestShift,
      shiftEnd: latestShift,
      // Revenue by station
      barRevenue,
      kitchenRevenue,
      grossRevenue,
      // Deductions
      cardTotal,
      debtTotal,
      complimentaryTotal,
      wasteTotal,
      voidsTotal: voidedValue,
      // Final
      totalToHandOver,
      // Opening cash (float)
      openingCash: totalOpeningCash,
      // Legacy totals
      totalOrders: dayOrders.length,
      paidOrders: paidOrders.length,
      cancelledOrders: cancelledOrders.length,
      totalRevenue,
      totalSubtotal,
      totalTax,
      // Breakdowns
      byPaymentType,
      byPaymentMethod,
      voidedCount,
      voidedValue,
      complimentaryCount: compOrders.length,
      debtCount: debtOrders.length,
      debtDetails,
      topItems,
      staffBreakdown,
      shiftDetails,
    };
  },
});

// ── Past Z-Reports (shift history) ─────────────────

export const getZReportHistory = query({
  args: {
    licenseKey: v.string(),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const reports = await ctx.db
      .query("zReports")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .order("desc")
      .take(50);
    return reports;
  },
});

// ── Close Day (Z-Report) ────────────────────────────

export const closeDay = mutation({
  args: {
    licenseKey: v.string(),
    /** Convex staff id, or `local-admin` when only device PIN exists client-side */
    staffId: v.string(),
    staffName: v.string(),
    /** SHA-256 hex of PIN; authorizes close when session id is waiter or local-admin */
    pinHash: v.optional(v.string()),
    cashExpenses: v.number(),
    // Full report data to persist
    reportData: v.object({
      zNumber: v.number(),
      barRevenue: v.number(),
      kitchenRevenue: v.number(),
      grossRevenue: v.number(),
      cardTotal: v.number(),
      debtTotal: v.number(),
      complimentaryTotal: v.number(),
      wasteTotal: v.number(),
      voidsTotal: v.number(),
      totalToHandOver: v.number(),
      totalOrders: v.number(),
      paidOrders: v.number(),
      cancelledOrders: v.number(),
      shiftStart: v.string(),
      shiftEnd: v.string(),
      staffBreakdown: v.array(
        v.object({
          staffName: v.string(),
          orders: v.number(),
          revenue: v.number(),
        })
      ),
      shiftDetails: v.array(
        v.object({
          staffName: v.string(),
          clockIn: v.string(),
          clockOut: v.string(),
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const allStaff = await ctx.db
      .query("staff")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    let authorizer = null as (typeof allStaff)[number] | null;
    const pinHash = args.pinHash?.trim() ?? "";
    if (pinHash.length >= 64) {
      authorizer =
        allStaff.find(
          (s) =>
            s.isActive &&
            (s.role === "admin" || s.role === "manager") &&
            s.pinHash === pinHash
        ) ?? null;
    }

    if (!authorizer && args.staffId !== "local-admin") {
      try {
        const st = await ctx.db.get(args.staffId as Id<"staff">);
        if (
          st &&
          st.restaurantId === restaurant._id &&
          st.isActive &&
          (st.role === "admin" || st.role === "manager")
        ) {
          authorizer = st;
        }
      } catch {
        // invalid staff id
      }
    }

    if (!authorizer) {
      throw new ConvexError({
        message:
          "Only admin or manager can close the day. Enter an admin/manager PIN registered on staff, or sign in as admin.",
        code: "FORBIDDEN",
      });
    }

    const now = new Date().toISOString();
    const rd = args.reportData;

    // Gather opening cash from current open shifts for reconciliation
    const openShifts = await ctx.db
      .query("shifts")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    // Sum opening cash from all shifts that are still open (about to be closed)
    let totalOpeningCash = 0;
    for (const shift of openShifts) {
      if (!shift.clockOut && shift.openingCash) {
        totalOpeningCash += shift.openingCash;
      }
    }

    // Recalculate totalToHandOver with cash expenses factored in
    const finalHandOver = Math.round(
      (rd.totalToHandOver - args.cashExpenses) * 100
    ) / 100;

    // Save Z-Report to history
    await ctx.db.insert("zReports", {
      restaurantId: restaurant._id,
      zNumber: rd.zNumber,
      closedByStaffId: authorizer._id,
      closedByStaffName: authorizer.name,
      barRevenue: rd.barRevenue,
      kitchenRevenue: rd.kitchenRevenue,
      grossRevenue: rd.grossRevenue,
      cardTotal: rd.cardTotal,
      debtTotal: rd.debtTotal,
      complimentaryTotal: rd.complimentaryTotal,
      wasteTotal: rd.wasteTotal,
      voidsTotal: rd.voidsTotal,
      cashExpenses: args.cashExpenses,
      totalToHandOver: finalHandOver,
      openingCash: totalOpeningCash > 0 ? totalOpeningCash : undefined,
      totalOrders: rd.totalOrders,
      paidOrders: rd.paidOrders,
      cancelledOrders: rd.cancelledOrders,
      shiftStart: rd.shiftStart,
      shiftEnd: rd.shiftEnd,
      staffBreakdown: rd.staffBreakdown,
      shiftDetails: rd.shiftDetails,
      createdAt: now,
    });

    // Audit log
    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: authorizer._id,
      staffName: authorizer.name,
      action: "day_close",
      details: `Z-Report #${String(rd.zNumber).padStart(3, "0")} closed. Gross: $${rd.grossRevenue.toFixed(2)}, Deductions: Card $${rd.cardTotal.toFixed(2)}, Debt $${rd.debtTotal.toFixed(2)}, Comp $${rd.complimentaryTotal.toFixed(2)}, Waste $${rd.wasteTotal.toFixed(2)}, Voids $${rd.voidsTotal.toFixed(2)}, Expenses $${args.cashExpenses.toFixed(2)}. Total to hand over: $${finalHandOver.toFixed(2)}`,
      createdAt: now,
    });

    // Close all open shifts
    for (const shift of openShifts) {
      if (!shift.clockOut) {
        await ctx.db.patch(shift._id, { clockOut: now });
      }
    }

    // Finalize uncleared expenses & staff consumption for the whole venue (daily close)
    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    for (const expense of allExpenses) {
      if (!expense.cleared) {
        await ctx.db.patch(expense._id, { cleared: true });
      }
    }

    const allConsumption = await ctx.db
      .query("staffConsumption")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    for (const entry of allConsumption) {
      if (!entry.cleared) {
        await ctx.db.patch(entry._id, { cleared: true });
      }
    }

    return { zNumber: rd.zNumber, totalToHandOver: finalHandOver };
  },
});

// ── Audit Logs Query ────────────────────────────────

export const getAuditLogs = query({
  args: {
    licenseKey: v.string(),
    limit: v.optional(v.number()),
    staffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .order("desc")
      .take(args.limit ?? 100);

    return logs;
  },
});
