import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getRestaurantByLicense } from "./helpers";

// ── Queries ──────────────────────────────────────────

export const getStaff = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    return await ctx.db
      .query("staff")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
  },
});

export const getActiveShift = query({
  args: { staffId: v.id("staff") },
  handler: async (ctx, args) => {
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .order("desc")
      .take(1);

    const latest = shifts[0];
    if (latest && !latest.clockOut) return latest;
    return null;
  },
});

// ── Mutations ────────────────────────────────────────

export const createStaff = mutation({
  args: {
    licenseKey: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("waiter"),
      v.literal("kitchen")
    ),
    pinHash: v.string(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    // Prevent duplicate PINs within the same restaurant
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    if (existing.some((s) => s.pinHash === args.pinHash)) {
      throw new ConvexError({
        message: "This PIN is already in use by another staff member",
        code: "CONFLICT",
      });
    }

    return await ctx.db.insert("staff", {
      restaurantId: restaurant._id,
      name: args.name,
      role: args.role,
      pinHash: args.pinHash,
      isActive: true,
    });
  },
});

export const updateStaff = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.id("staff"),
    name: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("waiter"),
      v.literal("kitchen")
    ),
    pinHash: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const staff = await ctx.db.get(args.staffId);
    if (!staff) {
      throw new ConvexError({
        message: "Staff member not found",
        code: "NOT_FOUND",
      });
    }

    // Check for duplicate PIN if changing
    if (args.pinHash) {
      const allStaff = await ctx.db
        .query("staff")
        .withIndex("by_restaurant", (q) =>
          q.eq("restaurantId", restaurant._id)
        )
        .collect();

      if (
        allStaff.some(
          (s) => s._id !== args.staffId && s.pinHash === args.pinHash
        )
      ) {
        throw new ConvexError({
          message: "This PIN is already in use by another staff member",
          code: "CONFLICT",
        });
      }

      await ctx.db.patch(args.staffId, {
        name: args.name,
        role: args.role,
        isActive: args.isActive,
        pinHash: args.pinHash,
      });
    } else {
      await ctx.db.patch(args.staffId, {
        name: args.name,
        role: args.role,
        isActive: args.isActive,
      });
    }
  },
});

export const deleteStaff = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);

    const staff = await ctx.db.get(args.staffId);
    if (!staff) {
      throw new ConvexError({
        message: "Staff member not found",
        code: "NOT_FOUND",
      });
    }

    // Delete associated shifts
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .collect();

    for (const shift of shifts) {
      await ctx.db.delete(shift._id);
    }

    await ctx.db.delete(args.staffId);
  },
});

export const clockIn = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    // Close any existing open shift for this staff member
    const openShifts = await ctx.db
      .query("shifts")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .collect();

    for (const shift of openShifts) {
      if (!shift.clockOut) {
        await ctx.db.patch(shift._id, {
          clockOut: new Date().toISOString(),
        });
      }
    }

    return await ctx.db.insert("shifts", {
      staffId: args.staffId,
      restaurantId: restaurant._id,
      clockIn: new Date().toISOString(),
    });
  },
});

export const clockOut = mutation({
  args: {
    licenseKey: v.string(),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);

    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.clockOut) return;

    await ctx.db.patch(args.shiftId, {
      clockOut: new Date().toISOString(),
    });
  },
});
