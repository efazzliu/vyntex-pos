import { supabase } from "@/lib/supabase.ts";
import { assertNoPgError } from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { normalizePlan } from "@/pages/pos/_lib/plan-features.ts";

type RecipeLineJson = Record<string, unknown>;

/** Normalize client payload for `menu_items.supply_recipe` jsonb. */
export function normalizeSupplyRecipeForDb(
  raw: unknown,
): { supplyMenuItemId: string; qtyPerUnit: number }[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const merged = new Map<string, number>();
  for (const row of raw as RecipeLineJson[]) {
    const sid = String(
      row.supplyMenuItemId ?? row.supply_menu_item_id ?? "",
    ).trim();
    const q = Number(row.qtyPerUnit ?? row.qty_per_unit);
    if (!sid || !Number.isFinite(q) || q <= 0) continue;
    merged.set(sid, (merged.get(sid) ?? 0) + q);
  }
  return [...merged.entries()].map(([supplyMenuItemId, qtyPerUnit]) => ({
    supplyMenuItemId,
    qtyPerUnit,
  }));
}

function parseRecipeLines(raw: unknown): { supplyId: string; qtyPerUnit: number }[] {
  const norm = normalizeSupplyRecipeForDb(raw);
  if (!norm?.length) return [];
  return norm.map((l) => ({ supplyId: l.supplyMenuItemId, qtyPerUnit: l.qtyPerUnit }));
}

/**
 * After sold quantities are applied to menu rows, deduct tracked supply stock from each
 * sold item’s `supply_recipe` (qty per sold unit × sold quantity).
 */
export async function applySupplyRecipeAfterSale(args: {
  restaurantId: string;
  qtyByMenuItemId: Map<string, number>;
  staffName: string;
  /** e.g. "Order #12" or "Staff meal: Anna" */
  contextNote: string;
  /** When set, recipe deduction runs only for Enterprise plan (same as POS UI). */
  licenseKey?: string;
}): Promise<void> {
  const { restaurantId, qtyByMenuItemId, staffName, contextNote, licenseKey } =
    args;
  if (qtyByMenuItemId.size === 0) return;

  if (!licenseKey?.trim()) return;
  const lic = await getRestaurantByLicense(licenseKey.trim());
  if (normalizePlan(lic.plan) !== "enterprise") return;

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

  const deltaBySupplyId = new Map<string, number>();
  const exampleDishNameBySupply = new Map<string, string>();

  for (const row of soldRows ?? []) {
    const soldId = String((row as { id?: string }).id ?? "");
    const soldQty = qtyByMenuItemId.get(soldId) ?? 0;
    if (soldQty <= 0) continue;
    const dishName = String((row as { name?: string }).name ?? "").trim() || "Item";
    const recipe = parseRecipeLines(
      (row as { supply_recipe?: unknown }).supply_recipe,
    );
    for (const line of recipe) {
      if (line.supplyId === soldId) continue;
      const add = line.qtyPerUnit * soldQty;
      deltaBySupplyId.set(
        line.supplyId,
        (deltaBySupplyId.get(line.supplyId) ?? 0) + add,
      );
      if (!exampleDishNameBySupply.has(line.supplyId)) {
        exampleDishNameBySupply.set(line.supplyId, dishName);
      }
    }
  }

  if (deltaBySupplyId.size === 0) return;

  const supplyIds = [...deltaBySupplyId.keys()];
  const { data: supplyRows, error: loadSupplyErr } = await supabase
    .from("menu_items")
    .select("id, track_stock, current_stock")
    .eq("restaurant_id", restaurantId)
    .in("id", supplyIds);
  assertNoPgError("Load supply rows for recipe", loadSupplyErr);

  const logRows: Record<string, unknown>[] = [];
  for (const srow of supplyRows ?? []) {
    const sid = String((srow as { id?: string }).id ?? "");
    const delta = deltaBySupplyId.get(sid) ?? 0;
    if (delta <= 0) continue;
    const track = Boolean((srow as { track_stock?: boolean }).track_stock);
    const prevRaw = (srow as { current_stock?: unknown }).current_stock;
    if (!track || prevRaw == null) continue;

    const prev = Number(prevRaw);
    const balanceAfter = prev - delta;
    const { error: upErr } = await supabase
      .from("menu_items")
      .update({ current_stock: balanceAfter })
      .eq("id", sid)
      .eq("restaurant_id", restaurantId);
    assertNoPgError("Recipe stock update", upErr);

    const dish = exampleDishNameBySupply.get(sid) ?? "";
    logRows.push({
      restaurant_id: restaurantId,
      menu_item_id: sid,
      staff_name: staffName,
      type: "recipe_sale",
      change: -delta,
      balance_after: balanceAfter,
      note: `${contextNote} — recipe: ${dish}`,
    });
  }

  if (logRows.length > 0) {
    const { error: logErr } = await supabase.from("pos_stock_logs").insert(logRows);
    assertNoPgError("Recipe stock logs", logErr);
  }
}
