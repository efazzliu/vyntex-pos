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

type DashboardPeriod = "day" | "week" | "month" | "year";

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
): { current: ChartBucket[]; previous: ChartBucket[] } {
  const today = startLocalDay(now);
  const current: ChartBucket[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addLocalDays(today, -i);
    const next = addLocalDays(day, 1);
    const s = sumBucketPaid(paid, day.toISOString(), next.toISOString());
    current.push({
      label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...s,
    });
  }
  const previous: ChartBucket[] = [];
  for (let i = 27; i >= 14; i--) {
    const day = addLocalDays(today, -i);
    const next = addLocalDays(day, 1);
    const s = sumBucketPaid(paid, day.toISOString(), next.toISOString());
    previous.push({
      label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...s,
    });
  }
  return { current, previous };
}

function buildSalesChartWeek(
  paid: OrderForChart[],
  now: Date,
): { current: ChartBucket[]; previous: ChartBucket[] } {
  const thisWeekStart = startLocalWeekMonday(now);
  const current: ChartBucket[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = addLocalDays(thisWeekStart, -7 * i);
    const weekEnd = addLocalDays(weekStart, 7);
    const s = sumBucketPaid(paid, weekStart.toISOString(), weekEnd.toISOString());
    current.push({
      label: weekStart.toLocaleDateString("en-US", {
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
      label: weekStart.toLocaleDateString("en-US", {
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
): { current: ChartBucket[]; previous: ChartBucket[] } {
  const curMonth = startLocalMonth(now);
  const current: ChartBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = addLocalMonths(curMonth, -i);
    const monthEnd = addLocalMonths(monthStart, 1);
    const s = sumBucketPaid(paid, monthStart.toISOString(), monthEnd.toISOString());
    current.push({
      label: monthStart.toLocaleDateString("en-US", {
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
      label: monthStart.toLocaleDateString("en-US", {
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
      label: monthStart.toLocaleDateString("en-US", {
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
        label: monthStart.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        ...s,
      });
    }
  }
  return { current, previous };
}

function buildSalesChartBundle(paid: OrderForChart[], now: Date) {
  return {
    day: buildSalesChartDay(paid, now),
    week: buildSalesChartWeek(paid, now),
    month: buildSalesChartMonth(paid, now),
    all: buildSalesChartAllTime(paid, now),
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
        label: monthStart.toLocaleDateString("en-US", {
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
      label: monthStart.toLocaleDateString("en-US", {
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
      day: dayStart.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: s.revenue,
    });
  }
  return out;
}

export const getDashboardStats = query({
  args: {
    licenseKey: v.string(),
    viewPeriod: v.optional(dashboardPeriodValidator),
    anchorDate: v.optional(v.string()),
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

    const allPaidOrders = allOrders.filter((o) => o.status === "paid");
    const salesChart = buildSalesChartBundle(
      allPaidOrders as OrderForChart[],
      now,
    );

    const paidFrom = (startIso: string) =>
      allOrders.filter((o) => o.status === "paid" && o.createdAt >= startIso);

    const periodSummaries = {
      day: summarizePaidOrders(paidFrom(starts.day)),
      week: summarizePaidOrders(paidFrom(starts.week)),
      month: summarizePaidOrders(paidFrom(starts.month)),
      year: summarizePaidOrders(paidFrom(starts.year)),
    };

    const detailPeriod: DashboardPeriod = args.viewPeriod ?? "day";
    const detailPaid = paidFrom(starts[detailPeriod]);

    const todayRevenue = periodSummaries.day.revenue;
    const todayPaidCount = periodSummaries.day.paidCount;
    const avgOrderValue = periodSummaries.day.avgOrderValue;

    // Filter today's orders (operational widgets)
    const todayOrders = allOrders.filter((o) => o.createdAt >= todayStart);

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

    // Active tables
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const activeTables = tables.filter(
      (t) => t.status === "occupied" || t.status === "bill-printed"
    ).length;
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
      { name: string; quantity: number; revenue: number }
    > = {};
    for (const order of detailPaid) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      for (const item of items) {
        if (item.status === "voided" || item.status === "cancelled") continue;
        const key = item.menuItemId;
        if (!itemCounts[key]) {
          itemCounts[key] = { name: item.name, quantity: 0, revenue: 0 };
        }
        itemCounts[key].quantity += item.quantity;
        itemCounts[key].revenue += item.price * item.quantity;
      }
    }

    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

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
      allPaidOrders as OrderForChart[],
      now,
    );

    const menuItems = await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id),
      )
      .collect();

    const stockLogs = await ctx.db
      .query("stockLogs")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id),
      )
      .collect();

    const supplyProfitChart = buildSupplyProfitLast6Months(
      now,
      allPaidOrders as OrderForChart[],
      stockLogs,
      menuItems,
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

    return {
      periodSummaries,
      viewPeriod: detailPeriod,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      todayOrderCount: todayOrders.length,
      todayPaidCount,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      activeOrders: activeOrders.length,
      activeTables,
      totalTables,
      revenueByPaymentType,
      revenueByMethod,
      ordersByStatus,
      topItems,
      staffPerformance,
      fiscalSummary,
      salesChart,
      weekDayRevenue,
      supplyProfitChart,
      inventorySnapshot,
    };
  },
});

// ── Z-Report (End of Day) ───────────────────────────

export const getZReport = query({
  args: {
    licenseKey: v.string(),
    date: v.optional(v.string()),
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
  args: { licenseKey: v.string() },
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
