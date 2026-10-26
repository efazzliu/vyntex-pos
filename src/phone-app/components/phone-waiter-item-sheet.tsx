import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChefHat, ChevronLeft, Minus, Plus, UtensilsCrossed } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { resolveMenuItemImageUrl } from "@/lib/menu-item-photo-urls.ts";
import MenuItemCustomizationPicker from "@/components/menu-item-customization-picker.tsx";
import PhoneWaiterPrepScreen from "@/phone-app/components/phone-waiter-prep-screen.tsx";
import {
  getMenuItemCustomizationGroups,
  hasMenuItemCustomizations,
  type SelectedCustomization,
} from "@/lib/menu-customizations.ts";
import {
  hasPrepConfig,
  prepExtrasPrice,
  resolveItemPrepConfig,
  type PrepSelections,
} from "@/lib/menu-prep-config.ts";
import { fallbackPrepConfig } from "@/phone-app/lib/waiter-prep-fallback.ts";
import { cn } from "@/lib/utils.ts";
import type { PhoneAccessThemeTokens } from "@/lib/phone-access-theme.ts";

type Props = {
  item: Doc<"menuItems"> & {
    customizationConfig?: unknown;
    prepConfig?: unknown;
  };
  category?: Pick<Doc<"menuCategories">, "name" | "prepConfig">;
  accent: string;
  tokens: PhoneAccessThemeTokens;
  showPrice: boolean;
  formatPrice: (n: number) => string;
  onClose: () => void;
  onAdd: (
    quantity: number,
    selectedCustomizations?: SelectedCustomization[],
    notes?: string,
    prepExtraPrice?: number,
  ) => void;
};

