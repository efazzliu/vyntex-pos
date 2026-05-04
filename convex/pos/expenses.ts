import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getRestaurantByLicense } from "./helpers.ts";

/** Add a daily expense and log it to the audit trail */
export const addExpense = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.id("staff"),
    staffName: v.string(),
    amount: v.number(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const now = new Date().toISOString();

    const expenseId = await ctx.db.insert("expenses", {
      restaurantId: restaurant._id,
      staffId: args.staffId,
      staffName: args.staffName,
      amount: args.amount,
      note: args.note,
      cleared: false,
      createdAt: now,
    });

    // Audit log entry
    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: args.staffId,
      staffName: args.staffName,
      action: "expense",
      details: `Expense ${args.amount.toFixed(2)}: ${args.note}`,
      createdAt: now,
    });

    return expenseId;
  },
});

/** Get today's uncleared expenses for a specific staff member */
export const getTodayExpenses = query({
  args: { licenseKey: v.string(), staffId: v.id("staff") },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    // Only show uncleared expenses for this staff member
    const unclearedExpenses = allExpenses.filter(
      (e) => !e.cleared && e.staffId === args.staffId
    );

    // Sort newest first
    unclearedExpenses.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = unclearedExpenses.reduce((sum, e) => sum + e.amount, 0);

    return { expenses: unclearedExpenses, total };
  },
});

/** Get uncleared expenses for a waiter (used in shift close preview) */
export const getStaffExpenses = query({
  args: { licenseKey: v.string(), staffId: v.id("staff") },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const staffExpenses = allExpenses.filter(
      (e) => !e.cleared && e.staffId === args.staffId
    );

    staffExpenses.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const total = staffExpenses.reduce((sum, e) => sum + e.amount, 0);

    const entries = staffExpenses.map((e) => ({
      _id: e._id,
      amount: e.amount,
      note: e.note,
      createdAt: e.createdAt,
    }));

    return { expenses: staffExpenses, entries, total };
  },
});

/** Clear all uncleared expenses for a specific staff member (called on shift close) */
export const clearStaffExpenses = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const uncleared = allExpenses.filter(
      (e) => !e.cleared && e.staffId === args.staffId
    );

    const total = uncleared.reduce((sum, e) => sum + e.amount, 0);

    for (const expense of uncleared) {
      await ctx.db.patch(expense._id, { cleared: true });
    }

    return { clearedCount: uncleared.length, total };
  },
});

/** Get all uncleared expenses for the whole restaurant (used in Close Day) */
export const getAllUnclearedExpenses = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const uncleared = allExpenses.filter((e) => !e.cleared);
    const total = uncleared.reduce((sum, e) => sum + e.amount, 0);

    return { expenses: uncleared, total };
  },
});

/** Clear all uncleared expenses for the whole restaurant (called on Close Day) */
export const clearAllExpenses = mutation({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const uncleared = allExpenses.filter((e) => !e.cleared);
    const total = uncleared.reduce((sum, e) => sum + e.amount, 0);

    for (const expense of uncleared) {
      await ctx.db.patch(expense._id, { cleared: true });
    }

    return { clearedCount: uncleared.length, total };
  },
});
