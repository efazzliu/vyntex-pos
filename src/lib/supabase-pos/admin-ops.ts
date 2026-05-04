import {
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  normalizePlan,
  planTerminalFloor,
  type PlanName,
} from "@/pages/pos/_lib/plan-features.ts";
import { supabase } from "@/lib/supabase.ts";
import { clearRestaurantCache } from "@/lib/supabase-pos/restaurant.ts";
import { isMissingPgColumnError } from "./db-errors.ts";

/** Default list prices (EUR / month) for MRR estimates — adjust if your catalog differs. */
const PLAN_MONTHLY_EUR: Record<PlanName, number> = {
  starter: 59,
  professional: 99,
  enterprise: 189,
};

export function planMonthlyEur(plan: string): number {
  return PLAN_MONTHLY_EUR[normalizePlan(plan)];
}

/**
 * Dashboard signup uses a one-calendar-month free trial (`license_expiry` ≈ `created_at` + 1 month).
 * Until the license is extended (monthly/annual payment), we treat it as non-paying for MRR/charts.
 * Slack accounts for timezones / manual edits.
 */
/** Upper bound for “initial trial only” (calendar month + leeway for TZ / clock skew). */
const INITIAL_TRIAL_MAX_SPAN_MS = 38 * 24 * 60 * 60 * 1000;

/** True when the row still looks like “only the initial trial window”, not a paid renewal window. */
export function isInitialFreeTrialOnly(row: AdminLicenseRow): boolean {
  const raw = row.created_at;
  if (!raw) return false;
  const created = new Date(raw).getTime();
  const ex = new Date(row.license_expiry).getTime();
  if (!Number.isFinite(created) || !Number.isFinite(ex)) return false;
  return ex - created <= INITIAL_TRIAL_MAX_SPAN_MS;
}

export type AdminLicenseRow = {
  id: string;
  name: string;
  type: string;
  plan: string;
  license_key: string;
  license_expiry: string;
  license_status: string;
  device_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  max_terminals: number;
  registered_devices: unknown;
  mobile_access_enabled?: boolean;
  created_at?: string;
};

/**
 * Same rules as admin stats: suspended stays suspended; past `license_expiry` counts as expired
 * even when the DB row still has `license_status === "active"` (nothing auto-flips that field).
 */
export function effectiveLicenseStatus(row: AdminLicenseRow): "active" | "expired" | "suspended" {
  if (row.license_status === "suspended") return "suspended";
  const ex = new Date(row.license_expiry).getTime();
  if (row.license_status === "expired" || (Number.isFinite(ex) && ex <= Date.now())) {
    return "expired";
  }
  return "active";
}

const licenseSelect =
  "id, name, type, plan, license_key, license_expiry, license_status, device_id, owner_email, owner_name, max_terminals, registered_devices, mobile_access_enabled, created_at";

export async function listLicensesForAdmin(): Promise<AdminLicenseRow[]> {
  let { data, error } = await supabase
    .from("restaurants")
    .select(licenseSelect)
    .order("created_at", { ascending: false });

  if (error && isMissingPgColumnError(error.message, "mobile_access_enabled")) {
    ({ data, error } = await supabase
      .from("restaurants")
      .select(
        "id, name, type, plan, license_key, license_expiry, license_status, device_id, owner_email, owner_name, max_terminals, registered_devices, created_at",
      )
      .order("created_at", { ascending: false }));
  }

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...(row as AdminLicenseRow),
    mobile_access_enabled:
      (row as { mobile_access_enabled?: boolean }).mobile_access_enabled ?? true,
  }));
}

export type CreateClaimableLicenseInput = {
  name?: string;
  plan?: "starter" | "professional" | "enterprise";
  /** DB enum values from restaurants.type check */
  type?: "restaurant" | "cafe" | "bar" | "hotel" | "fitness";
  durationDays?: number;
  maxTerminals?: number;
};

export type CreatedClaimableLicense = {
  id: string;
  licenseKey: string;
  plan: PlanName;
  expiresAt: string;
};

function randomLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 16; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`;
}

function isDuplicateKeyError(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes("duplicate key") && msg.includes("license_key");
}

/**
 * Creates an unclaimed license pool entry.
 * First signed-in user that activates it will get owner_user_id / owner_email.
 */
export async function createClaimableLicense(
  input: CreateClaimableLicenseInput = {},
): Promise<CreatedClaimableLicense> {
  const plan = normalizePlan(input.plan ?? "professional");
  const type = input.type ?? "restaurant";
  const name = (input.name ?? "Unassigned License").trim() || "Unassigned License";
  const durationDays = Math.max(1, Math.floor(Number(input.durationDays) || 30));
  const minTerminals = planTerminalFloor(plan);
  const maxTerminals = Math.max(minTerminals, Math.floor(Number(input.maxTerminals) || minTerminals));
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  for (let attempt = 0; attempt < 8; attempt++) {
    const licenseKey = randomLicenseKey();
    const { data, error } = await supabase
      .from("restaurants")
      .insert({
        name,
        type,
        plan,
        license_key: licenseKey,
        license_expiry: expiresAt,
        license_status: "active",
        owner_user_id: null,
        owner_email: null,
        owner_name: null,
        max_terminals: maxTerminals,
        registered_devices: [],
      })
      .select("id, license_key, plan, license_expiry")
      .single();

    if (!error && data) {
      return {
        id: String(data.id),
        licenseKey: String(data.license_key),
        plan: normalizePlan(String(data.plan ?? plan)),
        expiresAt: String(data.license_expiry ?? expiresAt),
      };
    }

    if (!error) continue;
    if (isDuplicateKeyError(error.message)) continue;
    throw new Error(error.message);
  }

  throw new Error("Failed to generate a unique license key. Please try again.");
}

export type AdminStats = {
  totalClients: number;
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  suspendedLicenses: number;
  newContacts: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const rows = await listLicensesForAdmin();
  let activeLicenses = 0;
  let expiredLicenses = 0;
  let suspendedLicenses = 0;

  for (const r of rows) {
    const s = effectiveLicenseStatus(r);
    if (s === "suspended") suspendedLicenses++;
    else if (s === "expired") expiredLicenses++;
    else activeLicenses++;
  }

  const emails = new Set(
    rows.map((r) => r.owner_email?.trim().toLowerCase()).filter(Boolean) as string[],
  );

  const { count, error } = await supabase
    .from("contact_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  if (error) throw new Error(error.message);

  return {
    totalClients: emails.size,
    totalLicenses: rows.length,
    activeLicenses,
    expiredLicenses,
    suspendedLicenses,
    newContacts: count ?? 0,
  };
}

export type AdminLicenseTrendPoint = {
  /** Short tick label, e.g. May '25 */
  label: string;
  /** New licenses (restaurants) created in that month */
  licenses: number;
};

/** Count of new licenses per calendar month for the last `monthCount` months (by `created_at`). */
export async function getAdminLicenseSignupTrend(
  monthCount = 12,
): Promise<AdminLicenseTrendPoint[]> {
  const rows = await listLicensesForAdmin();
  const first = startOfMonth(subMonths(new Date(), monthCount - 1));
  const bucketStarts = Array.from({ length: monthCount }, (_, i) =>
    startOfMonth(addMonths(first, i)),
  );

  const counts = new Map<number, number>();
  for (const d of bucketStarts) {
    counts.set(d.getTime(), 0);
  }

  for (const r of rows) {
    const raw = r.created_at;
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t)) continue;
    const key = startOfMonth(new Date(t)).getTime();
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return bucketStarts.map((d) => ({
    label: format(d, "MMM ''yy"),
    licenses: counts.get(d.getTime()) ?? 0,
  }));
}

/** Active license that counts toward paid MRR (excludes initial free-trial window). */
function countsAsPaidSubscriptionNow(row: AdminLicenseRow): boolean {
  if (effectiveLicenseStatus(row) !== "active") return false;
  if (isInitialFreeTrialOnly(row)) return false;
  return true;
}

/**
 * Paying at a past month-end: use only signup + expiry (current status would skew history).
 */
function wasPayingAtMonthEnd(row: AdminLicenseRow, monthEndMs: number): boolean {
  const raw = row.created_at;
  if (raw) {
    const created = new Date(raw).getTime();
    if (Number.isFinite(created) && created > monthEndMs) return false;
  }
  const ex = new Date(row.license_expiry).getTime();
  return Number.isFinite(ex) && ex > monthEndMs;
}

/** Sum of estimated monthly EUR for paying subscriptions (active, not in initial trial-only window). */
export async function getAdminActiveMrrEur(): Promise<number> {
  const rows = await listLicensesForAdmin();
  let sum = 0;
  for (const r of rows) {
    if (!countsAsPaidSubscriptionNow(r)) continue;
    sum += planMonthlyEur(r.plan);
  }
  return Math.round(sum * 100) / 100;
}

const AVG_MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

/**
 * Rough lifetime subscription revenue (EUR): plan list price × months from signup
 * to min(now, expiry) for licenses that moved past the initial free-trial-only window.
 * Not invoice-grade; useful for admin overview until billing export exists.
 */
export async function getAdminEstimatedLifetimeSubscriptionRevenueEur(): Promise<number> {
  const rows = await listLicensesForAdmin();
  let sum = 0;
  const now = Date.now();
  for (const r of rows) {
    if (isInitialFreeTrialOnly(r)) continue;
    const raw = r.created_at;
    if (!raw) continue;
    const start = new Date(raw).getTime();
    const end = Math.min(now, new Date(r.license_expiry).getTime());
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    sum += planMonthlyEur(r.plan) * ((end - start) / AVG_MONTH_MS);
  }
  return Math.round(sum * 100) / 100;
}

export type AdminPayingByPlanPoint = {
  label: string;
  /** Full month label for charts, e.g. "January 2026". */
  monthTitle: string;
  starter: number;
  professional: number;
  enterprise: number;
};

/**
 * Per calendar month: count of paying licenses at month-end, split by plan tier.
 * “Paying” = created on or before that month end, expiry after that month end, and not still
 * in the initial free-trial-only window (same heuristic as MRR).
 */
export async function getAdminPayingLicensesByPlanTrend(
  monthCount = 12,
): Promise<AdminPayingByPlanPoint[]> {
  const rows = await listLicensesForAdmin();
  const first = startOfMonth(subMonths(new Date(), monthCount - 1));
  const bucketStarts = Array.from({ length: monthCount }, (_, i) =>
    startOfMonth(addMonths(first, i)),
  );

  return bucketStarts.map((d) => {
    const atMs = endOfMonth(d).getTime();
    const counts: Record<PlanName, number> = {
      starter: 0,
      professional: 0,
      enterprise: 0,
    };
    for (const r of rows) {
      if (!wasPayingAtMonthEnd(r, atMs)) continue;
      if (isInitialFreeTrialOnly(r)) continue;
      counts[normalizePlan(r.plan)]++;
    }
    return {
      label: format(d, "MMM ''yy"),
      monthTitle: format(d, "MMMM yyyy"),
      starter: counts.starter,
      professional: counts.professional,
      enterprise: counts.enterprise,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type AdminMrrTrendPoint = {
  label: string;
  monthTitle: string;
  mrrEur: number;
};

export type AdminPlanDistributionRange =
  | "this_month"
  | "last_month"
  | "last_6_months"
  | "last_12_months"
  | "all_time";

export type AdminPlanDistribution = {
  starter: number;
  professional: number;
  enterprise: number;
  total: number;
};

export type AdminTransactionCategory = "restaurant_pos";

export type AdminTransactionCycle = "monthly" | "yearly";

export type AdminTransactionStatus = "paid" | "pending" | "failed" | "refunded";

export type AdminTransactionMethod = "card" | "bank_transfer" | "paypal";

export type AdminRecentTransaction = {
  id: string;
  customerName: string;
  customerEmail: string;
  category: AdminTransactionCategory;
  plan: PlanName;
  cycle: AdminTransactionCycle;
  amountEur: number;
  status: AdminTransactionStatus;
  method: AdminTransactionMethod;
  createdAt: string;
};

/** Month-end estimated MRR (EUR) from paying license counts × list prices. */
export async function getAdminPayingMrrTrendEur(monthCount = 12): Promise<AdminMrrTrendPoint[]> {
  const pts = await getAdminPayingLicensesByPlanTrend(monthCount);
  return pts.map((p) => ({
    label: p.label,
    monthTitle: p.monthTitle,
    mrrEur: round2(
      p.starter * planMonthlyEur("starter") +
        p.professional * planMonthlyEur("professional") +
        p.enterprise * planMonthlyEur("enterprise"),
    ),
  }));
}

/** MRR trend buckets aligned with {@link getAdminPlanDistribution} date windows. */
export async function getAdminPayingMrrTrendEurByRange(
  range: AdminPlanDistributionRange,
): Promise<AdminMrrTrendPoint[]> {
  if (range === "last_6_months") return getAdminPayingMrrTrendEur(6);
  if (range === "last_12_months") return getAdminPayingMrrTrendEur(12);
  if (range === "this_month") return getAdminPayingMrrTrendEur(1);
  if (range === "last_month") {
    const two = await getAdminPayingMrrTrendEur(2);
    return two.length >= 1 ? [two[0]!] : [];
  }
  if (range === "all_time") {
    const rows = await listLicensesForAdmin();
    const now = new Date();
    let oldestMs = now.getTime();
    for (const r of rows) {
      const t = r.created_at ? new Date(r.created_at).getTime() : Number.NaN;
      if (Number.isFinite(t) && t < oldestMs) oldestMs = t;
    }
    const oldest = new Date(oldestMs);
    const span =
      differenceInCalendarMonths(startOfMonth(now), startOfMonth(oldest)) + 1;
    const n = Math.min(Math.max(span, 1), 240);
    return getAdminPayingMrrTrendEur(n);
  }
  return getAdminPayingMrrTrendEur(12);
}

/**
 * License plan distribution by signup date window.
 * Useful for "which plan sold more" snapshots in admin charts.
 */
export async function getAdminPlanDistribution(
  range: AdminPlanDistributionRange,
): Promise<AdminPlanDistribution> {
  const rows = await listLicensesForAdmin();
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

  for (const row of rows) {
    const t = row.created_at ? new Date(row.created_at).getTime() : Number.NaN;
    if (!Number.isFinite(t)) continue;
    if (t < startMs || t > endMs) continue;
    counts[normalizePlan(row.plan)]++;
  }

  return {
    starter: counts.starter,
    professional: counts.professional,
    enterprise: counts.enterprise,
    total: counts.starter + counts.professional + counts.enterprise,
  };
}

/**
 * Dashboard-only snapshot list for recent billing activity.
 * Keep this query boundary stable and swap internals with real invoice/payment rows later.
 */
export async function getAdminRecentTransactions(limit = 8): Promise<AdminRecentTransaction[]> {
  const rows = await listLicensesForAdmin();

  const tx = rows
    .filter((row) => countsAsPaidSubscriptionNow(row))
    .map<AdminRecentTransaction>((row) => {
      const createdAt = row.created_at ?? new Date().toISOString();
      const createdMs = new Date(createdAt).getTime();
      const expiryMs = new Date(row.license_expiry).getTime();
      const days = Number.isFinite(createdMs) && Number.isFinite(expiryMs)
        ? (expiryMs - createdMs) / (24 * 60 * 60 * 1000)
        : 0;
      const cycle: AdminTransactionCycle = days >= 330 ? "yearly" : "monthly";
      const plan = normalizePlan(row.plan);
      const amountEur = cycle === "yearly" ? planMonthlyEur(plan) * 12 : planMonthlyEur(plan);
      const labelId = row.license_key?.trim() || row.id;
      const customerName = row.owner_name?.trim() || row.name || "Unknown client";
      const customerEmail = row.owner_email?.trim() || "(no email on file)";
      const method: AdminTransactionMethod =
        row.type?.toLowerCase().includes("bank") ? "bank_transfer" : "card";
      return {
        id: labelId,
        customerName,
        customerEmail,
        category: "restaurant_pos",
        plan,
        cycle,
        amountEur,
        status: "paid",
        method,
        createdAt,
      };
    });

  return tx
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, Math.max(1, limit));
}

export type ClientAccountRow = {
  owner_email: string;
  owner_name: string | null;
  license_count: number;
  licenses: Array<{
    id: string;
    license_key: string;
    name: string;
    created_at?: string;
    type: string;
    plan: string;
    license_status: string;
    license_expiry: string;
    max_terminals: number;
    mobile_access_enabled?: boolean;
  }>;
};

export async function listClientAccounts(): Promise<ClientAccountRow[]> {
  const rows = await listLicensesForAdmin();
  const byEmail = new Map<string, ClientAccountRow>();

  for (const r of rows) {
    const key = (r.owner_email ?? "").trim().toLowerCase() || `_noid_${r.id}`;
    const existing = byEmail.get(key);
    const slice = {
      id: r.id,
      license_key: r.license_key,
      name: r.name,
      created_at: r.created_at,
      type: r.type,
      plan: r.plan,
      license_status: r.license_status,
      license_expiry: r.license_expiry,
      max_terminals: Math.max(1, Number(r.max_terminals) || 1),
      mobile_access_enabled: r.mobile_access_enabled ?? true,
    };
    if (!existing) {
      byEmail.set(key, {
        owner_email: r.owner_email ?? "(no email on file)",
        owner_name: r.owner_name,
        license_count: 1,
        licenses: [slice],
      });
    } else {
      existing.license_count++;
      existing.licenses.push(slice);
    }
  }

  return Array.from(byEmail.values()).sort((a, b) =>
    a.owner_email.localeCompare(b.owner_email),
  );
}

function bumpLicenseCache() {
  clearRestaurantCache();
}

export async function updateLicenseStatus(
  licenseId: string,
  status: "active" | "expired" | "suspended",
): Promise<void> {
  const { error } = await supabase
    .from("restaurants")
    .update({ license_status: status })
    .eq("id", licenseId);
  if (error) throw new Error(error.message);
  bumpLicenseCache();
}

export async function extendLicenseDays(licenseId: string, days: number): Promise<void> {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error("Days must be a positive number");
  }
  const { data: row, error: fetchError } = await supabase
    .from("restaurants")
    .select("license_expiry")
    .eq("id", licenseId)
    .maybeSingle();
  if (fetchError || !row) throw new Error(fetchError?.message ?? "License not found");

  const base = new Date(
    Math.max(new Date(row.license_expiry as string).getTime(), Date.now()),
  );
  base.setUTCDate(base.getUTCDate() + days);

  const { error } = await supabase
    .from("restaurants")
    .update({
      license_expiry: base.toISOString(),
      license_status: "active",
    })
    .eq("id", licenseId);
  if (error) throw new Error(error.message);
  bumpLicenseCache();
}

/** Set absolute expiry (ISO date string, end of local day optional — use full ISO from datetime-local). */
export async function setLicenseExpiryIso(licenseId: string, isoUtc: string): Promise<void> {
  const t = new Date(isoUtc).getTime();
  if (!Number.isFinite(t)) throw new Error("Invalid date");

  const { error } = await supabase
    .from("restaurants")
    .update({
      license_expiry: new Date(t).toISOString(),
      license_status: "active",
    })
    .eq("id", licenseId);
  if (error) throw new Error(error.message);
  bumpLicenseCache();
}

export async function updateLicensePlan(
  licenseId: string,
  plan: "starter" | "professional" | "enterprise",
): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from("restaurants")
    .select("max_terminals")
    .eq("id", licenseId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("License not found");

  const current = Math.max(1, Number(row.max_terminals) || 1);
  const floor = planTerminalFloor(plan);
  const max_terminals = Math.max(current, floor);

  const { error } = await supabase
    .from("restaurants")
    .update({ plan, max_terminals })
    .eq("id", licenseId);
  if (error) throw new Error(error.message);
  bumpLicenseCache();
}

export async function setMaxTerminals(licenseId: string, maxTerminals: number): Promise<void> {
  if (!Number.isFinite(maxTerminals) || maxTerminals < 1) {
    throw new Error("Max terminals must be at least 1");
  }
  const { error } = await supabase
    .from("restaurants")
    .update({ max_terminals: Math.floor(maxTerminals) })
    .eq("id", licenseId);
  if (error) throw new Error(error.message);
  bumpLicenseCache();
}

export async function updateClientLicenseConfig(args: {
  licenseId: string;
  type: string;
  maxTerminals: number;
  mobileAccessEnabled: boolean;
}): Promise<void> {
  const maxTerminals = Math.max(1, Math.floor(Number(args.maxTerminals) || 1));
  const { error } = await supabase
    .from("restaurants")
    .update({
      type: args.type.trim(),
      max_terminals: maxTerminals,
      mobile_access_enabled: args.mobileAccessEnabled,
    })
    .eq("id", args.licenseId);

  if (error && isMissingPgColumnError(error.message, "mobile_access_enabled")) {
    throw new Error(
      "Database is missing column restaurants.mobile_access_enabled. Run Supabase migration 019_restaurants_mobile_access_enabled.sql, then try again.",
    );
  }

  if (error) throw new Error(error.message);
  bumpLicenseCache();
}

export async function resetLicenseDevices(licenseId: string): Promise<void> {
  const { error } = await supabase
    .from("restaurants")
    .update({
      device_id: null,
      registered_devices: [],
    })
    .eq("id", licenseId);
  if (error) throw new Error(error.message);
  bumpLicenseCache();
}

export async function deleteLicense(licenseId: string): Promise<void> {
  const { error } = await supabase.from("restaurants").delete().eq("id", licenseId);
  if (error) throw new Error(error.message);
  bumpLicenseCache();
}
