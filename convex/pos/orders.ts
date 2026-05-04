import { query, mutation, type MutationCtx } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel.d.ts";
import { getRestaurantByLicense } from "./helpers";

const ORDER_STATUS = v.union(
  v.literal("open"),
  v.literal("sent-to-kitchen"),
  v.literal("ready"),
  v.literal("served"),
  v.literal("paid"),
  v.literal("cancelled")
);

const ITEM_STATUS = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("preparing"),
  v.literal("ready"),
  v.literal("served"),
  v.literal("cancelled"),
  v.literal("voided")
);

// Default VAT rate used when an item has no explicit vatRate.
// Tax-inclusive model: menu prices already include tax.
const DEFAULT_VAT_RATE = 0.20; // 20% TVSH

// ── Queries ──────────────────────────────────────────

export const getOrdersByTable = query({
  args: { licenseKey: v.string(), tableId: v.id("tables") },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_table", (q) => q.eq("tableId", args.tableId))
      .collect();
    // Return active orders (not paid/cancelled)
    return orders.filter(
      (o) => o.status !== "paid" && o.status !== "cancelled"
    );
  },
});

export const getOrderWithItems = query({
  args: { licenseKey: v.string(), orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const table = await ctx.db.get(order.tableId);
    const staff = await ctx.db.get(order.staffId);

    return {
      ...order,
      items,
      tableName: table?.name ?? "Unknown",
      staffName: staff?.name ?? "Unknown",
    };
  },
});

export const getActiveOrders = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    // Filter to active orders and enrich with table/staff names
    const activeOrders = orders.filter(
      (o) => o.status !== "paid" && o.status !== "cancelled"
    );

    return await Promise.all(
      activeOrders.map(async (order) => {
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
          itemCount: items.length,
        };
      })
    );
  },
});

export const getAllOrders = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    return await Promise.all(
      orders.map(async (order) => {
        const table = await ctx.db.get(order.tableId);
        const staff = await ctx.db.get(order.staffId);
        return {
          ...order,
          tableName: table?.name ?? "Unknown",
          staffName: staff?.name ?? "Unknown",
        };
      })
    );
  },
});

// Get items by station (for kitchen/bar display)
export const getItemsByStation = query({
  args: {
    licenseKey: v.string(),
    station: v.union(v.literal("kitchen"), v.literal("bar")),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    const activeOrders = orders.filter(
      (o) => o.status !== "paid" && o.status !== "cancelled"
    );

    const stationItems = [];
    for (const order of activeOrders) {
      const table = await ctx.db.get(order.tableId);
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();

      const filteredItems = items.filter(
        (i) =>
          i.station === args.station &&
          (i.status === "sent" || i.status === "preparing")
      );

      if (filteredItems.length > 0) {
        stationItems.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          tableName: table?.name ?? "Unknown",
          items: filteredItems,
          createdAt: order.createdAt,
        });
      }
    }

    return stationItems;
  },
});

// ── Mutations ────────────────────────────────────────

export const createOrder = mutation({
  args: {
    licenseKey: v.string(),
    tableId: v.id("tables"),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    // Generate order number (count of all orders + 1)
    const existingOrders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();
    const orderNumber = existingOrders.length + 1;

    // Set table to occupied
    await ctx.db.patch(args.tableId, { status: "occupied" });

    return await ctx.db.insert("orders", {
      restaurantId: restaurant._id,
      tableId: args.tableId,
      staffId: args.staffId,
      orderNumber,
      status: "open",
      subtotal: 0,
      tax: 0,
      total: 0,
      createdAt: new Date().toISOString(),
    });
  },
});

