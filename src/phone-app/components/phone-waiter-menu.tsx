import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import QRCode from "qrcode";
import { QrCode, Search, UtensilsCrossed, LayoutGrid, X } from "lucide-react";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";
import { useFingerScroll } from "@/phone-app/hooks/use-finger-scroll.ts";
import { useWaiterCanPay } from "@/phone-app/hooks/use-waiter-can-pay.ts";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import { buildGuestMenuUrl } from "@/lib/guest-menu-url.ts";
import { cn } from "@/lib/utils.ts";

export default function PhoneWaiterMenu() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const session = getWaiterSession();
  const licenseKey = session?.licenseKey ?? "";
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
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

  return (
    <div className="flex min-h-dvh flex-col bg-[#070b14] pb-[5.75rem] text-white">
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {t("phone.waiter.floorEyebrow")}
          </p>
          <h1 className="text-xl font-semibold tracking-tight">
            {t("phone.waiter.navMenu")}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 active:scale-95"
          aria-label={t("phone.waiter.menuQrTitle")}
        >
          <QrCode className="size-5" />
        </button>
      </header>

      <div
        ref={categoryScrollRef}
        className="waiter-cat-scroll no-scrollbar w-full min-w-0 px-5 pb-3"
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

      <div className="px-5 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("phone.waiter.order.searchPlaceholder")}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-[#0066FF]/60"
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <UtensilsCrossed className="size-8 text-white/25" />
            <p className="text-sm text-white/45">{t("phone.waiter.order.noItems")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pb-4">
            {items.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => {
                  toast.message(t("phone.waiter.menuPickTable"));
                  navigate("/waiter/floor");
                }}
                className="flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-center active:scale-[0.98]"
              >
                <span className="line-clamp-2 w-full text-[12px] font-medium leading-tight">
                  {item.name}
                </span>
                {waiterCanPay ? (
                  <span className="text-[12px] font-semibold tabular-nums text-[#7eb6ff]">
                    {item.price}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </main>

      {qrOpen ? (
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
