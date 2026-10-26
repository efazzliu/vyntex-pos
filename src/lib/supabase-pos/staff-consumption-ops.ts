import { supabase } from "@/lib/supabase.ts";
import {
  assertNoPgError,
  isMissingPgColumnError,
  isMissingSupabaseTableError,
} from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { insertAuditLog } from "./dashboard-ops.ts";
import { uuidOrNull } from "./uuid.ts";
import { applySupplyRecipeAfterSale } from "./supply-recipe-ops.ts";
import {
  chargeStaffMeal,
  isStaffMealAllowed,
  normalizeStaffMealRule,
  qtyUsedToday,
  staffMealLimitError,
  staffMealNotAllowedError,
} from "@/lib/staff-meal-config.ts";

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

export async function getAllUnclearedConsumption(args: { licenseKey: string }) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("pos_staff_consumption")
    .select("id, staff_id, total")
    .eq("restaurant_id", r.id)
    .eq("cleared", false);
  if (error) {
    const msg = String(error.message ?? "");
    if (!isMissingSupabaseTableError(msg, "pos_staff_consumption")) {
      console.warn("[POS] uncleared consumption:", msg);
    }
    return { entries: [] as Array<{ _id: string; staffId: string; total: number }>, total: 0 };
  }
  const entries = (data ?? []).map((row) => ({
    _id: String(row.id),
    staffId: row.staff_id != null ? String(row.staff_id) : "",
    total: Number(row.total ?? 0),
  }));
  const total = entries.reduce((s, e) => s + e.total, 0);
  return { entries, total: Math.round(total * 100) / 100 };
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
  const requested = args.items as ConsumptionLine[];
  const loggedByStaffName = String(args.loggedByStaffName ?? "");
  const staffName = String(args.staffName ?? "");

  const qtyByItem = new Map<
    string,
    { name: string; qty: number }
  >();
  for (const line of requested ?? []) {
    const id = uuidOrNull(String(line.menuItemId ?? ""));
    const qty = Number(line.quantity);
    if (!id || !Number.isFinite(qty) || qty <= 0) continue;
    const prev = qtyByItem.get(id);
    qtyByItem.set(id, {
      name: String(line.name ?? prev?.name ?? ""),
      qty: (prev?.qty ?? 0) + qty,
    });
  }
  if (qtyByItem.size === 0) {
    throw new Error("Staff consumption needs at least one item.");
  }

  const itemIds = [...qtyByItem.keys()];
  const staffMealSelect =
    "id, name, price, staff_meal_allowed, staff_meal_price, staff_meal_free_qty, staff_meal_daily_limit";
  let { data: menuRows, error: menuErr } = await supabase
    .from("menu_items")
    .select(staffMealSelect)
    .eq("restaurant_id", r.id)
    .in("id", itemIds);
  if (
    menuErr &&
    (isMissingPgColumnError(menuErr.message, "staff_meal_price") ||
      isMissingPgColumnError(menuErr.message, "staff_meal_free_qty") ||
      isMissingPgColumnError(menuErr.message, "staff_meal_daily_limit"))
  ) {
    ({ data: menuRows, error: menuErr } = await supabase
      .from("menu_items")
      .select("id, name, price, staff_meal_allowed")
      .eq("restaurant_id", r.id)
      .in("id", itemIds));
  }
  assertNoPgError("Menu items for staff meal", menuErr);
  const menuById = new Map(
    (menuRows ?? []).map((row) => [String(row.id), row]),
  );

  const existing = await getStaffConsumption({ licenseKey, staffId });
  const items: ConsumptionLine[] = [];
  for (const [id, req] of qtyByItem) {
    const row = menuById.get(id);
    if (!row) {
      throw new Error(staffMealNotAllowedError(req.name || id));
    }
    const mealFields = {
      staffMealAllowed: row.staff_meal_allowed as boolean | null,
      staffMealPrice:
        row.staff_meal_price != null ? Number(row.staff_meal_price) : undefined,
      staffMealFreeQty:
        row.staff_meal_free_qty != null
          ? Number(row.staff_meal_free_qty)
          : undefined,
      staffMealDailyLimit:
        row.staff_meal_daily_limit != null
          ? Number(row.staff_meal_daily_limit)
          : undefined,
    };
    const rule = normalizeStaffMealRule(mealFields);
    const itemName = String(row.name ?? req.name);
    if (!isStaffMealAllowed(mealFields)) {
      throw new Error(staffMealNotAllowedError(itemName));
    }
    const used = qtyUsedToday(existing.entries, id);
    const charge = chargeStaffMeal(rule, used, req.qty);
    if (charge.blocked || charge.allowedQty < req.qty) {
      throw new Error(staffMealLimitError(itemName, rule.dailyLimit));
    }
    const listPrice = Number(row.price);
    if (charge.freeQty > 0) {
      items.push({
        menuItemId: id,
        name: itemName,
        price: 0,
        quantity: charge.freeQty,
        listPrice,
      });
    }
    if (charge.paidQty > 0) {
      items.push({
        menuItemId: id,
        name: itemName,
        price: charge.staffPrice,
        quantity: charge.paidQty,
        listPrice,
      });
    }
  }
  if (items.length === 0) {
    throw new Error("Staff consumption needs at least one item.");
  }

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