export const addItemToOrder = mutation({
  args: {
    licenseKey: v.string(),
    orderId: v.id("orders"),
    menuItemId: v.id("menuItems"),
    quantity: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }
    // Allow adding to open or sent-to-kitchen orders (for re-entry)
    if (order.status !== "open" && order.status !== "sent-to-kitchen") {
      throw new ConvexError({
        message: "Can only add items to open or active orders",
        code: "BAD_REQUEST",
      });
    }

    const menuItem = await ctx.db.get(args.menuItemId);
    if (!menuItem) {
      throw new ConvexError({
        message: "Menu item not found",
        code: "NOT_FOUND",
      });
    }

    // Check if same item already exists in order (pending status, same notes)
    const existingItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const existingItem = existingItems.find(
      (i) =>
        i.menuItemId === args.menuItemId &&
        i.status === "pending" &&
        (i.notes ?? "") === (args.notes ?? "")
    );

    if (existingItem) {
      // Increment quantity
      await ctx.db.patch(existingItem._id, {
        quantity: existingItem.quantity + args.quantity,
      });
    } else {
      // Add new item with station from menu item
      await ctx.db.insert("orderItems", {
        orderId: args.orderId,
        menuItemId: args.menuItemId,
        name: menuItem.name,
        price: menuItem.price,
        quantity: args.quantity,
        notes: args.notes,
        station: menuItem.station,
        status: "pending",
        vatRate: menuItem.vatRate,
      });
    }

    // Recalculate totals
    await recalculateOrderTotals(ctx, args.orderId);
  },
});

export const updateItemQuantity = mutation({
  args: {
    licenseKey: v.string(),
    orderItemId: v.id("orderItems"),
    quantity: v.number(),
    staffId: v.optional(v.id("staff")),
    staffName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const item = await ctx.db.get(args.orderItemId);
    if (!item) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }

    // Get table info for audit trail
    const order = await ctx.db.get(item.orderId);
    const table = order ? await ctx.db.get(order.tableId) : null;

    if (args.quantity <= 0) {
      // Log deletion
      await ctx.db.insert("auditLogs", {
        restaurantId: restaurant._id,
        staffId: args.staffId,
        staffName: args.staffName ?? "Unknown",
        action: "item_deleted",
        details: `Deleted "${item.name}" x${item.quantity} ($${item.price.toFixed(2)} each) via quantity change - Table: ${table?.name ?? "Unknown"}`,
        createdAt: new Date().toISOString(),
      });
      await ctx.db.delete(args.orderItemId);
    } else {
      // Log quantity reduction
      if (args.quantity < item.quantity) {
        await ctx.db.insert("auditLogs", {
          restaurantId: restaurant._id,
          staffId: args.staffId,
          staffName: args.staffName ?? "Unknown",
          action: "quantity_reduced",
          details: `Reduced "${item.name}" from ${item.quantity} to ${args.quantity} ($${item.price.toFixed(2)} each) - Table: ${table?.name ?? "Unknown"}`,
          createdAt: new Date().toISOString(),
        });
      }
      await ctx.db.patch(args.orderItemId, { quantity: args.quantity });
    }

    await recalculateOrderTotals(ctx, item.orderId);
  },
});

export const removeItemFromOrder = mutation({
  args: {
    licenseKey: v.string(),
    orderItemId: v.id("orderItems"),
    staffId: v.optional(v.id("staff")),
    staffName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const item = await ctx.db.get(args.orderItemId);
    if (!item) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }

    // Get table info for audit trail
    const order = await ctx.db.get(item.orderId);
    const table = order ? await ctx.db.get(order.tableId) : null;

    // Silent audit log for every deletion
    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: args.staffId,
      staffName: args.staffName ?? "Unknown",
      action: "item_deleted",
      details: `Deleted "${item.name}" x${item.quantity} ($${item.price.toFixed(2)} each) [was: ${item.status}] - Table: ${table?.name ?? "Unknown"}`,
      createdAt: new Date().toISOString(),
    });

    await ctx.db.delete(args.orderItemId);
    await recalculateOrderTotals(ctx, item.orderId);
  },
});

// Void an item - any staff can void, action is silently logged
export const voidItem = mutation({
  args: {
    licenseKey: v.string(),
    orderItemId: v.id("orderItems"),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const item = await ctx.db.get(args.orderItemId);
    if (!item) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }

    const staff = await ctx.db.get(args.staffId);
    if (!staff) {
      throw new ConvexError({ message: "Staff not found", code: "NOT_FOUND" });
    }

    // Only admins can void items
    if (staff.role !== "admin") {
      throw new ConvexError({
        message: "Only admin can void items",
        code: "FORBIDDEN",
      });
    }

    // Get table info for audit trail
    const order = await ctx.db.get(item.orderId);
    const table = order ? await ctx.db.get(order.tableId) : null;

    // Mark as voided
    await ctx.db.patch(args.orderItemId, {
      status: "voided",
      voidedBy: args.staffId,
      voidedAt: new Date().toISOString(),
    });

    // Silent audit log
    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: args.staffId,
      staffName: staff.name,
      action: "void_item",
      details: `Voided "${item.name}" x${item.quantity} ($${item.price.toFixed(2)} each) - Table: ${table?.name ?? "Unknown"}`,
      createdAt: new Date().toISOString(),
    });

    await recalculateOrderTotals(ctx, item.orderId);
  },
});

