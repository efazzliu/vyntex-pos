import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Link } from "react-router-dom";
import {
  DollarSign,
  ShoppingBag,
  UtensilsCrossed,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react";
import StatCard from "./_components/stat-card.tsx";
import OrderStatusBadge from "./_components/order-status-badge.tsx";

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OverviewContent() {
  const stats = useQuery(api.dashboard.stats.getDashboardStats);
  const recentOrders = useQuery(api.dashboard.orders.getRecent);

  if (stats === undefined || recentOrders === undefined) {
    return (
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {"Here's"} what{"'s"} happening with your business today.
          </p>
        </div>
        <Link to="/dashboard/orders">
          <Button size="sm">
            <Plus className="size-4 mr-1.5" />
            New Order
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue)}
          description={`${stats.todayOrders} orders today`}
          icon={DollarSign}
        />
        <StatCard
          title="Active Orders"
          value={String(stats.activeOrderCount)}
          description="Pending, preparing, or ready"
          icon={Clock}
        />
        <StatCard
          title="Total Orders"
          value={String(stats.totalOrders)}
          description={`${formatCurrency(stats.totalRevenue)} total revenue`}
          icon={ShoppingBag}
        />
        <StatCard
          title="Avg. Order Value"
          value={formatCurrency(stats.avgOrderValue)}
          description={`${stats.menuItemCount} menu items`}
          icon={TrendingUp}
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/dashboard/orders"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <ShoppingBag className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Manage Orders</p>
            <p className="text-xs text-muted-foreground">
              View and update order status
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
        <Link
          to="/dashboard/menu"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <UtensilsCrossed className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Edit Menu</p>
            <p className="text-xs text-muted-foreground">
              Add items and categories
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
        <Link
          to="/dashboard/settings"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
            <TrendingUp className="size-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Settings</p>
            <p className="text-xs text-muted-foreground">
              Update business profile
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Recent Orders
          </h2>
          <Link to="/dashboard/orders">
            <Button variant="ghost" size="sm" className="text-xs">
              View All
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center">
            <ShoppingBag className="size-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No orders yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Orders will appear here once placed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <div
                key={order._id}
                className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {order.orderNumber}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.items.length} item{order.items.length !== 1 && "s"}{" "}
                    {"\u00B7"} {order.type}
                    {order.customerName && ` \u00B7 ${order.customerName}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(order.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(order._creationTime)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  return <OverviewContent />;
}
