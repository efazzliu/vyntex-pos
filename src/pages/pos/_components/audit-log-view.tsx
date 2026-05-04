import { useState } from "react";
import { useQuery as useTanQuery } from "@tanstack/react-query";
import { posQueryKey, runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import { isSupabaseConfigured } from "@/lib/supabase.ts";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet.tsx";
import {
  ShieldCheck,
  Trash2,
  MinusCircle,
  Ban,
  CreditCard,
  UserX,
  Gift,
  LogIn,
  LogOut,
  AlertTriangle,
  ClipboardList,
  Banknote,
  HandCoins,
  UtensilsCrossed,
  Lock,
  ChefHat,
  Wine,
  ShoppingBag,
  X,
} from "lucide-react";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";

type AuditLogViewProps = {
  licenseKey: string;
};

type FilterTab = "all" | "orders" | "payments" | "debts" | "security";

const FILTER_TABS: {
  id: FilterTab;
  labelKey: string;
  icon: typeof ShieldCheck;
}[] = [
  { id: "all", labelKey: "audit.filter_all", icon: ClipboardList },
  { id: "orders", labelKey: "audit.filter_orders", icon: ShoppingBag },
  { id: "payments", labelKey: "audit.filter_payments", icon: Banknote },
  { id: "debts", labelKey: "audit.filter_debts", icon: HandCoins },
  { id: "security", labelKey: "audit.filter_security", icon: Lock },
];

// Which actions belong to which filter
const FILTER_ACTIONS: Record<FilterTab, string[] | null> = {
  all: null, // show everything
  orders: ["item_ordered"],
  payments: ["payment", "complimentary_order", "late_fiscal", "bulk_fiscal", "expense", "staff_consumption"],
  debts: ["debt_order", "debt_settlement"],
  security: [
    "void_item",
    "item_deleted",
    "quantity_reduced",
    "price_change",
    "order_cancel",
    "login",
    "logout",
    "table_transfer",
    "table_merge",
    "day_close",
    "shift_close",
    "staff_create",
    "staff_update",
    "menu_change",
  ],
};

const ACTION_CONFIG: Record<string, { icon: typeof Trash2; color: string }> = {
  item_ordered: { icon: ShoppingBag, color: "text-[#0066FF]" },
  void_item: { icon: Ban, color: "text-red-400" },
  item_deleted: { icon: Trash2, color: "text-red-400" },
  quantity_reduced: { icon: MinusCircle, color: "text-amber-400" },
  price_change: { icon: AlertTriangle, color: "text-amber-400" },
  order_cancel: { icon: Ban, color: "text-red-400" },
  payment: { icon: CreditCard, color: "text-emerald-400" },
  complimentary_order: { icon: Gift, color: "text-violet-400" },
  debt_order: { icon: UserX, color: "text-orange-400" },
  debt_settlement: { icon: HandCoins, color: "text-teal-400" },
  late_fiscal: { icon: CreditCard, color: "text-cyan-400" },
  bulk_fiscal: { icon: ShieldCheck, color: "text-[#0066FF]" },
  expense: { icon: HandCoins, color: "text-emerald-400" },
  staff_consumption: { icon: UtensilsCrossed, color: "text-amber-400" },
  login: { icon: LogIn, color: "text-blue-400" },
  logout: { icon: LogOut, color: "text-[#5a6580]" },
  table_transfer: { icon: AlertTriangle, color: "text-cyan-400" },
  table_merge: { icon: AlertTriangle, color: "text-teal-400" },
  day_close: { icon: ShieldCheck, color: "text-emerald-400" },
  shift_close: { icon: ShieldCheck, color: "text-emerald-400" },
  staff_create: { icon: LogIn, color: "text-blue-400" },
  staff_update: { icon: AlertTriangle, color: "text-amber-400" },
  menu_change: { icon: AlertTriangle, color: "text-amber-400" },
};

function auditActionLabel(action: string, t: (k: string) => string): string {
  const key = `audit.action_${action.replace(/-/g, "_")}`;
  const translated = t(key);
  return translated === key ? action : translated;
}

type AuditMetadata = {
  orderId?: string;
  orderNumber?: number;
  tableName?: string;
  paymentMethod?: string;
  paymentType?: string;
  customerName?: string;
  total?: number;
  items?: {
    name: string;
    quantity: number;
    price: number;
    station?: string;
    notes?: string;
  }[];
};

type AuditLog = {
  _id: string;
  action: string;
  staffName: string;
  details: string;
  metadata?: string | Record<string, unknown> | null;
  createdAt: string;
};

function parseMetadata(
  raw?: string | Record<string, unknown> | null,
): AuditMetadata | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as AuditMetadata;
  try {
    return JSON.parse(raw) as AuditMetadata;
  } catch {
    return null;
  }
}

