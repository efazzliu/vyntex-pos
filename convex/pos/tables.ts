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

// Returns a map of tableId -> { staffId, staffName, total } for all occupied tables
export const getTableOrderSummaries = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const summaries: Record<string, { staffId: string; staffName: string; total: number }> = {};

    // Cache staff names to avoid repeated lookups
    const staffNameCache: Record<string, string> = {};

    for (const table of tables) {
      if (table.status !== "occupied" && table.status !== "bill-printed") continue;

      const activeOrders = await ctx.db
        .query("orders")
        .withIndex("by_table", (q) => q.eq("tableId", table._id))
        .collect();

      const openOrder = activeOrders.find(
        (o) => o.status !== "paid" && o.status !== "cancelled"
      );

      if (openOrder) {
        // Look up staff name
        let staffName = staffNameCache[openOrder.staffId];
        if (!staffName) {
          const staff = await ctx.db.get(openOrder.staffId);
          staffName = staff?.name ?? "Unknown";
          staffNameCache[openOrder.staffId] = staffName;
        }

        summaries[table._id] = {
          staffId: openOrder.staffId,
          staffName,
          total: openOrder.total,
        };
      }
    }

    return summaries;
  },
});

// ── Mutations ────────────────────────────────────────

export const createTable = mutation({
  args: {
    licenseKey: v.string(),
    name: v.optional(v.string()),
    seats: v.number(),
    zone: v.string(),
    posX: v.optional(v.number()),
    posY: v.optional(v.number()),
    shape: TABLE_SHAPE,
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    // Auto-calculate table name if not provided
    let tableName = args.name?.trim();
    if (!tableName) {
      const allTables = await ctx.db
        .query("tables")
        .withIndex("by_restaurant", (q) =>
          q.eq("restaurantId", restaurant._id)
        )
        .collect();

      // Find highest T-number across all tables
      let maxNum = 0;
      for (const t of allTables) {
        const match = t.name.match(/^T(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      tableName = `T${maxNum + 1}`;
    }

    // Place new tables in a grid-like pattern
    const zoneTables = await ctx.db
      .query("tables")
      .withIndex("by_restaurant_and_zone", (q) =>
        q.eq("restaurantId", restaurant._id).eq("zone", args.zone)
      )
      .collect();

    const col = zoneTables.length % 6;
    const row = Math.floor(zoneTables.length / 6);
    const defaultX = args.posX ?? 40 + col * 140;
    const defaultY = args.posY ?? 40 + row * 120;

    return await ctx.db.insert("tables", {
      restaurantId: restaurant._id,
      name: tableName,
      seats: args.seats,
      zone: args.zone,
      status: "available",
      posX: defaultX,
      posY: defaultY,
      shape: args.shape ?? "square",
    });
  },
});

// Rename a zone/room across all tables
export const renameZone = mutation({
  args: {
    licenseKey: v.string(),
    oldName: v.string(),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (!args.newName.trim()) {
      throw new ConvexError({ message: "Room name cannot be empty", code: "BAD_REQUEST" });
    }

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_restaurant_and_zone", (q) =>
        q.eq("restaurantId", restaurant._id).eq("zone", args.oldName)
      )
      .collect();

    for (const table of tables) {
      await ctx.db.patch(table._id, { zone: args.newName.trim() });
    }
  },
});

// Delete all tables in a zone/room
export const deleteZone = mutation({
  args: {
    licenseKey: v.string(),
    zone: v.string(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_restaurant_and_zone", (q) =>
        q.eq("restaurantId", restaurant._id).eq("zone", args.zone)
      )
      .collect();

    for (const table of tables) {
      await ctx.db.delete(table._id);
    }
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
    tableScale: v.optional(v.number()),
    tableScaleY: v.optional(v.number()),
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
      tableScale: args.tableScale,
      tableScaleY: args.tableScaleY,
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
