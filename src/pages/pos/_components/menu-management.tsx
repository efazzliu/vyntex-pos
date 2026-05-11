import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { Label } from "@/components/ui/label.tsx";
import {
  Plus,
  Pencil,
  Trash2,
  Boxes,
  LayoutGrid,
  Package,
  Search,
  X,
  UtensilsCrossed,
  Star,
  ChefHat,
  Wine,
} from "lucide-react";
import CategoryDialog from "./category-dialog.tsx";
import ItemDialog, { type EditingItem } from "./item-dialog.tsx";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";

const ACCENT_BLUE = "#0066FF";
const ACCENT_GREEN = "#22c55e";

/** Same names as supply auto-category (`ensureSupplyCategory`); hidden from product category strip. */
const SUPPLY_CATEGORY_STRIP_KEYS = new Set([
  "furnizim",
  "mall",
  "mall kuzhine",
  "mall kuzhinë",
  "stok",
  "stoku",
  "inventory",
]);

function isSupplyStripCategoryName(name: string | undefined): boolean {
  if (!name?.trim()) return false;
  const n = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SUPPLY_CATEGORY_STRIP_KEYS.has(n);
}

function menuItemsCountLabel(
  count: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return t(
    count === 1 ? "menu_page.item_count_one" : "menu_page.item_count_other",
    { count },
  );
}

type CategoryData = {
  _id: Id<"menuCategories">;
  name: string;
  color: string;
  icon?: string;
  isActive: boolean;
};

type MenuManagementProps = {
  licenseKey: string;
  /** Logged on stock movements when adjusting mall supply from the table. */
  stockActorName?: string;
  /** Enterprise: mall kuzhinë/shank, supply strip, stock adjust from list. */
  enterpriseSupplyMall?: boolean;
  /** Enterprise: optional BOM / recipe on menu items (përbërës → furnizim). */
  enterpriseSupplyRecipe?: boolean;
};

