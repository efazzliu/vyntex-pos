import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { useQuery as useTanStackQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { format, isToday, isYesterday } from "date-fns";
import { enUS, sq as sqLocale } from "date-fns/locale";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { posQueryKey, runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CookingPot,
  Download,
  Eye,
  GlassWater,
  History,
  Info,
  Layers,
  MoreVertical,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import StockHistoryDialog from "./stock-history-dialog.tsx";
import StockAllHistory from "./stock-all-history.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import ItemDialog from "./item-dialog.tsx";

type StockManagementProps = {
  licenseKey: string;
  staffName: string;
  /** Enterprise: menu stock, kitchen supply, and bar supply tabs. */
  enterpriseSupplyMall?: boolean;
  canManageStock?: boolean;
  canManageMenu?: boolean;
  onOpenStockRules?: () => void;
};

type StockRow = Doc<"menuItems"> & {
  categoryName: string;
  categoryColor: string;
  isLowStock: boolean;
  isOutOfStock: boolean;
  effectiveLowStockThreshold?: number;
  lastStockUpdateAt?: string | null;
};

type StockTab = "menu" | "supply_kitchen" | "supply_bar";
type StatusFilter = "all" | "in" | "low" | "out";
type TabFilters = { search: string; category: string; status: StatusFilter; page: number };
type EntryKind = "received" | "adjustment";
type AdjustMode = "remove" | "set";
type EditingItem = ComponentProps<typeof ItemDialog>["editing"];

const PAGE_SIZE = 25;
const EMPTY_FILTERS: TabFilters = { search: "", category: "all", status: "all", page: 0 };

/** Same normalized names as supply category detection elsewhere (e.g. `ensureSupplyCategory`). */
const SUPPLY_STOCK_CATEGORY_KEYS = new Set([
  "furnizim",
  "mall",
  "mall kuzhine",
  "mall kuzhinë",
  "stok",
  "stoku",
  "inventory",
]);

function normalizeStockCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isSupplyRow(item: StockRow): boolean {
  return SUPPLY_STOCK_CATEGORY_KEYS.has(normalizeStockCategoryName(item.categoryName ?? ""));
}

function rowStatus(item: StockRow): Exclude<StatusFilter, "all"> {
  if (item.isOutOfStock) return "out";
  if (item.isLowStock) return "low";
  return "in";
}

function formatQty(value: number | undefined | null): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function parseQty(raw: string): number {
  return Number.parseFloat(raw.replace(",", ".").trim());
}

const TAB_META: Record<
  StockTab,
  { icon: typeof Utensils; titleKey: string; descKey: string; searchKey: string; infoKey: string; scopeKey: string }
> = {
  menu: {
    icon: Utensils,
    titleKey: "stock_page.tab_menu_stock",
    descKey: "stock_page.tab_menu_desc",
    searchKey: "stock_page.search_menu",
    infoKey: "stock_page.info_menu",
    scopeKey: "stock_page.entry_scope_menu",
  },
  supply_kitchen: {
    icon: CookingPot,
    titleKey: "stock_page.tab_supply_kitchen",
    descKey: "stock_page.tab_kitchen_desc",
    searchKey: "stock_page.search_kitchen",
    infoKey: "stock_page.info_kitchen",
    scopeKey: "stock_page.entry_scope_kitchen",
  },
  supply_bar: {
    icon: GlassWater,
    titleKey: "stock_page.tab_supply_bar",
    descKey: "stock_page.tab_bar_desc",
    searchKey: "stock_page.search_bar",
    infoKey: "stock_page.info_bar",
    scopeKey: "stock_page.entry_scope_bar",
  },
};

const MENU_CONTENT_CLASS =
  "min-w-[220px] rounded-xl border border-[#e6edf5] bg-white p-1 text-[#0f172a] shadow-[0_12px_32px_-12px_rgba(15,23,42,0.22)]";
const MENU_ITEM_CLASS =
  "rounded-lg px-2.5 py-2 text-[13px] font-medium text-[#0f172a] focus:bg-[#f1f5f9] focus:text-[#0f172a]";
const FIELD_CLASS =
  "h-10 w-full rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-sm text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#005bd6] focus:ring-2 focus:ring-[#005bd6]/15";

export default function StockManagement({
  licenseKey,
  staffName,
  enterpriseSupplyMall = false,
  canManageStock = true,
  canManageMenu = false,
  onOpenStockRules,
}: StockManagementProps) {
  const { t, formatPrice, language } = usePosLocale();
  const dateLocale = language === "sq" ? sqLocale : enUS;
  const tabs: StockTab[] = enterpriseSupplyMall
    ? ["menu", "supply_kitchen", "supply_bar"]
    : ["menu"];

  const [tab, setTab] = useState<StockTab>("menu");
  useEffect(() => {
    if (!enterpriseSupplyMall) setTab("menu");
  }, [enterpriseSupplyMall]);

  const [filtersByTab, setFiltersByTab] = useState<Record<StockTab, TabFilters>>({
    menu: EMPTY_FILTERS,
    supply_kitchen: EMPTY_FILTERS,
    supply_bar: EMPTY_FILTERS,
  });
  const filters = filtersByTab[tab];
  const patchFilters = (patch: Partial<TabFilters>) =>
    setFiltersByTab((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], ...patch, page: patch.page ?? 0 },
    }));

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<{ id: Id<"menuItems">; name: string } | null>(null);
  const [detailsItem, setDetailsItem] = useState<StockRow | null>(null);
  const [itemDialog, setItemDialog] = useState<
    { mode: "create" } | { mode: "edit"; item: StockRow } | null
  >(null);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryItemId, setEntryItemId] = useState<Id<"menuItems"> | null>(null);
  const [entryLocked, setEntryLocked] = useState(false);
  const [entryKind, setEntryKind] = useState<EntryKind>("received");
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("remove");
  const [entryQty, setEntryQty] = useState("");
  const [entryCost, setEntryCost] = useState("");
  const [entrySupplier, setEntrySupplier] = useState("");
  const [entryReference, setEntryReference] = useState("");
  const [entryNotes, setEntryNotes] = useState("");
  const [entrySaving, setEntrySaving] = useState(false);

  const stockEnabled = Boolean(licenseKey?.trim());

  const stockQuery = useTanStackQuery({
    queryKey: posQueryKey("pos.stock.getStockItems", { licenseKey }),
    queryFn: async () => {
      let tid: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          tid = setTimeout(() => reject(new Error(t("stock_page.request_timeout"))), 25000);
        });
        return await Promise.race([
          runPosQuery("pos.stock.getStockItems", { licenseKey }) as Promise<StockRow[]>,
          timeout,
        ]);
      } finally {
        if (tid !== undefined) clearTimeout(tid);
      }
    },
    enabled: stockEnabled,
    retry: 1,
  });

  const categoriesQuery = useTanStackQuery({
    queryKey: posQueryKey("pos.menu.getCategories", { licenseKey }),
    queryFn: async () =>
      (await runPosQuery("pos.menu.getCategories", { licenseKey })) as Array<Doc<"menuCategories">>,
    enabled: stockEnabled && (canManageMenu || canManageStock),
    retry: 1,
  });

  const addStockMut = useMutation("pos.stock.addStock");
  const removeStockMut = useMutation("pos.stock.removeStock");
  const setStockMut = useMutation("pos.stock.setStock");

  const rowsByTab = useMemo<Record<StockTab, StockRow[]>>(() => {
    const all = stockQuery.data ?? [];
    if (!enterpriseSupplyMall) return { menu: all, supply_kitchen: [], supply_bar: [] };
    const supply = all.filter(isSupplyRow);
    return {
      menu: all.filter((row) => !isSupplyRow(row)),
      supply_kitchen: supply.filter((row) => row.station !== "bar"),
      supply_bar: supply.filter((row) => row.station === "bar"),
    };
  }, [stockQuery.data, enterpriseSupplyMall]);

  const tabRows = rowsByTab[tab];

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    for (const row of tabRows) {
      const id = String(row.categoryId ?? row.categoryName);
      if (!seen.has(id)) seen.set(id, { id, name: row.categoryName, color: row.categoryColor });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tabRows]);

  const scopedRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return tabRows.filter((row) => {
      if (filters.category !== "all" && String(row.categoryId ?? row.categoryName) !== filters.category) {
        return false;
      }
      if (!q) return true;
      return row.name.toLowerCase().includes(q) || row.categoryName.toLowerCase().includes(q);
    });
  }, [tabRows, filters.search, filters.category]);

  const filteredRows = useMemo(
    () =>
      filters.status === "all"
        ? scopedRows
        : scopedRows.filter((row) => rowStatus(row) === filters.status),
    [scopedRows, filters.status],
  );

  const summary = useMemo(() => {
    let low = 0;
    let out = 0;
    let value = 0;
    for (const row of scopedRows) {
      if (row.isOutOfStock) out += 1;
      else if (row.isLowStock) low += 1;
      value += Math.max(0, row.currentStock ?? 0) * Number(row.price ?? 0);
    }
    return { total: scopedRows.length, low, out, value };
  }, [scopedRows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount - 1);
  const pageRows = filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const unitLabel = (unit: string | undefined | null) => {
    const u = String(unit ?? "pc").toLowerCase();
    if (u === "pc" || u === "pcs") return t("stock_page.unit_pc");
    if (u === "lt" || u === "l") return "L";
    if (u === "bottle") return t("stock_page.unit_bottle");
    if (u === "box") return t("stock_page.unit_box");
    return u;
  };
  const rowUnit = (row: StockRow) => unitLabel((row as { stockUnit?: string }).stockUnit);
  const statusLabel = (status: Exclude<StatusFilter, "all">) =>
    t(status === "in" ? "stock_page.status_in" : status === "low" ? "stock_page.status_low" : "stock_page.status_out");

  const lastUpdateLabel = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    const time = format(date, "HH:mm");
    if (isToday(date)) return t("stock_page.today_at", { time });
    if (isYesterday(date)) return t("stock_page.yesterday_at", { time });
    return format(date, "d MMM yyyy", { locale: dateLocale });
  };

  const entryItem = entryItemId ? (tabRows.find((row) => row._id === entryItemId) ?? null) : null;

  const openEntry = (kind: EntryKind, item?: StockRow) => {
    setEntryKind(kind);
    setAdjustMode("remove");
    setEntryItemId(item?._id ?? null);
    setEntryLocked(Boolean(item));
    setEntryQty("");
    setEntryCost("");
    setEntrySupplier("");
    setEntryReference("");
    setEntryNotes("");
    setEntryOpen(true);
  };

  const buildNote = () => {
    const parts: string[] = [];
    if (entryNotes.trim()) parts.push(entryNotes.trim());
    if (entryKind === "received") {
      if (entrySupplier.trim()) parts.push(`${t("stock_page.note_supplier")}: ${entrySupplier.trim()}`);
      const cost = parseQty(entryCost);
      if (entryCost.trim() && Number.isFinite(cost) && cost >= 0) {
        parts.push(`${t("stock_page.note_cost")}: ${formatPrice(cost)}`);
      }
    }
    if (entryReference.trim()) parts.push(`${t("stock_page.note_ref")}: ${entryReference.trim()}`);
    return parts.join(" · ") || undefined;
  };

  const saveEntry = async () => {
    if (!entryItem) {
      toast.error(t("stock_page.entry_item_required"));
      return;
    }
    const qty = parseQty(entryQty);
    const current = entryItem.currentStock ?? 0;
    const unit = rowUnit(entryItem);
    const setting = entryKind === "adjustment" && adjustMode === "set";
    if (!Number.isFinite(qty) || (setting ? qty < 0 : qty <= 0)) {
      toast.error(t(setting ? "stock_page.stock_invalid" : "stock_page.qty_invalid"));
      return;
    }
    if (entryKind === "adjustment" && adjustMode === "remove" && qty > Math.max(0, current)) {
      toast.error(t("stock_page.qty_remove_max", { current: formatQty(current) }));
      return;
    }
    if (entryCost.trim() && !(parseQty(entryCost) >= 0)) {
      toast.error(t("stock_page.qty_invalid"));
      return;
    }
    setEntrySaving(true);
    try {
      const note = buildNote();
      if (entryKind === "received") {
        const balance = await addStockMut({ licenseKey, itemId: entryItem._id, quantity: qty, staffName, note });
        toast.success(
          t("stock_page.entry_saved_received", {
            qty: formatQty(qty),
            unit,
            balance: balance == null ? "—" : formatQty(Number(balance)),
          }),
        );
      } else if (adjustMode === "remove") {
        const balance = await removeStockMut({ licenseKey, itemId: entryItem._id, quantity: qty, staffName, note });
        toast.success(
          t("stock_page.entry_saved_removed", {
            qty: formatQty(qty),
            unit,
            balance: balance == null ? "—" : formatQty(Number(balance)),
          }),
        );
      } else {
        await setStockMut({ licenseKey, itemId: entryItem._id, newStock: qty, staffName, note });
        toast.success(t("stock_page.entry_saved_set", { balance: formatQty(qty), unit }));
      }
      setEntryOpen(false);
      void stockQuery.refetch();
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("stock_page.update_failed")));
    } finally {
      setEntrySaving(false);
    }
  };

  const exportCsv = () => {
    if (filteredRows.length === 0) {
      toast.info(t("stock_page.export_empty"));
      return;
    }
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = [
      t("stock_page.col_item"),
      t("stock_page.col_category"),
      t("stock_page.col_on_hand"),
      t("stock_page.col_minimum"),
      t("stock_page.col_unit"),
      t("stock_page.col_status"),
      t("stock_page.col_last_update"),
    ];
    const lines = filteredRows.map((row) =>
      [
        row.name,
        row.categoryName,
        formatQty(row.currentStock),
        formatQty(row.effectiveLowStockThreshold ?? row.lowStockThreshold),
        rowUnit(row),
        statusLabel(rowStatus(row)),
        row.lastStockUpdateAt ? format(new Date(row.lastStockUpdateAt), "yyyy-MM-dd HH:mm") : "",
      ]
        .map((value) => cell(String(value)))
        .join(","),
    );
    const csv = [header.map(cell).join(","), ...lines].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vyntex-stock-${tab}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(t("stock_page.export_done", { count: filteredRows.length }));
  };

  if (showAllHistory) {
    return <StockAllHistory licenseKey={licenseKey} onBack={() => setShowAllHistory(false)} />;
  }

  const meta = TAB_META[tab];
  const TabIcon = meta.icon;
  const isSupplyTab = tab !== "menu";
  const canCreateSupply = enterpriseSupplyMall && isSupplyTab && canManageStock;
  const loading = stockQuery.data === undefined && stockQuery.isFetching;
  const hasFilters = filters.search.trim() !== "" || filters.category !== "all" || filters.status !== "all";
  const fromIdx = filteredRows.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const toIdx = Math.min(filteredRows.length, (page + 1) * PAGE_SIZE);

  const rowActions = (row: StockRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("stock_page.row_actions", { name: row.name })}
          className="inline-flex size-8 items-center justify-center rounded-lg text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#0f172a]"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => setDetailsItem(row)}>
          <Eye className="size-4 text-[#64748b]" />
          {t("stock_page.action_details")}
        </DropdownMenuItem>
        {canManageStock ? (
          <>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => openEntry("received", row)}>
              <PackagePlus className="size-4 text-[#64748b]" />
              {t("stock_page.action_record")}
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => openEntry("adjustment", row)}>
              <SlidersHorizontal className="size-4 text-[#64748b]" />
              {t("stock_page.action_adjust")}
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem
          className={MENU_ITEM_CLASS}
          onSelect={() => setHistoryItem({ id: row._id, name: row.name })}
        >
          <History className="size-4 text-[#64748b]" />
          {t("stock_page.action_history")}
        </DropdownMenuItem>
        {canManageMenu ? (
          <>
            <DropdownMenuSeparator className="bg-[#eef2f6]" />
            <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => setItemDialog({ mode: "edit", item: row })}>
              <Pencil className="size-4 text-[#64748b]" />
              {t("stock_page.action_edit")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-full bg-[#f6f8fb] p-4 md:p-6">
      <div className="mx-auto max-w-[1440px] space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight text-[#0f172a]">{t("nav.stock")}</h1>
            <p className="mt-0.5 text-sm text-[#64748b]">{t("stock_page.v2_subtitle")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#f8fafc]"
            >
              <Download className="size-4 text-[#64748b]" />
              {t("stock_page.export")}
            </button>
            {canManageStock ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-sm font-semibold shadow-[0_1px_2px_rgba(0,91,214,0.25)] transition hover:brightness-110"
                    style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
                  >
                    <Plus className="size-4" />
                    {t("stock_page.add_entry")}
                    <ChevronDown className="size-4 opacity-80" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
                  <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => openEntry("received")}>
                    <PackagePlus className="size-4 text-[#64748b]" />
                    {t("stock_page.menu_record_received")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => openEntry("adjustment")}>
                    <SlidersHorizontal className="size-4 text-[#64748b]" />
                    {t("stock_page.menu_adjust")}
                  </DropdownMenuItem>
                  {canCreateSupply ? (
                    <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => setItemDialog({ mode: "create" })}>
                      <Plus className="size-4 text-[#64748b]" />
                      {t(tab === "supply_kitchen" ? "stock_page.menu_new_supply_kitchen" : "stock_page.menu_new_supply_bar")}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator className="bg-[#eef2f6]" />
                  <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => setShowAllHistory(true)}>
                    <History className="size-4 text-[#64748b]" />
                    {t("stock_page.menu_all_history")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                onClick={() => setShowAllHistory(true)}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#f8fafc]"
              >
                <History className="size-4 text-[#64748b]" />
                {t("stock_page.history_btn")}
              </button>
            )}
          </div>
        </header>

        <div className={cn("grid gap-3", tabs.length === 3 ? "md:grid-cols-3" : "md:grid-cols-1 lg:max-w-md")}>
          {tabs.map((id) => {
            const tabMeta = TAB_META[id];
            const Icon = tabMeta.icon;
            const active = id === tab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border px-4 py-3 text-left transition",
                  active
                    ? "border-[#005bd6] bg-[#eef4ff] shadow-[0_0_0_3px_rgba(0,91,214,0.08)]"
                    : "border-[#e6edf5] bg-white hover:border-[#cbd5e1]",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-[10px]",
                    active ? "bg-[#005bd6] text-[#ffffff]" : "bg-[#f1f5f9] text-[#475569]",
                  )}
                  style={active ? { color: "#ffffff" } : undefined}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] font-semibold", active ? "text-[#005bd6]" : "text-[#0f172a]")}>
                    {t(tabMeta.titleKey)}
                  </span>
                  <span className="block truncate text-[12.5px] text-[#64748b]">{t(tabMeta.descKey)}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                    active ? "bg-white text-[#005bd6]" : "bg-[#f1f5f9] text-[#64748b]",
                  )}
                >
                  {stockQuery.data ? rowsByTab[id].length : "–"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={<Layers className="size-4" />}
            label={t("stock_page.sum_total")}
            value={loading ? null : String(summary.total)}
            tone="blue"
          />
          <SummaryCard
            icon={<TriangleAlert className="size-4" />}
            label={t("stock_page.sum_low")}
            value={loading ? null : String(summary.low)}
            tone="amber"
          />
          <SummaryCard
            icon={<AlertCircle className="size-4" />}
            label={t("stock_page.sum_out")}
            value={loading ? null : String(summary.out)}
            tone="red"
          />
          <SummaryCard
            icon={<Wallet className="size-4" />}
            label={t("stock_page.sum_value")}
            value={loading ? null : formatPrice(summary.value)}
            tone="navy"
          />
        </div>

        <section className="overflow-hidden rounded-[14px] border border-[#e6edf5] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-2 border-b border-[#eef2f6] p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                value={filters.search}
                onChange={(e) => patchFilters({ search: e.target.value })}
                placeholder={t(meta.searchKey)}
                className={cn(FIELD_CLASS, "pl-9 pr-9")}
              />
              {filters.search ? (
                <button
                  type="button"
                  onClick={() => patchFilters({ search: "" })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a]"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <FilterMenu
                value={filters.category}
                onChange={(category) => patchFilters({ category })}
                options={[
                  { value: "all", label: t("stock_page.filter_all_categories") },
                  ...categoryOptions.map((c) => ({ value: c.id, label: c.name, color: c.color })),
                ]}
              />
              <FilterMenu
                value={filters.status}
                onChange={(status) => patchFilters({ status: status as StatusFilter })}
                options={[
                  { value: "all", label: t("stock_page.filter_all_status") },
                  { value: "in", label: t("stock_page.status_in") },
                  { value: "low", label: t("stock_page.status_low") },
                  { value: "out", label: t("stock_page.status_out") },
                ]}
              />
            </div>
          </div>

          {stockQuery.isError ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#fef2f2] text-[#dc2626]">
                <AlertCircle className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[#0f172a]">{t("stock_page.load_failed")}</p>
              <p className="mt-1 max-w-md text-sm text-[#64748b]">
                {errorMessageFromUnknown(stockQuery.error, t("stock_page.error_load_hint"))}
              </p>
              <button
                type="button"
                onClick={() => void stockQuery.refetch()}
                className="mt-4 inline-flex h-9 items-center rounded-[10px] px-4 text-sm font-semibold"
                style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
              >
                {t("stock_page.retry")}
              </button>
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg bg-[#f1f5f9]" />
              ))}
            </div>
          ) : tabRows.length === 0 ? (
            <EmptyBlock
              icon={<TabIcon className="size-5" />}
              title={t(
                tab === "menu"
                  ? "stock_page.empty_none"
                  : tab === "supply_kitchen"
                    ? "stock_page.empty_tab_supply_kitchen_title"
                    : "stock_page.empty_tab_supply_bar_title",
              )}
              description={t(
                tab === "menu"
                  ? "stock_page.empty_none_desc"
                  : tab === "supply_kitchen"
                    ? "stock_page.empty_tab_supply_kitchen_desc"
                    : "stock_page.empty_tab_supply_bar_desc",
              )}
              action={
                canCreateSupply ? (
                  <button
                    type="button"
                    onClick={() => setItemDialog({ mode: "create" })}
                    className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold"
                    style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
                  >
                    <Plus className="size-4" />
                    {t(tab === "supply_kitchen" ? "stock_page.menu_new_supply_kitchen" : "stock_page.menu_new_supply_bar")}
                  </button>
                ) : null
              }
            />
          ) : filteredRows.length === 0 ? (
            <EmptyBlock
              icon={<Search className="size-5" />}
              title={t(filters.search.trim() ? "stock_page.empty_search" : "stock_page.empty_filter_title")}
              description={
                filters.search.trim()
                  ? t("stock_page.empty_search_desc", { query: filters.search.trim() })
                  : t("stock_page.empty_filter_desc")
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={() => patchFilters({ search: "", category: "all", status: "all" })}
                    className="mt-4 inline-flex h-9 items-center rounded-[10px] border border-[#e2e8f0] bg-white px-4 text-sm font-semibold text-[#0f172a]"
                  >
                    {t("btn.clear")}
                  </button>
                ) : null
              }
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="bg-[#f8fafc] text-left text-[12px] font-medium text-[#64748b]">
                      <th className="px-4 py-2.5 font-medium">{t("stock_page.col_item")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("stock_page.col_category")}</th>
                      <th className="px-3 py-2.5 text-right font-medium">{t("stock_page.col_on_hand")}</th>
                      <th className="px-3 py-2.5 text-right font-medium">{t("stock_page.col_minimum")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("stock_page.col_unit")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("stock_page.col_status")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("stock_page.col_last_update")}</th>
                      <th className="w-12 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const status = rowStatus(row);
                      return (
                        <tr key={row._id} className="border-t border-[#eef2f6] transition hover:bg-[#fafbfd]">
                          <td className="px-4 py-2.5">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#f1f5f9] text-[#475569]">
                                <TabIcon className="size-4" strokeWidth={1.75} />
                              </span>
                              <span className="truncate font-semibold text-[#0f172a]">{row.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-[#475569]">
                              <span className="size-2 rounded-full" style={{ backgroundColor: row.categoryColor }} />
                              {row.categoryName}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2.5 text-right font-semibold tabular-nums",
                              status === "out" ? "text-[#dc2626]" : status === "low" ? "text-[#b45309]" : "text-[#0f172a]",
                            )}
                          >
                            {formatQty(row.currentStock)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-[#64748b]">
                            {formatQty(row.effectiveLowStockThreshold ?? row.lowStockThreshold)}
                          </td>
                          <td className="px-3 py-2.5 text-[#64748b]">{rowUnit(row)}</td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={status} label={statusLabel(status)} />
                          </td>
                          <td className="px-3 py-2.5 text-[#64748b]">{lastUpdateLabel(row.lastStockUpdateAt)}</td>
                          <td className="px-3 py-2.5 text-right">{rowActions(row)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[#eef2f6] md:hidden">
                {pageRows.map((row) => {
                  const status = rowStatus(row);
                  return (
                    <li key={row._id} className="flex items-center gap-3 px-3 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f1f5f9] text-[#475569]">
                        <TabIcon className="size-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#0f172a]">{row.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#64748b]">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: row.categoryColor }} />
                          <span className="truncate">{row.categoryName}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-[#0f172a]">
                          {formatQty(row.currentStock)} <span className="font-normal text-[#64748b]">{rowUnit(row)}</span>
                        </p>
                        <div className="mt-1">
                          <StatusBadge status={status} label={statusLabel(status)} />
                        </div>
                      </div>
                      {rowActions(row)}
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between gap-3 border-t border-[#eef2f6] px-4 py-2.5 text-xs text-[#64748b]">
                <span className="tabular-nums">
                  {t("stock_page.pager", { from: fromIdx, to: toIdx, total: filteredRows.length })}
                </span>
                {pageCount > 1 ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={t("stock_page.page_prev")}
                      disabled={page === 0}
                      onClick={() => patchFilters({ page: page - 1 })}
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#475569] disabled:opacity-40"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="px-2 tabular-nums">
                      {page + 1} / {pageCount}
                    </span>
                    <button
                      type="button"
                      aria-label={t("stock_page.page_next")}
                      disabled={page >= pageCount - 1}
                      onClick={() => patchFilters({ page: page + 1 })}
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#475569] disabled:opacity-40"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </section>

        <div className="flex flex-col gap-2 rounded-[12px] border border-[#e6edf5] bg-white px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <Info className="mt-0.5 size-4 shrink-0 text-[#005bd6]" />
            <p className="text-[13px] leading-snug text-[#475569]">{t(meta.infoKey)}</p>
          </div>
          {onOpenStockRules ? (
            <button
              type="button"
              onClick={onOpenStockRules}
              className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[#005bd6] hover:underline"
            >
              {t("settings.cat.inventory")}
              <ArrowRight className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <Sheet open={entryOpen} onOpenChange={(open) => !entrySaving && setEntryOpen(open)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-l border-[#e6edf5] bg-white p-0 text-[#0f172a] sm:max-w-md"
        >
          <SheetHeader className="border-b border-[#eef2f6] px-5 py-4">
            <SheetTitle className="text-[17px] font-bold text-[#0f172a]">{t("stock_page.entry_title")}</SheetTitle>
            <SheetDescription className="text-[13px] text-[#64748b]">{t(meta.scopeKey)}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <Field label={t("stock_page.entry_item")}>
              {entryLocked && entryItem ? (
                <div className="flex h-10 items-center gap-2 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-semibold">
                  <TabIcon className="size-4 text-[#64748b]" />
                  <span className="truncate">{entryItem.name}</span>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(FIELD_CLASS, "flex items-center justify-between gap-2 text-left")}
                    >
                      <span className={cn("truncate", !entryItem && "text-[#94a3b8]")}>
                        {entryItem?.name ?? t("stock_page.entry_pick_item")}
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-[#94a3b8]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn(MENU_CONTENT_CLASS, "max-h-72 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto")}
                  >
                    {tabRows.map((row) => (
                      <DropdownMenuItem
                        key={row._id}
                        className={cn(MENU_ITEM_CLASS, "justify-between")}
                        onSelect={() => setEntryItemId(row._id)}
                      >
                        <span className="truncate">{row.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-[#64748b]">
                          {formatQty(row.currentStock)} {rowUnit(row)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Field>

            <Field label={t("stock_page.entry_type")}>
              <Segmented
                value={entryKind}
                onChange={(kind) => setEntryKind(kind as EntryKind)}
                options={[
                  { value: "received", label: t("stock_page.entry_received") },
                  { value: "adjustment", label: t("stock_page.entry_adjustment") },
                ]}
              />
              {entryKind === "adjustment" ? (
                <div className="mt-2">
                  <Segmented
                    size="sm"
                    value={adjustMode}
                    onChange={(mode) => setAdjustMode(mode as AdjustMode)}
                    options={[
                      { value: "remove", label: t("stock_page.adjust_remove") },
                      { value: "set", label: t("stock_page.adjust_set") },
                    ]}
                  />
                </div>
              ) : null}
            </Field>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field
                label={t(
                  entryKind === "adjustment" && adjustMode === "set"
                    ? "stock_page.entry_counted"
                    : "stock_page.entry_quantity",
                )}
                hint={
                  entryItem
                    ? t("stock_page.entry_current", {
                        qty: `${formatQty(entryItem.currentStock)} ${rowUnit(entryItem)}`,
                      })
                    : undefined
                }
              >
                <input
                  inputMode="decimal"
                  value={entryQty}
                  onChange={(e) => setEntryQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveEntry();
                  }}
                  placeholder="0"
                  className={cn(FIELD_CLASS, "text-base font-semibold tabular-nums")}
                />
              </Field>
              <Field label={t("stock_page.entry_unit")}>
                <div className="flex h-10 min-w-[72px] items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-semibold text-[#475569]">
                  {entryItem ? rowUnit(entryItem) : "—"}
                </div>
              </Field>
            </div>

            {entryKind === "received" ? (
              <>
                <Field label={t("stock_page.entry_cost")}>
                  <input
                    inputMode="decimal"
                    value={entryCost}
                    onChange={(e) => setEntryCost(e.target.value)}
                    placeholder={formatPrice(0)}
                    className={FIELD_CLASS}
                  />
                </Field>
                <Field label={t("stock_page.entry_supplier")}>
                  <input
                    value={entrySupplier}
                    onChange={(e) => setEntrySupplier(e.target.value)}
                    className={FIELD_CLASS}
                  />
                </Field>
              </>
            ) : null}

            <Field label={t("stock_page.entry_reference")}>
              <input
                value={entryReference}
                onChange={(e) => setEntryReference(e.target.value)}
                className={FIELD_CLASS}
              />
            </Field>

            <Field label={t("stock_page.entry_notes")}>
              <textarea
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                rows={3}
                className={cn(FIELD_CLASS, "h-auto resize-none py-2")}
              />
            </Field>

            <p className="flex items-start gap-2 text-xs leading-snug text-[#64748b]">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {t("stock_page.entry_note_hint")}
            </p>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-[#eef2f6] px-5 py-3">
            <button
              type="button"
              onClick={() => setEntryOpen(false)}
              disabled={entrySaving}
              className="inline-flex h-10 items-center rounded-[10px] border border-[#e2e8f0] bg-white px-4 text-sm font-semibold text-[#0f172a] disabled:opacity-50"
            >
              {t("btn.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void saveEntry()}
              disabled={entrySaving || !entryItem}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
            >
              <Check className="size-4" />
              {entrySaving ? t("stock_page.saving") : t("stock_page.entry_save")}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={detailsItem !== null} onOpenChange={(open) => !open && setDetailsItem(null)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-l border-[#e6edf5] bg-white p-0 text-[#0f172a] sm:max-w-md"
        >
          {detailsItem ? (
            <>
              <SheetHeader className="border-b border-[#eef2f6] px-5 py-4">
                <SheetTitle className="flex items-center gap-2.5 text-[17px] font-bold text-[#0f172a]">
                  <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#f1f5f9] text-[#475569]">
                    <TabIcon className="size-4" />
                  </span>
                  <span className="truncate">{detailsItem.name}</span>
                </SheetTitle>
                <SheetDescription className="text-[13px] text-[#64748b]">
                  {t("stock_page.details_title")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="mb-4">
                  <StatusBadge status={rowStatus(detailsItem)} label={statusLabel(rowStatus(detailsItem))} />
                </div>
                <dl className="divide-y divide-[#eef2f6] rounded-[12px] border border-[#eef2f6]">
                  <DetailRow label={t("stock_page.col_category")} value={detailsItem.categoryName} />
                  {detailsItem.station ? (
                    <DetailRow
                      label={t("stock_page.details_station")}
                      value={t(detailsItem.station === "bar" ? "stock_page.station_bar" : "stock_page.station_kitchen")}
                    />
                  ) : null}
                  <DetailRow
                    label={t("stock_page.col_on_hand")}
                    value={`${formatQty(detailsItem.currentStock)} ${rowUnit(detailsItem)}`}
                  />
                  <DetailRow
                    label={t("stock_page.col_minimum")}
                    value={`${formatQty(detailsItem.effectiveLowStockThreshold ?? detailsItem.lowStockThreshold)} ${rowUnit(detailsItem)}${
                      detailsItem.lowStockThreshold == null ? ` (${t("stock_page.details_venue_default")})` : ""
                    }`}
                  />
                  <DetailRow label={t("stock_page.details_price")} value={formatPrice(Number(detailsItem.price ?? 0))} />
                  <DetailRow
                    label={t("stock_page.sum_value")}
                    value={formatPrice(Math.max(0, detailsItem.currentStock ?? 0) * Number(detailsItem.price ?? 0))}
                  />
                  <DetailRow label={t("stock_page.col_last_update")} value={lastUpdateLabel(detailsItem.lastStockUpdateAt)} />
                </dl>
              </div>
              <SheetFooter className="flex-row flex-wrap justify-end gap-2 border-t border-[#eef2f6] px-5 py-3">
                <button
                  type="button"
                  onClick={() => {
                    const item = detailsItem;
                    setDetailsItem(null);
                    setHistoryItem({ id: item._id, name: item.name });
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 text-sm font-semibold text-[#0f172a]"
                >
                  <History className="size-4 text-[#64748b]" />
                  {t("stock_page.history_btn")}
                </button>
                {canManageStock ? (
                  <button
                    type="button"
                    onClick={() => {
                      const item = detailsItem;
                      setDetailsItem(null);
                      openEntry("received", item);
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-sm font-semibold"
                    style={{ backgroundColor: "#005bd6", color: "#ffffff" }}
                  >
                    <PackagePlus className="size-4" />
                    {t("stock_page.action_record")}
                  </button>
                ) : null}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {historyItem ? (
        <StockHistoryDialog
          open
          onOpenChange={(open) => !open && setHistoryItem(null)}
          licenseKey={licenseKey}
          menuItemId={historyItem.id}
          itemName={historyItem.name}
        />
      ) : null}

      {itemDialog ? (
        <ItemDialog
          open
          onOpenChange={(open) => !open && setItemDialog(null)}
          licenseKey={licenseKey}
          categories={(categoriesQuery.data ?? []).map((c) => ({
            _id: c._id,
            name: c.name,
            color: c.color,
            icon: c.icon,
          }))}
          editing={itemDialog.mode === "edit" ? (itemDialog.item as unknown as EditingItem) : null}
          initialStation={
            itemDialog.mode === "create"
              ? tab === "supply_kitchen"
                ? "kitchen"
                : tab === "supply_bar"
                  ? "bar"
                  : undefined
              : undefined
          }
          initialTrackStock={itemDialog.mode === "create" ? true : undefined}
          initialAvailable={itemDialog.mode === "create" ? false : undefined}
          initialStockUnit={
            itemDialog.mode === "create"
              ? tab === "supply_kitchen"
                ? "kg"
                : tab === "supply_bar"
                  ? "lt"
                  : undefined
              : undefined
          }
          initialName={itemDialog.mode === "create" ? filters.search.trim() : undefined}
          dialogNewTitleOverride={
            itemDialog.mode === "create"
              ? tab === "supply_kitchen"
                ? "supply_kitchen"
                : tab === "supply_bar"
                  ? "supply_bar"
                  : undefined
              : undefined
          }
          onSaved={() => {
            void stockQuery.refetch();
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  tone: "blue" | "amber" | "red" | "navy";
}) {
  const toneClass = {
    blue: { chip: "bg-[#eef4ff] text-[#005bd6]", value: "text-[#005bd6]" },
    amber: { chip: "bg-[#fffbeb] text-[#d97706]", value: "text-[#b45309]" },
    red: { chip: "bg-[#fef2f2] text-[#dc2626]", value: "text-[#dc2626]" },
    navy: { chip: "bg-[#f1f5f9] text-[#334155]", value: "text-[#0f172a]" },
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-[#e6edf5] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", toneClass.chip)}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-[#64748b]">{label}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-6 w-16 rounded-md bg-[#f1f5f9]" />
        ) : (
          <p className={cn("truncate text-[20px] font-bold leading-tight tabular-nums", toneClass.value)}>{value}</p>
        )}
      </div>
    </div>
  );
}

function FilterMenu({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; color?: string }>;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 min-w-[150px] items-center justify-between gap-2 rounded-[10px] border bg-white px-3 text-sm font-medium transition",
            value !== "all" ? "border-[#005bd6] text-[#005bd6]" : "border-[#e2e8f0] text-[#0f172a] hover:bg-[#f8fafc]",
          )}
        >
          <span className="truncate">{current?.label}</span>
          <ChevronDown className="size-4 shrink-0 text-[#94a3b8]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn(MENU_CONTENT_CLASS, "max-h-72 overflow-y-auto")}>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className={cn(MENU_ITEM_CLASS, "justify-between")}
            onSelect={() => onChange(option.value)}
          >
            <span className="flex min-w-0 items-center gap-2">
              {option.color ? (
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
              ) : null}
              <span className="truncate">{option.label}</span>
            </span>
            {option.value === value ? <Check className="size-4 text-[#005bd6]" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StatusBadge({ status, label }: { status: Exclude<StatusFilter, "all">; label: string }) {
  const Icon = status === "in" ? CheckCircle2 : status === "low" ? TriangleAlert : AlertCircle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold",
        status === "in" && "bg-[#ecfdf3] text-[#15803d]",
        status === "low" && "bg-[#fffbeb] text-[#b45309]",
        status === "out" && "bg-[#fef2f2] text-[#dc2626]",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

function EmptyBlock({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-[#0f172a]">{title}</p>
      <p className="mt-1 max-w-md text-sm text-[#64748b]">{description}</p>
      {action}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center justify-between gap-2 text-[12.5px] font-semibold text-[#334155]">
        {label}
        {hint ? <span className="font-medium text-[#94a3b8]">{hint}</span> : null}
      </p>
      {children}
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  size?: "sm" | "md";
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-[11px] bg-[#f1f5f9] p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[8px] px-3 font-semibold transition",
              size === "sm" ? "h-8 text-[12.5px]" : "h-9 text-[13px]",
              active ? "bg-white text-[#005bd6] shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-[#64748b] hover:text-[#0f172a]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
      <dt className="text-[#64748b]">{label}</dt>
      <dd className="truncate text-right font-semibold text-[#0f172a]">{value}</dd>
    </div>
  );
}
