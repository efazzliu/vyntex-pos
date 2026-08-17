import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChefHat,
  ClipboardList,
  Minus,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Star,
  UtensilsCrossed,
  Wine,
  Banknote,
  CreditCard,
  QrCode,
  X,
} from "lucide-react";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";
import { usePhoneAccessBranding } from "@/phone-app/hooks/use-phone-access-branding.tsx";
import { phoneAccessThemeTokens, waiterThemeGlow, waiterThemeStyle } from "@/lib/phone-access-theme.ts";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import { uuidOrNull, staffIdsEqual } from "@/lib/supabase-pos/uuid.ts";
import { cn } from "@/lib/utils.ts";
import {
  enabledPaymentMethods,
  parsePosPaymentSettings,
  waiterPhoneCanCollectPayment,
} from "@/lib/pos-payment-handling.ts";
import {
  getOrderBlockReason,
  isMenuItemShownForOrdering,
  parseOrderBlockError,
  resolveEnforceOrderAvailability,
} from "@/lib/pos-order-availability.ts";

type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  station?: "kitchen" | "bar";
  vatRate?: number;
};

type SentLine = {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  station?: "kitchen" | "bar";
  status: string;
  createdAt?: string;
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

function activeSentLines(items: SentLine[]): SentLine[] {
  return items.filter((i) => i.status !== "cancelled" && i.status !== "voided");
}

function groupSentLines(items: SentLine[]) {
  const grouped: {
    key: string;
    name: string;
    price: number;
    qty: number;
    status: string;
  }[] = [];
  for (const it of items) {
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
  return grouped;
}

export default function PhoneWaiterOrder() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId ?? "";
  const session = getWaiterSession();
  const licenseKey = session?.licenseKey ?? "";
  const access = usePhoneAccessBranding();
  const tableDesign = access.tableDesign;
  const routeState = (location.state as { from?: unknown; openOrderSheet?: unknown } | null) ?? null;
  const backTo =
    typeof routeState?.from === "string" ? String(routeState.from) : "/waiter/floor";
  const openOrderSheetOnEntry = routeState?.openOrderSheet === true;

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
        name?: string;
        legalName?: string;
        address?: string;
        city?: string;
        phone?: string;
        taxNumber?: string;
        vatNumber?: string;
        currencySymbol?: string;
        currencyPosition?: "prefix" | "suffix";
        currencyDecimals?: number;
        paymentSettings?: unknown;
        enforceOrderAvailability?: boolean;
      }
    | undefined;

  const submitCartOrder = useMutation("pos.orders.submitCartOrder");
  const payOrder = useMutation("pos.orders.payOrder");
  const printBill = useMutation("pos.orders.printBill");

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
          createdAt?: string;
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
  const [historyOpen, setHistoryOpen] = useState(openOrderSheetOnEntry);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [centerNotice, setCenterNotice] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    if (!centerNotice) return;
    const id = window.setTimeout(() => setCenterNotice(null), 1800);
    return () => window.clearTimeout(id);
  }, [centerNotice]);

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
    symbol: company?.currencySymbol ?? "€",
    position: company?.currencyPosition ?? "suffix",
    decimals: company?.currencyDecimals ?? 2,
  };
  const formatPrice = (n: number) =>
    formatMoney(n, currency.symbol, currency.position, currency.decimals);

  const paymentSettings = parsePosPaymentSettings(company?.paymentSettings);
  const waiterCanPay = waiterPhoneCanCollectPayment(paymentSettings);
  const billRequested = currentTable?.status === "bill-printed";
  const enforceAvailability = resolveEnforceOrderAvailability(
    company?.enforceOrderAvailability,
    licenseKey,
  );

  const manualFavorites = useMemo(
    () =>
      (menuItems ?? []).filter(
        (i) => i.isFavorite && isMenuItemShownForOrdering(i, enforceAvailability),
      ),
    [menuItems, enforceAvailability],
  );
  const autoFavorites = useMemo(() => {
    if (manualFavorites.length > 0 || !menuItems) return [];
    return [...menuItems]
      .filter(
        (i) =>
          isMenuItemShownForOrdering(i, enforceAvailability) &&
          (i.totalSold ?? 0) > 0,
      )
      .sort((a, b) => (b.totalSold ?? 0) - (a.totalSold ?? 0))
      .slice(0, 10);
  }, [menuItems, manualFavorites, enforceAvailability]);

  const selectedCategory = activeCategory ?? "favorites";

  const filteredItems = useMemo(() => {
    const items = menuItems ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return items
        .filter(
          (i) =>
            isMenuItemShownForOrdering(i, enforceAvailability) &&
            i.name.toLowerCase().includes(q),
        )
        .sort((a, b) => a.displayOrder - b.displayOrder);
    }
    if (selectedCategory === "favorites") {
      return manualFavorites.length > 0
        ? [...manualFavorites].sort((a, b) => a.displayOrder - b.displayOrder)
        : autoFavorites;
    }
    return items
      .filter(
        (i) =>
          i.categoryId === selectedCategory &&
          isMenuItemShownForOrdering(i, enforceAvailability),
      )
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [
    menuItems,
    selectedCategory,
    manualFavorites,
    autoFavorites,
    searchQuery,
    enforceAvailability,
  ]);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const sentLines = activeSentLines(orderWithItems?.items ?? []);
  const sentCount = sentLines.reduce((sum, i) => sum + i.quantity, 0);
  const groupedSent = groupSentLines(sentLines);
  const billTotal = groupedSent.reduce((sum, g) => sum + g.price * g.qty, 0);
  const showPrevBar = sentCount > 0 && !cartOpen && !historyOpen && !payOpen;
  const showCartBar = cartCount > 0 && !cartOpen && !historyOpen;

  const addToCart = (item: Doc<"menuItems">) => {
    const existingQty =
      cart.find((c) => c.menuItemId === item._id)?.quantity ?? 0;
    const blocked = getOrderBlockReason(
      item,
      existingQty + 1,
      enforceAvailability,
    );
    if (blocked) {
      toast.error(
        blocked === "stock"
          ? t("phone.waiter.order.blockedStock", { name: item.name })
          : t("phone.waiter.order.blockedStopped", { name: item.name }),
      );
      return;
    }
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
    if (delta > 0) {
      const item = (menuItems ?? []).find((i) => i._id === menuItemId);
      const line = cart.find((c) => c.menuItemId === menuItemId);
      const nextQty = (line?.quantity ?? 0) + delta;
      if (item) {
        const blocked = getOrderBlockReason(item, nextQty, enforceAvailability);
        if (blocked) {
          toast.error(
            blocked === "stock"
              ? t("phone.waiter.order.blockedStock", { name: item.name })
              : t("phone.waiter.order.blockedStopped", { name: item.name }),
          );
          return;
        }
      }
    }
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
      setHistoryOpen(false);
      setCenterNotice(t("phone.waiter.order.sent"));
    } catch (err) {
      setCart(backup);
      const blocked = parseOrderBlockError(err);
      toast.error(
        blocked
          ? blocked.reason === "stock"
            ? t("phone.waiter.order.blockedStock", { name: blocked.name })
            : t("phone.waiter.order.blockedStopped", { name: blocked.name })
          : t("phone.waiter.order.sendFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestBill = async () => {
    if (!existingOrder || payBusy) return;
    setPayBusy(true);
    try {
      await printBill({
        licenseKey,
        orderId: existingOrder._id,
        tableId,
      });
      setCenterNotice(t("phone.waiter.order.requestBillSent"));
    } catch {
      toast.error(t("phone.waiter.order.requestBillFailed"));
    } finally {
      setPayBusy(false);
    }
  };

  const handlePhonePay = async (method: "cash" | "card" | "other") => {
    if (!existingOrder || payBusy) return;
    setPayBusy(true);
    try {
      await payOrder({
        licenseKey,
        orderId: existingOrder._id,
        tableId,
        paymentMethod: method,
        paymentType: "no_receipt",
        staffId: staff?.id,
        staffName: staff?.name,
      });
      setPayOpen(false);
      setHistoryOpen(false);
      setCenterNotice(t("phone.waiter.order.paid"));
      window.setTimeout(() => navigate(backTo, { replace: true }), 700);
    } catch {
      toast.error(t("phone.waiter.order.payFailed"));
    } finally {
      setPayBusy(false);
    }
  };

  if (!session) return null;

  const glow =
    tableDesign === "advanced"
      ? "rgba(212,175,55,0.18)"
      : tableDesign === "modern"
        ? "rgba(99,102,241,0.26)"
        : "rgba(0,102,255,0.22)";
  const accent = access.accentColor;
  const tokens = phoneAccessThemeTokens(access.theme);
  const light = tokens.isLight;

  return (
    <div
      data-waiter-theme={light ? "light" : "dark"}
      data-waiter-skin={tokens.id}
      className={cn(
        "relative flex min-h-dvh flex-col overflow-hidden",
        light ? "text-[#0f172a]" : "text-white",
      )}
      style={waiterThemeStyle(tokens)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: waiterThemeGlow({ ...tokens, glow }),
        }}
      />

      <header className="relative z-10 flex items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          aria-label={t("phone.waiter.order.closeOrder")}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center text-white/70 active:scale-95",
            tableDesign === "modern"
              ? "rounded-full bg-white/[0.08]"
              : tableDesign === "advanced"
                ? "rounded-lg border border-white/10 bg-white/[0.04]"
                : "rounded-xl border border-white/10 bg-white/[0.05]",
          )}
        >
          <ArrowLeft className="size-4" />
        </button>
        {tableDesign === "advanced" ? (
          <>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold text-[#0a0a0a]"
              style={{
                background: `linear-gradient(145deg, ${accent}, #d4af37)`,
              }}
            >
              {(currentTable?.name ?? "T").slice(0, 3)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-white/40">{currentTable?.zone ?? ""}</p>
              <h1 className="truncate text-[15px] font-semibold tracking-tight">
                {currentTable?.name ?? t("phone.waiter.order.title")}
                {existingOrder ? (
                  <span className="ml-2 text-[12px] font-medium text-[#d4af37]">
                    #{existingOrder.orderNumber}
                  </span>
                ) : null}
              </h1>
            </div>
          </>
        ) : tableDesign === "modern" ? (
          <>
            <h1 className="min-w-0 flex-1 truncate text-[18px] font-semibold tracking-tight">
              {currentTable?.name ?? t("phone.waiter.order.title")}
            </h1>
            {currentTable?.zone ? (
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: `${accent}33`, color: accent }}
              >
                {currentTable.zone}
              </span>
            ) : null}
          </>
        ) : (
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
        )}
      </header>

      <div className="relative z-10 px-4 pb-3">
        {tableDesign === "modern" ? (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory("favorites")}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
                selectedCategory === "favorites"
                  ? "text-white"
                  : "bg-white/[0.08] text-white/55",
              )}
              style={
                selectedCategory === "favorites" ? { backgroundColor: accent } : undefined
              }
            >
              {t("phone.waiter.order.favorites")}
            </button>
            {(categories ?? []).map((cat) => {
              const sel = selectedCategory === cat._id;
              return (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setActiveCategory(cat._id)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
                    sel ? "text-white" : "bg-white/[0.08] text-white/55",
                  )}
                  style={sel ? { backgroundColor: cat.color || accent } : undefined}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        ) : tableDesign === "advanced" ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory("favorites")}
              className="shrink-0 pb-1.5 text-[13px] font-medium"
              style={{
                color: selectedCategory === "favorites" ? "var(--waiter-fg)" : "var(--waiter-muted)",
                borderBottom:
                  selectedCategory === "favorites"
                    ? `2px solid ${accent}`
                    : "2px solid transparent",
              }}
            >
              {t("phone.waiter.order.favorites")}
            </button>
            {(categories ?? []).map((cat) => {
              const sel = selectedCategory === cat._id;
              return (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setActiveCategory(cat._id)}
                  className="shrink-0 pb-1.5 text-[13px] font-medium"
                  style={{
                    color: sel ? "var(--waiter-fg)" : "var(--waiter-muted)",
                    borderBottom: sel
                      ? `2px solid ${cat.color || accent}`
                      : "2px solid transparent",
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="waiter-cat-scroll-y no-scrollbar max-h-[8.2rem]">
            <div className="grid grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("favorites")}
                className={cn(
                  "flex h-[3.85rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center transition",
                  selectedCategory === "favorites"
                    ? "border-transparent bg-amber-500 text-white"
                    : "border-white/10 bg-white/[0.05] text-white/60",
                )}
              >
                <span className="flex size-5 items-center justify-center">
                  <Star className="size-4" />
                </span>
                <span className="w-full truncate text-[10px] font-medium leading-tight">
                  {t("phone.waiter.order.favorites")}
                </span>
              </button>
              {(categories ?? []).map((cat) => {
                const sel = selectedCategory === cat._id;
                return (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => setActiveCategory(cat._id)}
                    className={cn(
                      "flex h-[3.85rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-center transition",
                      sel
                        ? "text-white border-transparent"
                        : "border-white/10 bg-white/[0.05] text-white/60",
                    )}
                    style={sel ? { backgroundColor: cat.color } : undefined}
                  >
                    <span className="flex size-5 items-center justify-center text-[15px] leading-none">
                      {(cat.icon && cat.icon.trim()) ||
                        emojiForCategoryName(cat.name) || (
                          <UtensilsCrossed className="size-4" />
                        )}
                    </span>
                    <span className="w-full truncate text-[10px] font-medium leading-tight">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("phone.waiter.order.searchPlaceholder")}
            className={cn(
              "h-10 w-full border border-white/10 bg-white/[0.05] pl-9 pr-8 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-[#0066FF]/60",
              tableDesign === "modern"
                ? "rounded-full"
                : tableDesign === "advanced"
                  ? "h-9 rounded-lg"
                  : "rounded-xl",
            )}
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

      <main
        className={cn(
          "relative z-10 flex-1 overflow-y-auto no-scrollbar px-4",
          showPrevBar && showCartBar
            ? "pb-64"
            : showPrevBar
              ? "pb-52"
              : showCartBar
                ? "pb-28"
                : "pb-8",
        )}
      >
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-white/40">
            <UtensilsCrossed className="size-8" />
            <p className="text-sm">{t("phone.waiter.order.noItems")}</p>
          </div>
        ) : tableDesign === "modern" ? (
          <div className="space-y-2">
            {filteredItems.map((item) => {
              const inCart = cart.find((c) => c.menuItemId === item._id);
              const visualBlock = getOrderBlockReason(item, 1, enforceAvailability);
              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => addToCart(item)}
                  disabled={Boolean(visualBlock)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99]",
                    visualBlock
                      ? "bg-white/[0.03] opacity-55"
                      : inCart
                        ? "bg-white/[0.08]"
                        : "bg-white/[0.05]",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-white">
                      {item.name}
                    </span>
                    {waiterCanPay ? (
                      <span className="text-[12px] text-white/45">{formatPrice(item.price)}</span>
                    ) : null}
                    {visualBlock ? (
                      <span className="block text-[10px] font-semibold text-amber-400">
                        {visualBlock === "stock"
                          ? t("phone.waiter.order.outOfStock")
                          : t("phone.waiter.order.stopped")}
                      </span>
                    ) : null}
                  </span>
                  {inCart && !visualBlock ? (
                    <span
                      className="flex size-7 items-center justify-center rounded-full text-[12px] font-bold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {inCart.quantity}
                    </span>
                  ) : (
                    <span
                      className="flex size-7 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: visualBlock ? "var(--waiter-card)" : accent }}
                    >
                      <Plus className="size-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : tableDesign === "advanced" ? (
          <div className="space-y-1.5">
            {filteredItems.map((item) => {
              const inCart = cart.find((c) => c.menuItemId === item._id);
              const visualBlock = getOrderBlockReason(item, 1, enforceAvailability);
              return (
                <div
                  key={item._id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2 py-2",
                    visualBlock ? "opacity-55" : "",
                  )}
                  style={{
                    background: "var(--waiter-card)",
                    boxShadow: "inset 0 0 0 1px var(--waiter-border)",
                  }}
                >
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{
                      background:
                        item.station === "bar"
                          ? "#a78bfa"
                          : item.station === "kitchen"
                            ? "#fb923c"
                            : accent,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addToCart(item)}
                    disabled={Boolean(visualBlock)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-[13px] font-semibold text-white">{item.name}</p>
                    <p className="text-[11px] text-white/40">
                      {waiterCanPay ? formatPrice(item.price) : item.station === "bar" ? "Bar" : "Kitchen"}
                    </p>
                    {visualBlock ? (
                      <p className="text-[10px] font-semibold text-amber-400">
                        {visualBlock === "stock"
                          ? t("phone.waiter.order.outOfStock")
                          : t("phone.waiter.order.stopped")}
                      </p>
                    ) : null}
                  </button>
                  {inCart && !visualBlock ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQty(item._id, -1)}
                        className="flex size-7 items-center justify-center rounded-lg bg-white/[0.08] text-white/70"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-4 text-center text-[13px] font-bold">{inCart.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item._id, 1)}
                        className="flex size-7 items-center justify-center rounded-lg bg-white/[0.08] text-white"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(item)}
                      disabled={Boolean(visualBlock)}
                      className="flex size-7 items-center justify-center rounded-lg text-[13px] font-bold"
                      style={{ background: `${accent}33`, color: accent }}
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const inCart = cart.find((c) => c.menuItemId === item._id);
              const visualBlock = getOrderBlockReason(
                item,
                1,
                enforceAvailability,
              );
              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className={cn(
                    "relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition active:scale-[0.98]",
                    visualBlock
                      ? "border-white/8 bg-white/[0.02] opacity-55"
                      : inCart
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
                  {waiterCanPay ? (
                    <p className="text-[13px] font-bold text-[#7eb6ff]">{formatPrice(item.price)}</p>
                  ) : null}
                  {visualBlock ? (
                    <p className="text-[10px] font-semibold text-amber-400">
                      {visualBlock === "stock"
                        ? t("phone.waiter.order.outOfStock")
                        : t("phone.waiter.order.stopped")}
                    </p>
                  ) : null}
                  {inCart && !visualBlock ? (
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

      {(showPrevBar || showCartBar) ? (
        <div className="fixed inset-x-0 bottom-0 z-20">
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              light ? "bg-[#f4f6fa]" : "bg-[#070b14]",
            )}
            aria-hidden
          />
          <div className="relative space-y-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {showCartBar ? (
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-3.5 text-white shadow-xl active:scale-[0.98]",
                  tableDesign === "modern" ? "rounded-full" : "rounded-2xl",
                )}
                style={{
                  backgroundColor: tableDesign === "professional" ? "#0066FF" : accent,
                  boxShadow: `0 12px 28px -10px ${tableDesign === "professional" ? "#0066FF" : accent}80`,
                }}
              >
                <span className="flex items-center gap-2 text-[14px] font-semibold text-white">
                  <ShoppingBag className="size-4" />
                  {t("phone.waiter.order.itemsInCart", { count: cartCount })}
                </span>
                {waiterCanPay ? (
                  <span className="text-[14px] font-bold text-white">{formatPrice(cartTotal)}</span>
                ) : null}
              </button>
            ) : null}
            {showPrevBar ? (
              <div
                className={cn(
                  "flex w-full items-center gap-2 border border-white/12 bg-[#121a2e] px-3 py-2.5",
                  tableDesign === "modern" ? "rounded-full" : "rounded-2xl",
                )}
              >
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.99]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/18 text-amber-300">
                    <ClipboardList className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-white">
                      {t("phone.waiter.order.previousOrders")}
                    </span>
                    <span className="block truncate text-[12px] text-white/50">
                      {t("phone.waiter.order.previousBarHint", { count: sentCount })}
                    </span>
                  </span>
                </button>
                {existingOrder ? (
                  waiterCanPay ? (
                    <button
                      type="button"
                      onClick={() => setPayOpen(true)}
                      disabled={payBusy}
                      className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-[12px] font-semibold text-white active:scale-95 disabled:opacity-50"
                    >
                      {t("phone.waiter.order.payment")}
                    </button>
                  ) : billRequested ? (
                    <span className="shrink-0 max-w-[7.5rem] text-right text-[11px] font-semibold leading-tight text-[#7eb6ff]">
                      {t("phone.waiter.order.billRequested")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleRequestBill()}
                      disabled={payBusy}
                      className="shrink-0 rounded-xl bg-[#0066FF] px-3 py-2 text-[12px] font-semibold text-white active:scale-95 disabled:opacity-50"
                    >
                      {t("phone.waiter.order.requestBill")}
                    </button>
                  )
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
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
                {sentLines.length > 0
                  ? t("phone.waiter.order.newItems")
                  : t("phone.waiter.order.currentOrder")}
              </h2>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-white/50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-4">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-white/40">
                  {t("phone.waiter.order.cartEmpty")}
                </p>
              ) : (
                <div className="space-y-2 pb-2">
                  {cart.map((item) => (
                    <div
                      key={item.menuItemId}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white">{item.name}</p>
                        {waiterCanPay ? (
                          <p className="text-[12px] text-white/40">{formatPrice(item.price)}</p>
                        ) : null}
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
              {waiterCanPay ? (
                <div className="mb-3 flex items-center justify-between text-[14px]">
                  <span className="text-white/50">
                    {t("phone.waiter.order.newItemsTotal")}
                  </span>
                  <span className="font-bold text-white">{formatPrice(cartTotal)}</span>
                </div>
              ) : null}
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

      {historyOpen ? (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/60">
          <button
            type="button"
            aria-label={t("btn.cancel")}
            className="absolute inset-0"
            onClick={() => setHistoryOpen(false)}
          />
          <div className="relative z-10 flex max-h-[88vh] flex-col rounded-t-3xl border-t border-white/10 bg-[#0d1326] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-4 py-3.5">
              <h2 className="text-[15px] font-semibold text-white">
                {t("phone.waiter.order.previousOrders")}
              </h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-white/50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mx-4 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[#f3efe6] text-[#141820]">
              <div className="border-b border-black/10 px-5 py-3 text-center">
                <h3 className="text-[16px] font-semibold tracking-tight">
                  {company?.name || t("phone.waiter.order.billTitle", { defaultValue: "Fatura" })}
                </h3>
                <p className="mt-1 text-[12px] text-black/55">
                  {[currentTable?.zone, currentTable?.name, existingOrder ? `#${existingOrder.orderNumber}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-3 py-2">
                {groupedSent.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-black/40">
                    {t("phone.waiter.order.cartEmpty")}
                  </p>
                ) : (
                  <>
                    <div className="mb-1 grid grid-cols-[minmax(0,1fr)_4.1rem_2.4rem_4.6rem] items-center gap-x-1.5 px-1 text-[10px] font-medium text-black/40">
                      <span className="truncate">{t("phone.waiter.order.billItem", { defaultValue: "Produkti" })}</span>
                      <span className="text-right">{t("phone.waiter.order.billUnit", { defaultValue: "Çmimi" })}</span>
                      <span className="text-center">{t("phone.waiter.order.billQty", { defaultValue: "Sasia" })}</span>
                      <span className="text-right">{t("phone.waiter.order.billLine", { defaultValue: "Totali" })}</span>
                    </div>
                    <div className="divide-y divide-black/10">
                      {groupedSent.map((g) => (
                        <div
                          key={g.key}
                          className="grid grid-cols-[minmax(0,1fr)_4.1rem_2.4rem_4.6rem] items-center gap-x-1.5 px-1 py-2.5"
                        >
                          <span className="min-w-0 truncate text-[13px] font-medium leading-snug">{g.name}</span>
                          <span className="text-right text-[11px] tabular-nums text-black/50">
                            {formatPrice(g.price)}
                          </span>
                          <span className="text-center text-[13px] font-semibold tabular-nums">{g.qty}</span>
                          <span className="text-right text-[13px] font-semibold tabular-nums">
                            {formatPrice(g.price * g.qty)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-dashed border-black/20 px-4 py-4">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-[12px] font-medium text-black/50">
                    {t("phone.waiter.order.billDue", { defaultValue: "Për t'u paguar" })}
                  </span>
                  <span className="text-[22px] font-bold tabular-nums leading-none">
                    {formatPrice(orderWithItems?.total ?? billTotal)}
                  </span>
                </div>
              </div>
            </div>

            {existingOrder ? (
              <div className="px-4">
                {waiterCanPay ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryOpen(false);
                      setPayOpen(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-[15px] font-semibold text-white"
                  >
                    <CreditCard className="size-4" />
                    {t("phone.waiter.order.payment")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleRequestBill()}
                    disabled={payBusy}
                    className="flex w-full items-center justify-center rounded-xl bg-[#0066FF] py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
                  >
                    {billRequested
                      ? t("phone.waiter.order.billRequested")
                      : t("phone.waiter.order.requestBill")}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {payOpen ? (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/60">
          <button
            type="button"
            aria-label={t("btn.cancel")}
            className="absolute inset-0"
            onClick={() => !payBusy && setPayOpen(false)}
          />
          <div className="relative z-10 rounded-t-3xl border-t border-white/10 bg-[#0d1326] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-white">
                {t("phone.waiter.order.payTitle")}
              </h2>
              <button
                type="button"
                onClick={() => !payBusy && setPayOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-white/50"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-4 text-[13px] text-white/45">
              {t("phone.waiter.order.closeTable")} · {formatPrice(orderWithItems?.total ?? 0)}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "cash" as const, method: "cash" as const, icon: Banknote, label: t("phone.waiter.order.payCash") },
                  { id: "card" as const, method: "card" as const, icon: CreditCard, label: t("phone.waiter.order.payCard") },
                  { id: "other" as const, method: "qr" as const, icon: QrCode, label: t("phone.waiter.order.payQr") },
                ]
              )
                .filter((opt) =>
                  enabledPaymentMethods(paymentSettings).includes(opt.method),
                )
                .map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={payBusy}
                  onClick={() => void handlePhonePay(opt.id)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-4 text-white active:scale-[0.98] disabled:opacity-50"
                >
                  <opt.icon className="size-5 text-[#7eb6ff]" />
                  <span className="text-[12px] font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
            {payBusy ? (
              <p className="mt-3 text-center text-[12px] text-white/40">
                {t("phone.waiter.order.paying")}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {centerNotice ? (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center px-10">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-7 py-4 text-center shadow-none backdrop-blur-md">
            <p className="text-[15px] font-medium tracking-wide text-white/95">
              {centerNotice}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
