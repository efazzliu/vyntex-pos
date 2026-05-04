import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getRestaurantByLicense } from "./helpers.ts";

/** Log a staff consumption entry (items selected from menu) */
export const addConsumption = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.id("staff"),
    staffName: v.string(),
    loggedByStaffId: v.id("staff"),
    loggedByStaffName: v.string(),
    items: v.array(
      v.object({
        menuItemId: v.id("menuItems"),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
        listPrice: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const total = args.items.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );
    const listTotal = args.items.reduce((sum, i) => {
      const unit = i.listPrice ?? i.price;
      return sum + unit * i.quantity;
    }, 0);
    const now = new Date().toISOString();

    const id = await ctx.db.insert("staffConsumption", {
      restaurantId: restaurant._id,
      staffId: args.staffId,
      staffName: args.staffName,
      loggedByStaffId: args.loggedByStaffId,
      loggedByStaffName: args.loggedByStaffName,
      items: args.items,
      total,
      cleared: false,
      createdAt: now,
    });

    for (const line of args.items) {
      const menuItem = await ctx.db.get(line.menuItemId);
      if (
        menuItem &&
        menuItem.trackStock &&
        menuItem.currentStock !== undefined
      ) {
        const newStock = menuItem.currentStock - line.quantity;
        await ctx.db.patch(line.menuItemId, { currentStock: newStock });
        await ctx.db.insert("stockLogs", {
          restaurantId: restaurant._id,
          menuItemId: line.menuItemId,
          staffName: args.loggedByStaffName,
          type: "staff_consumption",
          change: -line.quantity,
          balanceAfter: newStock,
          note: `Staff: ${args.staffName}`,
          createdAt: now,
        });
      }
    }

    const itemSummary = args.items
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(", ");
    const loggedBy =
      args.loggedByStaffId === args.staffId
        ? "self"
        : args.loggedByStaffName;
    const valueNote =
      listTotal > total + 0.005
        ? ` — list ${listTotal.toFixed(2)}, charged ${total.toFixed(2)}`
        : "";
    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: args.loggedByStaffId,
      staffName: args.loggedByStaffName,
      action: "staff_consumption",
      details: `Staff consumption for ${args.staffName} (${total.toFixed(2)}): ${itemSummary} — logged by ${loggedBy}${valueNote}`,
      createdAt: now,
    });

    return id;
  },
});

/** Get uncleared consumption entries for a specific staff member */
export const getStaffConsumption = query({
  args: { licenseKey: v.string(), staffId: v.id("staff") },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const all = await ctx.db
      .query("staffConsumption")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const entries = all
      .filter((e) => !e.cleared && e.staffId === args.staffId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const total = entries.reduce((sum, e) => sum + e.total, 0);
    return { entries, total };
  },
});

/** Get all uncleared consumption (for daily summary / close day) */
export const getAllUnclearedConsumption = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const all = await ctx.db
      .query("staffConsumption")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const uncleared = all.filter((e) => !e.cleared);

    // Group by staff
    const byStaff: Record<string, { staffName: string; total: number; itemCount: number }> = {};
    for (const entry of uncleared) {
      const key = entry.staffId;
      if (!byStaff[key]) {
        byStaff[key] = { staffName: entry.staffName, total: 0, itemCount: 0 };
      }
      byStaff[key].total += entry.total;
      byStaff[key].itemCount += entry.items.reduce((s, i) => s + i.quantity, 0);
    }

    const total = uncleared.reduce((sum, e) => sum + e.total, 0);

    return { entries: uncleared, byStaff, total };
  },
});

/** Clear a specific staff member's consumption (called on shift close) */
export const clearStaffConsumption = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const all = await ctx.db
      .query("staffConsumption")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const uncleared = all.filter(
      (e) => !e.cleared && e.staffId === args.staffId
    );

    const total = uncleared.reduce((sum, e) => sum + e.total, 0);

    for (const entry of uncleared) {
      await ctx.db.patch(entry._id, { cleared: true });
    }

    return { clearedCount: uncleared.length, total };
  },
});

/** Clear all uncleared consumption (called on Close Day) */
export const clearAllConsumption = mutation({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const all = await ctx.db
      .query("staffConsumption")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const uncleared = all.filter((e) => !e.cleared);
    const total = uncleared.reduce((sum, e) => sum + e.total, 0);

    for (const entry of uncleared) {
      await ctx.db.patch(entry._id, { cleared: true });
    }

    return { clearedCount: uncleared.length, total };
  },
});
