import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getRestaurantByLicense } from "./helpers";
import { completeOrderPaymentInCtx } from "./orders";

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

const permissionsValidator = v.optional(
  v.object({
    canVoidItems: v.boolean(),
    canGiveDiscount: v.boolean(),
    canTransferTables: v.boolean(),
    canMergeTables: v.optional(v.boolean()),
    canSplitBills: v.optional(v.boolean()),
    canViewReports: v.boolean(),
    canManageMenu: v.boolean(),
    canManageStock: v.boolean(),
    canLogStaffConsumption: v.optional(v.boolean()),
    canChargeDebt: v.optional(v.boolean()),
    canMarkComplimentary: v.optional(v.boolean()),
    canViewAuditLog: v.optional(v.boolean()),
  })
);

export const createStaff = mutation({
  args: {
    licenseKey: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("manager"),
      v.literal("waiter"),
      v.literal("inventory"),
      v.literal("accountant"),
      v.literal("auditor"),
      v.literal("kitchen")
    ),
    pinHash: v.string(),
    permissions: permissionsValidator,
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
      permissions: args.permissions,
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
      v.literal("manager"),
      v.literal("waiter"),
      v.literal("inventory"),
      v.literal("accountant"),
      v.literal("auditor"),
      v.literal("kitchen")
    ),
    pinHash: v.optional(v.string()),
    isActive: v.boolean(),
    permissions: permissionsValidator,
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
    }

    await ctx.db.patch(args.staffId, {
      name: args.name,
      role: args.role,
      isActive: args.isActive,
      permissions: args.permissions,
      ...(args.pinHash ? { pinHash: args.pinHash } : {}),
    });
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
    openingCash: v.optional(v.number()),
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
      openingCash: args.openingCash,
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

/**
 * Check if a staff member has an open (unsettled) shift.
 * Used at login to determine whether to show "Start New Shift" or go directly to dashboard.
 */
export const getShiftStatus = query({
  args: {
    licenseKey: v.string(),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);

    // Find the most recent shift for this staff member
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_staff", (q) => q.eq("staffId", args.staffId))
      .order("desc")
      .take(1);

    const latestShift = shifts[0] ?? null;

    // No shifts at all → brand new staff, needs to start a shift
    if (!latestShift) {
      return { hasOpenShift: false, openShiftId: null, openingCash: null };
    }

    // Has an open shift (no clockOut) → continuing
    if (!latestShift.clockOut) {
      return {
        hasOpenShift: true,
        openShiftId: latestShift._id,
        openingCash: latestShift.openingCash ?? null,
      };
    }

    // Shift is closed → needs to start new shift
    return { hasOpenShift: false, openShiftId: null, openingCash: null };
  },
});

// Verify an admin PIN and return the admin staff ID if valid
export const verifyAdminPin = query({
  args: {
    licenseKey: v.string(),
    pinHash: v.string(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const allStaff = await ctx.db
      .query("staff")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const admin = allStaff.find(
      (s) => (s.role === "admin" || s.role === "manager") && s.pinHash === args.pinHash && s.isActive
    );

    if (!admin) return null;
    return { adminId: admin._id, adminName: admin.name };
  },
});

// Close an individual staff member's shift (requires admin verification)
export const closeStaffShift = mutation({
  args: {
    licenseKey: v.string(),
    shiftId: v.id("shifts"),
    staffName: v.string(),
    adminStaffId: v.id("staff"),
    adminStaffName: v.string(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    // Verify admin or manager
    const admin = await ctx.db.get(args.adminStaffId);
    if (!admin || (admin.role !== "admin" && admin.role !== "manager")) {
      throw new ConvexError({
        message: "Only admin or manager can close shifts",
        code: "FORBIDDEN",
      });
    }

    const shift = await ctx.db.get(args.shiftId);
    if (!shift || shift.clockOut) {
      throw new ConvexError({
        message: "Shift not found or already closed",
        code: "NOT_FOUND",
      });
    }

    const now = new Date().toISOString();

    // Auto-settle this waiter's open orders (cash, no receipt) so stock and totals stay correct
    const allRestaurantOrders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    const openWaiterOrders = allRestaurantOrders.filter(
      (o) =>
        o.staffId === shift.staffId &&
        o.status !== "paid" &&
        o.status !== "cancelled"
    );
    for (const o of openWaiterOrders) {
      await completeOrderPaymentInCtx(ctx, {
        licenseKey: args.licenseKey,
        orderId: o._id,
        paymentMethod: "cash",
        paymentType: "no_receipt",
        staffId: args.adminStaffId,
        staffName: args.adminStaffName,
        auditDetailsSuffix: ` [Auto: shift close for ${args.staffName}]`,
      });
    }

    await ctx.db.patch(args.shiftId, { clockOut: now });

    // Clear waiter's uncleared expenses
    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const waiterExpenses = allExpenses.filter(
      (e) => !e.cleared && e.staffId === shift.staffId
    );
    let expensesTotal = 0;
    for (const expense of waiterExpenses) {
      expensesTotal += expense.amount;
      await ctx.db.patch(expense._id, { cleared: true });
    }

    const allConsumption = await ctx.db
      .query("staffConsumption")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    const waiterConsumption = allConsumption.filter(
      (c) => !c.cleared && c.staffId === shift.staffId
    );
    let consumptionTotal = 0;
    for (const entry of waiterConsumption) {
      consumptionTotal += entry.total;
      await ctx.db.patch(entry._id, { cleared: true });
    }

    // Build expenses summary for audit
    const expensesSummary = expensesTotal > 0
      ? ` Expenses: $${expensesTotal.toFixed(2)} (${waiterExpenses.length} items cleared).`
      : "";
    const consumptionSummary = consumptionTotal > 0
      ? ` Staff consumption: $${consumptionTotal.toFixed(2)} (${waiterConsumption.length} cleared).`
      : "";
    const autoOrdersSummary =
      openWaiterOrders.length > 0
        ? ` Open orders auto-paid (no receipt): ${openWaiterOrders.length}.`
        : "";

    // Audit log
    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: args.adminStaffId,
      staffName: args.adminStaffName,
      action: "shift_close",
      details: `Shift closed for ${args.staffName} by ${args.adminStaffName}.${autoOrdersSummary}${expensesSummary}${consumptionSummary}`,
      createdAt: now,
    });

    return {
      success: true,
      autoClosedOrders: openWaiterOrders.length,
      expensesTotal,
      expensesCount: waiterExpenses.length,
      consumptionTotal,
      consumptionCount: waiterConsumption.length,
    };
  },
});
