import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

export function SettingsRow({
  label,
  hint,
  children,
  className,
  wide,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  /** Stretch control area on wide layouts (e.g. login history). */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-slate-100 py-4 last:border-0 dark:border-slate-700/80 sm:flex-row sm:justify-between sm:gap-8",
        wide ? "sm:items-start" : "sm:items-center",
        className,
      )}
    >
      <div className="min-w-0 sm:max-w-md sm:shrink-0 lg:max-w-sm xl:max-w-md">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      </div>
      <div
        className={cn(
          "min-w-0 w-full",
          wide ? "sm:flex-1 lg:max-w-3xl xl:max-w-4xl" : "sm:max-w-md sm:flex-1 sm:justify-end",
        )}
      >
        {children}
      </div>
    </div>
  );
}
