import { supabase } from "@/lib/supabase.ts";
import {
  assertNoPgError,
  isMissingPgColumnError,
  isMissingSupabaseTableError,
} from "./db-errors.ts";
import {
  clearRestaurantCache,
  getRestaurantByLicense,
} from "./restaurant.ts";
import { saleFloorTableId } from "./mappers.ts";
import { getTables, isOpenSaleStatus } from "./tables-ops.ts";
import { isLocalDevicePosAdmin, uuidOrNull } from "./uuid.ts";
import { normalizeReportSchedules } from "@/lib/dashboard-custom-reports.ts";
import { assertStaffPermission } from "./staff-auth.ts";
import {
  effectiveLowStockThreshold,
  parsePosStockRules,
  stockRulesFromRestaurantRow,
} from "@/lib/pos-order-availability.ts";

const SALE_ITEMS_IN_CHUNK = 120;

type DashboardSaleItemRow = {
  id: string;
  saleId: string;
  menuItemId?: string;
  name: string;
  price: number | string;
  quantity: number | string;
  status: string;
  station?: "kitchen" | "bar";
  createdAt: string;
  sentAt?: string;
  readyAt?: string;
};

async function fetchSaleItemsForSaleIds(
  saleIds: string[],
): Promise<DashboardSaleItemRow[]> {
  if (saleIds.length === 0) return [];
  const rows: DashboardSaleItemRow[] = [];
  for (let i = 0; i < saleIds.length; i += SALE_ITEMS_IN_CHUNK) {
    const chunk = saleIds.slice(i, i + SALE_ITEMS_IN_CHUNK);
    const full = await supabase
      .from("sale_items")
      .select("id, sale_id, menu_item_id, name, price, quantity, status, station, created_at")
      .in("sale_id", chunk);
    let data = full.data as unknown[] | null;
    let error = full.error;
    if (
      error &&
      (isMissingPgColumnError(error.message, "station") ||
        isMissingPgColumnError(error.message, "menu_item_id"))
    ) {
      const fallback = await supabase
        .from("sale_items")
        .select("id, sale_id, name, price, quantity, status, created_at")
        .in("sale_id", chunk);
      data = fallback.data as unknown[] | null;
      error = fallback.error;
    }
    assertNoPgError("Dashboard sale lines", error);
    const timingById = new Map<
      string,
      { sentAt?: string; readyAt?: string }
    >();
    const timingResult = await supabase
      .from("sale_items")
      .select("id, sent_at, ready_at")
      .in("sale_id", chunk);
    if (timingResult.error) {
      const message = String(timingResult.error.message ?? "");
      if (
        !isMissingPgColumnError(message, "sent_at") &&
        !isMissingPgColumnError(message, "ready_at")
      ) {
        assertNoPgError("Dashboard sale-line timings", timingResult.error);
      }
    } else {
      for (const timing of timingResult.data ?? []) {
        const id = String(timing.id ?? "");
        if (!id) continue;
        const sentAt = String(timing.sent_at ?? "").trim() || undefined;
        const readyAt = String(timing.ready_at ?? "").trim() || undefined;
        timingById.set(id, { sentAt, readyAt });
      }
    }
    for (const raw of data ?? []) {
      const r = raw as Record<string, unknown>;
      const id = String(r.id ?? "");
      const timing = timingById.get(id);
      rows.push({
        id,
        saleId: String(r.sale_id ?? ""),
        menuItemId: r.menu_item_id ? String(r.menu_item_id) : undefined,
        name: String(r.name ?? ""),
        price: Number(r.price ?? 0),
        quantity: Number(r.quantity ?? 0),
        status: String(r.status ?? ""),
        station:
          r.station === "bar" || r.station === "kitchen"
            ? r.station
            : undefined,
        createdAt: String(r.created_at ?? ""),
        sentAt: timing?.sentAt,
        readyAt: timing?.readyAt,
      });
    }
  }
  return rows;
}

export type DashboardViewPeriod = "day" | "week" | "month" | "year";
/** Passed from POS UI language for chart axis labels and weekday names. */
export type DashboardLocaleOption = "en" | "sq";
export type DashboardTargetPeriod = "month" | "six_months" | "custom";

function normalizeDashboardTargetPeriod(
  value: unknown,
): DashboardTargetPeriod | null {
  return value === "month" ||
    value === "six_months" ||
    value === "custom"
    ? value
    : null;
}

