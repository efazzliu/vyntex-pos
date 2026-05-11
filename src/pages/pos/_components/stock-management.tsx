import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useQuery as useTanStackQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { posQueryKey, runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import {
  Package,
  AlertTriangle,
  XCircle,
  Pencil,
  Plus,
  Minus,
  Search,
  X,
  Clock,
  DollarSign,
  ChefHat,
  Wine,
} from "lucide-react";
import StockHistoryDialog from "./stock-history-dialog.tsx";
import StockAllHistory from "./stock-all-history.tsx";
import { usePosLocale } from "./pos-locale-provider.tsx";
import ItemDialog from "./item-dialog.tsx";

type StockManagementProps = {
  licenseKey: string;
  staffName: string;
  /** Enterprise: split tabs (menu stock vs kitchen/bar supply) and create supply from Stock. */
  enterpriseSupplyMall?: boolean;
};

type StockRow = Doc<"menuItems"> & {
  categoryName: string;
  categoryColor: string;
  isLowStock: boolean;
  isOutOfStock: boolean;
};

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

function stockRowIsSupplyCategory(item: StockRow): boolean {
  return SUPPLY_STOCK_CATEGORY_KEYS.has(
    normalizeStockCategoryName(item.categoryName ?? ""),
  );
}

type StockScopeTab =
  | "menu"
  | "supply_kitchen"
  | "supply_bar"
  | "all"
  | "kitchen"
  | "bar";

export default function StockManagement({
  licenseKey,
  staffName,
  enterpriseSupplyMall = false,
}: StockManagementProps) {
  const { t, formatPrice } = usePosLocale();
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [stockScope, setStockScope] = useState<StockScopeTab>(() =>
    enterpriseSupplyMall ? "menu" : "all",
  );

  useEffect(() => {
    if (enterpriseSupplyMall) {
      setStockScope((s) =>
        s === "all" || s === "kitchen" || s === "bar" ? "menu" : s,
      );
    } else {
      setStockScope((s) =>
        s === "menu" || s === "supply_kitchen" || s === "supply_bar"
          ? "all"
          : s,
      );
    }
  }, [enterpriseSupplyMall]);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);

  useEffect(() => {
    if (!enterpriseSupplyMall) {
      setItemDialogOpen(false);
    }
  }, [enterpriseSupplyMall]);

  const stockEnabled = Boolean(licenseKey?.trim());

  const stockQuery = useTanStackQuery({
    queryKey: posQueryKey("pos.stock.getStockItems", { licenseKey }),
    queryFn: async () => {
      let tid: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          tid = setTimeout(
            () =>
              reject(new Error(t("stock_page.request_timeout"))),
            25000,
          );
        });
        return await Promise.race([
          runPosQuery("pos.stock.getStockItems", {
            licenseKey,
          }) as Promise<StockRow[]>,
          timeout,
        ]);
      } finally {
        if (tid !== undefined) clearTimeout(tid);
      }
    },
    enabled: stockEnabled,
    retry: 1,
  });
  const stockItems = stockQuery.data;
  const addStockMut = useMutation('pos.stock.addStock');
  const removeStockMut = useMutation('pos.stock.removeStock');
  const setStock = useMutation('pos.stock.setStock');

  const categoriesQuery = useTanStackQuery({
    queryKey: posQueryKey("pos.menu.getCategories", { licenseKey }),
    queryFn: async () =>
      (await runPosQuery("pos.menu.getCategories", { licenseKey })) as Array<
        Doc<"menuCategories">
      >,
    enabled: stockEnabled,
    retry: 1,
  });

  const categoriesForDialog = (categoriesQuery.data ?? []).map((c) => ({
    _id: c._id,
    name: c.name,
    color: c.color,
    icon: c.icon,
  }));

  const canCreateSupply =
    enterpriseSupplyMall &&
    (stockScope === "supply_kitchen" || stockScope === "supply_bar");

  const [searchQuery, setSearchQuery] = useState("");

  /** Enterprise: menu vs supply tabs; Starter/Pro: all / kitchen / bar by station. */
  const tabFilteredStockItems = useMemo(() => {
    if (!stockItems) return [];
    if (!enterpriseSupplyMall) {
      if (stockScope === "all") return stockItems;
      return stockItems.filter((item) => item.station === stockScope);
    }
    if (stockScope === "menu") {
      return stockItems.filter((item) => !stockRowIsSupplyCategory(item));
    }
    if (stockScope === "supply_kitchen") {
      return stockItems.filter(
        (item) => stockRowIsSupplyCategory(item) && item.station === "kitchen",
      );
    }
    return stockItems.filter(
      (item) => stockRowIsSupplyCategory(item) && item.station === "bar",
    );
  }, [stockItems, stockScope, enterpriseSupplyMall]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredStockItems;
    const q = searchQuery.toLowerCase();
    return tabFilteredStockItems.filter(
      (item) =>
        (item.name?.toLowerCase() ?? "").includes(q) ||
        (item.categoryName?.toLowerCase() ?? "").includes(q),
    );
  }, [tabFilteredStockItems, searchQuery]);

  // Summary stats (from tab-filtered list)
  const stats = useMemo(() => {
    const items = tabFilteredStockItems;
    const tracked = items.length;
    const lowStock = items.filter((i) => i.isLowStock || i.isOutOfStock).length;
    const totalValue = items.reduce(
      (sum, item) => sum + (item.currentStock ?? 0) * item.price,
      0,
    );
    return { tracked, lowStock, totalValue };
  }, [tabFilteredStockItems]);

  // Quick-add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addItemId, setAddItemId] = useState<Id<"menuItems"> | null>(null);
  const [addItemName, setAddItemName] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Quick-remove dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeItemId, setRemoveItemId] = useState<Id<"menuItems"> | null>(null);
  const [removeItemName, setRemoveItemName] = useState("");
  const [removeItemCurrent, setRemoveItemCurrent] = useState(0);
  const [removeQuantity, setRemoveQuantity] = useState("");
  const [removeNote, setRemoveNote] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);

  // Edit (set) dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<Id<"menuItems"> | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editStockValue, setEditStockValue] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // History dialog state
  const [historyItemId, setHistoryItemId] = useState<Id<"menuItems"> | null>(null);
  const [historyItemName, setHistoryItemName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Mobile "Change Stock" dialog state
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [changeItemId, setChangeItemId] = useState<Id<"menuItems"> | null>(null);
  const [changeItemName, setChangeItemName] = useState("");
  const [changeItemCurrent, setChangeItemCurrent] = useState(0);
  const [changeMode, setChangeMode] = useState<"add" | "remove">("add");
  const [changeQuantity, setChangeQuantity] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);

  // Show full history view when toggled
  if (showAllHistory) {
    return (
      <StockAllHistory
        licenseKey={licenseKey}
        onBack={() => setShowAllHistory(false)}
      />
    );
  }

  if (!stockEnabled) {
    return (
      <div className="p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle className="text-amber-400" />
            </EmptyMedia>
            <EmptyTitle>{t("stock_page.missing_license")}</EmptyTitle>
            <EmptyDescription>{t("stock_page.license_desc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (stockQuery.isError) {
    return (
      <div className="p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle className="text-amber-400" />
            </EmptyMedia>
            <EmptyTitle>{t("stock_page.load_failed")}</EmptyTitle>
            <EmptyDescription className="max-w-md">
              {errorMessageFromUnknown(
                stockQuery.error,
                t("stock_page.error_load_hint"),
              )}
            </EmptyDescription>
          </EmptyHeader>
          <Button
            className="mt-4"
            onClick={() => void stockQuery.refetch()}
          >
            {t("stock_page.retry")}
          </Button>
        </Empty>
      </div>
    );
  }

  // `isPending` alone can stay true when the query is idle/disabled in some RQ versions;
  // only show skeleton while a fetch is actually in flight and we have no data yet.
  const stockStillLoading =
    stockQuery.data === undefined && stockQuery.isFetching;

  if (stockStillLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl bg-[#131A2E]" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-[#131A2E]" />
          ))}
        </div>
      </div>
    );
  }

  const hasAnyTrackedItems = (stockItems?.length ?? 0) > 0;
  const stockList = tabFilteredStockItems;

  // ── Quick Add handlers ──────────────────────────────

  const openAddDialog = (itemId: Id<"menuItems">, name: string) => {
    setAddItemId(itemId);
    setAddItemName(name);
    setAddQuantity("");
    setAddNote("");
    setAddDialogOpen(true);
  };

  const handleAddStock = async () => {
    if (!addItemId) return;
    const qty = parseFloat(addQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t("stock_page.qty_invalid"));
      return;
    }
    setAddLoading(true);
    try {
      const newBalance = await addStockMut({
        licenseKey,
        itemId: addItemId,
        quantity: qty,
        staffName,
        note: addNote.trim() || undefined,
      });
      toast.success(t("stock_page.added", { qty, balance: newBalance }));
      setAddDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("stock_page.add_fail");
      toast.error(msg);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Quick Remove handlers ───────────────────────────

  const openRemoveDialog = (
    itemId: Id<"menuItems">,
    name: string,
    currentStock: number,
  ) => {
    setRemoveItemId(itemId);
    setRemoveItemName(name);
    setRemoveItemCurrent(currentStock);
    setRemoveQuantity("");
    setRemoveNote("");
    setRemoveDialogOpen(true);
  };

  const handleRemoveStock = async () => {
    if (!removeItemId) return;
    const qty = parseFloat(removeQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t("stock_page.qty_invalid"));
      return;
    }
    if (removeItemCurrent > 0 && qty > removeItemCurrent) {
      toast.error(t("stock_page.qty_remove_max", { current: removeItemCurrent }));
      return;
    }
    setRemoveLoading(true);
    try {
      const newBalance = await removeStockMut({
        licenseKey,
        itemId: removeItemId,
        quantity: qty,
        staffName,
        note: removeNote.trim() || undefined,
      });
      toast.success(t("stock_page.removed", { qty, balance: newBalance }));
      setRemoveDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("stock_page.remove_fail");
      toast.error(msg);
    } finally {
      setRemoveLoading(false);
    }
  };

  // ── Edit (set) handlers ─────────────────────────────

  const openEditDialog = (
    itemId: Id<"menuItems">,
    name: string,
    currentStock: number,
  ) => {
    setEditItemId(itemId);
    setEditItemName(name);
    setEditStockValue(currentStock.toString());
    setEditNote("");
    setEditDialogOpen(true);
  };

  const handleSetStock = async () => {
    if (!editItemId) return;
    const val = parseFloat(editStockValue);
    if (!Number.isFinite(val)) {
      toast.error(t("stock_page.stock_invalid"));
      return;
    }
    setEditLoading(true);
    try {
      await setStock({
        licenseKey,
        itemId: editItemId,
        newStock: val,
        staffName,
        note: editNote.trim() || undefined,
      });
      toast.success(t("stock_page.updated"));
      setEditDialogOpen(false);
    } catch {
      toast.error(t("stock_page.update_failed"));
    } finally {
      setEditLoading(false);
    }
  };

  // ── History handler ─────────────────────────────────

  const openHistory = (itemId: Id<"menuItems">, name: string) => {
    setHistoryItemId(itemId);
    setHistoryItemName(name);
    setHistoryOpen(true);
  };

  // ── Change Stock (mobile) handlers ─────────────────

  const openChangeDialog = (
    itemId: Id<"menuItems">,
    name: string,
    currentStock: number,
  ) => {
    setChangeItemId(itemId);
    setChangeItemName(name);
    setChangeItemCurrent(currentStock);
    setChangeMode("add");
    setChangeQuantity("");
    setChangeDialogOpen(true);
  };

  const handleChangeStock = async () => {
    if (!changeItemId) return;
    const qty = parseFloat(changeQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t("stock_page.qty_invalid"));
      return;
    }
    if (
      changeMode === "remove" &&
      changeItemCurrent > 0 &&
      qty > changeItemCurrent
    ) {
      toast.error(t("stock_page.qty_remove_max", { current: changeItemCurrent }));
      return;
    }
    setChangeLoading(true);
    try {
      if (changeMode === "add") {
        const newBalance = await addStockMut({
          licenseKey,
          itemId: changeItemId,
          quantity: qty,
          staffName,
        });
        toast.success(t("stock_page.added", { qty, balance: newBalance }));
      } else {
        const newBalance = await removeStockMut({
          licenseKey,
          itemId: changeItemId,
          quantity: qty,
          staffName,
        });
        toast.success(t("stock_page.removed", { qty, balance: newBalance }));
      }
      setChangeDialogOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("stock_page.update_failed");
      toast.error(msg);
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Package className="size-5 md:size-6" />
            {t("nav.stock")}
          </h1>
          <p className="text-sm text-[#5a6580] mt-1">
            {t(
              enterpriseSupplyMall
                ? "stock_page.subtitle"
                : "stock_page.subtitle_all_tiers",
            )}
          </p>
          <div className="flex items-center gap-2 mt-3 overflow-x-auto">
            {enterpriseSupplyMall ? (
              <>
                <MallTab
                  selected={stockScope === "menu"}
                  icon={<Package className="size-4" />}
                  onClick={() => setStockScope("menu")}
                >
                  {t("stock_page.tab_menu_stock")}
                </MallTab>
                <MallTab
                  selected={stockScope === "supply_kitchen"}
                  icon={<ChefHat className="size-4" />}
                  onClick={() => setStockScope("supply_kitchen")}
                >
                  {t("stock_page.tab_supply_kitchen")}
                </MallTab>
                <MallTab
                  selected={stockScope === "supply_bar"}
                  icon={<Wine className="size-4" />}
                  onClick={() => setStockScope("supply_bar")}
                >
                  {t("stock_page.tab_supply_bar")}
                </MallTab>
              </>
            ) : (
              <>
                <MallTab
                  selected={stockScope === "all"}
                  icon={<Package className="size-4" />}
                  onClick={() => setStockScope("all")}
                >
                  {t("menu_page.mall_all")}
                </MallTab>
                <MallTab
                  selected={stockScope === "kitchen"}
                  icon={<ChefHat className="size-4" />}
                  onClick={() => setStockScope("kitchen")}
                >
                  {t("menu_page.mall_kitchen")}
                </MallTab>
                <MallTab
                  selected={stockScope === "bar"}
                  icon={<Wine className="size-4" />}
                  onClick={() => setStockScope("bar")}
                >
                  {t("menu_page.mall_bar")}
                </MallTab>
              </>
            )}
          </div>
        </div>
        <Button
          size="sm"
          className="h-9 px-3 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border-0 shrink-0"
          onClick={() => setShowAllHistory(true)}
        >
          <Clock className="size-4 mr-1.5" />
          {t("stock_page.history_btn")}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-3 md:p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="size-3.5 text-[#5a6580]" />
            <p className="text-[10px] md:text-xs text-[#5a6580]">
              {t("stock_page.tracked")}
            </p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white">{stats.tracked}</p>
        </div>
        <div
          className={cn(
            "rounded-xl border p-3 md:p-4",
            stats.lowStock > 0
              ? "border-amber-500/30 bg-amber-950/20"
              : "border-[#1e2a45] bg-[#131A2E]",
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-3.5 text-[#5a6580]" />
            <p className="text-[10px] md:text-xs text-[#5a6580]">
              {t("stock_page.low_stock")}
            </p>
          </div>
          <p
            className={cn(
              "text-xl md:text-2xl font-bold",
              stats.lowStock > 0 ? "text-amber-400" : "text-white",
            )}
          >
            {stats.lowStock}
          </p>
        </div>
        <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-3 md:p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="size-3.5 text-[#5a6580]" />
            <p className="text-[10px] md:text-xs text-[#5a6580]">
              {t("stock_page.inventory_value")}
            </p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white">
            {formatPrice(stats.totalValue)}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5a6580]" />
        <Input
          placeholder={t("stock_page.search_ph")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 bg-[#131A2E] border-[#1e2a45] text-white placeholder:text-[#3a4055] h-11"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6580] hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Items list */}
      {!hasAnyTrackedItems ? (
        <div className="py-12">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Package /></EmptyMedia>
              <EmptyTitle>{t("stock_page.empty_none")}</EmptyTitle>
              <EmptyDescription>{t("stock_page.empty_none_desc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : stockList.length === 0 ? (
        <div className="py-12">
          <Empty>
            {enterpriseSupplyMall ? (
              <>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {stockScope === "menu" ? (
                      <Package />
                    ) : stockScope === "supply_kitchen" ? (
                      <ChefHat />
                    ) : (
                      <Wine />
                    )}
                  </EmptyMedia>
                  <EmptyTitle>
                    {stockScope === "menu"
                      ? t("stock_page.empty_tab_menu_title")
                      : stockScope === "supply_kitchen"
                        ? t("stock_page.empty_tab_supply_kitchen_title")
                        : t("stock_page.empty_tab_supply_bar_title")}
                  </EmptyTitle>
                  <EmptyDescription>
                    {stockScope === "menu"
                      ? t("stock_page.empty_tab_menu_desc")
                      : stockScope === "supply_kitchen"
                        ? t("stock_page.empty_tab_supply_kitchen_desc")
                        : t("stock_page.empty_tab_supply_bar_desc")}
                  </EmptyDescription>
                </EmptyHeader>
                {canCreateSupply ? (
                  <div className="mt-4 text-center">
                    <Button
                      size="sm"
                      className="bg-[#0066FF] hover:bg-[#0055dd] text-white font-semibold"
                      onClick={() => setItemDialogOpen(true)}
                    >
                      <Plus className="size-4 mr-1.5" />
                      {t("menu_page.add_mall_item")}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {stockScope === "kitchen" ? (
                    <ChefHat />
                  ) : stockScope === "bar" ? (
                    <Wine />
                  ) : (
                    <Package />
                  )}
                </EmptyMedia>
                <EmptyTitle>{t("stock_page.empty_filter_title")}</EmptyTitle>
                <EmptyDescription>
                  {t("stock_page.empty_filter_desc")}
                </EmptyDescription>
              </EmptyHeader>
            )}
          </Empty>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Search /></EmptyMedia>
              <EmptyTitle>{t("stock_page.empty_search")}</EmptyTitle>
              <EmptyDescription>
                {t("stock_page.empty_search_desc", { query: searchQuery })}
              </EmptyDescription>
            </EmptyHeader>
            {canCreateSupply ? (
              <div className="mt-4 text-center">
                <Button
                  size="sm"
                  className="bg-[#0066FF] hover:bg-[#0055dd] text-white font-semibold"
                  onClick={() => setItemDialogOpen(true)}
                >
                  <Plus className="size-4 mr-1.5" />
                  {t("menu_page.add_mall_item")}
                </Button>
              </div>
            ) : null}
          </Empty>
        </div>
      ) : (
        <>
          {/* Desktop table header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-[#5a6580] font-medium uppercase tracking-wider">
            <div className="col-span-3">{t("stock_page.col_item")}</div>
            <div className="col-span-2">{t("stock_page.col_category")}</div>
            <div className="col-span-1 text-right">{t("stock_page.col_initial")}</div>
            <div className="col-span-2 text-right">{t("stock_page.col_current")}</div>
            <div className="col-span-1 text-right">{t("stock_page.col_threshold")}</div>
            <div className="col-span-3 text-right">{t("stock_page.col_actions")}</div>
          </div>

          <div className="space-y-2">
            {filteredItems.map((item) => {
              const stockPct =
                item.initialStock && item.initialStock > 0
                  ? ((item.currentStock ?? 0) / item.initialStock) * 100
                  : 0;
              const currentStock = item.currentStock ?? 0;

              return (
                <div
                  key={item._id}
                  className={cn(
                    "rounded-xl border transition-all",
                    item.isOutOfStock
                      ? "border-red-500/30 bg-red-950/10"
                      : item.isLowStock
                        ? "border-amber-500/30 bg-amber-950/10"
                        : "border-[#1e2a45] bg-[#131A2E]",
                  )}
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center px-4 py-3">
                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                      {item.isOutOfStock && (
                        <XCircle className="size-4 text-red-400 shrink-0" />
                      )}
                      {item.isLowStock && !item.isOutOfStock && (
                        <AlertTriangle className="size-4 text-amber-400 shrink-0" />
                      )}
                      {!item.isOutOfStock && !item.isLowStock && (
                        <div className="size-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                      <span className="text-sm text-white font-medium truncate">
                        {item.station === "kitchen" ? (
                          <ChefHat className="size-4 text-orange-400 shrink-0 mr-2 inline" />
                        ) : item.station === "bar" ? (
                          <Wine className="size-4 text-purple-400 shrink-0 mr-2 inline" />
                        ) : null}
                        {item.name}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${item.categoryColor}20`,
                          color: item.categoryColor,
                        }}
                      >
                        {item.categoryName}
                      </span>
                    </div>

                    <div className="col-span-1 text-right text-sm text-[#5a6580]">
                      {item.initialStock ?? 0}
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 h-2 bg-[#1e2a45] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(0, Math.min(100, stockPct))}%`,
                              backgroundColor: item.isOutOfStock
                                ? "#FF3B30"
                                : item.isLowStock
                                  ? "#FFB800"
                                  : "#44CC00",
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold w-10 text-right tabular-nums",
                            item.isOutOfStock
                              ? "text-red-400"
                              : item.isLowStock
                                ? "text-amber-400"
                                : "text-emerald-400",
                          )}
                        >
                          {currentStock}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-1 text-right text-sm text-[#5a6580]">
                      {item.lowStockThreshold ?? "-"}
                    </div>

                    {/* Actions: +  -  edit  history */}
                    <div className="col-span-3 flex items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        className="h-8 px-2.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border-0"
                        onClick={() => openAddDialog(item._id, item.name)}
                        title={t("stock_page.title_add_stock")}
                      >
                        <Plus className="size-3.5 mr-1" />
                        {t("stock_page.add_btn_short")}
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-2.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 border-0"
                        onClick={() =>
                          openRemoveDialog(item._id, item.name, currentStock)
                        }
                        title={t("stock_page.title_remove_stock")}
                      >
                        <Minus className="size-3.5 mr-1" />
                        {t("stock_page.remove_btn_short")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[#8b93a7] hover:text-white"
                        onClick={() =>
                          openEditDialog(item._id, item.name, currentStock)
                        }
                        title={t("stock_page.adjust_title")}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-[#8b93a7] hover:text-blue-400"
                        onClick={() => openHistory(item._id, item.name)}
                        title={t("stock_page.history_btn")}
                      >
                        <Clock className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="md:hidden p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {item.isOutOfStock && (
                            <XCircle className="size-3.5 text-red-400 shrink-0" />
                          )}
                          {item.isLowStock && !item.isOutOfStock && (
                            <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
                          )}
                          {!item.isOutOfStock && !item.isLowStock && (
                            <div className="size-2 rounded-full bg-emerald-400 shrink-0" />
                          )}
                          <span className="text-sm text-white font-medium truncate">
                            {item.station === "kitchen" ? (
                              <ChefHat className="size-4 text-orange-400 shrink-0 mr-2 inline" />
                            ) : item.station === "bar" ? (
                              <Wine className="size-4 text-purple-400 shrink-0 mr-2 inline" />
                            ) : null}
                            {item.name}
                          </span>
                        </div>
                        <span
                          className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${item.categoryColor}20`,
                            color: item.categoryColor,
                          }}
                        >
                          {item.categoryName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={cn(
                            "text-xl font-bold tabular-nums",
                            item.isOutOfStock
                              ? "text-red-400"
                              : item.isLowStock
                                ? "text-amber-400"
                                : "text-emerald-400",
                          )}
                        >
                          {currentStock}
                        </span>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs bg-[#1e2a45] text-white hover:bg-[#283350] border-0"
                          onClick={() =>
                            openChangeDialog(item._id, item.name, currentStock)
                          }
                        >
                          <Pencil className="size-3 mr-1" />
                          {t("stock_page.change_btn_short")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Quick Add Side Panel (right) ───────────────── */}
      <Sheet open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <SheetContent
          side="right"
          className="w-full border-l border-slate-200 bg-white p-0 text-slate-900 sm:max-w-md"
        >
          <SheetHeader className="border-b border-slate-200 bg-slate-50 pb-4">
            <SheetTitle className="flex items-center gap-2 text-slate-900">
              <Plus className="size-5 text-emerald-500" />
              {t("stock_page.title_add_stock")}
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-500">
              {t("stock_page.add_intro")}{" "}
              <span className="font-medium text-slate-900">{addItemName}</span>
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600">
                {t("stock_page.label_qty_add")}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={t("stock_page.ph_qty_300")}
                value={addQuantity}
                onChange={(e) => setAddQuantity(e.target.value)}
                className="h-12 rounded-xl border-slate-300 bg-white text-lg text-slate-900 placeholder:text-slate-400 focus-visible:border-[#2a7fff] focus-visible:ring-2 focus-visible:ring-[#2a7fff]/45"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddStock();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600">
                {t("stock_page.label_note_optional")}
              </Label>
              <Input
                placeholder={t("stock_page.ph_note_delivery")}
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#2a7fff] focus-visible:ring-2 focus-visible:ring-[#2a7fff]/45"
              />
            </div>
          </div>
          <SheetFooter className="border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setAddDialogOpen(false)}
              className="rounded-xl px-4 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              {t("btn.cancel")}
            </Button>
            <Button
              onClick={handleAddStock}
              disabled={addLoading}
              className="rounded-xl bg-emerald-600 px-4 text-white hover:bg-emerald-500 disabled:bg-[#244a43] disabled:text-slate-300"
            >
              {addLoading ? t("stock_page.adding") : t("stock_page.title_add_stock")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Quick Remove Side Panel (right) ────────────── */}
      <Sheet open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <SheetContent
          side="right"
          className="w-full border-l border-slate-200 bg-white p-0 text-slate-900 sm:max-w-md"
        >
          <SheetHeader className="border-b border-slate-200 bg-slate-50 pb-4">
            <SheetTitle className="flex items-center gap-2 text-slate-900">
              <Minus className="size-5 text-red-500" />
              {t("stock_page.title_remove_stock")}
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-500">
              {t("stock_page.remove_intro")}{" "}
              <span className="font-medium text-slate-900">{removeItemName}</span>
              <span className="text-slate-500">
                {" "}
                {t("stock_page.current_paren", { current: removeItemCurrent })}
              </span>
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600">
                {t("stock_page.label_qty_remove")}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={removeItemCurrent}
                placeholder={t("stock_page.ph_qty_50")}
                value={removeQuantity}
                onChange={(e) => setRemoveQuantity(e.target.value)}
                className="h-12 rounded-xl border-slate-300 bg-white text-lg text-slate-900 placeholder:text-slate-400 focus-visible:border-[#2a7fff] focus-visible:ring-2 focus-visible:ring-[#2a7fff]/45"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRemoveStock();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600">
                {t("stock_page.label_reason_optional")}
              </Label>
              <Input
                placeholder={t("stock_page.ph_reason_damage")}
                value={removeNote}
                onChange={(e) => setRemoveNote(e.target.value)}
                className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#2a7fff] focus-visible:ring-2 focus-visible:ring-[#2a7fff]/45"
              />
            </div>
          </div>
          <SheetFooter className="border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setRemoveDialogOpen(false)}
              className="rounded-xl px-4 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              {t("btn.cancel")}
            </Button>
            <Button
              onClick={handleRemoveStock}
              disabled={removeLoading}
              className="rounded-xl bg-red-600 px-4 text-white hover:bg-red-500 disabled:bg-red-300"
            >
              {removeLoading ? t("stock_page.removing") : t("stock_page.title_remove_stock")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit (Set) Side Panel (right) ──────────────── */}
      <Sheet open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <SheetContent
          side="right"
          className="w-full border-l border-slate-200 bg-white p-0 text-slate-900 sm:max-w-md"
        >
          <SheetHeader className="border-b border-slate-200 bg-slate-50 pb-4">
            <SheetTitle>{t("stock_page.adjust_title")}</SheetTitle>
            <SheetDescription className="text-slate-500">
              {t("stock_page.set_intro")}{" "}
              <span className="font-medium text-slate-900">{editItemName}</span>
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600">
                {t("stock_page.label_new_stock_level")}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editStockValue}
                onChange={(e) => setEditStockValue(e.target.value)}
                className="h-12 rounded-xl border-slate-300 bg-white text-lg text-slate-900 placeholder:text-slate-400 focus-visible:border-[#2a7fff] focus-visible:ring-2 focus-visible:ring-[#2a7fff]/45"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetStock();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600">
                {t("stock_page.label_reason_optional")}
              </Label>
              <Input
                placeholder={t("stock_page.ph_reason_count")}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-[#2a7fff] focus-visible:ring-2 focus-visible:ring-[#2a7fff]/45"
              />
            </div>
          </div>
          <SheetFooter className="border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setEditDialogOpen(false)}
              className="rounded-xl px-4 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            >
              {t("btn.cancel")}
            </Button>
            <Button
              onClick={handleSetStock}
              disabled={editLoading}
              className="rounded-xl bg-[#1170d8] px-4 text-white hover:bg-[#1f86f5] disabled:bg-[#9fc7ee]"
            >
              {editLoading ? t("stock_page.saving") : t("btn.save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Change Stock Dialog (mobile +/-) ────────────── */}
      <Dialog open={changeDialogOpen} onOpenChange={setChangeDialogOpen}>
        <DialogContent className="bg-[#131A2E] border-[#1e2a45] text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("stock_page.change_title")}</DialogTitle>
            <DialogDescription className="text-[#5a6580]">
              <span className="text-white font-medium">{changeItemName}</span>
              <span className="text-[#5a6580]">
                {" "}
                {t("stock_page.current_paren", { current: changeItemCurrent })}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* +/- toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[#1e2a45]">
              <button
                type="button"
                onClick={() => setChangeMode("add")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  changeMode === "add"
                    ? "bg-emerald-600 text-white"
                    : "bg-[#0A0F1E] text-[#5a6580] hover:text-white",
                )}
              >
                <Plus className="size-4" />
                {t("stock_page.add_btn_short")}
              </button>
              <button
                type="button"
                onClick={() => setChangeMode("remove")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  changeMode === "remove"
                    ? "bg-red-600 text-white"
                    : "bg-[#0A0F1E] text-[#5a6580] hover:text-white",
                )}
              >
                <Minus className="size-4" />
                {t("stock_page.remove_btn_short")}
              </button>
            </div>

            {/* Quantity input */}
            <div className="space-y-2">
              <Label className="text-[#8b93a7]">{t("stock_page.label_quantity")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={changeMode === "remove" ? changeItemCurrent : undefined}
                placeholder={t("stock_page.ph_qty_100")}
                value={changeQuantity}
                onChange={(e) => setChangeQuantity(e.target.value)}
                className="bg-[#0A0F1E] border-[#1e2a45] text-white text-lg h-12"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleChangeStock();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setChangeDialogOpen(false)}
              className="text-[#8b93a7]"
            >
              {t("btn.cancel")}
            </Button>
            <Button
              onClick={handleChangeStock}
              disabled={changeLoading}
              className={cn(
                changeMode === "add"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700",
              )}
            >
              {changeLoading
                ? t("stock_page.saving")
                : changeMode === "add"
                  ? t("stock_page.title_add_stock")
                  : t("stock_page.title_remove_stock")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── History Dialog ─────────────────────────────── */}
      {historyItemId && (
        <StockHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          licenseKey={licenseKey}
          menuItemId={historyItemId}
          itemName={historyItemName}
        />
      )}

      {/* ── Create new supply item (for stock) ───────── */}
      {itemDialogOpen && canCreateSupply && (
        <ItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          licenseKey={licenseKey}
          categories={categoriesForDialog}
          initialStation={
            stockScope === "supply_kitchen"
              ? "kitchen"
              : stockScope === "supply_bar"
                ? "bar"
                : undefined
          }
          initialTrackStock={true}
          initialAvailable={false}
          initialStockUnit={
            stockScope === "supply_kitchen"
              ? "kg"
              : stockScope === "supply_bar"
                ? "lt"
                : undefined
          }
          initialName={searchQuery.trim()}
          dialogNewTitleOverride={
            stockScope === "supply_kitchen"
              ? "supply_kitchen"
              : stockScope === "supply_bar"
                ? "supply_bar"
                : undefined
          }
          onSaved={() => {
            void stockQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

function MallTab({
  selected,
  onClick,
  icon,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border",
        selected
          ? "bg-[#0066FF]/20 border-[#0066FF]/50 text-white"
          : "bg-[#131A2E] border-[#1e2a45] text-[#8b93a7] hover:bg-[#1e2a45] hover:text-white",
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
