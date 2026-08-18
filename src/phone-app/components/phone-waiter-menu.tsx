import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ChevronRight, QrCode, Search, UtensilsCrossed, LayoutGrid, X } from "lucide-react";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";
import { useFingerScroll } from "@/phone-app/hooks/use-finger-scroll.ts";
import { useWaiterCanPay } from "@/phone-app/hooks/use-waiter-can-pay.ts";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import { buildGuestMenuUrl } from "@/lib/guest-menu-url.ts";
import { cn } from "@/lib/utils.ts";
import { usePhoneAccessBranding } from "@/phone-app/hooks/use-phone-access-branding.tsx";
import { phoneAccessHasBottomNav } from "@/lib/local-db.ts";
import {
  phoneAccessThemeTokens,
  waiterIdleChipClass,
  waiterPageTextClass,
} from "@/lib/phone-access-theme.ts";

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
  ) as { id?: string; name?: string; paymentSettings?: unknown } | undefined;

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

  const items = useMemo(() => {
    const list = (menuItems ?? []).filter((i) => i.available);
    const q = searchQuery.trim().toLowerCase();
    return list
      .filter((i) => {
        if (q) return i.name.toLowerCase().includes(q);
        if (activeCategory === "all") return true;
        return i.categoryId === activeCategory;
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [menuItems, searchQuery, activeCategory]);

  const design = access.menuDesign;
  const showQr = access.showMenuQr;
  const modern = design === "modern";
  const advanced = design === "advanced";

  const openItem = (item: Doc<"menuItems">) => {
    setSelectedItem(item);
  };

  const addToOrder = () => {
    setSelectedItem(null);
    toast.message(t("phone.waiter.menuPickTable"));
    navigate("/waiter/floor");
  };

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
        phoneAccessHasBottomNav(access) ? "pb-[5.75rem]" : "pb-6",
      )}
    >
      {access.showMenuHeader ? (
      <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[11px]",
              !advanced && "font-semibold uppercase tracking-[0.14em]",
            )}
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
                activeCategory === "all"
                  ? { backgroundColor: access.accentColor }
                  : undefined
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
                  style={sel ? { backgroundColor: cat.color || access.accentColor } : undefined}
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
                borderBottom:
                  activeCategory === "all"
                    ? `2px solid ${access.accentColor}`
                    : "2px solid transparent",
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
                    borderBottom: sel
                      ? `2px solid ${cat.color || access.accentColor}`
                      : "2px solid transparent",
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
                ? "border-transparent bg-[#0066FF] text-white"
                : "border-white/10 bg-white/[0.05] text-white/60",
            )}
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
                style={sel ? { backgroundColor: cat.color || "#0066FF" } : undefined}
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
              "h-10 w-full border border-white/10 bg-white/[0.05] pl-9 pr-3 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-[#0066FF]/60",
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
            {items.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => openItem(item)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.05] px-3 py-2.5 text-left active:scale-[0.99]"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="size-10 shrink-0 rounded-xl object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{item.name}</p>
                  {item.description ? (
                    <p className="truncate text-[11px] text-white/40">{item.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {waiterCanPay ? (
                    <span className="text-[13px] font-semibold tabular-nums text-[#7eb6ff]">
                      {fmt(item.price)}
                    </span>
                  ) : null}
                  <ChevronRight className="size-4 text-white/25" />
                </div>
              </button>
            ))}
          </div>
        ) : advanced ? (
          <div className="space-y-1.5 pb-4">
            {items.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => openItem(item)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                }}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
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
                  {item.description ? (
                    <p className="truncate text-[11px] text-white/40">{item.description}</p>
                  ) : null}
                </div>
                {waiterCanPay ? (
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#7eb6ff]">
                    {fmt(item.price)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pb-4">
            {items.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => openItem(item)}
                className="flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-center active:scale-[0.98]"
              >
                <span className="line-clamp-2 w-full text-[12px] font-medium leading-tight">
                  {item.name}
                </span>
                {waiterCanPay ? (
                  <span className="text-[12px] font-semibold tabular-nums text-[#7eb6ff]">
                    {fmt(item.price)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </main>

      {selectedItem ? (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedItem(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[80] rounded-t-3xl bg-[#0d1220] pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between px-5 pb-1 pt-4">
              <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            </div>

            {selectedItem.imageUrl ? (
              <div className="relative mx-5 mb-4 overflow-hidden rounded-2xl" style={{ aspectRatio: "16/9" }}>
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            <div className="px-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="text-[20px] font-bold tracking-tight text-white">
                  {selectedItem.name}
                </h2>
                {waiterCanPay ? (
                  <span
                    className="shrink-0 text-[20px] font-bold tabular-nums"
                    style={{ color: access.accentColor }}
                  >
                    {fmt(selectedItem.price)}
                  </span>
                ) : null}
              </div>

              {selectedItem.description ? (
                <p className="mb-4 text-[13px] leading-relaxed text-white/65">
                  {selectedItem.description}
                </p>
              ) : null}

              {(() => {
                const cat = (categories ?? []).find(
                  (c) => c._id === selectedItem.categoryId,
                );
                return cat ? (
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-white/40">
                      {t("phone.waiter.menuItemCategory")}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white"
                      style={{ backgroundColor: cat.color || access.accentColor }}
                    >
                      {cat.name}
                    </span>
                  </div>
                ) : null;
              })()}

              <button
                type="button"
                onClick={addToOrder}
                className="w-full rounded-2xl py-4 text-[15px] font-bold text-white active:scale-[0.99]"
                style={{ backgroundColor: access.accentColor }}
              >
                {t("phone.waiter.menuItemAddToOrder")}
              </button>
            </div>
          </div>
        </>
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
