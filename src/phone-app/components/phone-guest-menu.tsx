import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { LayoutGrid, UtensilsCrossed } from "lucide-react";
import { useFingerScroll } from "@/phone-app/hooks/use-finger-scroll.ts";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import { cn } from "@/lib/utils.ts";

type GuestCategory = {
  _id: string;
  name: string;
  color?: string;
  icon?: string;
};

type GuestItem = {
  _id: string;
  name: string;
  price: number;
  categoryId: string;
  displayOrder: number;
  available: boolean;
  imageUrl?: string | null;
};

type GuestMenu = {
  venueName: string;
  currencySymbol: string;
  currencyPosition: "prefix" | "suffix";
  currencyDecimals: number;
  categories: GuestCategory[];
  items: GuestItem[];
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

export default function PhoneGuestMenu() {
  const { t } = useTranslation("site");
  const { venueId = "" } = useParams<{ venueId: string }>();
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const categoryScrollRef = useFingerScroll();

  const menu = useQuery(
    "pos.menu.getGuestMenu",
    venueId ? { restaurantId: venueId } : "skip",
  ) as GuestMenu | undefined | null;

  const items = useMemo(() => {
    const list = menu?.items ?? [];
    if (activeCategory === "all") {
      return [...list].sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return list
      .filter((i) => i.categoryId === activeCategory)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [menu?.items, activeCategory]);

  const formatPrice = (n: number) =>
    formatMoney(
      n,
      menu?.currencySymbol ?? "€",
      menu?.currencyPosition ?? "prefix",
      menu?.currencyDecimals ?? 2,
    );

  const loading = Boolean(venueId) && menu === undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-[#070b14] text-white">
      <header className="px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {t("phone.guestMenu.eyebrow")}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {menu?.venueName || t("phone.guestMenu.title")}
        </h1>
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
            <LayoutGrid className="size-4" />
            <span className="w-full truncate text-[10px] font-medium leading-tight">
              {t("phone.waiter.menuAll")}
            </span>
          </button>
          {(menu?.categories ?? []).map((cat) => {
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

      <main className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {loading ? (
          <p className="py-16 text-center text-sm text-white/45">
            {t("phone.guestMenu.loading")}
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <UtensilsCrossed className="size-8 text-white/25" />
            <p className="text-sm text-white/45">{t("phone.guestMenu.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 pb-4">
            {items.map((item) => (
              <div
                key={item._id}
                className="flex min-h-[4.75rem] min-w-0 flex-col items-start justify-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="mb-0.5 h-14 w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : null}
                <span className="line-clamp-2 w-full text-[13px] font-medium leading-tight">
                  {item.name}
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-[#7eb6ff]">
                  {formatPrice(item.price)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
