import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getRestaurantByLicense } from "./helpers";

const TABLE_STATUS = v.union(
  v.literal("available"),
  v.literal("occupied"),
  v.literal("reserved"),
  v.literal("bill-printed"),
);

const TABLE_SHAPE = v.optional(v.union(
  v.literal("square"),
  v.literal("circle"),
  v.literal("rectangle"),
));

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

export const getTablesByZone = query({
  args: { licenseKey: v.string(), zone: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    return await ctx.db
      .query("tables")
      .withIndex("by_restaurant_and_zone", (q) =>
        q.eq("restaurantId", restaurant._id).eq("zone", args.zone)
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
    posX: v.optional(v.number()),
    posY: v.optional(v.number()),
    shape: TABLE_SHAPE,
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    return await ctx.db.insert("tables", {
      restaurantId: restaurant._id,
      name: args.name,
      seats: args.seats,
      zone: args.zone,
      status: "available",
      posX: args.posX ?? 100,
      posY: args.posY ?? 100,
      shape: args.shape ?? "square",
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
    status: TABLE_STATUS,
    shape: TABLE_SHAPE,
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
      shape: args.shape,
    });
  },
});

export const moveTable = mutation({
  args: {
    licenseKey: v.string(),
    tableId: v.id("tables"),
    posX: v.number(),
    posY: v.number(),
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
      posX: args.posX,
      posY: args.posY,
    });
  },
});

export const setTableStatus = mutation({
  args: {
    licenseKey: v.string(),
    tableId: v.id("tables"),
    status: TABLE_STATUS,
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
    await ctx.db.patch(args.tableId, { status: args.status });
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
