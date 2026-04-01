import { query } from "../_generated/server";
import { getAuthRestaurant } from "./helpers.ts";

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const { restaurant } = await getAuthRestaurant(ctx);

    // Get all orders for this restaurant
    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    // Today's start timestamp (UTC)
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ).getTime();

    const todayOrders = allOrders.filter(
      (o) => o._creationTime >= todayStart
    );

    const totalRevenue = allOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);

    const todayRevenue = todayOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.total, 0);

    // Count menu items
    const menuItems = await ctx.db
      .query("menuItems")
      .withIndex("by_restaurant", (q) =>
        q.eq("restaurantId", restaurant._id)
      )
      .collect();

    // Active orders (pending, preparing, ready)
    const activeOrders = allOrders.filter(
      (o) =>
        o.status === "pending" ||
        o.status === "preparing" ||
        o.status === "ready"
    );

    // Average order value
    const completedOrders = allOrders.filter(
      (o) => o.status === "completed"
    );
    const avgOrderValue =
      completedOrders.length > 0
        ? Math.round(
            completedOrders.reduce((sum, o) => sum + o.total, 0) /
              completedOrders.length
          )
        : 0;

    return {
      totalOrders: allOrders.length,
      todayOrders: todayOrders.length,
      totalRevenue,
      todayRevenue,
      menuItemCount: menuItems.length,
      activeOrderCount: activeOrders.length,
      avgOrderValue,
    };
  },
});