// Send order - splits items by station (kitchen vs. bar)
export const sendOrder = mutation({
  args: {
    licenseKey: v.string(),
    orderId: v.id("orders"),
    staffId: v.optional(v.id("staff")),
    staffName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }

    // Mark only pending items as sent (partial sync - only new items)
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    const pendingItems = items.filter((i) => i.status === "pending");
    if (pendingItems.length === 0) {
      throw new ConvexError({
        message: "No new items to send",
        code: "BAD_REQUEST",
      });
    }

    // Split by station and mark as sent
    const kitchenItems = [];
    const barItems = [];

    for (const item of pendingItems) {
      await ctx.db.patch(item._id, { status: "sent" });
      if (item.station === "bar") {
        barItems.push(item);
      } else {
        // Default to kitchen if no station set
        kitchenItems.push(item);
      }
    }

    // Update order status
    await ctx.db.patch(args.orderId, { status: "sent-to-kitchen" });

    // Keep table as occupied
    await ctx.db.patch(order.tableId, { status: "occupied" });

    // Get table name for audit
    const table = await ctx.db.get(order.tableId);
    const tableName = table?.name ?? "Unknown";

    // Resolve staff name if not provided
    let resolvedStaffName = args.staffName ?? "Unknown";
    if (!args.staffName && args.staffId) {
      const staff = await ctx.db.get(args.staffId);
      if (staff) resolvedStaffName = staff.name;
    } else if (!args.staffName) {
      const staff = await ctx.db.get(order.staffId);
      if (staff) resolvedStaffName = staff.name;
    }

    // Build item summary for details text
    const itemSummary = pendingItems
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(", ");

    // Build structured metadata for detail view
    const metadata = JSON.stringify({
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      tableName,
      items: pendingItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        station: i.station,
        notes: i.notes,
      })),
    });

    // Create item_ordered audit log
    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: args.staffId ?? order.staffId,
      staffName: resolvedStaffName,
      action: "item_ordered",
      details: `${resolvedStaffName}: ${itemSummary} — ${tableName}`,
      metadata,
      createdAt: new Date().toISOString(),
    });

    return {
      kitchenItems: kitchenItems.length,
      barItems: barItems.length,
    };
  },
});

// Keep legacy sendToKitchen for backwards compatibility
export const sendToKitchen = mutation({
  args: { licenseKey: v.string(), orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }

    // Mark all pending items as sent
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    for (const item of items) {
      if (item.status === "pending") {
        await ctx.db.patch(item._id, { status: "sent" });
      }
    }

    await ctx.db.patch(args.orderId, { status: "sent-to-kitchen" });
  },
});

export const updateOrderStatus = mutation({
  args: {
    licenseKey: v.string(),
    orderId: v.id("orders"),
    status: ORDER_STATUS,
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }

    const updates: Record<string, unknown> = { status: args.status };

    if (args.status === "paid") {
      updates.paidAt = new Date().toISOString();
    }

    await ctx.db.patch(args.orderId, updates);

    // If paid or cancelled, check if table has other active orders
    if (args.status === "paid" || args.status === "cancelled") {
      const otherActiveOrders = await ctx.db
        .query("orders")
        .withIndex("by_table", (q) => q.eq("tableId", order.tableId))
        .collect();

      const hasActiveOrders = otherActiveOrders.some(
        (o) =>
          o._id !== args.orderId &&
          o.status !== "paid" &&
          o.status !== "cancelled"
      );

      if (!hasActiveOrders) {
        // Free the table
        if (args.status === "paid") {
          await ctx.db.patch(order.tableId, { status: "available" });
        }
      }
    }
  },
});

