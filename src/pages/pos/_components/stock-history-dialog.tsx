import { useQuery as useTanStackQuery } from "@tanstack/react-query";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { posQueryKey, runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription as EmptyDesc,
} from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Clock,
  TrendingDown,
  Minus,
  Pencil,
  Plus,
} from "lucide-react";

type StockHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  licenseKey: string;
  menuItemId: Id<"menuItems">;
  itemName: string;
};

const TYPE_LABELS: Record<string, string> = {
  manual_addition: "Manual Addition",
  manual_set: "Manual Set",
  sale: "Sale",
  adjustment: "Removal",
  reset: "Reset",
  staff_consumption: "Staff meal",
};

const TYPE_ICONS: Record<string, typeof Plus> = {
  manual_addition: Plus,
  manual_set: Pencil,
  sale: TrendingDown,
  adjustment: Minus,
  reset: Pencil,
  staff_consumption: TrendingDown,
};

type ItemLogRow = {
  _id: string;
  staffName: string;
  type: string;
  change: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

export default function StockHistoryDialog({
  open,
  onOpenChange,
  licenseKey,
  menuItemId,
  itemName,
}: StockHistoryDialogProps) {
  const enabled =
    open && Boolean(licenseKey?.trim()) && Boolean(String(menuItemId).trim());
  const logsQuery = useTanStackQuery({
    queryKey: posQueryKey("pos.stock.getItemLogs", { licenseKey, menuItemId }),
    queryFn: () =>
      runPosQuery("pos.stock.getItemLogs", {
        licenseKey,
        menuItemId,
      }) as Promise<ItemLogRow[]>,
    enabled,
    retry: 1,
  });
  const logs = logsQuery.data;
  const loading =
    enabled && logsQuery.data === undefined && logsQuery.isFetching;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-slate-200 bg-white p-0 text-slate-900 sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-200 bg-slate-50 pb-4">
          <SheetTitle className="flex items-center gap-2 text-slate-900">
            <Clock className="size-5 text-blue-500" />
            Stock History
          </SheetTitle>
          <SheetDescription className="text-slate-500">
            Movement log for{" "}
            <span className="font-medium text-slate-900">{itemName}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="max-h-[calc(100vh-112px)] flex-1 overflow-auto px-4 pb-4">
          {logsQuery.isError ? (
            <p className="py-4 text-center text-sm text-red-500">
              Could not load history.
            </p>
          ) : loading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg bg-slate-200" />
              ))}
            </div>
          ) : (logs ?? []).length === 0 ? (
            <div className="py-8">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Clock />
                  </EmptyMedia>
                  <EmptyTitle>No history yet</EmptyTitle>
                  <EmptyDesc>
                    Stock changes will appear here once you add or adjust
                    inventory
                  </EmptyDesc>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="space-y-1.5 py-2">
              {(logs ?? []).map((log) => {
                const Icon = TYPE_ICONS[log.type] ?? Pencil;
                const isPositive = log.change > 0;
                const isNegative = log.change < 0;
                const timestamp = new Date(log.createdAt);
                const dateStr = timestamp.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const timeStr = timestamp.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={log._id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        isPositive
                          ? "bg-emerald-500/15 text-emerald-600"
                          : isNegative
                            ? "bg-red-500/15 text-red-600"
                            : "bg-blue-500/15 text-blue-600",
                      )}
                    >
                      <Icon className="size-4" />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-900">
                          {TYPE_LABELS[log.type] ?? log.type}
                        </span>
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            isPositive
                              ? "text-emerald-600"
                              : isNegative
                                ? "text-red-600"
                                : "text-slate-500",
                          )}
                        >
                          {isPositive ? "+" : ""}
                          {log.change}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-[10px] text-slate-500">
                          {log.staffName} &middot; {dateStr} {timeStr}
                        </span>
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          Bal: {log.balanceAfter}
                        </span>
                      </div>

                      {log.note && (
                        <p className="mt-1 truncate text-[10px] text-slate-500">
                          {log.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
