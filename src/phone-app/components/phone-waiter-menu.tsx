import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import QRCode from "qrcode";
import { ChevronRight, QrCode, Search, ShoppingBag, UtensilsCrossed, LayoutGrid, X } from "lucide-react";
import PhoneWaiterItemSheet from "@/phone-app/components/phone-waiter-item-sheet.tsx";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";
import { useFingerScroll } from "@/phone-app/hooks/use-finger-scroll.ts";
import { useWaiterCanPay } from "@/phone-app/hooks/use-waiter-can-pay.ts";
import { useWaiterMenuSelection } from "@/phone-app/hooks/use-waiter-menu-selection.ts";
import {
  addWaiterMenuSelectionLine,
  clearWaiterMenuSelection,
  waiterMenuSelectionQty,
  waiterMenuSelectionQtyForItem,
} from "@/phone-app/lib/waiter-menu-selection.ts";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import { resolveMenuItemImageUrl } from "@/lib/menu-item-photo-urls.ts";
import { buildGuestMenuUrl } from "@/lib/guest-menu-url.ts";
import { cn } from "@/lib/utils.ts";
import { resolvedMenuItemUnitPrice } from "@/lib/menu-customizations.ts";
import {
  getOrderBlockReason,
  isMenuItemShownForOrdering,
  resolveOrderAvailabilityRulesFromCompany,
  type OrderBlockReason,
} from "@/lib/pos-order-availability.ts";
import { toast } from "sonner";
import { usePhoneAccessBranding } from "@/phone-app/hooks/use-phone-access-branding.tsx";
import { phoneAccessHasBottomNav, phoneAccessMenuGridClass } from "@/lib/local-db.ts";
import {
  phoneAccessThemeTokens,
  waiterIdleChipClass,
  waiterPageTextClass,
  vyntexSelectedFill,
  vyntexSelectedBar,
} from "@/lib/phone-access-theme.ts";
import type { SelectedCustomization } from "@/lib/menu-customizations.ts";

