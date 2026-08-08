import { supabase } from "@/lib/supabase.ts";
import {
  maxEffectiveTerminalsForLicense,
} from "@/pages/pos/_lib/plan-features.ts";

export function parseRegisteredDeviceIds(
  registeredDevices: unknown,
  legacyDeviceId: string | null | undefined,
): string[] {
  if (Array.isArray(registeredDevices)) {
    const ids = registeredDevices.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    if (ids.length > 0) return ids;
  }
  if (legacyDeviceId?.trim()) return [legacyDeviceId.trim()];
  return [];
}

export type DashboardSetupStep = {
  id: string;
  done: boolean;
};

export type DashboardSetupProgress = {
  steps: DashboardSetupStep[];
  percent: number;
};

export type DashboardActivityItem = {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
};

export type DashboardMonthlyOverview = {
  sales: number;
  orders: number;
  averageOrder: number;
  points: number[];
};

export async function fetchDashboardSetupProgress(
  restaurantId: string,
  opts: {
    licenseActive: boolean;
    hasRegisteredDevice: boolean;
  },
): Promise<DashboardSetupProgress> {
  const [printers, tables, items] = await Promise.all([
    supabase
      .from("pos_printers")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("pos_floor_tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId),
  ]);

  const steps: DashboardSetupStep[] = [
    { id: "install", done: true },
    {
      id: "activate",
      done: opts.licenseActive && opts.hasRegisteredDevice,
    },
    { id: "printer", done: (printers.count ?? 0) > 0 },
    { id: "tables", done: (tables.count ?? 0) > 0 },
    { id: "products", done: (items.count ?? 0) > 0 },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  return { steps, percent };
}

export async function fetchDashboardRecentActivity(
  restaurantId: string,
  limit = 5,
): Promise<DashboardActivityItem[]> {
  const { data, error } = await supabase
    .from("pos_audit_logs")
    .select("id, action, details, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  return data.map((row) => ({
    id: String(row.id),
    action: String(row.action ?? "event"),
    details: row.details != null ? String(row.details) : null,
    createdAt: String(row.created_at),
  }));
}

export async function fetchDashboardMonthlyOverview(
  restaurantId: string,
): Promise<DashboardMonthlyOverview> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const { data, error } = await supabase
    .from("sales")
    .select("total, created_at, status")
    .eq("restaurant_id", restaurantId)
    .eq("status", "paid")
    .gte("created_at", monthStart.toISOString());

  if (error || !data) {
    return { sales: 0, orders: 0, averageOrder: 0, points: Array(daysInMonth).fill(0) };
  }

  const points = Array<number>(daysInMonth).fill(0);
  let sales = 0;
  for (const row of data) {
    const total = Number(row.total ?? 0);
    sales += total;
    const day = new Date(String(row.created_at)).getDate();
    if (day >= 1 && day <= daysInMonth) points[day - 1] += total;
  }

  return {
    sales: Math.round(sales * 100) / 100,
    orders: data.length,
    averageOrder: data.length > 0 ? Math.round((sales / data.length) * 100) / 100 : 0,
    points,
  };
}

export function effectiveMaxTerminals(
  plan: string,
  storedMax: number | null | undefined,
): number {
  return maxEffectiveTerminalsForLicense(plan, storedMax);
}
