import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getRestaurantByLicense } from "./helpers";

// ── Category Queries ────────────────────────────────

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

// ── Menu Queries ────────────────────────────────────

export const getMenus = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    return menus.sort((a, b) => a.displayOrder - b.displayOrder);
  },
});

// ── Item Queries ────────────────────────────────────

export const getAllItems = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    return Promise.all(
      items.map(async (item) => ({
        ...item,
        imageUrl: item.imageStorageId
          ? await ctx.storage.getUrl(item.imageStorageId)
          : null,
      }))
    );
  },
});

// ── File Upload ────────────────────────────────────

export const generateUploadUrl = mutation({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    return await ctx.storage.generateUploadUrl();
  },
});

// ── Category Mutations ──────────────────────────────

export const createCategory = mutation({
  args: {
    licenseKey: v.string(),
    name: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
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
      icon: args.icon,
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
    icon: v.optional(v.string()),
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
      icon: args.icon,
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

// ── Menu Mutations ──────────────────────────────────

export const createMenu = mutation({
  args: {
    licenseKey: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const existing = await ctx.db
      .query("menus")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const maxOrder = existing.reduce(
      (max, m) => Math.max(max, m.displayOrder),
      -1
    );

    return await ctx.db.insert("menus", {
      restaurantId: restaurant._id,
      name: args.name,
      displayOrder: maxOrder + 1,
      isActive: true,
    });
  },
});

export const updateMenu = mutation({
  args: {
    licenseKey: v.string(),
    menuId: v.id("menus"),
    name: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const menu = await ctx.db.get(args.menuId);
    if (!menu) {
      throw new ConvexError({ message: "Menu not found", code: "NOT_FOUND" });
    }
    await ctx.db.patch(args.menuId, {
      name: args.name,
      isActive: args.isActive,
    });
  },
});

export const deleteMenu = mutation({
  args: {
    licenseKey: v.string(),
    menuId: v.id("menus"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);

    // Unassign items from this menu
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_menu", (q) => q.eq("menuId", args.menuId))
      .collect();

    for (const item of items) {
      await ctx.db.patch(item._id, { menuId: undefined });
    }

    await ctx.db.delete(args.menuId);
  },
});

// ── Item Mutations ──────────────────────────────────

export const createItem = mutation({
  args: {
    licenseKey: v.string(),
    categoryId: v.id("menuCategories"),
    menuId: v.optional(v.id("menus")),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    station: v.union(v.literal("kitchen"), v.literal("bar")),
    vatRate: v.optional(v.number()),
    imageStorageId: v.optional(v.id("_storage")),
    isFavorite: v.optional(v.boolean()),
    staffMealAllowed: v.optional(v.boolean()),
    staffMealPrice: v.optional(v.number()),
    trackStock: v.optional(v.boolean()),
    stockUnit: v.optional(v.union(v.literal("pc"), v.literal("lt"), v.literal("kg"), v.literal("g"), v.literal("ml"), v.literal("bottle"), v.literal("box"))),
    initialStock: v.optional(v.number()),
    lowStockThreshold: v.optional(v.number()),
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
      menuId: args.menuId,
      name: args.name,
      description: args.description,
      price: args.price,
      available: true,
      displayOrder: maxOrder + 1,
      station: args.station,
      vatRate: args.vatRate,
      imageStorageId: args.imageStorageId,
      isFavorite: args.isFavorite,
      staffMealAllowed: args.staffMealAllowed,
      staffMealPrice: args.staffMealPrice,
      trackStock: args.trackStock,
      stockUnit: args.stockUnit,
      initialStock: args.initialStock,
      currentStock: args.trackStock ? (args.initialStock ?? 0) : undefined,
      lowStockThreshold: args.lowStockThreshold,
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
    menuId: v.optional(v.id("menus")),
    station: v.union(v.literal("kitchen"), v.literal("bar")),
    vatRate: v.optional(v.number()),
    imageStorageId: v.optional(v.id("_storage")),
    isFavorite: v.optional(v.boolean()),
    staffMealAllowed: v.optional(v.boolean()),
    staffMealPrice: v.optional(v.number()),
    trackStock: v.optional(v.boolean()),
    stockUnit: v.optional(v.union(v.literal("pc"), v.literal("lt"), v.literal("kg"), v.literal("g"), v.literal("ml"), v.literal("bottle"), v.literal("box"))),
    initialStock: v.optional(v.number()),
    currentStock: v.optional(v.number()),
    lowStockThreshold: v.optional(v.number()),
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
      menuId: args.menuId,
      station: args.station,
      vatRate: args.vatRate,
      imageStorageId: args.imageStorageId,
      isFavorite: args.isFavorite,
      staffMealAllowed: args.staffMealAllowed,
      staffMealPrice: args.staffMealPrice,
      trackStock: args.trackStock,
      stockUnit: args.stockUnit,
      initialStock: args.initialStock,
      currentStock: args.currentStock,
      lowStockThreshold: args.lowStockThreshold,
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

// Stock queries and mutations are in convex/pos/stock.ts
