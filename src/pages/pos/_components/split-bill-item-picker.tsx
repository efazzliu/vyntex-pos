import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { Check, CheckCheck, Minus, Plus, X } from "lucide-react";
import { usePosLocale } from "./pos-locale-provider.tsx";

type OrderItemRow = {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  status: string;
  notes?: string;
  station?: "kitchen" | "bar";
  menuItemId?: string;
};

export type SplitBillUnit = { id: string; quantity: number };

export type SplitSelectedLine = {
  key: string;
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
};

export type SplitBillGroupedLine = {
  key: string;
  name: string;
  price: number;
  totalQuantity: number;
  station?: "kitchen" | "bar";
  notes?: string;
  units: SplitBillUnit[];
  /** Underlying `sale_items.id` values (Supabase) for this merged row. */
  itemIds: string[];
};

export function allocateSplitUnits(
  units: SplitBillUnit[],
  take: number,
): SplitBillUnit[] {
  const out: SplitBillUnit[] = [];
  let left = take;
  for (const unit of units) {
    if (left <= 0) break;
    const qty = Math.min(unit.quantity, left);
    if (qty > 0) {
      out.push({ id: unit.id, quantity: qty });
      left -= qty;
    }
  }
  return out;
}

export function buildGroupedLinesForSplitBill(
  items: OrderItemRow[],
): SplitBillGroupedLine[] {
  const activeItems = items.filter(
    (i) => i.status !== "cancelled" && i.status !== "voided",
  );
  const mergeKey = (item: OrderItemRow) => {
    const notes = (item.notes ?? "").trim().toLowerCase();
    const name = item.name.trim().toLowerCase();
    const price = Math.round(Number(item.price) * 100) / 100;
    const station = item.station ?? "";
    return `${name}|${price}|${notes}|${station}`;
  };
  const grouped: SplitBillGroupedLine[] = [];
  for (const item of activeItems) {
    const key = mergeKey(item);
    const existing = grouped.find((g) => g.key === key);
    const unit: SplitBillUnit = {
      id: String(item._id),
      quantity: item.quantity,
    };
    if (existing) {
      existing.totalQuantity += item.quantity;
      existing.units.push(unit);
      existing.itemIds.push(String(item._id));
    } else {
      grouped.push({
        key,
        name: item.name,
        price: item.price,
        totalQuantity: item.quantity,
        station: item.station,
        notes: item.notes,
        units: [unit],
        itemIds: [String(item._id)],
      });
    }
  }
  return grouped;
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

type SplitBillItemPickerProps = {
  licenseKey: string;
  orderId: string;
  orderBalanceDue: number;
  onBack: () => void;
  onSelectionChange?: (
    amount: number,
    settled: SplitBillUnit[],
    lines: SplitSelectedLine[],
  ) => void;
};

export default function SplitBillItemPicker({
  licenseKey,
  orderId,
  orderBalanceDue,
  onBack,
  onSelectionChange,
}: SplitBillItemPickerProps) {
  const { t, formatPrice } = usePosLocale();
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});

  const orderData = useQuery("pos.orders.getOrderWithItems", {
    licenseKey,
    orderId,
  });

  const grouped = useMemo(() => {
    if (!orderData?.items?.length) return [];
    return buildGroupedLinesForSplitBill(
      orderData.items as OrderItemRow[],
    );
  }, [orderData]);

  const selectedLines = useMemo(
    () =>
      grouped.flatMap((g) => {
        const qty = selectedQty[g.key] ?? 0;
        if (qty <= 0) return [];
        return [
          {
            key: g.key,
            name: g.name,
            qty,
            price: g.price,
            lineTotal: Math.round(g.price * qty * 100) / 100,
          } satisfies SplitSelectedLine,
        ];
      }),
    [grouped, selectedQty],
  );

  const selectedCount = useMemo(
    () => selectedLines.reduce((sum, row) => sum + row.qty, 0),
    [selectedLines],
  );

  const selectedTotal = useMemo(() => {
    return Math.round(selectedLines.reduce((s, row) => s + row.lineTotal, 0) * 100) / 100;
  }, [selectedLines]);

  const setLineQty = useCallback((key: string, next: number, max: number) => {
    setSelectedQty((prev) => {
      const qty = Math.max(0, Math.min(max, next));
      if (qty <= 0) {
        if (!(key in prev)) return prev;
        const n = { ...prev };
        delete n[key];
        return n;
      }
      if (prev[key] === qty) return prev;
      return { ...prev, [key]: qty };
    });
  }, []);

  const toggleKey = useCallback((key: string, max: number) => {
    setSelectedQty((prev) => {
      const cur = prev[key] ?? 0;
      if (cur > 0) {
        const n = { ...prev };
        delete n[key];
        return n;
      }
      return { ...prev, [key]: max > 1 ? 1 : max };
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedQty(
      Object.fromEntries(grouped.map((g) => [g.key, g.totalQuantity])),
    );
  }, [grouped]);

  const clearAll = useCallback(() => {
    setSelectedQty({});
  }, []);

  const settledNow = useMemo(
    () =>
      grouped.flatMap((g) =>
        allocateSplitUnits(g.units, selectedQty[g.key] ?? 0),
      ),
    [grouped, selectedQty],
  );

  useEffect(() => {
    setSelectedQty((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [key, qty] of Object.entries(prev)) {
        const line = grouped.find((row) => row.key === key);
        if (!line || line.totalQuantity <= 0) {
          changed = true;
          continue;
        }
        const clamped = Math.min(qty, line.totalQuantity);
        if (clamped !== qty) changed = true;
        if (clamped > 0) next[key] = clamped;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [grouped]);

  useEffect(() => {
    onSelectionChange?.(selectedTotal, settledNow, selectedLines);
  }, [onSelectionChange, selectedTotal, settledNow, selectedLines]);

  if (!orderData) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-sm text-slate-400">
        {t("common.loading")}
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-4 py-6">
        <p className="text-sm text-slate-500">{t("order.split_pick_no_lines")}</p>
        <button
          type="button"
          onClick={onBack}
          className="h-11 rounded-2xl text-sm font-semibold text-slate-500 hover:text-slate-950"
        >
          {t("btn.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)]">
          <p className="text-[12px] font-medium text-slate-500">
            {t("order.balance_due")}
          </p>
          <p className="text-[14px] font-semibold tabular-nums text-slate-950">
            {formatPrice(orderBalanceDue)}
          </p>
        </div>
        <div className="flex shrink-0 items-stretch gap-1.5">
          <button
            type="button"
            onClick={selectAll}
            title={t("order.split_pick_all")}
            aria-label={t("order.split_pick_all")}
            className="grid aspect-square h-auto place-items-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)] transition hover:bg-[#f4f8ff] hover:text-brand"
          >
            <CheckCheck className="size-3.5" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={clearAll}
            title={t("order.split_pick_clear")}
            aria-label={t("order.split_pick_clear")}
            className="grid aspect-square h-auto place-items-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)] transition hover:bg-slate-50 hover:text-slate-950"
          >
            <X className="size-3.5" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1.5">
          {grouped.map((g) => {
            const qty = selectedQty[g.key] ?? 0;
            const on = qty > 0;
            const payQty = on ? qty : g.totalQuantity;
            const lineTotal = Math.round(g.price * payQty * 100) / 100;
            const showStepper = on && g.totalQuantity > 1;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => toggleKey(g.key, g.totalQuantity)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-left transition",
                  on
                    ? "border-brand bg-[#f4f8ff] shadow-[0_10px_24px_-18px_rgba(37,99,235,0.55)]"
                    : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/80",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-lg ring-1",
                    on
                      ? "bg-brand text-[#f8fafc] ring-brand"
                      : "bg-white text-slate-400 ring-slate-200",
                  )}
                >
                  <Check className="size-3" strokeWidth={2.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-[12px] font-semibold tracking-tight",
                      on ? "text-slate-950" : "text-slate-700",
                    )}
                  >
                    {g.name}
                  </span>
                  <span className="mt-px flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span>
                      {showStepper
                        ? `${formatPrice(g.price)} × ${formatQty(qty)} / ${formatQty(g.totalQuantity)}`
                        : `${formatPrice(g.price)} × ${formatQty(g.totalQuantity)}`}
                    </span>
                    {g.notes ? (
                      <span className="truncate italic text-amber-600">{g.notes}</span>
                    ) : null}
                  </span>
                </span>
                {showStepper ? (
                  <span
                    className="flex shrink-0 items-center gap-0.5 rounded-full bg-white px-0.5 py-0 ring-1 ring-brand/20"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="grid size-6 place-items-center rounded-full text-brand hover:bg-[#eff6ff]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLineQty(g.key, qty - 1, g.totalQuantity);
                      }}
                    >
                      <Minus className="size-3" strokeWidth={2.4} />
                    </span>
                    <span className="w-4 text-center text-[11px] font-semibold tabular-nums text-brand">
                      {formatQty(qty)}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="grid size-6 place-items-center rounded-full text-brand hover:bg-[#eff6ff]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLineQty(g.key, qty + 1, g.totalQuantity);
                      }}
                    >
                      <Plus className="size-3" strokeWidth={2.4} />
                    </span>
                  </span>
                ) : null}
                <span
                  className={cn(
                    "shrink-0 text-[12px] font-semibold tabular-nums",
                    on ? "text-brand" : "text-slate-950",
                  )}
                >
                  {formatPrice(lineTotal)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)]">
        <p className="text-[12px] font-medium text-slate-500">
          {t("order.split_pick_selected_items")}
        </p>
        <span className="text-[14px] font-semibold tabular-nums text-slate-950">
          {selectedCount}
        </span>
      </div>
    </div>
  );
}