export const printBill = mutation({
  args: { licenseKey: v.string(), orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }

    await ctx.db.patch(order.tableId, { status: "bill-printed" });
    return order;
  },
});

export type PayOrderInput = {
  licenseKey: string;
  orderId: Id<"orders">;
  paymentMethod: "cash" | "card" | "other";
  paymentType:
    | "fiscal"
    | "non_fiscal"
    | "no_receipt"
    | "debt"
    | "complimentary";
  customerId?: Id<"customers">;
  customerName?: string;
  staffId?: Id<"staff">;
  staffName?: string;
  /** Appended to audit `details` (e.g. shift auto-close). */
  auditDetailsSuffix?: string;
};

/**
 * Settles an order (totals, lines, stock, audit, table). Used by `payOrder` and
 * `closeStaffShift` when auto-closing a waiter's open tickets.
 */
export async function completeOrderPaymentInCtx(
  ctx: MutationCtx,
  args: PayOrderInput,
): Promise<void> {
  const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
  const order = await ctx.db.get(args.orderId);
  if (!order) {
    throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
  }

  const now = new Date().toISOString();
  const originalTotal = order.total;

  // Build base update
  const updates: Record<string, unknown> = {
    status: "paid",
    paidAt: now,
    paymentMethod: args.paymentMethod,
    paymentType: args.paymentType,
    // Auto-set fiscal status based on payment type
    fiscalStatus: args.paymentType === "fiscal",
  };

  // Handle complimentary - keep original total for auditing, set total to 0
  if (args.paymentType === "complimentary") {
    updates.originalTotal = originalTotal;
    updates.subtotal = 0;
    updates.tax = 0;
    updates.total = 0;
  }

  // Handle debt - link to customer
  if (args.paymentType === "debt") {
    if (args.customerId) {
      updates.customerId = args.customerId;
    }
    if (args.customerName) {
      updates.customerName = args.customerName;
    }
  }

  await ctx.db.patch(args.orderId, updates);

  // Mark all items as served
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
    .collect();
  for (const item of items) {
    if (item.status !== "cancelled" && item.status !== "voided") {
      await ctx.db.patch(item._id, { status: "served" });

      // Increment totalSold counter on the menu item
      const menuItem = await ctx.db.get(item.menuItemId);
      if (menuItem) {
        const prevSold = menuItem.totalSold ?? 0;
        await ctx.db.patch(item.menuItemId, {
          totalSold: prevSold + item.quantity,
        });

        // Auto-deduct stock for tracked items
        if (menuItem.trackStock && menuItem.currentStock !== undefined) {
          const newStock = menuItem.currentStock - item.quantity;
          await ctx.db.patch(item.menuItemId, { currentStock: newStock });

          // Log the stock deduction
          await ctx.db.insert("stockLogs", {
            restaurantId: restaurant._id,
            menuItemId: item.menuItemId,
            staffName: args.staffName ?? "System",
            type: "sale",
            change: -item.quantity,
            balanceAfter: newStock,
            note: `Order #${order.orderNumber}`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Audit log based on payment type
  const paymentLabels: Record<string, string> = {
    fiscal: "Kupon Fiskal",
    non_fiscal: "Kupon JoFiskal",
    no_receipt: "Pagesë pa Kupon",
    debt: "Debt/Account",
    complimentary: "On the House",
  };

  const typeLabel = paymentLabels[args.paymentType] ?? args.paymentType;
  let auditDetails = `Payment: ${typeLabel} (${args.paymentMethod}) - Order #${order.orderNumber} - $${originalTotal.toFixed(2)}`;

  if (args.paymentType === "debt" && args.customerName) {
    auditDetails += ` - Customer: ${args.customerName}`;
  }
  if (args.paymentType === "complimentary") {
    auditDetails += ` - Value given away: $${originalTotal.toFixed(2)}`;
  }
  if (args.auditDetailsSuffix) {
    auditDetails += args.auditDetailsSuffix;
  }

  // Pick the right audit action
  let auditAction: "payment" | "complimentary_order" | "debt_order" = "payment";
  if (args.paymentType === "complimentary") auditAction = "complimentary_order";
  if (args.paymentType === "debt") auditAction = "debt_order";

  // Build metadata for detail view
  const orderItems = items
    .filter((i) => i.status !== "cancelled" && i.status !== "voided")
    .map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      station: i.station,
      notes: i.notes,
    }));

  const table = await ctx.db.get(order.tableId);
  const paymentMetadata = JSON.stringify({
    orderId: args.orderId,
    orderNumber: order.orderNumber,
    tableName: table?.name ?? "Unknown",
    paymentMethod: args.paymentMethod,
    paymentType: args.paymentType,
    customerName: args.customerName,
    items: orderItems,
    total: originalTotal,
  });

  await ctx.db.insert("auditLogs", {
    restaurantId: restaurant._id,
    staffId: args.staffId,
    staffName: args.staffName ?? "Unknown",
    action: auditAction,
    details: auditDetails,
    metadata: paymentMetadata,
    createdAt: now,
  });

  // Free the table if no other active orders
  const otherActive = await ctx.db
    .query("orders")
    .withIndex("by_table", (q) => q.eq("tableId", order.tableId))
    .collect();

  const hasActive = otherActive.some(
    (o) =>
      o._id !== args.orderId &&
      o.status !== "paid" &&
      o.status !== "cancelled"
  );

  if (!hasActive) {
    await ctx.db.patch(order.tableId, { status: "available" });
  }
}

export const payOrder = mutation({
  args: {
    licenseKey: v.string(),
    orderId: v.id("orders"),
    paymentMethod: v.union(
      v.literal("cash"),
      v.literal("card"),
      v.literal("other")
    ),
    paymentType: v.union(
      v.literal("fiscal"),
      v.literal("non_fiscal"),
      v.literal("no_receipt"),
      v.literal("debt"),
      v.literal("complimentary")
    ),
    customerId: v.optional(v.id("customers")),
    customerName: v.optional(v.string()),
    staffId: v.optional(v.id("staff")),
    staffName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await completeOrderPaymentInCtx(ctx, args);
  },
});

export const updateItemStatus = mutation({
  args: {
    licenseKey: v.string(),
    orderItemId: v.id("orderItems"),
    status: ITEM_STATUS,
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);
    const item = await ctx.db.get(args.orderItemId);
    if (!item) {
      throw new ConvexError({ message: "Item not found", code: "NOT_FOUND" });
    }
    await ctx.db.patch(args.orderItemId, { status: args.status });
  },
});

// ── Order History Queries & Mutations ─────────────────

export const getClosedOrders = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .order("desc")
      .collect();

    // Only return paid and cancelled orders
    const closedOrders = orders.filter(
      (o) => o.status === "paid" || o.status === "cancelled"
    );

    return await Promise.all(
      closedOrders.map(async (order) => {
        const table = await ctx.db.get(order.tableId);
        const staff = await ctx.db.get(order.staffId);
        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          tableName: table?.name ?? "Unknown",
          staffName: staff?.name ?? "Unknown",
          status: order.status,
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          paymentMethod: order.paymentMethod,
          paymentType: order.paymentType,
          fiscalStatus: order.fiscalStatus ?? (order.paymentType === "fiscal"),
          createdAt: order.createdAt,
          paidAt: order.paidAt,
          originalTotal: order.originalTotal,
          customerName: order.customerName,
        };
      })
    );
  },
});

