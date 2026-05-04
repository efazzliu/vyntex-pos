import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Zap,
  FileCheck,
  Receipt,
  Loader2,
} from "lucide-react";
import { usePosLocale } from "./pos-locale-provider.tsx";

type BulkFiscalizationProps = {
  licenseKey: string;
  staffId: string;
  staffName: string;
  staffRole: string;
};

export default function BulkFiscalizationSheet({
  licenseKey,
  staffId,
  staffName,
  staffRole,
}: BulkFiscalizationProps) {
  const { t, formatPrice } = usePosLocale();
  const nonFiscalOrders = useQuery('pos.orders.getNonFiscalOrders', {
    licenseKey,
  });
  const fiscalizeOrder = useMutation('pos.orders.fiscalizeOrderBulk');
  const logBulk = useMutation('pos.orders.logBulkFiscalization');

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const canAccess = staffRole === "admin" || staffRole === "manager";
  const orders = useMemo(() => nonFiscalOrders ?? [], [nonFiscalOrders]);

  const allSelected = orders.length > 0 && selected.size === orders.length;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => o._id as string)));
    }
  }, [allSelected, orders]);

  const toggleOrder = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleProcess = async () => {
    if (selected.size === 0) return;

    const orderIds = Array.from(selected);
    setProcessing(true);
    setProgress({ current: 0, total: orderIds.length });

    let successCount = 0;
    let errorCount = 0;
    let firstErrorMsg: string | null = null;

    // Process one-by-one for progress tracking (simulates sequential print commands)
    for (let i = 0; i < orderIds.length; i++) {
      try {
        const result = (await fiscalizeOrder({
          licenseKey,
          orderId: orderIds[i] as Id<"orders">,
          staffId: staffId as Id<"staff">,
        })) as { skipped?: boolean } | null;
        if (result && !result.skipped) {
          successCount++;
        }
      } catch (e) {
        errorCount++;
        if (!firstErrorMsg) firstErrorMsg = errorMessageFromUnknown(e);
      }
      setProgress({ current: i + 1, total: orderIds.length });
    }

    // Log the single audit entry for the bulk action
    if (successCount > 0) {
      try {
        await logBulk({
          licenseKey,
          staffId: staffId as Id<"staff">,
          staffName,
          count: successCount,
        });
      } catch {
        // Non-critical — don't block the success flow
      }
    }

    setProcessing(false);
    setSelected(new Set());
    setProgress({ current: 0, total: 0 });

    if (errorCount > 0) {
      toast.warning(
        t("dashboard.bulk_toast_warn", {
          success: successCount,
          failed: errorCount,
          detail: firstErrorMsg ? `: ${firstErrorMsg}` : "",
        }),
      );
    } else if (successCount > 0) {
      toast.success(
        t("dashboard.bulk_toast_ok", { count: successCount }),
      );
    } else {
      toast.info(t("dashboard.bulk_toast_skip"));
    }

    // If all orders were processed, close the sheet
    if (orders.length <= successCount + errorCount) {
      setOpen(false);
    }
  };

  if (!canAccess) return null;

  const nonFiscalCount = orders.length;

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setSelected(new Set());
          setProcessing(false);
          setProgress({ current: 0, total: 0 });
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          size="sm"
          disabled={nonFiscalCount === 0}
          className="bg-[#0066FF] hover:bg-[#0055DD] text-white text-xs font-semibold px-4 h-8"
        >
          <Zap className="size-3.5 mr-1.5" />
          {t("dashboard.bulk_fiscalize")}
          {nonFiscalCount > 0 && (
            <span className="ml-1.5 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {nonFiscalCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="bg-[#131A2E] border-[#1e2a45] text-white w-full sm:max-w-lg p-0 flex flex-col [&>button]:text-[#8b93a7]"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-[#1e2a45] shrink-0">
          <SheetTitle className="text-white text-lg flex items-center gap-2">
            <Zap className="size-5 text-[#0066FF]" />
            {t("dashboard.bulk_title")}
          </SheetTitle>
          <p className="text-sm text-[#8b93a7]">
            {t("dashboard.bulk_subtitle")}
          </p>
        </SheetHeader>

        {nonFiscalOrders === undefined ? (
          <div className="flex-1 p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 bg-[#0A0F1E] rounded-lg" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
            <FileCheck className="size-12 text-emerald-400/30" />
            <p className="text-[#8b93a7] text-sm text-center">
              {t("dashboard.bulk_all_done")}
            </p>
          </div>
        ) : (
          <>
            {/* Select All + count */}
            <div className="px-6 py-3 border-b border-[#1e2a45] flex items-center justify-between bg-[#0D1326]">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={processing}
                  className="border-[#3a4560] data-[state=checked]:bg-[#0066FF] data-[state=checked]:border-[#0066FF]"
                />
                <span className="text-sm text-[#c0c7d6] font-medium">
                  {t("dashboard.bulk_select_all")}
                </span>
              </label>
              <span className="text-xs text-[#5a6580]">
                {t("dashboard.bulk_selected_of", {
                  selected: selected.size,
                  total: orders.length,
                })}
              </span>
            </div>

            {/* Order list */}
            <div className="flex-1 overflow-y-auto">
              {orders.map((order) => (
                <label
                  key={order._id}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 border-b border-[#1e2a45]/40 cursor-pointer hover:bg-[#1a2240] transition-colors",
                    selected.has(order._id as string) && "bg-[#0066FF]/5"
                  )}
                >
                  <Checkbox
                    checked={selected.has(order._id as string)}
                    onCheckedChange={() => toggleOrder(order._id as string)}
                    disabled={processing}
                    className="border-[#3a4560] data-[state=checked]:bg-[#0066FF] data-[state=checked]:border-[#0066FF] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-white">
                        #{order.orderNumber}
                      </span>
                      <span className="text-xs text-[#5a6580]">
                        {order.tableName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#5a6580]">
                        {order.paidAt
                          ? format(new Date(order.paidAt), "dd MMM HH:mm")
                          : "—"}
                      </span>
                      <span className="text-[10px] text-[#3a4560]">|</span>
                      <span className="text-xs text-[#5a6580]">
                        {order.staffName}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white shrink-0">
                    {formatPrice(order.total)}
                  </span>
                </label>
              ))}
            </div>

            {/* Progress bar (shown during processing) */}
            {processing && (
              <div className="px-6 py-3 border-t border-[#1e2a45] bg-[#0D1326]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#0066FF] font-medium">
                    {t("dashboard.bulk_processing")}
                  </span>
                  <span className="text-xs text-white font-bold">
                    {t("dashboard.bulk_printing", {
                      current: progress.current,
                      total: progress.total,
                    })}
                  </span>
                </div>
                <div className="h-2.5 bg-[#1e2a45] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0066FF] transition-all duration-300"
                    style={{
                      width:
                        progress.total > 0
                          ? `${(progress.current / progress.total) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Action button */}
            <div className="px-6 py-4 border-t border-[#1e2a45] shrink-0">
              <Button
                onClick={handleProcess}
                disabled={selected.size === 0 || processing}
                className="w-full bg-[#0066FF] hover:bg-[#0055DD] text-white font-semibold h-12 text-sm"
              >
                {processing ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    {t("dashboard.bulk_processing")}
                  </>
                ) : (
                  <>
                    <Receipt className="size-4 mr-2" />
                    {selected.size === 1
                      ? t("dashboard.bulk_process", { count: selected.size })
                      : t("dashboard.bulk_process_plural", {
                          count: selected.size,
                        })}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
