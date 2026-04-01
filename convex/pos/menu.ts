import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getRestaurantByLicense } from "./helpers";

// ── Queries ──────────────────────────────────────────

export const getCategories = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const categories = await ctx.db
      .query("menuCategories")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    return categories.sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

export const getAllItems = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    return await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
  },
});

// ── Category Mutations ───────────────────────────────

export const createCategory = mutation({
  args: {
    licenseKey: v.string(),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const existing = await ctx.db
      .query("menuCategories")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const maxOrder = existing.reduce(
      (max, c) => Math.max(max, c.displayOrder),
      -1
    );

    return await ctx.db.insert("menuCategories", {
      restaurantId: restaurant._id,
      name: args.name,
      color: args.color,
      displayOrder: maxOrder + 1,
      isActive: true,
    });
  },
});

export const updateCategory = mutation({
  args: {
    licenseKey: v.string(),
    categoryId: v.id("menuCategories"),
    name: v.string(),
    color: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      throw new ConvexError({
        message: "Category not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.categoryId, {
      name: args.name,
      color: args.color,
      isActive: args.isActive,
    });
  },
});

export const deleteCategory = mutation({
  args: {
    licenseKey: v.string(),
    categoryId: v.id("menuCategories"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);

    // Delete all items in this category first
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.categoryId);
  },
});

// ── Item Mutations ───────────────────────────────────

export const createItem = mutation({
  args: {
    licenseKey: v.string(),
    categoryId: v.id("menuCategories"),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const existing = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    const maxOrder = existing.reduce(
      (max, i) => Math.max(max, i.displayOrder),
      -1
    );

    return await ctx.db.insert("menuItems", {
      restaurantId: restaurant._id,
      categoryId: args.categoryId,
      name: args.name,
      description: args.description,
      price: args.price,
      available: true,
      displayOrder: maxOrder + 1,
    });
  },
});

export const updateItem = mutation({
  args: {
    licenseKey: v.string(),
    itemId: v.id("menuItems"),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    available: v.boolean(),
    categoryId: v.id("menuCategories"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }

    await ctx.db.patch(args.itemId, {
      name: args.name,
      description: args.description,
      price: args.price,
      available: args.available,
      categoryId: args.categoryId,
    });
  },
});

export const toggleItemAvailability = mutation({
  args: {
    licenseKey: v.string(),
    itemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }
    await ctx.db.patch(args.itemId, { available: !item.available });
  },
});

export const deleteItem = mutation({
  args: {
    licenseKey: v.string(),
    itemId: v.id("menuItems"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    await ctx.db.delete(args.itemId);
  },
});
