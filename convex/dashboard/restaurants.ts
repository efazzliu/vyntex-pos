import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUser } from "./helpers.ts";

/**
 * Generate a 16-character license key formatted as XXXX-XXXX-XXXX-XXXX.
 * Uses an unambiguous character set (no I/O/0/1).
 */
function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "";
  for (let i = 0; i < 16; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${key.slice(0, 4)}-${key.slice(4, 8)}-${key.slice(8, 12)}-${key.slice(12, 16)}`;
}

/**
 * Every newly activated Restaurant POS license starts with a 30-day free trial.
 */
function getLicenseExpiryDate(_plan: "starter" | "professional" | "enterprise"): string {
  const now = new Date();
  const days = 30;
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString();
}

export const getMyRestaurant = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Not logged in",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return null;
    return await ctx.db
      .query("restaurants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("restaurant"),
      v.literal("cafe"),
      v.literal("bar"),
      v.literal("hotel"),
      v.literal("fitness")
    ),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    currency: v.string(),
    plan: v.union(
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise")
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (args.type !== "restaurant") {
      throw new ConvexError({
        code: "INVALID_TYPE",
        message: "Only Restaurant POS is available for activation.",
      });
    }
    if (args.plan !== "professional") {
      throw new ConvexError({
        code: "INVALID_PLAN",
        message: "Only Restaurant POS plan is available.",
      });
    }
    // Check if restaurant already exists
    const existing = await ctx.db
      .query("restaurants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "License already exists for this account",
      });
    }
    const licenseKey = generateLicenseKey();
    const licenseExpiry = getLicenseExpiryDate(args.plan);

    return await ctx.db.insert("restaurants", {
      userId: user._id,
      name: args.name,
      type: args.type,
      address: args.address,
      phone: args.phone,
      currency: args.currency,
      plan: args.plan,
      licenseKey,
      licenseExpiry,
      licenseStatus: "active",
    });
  },
});

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const restaurant = await ctx.db
      .query("restaurants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!restaurant) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "License not found",
      });
    }
    const updates: Record<string, string> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.address !== undefined) updates.address = args.address;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.currency !== undefined) updates.currency = args.currency;
    await ctx.db.patch(restaurant._id, updates);
  },
});
