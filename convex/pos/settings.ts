import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { getRestaurantByLicense } from "./helpers.ts";

// ── Printers ─────────────────────────────────────────────

export const getPrinters = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (!restaurant) return [];
    return await ctx.db
      .query("printers")
      .withIndex("by_restaurant", (q) => q.eq("restaurantId", restaurant._id))
      .collect();
  },
});

export const addPrinter = mutation({
  args: {
    licenseKey: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("bluetooth"),
      v.literal("network"),
      v.literal("usb"),
    ),
    address: v.string(),
    role: v.union(
      v.literal("receipt"),
      v.literal("kitchen"),
      v.literal("bar"),
    ),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (!restaurant) throw new Error("Restaurant not found");
    return await ctx.db.insert("printers", {
      restaurantId: restaurant._id,
      name: args.name,
      type: args.type,
      address: args.address,
      role: args.role,
      isActive: true,
    });
  },
});

export const updatePrinter = mutation({
  args: {
    licenseKey: v.string(),
    printerId: v.id("printers"),
    name: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("receipt"),
        v.literal("kitchen"),
        v.literal("bar"),
      ),
    ),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (!restaurant) throw new Error("Restaurant not found");
    const printer = await ctx.db.get(args.printerId);
    if (!printer || printer.restaurantId !== restaurant._id) {
      throw new Error("Printer not found");
    }
    const updates: Record<string, string | boolean> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.role !== undefined) updates.role = args.role;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    await ctx.db.patch(args.printerId, updates);
  },
});

export const deletePrinter = mutation({
  args: {
    licenseKey: v.string(),
    printerId: v.id("printers"),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (!restaurant) throw new Error("Restaurant not found");
    const printer = await ctx.db.get(args.printerId);
    if (!printer || printer.restaurantId !== restaurant._id) {
      throw new Error("Printer not found");
    }
    await ctx.db.delete(args.printerId);
  },
});

// ── Company details (read from restaurant) ───────────────

export const getCompanyDetails = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (!restaurant) return null;
    return {
      name: restaurant.name,
      type: restaurant.type,
      address: restaurant.address ?? "",
      phone: restaurant.phone ?? "",
      currency: restaurant.currency,
      language: restaurant.language ?? "en",
      currencySymbol: restaurant.currencySymbol ?? "Lek",
      currencyPosition: restaurant.currencyPosition ?? "suffix",
      currencyDecimals: restaurant.currencyDecimals ?? 2,
      plan: restaurant.plan,
      licenseKey: restaurant.licenseKey,
      licenseExpiry: restaurant.licenseExpiry,
      licenseStatus: restaurant.licenseStatus,
    };
  },
});

/** Update language and currency settings */
export const updateLocaleSettings = mutation({
  args: {
    licenseKey: v.string(),
    language: v.optional(v.union(v.literal("en"), v.literal("sq"))),
    currencySymbol: v.optional(v.string()),
    currencyPosition: v.optional(
      v.union(v.literal("prefix"), v.literal("suffix"))
    ),
    currencyDecimals: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (!restaurant) throw new Error("Restaurant not found");

    const updates: Record<string, string | number> = {};
    if (args.language !== undefined) updates.language = args.language;
    if (args.currencySymbol !== undefined)
      updates.currencySymbol = args.currencySymbol;
    if (args.currencyPosition !== undefined)
      updates.currencyPosition = args.currencyPosition;
    if (args.currencyDecimals !== undefined)
      updates.currencyDecimals = args.currencyDecimals;

    await ctx.db.patch(restaurant._id, updates);
  },
});

/** Update business name, address, and phone (admin from POS settings). */
export const updateCompanyProfile = mutation({
  args: {
    licenseKey: v.string(),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    if (!restaurant) throw new Error("Restaurant not found");

    const updates: Record<string, string> = {};
    if (args.name !== undefined) {
      const n = args.name.trim();
      if (!n) throw new Error("Business name is required");
      updates.name = n;
    }
    if (args.address !== undefined) updates.address = args.address.trim();
    if (args.phone !== undefined) updates.phone = args.phone.trim();

    if (Object.keys(updates).length === 0) return;
    await ctx.db.patch(restaurant._id, updates);
  },
});
