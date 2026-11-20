import { isStockUnit, type StockUnit } from "@/lib/stock-units.ts";

export type SupplyRecipeLine = {
  supplyMenuItemId: string;
  qtyPerUnit: number;
  /** Unit `qtyPerUnit` is written in; omitted = the ingredient's own stock unit. */
  unit?: StockUnit;
};

/** Normalize a `menu_items.supply_recipe` payload (order is kept, same ingredient + unit merged). */
export function normalizeSupplyRecipeForDb(raw: unknown): SupplyRecipeLine[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const merged = new Map<string, SupplyRecipeLine>();
  for (const row of raw as Record<string, unknown>[]) {
    const sid = String(row.supplyMenuItemId ?? row.supply_menu_item_id ?? "").trim();
    const q = Number(row.qtyPerUnit ?? row.qty_per_unit);
    if (!sid || !Number.isFinite(q) || q <= 0) continue;
    const unit = isStockUnit(row.unit) ? row.unit : undefined;
    const key = `${sid}|${unit ?? ""}`;
    const prev = merged.get(key);
    merged.set(key, {
      supplyMenuItemId: sid,
      qtyPerUnit: (prev?.qtyPerUnit ?? 0) + q,
      ...(unit ? { unit } : {}),
    });
  }
  return [...merged.values()];
}
