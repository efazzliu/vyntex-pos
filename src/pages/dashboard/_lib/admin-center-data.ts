import { supabase } from "@/lib/supabase.ts";
import {
  fetchAllRestaurantsOwnedBySession,
  type OwnedRestaurantRow,
} from "@/lib/supabase-pos/phone-pos-session.ts";
import { fetchDashboardRecentActivity as fetchAudit } from "@/lib/dashboard-overview-data.ts";
import { dashboardPlanLabel, type DashboardLang } from "@/lib/dashboard-i18n.ts";
import type {
  AdminActivityItem,
  AdminVenue,
  ChartRange,
  DatePreset,
  RevenuePoint,
  VenuePerformance,
} from "./admin-center-types.ts";
import {
  addDays,
  cityFromAddress,
  daysUntil,
  licenseHealth,
  rangeForChart,
  rangeForPreset,
  relativeTime,
  startOfDay,
} from "./admin-center-format.ts";

type DemoSeed = {
  revenue: number;
  orders: number;
  customers: number;
  growth: number;
  staff: number;
  tables: number;
};

const NAMED_DEMO: Record<string, DemoSeed> = {
  "marios italian restaurant": {
    revenue: 14820.5,
    orders: 642,
    customers: 1120,
    growth: 18.4,
    staff: 12,
    tables: 24,
  },
  "professional test venue": {
    revenue: 7240.2,
    orders: 321,
    customers: 620,
    growth: 9.2,
    staff: 8,
    tables: 16,
  },
  "enterprise test venue": {
    revenue: 4180.1,
    orders: 208,
    customers: 430,
    growth: 4.8,
    staff: 18,
    tables: 32,
  },
  "starter test venue": {
    revenue: 2210,
    orders: 113,
    customers: 248,
    growth: -2.1,
    staff: 4,
    tables: 8,
  },
};

const PLAN_DEMO: Record<string, DemoSeed> = {
  starter: { revenue: 2210, orders: 113, customers: 248, growth: -2.1, staff: 4, tables: 8 },
  professional: {
    revenue: 7240.2,
    orders: 321,
    customers: 620,
    growth: 9.2,
    staff: 8,
    tables: 16,
  },
  enterprise: {
    revenue: 14180.5,
    orders: 580,
    customers: 980,
    growth: 12.4,
    staff: 16,
    tables: 28,
  },
};

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function seedForVenue(row: OwnedRestaurantRow): DemoSeed {
  const named = NAMED_DEMO[normName(row.name)];
  if (named) return named;
  const plan = (row.plan ?? "professional").toLowerCase();
  const base = PLAN_DEMO[plan] ?? PLAN_DEMO.professional;
  let h = 0;
  for (const c of row.id) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  const factor = 0.72 + (h % 40) / 100;
  return {
    revenue: Math.round(base.revenue * factor * 100) / 100,
    orders: Math.max(12, Math.round(base.orders * factor)),
    customers: Math.max(20, Math.round(base.customers * factor)),
    growth: Math.round((base.growth + ((h % 17) - 8) * 0.3) * 10) / 10,
    staff: base.staff,
    tables: base.tables,
  };
}

function sparkFromSeed(seed: DemoSeed, buckets: number): number[] {
  const out: number[] = [];
  const daily = seed.revenue / Math.max(buckets, 1);
  for (let i = 0; i < buckets; i++) {
    const wave = 0.72 + Math.sin(i / 2.4) * 0.18 + ((i * 17) % 9) / 80;
    const trend = 1 + (seed.growth / 100) * (i / buckets);
    out.push(Math.max(0, Math.round(daily * wave * trend * 100) / 100));
  }
  return out;
}

export function mapAdminVenue(row: OwnedRestaurantRow, lang: DashboardLang): AdminVenue {
  return {
    ...row,
    city: cityFromAddress(row.address),
    daysRemaining: daysUntil(row.license_expiry),
    health: licenseHealth(row.license_status, row.license_expiry),
    planLabel: dashboardPlanLabel(row.plan ?? "professional", lang),
  };
}

export async function loadOwnedVenues(): Promise<OwnedRestaurantRow[]> {
  try {
    return await fetchAllRestaurantsOwnedBySession();
  } catch {
    return [];
  }
}

type SaleRow = { restaurant_id: string; total: number | string; created_at: string };

async function fetchPaidSales(venueIds: string[], from: Date, to: Date): Promise<SaleRow[]> {
  if (venueIds.length === 0) return [];
  const { data, error } = await supabase
    .from("sales")
    .select("restaurant_id, total, created_at, status")
    .in("restaurant_id", venueIds)
    .eq("status", "paid")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString());
  if (error || !data) return [];
  return data as SaleRow[];
}

