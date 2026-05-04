import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getRestaurantByLicense } from "./helpers";

// ── Stock Queries ─────────────────────────────────────

export const getStockItems = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const trackedItems = items.filter((i) => i.trackStock);

    const enriched = await Promise.all(
      trackedItems.map(async (item) => {
        const category = await ctx.db.get(item.categoryId);
        const current = item.currentStock ?? 0;
        const isLowStock =
          item.lowStockThreshold !== undefined &&
          current > 0 &&
          current <= item.lowStockThreshold;
        const isOutOfStock = current <= 0;
        return {
          ...item,
          categoryName: category?.name ?? "Unknown",
          categoryColor: category?.color ?? "#5a6580",
          isLowStock,
          isOutOfStock,
        };
      })
    );

    return enriched.sort((a, b) => {
      if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? -1 : 1;
      if (a.isLowStock !== b.isLowStock) return a.isLowStock ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  },
});

export const getItemLogs = query({
  args: {
    licenseKey: v.string(),
    menuItemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const logs = await ctx.db
      .query("stockLogs")
      .withIndex("by_menuItem", (q) => q.eq("menuItemId", args.menuItemId))
      .order("desc")
      .take(100);
    return logs;
  },
});

/**
 * Get ALL stock logs for a restaurant (across all items), enriched with item names.
 * Used for the global "Stock History" dashboard view.
 */
export const getAllLogs = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const logs = await ctx.db
      .query("stockLogs")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id),
      )
      .order("desc")
      .take(200);

    // Enrich each log with the menu item name
    const enriched = await Promise.all(
      logs.map(async (log) => {
        const item = await ctx.db.get(log.menuItemId);
        return {
          ...log,
          itemName: item?.name ?? "Deleted item",
        };
      }),
    );

    return enriched;
  },
});

// ── Stock Mutations ───────────────────────────────────

/**
 * Add quantity to current stock (the "+" quick add).
 * Prevents double-entries by checking a debounce window.
 */
export const addStock = mutation({
  args: {
    licenseKey: v.string(),
    itemId: v.id("menuItems"),
    quantity: v.number(),
    staffName: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }
    if (args.quantity <= 0) {
      throw new ConvexError({
        message: "Quantity must be greater than 0",
        code: "BAD_REQUEST",
      });
    }

    // Prevent rapid double-entries: reject if identical add within 3 seconds
    const recentLogs = await ctx.db
      .query("stockLogs")
      .withIndex("by_menuItem", (q) => q.eq("menuItemId", args.itemId))
      .order("desc")
      .take(1);

    if (recentLogs.length > 0) {
      const lastLog = recentLogs[0];
      const timeSinceLastMs =
        Date.now() - new Date(lastLog.createdAt).getTime();
      if (
        timeSinceLastMs < 3000 &&
        lastLog.type === "manual_addition" &&
        lastLog.change === args.quantity
      ) {
        throw new ConvexError({
          message:
            "Duplicate entry detected. Please wait a moment before adding the same quantity again.",
          code: "CONFLICT",
        });
      }
    }

    const previousStock = item.currentStock ?? 0;
    const newStock = previousStock + args.quantity;

    await ctx.db.patch(args.itemId, { currentStock: newStock });

    await ctx.db.insert("stockLogs", {
      restaurantId: restaurant._id,
      menuItemId: args.itemId,
      staffName: args.staffName,
      type: "manual_addition",
      change: args.quantity,
      balanceAfter: newStock,
      note: args.note,
      createdAt: new Date().toISOString(),
    });

    return newStock;
  },
});

/**
 * Set stock to an exact value (manual adjustment).
 */
export const setStock = mutation({
  args: {
    licenseKey: v.string(),
    itemId: v.id("menuItems"),
    newStock: v.number(),
    staffName: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }
    const previousStock = item.currentStock ?? 0;
    const change = args.newStock - previousStock;

    await ctx.db.patch(args.itemId, { currentStock: args.newStock });

    await ctx.db.insert("stockLogs", {
      restaurantId: restaurant._id,
      menuItemId: args.itemId,
      staffName: args.staffName,
      type: "manual_set",
      change,
      balanceAfter: args.newStock,
      note: args.note ?? `Set from ${previousStock} to ${args.newStock}`,
      createdAt: new Date().toISOString(),
    });

    return args.newStock;
  },
});

/**
 * Remove quantity from current stock (the "-" quick remove).
 * Prevents double-entries by checking a debounce window.
 */
export const removeStock = mutation({
  args: {
    licenseKey: v.string(),
    itemId: v.id("menuItems"),
    quantity: v.number(),
    staffName: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }
    if (args.quantity <= 0) {
      throw new ConvexError({
        message: "Quantity must be greater than 0",
        code: "BAD_REQUEST",
      });
    }

    // Prevent rapid double-entries
    const recentLogs = await ctx.db
      .query("stockLogs")
      .withIndex("by_menuItem", (q) => q.eq("menuItemId", args.itemId))
      .order("desc")
      .take(1);

    if (recentLogs.length > 0) {
      const lastLog = recentLogs[0];
      const timeSinceLastMs =
        Date.now() - new Date(lastLog.createdAt).getTime();
      if (
        timeSinceLastMs < 3000 &&
        lastLog.type === "adjustment" &&
        lastLog.change === -args.quantity
      ) {
        throw new ConvexError({
          message:
            "Duplicate entry detected. Please wait a moment before removing the same quantity again.",
          code: "CONFLICT",
        });
      }
    }

    const previousStock = item.currentStock ?? 0;
    const newStock = previousStock - args.quantity;

    await ctx.db.patch(args.itemId, { currentStock: newStock });

    await ctx.db.insert("stockLogs", {
      restaurantId: restaurant._id,
      menuItemId: args.itemId,
      staffName: args.staffName,
      type: "adjustment",
      change: -args.quantity,
      balanceAfter: newStock,
      note: args.note,
      createdAt: new Date().toISOString(),
    });

    return newStock;
  },
});
