import { useMemo, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ChefHat, Wine } from "lucide-react";
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

export type SplitBillGroupedLine = {
  key: string;
  name: string;
  price: number;
  totalQuantity: number;
  station?: "kitchen" | "bar";
  notes?: string;
  /** Underlying `sale_items.id` values (Supabase) for this merged row. */
  itemIds: string[];
};

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
    if (existing) {
      existing.totalQuantity += item.quantity;
      existing.itemIds.push(String(item._id));
    } else {
      grouped.push({
        key,
        name: item.name,
        price: item.price,
        totalQuantity: item.quantity,
        station: item.station,
        notes: item.notes,
        itemIds: [String(item._id)],
      });
    }
  }
  return grouped;
}

type SplitBillItemPickerProps = {
  licenseKey: string;
  orderId: string;
  orderBalanceDue: number;
  showManualAmountLink: boolean;
  onManualAmount: () => void;
  onBack: () => void;
  onContinue: (amount: number, settledSaleItemIds: string[]) => void;
};

export default function SplitBillItemPicker({
  licenseKey,
  orderId,
  orderBalanceDue,
  showManualAmountLink,
  onManualAmount,
  onBack,
  onContinue,
}: SplitBillItemPickerProps) {
  const { t, formatPrice } = usePosLocale();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

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

  const selectedTotal = useMemo(() => {
    let s = 0;
    for (const g of grouped) {
      if (selectedKeys.has(g.key)) {
        s += g.price * g.totalQuantity;
      }
    }
    return Math.round(s * 100) / 100;
  }, [grouped, selectedKeys]);

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(grouped.map((g) => g.key)));
  }, [grouped]);

  const clearAll = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const eps = 0.009;

  const handleContinue = () => {
    if (selectedTotal <= 0) {
      toast.error(t("order.split_pick_empty"));
      return;
    }
    if (selectedTotal > orderBalanceDue + eps) {
      toast.error(t("order.split_pick_over"));
      return;
    }
    const settledIds = grouped
      .filter((g) => selectedKeys.has(g.key))
      .flatMap((g) => g.itemIds);
    onContinue(selectedTotal, settledIds);
  };

  if (!orderData) {
    return (
      <div className="flex flex-1 items-center justify-center px-3 py-8 text-sm text-[#8b93a7]">
        {t("common.loading")}
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-3 px-3 py-4">
        <p className="text-sm text-[#8b93a7]">{t("order.split_pick_no_lines")}</p>
        <Button type="button" variant="ghost" className="text-[#8b93a7]" onClick={onBack}>
          {t("btn.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col px-3 py-2 gap-3 overflow-hidden">
      <div className="shrink-0 space-y-1 text-xs text-[#8b93a7]">
        <p>
          {t("order.balance_due")}:{" "}
          <span className="font-bold text-white">{formatPrice(orderBalanceDue)}</span>
        </p>
        <p className="text-[11px] text-[#5a6580]">{t("order.split_pick_hint")}</p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 border-[#2a3a5a] text-xs text-[#8b93a7] hover:text-white"
          onClick={selectAll}
        >
          {t("order.split_pick_all")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 border-[#2a3a5a] text-xs text-[#8b93a7] hover:text-white"
          onClick={clearAll}
        >
          {t("order.split_pick_clear")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {grouped.map((g) => {
          const on = selectedKeys.has(g.key);
          const lineTotal = Math.round(g.price * g.totalQuantity * 100) / 100;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => toggleKey(g.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors",
                on
                  ? "border-[#0066FF] bg-[#0066FF]/15"
                  : "border-[#1e2a45] bg-[#0A0F1E] hover:border-[#2a3a5a]",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none",
                  on
                    ? "border-[#0066FF] bg-[#0066FF] text-white"
                    : "border-[#3a4560] bg-[#131A2E]",
                )}
              >
                {on ? "✓" : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm text-white">{g.name}</p>
                  {g.station === "kitchen" ? (
                    <ChefHat className="size-3 shrink-0 text-orange-400" />
                  ) : g.station === "bar" ? (
                    <Wine className="size-3 shrink-0 text-purple-400" />
                  ) : null}
                </div>
                {g.notes ? (
                  <p className="mt-0.5 truncate text-[10px] italic text-amber-400/90">
                    {g.notes}
                  </p>
                ) : null}
                <p className="mt-0.5 text-[11px] text-[#5a6580]">
                  {formatPrice(g.price)} × {g.totalQuantity}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-white">
                {formatPrice(lineTotal)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="shrink-0 space-y-2 border-t border-[#1e2a45] pt-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#8b93a7]">{t("order.split_pick_selected_total")}</span>
          <span className="font-mono font-semibold text-white">
            {formatPrice(selectedTotal)}
          </span>
        </div>
        <p className="text-[10px] text-[#5a6580]">{t("order.split_restrict_hint")}</p>
        {showManualAmountLink ? (
          <button
            type="button"
            onClick={onManualAmount}
            className="w-full text-center text-xs text-[#0066FF] underline-offset-2 hover:underline"
          >
            {t("order.split_by_amount")}
          </button>
        ) : null}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 text-[#8b93a7]"
            onClick={onBack}
          >
            {t("btn.back")}
          </Button>
          <Button type="button" className="flex-1" onClick={handleContinue}>
            {t("order.split_continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}
