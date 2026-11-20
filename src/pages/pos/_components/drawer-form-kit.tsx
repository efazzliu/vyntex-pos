import type { ReactNode } from "react";
import { CupSoda, Flame, Link2, Milk, Minus, Pizza, Plus, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils.ts";

/** Shared building blocks for the right-side settings drawers (Variants, Edit Product). */

/** Icon for a variant group, picked from its name. */
export function variantGroupIcon(name: string) {
  const n = name.toLowerCase();
  if (/size|madh/i.test(n)) return CupSoda;
  if (/cook|pjek|done|well/i.test(n)) return Flame;
  if (/crust|pizza|brum/i.test(n)) return Pizza;
  if (/milk|qum/i.test(n)) return Milk;
  if (/extra|shtes|topping/i.test(n)) return Link2;
  return SlidersHorizontal;
}

export function FormSection({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-[#e3ebf7] bg-white/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="mt-0.5 text-[#2563eb]">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-[#0b1220]">{title}</p>
          {subtitle ? <p className="text-[12px] text-[#64748b]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: ReactNode }[];
}) {
  return (
    <div
      className="grid gap-1 rounded-xl border border-[#e3ebf7] bg-[#f7f9fd] p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 text-[13px] font-semibold transition",
              active ? "bg-white text-[#0b1220] shadow-[0_2px_6px_-3px_rgba(15,23,42,0.35)]" : "text-[#334155] hover:bg-white/60",
            )}
          >
            {o.icon ? (
              <span style={{ color: active ? "#1d5ff0" : "#64748b" }}>{o.icon}</span>
            ) : (
              <span
                className="flex size-4 items-center justify-center rounded-full border-2"
                style={{ borderColor: active ? "#1d5ff0" : "#94a3b8" }}
              >
                {active ? <span className="size-2 rounded-full" style={{ backgroundColor: "#1d5ff0" }} /> : null}
              </span>
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Whole-number field with − / + buttons; the buttons never step outside the allowed range. */
export function NumberStepper({
  value,
  placeholder,
  disabled = false,
  invalid,
  canDecrease,
  canIncrease,
  decreaseLabel,
  increaseLabel,
  onStep,
  onType,
  onBlur,
}: {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  invalid: boolean;
  canDecrease: boolean;
  canIncrease: boolean;
  decreaseLabel: string;
  increaseLabel: string;
  onStep: (delta: -1 | 1) => void;
  onType: (value: string) => void;
  onBlur: () => void;
}) {
  const btn =
    "flex size-9 shrink-0 items-center justify-center rounded-lg text-[#0b1220] transition hover:bg-[#eef2fb] disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-1 rounded-xl border bg-white px-1 transition focus-within:ring-2",
        disabled && "bg-[#f7f9fd] opacity-60",
        invalid && !disabled ? "border-red-400 focus-within:ring-red-200" : "border-[#e3ebf7] focus-within:border-[#1d5ff0] focus-within:ring-[#1d5ff0]/15",
      )}
    >
      <button type="button" aria-label={decreaseLabel} disabled={!canDecrease} onClick={() => onStep(-1)} className={btn}>
        <Minus className="size-4" strokeWidth={2.4} />
      </button>
      <input
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="numeric"
        onChange={(e) => onType(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onBlur();
          } else if (e.key === "ArrowUp" && canIncrease) {
            e.preventDefault();
            onStep(1);
          } else if (e.key === "ArrowDown" && canDecrease) {
            e.preventDefault();
            onStep(-1);
          }
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-center text-[15px] font-semibold tabular-nums text-[#0b1220] outline-none placeholder:font-medium placeholder:text-[#94a3b8] disabled:cursor-not-allowed"
      />
      <button type="button" aria-label={increaseLabel} disabled={!canIncrease} onClick={() => onStep(1)} className={btn}>
        <Plus className="size-4" strokeWidth={2.4} />
      </button>
    </div>
  );
}

export function ToggleSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
      style={{ backgroundColor: checked ? "#1d5ff0" : "#d7dee9" }}
    >
      <span
        className="absolute top-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.35)] transition-all"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}
