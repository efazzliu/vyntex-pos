import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChefHat,
  Minus,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Star,
  UtensilsCrossed,
  Wine,
  X,
} from "lucide-react";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import { uuidOrNull, staffIdsEqual } from "@/lib/supabase-pos/uuid.ts";
import { cn } from "@/lib/utils.ts";

type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  station?: "kitchen" | "bar";
  vatRate?: number;
};

function formatMoney(
  amount: number,
  symbol: string,
  position: "prefix" | "suffix",
  decimals: number,
): string {
  const formatted = amount.toFixed(decimals);
  return position === "prefix" ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

export default function PhoneWaiterOrder() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId ?? "";
  const session = getWaiterSession();
  const licenseKey = session?.licenseKey ?? "";

  useEffect(() => {
    if (!session) navigate("/waiter", { replace: true });
  }, [session, navigate]);

  const categories = useQuery(
    "pos.menu.getCategories",
    licenseKey ? { licenseKey } : "skip",
  ) as Doc<"menuCategories">[] | undefined;
  const menuItems = useQuery(
    "pos.menu.getAllItems",
    licenseKey ? { licenseKey } : "skip",
  ) as Doc<"menuItems">[] | undefined;
  const tables = useQuery(
    "pos.tables.getTables",
    licenseKey ? { licenseKey } : "skip",
  ) as Doc<"tables">[] | undefined;
  const activeOrders = useQuery(
    "pos.orders.getOrdersByTable",
    licenseKey && tableId ? { licenseKey, tableId } : "skip",
  ) as Doc<"orders">[] | undefined;
  const company = useQuery(
    "pos.settings.getCompanyDetails",
    licenseKey ? { licenseKey } : "skip",
  ) as
    | {
        currencySymbol?: string;
        currencyPosition?: "prefix" | "suffix";
        currencyDecimals?: number;
      }
    | undefined;

  const submitCartOrder = useMutation("pos.orders.submitCartOrder");

  const currentTable = (tables ?? []).find((tb) => tb._id === tableId);
  const existingOrder = (activeOrders ?? [])[0];
  const staff = session?.staff;

  const orderWithItems = useQuery(
    "pos.orders.getOrderWithItems",
    licenseKey && existingOrder?._id
      ? { licenseKey, orderId: existingOrder._id }
      : "skip",
  ) as
    | {
        items: Array<{
          _id: string;
          name: string;
          price: number;
          quantity: number;
          station?: "kitchen" | "bar";
          status: string;
        }>;
        subtotal: number;
        tax: number;
        total: number;
      }
    | undefined;

  const [activeCategory, setActiveCategory] = useState<string | "favorites" | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!staff || !existingOrder) return;
    if (staff.role !== "waiter") return;
    const ownerUuid = uuidOrNull(existingOrder.staffId as unknown as string);
    const myUuid = uuidOrNull(staff.id);
    if (!ownerUuid || !myUuid) return;
    if (staffIdsEqual(existingOrder.staffId as unknown as string, staff.id)) return;
    toast.error(t("phone.waiter.tableTakenBy", { name: t("phone.waiter.anotherWaiter") }));
    navigate("/waiter/floor", { replace: true });
  }, [staff, existingOrder, navigate, t]);

  const currency = {
    symbol: company?.currencySymbol ?? "Lek",
    position: company?.currencyPosition ?? "suffix",
    decimals: company?.currencyDecimals ?? 2,
  };
  const formatPrice = (n: number) =>
    formatMoney(n, currency.symbol, currency.position, currency.decimals);

  const manualFavorites = useMemo(
    () => (menuItems ?? []).filter((i) => i.isFavorite && i.available),
    [menuItems],
  );
  const autoFavorites = useMemo(() => {
    if (manualFavorites.length > 0 || !menuItems) return [];
    return [...menuItems]
      .filter((i) => i.available && (i.totalSold ?? 0) > 0)
      .sort((a, b) => (b.totalSold ?? 0) - (a.totalSold ?? 0))
      .slice(0, 10);
  }, [menuItems, manualFavorites]);

  const selectedCategory = activeCategory ?? "favorites";

  const filteredItems = useMemo(() => {
    const items = menuItems ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return items
        .filter((i) => i.available && i.name.toLowerCase().includes(q))
        .sort((a, b) => a.displayOrder - b.displayOrder);
    }
    if (selectedCategory === "favorites") {
      return manualFavorites.length > 0
        ? [...manualFavorites].sort((a, b) => a.displayOrder - b.displayOrder)
        : autoFavorites;
    }
    return items
      .filter((i) => i.categoryId === selectedCategory && i.available)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [menuItems, selectedCategory, manualFavorites, autoFavorites, searchQuery]);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const addToCart = (item: Doc<"menuItems">) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item._id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item._id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item._id,
          name: item.name,
          price: item.price,
          quantity: 1,
          station: item.station,
          vatRate: item.vatRate,
        },
      ];
    });
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    );
  };

  const handleSend = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    const backup = cart.map((c) => ({ ...c }));
    const lines = cart.map((c) => ({
      menuItemId: c.menuItemId,
      quantity: c.quantity,
      name: c.name,
      price: c.price,
      station: c.station,
      vatRate: c.vatRate,
    }));
    try {
      const result = await submitCartOrder({
        licenseKey,
        tableId,
        staffId: staff?.id,
        staffName: staff?.name,
        existingOrderId: existingOrder?._id ?? null,
        lines,
      });
      if (result === undefined) {
        setCart(backup);
        toast.error(t("phone.waiter.order.sendFailed"));
        return;
      }
      setCart([]);
      setCartOpen(false);
      toast.success(t("phone.waiter.order.sent"));
    } catch {
      setCart(backup);
      toast.error(t("phone.waiter.order.sendFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) return null;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#070b14] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 40% at 20% 0%, rgba(0,102,255,0.22) 0%, transparent 55%), linear-gradient(180deg, #0a1224 0%, #070b14 100%)",
        }}
      />

      <header className="relative z-10 flex items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate("/waiter/floor")}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 active:scale-95"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
            {currentTable?.zone ?? ""}
          </p>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {currentTable?.name ?? t("phone.waiter.order.title")}
            {existingOrder ? (
              <span className="ml-2 text-[13px] font-medium text-[#7eb6ff]">
                #{existingOrder.orderNumber}
              </span>
            ) : null}
          </h1>
        </div>
      </header>

      <div className="relative z-10 flex gap-2 overflow-x-auto px-4 pb-3">
        <button
          type="button"
          onClick={() => setActiveCategory("favorites")}
          className={cn(
            "flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-center transition",
            selectedCategory === "favorites"
              ? "bg-amber-500 text-white"
              : "border border-white/10 bg-white/[0.05] text-white/60",
          )}
        >
          <Star className="size-4" />
          <span className="text-[10px] font-medium">{t("phone.waiter.order.favorites")}</span>
        </button>
        {(categories ?? []).map((cat) => {
          const sel = selectedCategory === cat._id;
          return (
            <button
              key={cat._id}
              type="button"
              onClick={() => setActiveCategory(cat._id)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-center transition border",
                sel ? "text-white border-transparent" : "border-white/10 bg-white/[0.05] text-white/60",
              )}
              style={sel ? { backgroundColor: cat.color } : undefined}
            >
              <span className="text-[15px] leading-none">
                {(cat.icon && cat.icon.trim()) || emojiForCategoryName(cat.name) || (
                  <UtensilsCrossed className="size-4" />
                )}
              </span>
              <span className="max-w-[4.5rem] truncate text-[10px] font-medium">{cat.name}</span>
            </button>
          );
        })}
      </div>

      <div className="relative z-10 px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("phone.waiter.order.searchPlaceholder")}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-8 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-[#0066FF]/60"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      <main className="relative z-10 flex-1 overflow-y-auto px-4 pb-28">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-white/40">
            <UtensilsCrossed className="size-8" />
            <p className="text-sm">{t("phone.waiter.order.noItems")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const inCart = cart.find((c) => c.menuItemId === item._id);
              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className={cn(
                    "relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition active:scale-[0.98]",
                    inCart
                      ? "border-[#0066FF]/60 bg-[#0066FF]/12"
                      : "border-white/10 bg-white/[0.04]",
                  )}
                >
                  {item.station ? (
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[9px] font-medium",
                        item.station === "kitchen" ? "text-orange-400" : "text-purple-400",
                      )}
                    >
                      {item.station === "kitchen" ? (
                        <ChefHat className="size-2.5" />
                      ) : (
                        <Wine className="size-2.5" />
                      )}
                    </span>
                  ) : null}
                  <p className="line-clamp-2 text-[13px] font-semibold text-white">{item.name}</p>
                  <p className="text-[13px] font-bold text-[#7eb6ff]">{formatPrice(item.price)}</p>
                  {inCart ? (
                    <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-[#0066FF] text-[11px] font-bold text-white">
                      {inCart.quantity}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {cartCount > 0 ? (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex items-center justify-between rounded-2xl bg-[#0066FF] px-4 py-3.5 shadow-xl shadow-[#0066FF]/30 active:scale-[0.98]"
        >
          <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <ShoppingBag className="size-4" />
            {t("phone.waiter.order.itemsInCart", { count: cartCount })}
          </span>
          <span className="text-[14px] font-bold text-white">{formatPrice(cartTotal)}</span>
        </button>
      ) : null}

      {cartOpen ? (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/60">
          <button
            type="button"
            aria-label={t("btn.cancel")}
            className="absolute inset-0"
            onClick={() => setCartOpen(false)}
          />
          <div className="relative z-10 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-white/10 bg-[#0d1326] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-4 py-3.5">
              <h2 className="text-[15px] font-semibold text-white">
                {t("phone.waiter.order.currentOrder")}
              </h2>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-white/50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4">
              {orderWithItems && orderWithItems.items.length > 0 ? (
                <div className="space-y-2 pb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
                    {t("phone.waiter.order.sentItems")}
                  </p>
                  {(() => {
                    const active = orderWithItems.items.filter(
                      (i) => i.status !== "cancelled" && i.status !== "voided",
                    );
                    const grouped: {
                      key: string;
                      name: string;
                      price: number;
                      qty: number;
                      status: string;
                    }[] = [];
                    for (const it of active) {
                      const key = `${it.name}|${it.price}`;
                      const existing = grouped.find((g) => g.key === key);
                      if (existing) existing.qty += it.quantity;
                      else
                        grouped.push({
                          key,
                          name: it.name,
                          price: it.price,
                          qty: it.quantity,
                          status: it.status,
                        });
                    }
                    return grouped.map((g) => (
                      <div
                        key={g.key}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-white/85">{g.name}</p>
                          <p className="text-[11px] text-white/35">
                            {formatPrice(g.price)} × {g.qty}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-medium uppercase text-[#7eb6ff]">
                          {g.status}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              ) : null}

              {cart.length === 0 ? (
                orderWithItems && orderWithItems.items.length > 0 ? null : (
                  <p className="py-8 text-center text-[13px] text-white/40">
                    {t("phone.waiter.order.cartEmpty")}
                  </p>
                )
              ) : (
                <div className="space-y-2 pb-2">
                  {cart.length > 0 && orderWithItems && orderWithItems.items.length > 0 ? (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7eb6ff]">
                      {t("phone.waiter.order.newItems")}
                    </p>
                  ) : null}
                  {cart.map((item) => (
                    <div
                      key={item.menuItemId}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white">{item.name}</p>
                        <p className="text-[12px] text-white/40">{formatPrice(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQty(item.menuItemId, -1)}
                          className="flex size-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/70"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-5 text-center text-[13px] font-semibold text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.menuItemId, 1)}
                          className="flex size-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/70"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 px-4 py-3.5">
              {orderWithItems && orderWithItems.items.length > 0 ? (
                <div className="mb-2 flex items-center justify-between text-[12px] text-white/40">
                  <span>{t("phone.waiter.order.sentTotal")}</span>
                  <span>{formatPrice(orderWithItems.total)}</span>
                </div>
              ) : null}
              <div className="mb-3 flex items-center justify-between text-[14px]">
                <span className="text-white/50">
                  {t(cart.length > 0 ? "phone.waiter.order.newItemsTotal" : "phone.waiter.order.total")}
                </span>
                <span className="font-bold text-white">{formatPrice(cartTotal)}</span>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={cart.length === 0 || isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0066FF] py-3.5 text-[15px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                <Send className="size-4" />
                {isSubmitting
                  ? t("phone.waiter.order.sending")
                  : t("phone.waiter.order.sendToKitchen")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
