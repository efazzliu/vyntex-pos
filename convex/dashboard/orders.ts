import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthRestaurant } from "./helpers.ts";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("preparing"),
        v.literal("ready"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    if (args.status) {
      return await ctx.db
        .query("orders")
        .withIndex("by_restaurant_and_status", (q) =>
          q.eq("restaurantId", restaurant._id).eq("status", args.status!)
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .order("desc")
      .take(100);
  },
});

export const getRecent = query({
  args: {},
  handler: async (ctx) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    return await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .order("desc")
      .take(5);
  },
});

export const create = mutation({
  args: {
    items: v.array(
      v.object({
        menuItemId: v.id("menuItems"),
        name: v.string(),
        price: v.number(),
        quantity: v.number(),
      })
    ),
    type: v.union(
      v.literal("dine-in"),
      v.literal("takeout"),
      v.literal("delivery")
    ),
    tableNumber: v.optional(v.string()),
    customerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    if (args.items.length === 0) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Order must have at least one item",
      });
    }
    // Generate order number
    const existingOrders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    const orderNumber = `#${String(existingOrders.length + 1).padStart(4, "0")}`;

    const subtotal = args.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = Math.round(subtotal * 0.08); // 8% tax
    const total = subtotal + tax;

    return await ctx.db.insert("orders", {
      restaurantId: restaurant._id,
      orderNumber,
      status: "pending",
      items: args.items,
      subtotal,
      tax,
      total,
      type: args.type,
      tableNumber: args.tableNumber,
      customerName: args.customerName,
      notes: args.notes,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    const order = await ctx.db.get(args.id);
    if (!order || order.restaurantId !== restaurant._id) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});
