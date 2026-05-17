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
import type {
  AdminMrrTrendPoint,
  AdminPayingByPlanPoint,
  AdminPlanDistribution,
  AdminPlanDistributionRange,
  AdminRecentTransaction,
} from "./admin-revenue-types.ts";
import {
  getPaddleActiveMrrEur,
  getPaddleLifetimeRevenueEur,
  getPaddleMrrTrendEur,
  getPaddleMrrTrendEurByRange,
  getPaddlePlanDistribution,
  getPaddleRecentTransactions,
  isPlatformBillingAvailable,
} from "./platform-billing.ts";

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

/** MRR (EUR/month) from confirmed Paddle payments only. */
export async function getAdminActiveMrrEur(): Promise<number> {
  return getPaddleActiveMrrEur();
}

const AVG_MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

/** Lifetime subscription revenue (EUR) — sum of successful Paddle charges minus refunds. */
export async function getAdminEstimatedLifetimeSubscriptionRevenueEur(): Promise<number> {
  return getPaddleLifetimeRevenueEur();
}

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

export type {
  AdminMrrTrendPoint,
  AdminPayingByPlanPoint,
  AdminPlanDistribution,
  AdminPlanDistributionRange,
  AdminRecentTransaction,
  AdminTransactionCategory,
  AdminTransactionCycle,
  AdminTransactionMethod,
  AdminTransactionStatus,
} from "./admin-revenue-types.ts";

/** Monthly Paddle cash collected (EUR) per calendar month. */
export async function getAdminPayingMrrTrendEur(monthCount = 12): Promise<AdminMrrTrendPoint[]> {
  return getPaddleMrrTrendEur(monthCount);
}

/** Revenue trend buckets aligned with {@link getAdminPlanDistribution} date windows (Paddle only). */
export async function getAdminPayingMrrTrendEurByRange(
  range: AdminPlanDistributionRange,
): Promise<AdminMrrTrendPoint[]> {
  return getPaddleMrrTrendEurByRange(range);
}

/** Paying plan mix from Paddle subscriptions in the selected period. */
export async function getAdminPlanDistribution(
  range: AdminPlanDistributionRange,
): Promise<AdminPlanDistribution> {
  return getPaddlePlanDistribution(range);
}

/** Recent Paddle subscription charges (empty until webhooks are configured). */
export async function getAdminRecentTransactions(limit = 8): Promise<AdminRecentTransaction[]> {
  return getPaddleRecentTransactions(limit);
}

export { isPlatformBillingAvailable };

export type SiteUserRow = {
  userId: string;
  email: string;
  fullName: string | null;
  registeredAt: string;
  lastSignInAt: string | null;
  venueCount: number;
  activeLicenseCount: number;
  isBanned: boolean;
};

export type SiteUserModerationAction = "delete" | "ban";

function isMissingSiteUsersRpcError(err: { message?: string }): boolean {
  const m = String(err.message ?? "").toLowerCase();
  return (
    m.includes("could not find the function") ||
    m.includes("vyntex_list_site_users") ||
    (m.includes("schema cache") && m.includes("function"))
  );
}

/** Supabase Auth accounts (site sign-ups). Requires migration 023 + platform_admin_emails. */
export async function listSiteUsers(): Promise<SiteUserRow[]> {
  const { data, error } = await supabase.rpc("vyntex_list_site_users");

  if (error) {
    if (isMissingSiteUsersRpcError(error)) {
      throw new Error(
        "The site users function is not installed. Run supabase/migrations/023_vyntex_list_site_users.sql in Supabase SQL Editor, add your email to platform_admin_emails, then refresh.",
      );
    }
    const msg = String(error.message ?? "");
    if (msg.toLowerCase().includes("not authorized")) {
      throw new Error(
        "Your account cannot list site users. Add your email to platform_admin_emails in Supabase.",
      );
    }
    throw new Error(msg);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      userId: String(r.user_id ?? ""),
      email: String(r.email ?? "").trim().toLowerCase(),
      fullName: r.full_name ? String(r.full_name).trim() : null,
      registeredAt: String(r.registered_at ?? ""),
      lastSignInAt: r.last_sign_in_at ? String(r.last_sign_in_at) : null,
      venueCount: Math.max(0, Number(r.venue_count) || 0),
      activeLicenseCount: Math.max(0, Number(r.active_license_count) || 0),
      isBanned: Boolean(r.is_banned),
    };
  });
}

/** Check if email is on the site ban list (migration 024). */
export async function isEmailBanned(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const { data, error } = await supabase.rpc("vyntex_is_email_banned", {
    p_email: normalized,
  });

  if (error) {
    const m = String(error.message ?? "").toLowerCase();
    if (m.includes("vyntex_is_email_banned") || m.includes("could not find the function")) {
      return false;
    }
    throw new Error(error.message);
  }

  return Boolean(data);
}

function isMissingModerateSiteUserRpc(err: { message?: string }): boolean {
  const m = String(err.message ?? "").toLowerCase();
  return (
    m.includes("vyntex_admin_moderate_site_user") ||
    (m.includes("could not find the function") && m.includes("moderate"))
  );
}

/** Delete or ban a site user (migration 025 RPC). */
export async function moderateSiteUser(
  userId: string,
  action: SiteUserModerationAction,
): Promise<{ venuesDeleted: number; email: string }> {
  const { data, error } = await supabase.rpc("vyntex_admin_moderate_site_user", {
    p_user_id: userId,
    p_action: action,
  });

  if (error) {
    if (isMissingModerateSiteUserRpc(error)) {
      throw new Error(
        "Funksioni vyntex_admin_moderate_site_user nuk është instaluar. Ekzekuto migrimin 025_vyntex_admin_moderate_site_user.sql në Supabase SQL Editor.",
      );
    }
    throw new Error(error.message || "Moderation failed");
  }

  const payload = data as {
    ok?: boolean;
    email?: string;
    venues_deleted?: number;
  } | null;

  if (!payload?.ok) {
    throw new Error("Moderation failed");
  }

  return {
    email: String(payload.email ?? ""),
    venuesDeleted: Math.max(0, Number(payload.venues_deleted) || 0),
  };
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
  status: "active" | "expired" | "suspended" | "trial",
): Promise<void> {
  const dbStatus = status === "trial" ? "active" : status;
  const { error } = await supabase
    .from("restaurants")
    .update({ license_status: dbStatus })
    .eq("id", licenseId);
  if (error) throw new Error(error.message);
  bumpLicenseCache();
}

export async function updateLicenseVenueName(licenseId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Business name is required");
  const { error } = await supabase
    .from("restaurants")
    .update({ name: trimmed })
    .eq("id", licenseId);
  if (error) throw new Error(error.message);
  bumpLicenseCache();
}

/** Assign a new unique license key (client must re-activate devices with the new key). */
export async function regenerateLicenseKey(licenseId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const licenseKey = randomLicenseKey();
    const { error } = await supabase
      .from("restaurants")
      .update({ license_key: licenseKey })
      .eq("id", licenseId);
    if (!error) {
      bumpLicenseCache();
      return licenseKey;
    }
    if (!isDuplicateKeyError(error.message)) {
      throw new Error(error.message);
    }
  }
  throw new Error("Failed to generate a unique license key. Please try again.");
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
