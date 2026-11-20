import { useEffect, useMemo, useState } from "react";
import {
  Check,
  FileText,
  Layers,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import {
  customizationPriceDelta,
  resolvedMenuItemUnitPrice,
  selectionLimits,
  toggleCustomizationSelection,
  validateCustomizationSelections,
  type MenuCustomizationGroup,
  type SelectedCustomization,
} from "@/lib/menu-customizations.ts";
import { variantGroupIcon } from "./drawer-form-kit.tsx";

const BRAND = "#1d5ff0";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type OrderCustomizeLine = {
  name: string;
  basePrice: number;
  quantity?: number;
  selectedCustomizations?: SelectedCustomization[];
  notes?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: OrderCustomizeLine | null;
  groups: MenuCustomizationGroup[];
  formatPrice: (n: number) => string;
  t: Translate;
  onConfirm: (selections: SelectedCustomization[], notes?: string) => void;
};

export default function OrderCustomizeDrawer({
  open,
  onOpenChange,
  line,
  groups,
  formatPrice,
  t,
  onConfirm,
}: Props) {
  const [selections, setSelections] = useState<SelectedCustomization[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !line) return;
    setSelections(line.selectedCustomizations ?? []);
    setNotes(line.notes ?? "");
    setError(null);
    setActiveGroupId(groups[0]?.id ?? null);
  }, [open, line, groups]);

  const basePrice = line?.basePrice ?? 0;
  const qty = Math.max(1, line?.quantity ?? 1);
  const extra = useMemo(() => customizationPriceDelta(selections), [selections]);
  const unitTotal = useMemo(
    () => resolvedMenuItemUnitPrice(basePrice, selections),
    [basePrice, selections],
  );
  const lineTotal = Math.round(unitTotal * qty * 100) / 100;

  const activeGroups = groups.filter((g) => g.active !== false);
  const focusGroup =
    activeGroups.find((g) => g.id === activeGroupId) ?? activeGroups[0] ?? null;

  const pick = (group: MenuCustomizationGroup, optionId: string) => {
    const option = group.options.find((o) => o.id === optionId);
    if (!option || option.active === false) return;
    setSelections((prev) =>
      toggleCustomizationSelection(activeGroups, prev, group, option),
    );
    setError(null);
  };

  const handleConfirm = () => {
    const missing = validateCustomizationSelections(activeGroups, selections);
    if (missing) {
      setError(`${t("order.customization_required")}: ${missing}`);
      const bad = activeGroups.find((g) => g.name === missing);
      if (bad) setActiveGroupId(bad.id);
      return;
    }
    onConfirm(selections, notes.trim() || undefined);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="z-[100]"
        className={cn(
          "z-[100] flex h-dvh max-h-dvh w-full flex-col gap-0 overflow-hidden border-l border-[#e3ebf7] bg-white p-0 shadow-[-24px_0_60px_rgba(15,23,42,0.18)]",
          "sm:w-[min(860px,92vw)] sm:max-w-[92vw]",
        )}
      >
        <SheetHeader className="shrink-0 border-b border-[#e3ebf7] bg-white px-6 py-5 pr-14 text-left">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#1d5ff0]">
              <SlidersHorizontal className="size-5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <SheetTitle className="text-[20px] font-bold tracking-tight text-[#0b1220]">
                {t("order.customize_title")}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-[13px] text-[#64748b]">
                {line
                  ? t("order.customize_for", { name: line.name })
                  : t("order.customize_subtitle")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Split layout: summary | modifiers */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="flex shrink-0 flex-col gap-4 border-b border-[#e3ebf7] bg-[#f7f9fd] p-5 lg:w-[280px] lg:border-b-0 lg:border-r">
            <div className="rounded-[18px] border border-[#e3ebf7] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                {t("order.customize_product")}
              </p>
              <p className="mt-1 truncate text-[16px] font-bold text-[#0b1220]">
                {line?.name ?? "—"}
              </p>
              <p className="mt-1 text-[13px] tabular-nums text-[#64748b]">
                {formatPrice(basePrice)}
                {qty > 1 ? ` × ${qty}` : ""}
              </p>
            </div>

            <div className="rounded-[18px] border border-[#e3ebf7] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                {t("order.customize_selected")}
              </p>
              {selections.length === 0 ? (
                <p className="mt-2 text-[13px] text-[#94a3b8]">
                  {t("order.customize_none_selected")}
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {selections.map((s) => (
                    <li
                      key={`${s.groupId}:${s.optionId}`}
                      className="flex items-center justify-between gap-2 text-[13px]"
                    >
                      <span className="min-w-0 truncate text-[#0b1220]">
                        <span className="text-[#64748b]">{s.groupName}: </span>
                        {s.optionName}
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-[#334155]">
                        {s.priceDelta === 0
                          ? formatPrice(0)
                          : s.priceDelta > 0
                            ? `+${formatPrice(s.priceDelta)}`
                            : `−${formatPrice(Math.abs(s.priceDelta))}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-[18px] border border-[#e3ebf7] bg-[#f1f5fb] px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0ff] text-[#1d5ff0]">
                  <FileText className="size-5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#0b1220]">
                    {t("order.customize_item_total")}
                  </p>
                  <p className="text-[12px] text-[#64748b]">
                    {formatPrice(unitTotal)}
                    {qty > 1 ? ` × ${qty}` : ""}
                    {extra !== 0
                      ? ` · ${formatPrice(Math.abs(extra))} ${t("order.customize_extra")}`
                      : ""}
                  </p>
                </div>
                <p className="text-[22px] font-bold tabular-nums tracking-tight text-[#0b1220]">
                  {formatPrice(lineTotal)}
                </p>
              </div>
            </div>

            <label className="mt-auto block space-y-1.5">
              <span className="text-[13px] font-semibold text-[#0b1220]">
                {t("order.customization_note")}
              </span>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("order.customization_note_ph")}
                className="h-11 rounded-xl border-[#e3ebf7] bg-white text-[#0b1220] placeholder:text-[#94a3b8]"
              />
            </label>
          </aside>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-5 py-5">
            {activeGroups.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[#c7d6f5] bg-[#f7f9fd] px-4 py-10 text-center text-[13px] text-[#64748b]">
                {t("order.customize_empty_assigned")}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {activeGroups.map((group) => {
                    const { max } = selectionLimits(group);
                    const picked = selections.filter((s) => s.groupId === group.id)
                      .length;
                    const Icon = variantGroupIcon(group.name);
                    const selected = focusGroup?.id === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveGroupId(group.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[13px] font-semibold transition",
                          selected
                            ? "border-[#1d5ff0] bg-[#e8f0ff] text-[#1d5ff0]"
                            : "border-[#e3ebf7] bg-[#f7f9fd] text-[#334155] hover:border-[#c7d6f5]",
                        )}
                      >
                        <Icon className="size-4" strokeWidth={1.9} />
                        {group.name}
                        <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] tabular-nums">
                          {picked}/{max}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {focusGroup ? (
                  <section className="overflow-hidden rounded-[18px] border border-[#e3ebf7] bg-[#f7f9fd]">
                    <div className="flex items-start gap-3 border-b border-[#e3ebf7] bg-white px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-[#0b1220]">
                          {focusGroup.name}
                        </p>
                        <p className="text-[12px] text-[#64748b]">
                          {focusGroup.selectionType === "multi"
                            ? t("order.customize_choose_up_to", {
                                max: selectionLimits(focusGroup).max,
                              })
                            : t("order.customize_choose_one")}
                          {" · "}
                          {focusGroup.required
                            ? t("order.customize_required")
                            : t("order.customize_optional")}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#eef2fb] px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#334155]">
                        {
                          selections.filter((s) => s.groupId === focusGroup.id)
                            .length
                        }{" "}
                        / {selectionLimits(focusGroup).max}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2">
                      {focusGroup.options
                        .filter((o) => o.active !== false)
                        .map((option) => {
                          const active = selections.some(
                            (s) =>
                              s.groupId === focusGroup.id &&
                              s.optionId === option.id,
                          );
                          const delta = option.priceDelta ?? 0;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => pick(focusGroup, option.id)}
                              className={cn(
                                "flex items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition",
                                active
                                  ? "border-[#1d5ff0] bg-white shadow-[0_0_0_3px_rgba(29,95,240,0.12)]"
                                  : "border-[#e3ebf7] bg-white hover:border-[#c7d6f5]",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                                  active
                                    ? "bg-[#e8f0ff] text-[#1d5ff0]"
                                    : "bg-[#f7f9fd] text-[#64748b]",
                                )}
                              >
                                <Layers className="size-4" strokeWidth={1.9} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-bold text-[#0b1220]">
                                  {option.name}
                                </span>
                                <span className="block text-[12px] font-semibold tabular-nums text-[#64748b]">
                                  {delta === 0
                                    ? formatPrice(0)
                                    : delta > 0
                                      ? `+ ${formatPrice(delta)}`
                                      : `− ${formatPrice(Math.abs(delta))}`}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  "flex size-6 shrink-0 items-center justify-center rounded-md border",
                                  active
                                    ? "border-[#1d5ff0] bg-[#1d5ff0] text-white"
                                    : "border-[#cbd5e1] bg-white",
                                )}
                                style={active ? { color: "#ffffff" } : undefined}
                              >
                                {active ? (
                                  <Check className="size-3.5" strokeWidth={2.6} />
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </section>
                ) : null}
              </>
            )}

            {error ? (
              <p className="text-[13px] font-medium text-red-500">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-[#e3ebf7] bg-white px-5 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#e3ebf7] bg-white text-[14px] font-semibold text-[#334155]"
          >
            <X className="size-4" strokeWidth={2.2} />
            {t("btn.cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl text-[14px] font-semibold shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)]"
            style={{ backgroundColor: BRAND, color: "#ffffff" }}
          >
            <Check className="size-4" strokeWidth={2.4} />
            {t("order.customize_update")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
