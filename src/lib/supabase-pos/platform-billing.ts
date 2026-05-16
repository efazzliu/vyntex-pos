import {
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { supabase } from "@/lib/supabase.ts";
import { isMissingSupabaseTableError } from "@/lib/supabase-pos/db-errors.ts";
import {
  normalizePlan,
  type PlanName,
} from "@/pages/pos/_lib/plan-features.ts";
import type {
  AdminMrrTrendPoint,
  AdminPlanDistribution,
  AdminPlanDistributionRange,
  AdminRecentTransaction,
} from "@/lib/supabase-pos/admin-revenue-types.ts";

const BILLING_TABLE = "platform_billing_transactions";

export type PlatformBillingRow = {
  id: string;
  paddle_event_id: string;
  paddle_transaction_id: string | null;
  paddle_subscription_id: string | null;
  restaurant_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  plan: string | null;
  billing_cycle: string | null;
  amount_minor: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

const billingSelect =
  "id, paddle_event_id, paddle_transaction_id, paddle_subscription_id, restaurant_id, customer_email, customer_name, plan, billing_cycle, amount_minor, currency, status, paid_at, created_at";

let billingTableMissing = false;

export function isPlatformBillingAvailable(): boolean {
  return !billingTableMissing;
}

export async function listPlatformBillingTransactions(): Promise<PlatformBillingRow[]> {
  if (billingTableMissing) return [];

  const { data, error } = await supabase
    .from(BILLING_TABLE)
    .select(billingSelect)
    .order("paid_at", { ascending: false, nullsFirst: false });

  if (error) {
    if (isMissingSupabaseTableError(error.message, BILLING_TABLE)) {
      billingTableMissing = true;
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as PlatformBillingRow[];
}

function amountEur(row: PlatformBillingRow): number {
  const minor = Number(row.amount_minor) || 0;
  const cur = (row.currency ?? "EUR").toUpperCase();
  if (cur !== "EUR") return minor / 100;
  return minor / 100;
}

function paidRows(rows: PlatformBillingRow[]): PlatformBillingRow[] {
  return rows.filter((r) => r.status === "paid" && r.paid_at);
}

function subscriberKey(row: PlatformBillingRow): string {
  if (row.paddle_subscription_id?.trim()) {
    return `sub:${row.paddle_subscription_id.trim()}`;
  }
  const email = row.customer_email?.trim().toLowerCase() ?? "";
  const plan = row.plan?.trim() ?? "";
  return `email:${email}|${plan}`;
}

function monthlyContributionEur(row: PlatformBillingRow): number {
  const paid = amountEur(row);
  const cycle = row.billing_cycle === "yearly" ? "yearly" : "monthly";
  return cycle === "yearly" ? paid / 12 : paid;
}

function isSubscriptionActive(row: PlatformBillingRow, nowMs: number): boolean {
  const paidMs = row.paid_at ? new Date(row.paid_at).getTime() : Number.NaN;
  if (!Number.isFinite(paidMs)) return false;
  const cycle = row.billing_cycle === "yearly" ? "yearly" : "monthly";
  const graceMs = cycle === "yearly" ? 400 * 24 * 60 * 60 * 1000 : 40 * 24 * 60 * 60 * 1000;
  return nowMs - paidMs <= graceMs;
}

function latestPaidBySubscriber(rows: PlatformBillingRow[]): PlatformBillingRow[] {
  const map = new Map<string, PlatformBillingRow>();
  for (const row of paidRows(rows)) {
    const key = subscriberKey(row);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    const prevMs = new Date(prev.paid_at!).getTime();
    const nextMs = new Date(row.paid_at!).getTime();
    if (nextMs > prevMs) map.set(key, row);
  }
  return Array.from(map.values());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** MRR from Paddle: latest paid charge per subscription, normalized to EUR/month. */
export async function getPaddleActiveMrrEur(): Promise<number> {
  const rows = await listPlatformBillingTransactions();
  const now = Date.now();
  let sum = 0;
  for (const row of latestPaidBySubscriber(rows)) {
    if (!isSubscriptionActive(row, now)) continue;
    sum += monthlyContributionEur(row);
  }
  return round2(sum);
}

/** Sum of successful Paddle charges (refunds excluded). */
export async function getPaddleLifetimeRevenueEur(): Promise<number> {
  const rows = await listPlatformBillingTransactions();
  let sum = 0;
  for (const row of rows) {
    if (row.status === "paid") sum += amountEur(row);
    else if (row.status === "refunded") sum -= amountEur(row);
  }
  return round2(Math.max(0, sum));
}

export async function getPaddleMrrTrendEur(monthCount = 12): Promise<AdminMrrTrendPoint[]> {
  const rows = paidRows(await listPlatformBillingTransactions());
  const first = startOfMonth(subMonths(new Date(), monthCount - 1));
  const bucketStarts = Array.from({ length: monthCount }, (_, i) =>
    startOfMonth(addMonths(first, i)),
  );

  return bucketStarts.map((d) => {
    const startMs = d.getTime();
    const endMs = endOfMonth(d).getTime();
    let sum = 0;
    for (const row of rows) {
      const t = new Date(row.paid_at!).getTime();
      if (t < startMs || t > endMs) continue;
      sum += amountEur(row);
    }
    return {
      label: format(d, "MMM ''yy"),
      monthTitle: format(d, "MMMM yyyy"),
      mrrEur: round2(sum),
    };
  });
}

export async function getPaddleMrrTrendEurByRange(
  range: AdminPlanDistributionRange,
): Promise<AdminMrrTrendPoint[]> {
  if (range === "last_6_months") return getPaddleMrrTrendEur(6);
  if (range === "last_12_months") return getPaddleMrrTrendEur(12);
  if (range === "this_month") return getPaddleMrrTrendEur(1);
  if (range === "last_month") {
    const two = await getPaddleMrrTrendEur(2);
    return two.length >= 1 ? [two[0]!] : [];
  }
  if (range === "all_time") {
    const rows = paidRows(await listPlatformBillingTransactions());
    if (rows.length === 0) return getPaddleMrrTrendEur(12);
    let oldestMs = Date.now();
    for (const r of rows) {
      const t = new Date(r.paid_at!).getTime();
      if (Number.isFinite(t) && t < oldestMs) oldestMs = t;
    }
    const span =
      differenceInCalendarMonths(startOfMonth(new Date()), startOfMonth(new Date(oldestMs))) + 1;
    return getPaddleMrrTrendEur(Math.min(Math.max(span, 1), 240));
  }
  return getPaddleMrrTrendEur(12);
}

export async function getPaddlePlanDistribution(
  range: AdminPlanDistributionRange,
): Promise<AdminPlanDistribution> {
  const rows = paidRows(await listPlatformBillingTransactions());
  const now = new Date();
  let startMs = Number.NEGATIVE_INFINITY;
  let endMs = now.getTime();

  if (range === "this_month") {
    startMs = startOfMonth(now).getTime();
  } else if (range === "last_month") {
    const lastMonth = subMonths(now, 1);
    startMs = startOfMonth(lastMonth).getTime();
    endMs = endOfMonth(lastMonth).getTime();
  } else if (range === "last_6_months") {
    startMs = startOfMonth(subMonths(now, 5)).getTime();
  } else if (range === "last_12_months") {
    startMs = startOfMonth(subMonths(now, 11)).getTime();
  }

  const counts: Record<PlanName, number> = {
    starter: 0,
    professional: 0,
    enterprise: 0,
  };
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row.plan) continue;
    const t = new Date(row.paid_at!).getTime();
    if (!Number.isFinite(t) || t < startMs || t > endMs) continue;
    const key = subscriberKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    counts[normalizePlan(row.plan)]++;
  }

  return {
    starter: counts.starter,
    professional: counts.professional,
    enterprise: counts.enterprise,
    total: counts.starter + counts.professional + counts.enterprise,
  };
}

export async function getPaddleRecentTransactions(limit = 8): Promise<AdminRecentTransaction[]> {
  const rows = await listPlatformBillingTransactions();
  return rows
    .filter((row) => row.status === "paid" || row.status === "refunded" || row.status === "pending")
    .slice(0, Math.max(1, limit * 3))
    .map<AdminRecentTransaction>((row) => {
      const plan = normalizePlan(row.plan ?? "professional");
      const cycle = row.billing_cycle === "yearly" ? "yearly" : "monthly";
      const status =
        row.status === "paid"
          ? "paid"
          : row.status === "pending"
            ? "pending"
            : row.status === "refunded"
              ? "refunded"
              : "failed";
      return {
        id: row.paddle_transaction_id?.trim() || row.paddle_event_id,
        customerName: row.customer_name?.trim() || "Paddle customer",
        customerEmail: row.customer_email?.trim() || "(no email)",
        category: "restaurant_pos",
        plan,
        cycle,
        amountEur: amountEur(row),
        status,
        method: "card",
        createdAt: row.paid_at ?? row.created_at,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, Math.max(1, limit));
}