export default function AuditLogView({ licenseKey }: AuditLogViewProps) {
  const { t } = usePosLocale();
  const { theme: posTheme } = usePosTheme();
  const auditArgs = { licenseKey, limit: 200 };
  const {
    data: logs,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useTanQuery({
    queryKey: posQueryKey("pos.dashboard.getAuditLogs", auditArgs),
    queryFn: () =>
      runPosQuery(
        "pos.dashboard.getAuditLogs",
        auditArgs,
      ) as Promise<AuditLog[]>,
    enabled: isSupabaseConfigured && licenseKey.trim().length > 0,
    staleTime: 0,
    refetchInterval: 12_000,
    refetchOnWindowFocus: false,
    networkMode: "always",
  });

  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const logList: AuditLog[] = Array.isArray(logs) ? logs : [];
  const errMsg =
    error instanceof Error ? error.message : error ? String(error) : "";
  const isTableMissing = errMsg === "AUDIT_LOG_TABLE_MISSING";

  // Apply filter
  const filteredLogs =
    activeFilter === "all"
      ? logList
      : logList.filter((log) => {
          const actions = FILTER_ACTIONS[activeFilter];
          return actions ? actions.includes(log.action) : true;
        });

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="size-6" />
          {t("audit.title")}
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">{t("audit.subtitle")}</p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon;
          const count =
            !isError && tab.id !== "all"
              ? logList.filter((l) => {
                  const actions = FILTER_ACTIONS[tab.id];
                  return actions ? actions.includes(l.action) : true;
                }).length
              : null;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer border",
                activeFilter === tab.id
                  ? "bg-[#0066FF]/15 border-[#0066FF]/40 text-[#0066FF]"
                  : "bg-[#0D1326] border-[#1e2a45] text-[#8b93a7] hover:border-[#2a3a5a] hover:text-white"
              )}
            >
              <Icon className="size-4" />
              {t(tab.labelKey)}
              {count !== null && count > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    activeFilter === tab.id
                      ? "bg-[#0066FF]/20 text-[#0066FF]"
                      : "bg-[#1e2a45] text-[#5a6580]"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!isSupabaseConfigured ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle>{t("audit.error_load")}</EmptyTitle>
            <EmptyDescription>{t("audit.error_not_configured")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : isError ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle>{t("audit.error_load")}</EmptyTitle>
            <EmptyDescription>
              {isTableMissing
                ? t("audit.error_table_missing")
                : errMsg || t("audit.error_load")}
            </EmptyDescription>
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              disabled={isRefetching}
              onClick={() => void refetch()}
            >
              {t("audit.retry")}
            </Button>
          </EmptyHeader>
        </Empty>
      ) : isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheck />
            </EmptyMedia>
            <EmptyTitle>
              {activeFilter === "all"
                ? t("audit.empty_none")
                : t("audit.empty")}
            </EmptyTitle>
            <EmptyDescription>
              {activeFilter === "all"
                ? t("audit.empty_hint")
                : t("audit.empty")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => {
            const config = ACTION_CONFIG[log.action] ?? {
              icon: AlertTriangle,
              color: "text-[#5a6580]",
            };
            const ActionIcon = config.icon;
            const time = new Date(log.createdAt);
            const hasMetadata = !!log.metadata;

            return (
              <button
                key={log._id}
                onClick={() => setSelectedLog(log as AuditLog)}
                className={cn(
                  "w-full flex items-start gap-3 p-3.5 rounded-xl bg-[#0D1326] border border-[#1e2a45] text-left transition-all cursor-pointer",
                  hasMetadata
                    ? "hover:border-[#0066FF]/30 hover:bg-[#0D1326]/80"
                    : "hover:border-[#2a3a5a]"
                )}
              >
                <div className={cn("p-2 rounded-lg bg-[#131A2E] shrink-0", config.color)}>
                  <ActionIcon className="size-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", config.color)}>
                      {auditActionLabel(log.action, t)}
                    </span>
                    <span className="text-[10px] text-[#3a4055]">&bull;</span>
                    <span className="text-xs text-[#0066FF] font-medium">
                      {log.staffName}
                    </span>
                  </div>
                  <p className="text-sm text-[#8b93a7] mt-0.5 break-words line-clamp-2">
                    {log.details}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[10px] text-[#5a6580]">
                    {time.toLocaleDateString()}
                  </p>
                  <p className="text-xs text-[#8b93a7] font-medium">
                    {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail side panel */}
      <Sheet open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }}>
        <SheetContent
          data-pos-theme={posTheme}
          className="bg-[#0A0F1E] border-[#1e2a45] w-full sm:max-w-md overflow-y-auto p-0 gap-0 flex flex-col"
        >
          {selectedLog && (
            <AuditDetailPanel
              log={selectedLog}
              onClose={() => setSelectedLog(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Detail Panel ──

function AuditDetailPanel({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const { t, formatPrice } = usePosLocale();
  const config = ACTION_CONFIG[log.action] ?? {
    icon: AlertTriangle,
    color: "text-[#5a6580]",
  };
  const ActionIcon = config.icon;
  const time = new Date(log.createdAt);
  const meta = parseMetadata(log.metadata);
  const dateStr = time.toLocaleDateString();
  const timeStr = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <>
      <SheetHeader className="border-b border-[#1e2a45] px-6 pt-4 pb-5 gap-0">
        <div className="flex items-start gap-4 pr-10">
          <div className={cn("p-2.5 rounded-xl bg-[#131A2E] shrink-0", config.color)}>
            <ActionIcon className="size-5" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <SheetTitle className={cn("text-lg leading-snug", config.color)}>
              {auditActionLabel(log.action, t)}
            </SheetTitle>
            <SheetDescription className="text-[#8b93a7] text-sm mt-1.5">
              {t("audit.at_time", { date: dateStr, time: timeStr })}
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-lg hover:bg-[#1e2a45] text-[#5a6580] hover:text-white transition-colors cursor-pointer shrink-0 -mr-1"
            aria-label={t("btn.close")}
          >
            <X className="size-4" />
          </button>
        </div>
      </SheetHeader>

      <div className="space-y-7 px-6 pt-6 pb-10">
        {/* Staff info */}
        <div className="flex flex-col gap-2.5">
          <label className="text-[10px] uppercase tracking-wider text-[#5a6580] font-semibold">
            {t("audit.label_staff")}
          </label>
          <p className="text-sm text-white font-medium leading-relaxed">{log.staffName}</p>
        </div>

        {/* Details text */}
        <div className="flex flex-col gap-2.5">
          <label className="text-[10px] uppercase tracking-wider text-[#5a6580] font-semibold">
            {t("audit.label_details")}
          </label>
          <p className="text-sm text-[#8b93a7] break-words leading-relaxed">{log.details}</p>
        </div>

        {/* Order info from metadata */}
        {meta?.orderNumber && (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
            {meta.orderNumber && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-wider text-[#5a6580] font-semibold">
                  {t("audit.label_order")}
                </label>
                <p className="text-sm text-white font-medium">#{meta.orderNumber}</p>
              </div>
            )}
            {meta.tableName && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-wider text-[#5a6580] font-semibold">
                  {t("audit.label_table")}
                </label>
                <p className="text-sm text-white font-medium">{meta.tableName}</p>
              </div>
            )}
            {meta.paymentMethod && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-wider text-[#5a6580] font-semibold">
                  {t("audit.label_method")}
                </label>
                <p className="text-sm text-white font-medium capitalize">{meta.paymentMethod}</p>
              </div>
            )}
          </div>
        )}

        {/* Customer (for debt entries) */}
        {meta?.customerName && (
          <div className="flex flex-col gap-2.5">
            <label className="text-[10px] uppercase tracking-wider text-[#5a6580] font-semibold">
              {t("audit.label_customer")}
            </label>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#131A2E] border border-[#1e2a45]">
              <UserX className="size-4 text-orange-400 shrink-0" />
              <span className="text-sm text-white font-medium">{meta.customerName}</span>
            </div>
          </div>
        )}

        {/* Itemized list */}
        {meta?.items && meta.items.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <label className="text-[10px] uppercase tracking-wider text-[#5a6580] font-semibold">
              {t("audit.items_section", { count: meta.items.length })}
            </label>
            <div className="rounded-xl border border-[#1e2a45] overflow-hidden">
              {meta.items.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3.5",
                    idx > 0 && "border-t border-[#1e2a45]"
                  )}
                >
                  {/* Station icon */}
                  <div
                    className={cn(
                      "p-1.5 rounded-lg shrink-0",
                      item.station === "bar"
                        ? "bg-purple-500/10 text-purple-400"
                        : "bg-orange-500/10 text-orange-400"
                    )}
                  >
                    {item.station === "bar" ? (
                      <Wine className="size-3.5" />
                    ) : (
                      <ChefHat className="size-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {item.name}
                    </p>
                    {item.notes && (
                      <p className="text-[11px] text-amber-400 italic mt-0.5">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm text-white font-semibold">
                      {item.quantity}x
                    </p>
                    <p className="text-[11px] text-[#5a6580]">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Total row */}
              {meta.total !== undefined && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#1e2a45] bg-[#131A2E]">
                  <span className="text-xs text-[#8b93a7] font-medium uppercase tracking-wider">
                    {t("common.total")}
                  </span>
                  <span className="text-sm text-white font-bold">
                    {formatPrice(meta.total)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
