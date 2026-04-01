import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getRestaurantByLicense } from "./helpers";

// ── Queries ──────────────────────────────────────────

export const getTables = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    return await ctx.db
      .query("tables")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
  },
});

// ── Mutations ────────────────────────────────────────

export const createTable = mutation({
  args: {
    licenseKey: v.string(),
    name: v.string(),
    seats: v.number(),
    zone: v.string(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    return await ctx.db.insert("tables", {
      restaurantId: restaurant._id,
      name: args.name,
      seats: args.seats,
      zone: args.zone,
      status: "available",
    });
  },
});

export const updateTable = mutation({
  args: {
    licenseKey: v.string(),
    tableId: v.id("tables"),
    name: v.string(),
    seats: v.number(),
    zone: v.string(),
    status: v.union(
      v.literal("available"),
      v.literal("occupied"),
      v.literal("reserved")
    ),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const table = await ctx.db.get(args.tableId);
    if (!table) {
      throw new ConvexError({
        message: "Table not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.tableId, {
      name: args.name,
      seats: args.seats,
      zone: args.zone,
      status: args.status,
    });
  },
});

export const deleteTable = mutation({
  args: {
    licenseKey: v.string(),
    tableId: v.id("tables"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    await ctx.db.delete(args.tableId);
  },
});
