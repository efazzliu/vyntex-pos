import { supabase } from "@/lib/supabase.ts";
import { assertNoPgError } from "./db-errors.ts";
import { getRestaurantByLicense, clearRestaurantCache } from "./restaurant.ts";
import { updateFloorTableStatusSafe } from "./floor-sync.ts";
import { staffFromRow, saleFloorTableId } from "./mappers.ts";
import { loadOpenSalesForTable } from "./tables-ops.ts";
import { uuidOrNull } from "./uuid.ts";
import { payOrder } from "./orders-ops.ts";

function normalizeStaffRlsError(error: { message?: string; code?: string } | null): Error | null {
  if (!error) return null;
  const msg = String(error.message ?? "").toLowerCase();
  const isRls =
    msg.includes("row-level security") ||
    msg.includes("violates row-level security") ||
    msg.includes("permission denied") ||
    String(error.code ?? "") === "42501";
  if (!isRls) return null;
  return new Error(
    "Staff permissions are blocked by Supabase RLS. In Supabase SQL Editor run `supabase/ensure_pos_staff_rls.sql` (or `supabase/migrations/003_pos_sales_core_rls.sql`) and try again.",
  );
}

export async function getStaff(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const { data, error } = await supabase
    .from("staff")
    .select("*")
    .eq("restaurant_id", r.id)
    .order("created_at", { ascending: true });

  if (error) throw normalizeStaffRlsError(error) ?? error;
  return (data ?? []).map((row) =>
    staffFromRow(row as Parameters<typeof staffFromRow>[0]),
  );
}

export async function createStaff(args: {
  licenseKey: string;
  name: string;
  role: string;
  pinHash: string;
  permissions?: Record<string, unknown>;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("staff")
    .insert({
      restaurant_id: r.id,
      name: args.name.trim(),
      role: args.role,
      pin_hash: args.pinHash,
      is_active: true,
      permissions: args.permissions ?? null,
    })
    .select("id")
    .single();

  if (error) throw normalizeStaffRlsError(error) ?? error;
  clearRestaurantCache(args.licenseKey);
  return data!.id as string;
}

export async function updateStaff(args: {
  licenseKey: string;
  staffId: string;
  name: string;
  role: string;
  pinHash?: string;
  isActive: boolean;
  permissions?: Record<string, unknown>;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const patch: Record<string, unknown> = {
    name: args.name.trim(),
    role: args.role,
    is_active: args.isActive,
    permissions: args.permissions ?? null,
  };
  if (args.pinHash) patch.pin_hash = args.pinHash;

  const { error } = await supabase
    .from("staff")
    .update(patch)
    .eq("id", args.staffId);

  if (error) throw normalizeStaffRlsError(error) ?? error;
}

export async function deleteStaff(args: {
  licenseKey: string;
  staffId: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase.from("staff").delete().eq("id", args.staffId);
  if (error) throw normalizeStaffRlsError(error) ?? error;
}

export async function clockIn(args: {
  licenseKey: string;
  staffId: string;
  openingCash: number;
}) {
  const staffId = uuidOrNull(args.staffId);
  if (!staffId) {
    throw new Error(
      "Open shift with a staff PIN from your team list. The device admin PIN cannot sync shifts to the server.",
    );
  }
  const r = await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase.from("shifts").insert({
    restaurant_id: r.id,
    staff_id: staffId,
    opening_cash: args.openingCash,
  });
  if (error) throw normalizeStaffRlsError(error) ?? error;
}

function isOpenSaleRow(status: unknown): boolean {
  const st = String(status ?? "").toLowerCase();
  return st !== "paid" && st !== "cancelled" && st !== "voided";
}

/**
 * Ends the shift, auto-settles this waiter's open sales as cash + no_receipt (stock + totals),
 * then frees tables when no other open sale remains.
 */
export async function closeStaffShift(args: Record<string, unknown>) {
  const shiftId = args.shiftId as string;
  if (!shiftId) return null;

  const { data: shift, error: shiftLoadErr } = await supabase
    .from("shifts")
    .select("id, staff_id, restaurant_id")
    .eq("id", shiftId)
    .maybeSingle();
  assertNoPgError("Load shift to close", shiftLoadErr);
  if (!shift?.staff_id) {
    const { error } = await supabase
      .from("shifts")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", shiftId);
    if (error) throw error;
    return null;
  }

  const staffId = String(shift.staff_id);
  const restaurantId = String(shift.restaurant_id);

  let licenseKey =
    typeof args.licenseKey === "string" ? args.licenseKey.trim() : "";
  if (!licenseKey) {
    const { data: restRow, error: restErr } = await supabase
      .from("restaurants")
      .select("license_key")
      .eq("id", restaurantId)
      .maybeSingle();
    assertNoPgError("Load license for shift close", restErr);
    licenseKey = String(restRow?.license_key ?? "").trim();
  }
  if (!licenseKey) {
    throw new Error("licenseKey is required to settle open orders when closing a shift.");
  }

  const adminStaffId = uuidOrNull(args.adminStaffId as string | undefined);
  const adminStaffName =
    String((args.adminStaffName as string | undefined) ?? "").trim() ||
    "Manager";

  const { data: staffSales, error: salesLoadErr } = await supabase
    .from("sales")
    .select("id, table_id, table_ref, status")
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffId);
  assertNoPgError("Load waiter open sales", salesLoadErr);

  const openSales = (staffSales ?? []).filter((s) => isOpenSaleRow(s.status));

  for (const sale of openSales) {
    const orderId = String(sale.id);
    await payOrder({
      licenseKey,
      orderId,
      paymentMethod: "cash",
      paymentType: "no_receipt",
      staffId: adminStaffId ?? undefined,
      staffName: adminStaffName,
    });
  }

  const tableKeys = new Set<string>();
  for (const s of openSales) {
    const tid = saleFloorTableId(s as Parameters<typeof saleFloorTableId>[0]);
    if (tid) tableKeys.add(tid);
  }

  for (const tid of tableKeys) {
    const remaining = await loadOpenSalesForTable(restaurantId, tid);
    if (remaining.length === 0) {
      await updateFloorTableStatusSafe(
        tid,
        "available",
        "Free table after waiter shift closed",
      );
    }
  }

  const { error: closeErr } = await supabase
    .from("shifts")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", shiftId);
  assertNoPgError("Close staff shift", closeErr);

  const expRes = await supabase
    .from("pos_expenses")
    .update({ cleared: true })
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffId)
    .eq("cleared", false);
  assertNoPgError("Clear waiter expenses on shift close", expRes.error);

  const consRes = await supabase
    .from("pos_staff_consumption")
    .update({ cleared: true })
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffId)
    .eq("cleared", false);
  assertNoPgError("Clear waiter consumption on shift close", consRes.error);
}