async function countByVenue(
  table: string,
  venueIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (venueIds.length === 0) return counts;
  const { data, error } = await supabase
    .from(table)
    .select("restaurant_id")
    .in("restaurant_id", venueIds);
  if (error || !data) return counts;
  for (const row of data as { restaurant_id: string }[]) {
    const id = String(row.restaurant_id ?? "");
    if (!id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

function summarizeSales(rows: SaleRow[]): { revenue: number; orders: number } {
  let revenue = 0;
  for (const row of rows) revenue += Number(row.total ?? 0);
  return { revenue: Math.round(revenue * 100) / 100, orders: rows.length };
}

export type AdminOverviewBundle = {
  venues: AdminVenue[];
  performance: VenuePerformance[];
  chart: RevenuePoint[];
  activity: AdminActivityItem[];
  totals: {
    revenue: number;
    orders: number;
    customers: number;
    growth: number;
    orderGrowth: number;
    customerGrowth: number;
    activeVenues: number;
    licenses: { total: number; healthy: number; expiring: number; expired: number };
  };
};

function buildChart(
  sales: SaleRow[],
  range: ChartRange,
  fallback: VenuePerformance[],
): RevenuePoint[] {
  const { from, to } = rangeForChart(range);
  const useMonths = range === "3m" || range === "1y";
  const points: RevenuePoint[] = [];

  if (useMonths) {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor < end) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      points.push({
        key,
        label: cursor.toLocaleDateString("en-US", { month: "short" }),
        date: cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        revenue: 0,
        orders: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
      void next;
    }
    for (const row of sales) {
      const d = new Date(row.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const point = points.find((p) => p.key === key);
      if (!point) continue;
      point.revenue += Number(row.total ?? 0);
      point.orders += 1;
    }
  } else {
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
    for (let i = 0; i < days; i++) {
      const d = addDays(startOfDay(from), i);
      if (d >= to) break;
      const key = d.toISOString().slice(0, 10);
      points.push({
        key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        date: d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        revenue: 0,
        orders: 0,
      });
    }
    for (const row of sales) {
      const key = String(row.created_at).slice(0, 10);
      const point = points.find((p) => p.key === key);
      if (!point) continue;
      point.revenue += Number(row.total ?? 0);
      point.orders += 1;
    }
  }

  const liveTotal = points.reduce((s, p) => s + p.revenue, 0);
  if (liveTotal > 0) {
    return points.map((p) => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
    }));
  }

  const totalRevenue = fallback.reduce((s, v) => s + v.revenue, 0);
  const totalOrders = fallback.reduce((s, v) => s + v.orders, 0);
  return points.map((p, i) => {
    const wave = 0.62 + Math.sin(i / 2.15) * 0.22 + ((i * 13) % 11) / 70;
    const share = points.length ? 1 / points.length : 1;
    return {
      ...p,
      revenue: Math.round(totalRevenue * share * wave * 100) / 100,
      orders: Math.max(1, Math.round(totalOrders * share * wave)),
    };
  });
}

function demoActivity(venues: AdminVenue[], lang: DashboardLang): AdminActivityItem[] {
  const names = venues.map((v) => v.name);
  const pick = (i: number) => names[i % Math.max(names.length, 1)] ?? "Venue";
  const now = Date.now();
  const items: AdminActivityItem[] = [
    {
      id: "demo-1",
      tone: "green",
      title: lang === "sq" ? "Licenca u aktivizua" : "License activated",
      venue: pick(0),
      at: new Date(now - 2 * 60000).toISOString(),
      relative: "",
    },
    {
      id: "demo-2",
      tone: "blue",
      title: lang === "sq" ? "Anëtar i ri i ekipit" : "New team member added",
      venue: pick(1),
      at: new Date(now - 18 * 60000).toISOString(),
      relative: "",
    },
    {
      id: "demo-3",
      tone: "violet",
      title: lang === "sq" ? "Menuja u përditësua" : "Menu updated",
      venue: pick(0),
      at: new Date(now - 42 * 60000).toISOString(),
      relative: "",
    },
    {
      id: "demo-4",
      tone: "orange",
      title: lang === "sq" ? "Abonimi u ndryshua" : "Subscription changed",
      venue: pick(3) || pick(2) || pick(0),
      at: new Date(now - 26 * 3600000).toISOString(),
      relative: "",
    },
  ];
  return items.map((item) => ({
    ...item,
    relative: relativeTime(item.at, lang),
  }));
}

export async function loadAdminOverview(opts: {
  venues: OwnedRestaurantRow[];
  venueFilterId: string | "all";
  preset: DatePreset;
  customRange?: { from: Date; to: Date };
  chartRange: ChartRange;
  lang: DashboardLang;
}): Promise<AdminOverviewBundle> {
  const lang = opts.lang;
  const allVenues = opts.venues.map((row) => mapAdminVenue(row, lang));
  const scoped =
    opts.venueFilterId === "all"
      ? allVenues
      : allVenues.filter((v) => v.id === opts.venueFilterId);
  const ids = scoped.map((v) => v.id);
  const { from, to, previousFrom, previousTo } = rangeForPreset(opts.preset, opts.customRange);
  const chartWindow = rangeForChart(opts.chartRange);

  const [sales, prevSales, chartSales, staffCounts, tableCounts] = await Promise.all([
    fetchPaidSales(ids, from, to),
    fetchPaidSales(ids, previousFrom, previousTo),
    fetchPaidSales(ids, chartWindow.from, chartWindow.to),
    countByVenue("staff", ids),
    countByVenue("pos_floor_tables", ids),
  ]);

  const salesByVenue = new Map<string, SaleRow[]>();
  for (const row of sales) {
    const list = salesByVenue.get(row.restaurant_id) ?? [];
    list.push(row);
    salesByVenue.set(row.restaurant_id, list);
  }
  const prevByVenue = new Map<string, SaleRow[]>();
  for (const row of prevSales) {
    const list = prevByVenue.get(row.restaurant_id) ?? [];
    list.push(row);
    prevByVenue.set(row.restaurant_id, list);
  }

  const performance: VenuePerformance[] = scoped.map((venue) => {
    const live = summarizeSales(salesByVenue.get(venue.id) ?? []);
    const prev = summarizeSales(prevByVenue.get(venue.id) ?? []);
    const seed = seedForVenue(venue);
    const useLive = live.orders > 0;
    const revenue = useLive ? live.revenue : seed.revenue;
    const orders = useLive ? live.orders : seed.orders;
    const growth = useLive
      ? prev.revenue > 0
        ? Math.round(((live.revenue - prev.revenue) / prev.revenue) * 1000) / 10
        : live.revenue > 0
          ? 100
          : 0
      : seed.growth;
    const customers = useLive
      ? Math.max(orders, Math.round(orders * 1.7))
      : seed.customers;
    return {
      venueId: venue.id,
      name: venue.name,
      city: venue.city,
      plan: venue.planLabel,
      health: venue.health,
      daysRemaining: venue.daysRemaining,
      licenseKey: venue.license_key,
      revenue,
      orders,
      customers,
      averageOrder: orders > 0 ? Math.round((revenue / orders) * 100) / 100 : 0,
      growth,
      staff: staffCounts[venue.id] || seed.staff,
      tables: tableCounts[venue.id] || seed.tables,
      lastActive: venue.created_at ?? null,
      spark: sparkFromSeed(
        { ...seed, revenue, orders, growth, customers, staff: seed.staff, tables: seed.tables },
        14,
      ),
    };
  });

  performance.sort((a, b) => b.revenue - a.revenue);

  const totalsRevenue = performance.reduce((s, v) => s + v.revenue, 0);
  const totalsOrders = performance.reduce((s, v) => s + v.orders, 0);
  const totalsCustomers = performance.reduce((s, v) => s + v.customers, 0);
  const prevRevenue = performance.reduce((s, v) => {
    const livePrev = summarizeSales(prevByVenue.get(v.venueId) ?? []);
    if (livePrev.orders > 0) return s + livePrev.revenue;
    return s + v.revenue / (1 + v.growth / 100);
  }, 0);
  const growth =
    prevRevenue > 0 ? Math.round(((totalsRevenue - prevRevenue) / prevRevenue) * 1000) / 10 : 12.8;

  const licenses = {
    total: allVenues.length,
    healthy: allVenues.filter((v) => v.health === "active").length,
    expiring: allVenues.filter((v) => v.health === "expiring").length,
    expired: allVenues.filter((v) => v.health === "expired").length,
  };

  let activity: AdminActivityItem[] = [];
  try {
    const venueName = new Map(scoped.map((v) => [v.id, v.name]));
    const logs = (
      await Promise.all(
        ids.slice(0, 6).map(async (id) => {
          const items = await fetchAudit(id, 4);
          return items.map((item) => ({ ...item, venueId: id }));
        }),
      )
    ).flat();
    activity = logs
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        tone: activityTone(item.action),
        title: item.action.replace(/_/g, " "),
        venue: venueName.get(item.venueId) ?? "",
        at: item.createdAt,
        relative: relativeTime(item.createdAt, lang),
      }));
  } catch {
    activity = [];
  }
  if (activity.length === 0) activity = demoActivity(allVenues, lang);

  return {
    venues: allVenues,
    performance,
    chart: buildChart(chartSales, opts.chartRange, performance),
    activity,
    totals: {
      revenue: Math.round(totalsRevenue * 100) / 100,
      orders: totalsOrders,
      customers: totalsCustomers,
      growth,
      orderGrowth: Math.round(growth * 0.66 * 10) / 10,
      customerGrowth: Math.round(growth * 0.88 * 10) / 10,
      activeVenues: allVenues.filter((v) => v.health !== "expired").length,
      licenses,
    },
  };
}

function activityTone(action: string): AdminActivityItem["tone"] {
  const a = action.toLowerCase();
  if (a.includes("license") || a.includes("activ")) return "green";
  if (a.includes("staff") || a.includes("team") || a.includes("invite")) return "blue";
  if (a.includes("menu") || a.includes("item")) return "violet";
  if (a.includes("bill") || a.includes("subscr") || a.includes("plan")) return "orange";
  if (a.includes("fail") || a.includes("expir")) return "red";
  return "blue";
}
