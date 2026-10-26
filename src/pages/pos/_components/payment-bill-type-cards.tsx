import { Receipt, Split } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

export type BillTypeId = "full" | "split";

export default function PaymentBillTypeCards({
  selected,
  splitEnabled = true,
  disabled = false,
  onSelect,
}: {
  selected?: BillTypeId | null;
  splitEnabled?: boolean;
  disabled?: boolean;
  onSelect: (type: BillTypeId) => void;
}) {
  const { t } = usePosLocale();
  const cards: {
    id: BillTypeId;
    titleKey: string;
    subKey: string;
    icon: typeof Receipt;
  }[] = [
    {
      id: "full",
      titleKey: "order.pay_full_bill",
      subKey: "order.pay_full_bill_sub",
      icon: Receipt,
    },
    {
      id: "split",
      titleKey: "order.pay_split_bill",
      subKey: "order.pay_split_bill_sub",
      icon: Split,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((card) => {
        const Icon = card.icon;
        const on = selected === card.id;
        const locked = disabled || (card.id === "split" && !splitEnabled);
        return (
          <button
            key={card.id}
            type="button"
            disabled={locked}
            onClick={() => onSelect(card.id)}
            className={cn(
              "group relative box-border flex items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-all duration-200 ease-out",
              "border-2 border-slate-200/80 bg-slate-50/80",
              "hover:border-slate-300 hover:bg-white",
              "disabled:cursor-default disabled:opacity-45",
              on && "border-brand bg-[#f4f8ff]",
            )}
          >
            <span
              className={cn(
                "relative grid size-8 shrink-0 place-items-center rounded-xl ring-1 transition-colors",
                on
                  ? "bg-brand/10 text-brand ring-brand/25"
                  : "bg-white text-slate-500 ring-slate-200 group-hover:text-slate-800",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <span className="relative min-w-0">
              <span
                className={cn(
                  "block truncate text-[13px] font-semibold tracking-tight",
                  on ? "text-slate-950" : "text-slate-800",
                )}
              >
                {t(card.titleKey)}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate text-[10px] leading-snug",
                  on ? "text-brand" : "text-slate-400",
                )}
              >
                {t(card.subKey)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
