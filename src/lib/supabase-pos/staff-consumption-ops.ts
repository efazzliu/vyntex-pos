import { supabase } from "@/lib/supabase.ts";
import {
  assertNoPgError,
  isMissingSupabaseTableError,
} from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { insertAuditLog } from "./dashboard-ops.ts";
import { uuidOrNull } from "./uuid.ts";
import { applySupplyRecipeAfterSale } from "./supply-recipe-ops.ts";

type ConsumptionLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  listPrice?: number;
};

export async function getStaffConsumption(args: {
  licenseKey: string;
  staffId: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const sid = uuidOrNull(args.staffId);
  if (!sid) {
    return {
      entries: [] as Array<{
        _id: string;
        total: number;
        items: unknown[];
        createdAt?: string;
      }>,
      total: 0,
    };
  }
  const { data, error } = await supabase
    .from("pos_staff_consumption")
    .select("*")
    .eq("restaurant_id", r.id)
    .eq("staff_id", sid)
    .eq("cleared", false)
    .order("created_at", { ascending: false });
  assertNoPgError("Staff consumption list", error);
  const entries = (data ?? []).map((row) => ({
    _id: row.id as string,
    items: row.items as unknown[],
    total: Number(row.total),
    createdAt: row.created_at as string,
  }));
  const total = entries.reduce((s, e) => s + e.total, 0);
  return { entries, total };
}

export async function addConsumption(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  const staffId = uuidOrNull(args.staffId as string);
  const loggedByStaffId = uuidOrNull(args.loggedByStaffId as string);
  if (!staffId || !loggedByStaffId) {
    throw new Error(
      "Staff consumption must be logged by registered staff (use team PINs, not device admin).",
    );
  }
  const r = await getRestaurantByLicense(licenseKey);
  const items = args.items as ConsumptionLine[];
  const loggedByStaffName = String(args.loggedByStaffName ?? "");
  const staffName = String(args.staffName ?? "");

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const listTotal = items.reduce((sum, i) => {
    const unit = i.listPrice ?? i.price;
    return sum + unit * i.quantity;
  }, 0);

  const { error: insertErr } = await supabase
    .from("pos_staff_consumption")
    .insert({
      restaurant_id: r.id,
      staff_id: staffId,
      staff_name: staffName,
      logged_by_staff_id: loggedByStaffId,
      logged_by_staff_name: loggedByStaffName,
      items: items as unknown,
      total,
      cleared: false,
    });
  if (insertErr) {
    const msg = String(insertErr.message ?? "");
    if (isMissingSupabaseTableError(msg, "pos_staff_consumption")) {
      throw new Error(
        "Missing table pos_staff_consumption. In Supabase → SQL Editor, run supabase/ensure_pos_staff_consumption.sql (or migrations/002_pos_from_convex.sql).",
      );
    }
    assertNoPgError("Staff consumption insert", insertErr);
  }

  for (const line of items) {
    const itemId = uuidOrNull(String(line.menuItemId));
    const qty = line.quantity;
    if (!itemId || qty <= 0) continue;

    const { data: row, error: loadErr } = await supabase
      .from("menu_items")
      .select("id, track_stock, current_stock")
      .eq("id", itemId)
      .eq("restaurant_id", r.id)
      .maybeSingle();
    assertNoPgError("Menu item for staff stock", loadErr);
    if (!row?.track_stock || row.current_stock == null) continue;

    const prev = Number(row.current_stock);
    const newStock = prev - qty;
    const { error: upErr } = await supabase
      .from("menu_items")
      .update({ current_stock: newStock })
      .eq("id", itemId);
    assertNoPgError("Staff consumption stock update", upErr);

    const { error: logErr } = await supabase.from("pos_stock_logs").insert({
      restaurant_id: r.id,
      menu_item_id: itemId,
      staff_name: loggedByStaffName,
      type: "staff_consumption",
      change: -qty,
      balance_after: newStock,
      note: `Staff: ${staffName}`,
    });
    assertNoPgError("Staff consumption stock log", logErr);
  }

  const qtyByMenuItemId = new Map<string, number>();
  for (const line of items) {
    const itemId = uuidOrNull(String(line.menuItemId));
    if (!itemId || line.quantity <= 0) continue;
    qtyByMenuItemId.set(itemId, (qtyByMenuItemId.get(itemId) ?? 0) + line.quantity);
  }
  await applySupplyRecipeAfterSale({
    restaurantId: r.id,
    qtyByMenuItemId,
    staffName: loggedByStaffName,
    contextNote: `Staff meal: ${staffName}`,
    licenseKey,
  });

  const itemSummary = items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
  const valueNote =
    listTotal > total + 0.005
      ? ` — list ${listTotal.toFixed(2)}, charged ${total.toFixed(2)}`
      : "";
  const loggedByLabel =
    loggedByStaffId === staffId ? "self" : loggedByStaffName;
  try {
    await insertAuditLog({
      licenseKey,
      staffId: loggedByStaffId,
      staffName: loggedByStaffName,
      action: "staff_consumption",
      details: `Staff consumption for ${staffName} (${total.toFixed(2)}): ${itemSummary} — logged by ${loggedByLabel}${valueNote}`,
    });
  } catch (err) {
    console.warn("[POS] staff consumption audit log:", err);
  }
}

/** Mark all uncleared staff consumption for the restaurant (end of day). */
export async function clearAllConsumption(args: { licenseKey: string }) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("pos_staff_consumption")
    .update({ cleared: true })
    .eq("restaurant_id", r.id)
    .eq("cleared", false);
  if (error) {
    const msg = String(error.message ?? "");
    if (isMissingSupabaseTableError(msg, "pos_staff_consumption")) {
      return { cleared: false };
    }
    assertNoPgError("Clear all staff consumption", error);
  }
  return { cleared: true };
}
