import { cn } from "@/lib/utils.ts";

/** Single radius + border for every admin card, panel, and table shell. */
export const adminCardClass = cn(
  "overflow-hidden rounded-xl border border-slate-200 bg-white",
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.08)]",
  "dark:border-slate-800 dark:bg-slate-950",
);

export const adminHeroClass = cn(
  adminCardClass,
  "relative bg-gradient-to-br from-white via-slate-50/90 to-blue-50/40 p-5",
  "dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/80",
);

export const adminKpiCardClass = cn(adminCardClass, "p-5");

export const adminTableShellClass =
  "overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800";

export const adminPanelDividerClass = "border-b border-slate-200 dark:border-slate-800";

export const adminPanelHeaderClass =
  "flex w-full items-center gap-2 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/60";

export const adminBadgeClass = cn(
  "inline-flex h-5 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2",
  "text-[9px] font-medium leading-none text-slate-600",
  "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
);

export const adminBackLinkClass = cn(
  adminCardClass,
  "inline-flex h-8 w-fit items-center gap-1.5 px-3 text-xs font-medium text-slate-600",
  "transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900/60",
);

export const adminOutlineButtonClass = cn(
  "h-8 shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs shadow-none",
  "hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/60",
);

export const adminInputClass =
  "h-9 rounded-lg border-slate-200 bg-white text-xs dark:border-slate-800 dark:bg-slate-950";

export const adminPageSectionClass = "space-y-4 px-6 pb-6 pt-0 lg:px-8 lg:pb-8";
