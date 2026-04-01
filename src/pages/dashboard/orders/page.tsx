import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import OrderStatusBadge from "../_components/order-status-badge.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import {
  ClipboardList,
  Plus,
  MoreVertical,
  Search,
  Clock,
  ChefHat,
  CheckCircle2,
  XCircle,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type OrderStatus = Doc<"orders">["status"];

const statusFilters: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Preparing", value: "preparing" },
  { label: "Ready", value: "ready" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const nextStatusMap: Record<OrderStatus, OrderStatus | null> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: null,
  cancelled: null,
};

const nextStatusLabels: Record<string, { label: string; icon: typeof Clock }> = {
  preparing: { label: "Start Preparing", icon: ChefHat },
  ready: { label: "Mark Ready", icon: CheckCircle2 },
  completed: { label: "Complete", icon: Truck },
};

function NewOrderDialog() {
  const menuItems = useQuery(api.dashboard.menu.getMenuItems);
  const categories = useQuery(api.dashboard.menu.getCategories);
  const createOrder = useMutation(api.dashboard.orders.create);
  const [open, setOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<
    { menuItemId: Id<"menuItems">; name: string; price: number; quantity: number }[]
  >([]);
  const [orderType, setOrderType] = useState<"dine-in" | "takeout" | "delivery">(
    "dine-in"
  );
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const addItem = (item: Doc<"menuItems">) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === item._id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { menuItemId: item._id, name: item.name, price: item.price, quantity: 1 },
      ];
    });
  };

  const removeItem = (menuItemId: Id<"menuItems">) => {
    setOrderItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  const updateQuantity = (menuItemId: Id<"menuItems">, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setOrderItems((prev) =>
      prev.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i))
    );
  };

  const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSubmit = async () => {
    if (orderItems.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    setLoading(true);
    try {
      await createOrder({
        items: orderItems,
        type: orderType,
        tableNumber: tableNumber.trim() || undefined,
        customerName: customerName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Order created");
      setOpen(false);
      setOrderItems([]);
      setTableNumber("");
      setCustomerName("");
      setNotes("");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to create order");
      }
    } finally {
      setLoading(false);
    }
  };

  const availableItems =
    menuItems?.filter((item) => item.isAvailable) ?? [];

  // Group items by category
  const itemsByCategory = new Map<string, Doc<"menuItems">[]>();
  for (const item of availableItems) {
    const catName =
      categories?.find((c) => c._id === item.categoryId)?.name ?? "Uncategorized";
    const items = itemsByCategory.get(catName) ?? [];
    items.push(item);
    itemsByCategory.set(catName, items);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1.5" />
          New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Order type */}
          <div className="grid grid-cols-3 gap-3">
            {(["dine-in", "takeout", "delivery"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                className={cn(
                  "px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer",
                  orderType === t
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {t === "dine-in" ? "Dine In" : t === "takeout" ? "Takeout" : "Delivery"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {orderType === "dine-in" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Table #</Label>
                <Input
                  placeholder="e.g. 5"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Customer Name</Label>
              <Input
                placeholder="Optional"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
          </div>

          {/* Menu items to add */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Add Items
            </p>
            {availableItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No menu items available. Add items in the Menu page first.
              </p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {Array.from(itemsByCategory.entries()).map(([catName, items]) => (
                  <div key={catName}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {catName}
                    </p>
                    <div className="space-y-1">
                      {items.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => addItem(item)}
                          className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors text-left cursor-pointer"
                        >
                          <span className="text-foreground">{item.name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(item.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order items */}
          {orderItems.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                Order Items
              </p>
              <div className="space-y-2">
                {orderItems.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border"
                  >
                    <span className="text-sm text-foreground flex-1">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.menuItemId, item.quantity - 1)
                        }
                        className="w-6 h-6 rounded bg-accent flex items-center justify-center text-xs cursor-pointer hover:bg-accent/80"
                      >
                        -
                      </button>
                      <span className="text-sm w-6 text-center font-medium">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(item.menuItemId, item.quantity + 1)
                        }
                        className="w-6 h-6 rounded bg-accent flex items-center justify-center text-xs cursor-pointer hover:bg-accent/80"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-medium text-foreground w-16 text-right">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold text-foreground pt-2 border-t border-border">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input
              placeholder="Special requests..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={loading || orderItems.length === 0}
          >
            {loading ? "Creating..." : `Create Order (${formatCurrency(subtotal)})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardOrders() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const updateStatus = useMutation(api.dashboard.orders.updateStatus);

  const orders = useQuery(
    api.dashboard.orders.list,
    statusFilter === "all" ? {} : { status: statusFilter }
  );

  const handleStatusUpdate = async (orderId: Id<"orders">, status: OrderStatus) => {
    try {
      await updateStatus({ id: orderId, status });
      toast.success(`Order updated to ${status}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update order");
      }
    }
  };

  const filteredOrders = orders?.filter((order) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(q) ||
      order.customerName?.toLowerCase().includes(q) ||
      order.items.some((i) => i.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all your orders.
          </p>
        </div>
        <NewOrderDialog />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders list */}
      {orders === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filteredOrders && filteredOrders.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No orders found</EmptyTitle>
            <EmptyDescription>
              {statusFilter !== "all"
                ? `No ${statusFilter} orders right now.`
                : "Create your first order to get started."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {filteredOrders?.map((order) => {
            const nextStatus = nextStatusMap[order.status];
            const nextConfig = nextStatus
              ? nextStatusLabels[nextStatus]
              : null;

            return (
              <div
                key={order._id}
                className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-foreground">
                        {order.orderNumber}
                      </span>
                      <OrderStatusBadge status={order.status} />
                      <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-accent">
                        {order.type === "dine-in"
                          ? `Dine In${order.tableNumber ? ` \u00B7 Table ${order.tableNumber}` : ""}`
                          : order.type === "takeout"
                            ? "Takeout"
                            : "Delivery"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.items
                        .map((i) => `${i.quantity}x ${i.name}`)
                        .join(", ")}
                    </p>
                    {order.customerName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Customer: {order.customerName}
                      </p>
                    )}
                    {order.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">
                        Note: {order.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <p className="text-base font-bold text-foreground">
                      {formatCurrency(order.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(order._creationTime)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {nextConfig && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleStatusUpdate(order._id, nextStatus!)
                          }
                          className="text-xs h-7"
                        >
                          <nextConfig.icon className="size-3 mr-1" />
                          {nextConfig.label}
                        </Button>
                      )}
                      {order.status !== "cancelled" &&
                        order.status !== "completed" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                              >
                                <MoreVertical className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  handleStatusUpdate(order._id, "cancelled")
                                }
                              >
                                <XCircle className="size-4 mr-2" />
                                Cancel Order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
