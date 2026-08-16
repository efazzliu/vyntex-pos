import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import {
  DEMO_CATEGORIES,
  DEMO_MENU_ITEMS,
  TAX_RATE,
  type DemoOrderLine,
  type DemoTable,
} from "../_data.ts";

export default function DemoOrderPanel({
  table,
  onBack,
  onCharged,
}: {
  table: DemoTable;
  onBack: () => void;
  onCharged: () => void;
}) {
  const [category, setCategory] = useState<(typeof DEMO_CATEGORIES)[number]>("Starters");
  const [lines, setLines] = useState<DemoOrderLine[]>([]);
  const [charging, setCharging] = useState(false);
  const [charged, setCharged] = useState(false);

  const itemsInCategory = DEMO_MENU_ITEMS.filter((i) => i.category === category);

  const addItem = (itemId: string) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === itemId);
      if (existing) {
        return prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { itemId, qty: 1 }];
    });
  };

  const changeQty = (itemId: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  };

  const removeLine = (itemId: string) => {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const cartRows = useMemo(
    () =>
      lines
        .map((line) => {
          const item = DEMO_MENU_ITEMS.find((i) => i.id === line.itemId);
          if (!item) return null;
          return { ...line, item };
        })
        .filter((row): row is DemoOrderLine & { item: (typeof DEMO_MENU_ITEMS)[number] } => Boolean(row)),
    [lines],
  );

  const subtotal = cartRows.reduce((sum, row) => sum + row.item.price * row.qty, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  const charge = () => {
    if (cartRows.length === 0) return;
    setCharging(true);
    window.setTimeout(() => {
      setCharging(false);
      setCharged(true);
      window.setTimeout(() => {
        onCharged();
      }, 1400);
    }, 900);
  };

  if (charged) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <CheckCircle2 className="size-14 text-emerald-400" />
        <p className="text-lg font-semibold text-white">Payment received</p>
        <p className="text-sm text-[#8b93a7]">
          {table.label} · ${total.toFixed(2)} charged
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row">
      <div className="flex-1 border-b border-[#1e2a45] p-4 sm:p-6 md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex size-8 items-center justify-center rounded-lg border border-[#1e2a45] text-[#8b93a7] hover:bg-[#131A2E] hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <p className="text-sm font-semibold text-white">{table.label}</p>
            <p className="text-[11px] text-[#8b93a7]">New order</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {DEMO_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                category === cat
                  ? "border-[#0066FF] bg-[#0066FF] text-white"
                  : "border-[#1e2a45] bg-[#131A2E] text-[#8b93a7] hover:text-white",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {itemsInCategory.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!item.available}
              onClick={() => addItem(item.id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border border-[#1e2a45] bg-[#131A2E] p-3 text-left transition-colors hover:border-[#0066FF]/50 hover:bg-[#0066FF]/5",
                !item.available && "cursor-not-allowed opacity-40 hover:border-[#1e2a45] hover:bg-[#131A2E]",
              )}
            >
              <span className="text-xl">{item.emoji}</span>
              <span className="text-xs font-medium text-white">{item.name}</span>
              <span className="text-[11px] font-semibold text-[#0066FF]">${item.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col p-4 sm:p-6 md:w-[320px] md:shrink-0">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8b93a7]">Current order</p>
        <div className="min-h-[120px] flex-1 space-y-2 overflow-auto">
          {cartRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#1e2a45] px-3 py-6 text-center text-xs text-[#5a6580]">
              Tap items to add them to this order.
            </p>
          ) : (
            cartRows.map((row) => (
              <div
                key={row.itemId}
                className="flex items-center gap-2 rounded-lg border border-[#1e2a45] bg-[#131A2E] px-2.5 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">
                  {row.item.name}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeQty(row.itemId, -1)}
                    className="flex size-5 items-center justify-center rounded-md bg-[#1e2a45] text-[#8b93a7] hover:text-white"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-4 text-center text-xs font-semibold text-white">{row.qty}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(row.itemId, 1)}
                    className="flex size-5 items-center justify-center rounded-md bg-[#1e2a45] text-[#8b93a7] hover:text-white"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <span className="w-12 shrink-0 text-right text-xs font-semibold text-white">
                  ${(row.item.price * row.qty).toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(row.itemId)}
                  className="shrink-0 text-[#5a6580] hover:text-red-400"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 space-y-1.5 border-t border-[#1e2a45] pt-3 text-xs text-[#8b93a7]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="text-white">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax (10%)</span>
            <span className="text-white">${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-white">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <Button
          disabled={cartRows.length === 0 || charging}
          onClick={charge}
          className="mt-4 h-11 w-full rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-sm font-semibold text-white hover:opacity-90"
        >
          {charging ? "Charging…" : `Charge $${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