export const generateFiscalCoupon = mutation({
  args: {
    licenseKey: v.string(),
    orderId: v.id("orders"),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    // Verify staff is admin or manager
    const staff = await ctx.db.get(args.staffId);
    if (!staff || (staff.role !== "admin" && staff.role !== "manager")) {
      throw new ConvexError({
        message: "Only admin or manager can generate fiscal coupons",
        code: "FORBIDDEN",
      });
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }

    if (order.status !== "paid") {
      throw new ConvexError({
        message: "Can only fiscalize paid orders",
        code: "BAD_REQUEST",
      });
    }

    // Prevent double fiscalization
    if (order.fiscalStatus === true) {
      throw new ConvexError({
        message: "This order is already fiscalized",
        code: "CONFLICT",
      });
    }

    const now = new Date().toISOString();

    // Mark as fiscalized
    await ctx.db.patch(args.orderId, {
      fiscalStatus: true,
      fiscalizedAt: now,
      fiscalizedBy: args.staffId,
    });

    // Audit trail
    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: args.staffId,
      staffName: staff.name,
      action: "late_fiscal",
      details: `Late fiscal coupon generated for Order #${order.orderNumber} ($${order.total.toFixed(2)}) by ${staff.name}`,
      createdAt: now,
    });

    return { success: true };
  },
});

