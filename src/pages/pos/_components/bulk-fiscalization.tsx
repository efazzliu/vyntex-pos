import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { enUS, sq as sqDateLocale } from "date-fns/locale";
import {
  Zap,
  FileCheck,
  Receipt,
  Loader2,
} from "lucide-react";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";

type BulkFiscalizationProps = {
  licenseKey: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  compact?: boolean;
};

export default function BulkFiscalizationSheet({
  licenseKey,
  staffId,
  staffName,
  staffRole,
  compact = false,
}: BulkFiscalizationProps) {
  const { t, formatPrice, language } = usePosLocale();
  const { theme } = usePosTheme();
  const light = theme === "light";
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
          className={
            compact
              ? "h-8 w-full rounded-xl bg-emerald-600 px-3 text-[10px] font-bold text-[#ffffff] shadow-[0_8px_18px_-10px_rgba(5,150,105,0.9)] hover:bg-emerald-700 hover:text-[#ffffff]"
              : "h-8 bg-teal-600 px-4 text-xs font-semibold text-[#ffffff] shadow-sm hover:bg-teal-700 hover:text-[#ffffff]"
          }
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
        data-pos-theme={theme}
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 p-0 sm:max-w-lg",
          light
            ? "border-slate-200/80 bg-[linear-gradient(165deg,#f8fafc_0%,#ffffff_32%,#f1f5f9_100%)] text-slate-900 [&>button:last-of-type]:rounded-lg [&>button:last-of-type]:border [&>button:last-of-type]:border-slate-200 [&>button:last-of-type]:bg-white [&>button:last-of-type]:text-slate-500 [&>button:last-of-type]:shadow-sm [&>button:last-of-type]:hover:text-slate-800"
            : "border-[#1e2a45] bg-[#131A2E] text-white [&>button:last-of-type]:text-[#8b93a7]",
        )}
      >
        <SheetHeader
          className={cn(
            "relative shrink-0 space-y-1 px-5 pb-4 pt-5 pr-14 text-left",
            light ? "border-b border-slate-200/80" : "border-b border-[#1e2a45]",
          )}
        >
          {light ? (
            <span
              className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
              aria-hidden
            />
          ) : null}
          <SheetTitle
            className={cn(
              "flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.02em]",
              light ? "text-slate-950" : "text-white",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                light
                  ? "border border-white bg-white text-emerald-700 shadow-[0_8px_18px_-10px_rgba(5,150,105,0.85)] ring-1 ring-emerald-600/10"
                  : "bg-brand/15 text-brand",
              )}
            >
              <Zap className="size-4" />
            </span>
            {t("dashboard.bulk_title")}
          </SheetTitle>
          <SheetDescription
            className={cn(
              "text-[12px]",
              light ? "text-slate-400" : "text-[#8b93a7]",
            )}
          >
            {t("dashboard.bulk_subtitle")}
          </SheetDescription>
        </SheetHeader>

        {nonFiscalOrders === undefined ? (
          <div className="flex-1 space-y-2.5 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  "h-16 rounded-2xl",
                  light ? "bg-slate-100" : "bg-[#0A0F1E]",
                )}
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
            <span
              className={cn(
                "flex size-14 items-center justify-center rounded-2xl",
                light
                  ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/10"
                  : "bg-emerald-400/10 text-emerald-400/40",
              )}
            >
              <FileCheck className="size-7" />
            </span>
            <p
              className={cn(
                "text-center text-sm font-medium",
                light ? "text-slate-500" : "text-[#8b93a7]",
              )}
            >
              {t("dashboard.bulk_all_done")}
            </p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex shrink-0 items-center justify-between px-5 py-3",
                light
                  ? "border-b border-slate-200/80 bg-white/80"
                  : "border-b border-[#1e2a45] bg-[#0D1326]",
              )}
            >
              <label className="flex cursor-pointer select-none items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={processing}
                  className={cn(
                    light
                      ? "border-slate-300 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                      : "border-[#3a4560] data-[state=checked]:border-brand data-[state=checked]:bg-brand",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-semibold",
                    light ? "text-slate-700" : "text-[#c0c7d6]",
                  )}
                >
                  {t("dashboard.bulk_select_all")}
                </span>
              </label>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums",
                  light
                    ? "bg-slate-100 text-slate-500"
                    : "text-[#5a6580]",
                )}
              >
                {t("dashboard.bulk_selected_of", {
                  selected: selected.size,
                  total: orders.length,
                })}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto no-scrollbar px-4 py-3">
              {orders.map((order) => {
                const isSelected = selected.has(order._id as string);
                return (
                  <label
                    key={order._id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 transition",
                      light
                        ? isSelected
                          ? "border-emerald-200 bg-emerald-50/80 shadow-[0_10px_24px_-18px_rgba(5,150,105,0.55)]"
                          : "border-slate-200/80 bg-white/90 hover:border-emerald-200 hover:bg-white"
                        : isSelected
                          ? "border-brand/20 bg-brand/5"
                          : "border-transparent hover:bg-[#1a2240]",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOrder(order._id as string)}
                      disabled={processing}
                      className={cn(
                        "shrink-0",
                        light
                          ? "border-slate-300 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                          : "border-[#3a4560] data-[state=checked]:border-brand data-[state=checked]:bg-brand",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-mono text-sm font-bold tabular-nums",
                            light ? "text-slate-950" : "text-white",
                          )}
                        >
                          #{order.orderNumber}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            light
                              ? "bg-slate-100 text-slate-500"
                              : "text-[#5a6580]",
                          )}
                        >
                          {order.tableName}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "mt-1 flex items-center gap-2 text-[11px]",
                          light ? "text-slate-400" : "text-[#5a6580]",
                        )}
                      >
                        <span>
                          {order.paidAt
                            ? format(new Date(order.paidAt), "dd MMM HH:mm", {
                                locale:
                                  language === "sq" ? sqDateLocale : enUS,
                              })
                            : "—"}
                        </span>
                        <span className={light ? "text-slate-300" : "text-[#3a4560]"}>
                          |
                        </span>
                        <span>{order.staffName}</span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-extrabold tabular-nums",
                        light ? "text-slate-950" : "text-white",
                      )}
                    >
                      {formatPrice(order.total)}
                    </span>
                  </label>
                );
              })}
            </div>

            {processing ? (
              <div
                className={cn(
                  "shrink-0 px-5 py-3",
                  light
                    ? "border-t border-slate-200/80 bg-white/90"
                    : "border-t border-[#1e2a45] bg-[#0D1326]",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      light ? "text-emerald-700" : "text-brand",
                    )}
                  >
                    {t("dashboard.bulk_processing")}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold tabular-nums",
                      light ? "text-slate-700" : "text-white",
                    )}
                  >
                    {t("dashboard.bulk_printing", {
                      current: progress.current,
                      total: progress.total,
                    })}
                  </span>
                </div>
                <div
                  className={cn(
                    "h-2 overflow-hidden rounded-full",
                    light ? "bg-slate-100" : "bg-[#1e2a45]",
                  )}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      light ? "bg-emerald-600" : "bg-brand",
                    )}
                    style={{
                      width:
                        progress.total > 0
                          ? `${(progress.current / progress.total) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div
              className={cn(
                "shrink-0 px-5 pt-3",
                light
                  ? "border-t border-slate-200/80 bg-white/95 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                  : "border-t border-[#1e2a45] pb-4",
              )}
            >
              <Button
                onClick={handleProcess}
                disabled={selected.size === 0 || processing}
                className={cn(
                  "h-12 w-full text-sm font-bold",
                  light
                    ? "rounded-xl bg-emerald-600 text-[#ffffff] shadow-[0_12px_24px_-12px_rgba(5,150,105,0.85)] hover:bg-emerald-700 hover:text-[#ffffff]"
                    : "bg-brand text-white hover:bg-brand-hover",
                )}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t("dashboard.bulk_processing")}
                  </>
                ) : (
                  <>
                    <Receipt className="mr-2 size-4" />
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
