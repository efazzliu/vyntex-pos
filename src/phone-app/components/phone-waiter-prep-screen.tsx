import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  ChefHat,
  CircleDollarSign,
  Minus,
  Plus,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { BRAND } from "@/lib/brand-colors.ts";
import type { PhoneAccessThemeTokens } from "@/lib/phone-access-theme.ts";
import {
  formatPrepNotes,
  parsePrepSelections,
  prepExtrasPrice,
  togglePrepChoice,
  togglePrepId,
  type PrepConfig,
  type PrepSelections,
} from "@/lib/menu-prep-config.ts";

type Props = {
  itemName: string;
  config: PrepConfig;
  initialNotes?: string;
  initialSelections?: PrepSelections;
  applyQty: number;
  maxQty: number;
  continueMode: boolean;
  accent: string;
  tokens: PhoneAccessThemeTokens;
  formatPrice: (amount: number) => string;
  nextItemName?: string;
  onApplyQtyChange: (qty: number) => void;
  onClose: () => void;
  onSave: (notes: string | undefined, selections: PrepSelections) => void;
  onSaveAndNext?: (
    notes: string | undefined,
    selections: PrepSelections,
  ) => void;
};

export default function PhoneWaiterPrepScreen({
  itemName,
  config,
  initialNotes,
  initialSelections,
  applyQty,
  maxQty,
  continueMode,
  accent,
  tokens,
  formatPrice,
  nextItemName,
  onApplyQtyChange,
  onClose,
  onSave,
  onSaveAndNext,
}: Props) {
  const { t } = useTranslation("site");
  const light = tokens.isLight;
  const [selections, setSelections] = useState<PrepSelections>(
    () => {
      const initial =
        initialSelections ?? parsePrepSelections(config, initialNotes);
      return { ...initial, customOptions: initial.customOptions ?? [] };
    },
  );
  const [customDraft, setCustomDraft] = useState("");

  const freeQuickNotes = config.quickNotes.filter(
    (chip) => (chip.priceDelta ?? 0) <= 0,
  );
  const paidQuickNotes = config.quickNotes.filter(
    (chip) => (chip.priceDelta ?? 0) > 0,
  );
  const freeModifiers = [...config.toggles, ...freeQuickNotes];
  const paidExtras = [...config.paidExtras, ...paidQuickNotes];
  const selectedExtrasTotal = prepExtrasPrice(config, selections);

  const selectedStyle = useMemo(
    () => ({
      backgroundColor: `${accent}0d`,
      borderColor: accent,
      color: tokens.fg,
      boxShadow: `0 0 0 1px ${accent}22`,
    }),
    [accent, tokens.fg],
  );

  const cardClass = cn(
    "relative overflow-hidden rounded-[20px] border p-3.5",
    light
      ? "border-slate-200/80 bg-white/90 shadow-[0_14px_40px_-28px_rgba(15,23,42,0.45)]"
      : "border-white/10 bg-white/[0.055] shadow-[0_18px_45px_-28px_rgba(0,0,0,0.8)]",
  );

  const idleBtn = light
    ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
    : "border-white/10 bg-white/[0.055] text-white/80 hover:bg-white/[0.09]";

  const extraPriceBadge = (amount: number, active: boolean) => (
    <span
      className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-bold tabular-nums"
      style={{
        backgroundColor: active ? `${accent}18` : tokens.card,
        color: active ? accent : tokens.fg,
      }}
    >
      +{formatPrice(amount)}
    </span>
  );

  const isQuickNoteId = (id: string) =>
    config.quickNotes.some((chip) => chip.id === id);

  const isSelected = (id: string) =>
    isQuickNoteId(id)
      ? selections.quickNotes.includes(id)
      : selections.toggles.includes(id);

  const toggleOption = (id: string) => {
    setSelections((prev) =>
      isQuickNoteId(id)
        ? { ...prev, quickNotes: togglePrepId(prev.quickNotes, id) }
        : { ...prev, toggles: togglePrepId(prev.toggles, id) },
    );
  };

  const renderPrepRow = (
    option: { id: string; name: string; priceDelta?: number },
    withPrice: boolean,
  ) => {
    const active = isSelected(option.id);
    const extraPrice = option.priceDelta ?? 0;
    return (
      <button
        key={option.id}
        type="button"
        onClick={() => toggleOption(option.id)}
        className={cn(
          "flex min-h-9 w-full items-center justify-between gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-left text-[12px] font-semibold transition active:scale-[0.98]",
          active ? "" : idleBtn,
        )}
        style={active ? selectedStyle : undefined}
      >
        <span className="min-w-0 truncate">{option.name}</span>
        <span className="flex shrink-0 items-center gap-2">
          {withPrice && extraPrice > 0 ? extraPriceBadge(extraPrice, active) : null}
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border",
              active
                ? ""
                : light
                  ? "border-slate-300 bg-white"
                  : "border-white/15 bg-white/[0.04]",
            )}
            style={
              active
                ? {
                    borderColor: accent,
                    backgroundColor: `${accent}18`,
                    color: accent,
                  }
                : undefined
            }
          >
            {active ? <Check className="size-3" strokeWidth={2.8} /> : null}
          </span>
        </span>
      </button>
    );
  };

  const handleSave = () => {
    const notes = formatPrepNotes(config, selections).trim();
    onSave(notes || undefined, selections);
  };

  const handleSaveAndNext = () => {
    const notes = formatPrepNotes(config, selections).trim();
    onSaveAndNext?.(notes || undefined, selections);
  };

  const addCustomOption = () => {
    const value = customDraft.trim();
    if (!value) return;
    setSelections((prev) => ({
      ...prev,
      customOptions: [...(prev.customOptions ?? []), value],
    }));
    setCustomDraft("");
  };

  const renderCustomRequests = () => {
    const customOptions = selections.customOptions ?? [];
    if (
      !config.allowWaiterCustomInstructions &&
      customOptions.length === 0 &&
      !selections.freeText.trim()
    ) {
      return null;
    }
    return (
      <div className="mt-3 border-t pt-3" style={{ borderColor: tokens.border }}>
        {customOptions.length > 0 ? (
          <div className="mb-2 space-y-2">
            {customOptions.map((option, index) => (
              <div
                key={`${option}-${index}`}
                className="flex min-h-10 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[13px] font-semibold"
                style={selectedStyle}
              >
                <span className="min-w-0 truncate">{option}</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelections((prev) => ({
                      ...prev,
                      customOptions: (prev.customOptions ?? []).filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                  className="flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{ color: accent }}
                  aria-label={t("phone.waiter.order.prepRemoveCustom")}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {config.allowWaiterCustomInstructions ? (
          <div className="flex gap-2">
            <input
              value={customDraft}
              onChange={(event) => setCustomDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomOption();
                }
              }}
              placeholder={t("phone.waiter.order.prepCustomOptionPh")}
              className={cn(
                "min-w-0 flex-1 rounded-xl border px-3 py-2 text-[13px] outline-none transition focus:ring-4",
                light
                  ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-brand-soft focus:ring-brand/10"
                  : "border-white/10 bg-black/10 text-white placeholder:text-white/30 focus:border-white/20 focus:ring-white/5",
              )}
            />
            <button
              type="button"
              onClick={addCustomOption}
              disabled={!customDraft.trim()}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border disabled:opacity-35"
              style={{
                borderColor: accent,
                backgroundColor: `${accent}12`,
                color: accent,
              }}
              aria-label={t("phone.waiter.order.prepAddCustom")}
            >
              <Plus className="size-4" />
            </button>
          </div>
        ) : null}

        {config.allowWaiterCustomInstructions || selections.freeText.trim() ? (
          <div className="mt-3 border-t pt-3" style={{ borderColor: tokens.border }}>
            <div className="mb-2 flex items-center gap-2">
              <StickyNote className="size-3.5" style={{ color: accent }} />
              <p className="text-[12px] font-bold">
                {t("phone.waiter.order.prepKitchenNote")}
              </p>
            </div>
            <textarea
              value={selections.freeText}
              onChange={(e) =>
                setSelections((prev) => ({ ...prev, freeText: e.target.value }))
              }
              placeholder={t("phone.waiter.order.prepKitchenNotePh")}
              rows={2}
              disabled={!config.allowWaiterCustomInstructions}
              className={cn(
                "w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed outline-none transition focus:ring-4 disabled:opacity-60",
                light
                  ? "border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus:border-brand-soft focus:ring-brand/10"
                  : "border-white/10 bg-black/10 text-white placeholder:text-white/30 focus:border-white/20 focus:ring-white/5",
              )}
            />
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col overflow-hidden"
      style={{ background: tokens.page, color: tokens.fg }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="waiter-prep-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-90"
        style={{
          background: `radial-gradient(circle at 12% 5%, ${accent}2b 0%, transparent 42%), radial-gradient(circle at 92% 22%, ${BRAND.sky}1f 0%, transparent 38%)`,
        }}
      />

      <header className="relative shrink-0 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{
                backgroundImage: `linear-gradient(145deg, ${accent}, ${BRAND.sky})`,
                boxShadow: `0 14px 30px -14px ${accent}`,
              }}
            >
              <ChefHat className="size-6" strokeWidth={2.1} />
            </span>
            <div className="min-w-0">
              <p
                className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: accent }}
              >
                {itemName}
              </p>
              <h2
                id="waiter-prep-title"
                className="truncate text-[22px] font-bold tracking-[-0.025em]"
              >
                {continueMode
                  ? t("phone.waiter.order.noteTitleContinue")
                  : t("phone.waiter.order.noteTitle")}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition active:scale-90",
              light
                ? "border-slate-200 bg-white/90 text-slate-600"
                : "border-white/10 bg-white/[0.07] text-white/70",
            )}
            aria-label={t("phone.waiter.order.cancel")}
          >
            <X className="size-[18px]" />
          </button>
        </div>
        <p
          className="mt-3 max-w-[32rem] text-[12px] leading-relaxed"
          style={{ color: tokens.muted }}
        >
          {continueMode
            ? t("phone.waiter.order.noteContinueDesc", { count: maxQty })
            : t("phone.waiter.order.noteDesc")}
        </p>
      </header>

      <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-5">
        {config.choiceGroups.map((group, groupIndex) => (
          <section key={group.id} className={cardClass}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex size-7 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                <Sparkles className="size-3.5" />
              </span>
              <p className="text-[14px] font-bold">{group.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((option) => {
                const active = selections.choices[group.id] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setSelections((prev) => togglePrepChoice(prev, group.id, option.id))
                    }
                    className={cn(
                      "flex min-h-9 w-full items-center justify-between gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-left text-[12px] font-semibold transition active:scale-[0.98]",
                      active ? "" : idleBtn,
                    )}
                    style={active ? selectedStyle : undefined}
                  >
                    <span className="min-w-0 truncate">{option.name}</span>
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border",
                        active
                          ? ""
                          : light
                            ? "border-slate-300 bg-white"
                            : "border-white/15 bg-white/[0.04]",
                      )}
                      style={
                        active
                          ? {
                              borderColor: accent,
                              backgroundColor: `${accent}18`,
                              color: accent,
                            }
                          : undefined
                      }
                    >
                      {active ? (
                        <Check className="size-3" strokeWidth={2.8} />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {groupIndex === 0 && freeModifiers.length > 0 ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {freeModifiers.map((option) => renderPrepRow(option, false))}
              </div>
            ) : null}
            {groupIndex === 0 ? renderCustomRequests() : null}
          </section>
        ))}

        {config.choiceGroups.length === 0 ? (
          <section className={cardClass}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex size-7 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                <Sparkles className="size-3.5" />
              </span>
              <p className="text-[14px] font-bold">
                {t("phone.waiter.order.prepCookingTitle")}
              </p>
            </div>
            {freeModifiers.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {freeModifiers.map((option) => renderPrepRow(option, false))}
              </div>
            ) : null}
            {renderCustomRequests()}
          </section>
        ) : null}

        {paidExtras.length > 0 ? (
          <section className={cardClass}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex size-8 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                <CircleDollarSign className="size-4" />
              </span>
              <p className="text-[14px] font-bold">
                {t("phone.waiter.order.prepPaidExtrasTitle")}
              </p>
            </div>
            <div className="space-y-2">
              {paidExtras.map((option) => renderPrepRow(option, true))}
            </div>
            {selectedExtrasTotal > 0 ? (
              <div
                className="mt-3 flex items-center justify-between border-t pt-3"
                style={{ borderColor: tokens.border }}
              >
                <span className="text-[12px] font-semibold" style={{ color: tokens.muted }}>
                  {t("phone.waiter.order.prepExtrasTotal", {
                    defaultValue: "Ekstra të zgjedhura",
                  })}
                </span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: accent }}>
                  +{formatPrice(selectedExtrasTotal)}
                </span>
              </div>
            ) : null}
          </section>
        ) : null}

        {maxQty > 1 ? (
          <section className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-bold">
                  {t("phone.waiter.order.noteApplyTo")}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: tokens.muted }}>
                  {t("phone.waiter.order.noteApplyHint", {
                    count: applyQty,
                    total: maxQty,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApplyQtyChange(Math.max(1, applyQty - 1))}
                  disabled={applyQty <= 1}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl border transition active:scale-90 disabled:opacity-35",
                    light
                      ? "border-slate-200 bg-slate-50 text-slate-700"
                      : "border-white/10 bg-white/[0.06] text-white/70",
                  )}
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-7 text-center text-[17px] font-bold">{applyQty}</span>
                <button
                  type="button"
                  onClick={() => onApplyQtyChange(Math.min(maxQty, applyQty + 1))}
                  disabled={applyQty >= maxQty}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl border text-white transition active:scale-90 disabled:opacity-35",
                    light ? "border-transparent" : "border-white/10",
                  )}
                  style={{ backgroundColor: accent }}
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <div
        className={cn(
          "relative shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl",
          light ? "bg-white/85" : "bg-black/25",
        )}
        style={{ borderColor: tokens.border }}
      >
        {onSaveAndNext && nextItemName ? (
          <p
            className="mb-2 truncate text-center text-[11px] font-medium"
            style={{ color: tokens.muted }}
          >
            {t("phone.waiter.order.prepNextItem")}:{" "}
            <span style={{ color: tokens.fg }}>{nextItemName}</span>
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-xl border py-3.5 text-[13px] font-bold transition active:scale-[0.98]",
              onSaveAndNext && nextItemName ? "flex-1" : "w-full text-white",
            )}
            style={
              onSaveAndNext && nextItemName
                ? {
                    borderColor: tokens.border,
                    backgroundColor: tokens.card,
                    color: tokens.fg,
                  }
                : {
                    backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${BRAND.primary} 52%, ${BRAND.sky} 100%)`,
                    boxShadow: `0 16px 30px -16px ${accent}`,
                  }
            }
          >
            <Check className="size-4" strokeWidth={2.6} />
            {t("phone.waiter.order.prepFinishAll")}
          </button>
          {onSaveAndNext && nextItemName ? (
            <button
              type="button"
              onClick={handleSaveAndNext}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl py-3.5 text-[13px] font-bold text-white shadow-xl transition active:scale-[0.98]"
              style={{
                backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${BRAND.primary} 52%, ${BRAND.sky} 100%)`,
                boxShadow: `0 16px 30px -16px ${accent}`,
              }}
            >
              {t("phone.waiter.order.prepContinue")}
              <ArrowRight className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
