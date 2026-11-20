import { supabase } from "@/lib/supabase.ts";
import { assertNoPgError } from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { normalizePlan } from "@/pages/pos/_lib/plan-features.ts";
import { convertStockQty, type StockUnit } from "@/lib/stock-units.ts";
import { normalizeSupplyRecipeForDb } from "@/lib/supply-recipe.ts";

export { normalizeSupplyRecipeForDb };

/**
 * Deduct tracked supply stock for sold quantities: each sold unit uses `qtyPerUnit` of every
 * ingredient in the dish's `supply_recipe`, converted into the ingredient's stock unit.
 *
 * `idempotencyKey` identifies one completed sale step; when stock logs already carry it the
 * call does nothing, so a retried payment never deducts the ingredients twice.
 */
export async function applySupplyRecipeAfterSale(args: {
  restaurantId: string;
  qtyByMenuItemId: Map<string, number>;
  staffName: string;
  /** e.g. "Order #12" or "Staff meal: Anna" */
  contextNote: string;
  /** When set, recipe deduction runs only for Enterprise plan (same as POS UI). */
  licenseKey?: string;
  idempotencyKey?: string;
}): Promise<void> {
  const { restaurantId, qtyByMenuItemId, staffName, contextNote, licenseKey, idempotencyKey } =
    args;
  if (qtyByMenuItemId.size === 0) return;

  if (!licenseKey?.trim()) return;
  const lic = await getRestaurantByLicense(licenseKey.trim());
  if (normalizePlan(lic.plan) !== "enterprise") return;

  const marker = idempotencyKey ? `[${idempotencyKey}]` : "";
  if (marker) {
    const { data: done, error: doneErr } = await supabase
      .from("pos_stock_logs")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("type", "recipe_sale")
      .like("note", `%${marker}%`)
      .limit(1);
    assertNoPgError("Check recipe deduction", doneErr);
    if ((done ?? []).length > 0) return;
  }

  const soldIds = [...qtyByMenuItemId.keys()];
  const { data: soldRows, error: loadSoldErr } = await supabase
    .from("menu_items")
    .select("id, name, supply_recipe")
    .eq("restaurant_id", restaurantId)
    .in("id", soldIds);

  if (loadSoldErr) {
    const msg = String(loadSoldErr.message ?? "").toLowerCase();
    if (msg.includes("supply_recipe") || msg.includes("schema cache")) {
      return;
    }
    assertNoPgError("Load menu items for recipe deduction", loadSoldErr);
  }

  type Use = { supplyId: string; qty: number; unit?: StockUnit; dish: string };
  const uses: Use[] = [];
  for (const row of soldRows ?? []) {
    const soldId = String((row as { id?: string }).id ?? "");
    const soldQty = qtyByMenuItemId.get(soldId) ?? 0;
    if (soldQty <= 0) continue;
    const dish = String((row as { name?: string }).name ?? "").trim() || "Item";
    const recipe = normalizeSupplyRecipeForDb((row as { supply_recipe?: unknown }).supply_recipe) ?? [];
    for (const line of recipe) {
      if (line.supplyMenuItemId === soldId) continue;
      uses.push({ supplyId: line.supplyMenuItemId, qty: line.qtyPerUnit * soldQty, unit: line.unit, dish });
    }
  }
  if (uses.length === 0) return;

  const supplyIds = [...new Set(uses.map((u) => u.supplyId))];
  const { data: supplyRows, error: loadSupplyErr } = await supabase
    .from("menu_items")
    .select("id, track_stock, current_stock, stock_unit")
    .eq("restaurant_id", restaurantId)
    .in("id", supplyIds);
  assertNoPgError("Load supply rows for recipe", loadSupplyErr);

  const logRows: Record<string, unknown>[] = [];
  const updates: { id: string; balanceAfter: number }[] = [];
  for (const srow of supplyRows ?? []) {
    const s = srow as { id?: string; track_stock?: boolean; current_stock?: unknown; stock_unit?: string | null };
    const sid = String(s.id ?? "");
    if (!s.track_stock) continue;
    let delta = 0;
    let dish = "";
    for (const use of uses) {
      if (use.supplyId !== sid) continue;
      const inStockUnit = convertStockQty(use.qty, use.unit, s.stock_unit);
      if (inStockUnit == null) continue;
      delta += inStockUnit;
      dish ||= use.dish;
    }
    if (delta <= 0) continue;

    const prev = Number(s.current_stock ?? 0);
    const balanceAfter = Math.round((prev - delta) * 1000) / 1000;
    updates.push({ id: sid, balanceAfter });
    logRows.push({
      restaurant_id: restaurantId,
      menu_item_id: sid,
      staff_name: staffName,
      type: "recipe_sale",
      change: -Math.round(delta * 1000) / 1000,
      balance_after: balanceAfter,
      note: `${contextNote} — recipe: ${dish}${marker ? ` ${marker}` : ""}`,
    });
  }

  if (logRows.length === 0) return;
  // The log (with its idempotency marker) is written before stock moves, so a retry after a
  // failure part-way through finds the marker instead of deducting a second time.
  const { error: logErr } = await supabase.from("pos_stock_logs").insert(logRows);
  assertNoPgError("Recipe stock logs", logErr);
  for (const u of updates) {
    const { error: upErr } = await supabase
      .from("menu_items")
      .update({ current_stock: u.balanceAfter })
      .eq("id", u.id)
      .eq("restaurant_id", restaurantId);
    assertNoPgError("Recipe stock update", upErr);
  }
}