export default function MenuManagement({
  licenseKey,
  stockActorName = "",
  enterpriseSupplyMall = false,
}: MenuManagementProps) {
  const { t, formatPrice } = usePosLocale();
  const isOnline = useOnlineStatus();
  const categoriesQuery = useQuery('pos.menu.getCategories', { licenseKey });
  const menusQuery = useQuery('pos.menu.getMenus', { licenseKey });
  const allItemsQuery = useQuery('pos.menu.getAllItems', { licenseKey });
  const { data: categoriesData } = useOfflineData<Doc<"menuCategories">[]>(
    `categories:${licenseKey}`,
    categoriesQuery,
    isOnline,
  );
  const { data: allItemsData } = useOfflineData<Doc<"menuItems">[]>(
    `menuItems:${licenseKey}`,
    allItemsQuery,
    isOnline,
  );
  const sourceCategories = categoriesData ?? [];
  const sourceItems = allItemsData ?? [];

  const deleteCategory = useMutation('pos.menu.deleteCategory');
  const deleteItem = useMutation('pos.menu.deleteItem');
  const toggleAvailability = useMutation('pos.menu.toggleItemAvailability');
  const createMenu = useMutation('pos.menu.createMenu');
  const deleteMenu = useMutation('pos.menu.deleteMenu');
  const updateMenu = useMutation('pos.menu.updateMenu');
  const addStock = useMutation("pos.stock.addStock");
  const removeStock = useMutation("pos.stock.removeStock");

  // Filter state
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<Id<"menuCategories"> | "all">("all");
  const [selectedMenuId, setSelectedMenuId] =
    useState<Id<"menus"> | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mallView, setMallView] = useState<"none" | "kitchen" | "bar">("none");

  // Selection for bulk actions
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(
    null
  );
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [newMenuName, setNewMenuName] = useState("");
  const [editingMenu, setEditingMenu] = useState<Doc<"menus"> | null>(null);

  const [mallStockOpen, setMallStockOpen] = useState(false);
  const [mallStockItemId, setMallStockItemId] = useState<Id<"menuItems"> | null>(
    null,
  );
  const [mallStockItemName, setMallStockItemName] = useState("");
  const [mallStockCurrent, setMallStockCurrent] = useState(0);
  const [mallStockMode, setMallStockMode] = useState<"add" | "remove">("add");
  const [mallStockQty, setMallStockQty] = useState("");
  const [mallStockLoading, setMallStockLoading] = useState(false);
  const [mallStockPickerOpen, setMallStockPickerOpen] = useState(false);

  const sourceMenus = Array.isArray(menusQuery) ? menusQuery : [];
  const [categories, setCategories] = useState<Doc<"menuCategories">[]>([]);
  const [allItems, setAllItems] = useState<Doc<"menuItems">[]>([]);
  const [menus, setMenus] = useState<Doc<"menus">[]>([]);
  const isLoading = false;

  useEffect(() => {
    if (categoriesData !== undefined) {
      setCategories(categoriesData);
    }
  }, [categoriesData]);

  useEffect(() => {
    if (allItemsData !== undefined) {
      setAllItems(allItemsData);
    }
  }, [allItemsData]);

  useEffect(() => {
    if (Array.isArray(menusQuery)) {
      setMenus(menusQuery);
    }
  }, [menusQuery]);

  /** Supply bucket categories hidden from strip on Enterprise mall flow only. */
  const categoriesForProductStrip = useMemo(
    () =>
      enterpriseSupplyMall
        ? categories.filter((c) => !isSupplyStripCategoryName(c.name))
        : categories,
    [categories, enterpriseSupplyMall],
  );

  useEffect(() => {
    if (!enterpriseSupplyMall) return;
    if (selectedCategoryId === "all") return;
    const cat = categories.find((c) => c._id === selectedCategoryId);
    if (cat && isSupplyStripCategoryName(cat.name)) {
      setSelectedCategoryId("all");
    }
  }, [categories, selectedCategoryId, enterpriseSupplyMall]);

  useEffect(() => {
    if (!enterpriseSupplyMall && mallView !== "none") {
      setMallView("none");
    }
  }, [enterpriseSupplyMall, mallView]);

  useEffect(() => {
    if (!enterpriseSupplyMall) {
      setMallStockPickerOpen(false);
      setMallStockOpen(false);
    }
  }, [enterpriseSupplyMall]);

  // Derived data
  const getItemCountForCategory = (catId: Id<"menuCategories">) =>
    allItems?.filter((item) => item.categoryId === catId).length ?? 0;
  const totalItemCount = allItems?.length ?? 0;

  // Filter items by category, menu, and search
  const filteredItems = allItems
    ?.filter((item) => {
      if (mallView !== "none") {
        // "Mall" view ignores menu/category filters and shows only stock-tracked items
        // for the selected station (kitchen / bar).
        if (!item.trackStock) return false;
        if (item.station !== mallView) return false;
      } else {
        if (
          selectedCategoryId !== "all" &&
          item.categoryId !== selectedCategoryId
        )
          return false;
        if (selectedMenuId !== "all" && item.menuId !== selectedMenuId)
          return false;
      }
        if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!item.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  /** Mall rows for current station (no search) — used by header “change stock” picker. */
  const mallStockPickerItems = useMemo(() => {
    if (mallView === "none") return [];
    return (allItems ?? [])
      .filter((item) => item.trackStock && item.station === mallView)
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));
  }, [allItems, mallView]);

  // Bulk selection
  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked =
    filteredItems && filteredItems.length > 0
      ? filteredItems.every((i) => selectedItems.has(i._id))
      : false;
  const selectedFilteredIds =
    filteredItems?.filter((i) => selectedItems.has(i._id)).map((i) => i._id) ?? [];
  const selectedFilteredCount = selectedFilteredIds.length;

  const toggleAll = () => {
    if (allChecked) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems?.map((i) => i._id) ?? []));
    }
  };

  const selectedCategoryDisplayName =
    selectedCategoryId === "all"
      ? t("menu_page.all")
      : categories?.find((c) => c._id === selectedCategoryId)?.name ??
        t("menu_page.all");
  const mallTitle =
    mallView === "none"
      ? null
      : mallView === "kitchen"
        ? t("menu_page.mall_kitchen_title")
        : t("menu_page.mall_bar_title");

  // ── Handlers ──────────────────────────────────────

  const handleDeleteCategory = async (catId: Id<"menuCategories">) => {
    const itemCount =
      allItems?.filter((i) => i.categoryId === catId).length ?? 0;
    if (
      !window.confirm(
        itemCount > 0
          ? t("menu_page.confirm_del_cat_items")
          : t("menu_page.confirm_del_cat"),
      )
    )
      return;
    try {
      await deleteCategory({ licenseKey, categoryId: catId });
      setCategories((prev) => prev.filter((c) => c._id !== catId));
      setAllItems((prev) => prev.filter((i) => i.categoryId !== catId));
      const cachedCategories =
        (await getDataCache<Doc<"menuCategories">[]>(`categories:${licenseKey}`)) ?? [];
      await saveDataCache(
        `categories:${licenseKey}`,
        cachedCategories.filter((c) => c._id !== catId),
      );
      const cachedItems =
        (await getDataCache<Doc<"menuItems">[]>(`menuItems:${licenseKey}`)) ?? [];
      await saveDataCache(
        `menuItems:${licenseKey}`,
        cachedItems.filter((i) => i.categoryId !== catId),
      );
      if (selectedCategoryId === catId) setSelectedCategoryId("all");
      toast.success(t("menu_page.cat_deleted"));
    } catch {
      toast.error(t("menu_page.cat_delete_fail"));
    }
  };

  const handleDeleteItem = async (itemId: Id<"menuItems">) => {
    if (!window.confirm(t("menu_page.confirm_del_item"))) return;
    try {
      await deleteItem({ licenseKey, itemId });
      setAllItems((prev) => prev.filter((i) => i._id !== itemId));
      const cachedItems =
        (await getDataCache<Doc<"menuItems">[]>(`menuItems:${licenseKey}`)) ?? [];
      await saveDataCache(
        `menuItems:${licenseKey}`,
        cachedItems.filter((i) => i._id !== itemId),
      );
      toast.success(t("menu_page.item_deleted"));
    } catch {
      toast.error(t("menu_page.item_delete_fail"));
    }
  };

  const handleDeleteSelectedItems = async () => {
    if (selectedFilteredCount <= 0) return;
    if (
      !window.confirm(
        t("menu_page.confirm_del_selected", { selectedCount: selectedFilteredCount }),
      )
    ) {
      return;
    }

    const deletedIds: Id<"menuItems">[] = [];
    for (const itemId of selectedFilteredIds) {
      try {
        await deleteItem({ licenseKey, itemId });
        deletedIds.push(itemId);
      } catch {
        // Keep going so one failed item doesn't block the rest.
      }
    }

    if (deletedIds.length <= 0) {
      toast.error(t("menu_page.items_delete_fail"));
      return;
    }

    const deletedSet = new Set(deletedIds);
    setAllItems((prev) => prev.filter((i) => !deletedSet.has(i._id)));
    setSelectedItems((prev) => {
      const next = new Set(prev);
      for (const id of deletedIds) next.delete(id);
      return next;
    });
    const cachedItems =
      (await getDataCache<Doc<"menuItems">[]>(`menuItems:${licenseKey}`)) ?? [];
    await saveDataCache(
      `menuItems:${licenseKey}`,
      cachedItems.filter((i) => !deletedSet.has(i._id)),
    );

    const failedCount = selectedFilteredCount - deletedIds.length;
    if (failedCount > 0) {
      toast.error(
        t("menu_page.items_delete_partial", {
          deleted: deletedIds.length,
          failed: failedCount,
        }),
      );
      return;
    }

    toast.success(t("menu_page.items_deleted", { deletedCount: deletedIds.length }));
  };

  const handleToggleAvailability = async (itemId: Id<"menuItems">) => {
    try {
      await toggleAvailability({ licenseKey, itemId });
      setAllItems((prev) =>
        prev.map((i) => (i._id === itemId ? { ...i, available: !i.available } : i)),
      );
      const cachedItems =
        (await getDataCache<Doc<"menuItems">[]>(`menuItems:${licenseKey}`)) ?? [];
      await saveDataCache(
        `menuItems:${licenseKey}`,
        cachedItems.map((i) =>
          i._id === itemId ? { ...i, available: !i.available } : i,
        ),
      );
    } catch {
      toast.error(t("menu_page.avail_fail"));
    }
  };

  const openMallStockAdjust = (item: Doc<"menuItems">) => {
    if (!item.trackStock) return;
    setMallStockItemId(item._id);
    setMallStockItemName(item.name ?? "");
    setMallStockCurrent(item.currentStock ?? 0);
    setMallStockMode("add");
    setMallStockQty("");
    setMallStockOpen(true);
  };

  const submitMallStockAdjust = async () => {
    if (!mallStockItemId) return;
    const qty = parseFloat(mallStockQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error(t("stock_page.qty_invalid"));
      return;
    }
    if (mallStockMode === "remove" && qty > mallStockCurrent) {
      toast.error(t("stock_page.qty_remove_max", { current: mallStockCurrent }));
      return;
    }
    setMallStockLoading(true);
    try {
      const actor = stockActorName.trim() || "Menu";
      const newBalance =
        mallStockMode === "add"
          ? await addStock({
              licenseKey,
              itemId: mallStockItemId,
              quantity: qty,
              staffName: actor,
              note: t("menu_page.stock_quick_note"),
            })
          : await removeStock({
              licenseKey,
              itemId: mallStockItemId,
              quantity: qty,
              staffName: actor,
              note: t("menu_page.stock_quick_note"),
            });
      setAllItems((prev) =>
        prev.map((i) =>
          i._id === mallStockItemId ? { ...i, currentStock: newBalance } : i,
        ),
      );
      const cachedItems =
        (await getDataCache<Doc<"menuItems">[]>(`menuItems:${licenseKey}`)) ?? [];
      await saveDataCache(
        `menuItems:${licenseKey}`,
        cachedItems.map((i) =>
          i._id === mallStockItemId ? { ...i, currentStock: newBalance } : i,
        ),
      );
      toast.success(
        mallStockMode === "add"
          ? t("stock_page.added", { qty, balance: newBalance })
          : t("stock_page.removed", { qty, balance: newBalance }),
      );
      setMallStockOpen(false);
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("menu_page.stock_quick_fail")));
    } finally {
      setMallStockLoading(false);
    }
  };

  const handleAddMenu = async () => {
    if (!newMenuName.trim()) {
      toast.error(t("menu_page.menu_name_required"));
      return;
    }
    try {
      await createMenu({ licenseKey, name: newMenuName.trim() });
      const newMenu: Doc<"menus"> = {
        _id: crypto.randomUUID() as Id<"menus">,
        _creationTime: Date.now(),
        licenseKey,
        name: newMenuName.trim(),
        isActive: true,
      };
      setMenus((prev) => [...prev, newMenu]);
      const cachedMenus =
        (await getDataCache<Doc<"menus">[]>(`menus:${licenseKey}`)) ?? [];
      await saveDataCache(`menus:${licenseKey}`, [...cachedMenus, newMenu]);
      toast.success(t("menu_page.menu_created"));
      setMenuDialogOpen(false);
      setNewMenuName("");
    } catch {
      toast.error(t("menu_page.menu_create_fail"));
    }
  };

  const handleUpdateMenu = async () => {
    if (!editingMenu || !newMenuName.trim()) return;
    try {
      const nextName = newMenuName.trim();
      await updateMenu({
        licenseKey,
        menuId: editingMenu._id,
        name: nextName,
        isActive: editingMenu.isActive,
      });
      setMenus((prev) =>
        prev.map((m) =>
          m._id === editingMenu._id ? { ...m, name: nextName } : m,
        ),
      );
      const cachedMenus =
        (await getDataCache<Doc<"menus">[]>(`menus:${licenseKey}`)) ?? [];
      await saveDataCache(
        `menus:${licenseKey}`,
        cachedMenus.map((m) =>
          m._id === editingMenu._id ? { ...m, name: nextName } : m,
        ),
      );
      toast.success(t("menu_page.menu_updated"));
      setEditingMenu(null);
      setMenuDialogOpen(false);
      setNewMenuName("");
    } catch {
      toast.error(t("menu_page.menu_update_fail"));
    }
  };

  const handleDeleteMenu = async (menuId: Id<"menus">) => {
    if (!window.confirm(t("menu_page.confirm_del_menu"))) return;
    try {
      await deleteMenu({ licenseKey, menuId });
      setMenus((prev) => prev.filter((m) => m._id !== menuId));
      const cachedMenus =
        (await getDataCache<Doc<"menus">[]>(`menus:${licenseKey}`)) ?? [];
      await saveDataCache(
        `menus:${licenseKey}`,
        cachedMenus.filter((m) => m._id !== menuId),
      );
      if (selectedMenuId === menuId) setSelectedMenuId("all");
      toast.success(t("menu_page.menu_deleted"));
    } catch {
      toast.error(t("menu_page.menu_delete_fail"));
    }
  };

  // ── Loading ───────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-[96px] w-[110px] rounded-2xl bg-[#1a1f2e] shrink-0"
            />
          ))}
        </div>
        <Skeleton className="h-8 w-64 bg-[#1a1f2e]" />
        <Skeleton className="h-10 w-full bg-[#1a1f2e]" />
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-[#1a1f2e]" />
          ))}
        </div>
      </div>
    );
  }

  // ── Main View ─────────────────────────────────────

  return (
    <div className="min-h-full space-y-6 bg-gradient-to-b from-slate-50 to-white p-6 lg:p-8">
      {/* ─── 1. Category Cards ─────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">{t("menu_page.categories")}</h2>

        {categories.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UtensilsCrossed />
                </EmptyMedia>
                <EmptyTitle>{t("menu_page.no_categories")}</EmptyTitle>
                <EmptyDescription>{t("menu_page.no_categories_desc")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryDialogOpen(true);
                  }}
                >
                  <Plus className="size-4 mr-1" />
                  {t("menu_page.add_category")}
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 px-1 -mx-1 scrollbar-thin">
            {/* "All" card */}
            <CategoryCard
              icon={<LayoutGrid className="size-4" style={{ color: ACCENT_BLUE }} />}
              name={t("menu_page.all")}
              countLabel={menuItemsCountLabel(totalItemCount, t)}
              isSelected={selectedCategoryId === "all"}
              onClick={() => setSelectedCategoryId("all")}
            />

            {categoriesForProductStrip.map((cat) => (
              <CategoryCard
                key={cat._id}
                icon={(() => {
                  const glyph =
                    (cat.icon && String(cat.icon).trim()) ||
                    emojiForCategoryName(cat.name ?? "");
                  if (glyph)
                    return <span className="text-lg leading-none">{glyph}</span>;
                  return (
                    <UtensilsCrossed
                      className="size-4"
                      style={{ color: ACCENT_BLUE }}
                    />
                  );
                })()}
                name={cat.name}
                countLabel={menuItemsCountLabel(
                  getItemCountForCategory(cat._id),
                  t,
                )}
                isSelected={selectedCategoryId === cat._id}
                onClick={() => setSelectedCategoryId(cat._id)}
                onEdit={() => {
                  setEditingCategory({
                    _id: cat._id,
                    name: cat.name,
                    color: cat.color,
                    icon: cat.icon,
                    isActive: cat.isActive,
                  });
                  setCategoryDialogOpen(true);
                }}
                onDelete={() => handleDeleteCategory(cat._id)}
                isHidden={!cat.isActive}
              />
            ))}

            {/* Add Category card */}
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryDialogOpen(true);
              }}
              className="flex flex-col items-center justify-center gap-1 min-w-[88px] px-3 py-2.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0066FF] text-slate-500 hover:text-[#0066FF] transition-all cursor-pointer shrink-0 bg-white"
            >
              <Plus className="size-4" />
              <span className="text-[10px] font-semibold whitespace-nowrap">
                {t("menu_page.add_category")}
              </span>
            </button>
          </div>
        )}
      </section>

      {/* ─── 1b. Mall (Enterprise only) ───────────────── */}
      {enterpriseSupplyMall ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">{t("menu_page.mall")}</h2>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <MallPill
              selected={mallView === "none"}
              icon={<Package className="size-4" style={{ color: ACCENT_BLUE }} />}
              onClick={() => setMallView("none")}
            >
              {t("menu_page.mall_all")}
            </MallPill>

            <MallPill
              selected={mallView === "kitchen"}
              icon={<ChefHat className="size-4" style={{ color: ACCENT_GREEN }} />}
              onClick={() => {
                setMallView("kitchen");
                setSelectedCategoryId("all");
                setSelectedMenuId("all");
                setSelectedItems(new Set());
              }}
            >
              {t("menu_page.mall_kitchen")}
            </MallPill>

            <MallPill
              selected={mallView === "bar"}
              icon={<Wine className="size-4" style={{ color: ACCENT_BLUE }} />}
              onClick={() => {
                setMallView("bar");
                setSelectedCategoryId("all");
                setSelectedMenuId("all");
                setSelectedItems(new Set());
              }}
            >
              {t("menu_page.mall_bar")}
            </MallPill>
          </div>
        </section>
      ) : null}

      {/* ─── 2. Header + Filters ───────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900">
            {mallTitle ??
              (selectedCategoryId === "all"
                ? t("menu_page.all_items_title")
                : t("menu_page.category_items", {
                    name: selectedCategoryDisplayName,
                  }))}
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {selectedFilteredCount > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleDeleteSelectedItems}
              >
                <Trash2 className="mr-1.5 size-4" />
                {t("menu_page.delete_selected", { selectedCount: selectedFilteredCount })}
              </Button>
            ) : null}
            {enterpriseSupplyMall && mallView !== "none" ? (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-200 font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setMallStockPickerOpen(true)}
              >
                <Boxes className="mr-1.5 size-4" />
                {t("menu_page.mall_change_stock_btn")}
              </Button>
            ) : null}
            <Button
              size="sm"
              className="bg-[#0066FF] hover:bg-[#0055dd] text-white font-semibold"
              onClick={() => {
                if (
                  (!categories || categories.length === 0) &&
                  mallView === "none"
                ) {
                  toast.error(t("menu_page.create_category_first"));
                  return;
                }
                setEditingItem(null);
                setItemDialogOpen(true);
              }}
            >
              <Plus className="size-4 mr-1.5" />
              {enterpriseSupplyMall && mallView !== "none"
                ? t("menu_page.add_mall_item")
                : t("menu_page.add_item")}
            </Button>
          </div>
        </div>

        {/* Menu filter pills + search */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {mallView === "none" ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <MenuPill
              selected={selectedMenuId === "all"}
              onClick={() => setSelectedMenuId("all")}
            >
              {t("menu_page.all_menus")}
            </MenuPill>
            {menus.map((m) => (
              <div key={m._id} className="relative group shrink-0">
                <MenuPill
                  selected={selectedMenuId === m._id}
                  onClick={() => setSelectedMenuId(m._id)}
                >
                  {m.name}
                </MenuPill>
                <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5 z-10">
                  <button
                    onClick={() => {
                      setEditingMenu(m);
                      setNewMenuName(m.name);
                      setMenuDialogOpen(true);
                    }}
                    className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-300"
                  >
                    <Pencil className="size-2 text-slate-600" />
                  </button>
                  <button
                    onClick={() => handleDeleteMenu(m._id)}
                    className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center cursor-pointer hover:bg-red-100"
                  >
                    <X className="size-2 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                setEditingMenu(null);
                setNewMenuName("");
                setMenuDialogOpen(true);
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-[#0066FF] transition-all cursor-pointer border border-dashed border-slate-300 hover:border-[#0066FF] shrink-0 whitespace-nowrap bg-white"
            >
              <Plus className="size-3 inline-block mr-0.5 -mt-0.5" />
              {t("menu_page.add_menu")}
            </button>
            </div>
          ) : null}

          <div className="relative w-full max-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("menu_page.search_ph")}
              className="bg-white border-slate-200 text-slate-900 pl-10 h-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ─── 3. Product Table ──────────────────────── */}
      {filteredItems && filteredItems.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 shadow-sm">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package />
              </EmptyMedia>
              <EmptyTitle>{t("menu_page.empty_items")}</EmptyTitle>
              <EmptyDescription>
                {categories.length === 0
                  ? t("menu_page.empty_items_no_cat")
                  : searchQuery
                    ? t("menu_page.empty_items_search")
                    : t("menu_page.empty_items_default")}
              </EmptyDescription>
            </EmptyHeader>
            {(categories.length > 0 || (enterpriseSupplyMall && mallView !== "none")) &&
              !searchQuery && (
              <EmptyContent>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {enterpriseSupplyMall && mallView !== "none" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-200 font-semibold text-slate-700"
                      onClick={() => setMallStockPickerOpen(true)}
                    >
                      <Boxes className="mr-1.5 size-4" />
                      {t("menu_page.mall_change_stock_btn")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingItem(null);
                      setItemDialogOpen(true);
                    }}
                  >
                    <Plus className="size-4 mr-1" />
                    {enterpriseSupplyMall && mallView !== "none"
                      ? t("menu_page.add_mall_item")
                      : t("menu_page.add_item")}
                  </Button>
                </div>
              </EmptyContent>
            )}
          </Empty>
        </div>
      )}

      {filteredItems && filteredItems.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[44px_1fr_140px_120px_90px_110px_118px] items-center gap-3 bg-slate-50 px-4 py-3">
            <div className="flex justify-center">
              <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t("menu_page.col_product")}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">
              {t("menu_page.col_stock")}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">
              {t("menu_page.col_category")}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">
              {t("menu_page.col_price")}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">
              {t("menu_page.col_availability")}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">
              {t("menu_page.col_actions")}
            </span>
          </div>

          {/* Table rows */}
          {filteredItems.map((item) => {
            const category = categories.find(
              (c) => c._id === item.categoryId
            );
            const catColor = category?.color ?? ACCENT_BLUE;
            const isChecked = selectedItems.has(item._id);
            const stockVal = item.trackStock
              ? (item.currentStock ?? 0)
              : null;
            const isLowStock =
              item.trackStock &&
              item.lowStockThreshold !== undefined &&
              (item.currentStock ?? 0) <= item.lowStockThreshold;
            const isOutOfStock =
              item.trackStock && (item.currentStock ?? 0) <= 0;
            const stockUnitRaw = item.stockUnit?.trim();
            const stockUnitDisplay =
              stockUnitRaw === "pc"
                ? t("menu_page.stock_unit_pc")
                : stockUnitRaw;

            return (
              <div
                key={item._id}
                className={cn(
                  "grid grid-cols-[44px_1fr_140px_120px_90px_110px_118px] items-center gap-3 px-4 py-3 border-t border-slate-200 transition-colors",
                  isChecked
                    ? "bg-[#0066FF]/5"
                    : "bg-white hover:bg-slate-50"
                )}
              >
                {/* Checkbox */}
                <div className="flex justify-center">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleItem(item._id)}
                  />
                </div>

                {/* Product: Thumbnail + Name + Description */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-500">
                        {(item.name?.charAt(0) ?? "?").toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {item.name}
                      </p>
                      {item.isFavorite && (
                        <Star className="size-3 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stock (read-only; adjust from Stoku or edit row) */}
                <div className="min-w-0 text-center">
                  {stockVal !== null ? (
                    <span
                      className={cn(
                        "inline-block text-sm font-medium tabular-nums",
                        isOutOfStock
                          ? "text-red-400"
                          : isLowStock
                            ? "text-amber-400"
                            : "text-slate-600",
                      )}
                    >
                      {stockVal}
                      {stockUnitDisplay ? (
                        <span className="text-[11px] font-normal text-slate-500">
                          {" "}
                          {stockUnitDisplay}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-slate-400">
                      {"\u2014"}
                    </span>
                  )}
                </div>

                {/* Category */}
                <div className="flex min-w-0 justify-center">
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full truncate max-w-[120px]"
                    style={{
                      backgroundColor: `${catColor}18`,
                      color: catColor,
                    }}
                  >
                    {category?.name ?? "\u2014"}
                  </span>
                </div>

                {/* Price */}
                <span className="text-sm font-bold text-slate-900 text-right">
                  {formatPrice(
                    typeof item.price === "number" && Number.isFinite(item.price)
                      ? item.price
                      : 0,
                  )}
                </span>

                {/* Availability */}
                <div className="flex justify-center">
                  <button
                    onClick={() => handleToggleAvailability(item._id)}
                    className={cn(
                      "text-[11px] font-semibold px-3 py-1 rounded-full cursor-pointer transition-colors whitespace-nowrap",
                      item.available
                        ? "bg-emerald-500/12 text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-red-500/12 text-red-400 hover:bg-red-500/20"
                    )}
                  >
                    {item.available
                      ? t("menu_page.in_stock")
                      : t("menu_page.out_of_stock")}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-0.5">
                  {enterpriseSupplyMall && mallView !== "none" && item.trackStock ? (
                    <button
                      type="button"
                      title={t("stock_page.change_title")}
                      aria-label={t("stock_page.change_title")}
                      onClick={() => openMallStockAdjust(item)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors text-slate-500 hover:text-[#0066FF]"
                    >
                      <Boxes className="size-3.5" strokeWidth={2} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    title={t("btn.edit")}
                    aria-label={t("btn.edit")}
                    onClick={() => {
                      setEditingItem(item);
                      setItemDialogOpen(true);
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <Pencil className="size-3.5 text-slate-500" />
                  </button>
                  <button
                    type="button"
                    title={t("btn.delete")}
                    aria-label={t("btn.delete")}
                    onClick={() => handleDeleteItem(item._id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="size-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Dialogs ─────────────────────────────────── */}
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        licenseKey={licenseKey}
        editing={editingCategory}
        onSaved={(category, mode) => {
          if (mode === "create") {
            const created: Doc<"menuCategories"> = {
              _id: category._id,
              _creationTime: Date.now(),
              licenseKey,
              name: category.name,
              color: category.color,
              icon: category.icon,
              isActive: category.isActive,
            };
            setCategories((prev) => [...prev, created]);
          } else {
            setCategories((prev) =>
              prev.map((c) =>
                c._id === category._id ? { ...c, ...category } : c,
              ),
            );
          }
        }}
      />

      <ItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          licenseKey={licenseKey}
          categoryId={
            selectedCategoryId !== "all" ? selectedCategoryId : undefined
          }
          categories={categories.map((c) => ({
            _id: c._id,
            name: c.name,
            color: c.color,
            icon: c.icon,
          }))}
          enterpriseSupplyRecipe={enterpriseSupplyRecipe}
          dialogNewTitleOverride={
            enterpriseSupplyMall && mallView === "kitchen"
              ? "supply_kitchen"
              : enterpriseSupplyMall && mallView === "bar"
                ? "supply_bar"
                : undefined
          }
          initialStation={
            enterpriseSupplyMall && mallView === "kitchen"
              ? "kitchen"
              : enterpriseSupplyMall && mallView === "bar"
                ? "bar"
                : undefined
          }
          initialTrackStock={
            enterpriseSupplyMall && mallView !== "none" ? true : undefined
          }
          initialAvailable={
            enterpriseSupplyMall && mallView !== "none" ? false : undefined
          }
          initialStockUnit={
            enterpriseSupplyMall && mallView === "kitchen"
              ? "kg"
              : enterpriseSupplyMall && mallView === "bar"
                ? "lt"
                : undefined
          }
          onSaved={(item, mode) => {
            if (mode === "create") {
              const restaurantId =
                sourceCategories[0]?.restaurantId ??
                categories[0]?.restaurantId ??
                allItems.find((i) => i.restaurantId)?.restaurantId;
              if (!restaurantId) {
                toast.error(t("menu_page.create_item_sync"));
                return;
              }
              const created: Doc<"menuItems"> = {
                _id: item._id,
                _creationTime: Date.now(),
                restaurantId,
                categoryId: item.categoryId,
                menuId: item.menuId,
                name: item.name,
                description: item.description,
                price: item.price,
                available: item.available ?? true,
                station: item.station,
                imageStorageId: item.imageStorageId,
                imageUrl: item.imageUrl,
                isFavorite: item.isFavorite ?? false,
                staffMealAllowed:
                  (item as { staffMealAllowed?: boolean }).staffMealAllowed !==
                  false,
                staffMealPrice: (item as { staffMealPrice?: number }).staffMealPrice,
                trackStock: item.trackStock ?? false,
                stockUnit: item.stockUnit,
                initialStock: item.initialStock,
                currentStock: item.currentStock,
                lowStockThreshold: item.lowStockThreshold,
                supplyVendor: item.supplyVendor,
                supplyLot: item.supplyLot,
                supplyExpiryDate: item.supplyExpiryDate,
                supplyStorage: item.supplyStorage,
                supplyRecipe: item.supplyRecipe,
                displayOrder: Date.now(),
              };
              setAllItems((prev) => [...prev, created]);
            } else {
              setAllItems((prev) =>
                prev.map((it) =>
                  it._id === item._id ? ({ ...it, ...item } as Doc<"menuItems">) : it,
                ),
              );
            }
          }}
          editing={editingItem}
        />

      {enterpriseSupplyMall ? (
        <>
      <Sheet open={mallStockPickerOpen} onOpenChange={setMallStockPickerOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full max-w-none flex-col gap-0 border-slate-200 bg-white p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-slate-200 bg-slate-50 text-left">
            <SheetTitle className="pr-8 text-slate-900">
              {t("menu_page.mall_pick_item_title")}
            </SheetTitle>
            <SheetDescription className="text-slate-600">
              {t("menu_page.mall_pick_item_desc")}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3">
            {mallStockPickerItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {t("menu_page.mall_pick_item_empty")}
              </p>
            ) : (
              mallStockPickerItems.map((item) => {
                const raw = item.stockUnit?.trim();
                const unitLabel =
                  raw === "pc" ? t("menu_page.stock_unit_pc") : raw;
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => {
                      setMallStockPickerOpen(false);
                      openMallStockAdjust(item);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0 truncate font-medium text-slate-900">
                      {item.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-600">
                      {item.currentStock ?? 0}
                      {unitLabel ? (
                        <span className="text-xs font-normal text-slate-500">
                          {" "}
                          {unitLabel}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <SheetFooter className="shrink-0 border-t border-slate-200 bg-slate-50 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setMallStockPickerOpen(false)}>
              {t("btn.cancel")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={mallStockOpen}
        onOpenChange={(open) => {
          setMallStockOpen(open);
          if (!open) {
            setMallStockItemId(null);
            setMallStockQty("");
          }
        }}
      >
        <DialogContent className="border-slate-200 bg-white text-slate-900 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("stock_page.change_title")}</DialogTitle>
            <DialogDescription className="text-slate-600">
              <span className="font-medium text-slate-900">{mallStockItemName}</span>{" "}
              {t("stock_page.current_paren", { current: mallStockCurrent })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <nav
              className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-200 pb-3"
              aria-label={t("stock_page.change_title")}
            >
              <button
                type="button"
                onClick={() => setMallStockMode("add")}
                className={cn(
                  "shrink-0 cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
                  mallStockMode === "add"
                    ? "border-transparent bg-gradient-to-r from-[#0066FF] to-[#22c55e] text-white shadow-md shadow-[#0066FF]/15"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {t("stock_page.add_btn_short")}
              </button>
              <button
                type="button"
                onClick={() => setMallStockMode("remove")}
                className={cn(
                  "shrink-0 cursor-pointer rounded-full border px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
                  mallStockMode === "remove"
                    ? "border-transparent bg-gradient-to-r from-[#0066FF] to-[#22c55e] text-white shadow-md shadow-[#0066FF]/15"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {t("stock_page.remove_btn_short")}
              </button>
            </nav>
            <div className="space-y-2">
              <Label className="text-slate-700">{t("stock_page.label_quantity")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={mallStockMode === "remove" ? mallStockCurrent : undefined}
                placeholder={t("stock_page.ph_qty_100")}
                value={mallStockQty}
                onChange={(e) => setMallStockQty(e.target.value)}
                className="h-11 border-slate-200 text-slate-900"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitMallStockAdjust();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMallStockOpen(false)}>
              {t("btn.cancel")}
            </Button>
            <Button
              onClick={() => void submitMallStockAdjust()}
              disabled={mallStockLoading}
            >
              {mallStockLoading ? t("stock_page.saving") : t("btn.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      ) : null}

      {/* Menu add/edit dialog */}
      <Dialog
        open={menuDialogOpen}
        onOpenChange={(open) => {
          setMenuDialogOpen(open);
          if (!open) {
            setEditingMenu(null);
            setNewMenuName("");
          }
        }}
      >
        <DialogContent className="border-slate-200 bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle>
              {editingMenu
                ? t("menu_page.rename_menu")
                : t("menu_page.new_menu")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newMenuName}
              onChange={(e) => setNewMenuName(e.target.value)}
              placeholder={t("menu_page.menu_name_ph")}
              className="bg-white border-slate-200 text-slate-900"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (editingMenu) handleUpdateMenu();
                  else handleAddMenu();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setMenuDialogOpen(false)}
              className="text-slate-500"
            >
              {t("btn.cancel")}
            </Button>
            <Button
              onClick={editingMenu ? handleUpdateMenu : handleAddMenu}
              disabled={!newMenuName.trim()}
            >
              {editingMenu ? t("btn.save") : t("menu_page.add_menu_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────

function CategoryCard({
  icon,
  name,
  countLabel,
  isSelected,
  onClick,
  onEdit,
  onDelete,
  isHidden,
}: {
  icon: ReactNode;
  name: string;
  countLabel: string;
  isSelected: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isHidden?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative group flex flex-col items-center gap-1 min-w-[88px] px-3 py-2.5 rounded-xl cursor-pointer transition-all shrink-0",
        isSelected
          ? "bg-[#0066FF]/10 ring-2 ring-[#0066FF] shadow-lg shadow-[#0066FF]/10"
          : "bg-white hover:bg-slate-50 border border-slate-200",
        isHidden && "opacity-40"
      )}
    >
      {/* Hover edit/delete buttons */}
      {(onEdit || onDelete) && (
        <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5 z-10">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-100"
            >
              <Pencil className="size-2.5 text-slate-500" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-red-100"
            >
              <Trash2 className="size-2.5 text-red-400" />
            </button>
          )}
        </div>
      )}

      <div className="w-8 h-8 rounded-lg bg-[#0066FF]/10 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-[11px] font-semibold text-slate-900 truncate max-w-[80px]">
        {name}
      </span>
      <span className="text-[9px] text-slate-500 leading-tight">
        {countLabel}
      </span>
    </div>
  );
}

function MenuPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0",
        selected
          ? "bg-gradient-to-r from-[#0066FF] to-[#22c55e] text-white"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 bg-white"
      )}
    >
      {children}
    </button>
  );
}

function MallPill({
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
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border",
        selected
          ? "bg-gradient-to-r from-[#0066FF] to-[#22c55e] text-white border-transparent shadow-lg shadow-[#0066FF]/10"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200 bg-white",
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
