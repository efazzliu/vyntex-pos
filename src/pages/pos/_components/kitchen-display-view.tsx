import { useMemo } from "react";
import { useQuery as useTanStackQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { ChefHat, Wine, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { usePosLocale } from "./pos-locale-provider.tsx";
import type { KitchenQueueLine } from "@/lib/supabase-pos/orders-ops.ts";
import { posQueryKey, runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import { isSupabaseConfigured } from "@/lib/supabase.ts";
import { cn } from "@/lib/utils.ts";

type KitchenDisplayViewProps = {
  licenseKey: string;
};

type GroupedTicket = {
  saleId: string;
  orderNumber: number;
  tableName: string;
  lines: KitchenQueueLine[];
};

export default function KitchenDisplayView({
  licenseKey,
}: KitchenDisplayViewProps) {
  const { t } = usePosLocale();
  const kitchenEnabled = Boolean(licenseKey?.trim()) && isSupabaseConfigured;
  const kitchenQuery = useTanStackQuery({
    queryKey: posQueryKey("pos.orders.getKitchenQueue", { licenseKey }),
    queryFn: async () => {
      let tid: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          tid = setTimeout(
            () => reject(new Error(t("stock_page.request_timeout"))),
            25_000,
          );
        });
        const rows = await Promise.race([
          runPosQuery("pos.orders.getKitchenQueue", { licenseKey }),
          timeout,
        ]);
        return Array.isArray(rows) ? (rows as KitchenQueueLine[]) : [];
      } finally {
        if (tid !== undefined) clearTimeout(tid);
      }
    },
    enabled: kitchenEnabled,
    staleTime: 0,
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
    retry: 2,
    networkMode: "always",
  });
  const queue = kitchenQuery.data;
  const bump = useMutation("pos.orders.bumpKitchenTicketItem");

  const grouped = useMemo(() => {
    const list = queue ?? [];
    const bySale = new Map<string, GroupedTicket>();
    for (const line of list) {
      const g = bySale.get(line.saleId);
      if (g) {
        g.lines.push(line);
      } else {
        bySale.set(line.saleId, {
          saleId: line.saleId,
          orderNumber: line.orderNumber,
          tableName: line.tableName,
          lines: [line],
        });
      }
    }
    return [...bySale.values()].sort((a, b) => a.orderNumber - b.orderNumber);
  }, [queue]);

  const handleBump = async (line: KitchenQueueLine) => {
    try {
      await bump({
        licenseKey,
        lineId: line.lineId,
        saleId: line.saleId,
      });
      toast.success(t("kitchen.marked_ready"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("kitchen.bump_failed"));
    }
  };

  return (
    <div className="min-h-full bg-[#0A0F1E] p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ChefHat className="size-7 text-orange-400" />
            {t("kitchen.title")}
          </h1>
          <p className="text-sm text-[#8b93a7] mt-1">{t("kitchen.subtitle")}</p>
        </div>

        {!kitchenEnabled ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 py-12 px-4 text-center text-amber-200 text-sm flex flex-col items-center gap-2">
            <AlertCircle className="size-8 opacity-90" />
            {t("kitchen.supabase_required")}
          </div>
        ) : kitchenQuery.isError ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 py-12 px-4 text-center space-y-3">
            <p className="text-red-200 text-sm">{t("kitchen.load_failed")}</p>
            <p className="text-xs text-red-300/90 break-words max-w-lg mx-auto">
              {kitchenQuery.error instanceof Error
                ? kitchenQuery.error.message
                : String(kitchenQuery.error ?? "")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-red-400/40 text-red-100 hover:bg-red-500/20"
              onClick={() => void kitchenQuery.refetch()}
            >
              {t("stock_page.retry")}
            </Button>
          </div>
        ) : queue === undefined && !kitchenQuery.isError ? (
          <div className="text-[#5a6580] text-sm py-12 text-center">
            {t("common.loading")}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl border border-[#1e2a45] bg-[#131A2E] py-16 text-center text-[#5a6580]">
            {t("kitchen.empty")}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {grouped.map((ticket) => (
              <div
                key={ticket.saleId}
                className="rounded-2xl border border-[#1e2a45] bg-[#131A2E] overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a45] bg-[#0D1326]">
                  <div>
                    <p className="text-lg font-bold text-white">
                      #{ticket.orderNumber}
                    </p>
                    <p className="text-xs text-[#0066FF] font-medium">
                      {ticket.tableName}
                    </p>
                  </div>
                </div>
                <ul className="divide-y divide-[#1e2a45]">
                  {ticket.lines.map((line) => (
                    <li
                      key={line.lineId}
                      className="flex items-start gap-3 px-4 py-3"
                    >
                      <div className="mt-0.5 shrink-0">
                        {line.station === "bar" ? (
                          <Wine className="size-5 text-purple-400" />
                        ) : (
                          <ChefHat className="size-5 text-orange-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">
                          <span className="text-[#0066FF] tabular-nums">
                            {line.quantity}×
                          </span>{" "}
                          {line.name}
                        </p>
                        {line.notes ? (
                          <p className="text-xs text-amber-400/90 mt-1">
                            {line.notes}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        className={cn(
                          "shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-700",
                        )}
                        onClick={() => void handleBump(line)}
                      >
                        <CheckCircle2 className="size-4" />
                        {t("kitchen.ready")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
