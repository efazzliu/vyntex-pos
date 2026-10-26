import { useState } from "react";
import { useQuery as useTanQuery } from "@tanstack/react-query";
import { posQueryKey, runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import { isSupabaseConfigured } from "@/lib/supabase.ts";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
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
  Calendar,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Pencil,
  Search,
  Shield,
  ShoppingBag,
  Users,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";

type AuditLogViewProps = {
  licenseKey: string;
  staffId?: string;
  embedded?: boolean;
};

type ActivityRange = "1" | "7" | "30" | "all";

const PAGE_SIZE = 8;

const CHANGE_ACTIONS = new Set([
  "staff_create",
  "staff_update",
  "menu_change",
  "price_change",
  "quantity_reduced",
  "table_transfer",
  "table_merge",
]);

const SECURITY_ACTIONS = new Set([
  "login_failed",
  "void_item",
  "item_deleted",
  "order_cancel",
  "device_revoke",
]);

const ACTION_CONFIG: Record<string, { icon: typeof Trash2; color: string }> = {
  item_ordered: { icon: ShoppingBag, color: "text-brand" },
  void_item: { icon: Ban, color: "text-red-400" },
  item_deleted: { icon: Trash2, color: "text-red-400" },
  quantity_reduced: { icon: MinusCircle, color: "text-amber-400" },
  price_change: { icon: AlertTriangle, color: "text-amber-400" },
  order_cancel: { icon: Ban, color: "text-red-400" },
  payment: { icon: CreditCard, color: "text-emerald-400" },
  complimentary_order: { icon: Gift, color: "text-brand-soft" },
  debt_order: { icon: UserX, color: "text-brand-soft" },
  debt_settlement: { icon: HandCoins, color: "text-teal-400" },
  late_fiscal: { icon: CreditCard, color: "text-cyan-400" },
  bulk_fiscal: { icon: ShieldCheck, color: "text-brand" },
  expense: { icon: HandCoins, color: "text-emerald-400" },
  staff_consumption: { icon: UtensilsCrossed, color: "text-amber-400" },
  login: { icon: LogIn, color: "text-brand-soft" },
  logout: { icon: LogOut, color: "text-[#5a6580]" },
  login_failed: { icon: AlertTriangle, color: "text-amber-400" },
  device_revoke: { icon: LogOut, color: "text-red-400" },
  table_transfer: { icon: AlertTriangle, color: "text-cyan-400" },
  table_merge: { icon: AlertTriangle, color: "text-teal-400" },
  day_close: { icon: ShieldCheck, color: "text-emerald-400" },
  shift_close: { icon: ShieldCheck, color: "text-emerald-400" },
  staff_create: { icon: LogIn, color: "text-brand-soft" },
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

function withinRange(iso: string, range: ActivityRange): boolean {
  if (range === "all") return true;
  const days = range === "1" ? 1 : range === "7" ? 7 : 30;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function metaText(raw: AuditLog["metadata"], keys: string[]): string | null {
  const meta = parseMetadata(raw);
  if (!meta) return null;
  const bag = meta as Record<string, unknown>;
  for (const key of keys) {
    const value = bag[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

function actionTone(action: string): string {
  if (action === "login" || action === "payment" || action === "day_close" || action === "shift_close") {
    return "bg-emerald-500/12 text-emerald-600";
  }
  if (SECURITY_ACTIONS.has(action)) return "bg-red-500/12 text-red-600";
  if (action === "logout") return "bg-slate-500/10 text-slate-500";
  return "bg-brand/12 text-brand";
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

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

export default function AuditLogView({ licenseKey, staffId, embedded }: AuditLogViewProps) {
  const { t, language } = usePosLocale();
  const { theme: posTheme } = usePosTheme();
  const auditArgs = { licenseKey, limit: 200, staffId };
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

  const [range, setRange] = useState<ActivityRange>("7");
  const [query, setQuery] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const logList: AuditLog[] = Array.isArray(logs) ? logs : [];
  const errMsg =
    error instanceof Error ? error.message : error ? String(error) : "";
  const isTableMissing = errMsg === "AUDIT_LOG_TABLE_MISSING";
  const rangedLogs = logList.filter((log) => withinRange(log.createdAt, range));
  const loginCount = rangedLogs.filter((log) => log.action === "login").length;
  const changeCount = rangedLogs.filter((log) => CHANGE_ACTIONS.has(log.action)).length;
  const securityCount = rangedLogs.filter((log) => SECURITY_ACTIONS.has(log.action)).length;
  const q = query.trim().toLowerCase();
  const filteredLogs = rangedLogs.filter((log) => {
    if (userFilter !== "all" && log.staffName !== userFilter) return false;
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (!q) return true;
    const label = auditActionLabel(log.action, t).toLowerCase();
    return `${log.staffName} ${label} ${log.action} ${log.details}`.toLowerCase().includes(q);
  });
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filteredLogs.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const userOptions = Array.from(new Set(rangedLogs.map((log) => log.staffName).filter(Boolean))).sort();
  const actionOptions = Array.from(new Set(rangedLogs.map((log) => log.action))).sort();

  const exportRows = () => {
    const header = [
      t("audit.col_when"),
      t("audit.col_user"),
      t("audit.col_action"),
      t("audit.col_details"),
      t("audit.col_ip"),
      t("audit.col_device"),
    ];
    const lines = filteredLogs.map((log) => {
      const when = new Date(log.createdAt);
      const ip = metaText(log.metadata, ["ip", "ipAddress"]) ?? "";
      const device = metaText(log.metadata, ["deviceName", "device", "displayName"]) ?? "";
      return [
        Number.isNaN(when.getTime()) ? log.createdAt : when.toISOString(),
        log.staffName,
        auditActionLabel(log.action, t),
        log.details,
        ip,
        device,
      ].map(csvCell).join(",");
    });
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "activity-log.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={embedded ? "space-y-5 pb-8" : "space-y-5 p-6 pb-10 lg:p-8"}>
      {embedded ? null : (
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="size-6" />
          {t("audit.title")}
        </h1>
        <p className="text-[#8b93a7] text-sm mt-1">{t("audit.subtitle")}</p>
      </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["total", "audit.stat_total", rangedLogs.length, Users],
            ["logins", "audit.stat_logins", loginCount, LogIn],
            ["changes", "audit.stat_changes", changeCount, Pencil],
            ["security", "audit.stat_security", securityCount, Shield],
          ] as const
        ).map(([key, labelKey, value, Icon]) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-[18px] border border-[#1e2a45] bg-[#131A2E] px-4 py-3.5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
              <Icon className="size-4 text-brand" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-[#8b93a7]">{t(labelKey)}</span>
              <span className="block text-2xl font-bold leading-none text-white">
                {isPending || isError ? "—" : value.toLocaleString(language === "sq" ? "sq-AL" : "en-US")}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8b93a7]" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder={t("audit.search")}
            className="h-10 rounded-xl border-[#1e2a45] bg-[#131A2E] pl-9 text-white placeholder:text-[#8b93a7]"
          />
        </div>
        <ActivityMenu
          theme={posTheme}
          icon={Calendar}
          value={range}
          options={[
            { value: "7", label: t("audit.range_7") },
            { value: "1", label: t("audit.range_1") },
            { value: "30", label: t("audit.range_30") },
            { value: "all", label: t("audit.range_all") },
          ]}
          onChange={(value) => {
            setRange(value as ActivityRange);
            setPage(0);
          }}
        />
        <ActivityMenu
          theme={posTheme}
          icon={Users}
          value={userFilter}
          options={[
            { value: "all", label: t("audit.all_users") },
            ...userOptions.map((name) => ({ value: name, label: name })),
          ]}
          onChange={(value) => {
            setUserFilter(value);
            setPage(0);
          }}
        />
        <ActivityMenu
          theme={posTheme}
          icon={ClipboardList}
          value={actionFilter}
          options={[
            { value: "all", label: t("audit.all_actions") },
            ...actionOptions.map((action) => ({
              value: action,
              label: auditActionLabel(action, t),
            })),
          ]}
          onChange={(value) => {
            setActionFilter(value);
            setPage(0);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl border-[#1e2a45]"
          disabled={filteredLogs.length === 0}
          onClick={exportRows}
        >
          <Download className="size-4" />
          {t("audit.export")}
        </Button>
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
            <EmptyTitle>{t(query || userFilter !== "all" || actionFilter !== "all" ? "audit.empty" : "audit.empty_none")}</EmptyTitle>
            <EmptyDescription>
              {query || userFilter !== "all" || actionFilter !== "all"
                ? t("audit.empty")
                : t("audit.empty_hint")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-[#1e2a45] bg-[#131A2E]">
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1e2a45] text-[11px] font-medium text-[#8b93a7]">
                  <th className="px-3 py-2.5 font-medium">{t("audit.col_when")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("audit.col_user")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("audit.col_action")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("audit.col_details")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("audit.col_ip")}</th>
                  <th className="px-3 py-2.5 font-medium">{t("audit.col_device")}</th>
                  <th className="w-10 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((log) => {
                  const when = new Date(log.createdAt);
                  const stamp = Number.isNaN(when.getTime())
                    ? log.createdAt
                    : when.toLocaleString(language === "sq" ? "sq-AL" : "en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                  const ip = metaText(log.metadata, ["ip", "ipAddress"]) ?? "—";
                  const device = metaText(log.metadata, ["deviceName", "device", "displayName"]) ?? "—";
                  return (
                    <tr
                      key={log._id}
                      onClick={() => setSelectedLog(log)}
                      className="cursor-pointer border-t border-[#1e2a45] hover:bg-[#1e2a45]/30"
                    >
                      <td className="px-3 py-3 text-sm whitespace-nowrap text-white">{stamp}</td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
                            {personInitials(log.staffName)}
                          </span>
                          <span className="truncate text-sm font-medium text-white">{log.staffName}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", actionTone(log.action))}>
                          {auditActionLabel(log.action, t)}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-3 py-3 text-sm text-[#8b93a7]">
                        <span className="block truncate">{log.details || "—"}</span>
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap text-[#8b93a7]">{ip}</td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap text-[#8b93a7]">{device}</td>
                      <td className="px-2 py-3 text-right">
                        <button
                          type="button"
                          className="flex size-8 items-center justify-center rounded-full text-[#8b93a7] hover:bg-[#1e2a45]/30"
                          aria-label={t("audit.sheet_title")}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedLog(log);
                          }}
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex w-full min-w-0 items-center justify-between gap-3 border-t border-[#1e2a45] bg-[#131A2E] px-3 py-3 text-sm text-[#8b93a7]">
            <p className="min-w-0 truncate">
              {t("audit.showing", {
                from: filteredLogs.length === 0 ? 0 : safePage * PAGE_SIZE + 1,
                to: Math.min(filteredLogs.length, safePage * PAGE_SIZE + PAGE_SIZE),
                count: filteredLogs.length,
              })}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(Math.max(0, safePage - 1))}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#1e2a45] disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: Math.min(5, pageCount) }, (_, slot) => {
                const start = Math.max(0, Math.min(safePage - 2, pageCount - Math.min(5, pageCount)));
                const index = start + slot;
                const active = index === safePage;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setPage(index)}
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                      active ? "border-brand bg-brand" : "border-[#1e2a45] text-[#8b93a7]",
                    )}
                    style={active ? { color: "#ffffff" } : undefined}
                  >
                    {index + 1}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#1e2a45] disabled:opacity-40"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
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

function ActivityMenu({
  theme,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  theme: string;
  icon: LucideIcon;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value)?.label ?? "";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#1e2a45] bg-[#131A2E] px-3 text-sm text-white"
        >
          <Icon className="size-4 text-[#8b93a7]" />
          <span className="max-w-[140px] truncate">{current}</span>
          <ChevronDown className="size-4 text-[#8b93a7]" />
        </button>
      </PopoverTrigger>
      <PopoverContent data-pos-theme={theme} align="start" className="w-56 p-1">
        <div className="max-h-64 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full rounded-lg px-3 py-2 text-left text-sm",
                option.value === value ? "bg-brand/12 text-brand" : "hover:bg-[#1e2a45]/30",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
              <UserX className="size-4 text-brand-soft shrink-0" />
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
                        ? "bg-brand/10 text-brand-soft"
                        : "bg-brand/10 text-brand-soft"
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