// ── Non-Fiscal Orders (for bulk fiscalization) ──────
export const getNonFiscalOrders = query({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .order("desc")
      .collect();

    // Only paid orders that are NOT fiscalized
    const nonFiscalOrders = orders.filter(
      (o) => o.status === "paid" && o.fiscalStatus !== true
    );

    return await Promise.all(
      nonFiscalOrders.map(async (order) => {
        const table = await ctx.db.get(order.tableId);
        const staff = await ctx.db.get(order.staffId);
        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          tableName: table?.name ?? "Unknown",
          staffName: staff?.name ?? "Unknown",
          total: order.total,
          paidAt: order.paidAt,
          paymentType: order.paymentType,
        };
      })
    );
  },
});

// Fiscalize a single order as part of bulk processing (no individual audit log)
export const fiscalizeOrderBulk = mutation({
  args: {
    licenseKey: v.string(),
    orderId: v.id("orders"),
    staffId: v.id("staff"),
  },
  handler: async (ctx, args) => {
    await getRestaurantByLicense(ctx, args.licenseKey);

    const staff = await ctx.db.get(args.staffId);
    if (!staff || (staff.role !== "admin" && staff.role !== "manager")) {
      throw new ConvexError({
        message: "Only admin or manager can fiscalize orders",
        code: "FORBIDDEN",
      });
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError({ message: "Order not found", code: "NOT_FOUND" });
    }

    if (order.status !== "paid") {
      throw new ConvexError({
        message: "Can only fiscalize paid orders",
        code: "BAD_REQUEST",
      });
    }

    // Already fiscalized — skip silently
    if (order.fiscalStatus === true) {
      return { skipped: true };
    }

    await ctx.db.patch(args.orderId, {
      fiscalStatus: true,
      fiscalizedAt: new Date().toISOString(),
      fiscalizedBy: args.staffId,
    });

    return { skipped: false };
  },
});

// Log a single audit entry for the bulk fiscalization action
export const logBulkFiscalization = mutation({
  args: {
    licenseKey: v.string(),
    staffId: v.id("staff"),
    staffName: v.string(),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const restaurant = await getRestaurantByLicense(ctx, args.licenseKey);

    const staff = await ctx.db.get(args.staffId);
    if (!staff || (staff.role !== "admin" && staff.role !== "manager")) {
      throw new ConvexError({
        message: "Only admin or manager can perform bulk fiscalization",
        code: "FORBIDDEN",
      });
    }

    // Determine role label
    const roleLabel =
      staff.role === "admin" ? "Admin" : "Manager";

    await ctx.db.insert("auditLogs", {
      restaurantId: restaurant._id,
      staffId: args.staffId,
      staffName: args.staffName,
      action: "bulk_fiscal",
      details: `${roleLabel} ${args.staffName} performed Bulk Fiscalization on ${args.count} orders`,
      createdAt: new Date().toISOString(),
    });
  },
});

async function recalculateOrderTotals(
  ctx: MutationCtx,
  orderId: Id<"orders">
) {
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();

  const activeItems = items.filter(
    (i) => i.status !== "cancelled" && i.status !== "voided"
  );

  // Tax-inclusive: prices already include TVSH.
  // total = sum of (price × quantity)
  // tax = sum of (price × quantity × vatRate / (1 + vatRate))
  // subtotal = total − tax
  let total = 0;
  let tax = 0;
  for (const item of activeItems) {
    const lineTotal = item.price * item.quantity;
    const rate = item.vatRate ?? DEFAULT_VAT_RATE;
    const lineTax = lineTotal * rate / (1 + rate);
    total += lineTotal;
    tax += lineTax;
  }

  tax = Math.round(tax * 100) / 100;
  total = Math.round(total * 100) / 100;
  const subtotal = Math.round((total - tax) * 100) / 100;

  await ctx.db.patch(orderId, { subtotal, tax, total });
}
