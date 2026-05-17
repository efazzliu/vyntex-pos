import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";

export function SettingsRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-slate-100 py-3.5 last:border-0 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 sm:w-[42%]">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
      </div>
      <div className="w-full sm:w-[min(100%,320px)] sm:shrink-0">{children}</div>
    </div>
  );
}
