import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthRestaurant } from "./helpers.ts";

// ── Categories ────────────────────────────────────────────

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    return await ctx.db
      .query("menuCategories")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
  },
});

export const createCategory = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    // Get max sortOrder for new category
    const categories = await ctx.db
      .query("menuCategories")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    const maxOrder = categories.reduce(
      (max, c) => Math.max(max, c.sortOrder),
      -1
    );
    return await ctx.db.insert("menuCategories", {
      restaurantId: restaurant._id,
      name: args.name,
      sortOrder: maxOrder + 1,
    });
  },
});

export const updateCategory = mutation({
  args: { id: v.id("menuCategories"), name: v.string() },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    const category = await ctx.db.get(args.id);
    if (!category || category.restaurantId !== restaurant._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found" });
    }
    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("menuCategories") },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    const category = await ctx.db.get(args.id);
    if (!category || category.restaurantId !== restaurant._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found" });
    }
    // Delete all menu items in this category
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("categoryId", args.id))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ── Menu Items ────────────────────────────────────────────

export const getMenuItems = query({
  args: {},
  handler: async (ctx) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    return await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
  },
});

export const createMenuItem = mutation({
  args: {
    categoryId: v.id("menuCategories"),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.restaurantId !== restaurant._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found" });
    }
    return await ctx.db.insert("menuItems", {
      restaurantId: restaurant._id,
      categoryId: args.categoryId,
      name: args.name,
      description: args.description,
      price: args.price,
      isAvailable: true,
    });
  },
});

export const updateMenuItem = mutation({
  args: {
    id: v.id("menuItems"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    categoryId: v.optional(v.id("menuCategories")),
    isAvailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.restaurantId !== restaurant._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Menu item not found" });
    }
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.price !== undefined) updates.price = args.price;
    if (args.categoryId !== undefined) updates.categoryId = args.categoryId;
    if (args.isAvailable !== undefined) updates.isAvailable = args.isAvailable;
    await ctx.db.patch(args.id, updates);
  },
});

export const deleteMenuItem = mutation({
  args: { id: v.id("menuItems") },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.restaurantId !== restaurant._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Menu item not found" });
    }
    await ctx.db.delete(args.id);
  },
});

export const toggleAvailability = mutation({
  args: { id: v.id("menuItems") },
  handler: async (ctx, args) => {
    const { restaurant } = await getAuthRestaurant(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.restaurantId !== restaurant._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Menu item not found" });
    }
    await ctx.db.patch(args.id, { isAvailable: !item.isAvailable });
  },
});
