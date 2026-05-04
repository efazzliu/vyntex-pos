import { supabase } from "@/lib/supabase.ts";
import { insertAuditLog } from "./dashboard-ops.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { isMissingSupabaseTableError } from "./db-errors.ts";
import { uuidOrNull } from "./uuid.ts";

export async function addExpense(args: {
  licenseKey: string;
  staffId: string;
  staffName: string;
  amount: number;
  note: string;
}) {
  const staffId = uuidOrNull(args.staffId);
  if (!staffId) {
    throw new Error("Sign in as a staff member from your list to record expenses.");
  }
  const r = await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase.from("pos_expenses").insert({
    restaurant_id: r.id,
    staff_id: staffId,
    staff_name: args.staffName,
    amount: args.amount,
    note: args.note,
    cleared: false,
  });
  if (error) {
    const msg = String(error.message ?? "");
    if (isMissingSupabaseTableError(msg, "pos_expenses")) {
      throw new Error(
        "Missing table pos_expenses. In Supabase → SQL Editor, run supabase/ensure_pos_expenses.sql (or migrations/002_pos_from_convex.sql).",
      );
    }
    throw error;
  }

  try {
    await insertAuditLog({
      licenseKey: args.licenseKey,
      staffId: staffId,
      staffName: args.staffName,
      action: "expense",
      details: `Expense: $${Number(args.amount).toFixed(2)} — ${String(args.note ?? "").trim() || "(no note)"}`,
      metadata: { amount: args.amount, note: args.note },
    });
  } catch (err) {
    console.warn("[POS] expense audit log:", err);
  }
}

export async function getTodayExpenses(args: {
  licenseKey: string;
  staffId: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("pos_expenses")
    .select("*")
    .eq("restaurant_id", r.id)
    .eq("staff_id", args.staffId)
    .or("cleared.is.null,cleared.eq.false")
    .order("created_at", { ascending: false });
  if (error) return { entries: [], total: 0 };
  const entries = (data ?? []).map((row) => ({
    _id: row.id,
    amount: Number(row.amount),
    note: row.note,
    createdAt: row.created_at,
  }));
  const total = entries.reduce((s, e) => s + e.amount, 0);
  return { entries, total };
}

export async function getStaffExpenses(args: {
  licenseKey: string;
  staffId: string;
}) {
  return getTodayExpenses(args);
}

export async function getAllUnclearedExpenses(args: { licenseKey: string }) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("pos_expenses")
    .select("*")
    .eq("restaurant_id", r.id)
    .or("cleared.is.null,cleared.eq.false");
  if (error) return { entries: [], total: 0 };
  const entries = (data ?? []).map((row) => ({
    _id: row.id,
    amount: Number(row.amount),
    note: row.note,
    staffName: row.staff_name,
    createdAt: row.created_at,
  }));
  const total = entries.reduce((s, e) => s + e.amount, 0);
  return { entries, total };
}

export async function clearAllExpenses(args: { licenseKey: string }) {
  const r = await getRestaurantByLicense(args.licenseKey);
  await supabase
    .from("pos_expenses")
    .update({ cleared: true })
    .eq("restaurant_id", r.id);
}
