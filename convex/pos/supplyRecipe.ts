import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type SupplyRecipeLine = {
  supplyMenuItemId: Id<"menuItems">;
  qtyPerUnit: number;
};

/**
 * Validates recipe rows, merges duplicate supply IDs, ensures targets are tracked inventory in the same restaurant.
 */
export async function assertAndNormalizeSupplyRecipe(
  ctx: MutationCtx,
  restaurantId: Id<"restaurants">,
  raw: SupplyRecipeLine[] | undefined,
  excludeMenuItemId: Id<"menuItems"> | undefined,
): Promise<SupplyRecipeLine[] | undefined> {
  if (raw === undefined) return undefined;
  if (raw.length === 0) return [];

  const merged = new Map<string, number>();
  for (const row of raw) {
    const q = row.qtyPerUnit;
    if (!(q > 0) || !Number.isFinite(q)) {
      continue;
    }
    const sid = row.supplyMenuItemId;
    if (excludeMenuItemId && sid === excludeMenuItemId) {
      throw new ConvexError({
        message: "Recipe cannot reference the same menu item.",
        code: "BAD_REQUEST",
      });
    }
    const doc = await ctx.db.get(sid);
    if (!doc || doc.restaurantId !== restaurantId) {
      throw new ConvexError({
        message: "Invalid supply ingredient.",
        code: "BAD_REQUEST",
      });
    }
    if (!doc.trackStock) {
      throw new ConvexError({
        message: "Recipe ingredients must have stock tracking enabled.",
        code: "BAD_REQUEST",
      });
    }
    merged.set(sid, (merged.get(sid) ?? 0) + q);
  }
  if (merged.size === 0) return [];
  return [...merged.entries()].map(([supplyMenuItemId, qtyPerUnit]) => ({
    supplyMenuItemId: supplyMenuItemId as Id<"menuItems">,
    qtyPerUnit,
  }));
}

/**
 * Deducts tracked supply stock for each recipe line (qty per sold unit × portion count).
 */
export async function applySupplyRecipeDeductions(
  ctx: MutationCtx,
  options: {
    restaurantId: Id<"restaurants">;
    recipe: SupplyRecipeLine[] | undefined;
    portionCount: number;
    soldMenuItemName: string;
    staffName: string;
    contextNote: string;
  },
): Promise<void> {
  const { recipe, portionCount } = options;
  if (!recipe?.length || portionCount <= 0) return;

  for (const line of recipe) {
    if (line.qtyPerUnit <= 0) continue;
    const supply = await ctx.db.get(line.supplyMenuItemId);
    if (!supply || supply.restaurantId !== options.restaurantId) continue;
    if (!supply.trackStock || supply.currentStock === undefined) continue;

    const delta = line.qtyPerUnit * portionCount;
    const newStock = supply.currentStock - delta;
    await ctx.db.patch(line.supplyMenuItemId, { currentStock: newStock });
    await ctx.db.insert("stockLogs", {
      restaurantId: options.restaurantId,
      menuItemId: line.supplyMenuItemId,
      staffName: options.staffName,
      type: "recipe_sale",
      change: -delta,
      balanceAfter: newStock,
      note: `${options.contextNote} — recipe: ${options.soldMenuItemName}`,
      createdAt: new Date().toISOString(),
    });
  }
}