function normalizeIsoInstant(value: unknown): string | null {
  const timestamp = Date.parse(String(value ?? "").trim());
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function chartLocaleTag(locale?: DashboardLocaleOption): string {
  return locale === "sq" ? "sq-AL" : "en-US";
}

function localPeriodStarts(now: Date): Record<DashboardViewPeriod, string> {
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

function summarizePaid(
  paid: { total: number | string }[],
): { revenue: number; paidCount: number; avgOrderValue: number } {
  const revenue = paid.reduce((s, o) => s + Number(o.total), 0);
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

/** When the bill was collected — close/pay time, not when the table first opened. */
function saleCollectedAtIso(o: {
  created_at?: unknown;
  paid_at?: unknown;
}): string {
  const paidAt = String(o.paid_at ?? "").trim();
  if (paidAt) return paidAt;
  return String(o.created_at ?? "");
}

type PaidRowChart = { created_at: string; total: number | string };

function reportedSaleTotal(o: PaidRowChart): number {
  return Number(o.total ?? 0);
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
type VisitorHourBucket = { hour: number; count: number };
type VisitorHeatmap = { dayLabels: string[]; matrix24: number[][] };
type FiscalTrendBucket = { label: string; fiscal: number; nonFiscal: number };

function sumBucketPaidSb(
  paid: PaidRowChart[],
  startIso: string,
  endIso: string,
): { revenue: number; orders: number } {
  let revenue = 0;
  let orders = 0;
  for (const o of paid) {
    const t = String(o.created_at);
    if (t >= startIso && t < endIso) {
      revenue += reportedSaleTotal(o);
      orders += 1;
    }
  }
  return { revenue: round2(revenue), orders };
}

function buildSalesChartDay(
  paid: PaidRowChart[],
  now: Date,
  lc: string,
): { current: ChartBucket[]; previous: ChartBucket[] } {
  const today = startLocalDay(now);
  const current: ChartBucket[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addLocalDays(today, -i);
    const next = addLocalDays(day, 1);
    const s = sumBucketPaidSb(paid, day.toISOString(), next.toISOString());
    current.push({
      label: day.toLocaleDateString(lc, { month: "short", day: "numeric" }),
      ...s,
    });
  }
  const previous: ChartBucket[] = [];
  for (let i = 27; i >= 14; i--) {
    const day = addLocalDays(today, -i);
    const next = addLocalDays(day, 1);
    const s = sumBucketPaidSb(paid, day.toISOString(), next.toISOString());
    previous.push({
      label: day.toLocaleDateString(lc, { month: "short", day: "numeric" }),
      ...s,
    });
  }
  return { current, previous };
}

function buildSalesChartWeek(
  paid: PaidRowChart[],
  now: Date,
  lc: string,
): { current: ChartBucket[]; previous: ChartBucket[] } {
  const thisWeekStart = startLocalWeekMonday(now);
  const current: ChartBucket[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = addLocalDays(thisWeekStart, -7 * i);
    const weekEnd = addLocalDays(weekStart, 7);
    const s = sumBucketPaidSb(paid, weekStart.toISOString(), weekEnd.toISOString());
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
    const s = sumBucketPaidSb(paid, weekStart.toISOString(), weekEnd.toISOString());
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
  paid: PaidRowChart[],
  now: Date,
  lc: string,
): { current: ChartBucket[]; previous: ChartBucket[] } {
  const curMonth = startLocalMonth(now);
  const current: ChartBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = addLocalMonths(curMonth, -i);
    const monthEnd = addLocalMonths(monthStart, 1);
    const s = sumBucketPaidSb(paid, monthStart.toISOString(), monthEnd.toISOString());
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
    const s = sumBucketPaidSb(paid, monthStart.toISOString(), monthEnd.toISOString());
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
  paid: PaidRowChart[],
  now: Date,
  lc: string,
): { current: ChartBucket[]; previous: ChartBucket[] } {
  if (paid.length === 0) {
    return { current: [], previous: [] };
  }
  let minIso = String(paid[0].created_at);
  for (const o of paid) {
    const t = String(o.created_at);
    if (t < minIso) minIso = t;
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
    const s = sumBucketPaidSb(paid, monthStart.toISOString(), monthEnd.toISOString());
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
      const s = sumBucketPaidSb(paid, monthStart.toISOString(), monthEnd.toISOString());
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

function buildSalesChartBundle(paid: PaidRowChart[], now: Date, lc: string) {
  return {
    day: buildSalesChartDay(paid, now, lc),
    week: buildSalesChartWeek(paid, now, lc),
    month: buildSalesChartMonth(paid, now, lc),
    all: buildSalesChartAllTime(paid, now, lc),
  };
}

function buildVisitorBuckets(
  rows: Array<{ created_at: string; status?: string | null }>,
  now: Date,
): { h16: VisitorHourBucket[]; h24: VisitorHourBucket[]; peakHour24: number; peakCount24: number } {
  const byHour = new Map<number, number>();
  for (const row of rows) {
    const status = String(row.status ?? "").toLowerCase();
    if (status === "cancelled" || status === "voided") continue;
    const d = new Date(String(row.created_at));
    if (Number.isNaN(d.getTime())) continue;
    const hourKey = Math.floor(d.getTime() / 3600000);
    byHour.set(hourKey, (byHour.get(hourKey) ?? 0) + 1);
  }

  const currentHourKey = Math.floor(now.getTime() / 3600000);
  const build = (hours: number): VisitorHourBucket[] => {
    const out: VisitorHourBucket[] = [];
    for (let i = hours - 1; i >= 0; i--) {
      const hk = currentHourKey - i;
      const h = ((hk % 24) + 24) % 24;
      out.push({ hour: h, count: byHour.get(hk) ?? 0 });
    }
    return out;
  };

  const h24 = build(24);
  let peakHour24 = 0;
  let peakCount24 = 0;
  for (const b of h24) {
    if (b.count > peakCount24) {
      peakCount24 = b.count;
      peakHour24 = b.hour;
    }
  }

  return {
    h16: build(16),
    h24,
    peakHour24,
    peakCount24,
  };
}

function buildVisitorHeatmap7d(
  rows: Array<{ created_at: string; status?: string | null }>,
  now: Date,
  lc: string,
): VisitorHeatmap {
  const dayLabels: string[] = [];
  const matrix24: number[][] = [];
  const today = startLocalDay(now);

  for (let d = 6; d >= 0; d--) {
    const day = addLocalDays(today, -d);
    dayLabels.push(
      day.toLocaleDateString(lc, { weekday: "short" }),
    );
    matrix24.push(Array.from({ length: 24 }, () => 0));
  }

  const start = addLocalDays(today, -6);
  const startMs = start.getTime();
  const endMs = addLocalDays(today, 1).getTime();

  for (const row of rows) {
    const status = String(row.status ?? "").toLowerCase();
    if (status === "cancelled" || status === "voided") continue;
    const d = new Date(String(row.created_at));
    const t = d.getTime();
    if (!Number.isFinite(t) || t < startMs || t >= endMs) continue;
    const dayIndex = Math.floor((startLocalDay(d).getTime() - startMs) / 86400000);
    const hour = d.getHours();
    if (dayIndex < 0 || dayIndex > 6 || hour < 0 || hour > 23) continue;
    matrix24[dayIndex][hour] += 1;
  }

  return { dayLabels, matrix24 };
}

/** Paid revenue per calendar day for the last 7 days (oldest → today). */
function buildLast7DaysPaidRevenueByDaySb(
  paid: PaidRowChart[],
  now: Date,
  lc: string,
): { day: string; revenue: number }[] {
  const today = startLocalDay(now);
  const out: { day: string; revenue: number }[] = [];
  for (let d = 6; d >= 0; d--) {
    const dayStart = addLocalDays(today, -d);
    const dayEnd = addLocalDays(dayStart, 1);
    const s = sumBucketPaidSb(paid, dayStart.toISOString(), dayEnd.toISOString());
    out.push({
      day: dayStart.toLocaleDateString(lc, { weekday: "short" }),
      revenue: s.revenue,
    });
  }
  return out;
}

function parseRevenueDayBoundaries(dayBoundariesIso: string[]): string[] {
  if (dayBoundariesIso.length < 3 || dayBoundariesIso.length % 2 === 0) {
    throw new Error("Revenue overview requires an odd number of ordered boundaries");
  }
  const boundaries = dayBoundariesIso.map((value) => String(value).trim());
  for (let index = 0; index < boundaries.length; index += 1) {
    if (!Number.isFinite(Date.parse(boundaries[index]))) {
      throw new Error("Invalid revenue overview date");
    }
    if (index > 0 && boundaries[index] <= boundaries[index - 1]) {
      throw new Error("Revenue overview dates must be ordered");
    }
  }
  return boundaries;
}

function buildRevenueOverview(
  paid: PaidRowChart[],
  dayBoundariesIso: string[],
) {
  const boundaries = parseRevenueDayBoundaries(dayBoundariesIso);
  const bucketCount = (boundaries.length - 1) / 2;
  const points: Array<{
    currentRevenue: number;
    previousRevenue: number;
  }> = [];
  let currentTotal = 0;
  let previousTotal = 0;

  for (let dayIndex = 0; dayIndex < bucketCount; dayIndex += 1) {
    const previous = sumBucketPaidSb(
      paid,
      boundaries[dayIndex],
      boundaries[dayIndex + 1],
    );
    const current = sumBucketPaidSb(
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

export async function getRevenueOverview(
  licenseKey: string,
  dayBoundariesIso: string[],
) {
  const boundaries = parseRevenueDayBoundaries(dayBoundariesIso);
  const restaurant = await getRestaurantByLicense(licenseKey);
  const rangeFromIso = boundaries[0];
  const rangeToExclusiveIso = boundaries[boundaries.length - 1];
  const rowsById = new Map<string, Record<string, unknown>>();

  let supportsPaidAt = true;
  const createdRange = await supabase
    .from("sales")
    .select("id, created_at, paid_at, total")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "paid")
    .gte("created_at", rangeFromIso)
    .lt("created_at", rangeToExclusiveIso);

  let createdRows = createdRange.data as unknown[] | null;
  let createdError = createdRange.error;
  if (
    createdError &&
    isMissingPgColumnError(String(createdError.message ?? ""), "paid_at")
  ) {
    supportsPaidAt = false;
    const fallback = await supabase
      .from("sales")
      .select("id, created_at, total")
      .eq("restaurant_id", restaurant.id)
      .eq("status", "paid")
      .gte("created_at", rangeFromIso)
      .lt("created_at", rangeToExclusiveIso);
    createdRows = fallback.data as unknown[] | null;
    createdError = fallback.error;
  }
  assertNoPgError("Revenue overview created-at range", createdError);

  for (const raw of createdRows ?? []) {
    const row = raw as Record<string, unknown>;
    const id = String(row.id ?? "");
    if (id) rowsById.set(id, row);
  }

  if (supportsPaidAt) {
    const paidRange = await supabase
      .from("sales")
      .select("id, created_at, paid_at, total")
      .eq("restaurant_id", restaurant.id)
      .eq("status", "paid")
      .gte("paid_at", rangeFromIso)
      .lt("paid_at", rangeToExclusiveIso);
    if (
      paidRange.error &&
      !isMissingPgColumnError(
        String(paidRange.error.message ?? ""),
        "paid_at",
      )
    ) {
      assertNoPgError("Revenue overview paid-at range", paidRange.error);
    }
    if (!paidRange.error) {
      for (const raw of paidRange.data ?? []) {
        const row = raw as Record<string, unknown>;
        const id = String(row.id ?? "");
        if (id) rowsById.set(id, row);
      }
    }
  }

  const paid: PaidRowChart[] = [...rowsById.values()].map((row) => ({
    created_at: saleCollectedAtIso(row),
    total: Number(row.total ?? 0),
  }));
  return buildRevenueOverview(paid, boundaries);
}

function buildFiscalTrend12m(
  rows: Array<{ created_at: string; total: number | string; payment_type?: string | null; status?: string | null }>,
  now: Date,
  lc: string,
): FiscalTrendBucket[] {
  const curMonth = startLocalMonth(now);
  const out: FiscalTrendBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = addLocalMonths(curMonth, -i);
    const monthEnd = addLocalMonths(monthStart, 1);
    let fiscal = 0;
    let nonFiscal = 0;
    const startIso = monthStart.toISOString();
    const endIso = monthEnd.toISOString();
    for (const row of rows) {
      const status = String(row.status ?? "").toLowerCase();
      if (status !== "paid") continue;
      const t = String(row.created_at ?? "");
      if (t < startIso || t >= endIso) continue;
      const amount = Number(row.total ?? 0);
      const pt = String(row.payment_type ?? "").toLowerCase();
      if (pt === "fiscal") fiscal += amount;
      else nonFiscal += amount;
    }
    out.push({
      label: monthStart.toLocaleDateString(lc, { month: "short" }),
      fiscal: round2(fiscal),
      nonFiscal: round2(nonFiscal),
    });
  }
  return out;
}

function buildFiscalTodayByHour(
  rows: Array<{ created_at: string; total: number | string; payment_type?: string | null; status?: string | null }>,
  now: Date,
): FiscalTrendBucket[] {
  const dayStart = startLocalDay(now);
  const dayEnd = addLocalDays(dayStart, 1);
  const startIso = dayStart.toISOString();
  const endIso = dayEnd.toISOString();
  const out: FiscalTrendBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, "0")}:00`,
    fiscal: 0,
    nonFiscal: 0,
  }));

  for (const row of rows) {
    const status = String(row.status ?? "").toLowerCase();
    if (status !== "paid") continue;
    const t = String(row.created_at ?? "");
    if (t < startIso || t >= endIso) continue;
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) continue;
    const hour = d.getHours();
    const amount = Number(row.total ?? 0);
    const pt = String(row.payment_type ?? "").toLowerCase();
    if (pt === "fiscal") out[hour].fiscal += amount;
    else out[hour].nonFiscal += amount;
  }

  return out.map((r) => ({
    ...r,
    fiscal: round2(r.fiscal),
    nonFiscal: round2(r.nonFiscal),
  }));
}

export async function getDashboardStats(
  licenseKey: string,
  viewPeriod?: DashboardViewPeriod,
  locale?: DashboardLocaleOption,
  anchorDateIso?: string,
  rangeFromIso?: string,
  rangeToExclusiveIso?: string,
  operationalDayStartIso?: string,
  staffId?: string,
) {
  if (staffId) {
    await assertStaffPermission({
      licenseKey,
      staffId,
      permission: "canViewReports",
    });
  }
  const r = await getRestaurantByLicense(licenseKey);
  const parsedAnchor = anchorDateIso ? new Date(anchorDateIso) : null;
  const now =
    parsedAnchor && Number.isFinite(parsedAnchor.getTime())
      ? parsedAnchor
      : new Date();
  const starts = localPeriodStarts(now);
  const dayStart = starts.day;
  const lc = chartLocaleTag(locale);
  const unassignedLabel = locale === "sq" ? "Pa caktim" : "Unassigned";
  const unknownLabel = locale === "sq" ? "E panjohur" : "Unknown";

  const rf = String(rangeFromIso ?? "").trim();
  const rtx = String(rangeToExclusiveIso ?? "").trim();
  const opStart = String(operationalDayStartIso ?? "").trim();
  const useRangeFilter = rf.length > 0 && rtx.length > 0 && rtx > rf;

  const kpiStartIso = useRangeFilter ? rf : starts.day;
  const kpiEndIso = useRangeFilter
    ? rtx
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

  const configuredTargetAmount = Number(r.dashboard_target_amount ?? 0);
  const configuredTargetStartAt = normalizeIsoInstant(
    r.dashboard_target_start_at,
  );
  const configuredTargetEndAt = normalizeIsoInstant(
    r.dashboard_target_end_at,
  );
  const configuredTargetPeriod = normalizeDashboardTargetPeriod(
    r.dashboard_target_period,
  );
  const hasConfiguredTarget =
    Number.isFinite(configuredTargetAmount) &&
    configuredTargetAmount > 0 &&
    configuredTargetStartAt !== null &&
    configuredTargetEndAt !== null &&
    configuredTargetEndAt > configuredTargetStartAt &&
    configuredTargetPeriod !== null;

  const paidInRange = (collectedAt: string) =>
    String(collectedAt) >= rf && String(collectedAt) < rtx;

  const orderHistoryFrom = [
    previousKpiStartIso,
    starts.year,
    ...(hasConfiguredTarget ? [configuredTargetStartAt!] : []),
  ].sort()[0];
  const paidHistoryFrom = [
    previousKpiStartIso,
    ...(hasConfiguredTarget ? [configuredTargetStartAt!] : []),
  ].sort()[0];
  const paidHistoryTo = [
    kpiEndIso,
    ...(hasConfiguredTarget ? [configuredTargetEndAt!] : []),
  ].sort().at(-1)!;
  const { data: orders } = await supabase
    .from("sales")
    .select("*")
    .eq("restaurant_id", r.id)
    .gte("created_at", orderHistoryFrom);

  const byId = new Map<string, Record<string, unknown>>();
  for (const row of orders ?? []) {
    const rec = row as Record<string, unknown>;
    const id = String(rec.id ?? "");
    if (id) byId.set(id, rec);
  }

  {
    const paidAtQ = await supabase
      .from("sales")
      .select("*")
      .eq("restaurant_id", r.id)
      .eq("status", "paid")
      .gte("paid_at", paidHistoryFrom)
      .lt("paid_at", paidHistoryTo);
    if (
      paidAtQ.error &&
      !isMissingPgColumnError(String(paidAtQ.error.message ?? ""), "paid_at")
    ) {
      assertNoPgError("Dashboard paid-at range", paidAtQ.error);
    }
    if (!paidAtQ.error) {
      for (const row of paidAtQ.data ?? []) {
        const rec = row as Record<string, unknown>;
        const id = String(rec.id ?? "");
        if (id) byId.set(id, rec);
      }
    }
  }

  const list = [...byId.values()];

  const chartFrom = new Date(now.getFullYear() - 5, 0, 1).toISOString();
  const { data: paidChartRows, error: chartErr } = await supabase
    .from("sales")
    .select("created_at,total")
    .eq("restaurant_id", r.id)
    .eq("status", "paid")
    .gte("created_at", chartFrom);
  assertNoPgError("Dashboard sales chart", chartErr);
  const paidChartFiltered = (paidChartRows ?? []).filter((row) => {
    const t = String(row.created_at ?? "");
    if (!useRangeFilter) return true;
    return paidInRange(t);
  });
  const salesChart = buildSalesChartBundle(
    paidChartFiltered as PaidRowChart[],
    now,
    lc,
  );
  const fiscalTrend = buildFiscalTodayByHour(
    (list ?? []).map((o) => ({
      created_at: String(o.created_at ?? ""),
      total: Number(o.total ?? 0),
      payment_type: String(o.payment_type ?? ""),
      status: String(o.status ?? ""),
    })),
    now,
  );
  const paidFrom = (startIso: string) =>
    list.filter(
      (o) =>
        o.status === "paid" && saleCollectedAtIso(o) >= startIso,
    );

  const detailPeriod: DashboardViewPeriod = viewPeriod ?? "day";
  const detailPaid = useRangeFilter
    ? list.filter(
        (o) => o.status === "paid" && paidInRange(saleCollectedAtIso(o)),
      )
    : paidFrom(starts[detailPeriod]);

  const periodSummaries = useRangeFilter
    ? (() => {
        const s = summarizePaid(detailPaid);
        return { day: s, week: s, month: s, year: s };
      })()
    : {
        day: summarizePaid(paidFrom(starts.day)),
        week: summarizePaid(paidFrom(starts.week)),
        month: summarizePaid(paidFrom(starts.month)),
        year: summarizePaid(paidFrom(starts.year)),
      };

  const todayRevenue = periodSummaries.day.revenue;
  const todayPaidCount = periodSummaries.day.paidCount;
  const avgOrderValue = periodSummaries.day.avgOrderValue;

  const kpiCurrentPaid = list.filter((o) => {
    if (o.status !== "paid") return false;
    const at = saleCollectedAtIso(o);
    return at >= kpiStartIso && at < kpiEndIso;
  });
  const kpiPreviousPaid = list.filter((o) => {
    if (o.status !== "paid") return false;
    const at = saleCollectedAtIso(o);
    return at >= previousKpiStartIso && at < previousKpiEndIso;
  });
  const currentKpiSummary = summarizePaid(
    kpiCurrentPaid as { total: number | string }[],
  );
  const previousKpiSummary = summarizePaid(
    kpiPreviousPaid as { total: number | string }[],
  );
  const targetRevenue = hasConfiguredTarget
    ? list.reduce((sum, order) => {
        if (String(order.status ?? "").toLowerCase() !== "paid") return sum;
        const collectedAt = saleCollectedAtIso(order);
        if (
          collectedAt < configuredTargetStartAt! ||
          collectedAt >= configuredTargetEndAt!
        ) {
          return sum;
        }
        return sum + Math.max(0, Number(order.total ?? 0));
      }, 0)
    : 0;

  const saleMoney = (raw: unknown) => {
    const n = Number(raw ?? 0);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };
  const openSales = list.filter((o) => isOpenSaleStatus(o.status));
  const openUnpaidTotal = openSales.reduce((sum, o) => {
    const due = saleMoney(o.total) - saleMoney(
      (o as { paid_amount?: unknown }).paid_amount,
    );
    return sum + Math.max(0, due);
  }, 0);
  const openCollectedTotal = openSales.reduce((sum, o) => {
    const total = saleMoney(o.total);
    const paid = saleMoney((o as { paid_amount?: unknown }).paid_amount);
    return sum + Math.min(total, paid);
  }, 0);
  const paidCirculation = todayRevenue + openCollectedTotal;
  const totalCirculation = paidCirculation + openUnpaidTotal;

  const listToday =
    useRangeFilter && opStart.length > 0
      ? list.filter((o) => {
          const t = String(o.created_at ?? "");
          return t >= opStart && t < rtx;
        })
      : list.filter((o) => String(o.created_at) >= dayStart);
  const visitorBuckets = buildVisitorBuckets(
    list.map((o) => ({
      created_at: String(o.created_at ?? ""),
      status: String(o.status ?? ""),
    })),
    now,
  );
  const visitorHeatmap = buildVisitorHeatmap7d(
    list.map((o) => ({
      created_at: String(o.created_at ?? ""),
      status: String(o.status ?? ""),
    })),
    now,
    lc,
  );

  const weekDayRevenue = buildLast7DaysPaidRevenueByDaySb(
    paidChartFiltered as PaidRowChart[],
    now,
    lc,
  );

  const tables = await getTables(licenseKey);
  const occupiedTables = tables.filter(
    (t) => t.status === "occupied" || t.status === "bill-printed",
  ).length;
  const reservedTables = tables.filter((t) => t.status === "reserved").length;
  const availableTables = Math.max(
    0,
    tables.length - occupiedTables - reservedTables,
  );
  const activeTables = occupiedTables;

  const activeOrders = listToday.filter(
    (o) => o.status !== "paid" && o.status !== "cancelled",
  ).length;

  const todayOrdersCount = listToday.filter(
    (o) => String(o.status ?? "").toLowerCase() !== "cancelled",
  ).length;

  const revenueByPaymentType: Record<string, { count: number; total: number }> =
    {};
  for (const o of detailPaid) {
    const type = o.payment_type ?? "fiscal";
    if (!revenueByPaymentType[type]) {
      revenueByPaymentType[type] = { count: 0, total: 0 };
    }
    revenueByPaymentType[type].count++;
    revenueByPaymentType[type].total += Number(o.total);
  }

  const revenueByMethod: Record<string, { count: number; total: number }> = {};
  for (const o of detailPaid) {
    const method = o.payment_method ?? "cash";
    if (!revenueByMethod[method]) {
      revenueByMethod[method] = { count: 0, total: 0 };
    }
    revenueByMethod[method].count++;
    revenueByMethod[method].total += Number(o.total);
  }

  const paymentMix = { cash: 0, card: 0, debt: 0, other: 0 };
  for (const o of detailPaid) {
    const amount = saleMoney(o.total);
    const paymentType = String(o.payment_type ?? "").toLowerCase();
    const method = String(o.payment_method ?? "cash").toLowerCase();
    if (paymentType === "debt") paymentMix.debt += amount;
    else if (method === "cash") paymentMix.cash += amount;
    else if (method === "card") paymentMix.card += amount;
    else paymentMix.other += amount;
  }

  const ordersByStatus: Record<string, number> = {};
  for (const o of listToday) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
  }

  let fiscalCount = 0;
  let fiscalTotal = 0;
  let nonFiscalCount = 0;
  let nonFiscalTotal = 0;
  for (const o of detailPaid) {
    const pt = String(o.payment_type ?? "").toLowerCase();
    const amt = Number(o.total ?? 0);
    if (pt === "fiscal") {
      fiscalCount += 1;
      fiscalTotal += amt;
    } else if (
      pt === "non_fiscal" ||
      pt === "no_receipt" ||
      pt === ""
    ) {
      nonFiscalCount += 1;
      nonFiscalTotal += amt;
    }
  }

  const paidSaleIds = detailPaid.map((o) => String(o.id));
  const previousSaleIds = kpiPreviousPaid.map((o) => String(o.id));
  const liveSaleIds = openSales.map((o) => String(o.id));
  const lineRows = await fetchSaleItemsForSaleIds(paidSaleIds);
  const previousLineRows = await fetchSaleItemsForSaleIds(previousSaleIds);
  const liveLineRows = await fetchSaleItemsForSaleIds(liveSaleIds);
  let totalPreparationMinutes = 0;
  let preparationSampleCount = 0;
  for (const line of lineRows) {
    const status = String(line.status ?? "").toLowerCase();
    if (status === "voided" || status === "cancelled") continue;
    const sentMs = Date.parse(String(line.sentAt ?? ""));
    const readyMs = Date.parse(String(line.readyAt ?? ""));
    if (
      !Number.isFinite(sentMs) ||
      !Number.isFinite(readyMs) ||
      readyMs < sentMs
    ) {
      continue;
    }
    const minutes = (readyMs - sentMs) / 60_000;
    if (minutes > 12 * 60) continue;
    totalPreparationMinutes += minutes;
    preparationSampleCount += 1;
  }
  const averagePreparationMinutes =
    preparationSampleCount > 0
      ? totalPreparationMinutes / preparationSampleCount
      : 0;
  let menuResult = await supabase
    .from("menu_items")
    .select(
      "id, name, price, station, category_id, image_url, supply_recipe, track_stock, stock_unit, current_stock, low_stock_threshold",
    )
    .eq("restaurant_id", r.id);
  if (
    menuResult.error &&
    isMissingPgColumnError(
      String(menuResult.error.message ?? ""),
      "supply_recipe",
    )
  ) {
    menuResult = await supabase
      .from("menu_items")
      .select(
        "id, name, price, station, category_id, image_url, track_stock, stock_unit, current_stock, low_stock_threshold",
      )
      .eq("restaurant_id", r.id);
  }
  assertNoPgError("Dashboard menu inventory", menuResult.error);
  const menuRows = menuResult.data ?? [];
  const { data: categoryRows, error: categoryError } = await supabase
    .from("menu_categories")
    .select("id, name, color")
    .eq("restaurant_id", r.id);
  assertNoPgError("Dashboard menu categories", categoryError);
  const menuStationById = new Map<string, "kitchen" | "bar">();
  const menuStationByName = new Map<string, "kitchen" | "bar">();
  for (const row of menuRows) {
    const station = row.station === "bar" ? "bar" : "kitchen";
    menuStationById.set(String(row.id), station);
    menuStationByName.set(String(row.name ?? "").trim().toLowerCase(), station);
  }
  const resolveStation = (line: DashboardSaleItemRow): "kitchen" | "bar" =>
    line.station ??
    (line.menuItemId ? menuStationById.get(line.menuItemId) : undefined) ??
    menuStationByName.get(line.name.trim().toLowerCase()) ??
    "kitchen";

  const kpiSeries = {
    revenue: Array.from({ length: DASHBOARD_KPI_BUCKETS }, () => 0),
    orders: Array.from({ length: DASHBOARD_KPI_BUCKETS }, () => 0),
    bar: Array.from({ length: DASHBOARD_KPI_BUCKETS }, () => 0),
    kitchen: Array.from({ length: DASHBOARD_KPI_BUCKETS }, () => 0),
  };
  const currentSaleAt = new Map<string, string>();
  for (const sale of kpiCurrentPaid) {
    const at = saleCollectedAtIso(sale);
    const bucket = kpiBucketIndex(at, kpiStartIso, kpiEndIso);
    if (bucket < 0) continue;
    const saleId = String(sale.id ?? "");
    currentSaleAt.set(saleId, at);
    kpiSeries.revenue[bucket] += Number(sale.total ?? 0);
    kpiSeries.orders[bucket] += 1;
  }

  let barRevenue = 0;
  let kitchenRevenue = 0;
  let previousBarRevenue = 0;
  let previousKitchenRevenue = 0;
  const itemAgg = new Map<
    string,
    {
      menuItemId?: string;
      name: string;
      quantity: number;
      revenue: number;
    }
  >();
  for (const it of lineRows) {
    const st = String(it.status ?? "").toLowerCase();
    if (st === "voided" || st === "cancelled") continue;
    const name = String(it.name ?? "").trim() || "Item";
    const qty = Number(it.quantity ?? 0);
    const rev = Number(it.price ?? 0) * qty;
    const saleAt = currentSaleAt.get(it.saleId);
    if (saleAt) {
      const bucket = kpiBucketIndex(saleAt, kpiStartIso, kpiEndIso);
      if (resolveStation(it) === "bar") {
        barRevenue += rev;
        if (bucket >= 0) kpiSeries.bar[bucket] += rev;
      } else {
        kitchenRevenue += rev;
        if (bucket >= 0) kpiSeries.kitchen[bucket] += rev;
      }
    }
    const aggregateKey =
      it.menuItemId ?? `name:${name.toLocaleLowerCase()}`;
    const prev = itemAgg.get(aggregateKey) ?? {
      menuItemId: it.menuItemId,
      name,
      quantity: 0,
      revenue: 0,
    };
    prev.quantity += qty;
    prev.revenue += rev;
    itemAgg.set(aggregateKey, prev);
  }
  for (const it of previousLineRows) {
    const st = String(it.status ?? "").toLowerCase();
    if (st === "voided" || st === "cancelled") continue;
    const rev = Number(it.price ?? 0) * Number(it.quantity ?? 0);
    if (resolveStation(it) === "bar") previousBarRevenue += rev;
    else previousKitchenRevenue += rev;
  }

  const kitchenOrderIds = new Set<string>();
  const barOrderIds = new Set<string>();
  for (const it of lineRows) {
    const st = String(it.status ?? "").toLowerCase();
    if (st === "voided" || st === "cancelled") continue;
    const saleId = String(it.saleId ?? "");
    if (!saleId) continue;
    if (resolveStation(it) === "bar") barOrderIds.add(saleId);
    else kitchenOrderIds.add(saleId);
  }

  const liveQueueStatuses = new Set(["sent", "preparing"]);
  let kitchenQueueItems = 0;
  let barQueueItems = 0;
  let readyItems = 0;
  let delayedItems = 0;
  let totalQueueAgeMinutes = 0;
  let agedQueueItems = 0;
  const liveNowMs = Date.now();
  for (const line of liveLineRows) {
    const status = String(line.status ?? "").toLowerCase();
    if (status === "ready") readyItems += Number(line.quantity ?? 0);
    if (!liveQueueStatuses.has(status)) continue;
    const quantity = Math.max(1, Number(line.quantity ?? 1));
    if (resolveStation(line) === "bar") barQueueItems += quantity;
    else kitchenQueueItems += quantity;
    const createdMs = Date.parse(line.createdAt);
    if (!Number.isFinite(createdMs)) continue;
    const ageMinutes = Math.max(0, (liveNowMs - createdMs) / 60_000);
    totalQueueAgeMinutes += ageMinutes;
    agedQueueItems += 1;
    if (ageMinutes >= 15) delayedItems += quantity;
  }
  const averageQueueAgeMinutes =
    agedQueueItems > 0 ? totalQueueAgeMinutes / agedQueueItems : 0;

  const trackedMenuRows = (menuRows ?? []).filter(
    (row) => row.track_stock === true,
  );
  const venueLowStock = parsePosStockRules(stockRulesFromRestaurantRow(r))
    .defaultLowStockThreshold;
  const outOfStockRows = trackedMenuRows.filter(
    (row) => Number(row.current_stock ?? 0) <= 0,
  );
  const lowStockRows = trackedMenuRows.filter((row) => {
    const current = Number(row.current_stock ?? 0);
    const threshold = effectiveLowStockThreshold(
      row.low_stock_threshold == null
        ? undefined
        : Number(row.low_stock_threshold),
      venueLowStock,
    );
    return current > 0 && current <= threshold;
  });

  const supplyChartStartIso = startLocalMonth(
    addLocalMonths(now, -5),
  ).toISOString();
  const stockQueryStartIso =
    supplyChartStartIso < kpiStartIso ? supplyChartStartIso : kpiStartIso;
  const [stockLogResult, expenseResult] = await Promise.all([
    supabase
      .from("pos_stock_logs")
      .select("menu_item_id, type, change, created_at")
      .eq("restaurant_id", r.id)
      .gte("created_at", stockQueryStartIso)
      .lt("created_at", kpiEndIso),
    supabase
      .from("pos_expenses")
      .select("amount, created_at")
      .eq("restaurant_id", r.id)
      .gte("created_at", kpiStartIso)
      .lt("created_at", kpiEndIso),
  ]);
  const priceByMenuId = new Map(
    (menuRows ?? []).map((row) => [String(row.id), Number(row.price ?? 0)]),
  );
  const costMovementTypes = new Set([
    "sale",
    "recipe_sale",
    "staff_consumption",
    "waste",
  ]);
  let estimatedStockCost = 0;
  if (!stockLogResult.error) {
    for (const row of stockLogResult.data ?? []) {
      const createdAt = String(row.created_at ?? "");
      if (createdAt < kpiStartIso || createdAt >= kpiEndIso) continue;
      const change = Number(row.change ?? 0);
      if (change >= 0 || !costMovementTypes.has(String(row.type ?? ""))) {
        continue;
      }
      estimatedStockCost +=
        Math.abs(change) *
        (priceByMenuId.get(String(row.menu_item_id ?? "")) ?? 0);
    }
  }
  const operatingExpenses = expenseResult.error
    ? 0
    : (expenseResult.data ?? []).reduce(
        (sum, row) => sum + Math.max(0, Number(row.amount ?? 0)),
        0,
      );
  const estimatedProfit =
    currentKpiSummary.revenue - estimatedStockCost - operatingExpenses;
  const marginPercent =
    currentKpiSummary.revenue > 0
      ? (estimatedProfit / currentKpiSummary.revenue) * 100
      : 0;
  const cancelledOrdersInPeriod = list.filter((order) => {
    if (String(order.status ?? "").toLowerCase() !== "cancelled") return false;
    const createdAt = String(order.created_at ?? "");
    return createdAt >= kpiStartIso && createdAt < kpiEndIso;
  }).length;
  const ordersCreatedInPeriod = list.filter((order) => {
    const createdAt = String(order.created_at ?? "");
    return createdAt >= kpiStartIso && createdAt < kpiEndIso;
  }).length;
  const cancellationRatePercent =
    ordersCreatedInPeriod > 0
      ? (cancelledOrdersInPeriod / ordersCreatedInPeriod) * 100
      : 0;
  const paidTableOrders = kpiCurrentPaid.filter(
    (order) => order.table_id != null || String(order.table_ref ?? "").trim(),
  ).length;
  const tableTurnsPerDay =
    tables.length > 0
      ? paidTableOrders / tables.length / kpiDayCount
      : 0;
  const configuredDailyTarget = Number(
    r.dashboard_daily_sales_target ?? 0,
  );
  const dailySalesTarget =
    Number.isFinite(configuredDailyTarget) && configuredDailyTarget > 0
      ? configuredDailyTarget
      : 0;
  const periodSalesTarget = dailySalesTarget * kpiDayCount;
  const stockHistoryRows = stockLogResult.error
    ? []
    : (stockLogResult.data ?? []);
  const supplyProfitChart = Array.from({ length: 6 }, (_, index) => {
    const monthStart = addLocalMonths(startLocalMonth(now), index - 5);
    const monthEnd = addLocalMonths(monthStart, 1);
    const startIso = monthStart.toISOString();
    const endIso = monthEnd.toISOString();
    let supplyIntake = 0;
    let stockExpense = 0;
    for (const row of stockHistoryRows) {
      const createdAt = String(row.created_at ?? "");
      if (createdAt < startIso || createdAt >= endIso) continue;
      const change = Number(row.change ?? 0);
      const price =
        priceByMenuId.get(String(row.menu_item_id ?? "")) ?? 0;
      if (String(row.type ?? "") === "manual_addition" && change > 0) {
        supplyIntake += change * price;
      } else if (
        change < 0 &&
        costMovementTypes.has(String(row.type ?? ""))
      ) {
        stockExpense += Math.abs(change) * price;
      }
    }
    return {
      label: monthStart.toLocaleDateString(lc, {
        month: "short",
        year: "2-digit",
      }),
      revenue: 0,
      supplyIntake: round2(supplyIntake),
      stockExpense: round2(stockExpense),
      estimatedProfit: 0,
    };
  });
  let inventoryTotal = 0;
  let inventoryKitchen = 0;
  let inventoryBar = 0;
  let trackedItemCount = 0;
  for (const row of trackedMenuRows) {
    const value =
      Math.max(0, Number(row.current_stock ?? 0)) *
      Math.max(0, Number(row.price ?? 0));
    trackedItemCount += 1;
    inventoryTotal += value;
    if (row.station === "bar") inventoryBar += value;
    else inventoryKitchen += value;
  }
  const inventorySnapshot = {
    totalValue: round2(inventoryTotal),
    kitchenValue: round2(inventoryKitchen),
    barValue: round2(inventoryBar),
    trackedItemCount,
  };
  const currentLineById = new Map(
    [...lineRows, ...liveLineRows].map((line) => [line.id, line]),
  );
  const voidedItems = [...currentLineById.values()].reduce(
    (sum, line) =>
      String(line.status ?? "").toLowerCase() === "voided"
        ? sum + Number(line.quantity ?? 0)
        : sum,
    0,
  );

  const menuRecords = menuRows as unknown as Record<string, unknown>[];
  const menuById = new Map(
    menuRecords.map((row) => [String(row.id ?? ""), row]),
  );
  const menuByName = new Map(
    menuRecords.map((row) => [
      String(row.name ?? "").trim().toLocaleLowerCase(),
      row,
    ]),
  );
  const categoryById = new Map(
    (categoryRows ?? []).map((row) => [
      String(row.id ?? ""),
      {
        name: String(row.name ?? ""),
        color: String(row.color ?? "") || "#64748b",
      },
    ]),
  );
  const fallbackCategoryName = locale === "sq" ? "Të tjera" : "Other";
  const categorySalesById = new Map<
    string,
    { name: string; color: string; quantity: number; revenue: number }
  >();
  const topItems = [...itemAgg.values()]
    .map((item) => {
      const menuRow =
        (item.menuItemId ? menuById.get(item.menuItemId) : undefined) ??
        menuByName.get(item.name.trim().toLocaleLowerCase());
      const categoryId = String(menuRow?.category_id ?? "");
      const category = categoryById.get(categoryId);
      const categoryKey = categoryId || "__other__";
      const categoryAggregate = categorySalesById.get(categoryKey) ?? {
        name: category?.name || fallbackCategoryName,
        color: category?.color || "#64748b",
        quantity: 0,
        revenue: 0,
      };
      categoryAggregate.quantity += item.quantity;
      categoryAggregate.revenue += item.revenue;
      categorySalesById.set(categoryKey, categoryAggregate);

      const recipe = Array.isArray(menuRow?.supply_recipe)
        ? menuRow.supply_recipe
        : [];
      let estimatedUnitCost = 0;
      let hasCostEstimate = false;
      for (const rawLine of recipe) {
        if (!rawLine || typeof rawLine !== "object") continue;
        const line = rawLine as Record<string, unknown>;
        const supplyId = String(
          line.supplyMenuItemId ?? line.supply_menu_item_id ?? "",
        );
        const quantityPerUnit = Number(
          line.qtyPerUnit ?? line.qty_per_unit ?? 0,
        );
        const supplyPrice = priceByMenuId.get(supplyId);
        if (
          !supplyId ||
          !Number.isFinite(quantityPerUnit) ||
          quantityPerUnit <= 0 ||
          supplyPrice === undefined
        ) {
          continue;
        }
        estimatedUnitCost += supplyPrice * quantityPerUnit;
        hasCostEstimate = true;
      }
      const estimatedProfit = hasCostEstimate
        ? round2(item.revenue - estimatedUnitCost * item.quantity)
        : null;
      const marginPercent =
        estimatedProfit !== null && item.revenue > 0
          ? round2((estimatedProfit / item.revenue) * 100)
          : null;

      return {
        name: item.name,
        quantity: Math.round(item.quantity * 1000) / 1000,
        revenue: round2(item.revenue),
        estimatedProfit,
        marginPercent,
        imageUrl: String(menuRow?.image_url ?? "").trim() || null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);
  const categorySales = [...categorySalesById.values()]
    .map((category) => ({
      ...category,
      quantity: Math.round(category.quantity * 1000) / 1000,
      revenue: round2(category.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const recentOrderCandidates = list
    .filter((order) => {
      const status = String(order.status ?? "").toLowerCase();
      const activityAt =
        status === "paid"
          ? saleCollectedAtIso(order)
          : String(order.created_at ?? "");
      return activityAt >= kpiStartIso && activityAt < kpiEndIso;
    })
    .sort((a, b) => {
      const aStatus = String(a.status ?? "").toLowerCase();
      const bStatus = String(b.status ?? "").toLowerCase();
      const aAt =
        aStatus === "paid"
          ? saleCollectedAtIso(a)
          : String(a.created_at ?? "");
      const bAt =
        bStatus === "paid"
          ? saleCollectedAtIso(b)
          : String(b.created_at ?? "");
      return bAt.localeCompare(aAt);
    })
    .slice(0, 6);
  const staffPerf = new Map<string, { orders: number; revenue: number }>();
  for (const o of detailPaid) {
    const key = o.staff_id ? String(o.staff_id) : "__unassigned__";
    const prev = staffPerf.get(key) ?? { orders: 0, revenue: 0 };
    prev.orders += 1;
    prev.revenue += Number(o.total ?? 0);
    staffPerf.set(key, prev);
  }
  const staffIds = [
    ...new Set([
      ...[...staffPerf.keys()].filter((key) => key !== "__unassigned__"),
      ...recentOrderCandidates
        .map((order) => String(order.staff_id ?? ""))
        .filter(Boolean),
    ]),
  ];
  const staffNameById = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: stRows, error: stErr } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", staffIds);
    assertNoPgError("Dashboard staff names", stErr);
    for (const s of stRows ?? []) {
      staffNameById.set(String(s.id), String(s.name ?? "Staff"));
    }
  }
  const staffPerformance = [...staffPerf.entries()]
    .map(([id, v]) => ({
      name:
        id === "__unassigned__"
          ? unassignedLabel
          : (staffNameById.get(id) ?? unknownLabel),
      orders: v.orders,
      revenue: Math.round(v.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const tableNameById = new Map(
    tables.map((table) => [String(table._id), table.name]),
  );
  const recentOrders = recentOrderCandidates.map((order) => {
    const status = String(order.status ?? "").toLowerCase();
    const tableId = saleFloorTableId(
      order as { table_id?: string | null; table_ref?: string | null },
    );
    return {
      id: String(order.id ?? ""),
      orderNumber: Number(order.order_number ?? 0),
      tableName: tableId ? (tableNameById.get(tableId) ?? unknownLabel) : "—",
      staffName: order.staff_id
        ? (staffNameById.get(String(order.staff_id)) ?? unknownLabel)
        : "—",
      customerName: String(order.customer_name ?? ""),
      status,
      total: round2(Number(order.total ?? 0)),
      paymentMethod: String(order.payment_method ?? ""),
      activityAt:
        status === "paid"
          ? saleCollectedAtIso(order)
          : String(order.created_at ?? ""),
    };
  });

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
    todayPaidCount,
    /** Të gjitha shitjet e regjistruara sot (pa të anuluara). */
    todayOrdersCount,
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
        totalTables: tables.length,
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
        amount: hasConfiguredTarget ? round2(configuredTargetAmount) : 0,
        currentRevenue: round2(targetRevenue),
        startAt: hasConfiguredTarget ? configuredTargetStartAt : null,
        endAt: hasConfiguredTarget ? configuredTargetEndAt : null,
        period: hasConfiguredTarget ? configuredTargetPeriod : null,
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
        outOfStockCount: outOfStockRows.length,
        outOfStockNames: outOfStockRows
          .slice(0, 3)
          .map((row) => String(row.name ?? "")),
        outOfStockItems: outOfStockRows.slice(0, 3).map((row) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          currentStock: round2(Number(row.current_stock ?? 0)),
          lowStockThreshold: round2(
            Number(row.low_stock_threshold ?? 0),
          ),
          stockUnit: String(row.stock_unit ?? "pc"),
          imageUrl: String(row.image_url ?? "").trim() || null,
        })),
        lowStockCount: lowStockRows.length,
        lowStockNames: lowStockRows
          .slice(0, 3)
          .map((row) => String(row.name ?? "")),
        lowStockItems: lowStockRows.slice(0, 3).map((row) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          currentStock: round2(Number(row.current_stock ?? 0)),
          lowStockThreshold: round2(
            Number(row.low_stock_threshold ?? 0),
          ),
          stockUnit: String(row.stock_unit ?? "pc"),
          imageUrl: String(row.image_url ?? "").trim() || null,
        })),
        delayedItems: Math.round(delayedItems),
        cancelledOrders: cancelledOrdersInPeriod,
        voidedItems: Math.round(voidedItems),
      },
    },
    activeOrders,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    activeTables,
    totalTables: tables.length,
    fiscalSummary: {
      fiscalCount,
      fiscalTotal: Math.round(fiscalTotal * 100) / 100,
      nonFiscalCount,
      nonFiscalTotal: Math.round(nonFiscalTotal * 100) / 100,
    },
    revenueByPaymentType,
    revenueByMethod,
    ordersByStatus,
    topItems,
    categorySales,
    staffPerformance,
    recentOrders,
    salesChart,
    fiscalTrend,
    visitorBuckets,
    visitorHeatmap,
    weekDayRevenue,
    supplyProfitChart,
    inventorySnapshot,
  };
}

export async function updateDailySalesTarget(args: {
  licenseKey: string;
  dailyTarget: number;
}) {
  const dailyTarget = Number(args.dailyTarget);
  if (!Number.isFinite(dailyTarget) || dailyTarget < 0) {
    throw new Error("Daily sales target must be zero or greater.");
  }
  const restaurant = await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("restaurants")
    .update({
      dashboard_daily_sales_target:
        dailyTarget > 0 ? round2(dailyTarget) : null,
    })
    .eq("id", restaurant.id);
  if (error) {
    const message = String(error.message ?? "");
    if (
      isMissingPgColumnError(message, "dashboard_daily_sales_target")
    ) {
      throw new Error(
        "Mungon kolona dashboard_daily_sales_target. Ekzekuto migrimin 042_enterprise_dashboard_metrics.sql.",
      );
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
  return { ok: true as const };
}

export async function updateTargetPulse(args: {
  licenseKey: string;
  staffId: string;
  amount: number;
  startAt: string;
  endAt: string;
  period: DashboardTargetPeriod;
}) {
  const amount = Number(args.amount);
  const startAt = normalizeIsoInstant(args.startAt);
  const endAt = normalizeIsoInstant(args.endAt);
  const period = normalizeDashboardTargetPeriod(args.period);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Target amount must be greater than zero.");
  }
  if (!startAt || !endAt || endAt <= startAt || !period) {
    throw new Error("Target dates or period are invalid.");
  }

  const restaurant = await getRestaurantByLicense(args.licenseKey);
  if (!isLocalDevicePosAdmin(args.staffId)) {
    const staffId = uuidOrNull(args.staffId);
    if (!staffId) {
      throw new Error("Only an active admin can update Target Pulse.");
    }
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("id", staffId)
      .eq("restaurant_id", restaurant.id)
      .eq("role", "admin")
      .eq("is_active", true)
      .maybeSingle();
    assertNoPgError("Authorize Target Pulse update", staffError);
    if (!staff) {
      throw new Error("Only an active admin can update Target Pulse.");
    }
  }

  const { error } = await supabase
    .from("restaurants")
    .update({
      dashboard_target_amount: round2(amount),
      dashboard_target_start_at: startAt,
      dashboard_target_end_at: endAt,
      dashboard_target_period: period,
    })
    .eq("id", restaurant.id);
  if (error) {
    const message = String(error.message ?? "");
    const targetColumns = [
      "dashboard_target_amount",
      "dashboard_target_start_at",
      "dashboard_target_end_at",
      "dashboard_target_period",
    ];
    if (
      targetColumns.some((column) =>
        isMissingPgColumnError(message, column),
      )
    ) {
      throw new Error(
        "Mungojnë kolonat e Target Pulse. Ekzekuto supabase/ensure_dashboard_target_pulse.sql në Supabase SQL Editor.",
      );
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
  return { ok: true as const };
}

export async function getReportSchedules(licenseKey: string) {
  const restaurant = await getRestaurantByLicense(licenseKey);
  return {
    venueName: restaurant.name,
    schedules: normalizeReportSchedules(restaurant.dashboard_report_schedules),
  };
}

export async function saveReportSchedules(args: {
  licenseKey: string;
  staffId: string;
  schedules: unknown;
}) {
  const restaurant = await getRestaurantByLicense(args.licenseKey);
  if (!isLocalDevicePosAdmin(args.staffId)) {
    const staffId = uuidOrNull(args.staffId);
    if (!staffId) {
      throw new Error("Only an active admin can update report schedules.");
    }
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("id", staffId)
      .eq("restaurant_id", restaurant.id)
      .eq("role", "admin")
      .eq("is_active", true)
      .maybeSingle();
    assertNoPgError("Authorize report schedule update", staffError);
    if (!staff) {
      throw new Error("Only an active admin can update report schedules.");
    }
  }

  const schedules = normalizeReportSchedules(args.schedules);
  const { error } = await supabase
    .from("restaurants")
    .update({ dashboard_report_schedules: schedules })
    .eq("id", restaurant.id);
  if (error) {
    const message = String(error.message ?? "");
    if (isMissingPgColumnError(message, "dashboard_report_schedules")) {
      throw new Error(
        "Mungon kolona e raporteve. Ekzekuto supabase/ensure_dashboard_report_schedules.sql në Supabase SQL Editor.",
      );
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
  return { ok: true as const, schedules };
}

export async function markReportSchedulesSent(args: {
  licenseKey: string;
  sentIds: string[];
}) {
  const restaurant = await getRestaurantByLicense(args.licenseKey);
  const sentIds = new Set(
    (Array.isArray(args.sentIds) ? args.sentIds : []).map((id) => String(id)),
  );
  if (sentIds.size === 0) return { ok: true as const };
  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const schedules = normalizeReportSchedules(
    restaurant.dashboard_report_schedules,
  ).map((schedule) =>
    sentIds.has(schedule.id)
      ? { ...schedule, lastSentYmd: todayYmd }
      : schedule,
  );
  const { error } = await supabase
    .from("restaurants")
    .update({ dashboard_report_schedules: schedules })
    .eq("id", restaurant.id);
  if (error) {
    const message = String(error.message ?? "");
    if (isMissingPgColumnError(message, "dashboard_report_schedules")) {
      return { ok: false as const };
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
  return { ok: true as const, schedules };
}

export type SoldItemRangeRow = {
  name: string;
  quantity: number;
  revenue: number;
};

export async function getSoldItemsByDateTimeRange(args: {
  licenseKey: string;
  startIso: string;
  endIso: string;
}): Promise<SoldItemRangeRow[]> {
  const r = await getRestaurantByLicense(args.licenseKey);
  const startIso = String(args.startIso ?? "").trim();
  const endIso = String(args.endIso ?? "").trim();
  if (!startIso || !endIso || startIso >= endIso) return [];

  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("id")
    .eq("restaurant_id", r.id)
    .eq("status", "paid")
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  assertNoPgError("Sold-items sales range", salesErr);

  const saleIds = (sales ?? []).map((s) => String(s.id ?? "")).filter(Boolean);
  if (saleIds.length === 0) return [];

  const lineRows = await fetchSaleItemsForSaleIds(saleIds);
  const itemAgg = new Map<string, { quantity: number; revenue: number }>();
  for (const it of lineRows) {
    const st = String(it.status ?? "").toLowerCase();
    if (st === "voided" || st === "cancelled") continue;
    const name = String(it.name ?? "").trim() || "Item";
    const qty = Number(it.quantity ?? 0);
    const rev = Number(it.price ?? 0) * qty;
    const prev = itemAgg.get(name) ?? { quantity: 0, revenue: 0 };
    prev.quantity += qty;
    prev.revenue += rev;
    itemAgg.set(name, prev);
  }

  return [...itemAgg.entries()]
    .map(([name, v]) => ({
      name,
      quantity: Math.round(v.quantity * 1000) / 1000,
      revenue: Math.round(v.revenue * 100) / 100,
    }))
    .sort((a, b) => b.quantity - a.quantity);
}

export async function getZReport(args: {
  licenseKey: string;
  date?: string;
  staffId?: string;
}) {
  if (args.staffId) {
    await assertStaffPermission({
      licenseKey: args.licenseKey,
      staffId: args.staffId,
      permission: "canViewReports",
    });
  }
  const r = await getRestaurantByLicense(args.licenseKey);
  const target = args.date ? new Date(args.date) : new Date();
  const dayStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).toISOString();
  const dayEnd = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate() + 1,
  ).toISOString();

  const { data: dayOrders } = await supabase
    .from("sales")
    .select(
      "id, status, total, payment_method, payment_type, created_at, staff_id",
    )
    .eq("restaurant_id", r.id)
    .gte("created_at", dayStart)
    .lt("created_at", dayEnd);

  const paid = (dayOrders ?? []).filter((o) => o.status === "paid");
  const cancelled = (dayOrders ?? []).filter((o) => o.status === "cancelled");

  const normStaffId = (id: string) => String(id).trim().toLowerCase();

  /**
   * Staff breakdown: all non-cancelled sales for today, PLUS any still-unpaid sale
   * opened on an earlier calendar day (same rows the floor plan uses). Otherwise
   * open tabs from yesterday show $ on tables but 0 here because they miss the
   * created_at day filter.
   */
  const staffBreakdownMap = new Map<
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
  >();

  const addSaleToStaffBreakdown = (
    staffId: string | null | undefined,
    total: number,
    row?: {
      status?: string | null;
      paymentMethod?: string | null;
      paymentType?: string | null;
    },
  ) => {
    if (!staffId || String(staffId).trim() === "") return;
    const key = normStaffId(String(staffId));
    const prev = staffBreakdownMap.get(key) ?? {
      staffId: key,
      name: "Unknown",
      orders: 0,
      revenue: 0,
      paidCash: 0,
      paidCard: 0,
      paidDebt: 0,
      paidComplimentary: 0,
    };
    prev.orders += 1;
    prev.revenue += total;
    if (row && String(row.status ?? "").toLowerCase() === "paid") {
      const pt = String(row.paymentType ?? "fiscal");
      const pm = String(row.paymentMethod ?? "cash");
      if (pt === "debt") prev.paidDebt += total;
      else if (pt === "complimentary") prev.paidComplimentary += total;
      else if (pm === "card") prev.paidCard += total;
      else prev.paidCash += total;
    }
    staffBreakdownMap.set(key, prev);
  };

  for (const o of dayOrders ?? []) {
    if (String(o.status ?? "").toLowerCase() === "cancelled") continue;
    addSaleToStaffBreakdown(
      o.staff_id as string | null | undefined,
      Number(o.total ?? 0),
      {
        status: o.status as string | null,
        paymentMethod: o.payment_method as string | null,
        paymentType: o.payment_type as string | null,
      },
    );
  }

  const dayOrderIds = new Set((dayOrders ?? []).map((o) => String(o.id)));

  const { data: unpaidSales } = await supabase
    .from("sales")
    .select("id, status, total, staff_id")
    .eq("restaurant_id", r.id)
    .not("status", "eq", "paid")
    .not("status", "eq", "cancelled")
    .not("status", "eq", "voided");

  for (const o of unpaidSales ?? []) {
    if (dayOrderIds.has(String(o.id))) continue;
    addSaleToStaffBreakdown(
      o.staff_id as string | null | undefined,
      Number(o.total ?? 0),
      undefined,
    );
  }

  const breakdownStaffIds = [...staffBreakdownMap.keys()];
  const staffNameById = new Map<string, string>();
  if (breakdownStaffIds.length > 0) {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", breakdownStaffIds);
    for (const row of staffRows ?? []) {
      const id = normStaffId(String(row.id));
      staffNameById.set(id, String(row.name ?? "Unknown"));
    }
  }

  const staffBreakdown = [...staffBreakdownMap.values()]
    .map((s) => ({
      staffId: s.staffId,
      name: staffNameById.get(s.staffId) ?? s.name,
      orders: s.orders,
      revenue: Math.round(s.revenue * 100) / 100,
      paidCash: Math.round(s.paidCash * 100) / 100,
      paidCard: Math.round(s.paidCard * 100) / 100,
      paidDebt: Math.round(s.paidDebt * 100) / 100,
      paidComplimentary: Math.round(s.paidComplimentary * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  let barRevenue = 0;
  let kitchenRevenue = 0;
  let voidsTotal = 0;
  let voidedCount = 0;
  for (const o of dayOrders ?? []) {
    let itemsRes = await supabase
      .from("sale_items")
      .select("price, quantity, status, station")
      .eq("sale_id", o.id);
    if (
      itemsRes.error &&
      isMissingPgColumnError(itemsRes.error.message, "station")
    ) {
      itemsRes = await supabase
        .from("sale_items")
        .select("price, quantity, status")
        .eq("sale_id", o.id);
    }
    const items = itemsRes.error ? [] : (itemsRes.data ?? []);
    for (const it of items) {
      if (it.status === "voided") {
        voidedCount += Number(it.quantity);
        voidsTotal += Number(it.price) * Number(it.quantity);
        continue;
      }
      if (it.status === "cancelled") continue;
      if (o.status === "paid") {
        const line = Number(it.price) * Number(it.quantity);
        if ("station" in it && it.station === "bar") barRevenue += line;
        else kitchenRevenue += line;
      }
    }
  }

  barRevenue = Math.round(barRevenue * 100) / 100;
  kitchenRevenue = Math.round(kitchenRevenue * 100) / 100;
  const grossRevenue = Math.round((barRevenue + kitchenRevenue) * 100) / 100;

  const cashTotal = paid
    .filter(
      (o) =>
        o.payment_type !== "debt" &&
        o.payment_type !== "complimentary" &&
        o.payment_method !== "card",
    )
    .reduce((s, o) => s + Number(o.total), 0);
  const cardTotal = paid
    .filter(
      (o) =>
        o.payment_method === "card" &&
        o.payment_type !== "complimentary",
    )
    .reduce((s, o) => s + Number(o.total), 0);
  const debtTotal = paid
    .filter((o) => o.payment_type === "debt")
    .reduce((s, o) => s + Number(o.total), 0);
  const complimentaryTotal = paid
    .filter((o) => o.payment_type === "complimentary")
    .reduce((s, o) => s + Number(o.total), 0);
  const wasteTotal = Math.round(
    cancelled.reduce((s, o) => s + Number(o.total ?? 0), 0) * 100,
  ) / 100;
  voidsTotal = Math.round(voidsTotal * 100) / 100;

  const totalToHandOver = Math.round(
    (grossRevenue -
      cardTotal -
      debtTotal -
      complimentaryTotal -
      wasteTotal -
      voidsTotal) *
      100,
  ) / 100;

  const { count: priorZCount } = await supabase
    .from("pos_z_reports")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", r.id);
  const nextZNumber = (priorZCount ?? 0) + 1;

  const { data: allShiftRows } = await supabase
    .from("shifts")
    .select("id, staff_id, clock_in, clock_out, opening_cash")
    .eq("restaurant_id", r.id);

  const shiftsForReport = (allShiftRows ?? []).filter((sh) => {
    const cin = String(sh.clock_in);
    const inToday = cin >= dayStart && cin < dayEnd;
    const stillOpen = sh.clock_out == null;
    return inToday || (stillOpen && cin < dayStart);
  });

  shiftsForReport.sort(
    (a, b) =>
      new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime(),
  );

  const shiftStaffIds = [
    ...new Set(
      shiftsForReport
        .map((sh) => sh.staff_id)
        .filter((id): id is string => id != null && String(id).trim() !== ""),
    ),
  ];
  const shiftStaffById = new Map<
    string,
    { name: string; role?: string | null }
  >();
  if (shiftStaffIds.length > 0) {
    const { data: stShift } = await supabase
      .from("staff")
      .select("id, name, role")
      .in("id", shiftStaffIds);
    for (const row of stShift ?? []) {
      shiftStaffById.set(String(row.id), {
        name: String(row.name ?? "Unknown"),
        role: row.role,
      });
    }
  }

  const shiftDetails: Array<{
    staffId?: string;
    shiftId?: string;
    staffName: string;
    staffRole?: string;
    clockIn: string;
    clockOut: string | null;
    openingCash?: number;
  }> = shiftsForReport.map((sh) => {
    const st = sh.staff_id
      ? shiftStaffById.get(String(sh.staff_id))
      : undefined;
    return {
      shiftId: sh.id,
      staffId:
        sh.staff_id != null
          ? normStaffId(String(sh.staff_id))
          : undefined,
      staffName: st?.name ?? "Unknown",
      staffRole: st?.role ?? undefined,
      clockIn: sh.clock_in,
      clockOut: sh.clock_out,
      openingCash:
        sh.opening_cash != null ? Number(sh.opening_cash) : undefined,
    };
  });

  const nowIso = new Date().toISOString();
  let totalOpeningCash = 0;
  for (const s of shiftDetails) {
    if (s.openingCash) totalOpeningCash += s.openingCash;
  }

  const earliestShift =
    shiftDetails.length > 0
      ? shiftDetails.reduce(
          (min, s) => (s.clockIn < min ? s.clockIn : min),
          shiftDetails[0].clockIn,
        )
      : dayStart;
  const latestShift =
    shiftDetails.length > 0
      ? shiftDetails.reduce((max, s) => {
          const end = s.clockOut ?? nowIso;
          return end > max ? end : max;
        }, shiftDetails[0].clockIn)
      : nowIso;

  return {
    zNumber: nextZNumber,
    restaurantName: r.name,
    currency: r.currency,
    date: dayStart,
    shiftStart: earliestShift,
    shiftEnd: latestShift,
    shiftDetails,
    staffBreakdown,
    barRevenue,
    kitchenRevenue,
    grossRevenue,
    cashTotal: Math.round(cashTotal * 100) / 100,
    cardTotal: Math.round(cardTotal * 100) / 100,
    debtTotal: Math.round(debtTotal * 100) / 100,
    complimentaryTotal: Math.round(complimentaryTotal * 100) / 100,
    wasteTotal,
    voidsTotal,
    totalToHandOver,
    paidOrders: paid.length,
    totalOrders: (dayOrders ?? []).length,
    cancelledOrders: cancelled.length,
    voidedCount,
    openingCash: totalOpeningCash > 0 ? totalOpeningCash : undefined,
  };
}

export async function getZReportHistory(licenseKey: string, staffId?: string) {
  if (staffId) {
    await assertStaffPermission({
      licenseKey,
      staffId,
      permission: "canViewReports",
    });
  }
  const r = await getRestaurantByLicense(licenseKey);
  const { data, error } = await supabase
    .from("pos_z_reports")
    .select("*")
    .eq("restaurant_id", r.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((row) => ({
    _id: row.id,
    zNumber: row.z_number,
    createdAt: row.created_at,
    ...(typeof row.payload === "object" && row.payload
      ? (row.payload as Record<string, unknown>)
      : {}),
  }));
}

export async function closeDay(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  const r = await getRestaurantByLicense(licenseKey);

  const pinHash = String(args.pinHash ?? "").trim();
  const staffUuid = uuidOrNull(args.staffId as string | undefined);

  let authorizedId: string | null = null;
  let authorizedName =
    String(args.staffName ?? "").trim() || "Unknown";
  let devicePinAuthorized = false;

  // Prefer PIN proof: works when signed in as waiter or device "local-admin" but admin PIN is entered.
  if (pinHash.length >= 64) {
    const { data: pinRows, error: pinErr } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("restaurant_id", r.id)
      .eq("pin_hash", pinHash)
      .eq("is_active", true)
      .limit(5);
    if (!pinErr && pinRows?.length) {
      const hit = pinRows.find((row) => {
        const rl = String(row.role ?? "").toLowerCase();
        return rl === "admin" || rl === "manager";
      });
      if (hit) {
        authorizedId = String(hit.id);
        authorizedName = String(hit.name ?? authorizedName);
      }
    }
  }

  // Device quick-login PIN (synced to restaurants.pos_device_close_pin_hash from POS)
  if (!authorizedId && pinHash.length >= 64) {
    const stored = String(r.pos_device_close_pin_hash ?? "").trim();
    if (stored === pinHash) {
      devicePinAuthorized = true;
      const { data: team, error: teamErr } = await supabase
        .from("staff")
        .select("id, name, role")
        .eq("restaurant_id", r.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (!teamErr && team?.length) {
        const adminHit = team.find((row) => {
          const rl = String(row.role ?? "").toLowerCase();
          return rl === "admin" || rl === "manager";
        });
        if (adminHit) {
          authorizedId = String(adminHit.id);
          authorizedName = String(adminHit.name ?? authorizedName);
        }
      }
      if (!authorizedId) {
        authorizedName = authorizedName || "Admin pajisje";
      }
    }
  }

  if (!authorizedId && staffUuid) {
    const { data: roleRow, error: roleErr } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("id", staffUuid)
      .eq("restaurant_id", r.id)
      .maybeSingle();
    if (!roleErr && roleRow) {
      const role = String(roleRow.role ?? "").toLowerCase();
      if (role === "admin" || role === "manager") {
        authorizedId = staffUuid;
        authorizedName = String(roleRow.name ?? authorizedName);
      }
    }
  }

  if (!authorizedId && !devicePinAuthorized) {
    throw new Error(
      "Mbyllja e ditës: futni PIN-in e saktë të adminit/menaxherit (nga Stafi) ose PIN-in e shpejtë të pajisjes. Nëse sapo përditësuat PIN-in lokal, provoni përsëri — sistemi e ruan automatikisht. Nëse gabimi vazhdon, në Supabase ekzekutoni skriptin supabase/ensure_pos_device_close_pin.sql.",
    );
  }

  const rawReport = args.reportData as Record<string, unknown>;
  const reportData: Record<string, unknown> = { ...rawReport };
  const cashExpenses = Number(args.cashExpenses ?? 0);
  const zNumber = (reportData.zNumber as number) ?? 1;
  const baseHandOver = Number(reportData.totalToHandOver ?? 0);
  const finalHandOver = Math.round((baseHandOver - cashExpenses) * 100) / 100;

  reportData.cashExpenses = cashExpenses;
  reportData.totalToHandOver = finalHandOver;
  reportData.closedAt = new Date().toISOString();

  const { error: zInsertErr } = await supabase.from("pos_z_reports").insert({
    restaurant_id: r.id,
    z_number: zNumber,
    payload: reportData,
  });
  if (zInsertErr) {
    const zm = String(zInsertErr.message ?? "");
    if (isMissingSupabaseTableError(zm, "pos_z_reports")) {
      throw new Error(
        "Mungon tabela pos_z_reports në Supabase. Hap SQL Editor dhe ekzekuto skriptin: supabase/ensure_pos_z_reports.sql (ose migrations/002_pos_from_convex.sql). Pastaj në Dashboard: Settings → API → Restart PostgREST, ose prit 1–2 minuta që schema cache të rifreskohet.",
      );
    }
    throw zInsertErr;
  }

  const now = new Date().toISOString();
  const { error: shiftUpdErr } = await supabase
    .from("shifts")
    .update({ clock_out: now })
    .eq("restaurant_id", r.id)
    .is("clock_out", null);
  if (shiftUpdErr) {
    console.warn("[POS] closeDay close shifts:", shiftUpdErr.message);
  }

  const { error: expErr } = await supabase
    .from("pos_expenses")
    .update({ cleared: true })
    .eq("restaurant_id", r.id);
  if (expErr) {
    console.warn("[POS] closeDay clear expenses:", expErr.message);
  }

  const { error: consErr } = await supabase
    .from("pos_staff_consumption")
    .update({ cleared: true })
    .eq("restaurant_id", r.id)
    .eq("cleared", false);
  if (consErr) {
    const msg = String(consErr.message ?? "");
    if (!msg.includes("pos_staff_consumption")) {
      console.warn("[POS] closeDay clear consumption:", consErr.message);
    }
  }

  try {
    const gross = Number(reportData.grossRevenue ?? 0);
    const cardTotal = Number(reportData.cardTotal ?? 0);
    const debtTotal = Number(reportData.debtTotal ?? 0);
    const compTotal = Number(reportData.complimentaryTotal ?? 0);
    const wasteTotal = Number(reportData.wasteTotal ?? 0);
    const voidsTotal = Number(reportData.voidsTotal ?? 0);
    const sym = r.currency_symbol?.trim() || "€";
    const details = `Z-Report #${String(zNumber).padStart(3, "0")} closed. Gross: ${sym}${gross.toFixed(2)}, Deductions: Card ${sym}${cardTotal.toFixed(2)}, Debt ${sym}${debtTotal.toFixed(2)}, Comp ${sym}${compTotal.toFixed(2)}, Waste ${sym}${wasteTotal.toFixed(2)}, Voids ${sym}${voidsTotal.toFixed(2)}, Expenses ${sym}${cashExpenses.toFixed(2)}. Total to hand over: ${sym}${finalHandOver.toFixed(2)}`;
    await insertAuditLog({
      licenseKey,
      staffId: authorizedId ?? undefined,
      staffName: authorizedName,
      action: "day_close",
      details,
      metadata: { zNumber },
    });
  } catch (err) {
    console.warn("[POS] day_close audit log:", err);
  }

  return { zNumber, totalToHandOver: finalHandOver };
}

export async function getAuditLogs(args: {
  licenseKey: string;
  limit?: number;
  staffId?: string;
}) {
  if (args.staffId) {
    await assertStaffPermission({
      licenseKey: args.licenseKey,
      staffId: args.staffId,
      permission: "canViewAuditLog",
    });
  }
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("pos_audit_logs")
    .select("*")
    .eq("restaurant_id", r.id)
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 200);
  if (error) {
    const msg = String(error.message ?? "");
    if (isMissingSupabaseTableError(msg, "pos_audit_logs")) {
      console.error(
        "[POS] Table pos_audit_logs is missing. In Supabase SQL Editor run supabase/ensure_pos_audit_logs.sql (or migrations/002_pos_from_convex.sql).",
      );
      throw new Error("AUDIT_LOG_TABLE_MISSING");
    }
    console.warn("[POS] pos_audit_logs select:", error.message);
    throw new Error(
      msg || "AUDIT_LOG_LOAD_FAILED",
    );
  }
  return (data ?? []).map((row) => ({
    _id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    action: row.action,
    details: row.details,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

function isAuditLogStaffFkViolation(error: {
  message?: string;
  code?: string;
}): boolean {
  const m = String(error.message ?? "").toLowerCase();
  const code = String(error.code ?? "");
  if (code !== "23503") return false;
  return (
    m.includes("staff_id") ||
    m.includes("pos_audit_logs_staff_id") ||
    (m.includes("foreign key") && m.includes("staff"))
  );
}

/** Append one row to `pos_audit_logs` (orders, security, etc.). Best-effort: logs a warning on failure. */
export async function insertAuditLog(args: {
  licenseKey: string;
  staffName: string;
  action: string;
  details: string;
  staffId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const r = await getRestaurantByLicense(args.licenseKey);
  let staffId = uuidOrNull(args.staffId ?? undefined);
  const row = {
    restaurant_id: r.id,
    staff_id: staffId,
    staff_name: args.staffName.slice(0, 200),
    action: args.action,
    details: args.details.slice(0, 4000),
    metadata: args.metadata ?? null,
  };

  let { error } = await supabase.from("pos_audit_logs").insert(row);
  if (error && staffId && isAuditLogStaffFkViolation(error)) {
    staffId = null;
    ({ error } = await supabase.from("pos_audit_logs").insert({
      ...row,
      staff_id: null,
    }));
  }
  if (error) {
    const msg = String(error.message ?? "");
    if (isMissingSupabaseTableError(msg, "pos_audit_logs")) {
      console.error(
        "[POS] pos_audit_logs table missing — cannot record audit. Run supabase/ensure_pos_audit_logs.sql in Supabase SQL Editor.",
      );
    }
    console.warn("[POS] pos_audit_logs insert:", error.message);
    return;
  }
}
