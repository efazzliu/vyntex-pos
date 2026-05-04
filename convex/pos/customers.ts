import { query, mutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { getRestaurantByLicense } from "./helpers";

// ── Queries ──────────────────────────────────────────

/** Get all customers for a restaurant */
export const getCustomers = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    return await ctx.db
      .query("customers")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
  },
});

/**
 * Debt ledger — returns every customer with computed balance info.
 * balance = totalDebt – totalPaid
 */
export const getDebtLedger = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    const debtOrders = orders.filter(
      (o) => o.paymentType === "debt" && o.status === "paid"
    );

    const payments = await ctx.db
      .query("debtPayments")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    return customers.map((customer) => {
      const custOrders = debtOrders.filter(
        (o) => o.customerId === customer._id
      );
      const custPayments = payments.filter(
        (p) => p.customerId === customer._id
      );

      const totalDebt = custOrders.reduce((s, o) => s + o.total, 0);
      const totalPaid = custPayments.reduce((s, p) => s + p.amount, 0);
      const balance = Math.round((totalDebt - totalPaid) * 100) / 100;

      const sorted = custOrders.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );

      return {
        ...customer,
        totalDebt,
        totalPaid,
        balance,
        orderCount: custOrders.length,
        lastOrderDate: sorted[0]?.createdAt ?? null,
      };
    });
  },
});

/**
 * Full statement of account for a single customer.
 * Returns a timeline of charge and payment transactions.
 */
export const getCustomerStatement = query({
  args: { licenseKey: v.string(), customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new ConvexError({
        message: "Customer not found",
        code: "NOT_FOUND",
      });
    }

    // Debt orders for this customer
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const debtOrders = allOrders.filter(
      (o) =>
        o.paymentType === "debt" &&
        o.customerId === args.customerId &&
        o.status === "paid"
    );

    // Enrich each order with items / staff / table
    const chargeTransactions = await Promise.all(
      debtOrders.map(async (order) => {
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        const staff = await ctx.db.get(order.staffId);
        const table = await ctx.db.get(order.tableId);

        return {
          type: "charge" as const,
          id: order._id as string,
          date: order.paidAt ?? order.createdAt,
          amount: order.total,
          staffName: staff?.name ?? "Unknown",
          tableName: table?.name ?? "Unknown",
          orderNumber: order.orderNumber,
          items: items
            .filter(
              (i) => i.status !== "cancelled" && i.status !== "voided"
            )
            .map((i) => ({
              name: i.name,
              quantity: i.quantity,
              price: i.price,
            })),
        };
      })
    );

    // Settlement payments
    const payments = await ctx.db
      .query("debtPayments")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .collect();

    const paymentTransactions = payments.map((p) => ({
      type: "payment" as const,
      id: p._id as string,
      date: p.createdAt,
      amount: p.amount,
      staffName: p.staffName,
      method: p.method,
      notes: p.notes,
    }));

    // Merge and sort ascending (oldest first for running-balance calc)
    const transactions = [
      ...chargeTransactions,
      ...paymentTransactions,
    ].sort((a, b) => a.date.localeCompare(b.date));

    const totalDebt = debtOrders.reduce((s, o) => s + o.total, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const balance = Math.round((totalDebt - totalPaid) * 100) / 100;

    return { customer, transactions, totalDebt, totalPaid, balance };
  },
});

/** Complimentary orders for reporting */
export const getComplimentaryOrders = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const compOrders = orders.filter(
      (o) => o.paymentType === "complimentary"
    );

    return await Promise.all(
      compOrders.map(async (order) => {
        const table = await ctx.db.get(order.tableId);
        const staff = await ctx.db.get(order.staffId);
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        return {
          ...order,
          tableName: table?.name ?? "Unknown",
          staffName: staff?.name ?? "Unknown",
          items,
        };
      })
    );
  },
});

// ── Mutations ────────────────────────────────────────

/** Create a new customer / debtor */
export const createCustomer = mutation({
  args: {
    licenseKey: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
    creditLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    return await ctx.db.insert("customers", {
      restaurantId: restaurant._id,
      name: args.name,
      phone: args.phone,
      email: args.email,
      notes: args.notes,
      creditLimit: args.creditLimit,
    });
  },
});

/** Update an existing customer / debtor */
export const updateCustomer = mutation({
  args: {
    licenseKey: v.string(),
    customerId: v.id("customers"),
    name: v.string(),
    phone: v.optional(v.string()),
    creditLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new ConvexError({
        message: "Customer not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.customerId, {
      name: args.name,
      phone: args.phone,
      creditLimit: args.creditLimit,
    });
  },
});

/** Record a debt settlement payment */
export const settleDebt = mutation({
  args: {
    licenseKey: v.string(),
    customerId: v.id("customers"),
    amount: v.number(),
    method: v.union(
      v.literal("cash"),
      v.literal("card"),
      v.literal("other")
    ),
    staffId: v.optional(v.id("staff")),
    staffName: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new ConvexError({
        message: "Customer not found",
        code: "NOT_FOUND",
      });
    }

    if (args.amount <= 0) {
      throw new ConvexError({
        message: "Amount must be positive",
        code: "BAD_REQUEST",
      });
    }

    const now = new Date().toISOString();

    const paymentId = await ctx.db.insert("debtPayments", {
      restaurantId: restaurant._id,
      customerId: args.customerId,
      amount: args.amount,
      method: args.method,
      staffId: args.staffId,
      staffName: args.staffName,
      notes: args.notes,
      createdAt: now,
    });

    // Audit trail
    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: args.staffId,
      staffName: args.staffName,
      action: "debt_settlement",
      details: `Debt payment of $${args.amount.toFixed(2)} (${args.method}) from ${customer.name}${args.notes ? ` — ${args.notes}` : ""}`,
      createdAt: now,
    });

    return paymentId;
  },
});
