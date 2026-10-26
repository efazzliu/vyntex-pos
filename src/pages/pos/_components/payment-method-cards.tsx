import { Banknote, Check, CreditCard, QrCode } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { PaymentMethodId } from "@/lib/pos-payment-handling.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

const METHOD_META: Record<
  PaymentMethodId,
  {
    titleKey: string;
    subKey: string;
    icon: typeof Banknote;
  }
> = {
  cash: {
    titleKey: "order.pay_method_cash",
    subKey: "order.pay_method_cash_sub",
    icon: Banknote,
  },
  card: {
    titleKey: "order.pay_method_card",
    subKey: "order.pay_method_card_sub",
    icon: CreditCard,
  },
  qr: {
    titleKey: "order.pay_method_qr",
    subKey: "order.pay_method_qr_sub",
    icon: QrCode,
  },
};

export default function PaymentMethodCards({
  methods,
  selected,
  disabled = false,
  compact = false,
  onSelect,
}: {
  methods: PaymentMethodId[];
  selected: PaymentMethodId | null;
  disabled?: boolean;
  compact?: boolean;
  onSelect: (method: PaymentMethodId) => void;
}) {
  const { t } = usePosLocale();
  const cols =
    methods.length <= 1
      ? "grid-cols-1"
      : methods.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className={cn("grid gap-2", cols)}>
      {methods.map((method) => {
        const meta = METHOD_META[method];
        const Icon = meta.icon;
        const on = selected === method;
        return (
          <button
            key={method}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(method)}
            className={cn(
              "group relative box-border overflow-hidden text-left transition-all duration-200 ease-out",
              compact
                ? "flex items-center gap-2 rounded-xl px-2.5 py-2.5"
                : "flex min-h-[7.25rem] flex-col items-start justify-between rounded-[1.15rem] px-3.5 py-3.5",
              "border-2 border-slate-200/80 bg-slate-50/80",
              "hover:border-slate-300 hover:bg-white",
              "disabled:cursor-default disabled:opacity-45",
              on && "border-brand bg-[#f4f8ff]",
            )}
          >
            {compact ? null : (
              <span
                className={cn(
                  "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200",
                  on &&
                    "opacity-100 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(59,130,246,0.10),transparent_58%),radial-gradient(90%_70%_at_100%_100%,rgba(139,92,246,0.06),transparent_55%)]",
                )}
              />
            )}
            {!compact && on ? (
              <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-brand text-[#f8fafc] shadow-[0_0_10px_rgba(59,130,246,0.45)]">
                <Check className="size-3 text-[#f8fafc]" strokeWidth={3} />
              </span>
            ) : null}
            <span
              className={cn(
                "relative grid shrink-0 place-items-center ring-1 transition-colors",
                compact ? "size-8 rounded-xl" : "size-10 rounded-2xl",
                on
                  ? "bg-brand/10 text-brand ring-brand/25"
                  : "bg-white text-slate-500 ring-slate-200 group-hover:text-slate-800",
              )}
            >
              <Icon className={cn(compact ? "size-4" : "size-5")} strokeWidth={1.75} />
            </span>
            <span className={cn("relative min-w-0", !compact && "mt-3")}>
              <span
                className={cn(
                  "block truncate font-semibold tracking-tight",
                  compact ? "text-[13px]" : "text-[15px]",
                  on ? "text-slate-950" : "text-slate-800",
                )}
              >
                {t(meta.titleKey)}
              </span>
              <span
                className={cn(
                  "mt-0.5 block truncate leading-snug",
                  compact ? "text-[10px]" : "text-[11px]",
                  on ? "text-brand" : "text-slate-400",
                )}
              >
                {t(meta.subKey)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
