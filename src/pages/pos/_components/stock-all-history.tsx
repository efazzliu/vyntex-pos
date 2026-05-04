import { useQuery as useTanStackQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { ArrowLeft, Clock, AlertTriangle } from "lucide-react";
import { posQueryKey, runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";

type LogRow = {
  _id: string;
  staffName: string;
  type: string;
  change: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  itemName: string;
};

type StockAllHistoryProps = {
  licenseKey: string;
  onBack: () => void;
};

export default function StockAllHistory({
  licenseKey,
  onBack,
}: StockAllHistoryProps) {
  const enabled = Boolean(licenseKey?.trim());
  const logsQuery = useTanStackQuery({
    queryKey: posQueryKey("pos.stock.getAllLogs", { licenseKey }),
    queryFn: () =>
      runPosQuery("pos.stock.getAllLogs", { licenseKey }) as Promise<LogRow[]>,
    enabled,
    retry: 1,
  });

  const logs = logsQuery.data;
  const loading =
    enabled && logsQuery.data === undefined && logsQuery.isFetching;

  return (
    <div className="p-4 md:p-6 space-y-5 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-[#8b93a7] hover:text-white"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="size-5 md:size-6 text-blue-400" />
            Stock History
          </h1>
          <p className="text-sm text-[#5a6580] mt-0.5">
            All inventory movements across every product
          </p>
        </div>
      </div>

      {!enabled ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Missing license</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : logsQuery.isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle className="text-amber-400" />
            </EmptyMedia>
            <EmptyTitle>Could not load history</EmptyTitle>
            <EmptyDescription className="max-w-md">
              {errorMessageFromUnknown(
                logsQuery.error,
                "Check Supabase and pos_stock_logs table.",
              )}
            </EmptyDescription>
          </EmptyHeader>
          <Button
            className="mt-4 mx-auto"
            onClick={() => void logsQuery.refetch()}
          >
            Retry
          </Button>
        </Empty>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
      ) : (logs ?? []).length === 0 ? (
        <div className="py-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Clock />
              </EmptyMedia>
              <EmptyTitle>No stock history yet</EmptyTitle>
              <EmptyDescription>
                Stock changes will appear here once you add, remove, or adjust
                inventory
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="space-y-1.5">
          {(logs ?? []).map((log) => {
            const isPositive = log.change > 0;
            const isNegative = log.change < 0;
            const ts = new Date(log.createdAt);
            const datePart = `${String(ts.getMonth() + 1).padStart(2, "0")}/${String(ts.getDate()).padStart(2, "0")}`;
            const timePart = `${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}`;

            const changeLabel = isPositive
              ? `+${log.change}`
              : `${log.change}`;

            return (
              <div
                key={log._id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#131A2E] border border-[#1e2a45]/60"
              >
                {/* Timestamp */}
                <div className="shrink-0 w-[72px] text-center">
                  <span className="text-xs text-[#5a6580] tabular-nums">
                    {datePart}
                  </span>
                  <span className="text-[10px] text-[#3a4055] mx-1">|</span>
                  <span className="text-xs text-[#8b93a7] tabular-nums font-medium">
                    {timePart}
                  </span>
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-[#1e2a45] shrink-0" />

                {/* Staff */}
                <div className="shrink-0 w-[100px] md:w-[130px] truncate">
                  <span className="text-xs text-[#8b93a7] font-medium">
                    {log.staffName}
                  </span>
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-[#1e2a45] shrink-0 hidden md:block" />

                {/* Action & Item */}
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums mr-1.5",
                      isPositive
                        ? "text-emerald-400"
                        : isNegative
                          ? "text-red-400"
                          : "text-blue-400",
                    )}
                  >
                    {changeLabel}
                  </span>
                  <span className="text-sm text-white truncate">
                    {log.itemName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