export default function PhoneWaiterMenu() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const session = getWaiterSession();
  const licenseKey = session?.licenseKey ?? "";
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Doc<"menuItems"> | null>(null);
  const categoryScrollRef = useFingerScroll();
  const selection = useWaiterMenuSelection();
  const selectionCount = waiterMenuSelectionQty(selection);

  const categories = useQuery(
    "pos.menu.getCategories",
    licenseKey ? { licenseKey } : "skip",
  ) as Doc<"menuCategories">[] | undefined;
  const menuItems = useQuery(
    "pos.menu.getAllItems",
    licenseKey ? { licenseKey } : "skip",
  ) as Doc<"menuItems">[] | undefined;
  const company = useQuery(
    "pos.settings.getCompanyDetails",
    licenseKey ? { licenseKey } : "skip",
  ) as
    | {
        id?: string;
        name?: string;
        paymentSettings?: unknown;
        enforceOrderAvailability?: boolean;
        stockRules?: unknown;
      }
    | undefined;
  const availabilityRules = resolveOrderAvailabilityRulesFromCompany(
    company,
    licenseKey,
  );

  const restaurantId = company?.id ?? "";
  const waiterCanPay = useWaiterCanPay(licenseKey);
  const access = usePhoneAccessBranding();
  const tokens = phoneAccessThemeTokens(access.theme);

  useEffect(() => {
    if (!restaurantId) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(buildGuestMenuUrl(restaurantId), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 360,
      color: { dark: "#0A0F1E", light: "#FFFFFF" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories ?? []) {
      map.set(cat._id, cat.name);
    }
    return map;
  }, [categories]);

  const itemPhotoUrl = (item: Doc<"menuItems">) =>
    resolveMenuItemImageUrl(item, categoryNameById.get(item.categoryId) ?? "");

  const items = useMemo(() => {
    const list = (menuItems ?? []).filter((i) =>
      isMenuItemShownForOrdering(i, availabilityRules.honorKitchenStop),
    );
    const q = searchQuery.trim().toLowerCase();
    return list
      .filter((i) => {
        if (q) return i.name.toLowerCase().includes(q);
        if (activeCategory === "all") return true;
        return i.categoryId === activeCategory;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [
    menuItems,
    searchQuery,
    activeCategory,
    availabilityRules.honorKitchenStop,
  ]);

  const design = access.menuDesign;
  const showQr = access.showMenuQr;
  const modern = design === "modern";
  const advanced = design === "advanced";

  const toastBlocked = (reason: OrderBlockReason, name: string) => {
    toast.error(
      reason === "stock"
        ? t("phone.waiter.order.blockedStock", { name })
        : t("phone.waiter.order.blockedStopped", { name }),
    );
  };

  const openItem = (item: Doc<"menuItems">) => {
    const blocked = getOrderBlockReason(item, 1, availabilityRules);
    if (blocked) {
      toastBlocked(blocked, item.name);
      return;
    }
    setSelectedItem(item);
  };

  const addToSelection = (
    quantity: number,
    selectedCustomizations?: SelectedCustomization[],
    notes?: string,
    prepExtraPrice = 0,
  ) => {
    const item = selectedItem;
    if (!item) return;
    const already = waiterMenuSelectionQtyForItem(selection, String(item._id));
    const blocked = getOrderBlockReason(
      item,
      already + quantity,
      availabilityRules,
    );
    if (blocked) {
      toastBlocked(blocked, item.name);
      return;
    }
    addWaiterMenuSelectionLine({
      menuItemId: String(item._id),
      name: item.name,
      price:
        resolvedMenuItemUnitPrice(item.price, selectedCustomizations) +
        prepExtraPrice,
      quantity,
      station: item.station,
      vatRate: item.vatRate,
      notes,
      selectedCustomizations,
    });
    setSelectedItem(null);
  };

  const selectedCategory = selectedItem
    ? (categories ?? []).find((c) => c._id === selectedItem.categoryId)
    : undefined;

  const currency = {
    symbol: (company as { currencySymbol?: string } | undefined)?.currencySymbol ?? "€",
    position:
      ((company as { currencyPosition?: string } | undefined)?.currencyPosition as
        | "prefix"
        | "suffix"
        | undefined) ?? "prefix",
    decimals:
      (company as { currencyDecimals?: number } | undefined)?.currencyDecimals ?? 2,
  };
  const fmt = (n: number) => {
    const s = n.toFixed(currency.decimals);
    return currency.position === "prefix"
      ? `${currency.symbol}${s}`
      : `${s} ${currency.symbol}`;
  };

  return (
    <div
      className={cn(
        "flex h-dvh min-h-0 flex-col overflow-hidden overscroll-none",
        waiterPageTextClass(tokens.isLight),
        phoneAccessHasBottomNav(access)
          ? selectionCount > 0
            ? "pb-[10.25rem]"
            : "pb-[5.75rem]"
          : selectionCount > 0
            ? "pb-28"
            : "pb-6",
      )}
    >
      {access.showMenuHeader ? (
      <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--waiter-muted)" }}
          >
            {t("phone.waiter.floorEyebrowNamed", {
              name: session?.staff.name ?? "",
            })}
          </p>
          <h1
            className={cn(
              "font-semibold tracking-tight",
              modern ? "text-[18px]" : advanced ? "text-[17px]" : "text-xl",
            )}
          >
            {t("phone.waiter.navMenu")}
          </h1>
        </div>
        {showQr ? (
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center text-white/80 active:scale-95",
              modern
                ? "rounded-full bg-white/[0.08]"
                : "rounded-xl border border-white/10 bg-white/[0.06]",
            )}
            aria-label={t("phone.waiter.menuQrTitle")}
          >
            <QrCode className="size-5" />
          </button>
        ) : null}
      </header>
      ) : showQr ? (
        <div className="flex shrink-0 items-center justify-end px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 active:scale-95"
            aria-label={t("phone.waiter.menuQrTitle")}
          >
            <QrCode className="size-5" />
          </button>
        </div>
      ) : (
        <div className="shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))]" />
      )}

      {modern ? (
        <div
          ref={categoryScrollRef}
          className="waiter-cat-scroll no-scrollbar w-full min-w-0 shrink-0 px-5 pb-3"
        >
          <div className="flex w-max gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
                activeCategory === "all" ? "text-white" : waiterIdleChipClass(tokens.isLight),
              )}
              style={
                activeCategory === "all" ? vyntexSelectedFill({ shadow: false }) : undefined
              }
            >
              {t("phone.waiter.menuAll")}
            </button>
            {(categories ?? []).map((cat) => {
              const sel = activeCategory === cat._id;
              return (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setActiveCategory(cat._id)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
                    sel ? "text-white" : waiterIdleChipClass(tokens.isLight),
                  )}
                  style={sel ? vyntexSelectedFill({ shadow: false }) : undefined}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : advanced ? (
        <div
          ref={categoryScrollRef}
          className="waiter-cat-scroll no-scrollbar w-full min-w-0 shrink-0 px-5 pb-3"
        >
          <div className="flex w-max gap-4">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className="shrink-0 pb-1.5 text-[13px] font-medium"
              style={{
                color: activeCategory === "all" ? "var(--waiter-fg, #fff)" : "var(--waiter-muted, rgba(255,255,255,0.4))",
                ...(activeCategory === "all"
                  ? vyntexSelectedBar()
                  : { borderBottom: "2px solid transparent" }),
              }}
            >
              {t("phone.waiter.menuAll")}
            </button>
            {(categories ?? []).map((cat) => {
              const sel = activeCategory === cat._id;
              return (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setActiveCategory(cat._id)}
                  className="shrink-0 pb-1.5 text-[13px] font-medium"
                  style={{
                    color: sel ? "var(--waiter-fg, #fff)" : "var(--waiter-muted, rgba(255,255,255,0.4))",
                    ...(sel ? vyntexSelectedBar() : { borderBottom: "2px solid transparent" }),
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
      <div
        ref={categoryScrollRef}
        className="waiter-cat-scroll no-scrollbar w-full min-w-0 shrink-0 px-5 pb-3"
      >
        <div className="flex w-max gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={cn(
              "flex h-[3.85rem] w-[4.35rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 text-center transition",
              activeCategory === "all"
                ? "border-transparent text-white"
                : "border-white/10 bg-white/[0.05] text-white/60",
            )}
            style={
              activeCategory === "all" ? vyntexSelectedFill({ shadow: false }) : undefined
            }
          >
            <span className="flex size-5 items-center justify-center">
              <LayoutGrid className="size-4" />
            </span>
            <span className="w-full truncate text-[10px] font-medium leading-tight">
              {t("phone.waiter.menuAll")}
            </span>
          </button>
          {(categories ?? []).map((cat) => {
            const sel = activeCategory === cat._id;
            return (
              <button
                key={cat._id}
                type="button"
                onClick={() => setActiveCategory(cat._id)}
                className={cn(
                  "flex h-[3.85rem] w-[4.35rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-1.5 text-center transition",
                  sel
                    ? "border-transparent text-white"
                    : "border-white/10 bg-white/[0.05] text-white/60",
                )}
                style={sel ? vyntexSelectedFill({ shadow: false }) : undefined}
              >
                <span className="flex size-5 items-center justify-center text-[15px] leading-none">
                  {(cat.icon && cat.icon.trim()) || emojiForCategoryName(cat.name) || (
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

      <div className="shrink-0 px-5 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("phone.waiter.order.searchPlaceholder")}
            className={cn(
              "h-10 w-full border border-white/10 bg-white/[0.05] pl-9 pr-3 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-brand/60",
              modern ? "rounded-full" : advanced ? "rounded-lg" : "rounded-xl",
            )}
          />
        </div>
      </div>

      <main className="waiter-cat-scroll-y no-scrollbar min-h-0 flex-1 px-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <UtensilsCrossed className="size-8 text-white/25" />
            <p className="text-sm text-white/45">{t("phone.waiter.order.noItems")}</p>
          </div>
        ) : modern ? (
          <div className="space-y-2 pb-4">
            {items.map((item) => {
              const blocked = getOrderBlockReason(item, 1, availabilityRules);
              const locked = Boolean(blocked);
              return (
              <button
                key={item._id}
                type="button"
                disabled={locked}
                onClick={() => openItem(item)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left",
                  locked
                    ? blocked === "stock"
                      ? "cursor-not-allowed border border-red-400/60 bg-red-500/[0.05]"
                      : "cursor-not-allowed border border-amber-400/50 bg-amber-500/[0.05]"
                    : "bg-white/[0.05] active:scale-[0.99]",
                )}
              >
                {waiterMenuSelectionQtyForItem(selection, String(item._id)) > 0 ? (
                  <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {waiterMenuSelectionQtyForItem(selection, String(item._id))}
                  </span>
                ) : null}
                {itemPhotoUrl(item) ? (
                  <img
                    src={itemPhotoUrl(item)}
                    alt={item.name}
                    className="size-10 shrink-0 rounded-xl object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{item.name}</p>
                  {item.description && !locked ? (
                    <p className="truncate text-[11px]" style={{ color: "var(--waiter-muted)" }}>
                      {item.description}
                    </p>
                  ) : null}
                  {locked ? (
                    <p
                      className={cn(
                        "text-[10px] font-semibold",
                        blocked === "stock" ? "text-red-400" : "text-amber-400",
                      )}
                    >
                      {blocked === "stock"
                        ? t("phone.waiter.order.outOfStock")
                        : t("phone.waiter.order.stopped")}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {waiterCanPay && !locked ? (
                    <span className="text-[13px] font-semibold tabular-nums text-brand-soft">
                      {fmt(item.price)}
                    </span>
                  ) : null}
                  <ChevronRight className="size-4 text-white/25" />
                </div>
              </button>
              );
            })}
          </div>
        ) : advanced ? (
          <div className="space-y-1.5 pb-4">
            {items.map((item) => {
              const blocked = getOrderBlockReason(item, 1, availabilityRules);
              const locked = Boolean(blocked);
              return (
              <button
                key={item._id}
                type="button"
                disabled={locked}
                onClick={() => openItem(item)}
                className="relative flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left disabled:cursor-not-allowed"
                style={{
                  background: locked
                    ? blocked === "stock"
                      ? "rgba(239,68,68,0.05)"
                      : "rgba(245,158,11,0.08)"
                    : "rgba(255,255,255,0.04)",
                  boxShadow: locked
                    ? blocked === "stock"
                      ? "inset 0 0 0 1px rgba(248,113,113,0.6)"
                      : "inset 0 0 0 1px rgba(251,191,36,0.55)"
                    : "inset 0 0 0 1px rgba(255,255,255,0.08)",
                }}
              >
                {itemPhotoUrl(item) ? (
                  <img
                    src={itemPhotoUrl(item)}
                    alt={item.name}
                    className="size-9 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ background: access.accentColor }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{item.name}</p>
                  {item.description && !locked ? (
                    <p className="truncate text-[11px]" style={{ color: "var(--waiter-muted)" }}>
                      {item.description}
                    </p>
                  ) : null}
                  {locked ? (
                    <p
                      className={cn(
                        "text-[10px] font-semibold",
                        blocked === "stock" ? "text-red-400" : "text-amber-400",
                      )}
                    >
                      {blocked === "stock"
                        ? t("phone.waiter.order.outOfStock")
                        : t("phone.waiter.order.stopped")}
                    </p>
                  ) : null}
                </div>
                {waiterCanPay && !locked ? (
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-brand-soft">
                    {fmt(item.price)}
                  </span>
                ) : null}
                {waiterMenuSelectionQtyForItem(selection, String(item._id)) > 0 && !locked ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {waiterMenuSelectionQtyForItem(selection, String(item._id))}
                  </span>
                ) : null}
              </button>
              );
            })}
          </div>
        ) : (
          <div className={cn("grid gap-2 pb-4", phoneAccessMenuGridClass(access.menuCols))}>
            {items.map((item) => {
              const blocked = getOrderBlockReason(item, 1, availabilityRules);
              const locked = Boolean(blocked);
              return (
              <button
                key={item._id}
                type="button"
                disabled={locked}
                onClick={() => openItem(item)}
                className={cn(
                  "relative flex min-w-0 flex-col gap-1 rounded-2xl text-center",
                  locked
                    ? blocked === "stock"
                      ? "cursor-not-allowed border border-red-400/60 bg-red-500/[0.05]"
                      : "cursor-not-allowed border border-amber-400/50 bg-amber-500/[0.05]"
                    : "border border-white/10 bg-white/[0.04] active:scale-[0.98]",
                  access.menuCols === 1
                    ? "min-h-[5.5rem] flex-row items-center px-3 py-2.5 text-left"
                    : "min-h-[4.75rem] items-center justify-center px-2 py-2.5",
                )}
              >
                {waiterMenuSelectionQtyForItem(selection, String(item._id)) > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {waiterMenuSelectionQtyForItem(selection, String(item._id))}
                  </span>
                ) : null}
                <img
                  src={itemPhotoUrl(item)}
                  alt=""
                  className={cn(
                    "rounded-lg object-cover",
                    access.menuCols === 1
                      ? "mb-0 h-16 w-20 shrink-0"
                      : "mb-0.5 h-14 w-full",
                  )}
                  loading="lazy"
                />
                <div
                  className={cn(
                    "min-w-0",
                    access.menuCols === 1 ? "flex-1" : "w-full",
                  )}
                >
                  <span
                    className={cn(
                      "block w-full text-[12px] font-medium leading-tight",
                      access.menuCols === 1 ? "line-clamp-2 text-left" : "line-clamp-2",
                    )}
                  >
                    {item.name}
                  </span>
                  {locked ? (
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        blocked === "stock" ? "text-red-400" : "text-amber-400",
                      )}
                    >
                      {blocked === "stock"
                        ? t("phone.waiter.order.outOfStock")
                        : t("phone.waiter.order.stopped")}
                    </span>
                  ) : waiterCanPay ? (
                    <span className="text-[12px] font-semibold tabular-nums text-brand-soft">
                      {fmt(item.price)}
                    </span>
                  ) : null}
                </div>
              </button>
              );
            })}
          </div>
        )}
      </main>

      {selectedItem ? (
        <PhoneWaiterItemSheet
          item={selectedItem}
          category={selectedCategory}
          accent={access.accentColor}
          tokens={tokens}
          showPrice
          formatPrice={fmt}
          onClose={() => setSelectedItem(null)}
          onAdd={addToSelection}
        />
      ) : null}

      {selectionCount > 0 ? (
        <div
          className={cn(
            "fixed inset-x-0 z-20 px-4",
            phoneAccessHasBottomNav(access)
              ? "bottom-[4.85rem]"
              : "bottom-[max(1rem,env(safe-area-inset-bottom))]",
          )}
        >
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => clearWaiterMenuSelection()}
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-[#121a2e] text-white/70 active:scale-95"
              aria-label={t("phone.waiter.menuClearSelection")}
            >
              <X className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/waiter/floor")}
              className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-white active:scale-[0.99]"
              style={{ backgroundColor: access.accentColor }}
            >
              <ShoppingBag className="size-4 shrink-0" />
              <span className="min-w-0 truncate text-[13px] font-semibold">
                {t("phone.waiter.menuAddProducts", { count: selectionCount })}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {qrOpen && showQr ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[#070b14] px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-white">
              {t("phone.waiter.menuQrTitle")}
            </h2>
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white/80"
              aria-label={t("phone.waiter.menuQrClose")}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center">
            {qrDataUrl ? (
              <div className="rounded-3xl bg-white p-4 shadow-2xl">
                <img
                  src={qrDataUrl}
                  alt={t("phone.waiter.menuQrTitle")}
                  className="size-[min(72vw,20rem)]"
                />
              </div>
            ) : (
              <p className="text-center text-sm text-white/60">
                {t("phone.waiter.menuQrUnavailable")}
              </p>
            )}
            <p className="mt-5 max-w-[18rem] text-center text-[13px] leading-relaxed text-white/70">
              {t("phone.waiter.menuQrHint")}
            </p>
            {company?.name ? (
              <p className="mt-2 text-[12px] font-medium text-white/45">{company.name}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
