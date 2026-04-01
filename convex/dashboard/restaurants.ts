import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUser } from "./helpers.ts";

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
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    // Check if restaurant already exists
    const existing = await ctx.db
      .query("restaurants")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Restaurant already exists",
      });
    }
    return await ctx.db.insert("restaurants", {
      userId: user._id,
      name: args.name,
      type: args.type,
      address: args.address,
      phone: args.phone,
      currency: args.currency,
      plan: "starter",
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
        message: "Restaurant not found",
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
