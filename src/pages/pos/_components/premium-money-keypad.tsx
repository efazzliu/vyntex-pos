import { useEffect } from "react";
import { Delete, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";

function appendMoneyKey(
  prev: string,
  key: string,
  maxDecimals: number,
): string {
  if (key === "clear") return "";
  if (key === "bksp") return prev.slice(0, -1);
  if (key === ".") {
    if (maxDecimals <= 0) return prev;
    if (prev.includes(".")) return prev;
    return prev === "" ? "0." : `${prev}.`;
  }
  if (!/^\d$/.test(key)) return prev;
  const next = prev + key;
  const frac = next.split(".")[1];
  if (frac !== undefined && frac.length > maxDecimals) return prev;
  if (prev === "0" && !prev.includes(".")) return key;
  return next;
}

export default function PremiumMoneyKeypad({
  value,
  amountDue,
  maxDecimals,
  onChange,
  onClose,
  onComplete,
  replaceNext,
  onConsumedReplace,
  isSubmitting = false,
}: {
  value: string;
  amountDue: number;
  maxDecimals: number;
  onChange: (value: string) => void;
  onClose: () => void;
  onComplete?: () => void;
  replaceNext: boolean;
  onConsumedReplace: () => void;
  isSubmitting?: boolean;
}) {
  const { t, currency } = usePosLocale();
  const received = parseFloat(String(value).replace(",", ".")) || 0;
  const hasAmount = value.trim() !== "";
  const change =
    hasAmount && received + 0.0001 >= amountDue
      ? Math.round((received - amountDue) * 100) / 100
      : 0;
  const display = hasAmount ? value : (0).toFixed(maxDecimals);

  const press = (key: string) => {
    if (key === "clear") {
      onChange("");
      onConsumedReplace();
      return;
    }
    if (replaceNext && /^\d$/.test(key)) {
      onConsumedReplace();
      onChange(key);
      return;
    }
    if (replaceNext && key === ".") {
      onConsumedReplace();
      onChange(maxDecimals > 0 ? "0." : "");
      return;
    }
    onChange(appendMoneyKey(value, key, maxDecimals));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        onComplete?.();
        return;
      }
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        press(event.key);
        return;
      }
      if (event.key === "." || event.key === ",") {
        event.preventDefault();
        press(".");
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        press("bksp");
        return;
      }
      if (event.key === "Delete") {
        event.preventDefault();
        press("clear");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const keyClass =
    "flex h-12 items-center justify-center rounded-[1.05rem] bg-white text-[21px] font-semibold tabular-nums text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_10px_22px_-14px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/80 transition-[transform,background-color,box-shadow] active:scale-[0.97] active:bg-slate-50 active:shadow-none disabled:opacity-40";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-5">
      <button
        type="button"
        aria-label={t("btn.close")}
        onClick={onClose}
        className="absolute inset-0 border-0 bg-slate-950/45 backdrop-blur-[10px]"
      />
      <div className="relative w-full max-w-[360px] rounded-[28px] border border-white/80 bg-white px-4 pb-4 pt-4 shadow-[0_28px_80px_rgba(15,23,42,0.32)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {t("order.cash_enter_amount_title")}
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-slate-500">
              {t("order.cash_amount_due")} {currency.symbol}
              {amountDue.toFixed(maxDecimals)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
            aria-label={t("btn.close")}
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="rounded-2xl bg-[linear-gradient(180deg,#f8fbff_0%,#eef3fb_100%)] px-4 py-4 ring-1 ring-slate-200/80">
          <p className="flex items-end gap-1.5 text-slate-950">
            <span className="mb-1 text-[18px] font-medium text-slate-400">
              {currency.symbol}
            </span>
            <span className="text-[2.7rem] font-semibold leading-none tracking-[-0.05em] tabular-nums">
              {display}
            </span>
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-slate-500">
              {t("order.pay_change")}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums",
                change > 0
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-white text-slate-400 ring-1 ring-slate-200",
              )}
            >
              {currency.symbol}
              {change.toFixed(maxDecimals)}
            </span>
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {(["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const).map(
            (key) => (
              <button
                key={key}
                type="button"
                disabled={isSubmitting}
                onPointerDown={(event) => {
                  event.preventDefault();
                  press(key);
                }}
                className={keyClass}
              >
                {key}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={isSubmitting}
            onPointerDown={(event) => {
              event.preventDefault();
              press("clear");
            }}
            className={cn(keyClass, "text-[13px] font-semibold text-slate-500")}
          >
            {t("order.numpad_clear")}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onPointerDown={(event) => {
              event.preventDefault();
              press("0");
            }}
            className={keyClass}
          >
            0
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onPointerDown={(event) => {
              event.preventDefault();
              press("bksp");
            }}
            className={keyClass}
            aria-label={t("btn.back")}
          >
            <Delete className="size-5 text-slate-500" strokeWidth={1.75} />
          </button>
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={onComplete}
          className="mt-3.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[15px] font-semibold text-[#f8fafc] shadow-[0_14px_28px_-12px_rgba(0,91,214,0.75)] transition hover:bg-brand-hover disabled:opacity-50"
        >
          <Wallet className="size-4 text-[#f8fafc]" strokeWidth={1.75} />
          {isSubmitting ? t("common.loading") : t("order.pay_complete")}
        </button>
      </div>
    </div>
  );
}
