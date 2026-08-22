import { cn } from "@/lib/utils.ts";
import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

export const acCard =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(15,23,42,0.12)]";

export const acCardHover =
  "transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-[0_12px_32px_-16px_rgba(37,99,235,0.22)]";

export function AdminPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>
      {children}
    </div>
  );
}

export function GrowthBadge({
  value,
  suffix,
}: {
  value: number;
  suffix?: string;
}) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
        up ? "text-emerald-600" : "text-rose-600",
      )}
    >
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {up ? "+" : ""}
      {value.toFixed(1)}%{suffix ? <span className="font-medium text-slate-400">{suffix}</span> : null}
    </span>
  );
}

export function MiniSpark({
  points,
  className,
  color = "#4F6BFF",
}: {
  points: number[];
  className?: string;
  color?: string;
}) {
  const width = 120;
  const height = 36;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(max - min, 1);
  const coords = points.map((value, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
    const y = height - ((value - min) / span) * (height - 6) - 3;
    return `${x},${y}`;
  });
  const area = `0,${height} ${coords.join(" ")} ${width},${height}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-9 w-[120px] overflow-visible", className)}
      aria-hidden
    >
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatusDot({
  health,
  label,
}: {
  health: "active" | "expiring" | "expired";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        health === "active" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
        health === "expiring" && "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
        health === "expired" && "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          health === "active" && "bg-emerald-500",
          health === "expiring" && "bg-amber-500",
          health === "expired" && "bg-rose-500",
        )}
      />
      {label}
    </span>
  );
}