export default function PhoneWaiterItemSheet({
  item,
  category,
  accent,
  tokens,
  showPrice,
  formatPrice,
  onClose,
  onAdd,
}: Props) {
  const { t } = useTranslation("site");
  const [qty, setQty] = useState(1);
  const [prepOpen, setPrepOpen] = useState(false);
  const [pendingCustomizations, setPendingCustomizations] = useState<
    SelectedCustomization[] | undefined
  >();
  const [pendingNotes, setPendingNotes] = useState<string | undefined>();
  const customizationGroups = useMemo(
    () => getMenuItemCustomizationGroups(item),
    [item],
  );
  const showCustomization = hasMenuItemCustomizations(item);
  const prepConfig = useMemo(() => {
    const resolved = resolveItemPrepConfig(item, category);
    return hasPrepConfig(resolved)
      ? resolved
      : fallbackPrepConfig((key) => String(t(key)));
  }, [item, category, t]);

  useEffect(() => {
    setQty(1);
    setPrepOpen(false);
    setPendingCustomizations(undefined);
    setPendingNotes(undefined);
  }, [item._id]);

  const photoUrl = resolveMenuItemImageUrl(item, category?.name ?? "");

  const continueAfterCustomization = (
    selections: SelectedCustomization[],
    notes?: string,
  ) => {
    setPendingCustomizations(selections);
    setPendingNotes(notes);
    setPrepOpen(true);
  };

  const finishPrep = (
    prepNotes: string | undefined,
    selections: PrepSelections,
  ) => {
    const notes = [pendingNotes, prepNotes]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join(", ");
    onAdd(
      qty,
      pendingCustomizations,
      notes || undefined,
      prepExtrasPrice(prepConfig, selections),
    );
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[6px]"
        aria-label={t("phone.waiter.menuItemClose")}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[80] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.28)]"
        style={{ background: tokens.sheet, color: tokens.fg }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="waiter-item-sheet-title"
      >
        <div className="flex shrink-0 items-center justify-between px-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full active:scale-95"
            style={{ background: tokens.card, color: tokens.fg }}
            aria-label={t("phone.waiter.menuItemClose")}
          >
            <ChevronLeft className="size-5" />
          </button>
          <div
            className="h-1 w-10 rounded-full"
            style={{ background: tokens.border }}
          />
          <span className="size-10" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <div
            className="relative mb-4 overflow-hidden rounded-2xl"
            style={{ aspectRatio: "16 / 10", background: tokens.card }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                <UtensilsCrossed
                  className="size-10"
                  style={{ color: tokens.faint }}
                />
                {category?.name ? (
                  <span className="text-[12px] font-medium" style={{ color: tokens.muted }}>
                    {category.name}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div className="mb-2 flex items-start justify-between gap-3">
            <h2
              id="waiter-item-sheet-title"
              className="min-w-0 text-[22px] font-bold leading-tight tracking-tight"
              style={{ color: tokens.fg }}
            >
              {item.name}
            </h2>
            {showPrice ? (
              <span
                className="shrink-0 pt-0.5 text-[22px] font-bold tabular-nums"
                style={{ color: accent }}
              >
                {formatPrice(item.price)}
              </span>
            ) : null}
          </div>

          {item.description ? (
            <p
              className="mb-4 text-[14px] leading-relaxed"
              style={{ color: tokens.muted }}
            >
              {item.description}
            </p>
          ) : null}

          {showCustomization ? (
            <div className="mb-4 space-y-3 rounded-2xl border p-3" style={{ borderColor: tokens.border }}>
              <div
                className="flex h-12 w-fit overflow-hidden rounded-xl border"
                style={{ borderColor: tokens.border }}
              >
                <button
                  type="button"
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  className="flex size-12 items-center justify-center active:bg-black/5"
                  style={{ color: tokens.fg }}
                  aria-label="-"
                >
                  <Minus className="size-4" />
                </button>
                <span
                  className="flex min-w-[2.25rem] items-center justify-center text-[16px] font-semibold tabular-nums"
                  style={{ color: tokens.fg }}
                >
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((n) => Math.min(99, n + 1))}
                  className="flex size-12 items-center justify-center active:bg-black/5"
                  style={{ color: tokens.fg }}
                  aria-label="+"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <MenuItemCustomizationPicker
                groups={customizationGroups}
                basePrice={item.price}
                formatPrice={formatPrice}
                accentStyle={{ borderColor: accent, backgroundColor: `${accent}22`, color: accent }}
                labels={{
                  title: t("phone.waiter.customizationTitle"),
                  optionalNote: t("phone.waiter.customizationNote"),
                  notePlaceholder: t("phone.waiter.customizationNotePh"),
                  requiredError: t("phone.waiter.customizationRequired"),
                  confirm: t("phone.waiter.order.prepContinue"),
                  cancel: t("phone.waiter.menuItemClose"),
                }}
                onCancel={onClose}
                onConfirm={continueAfterCustomization}
              />
            </div>
          ) : null}

          {category?.name ? (
            <div
              className="flex items-center justify-between gap-3 border-t py-3.5"
              style={{ borderColor: tokens.border }}
            >
              <span className="text-[13px]" style={{ color: tokens.muted }}>
                {t("phone.waiter.menuItemCategory")}
              </span>
              <span className="text-[13px] font-semibold" style={{ color: tokens.fg }}>
                {category.name}
              </span>
            </div>
          ) : null}
        </div>

        {!showCustomization ? (
          <div
            className="flex shrink-0 items-center gap-2.5 border-t px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-3"
            style={{ borderColor: tokens.border, background: tokens.sheet }}
          >
            <div
              className="flex h-12 shrink-0 overflow-hidden rounded-xl border"
              style={{ borderColor: tokens.border }}
            >
              <button
                type="button"
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                className="flex size-12 items-center justify-center active:bg-black/5"
                style={{ color: tokens.fg }}
                aria-label="-"
              >
                <Minus className="size-4" />
              </button>
              <span
                className="flex min-w-[2.25rem] items-center justify-center text-[16px] font-semibold tabular-nums"
                style={{ color: tokens.fg }}
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((n) => Math.min(99, n + 1))}
                className="flex size-12 items-center justify-center active:bg-black/5"
                style={{ color: tokens.fg }}
                aria-label="+"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPrepOpen(true)}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl border active:scale-95"
              style={{
                borderColor: accent,
                color: accent,
                backgroundColor: `${accent}14`,
              }}
              aria-label={t("phone.waiter.menuItemCustomize")}
            >
              <ChefHat className="size-5" strokeWidth={2.1} />
            </button>
            <button
              type="button"
              onClick={() => onAdd(qty)}
              className={cn(
                "flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl px-4 text-[15px] font-bold text-white active:scale-[0.99]",
              )}
              style={{ backgroundColor: accent }}
            >
              {t("phone.waiter.menuItemSelect")}
            </button>
          </div>
        ) : null}
      </div>
      {prepOpen ? (
        <PhoneWaiterPrepScreen
          itemName={item.name}
          config={prepConfig}
          applyQty={1}
          maxQty={1}
          continueMode={false}
          accent={accent}
          tokens={tokens}
          formatPrice={formatPrice}
          onApplyQtyChange={() => undefined}
          onClose={() => setPrepOpen(false)}
          onSave={finishPrep}
        />
      ) : null}
    </>
  );
}
