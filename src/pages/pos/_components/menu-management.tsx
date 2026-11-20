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
  Layers,
  CircleDot,
  List,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import CategoryDialog from "./category-dialog.tsx";
import MenuBackdrop from "./menu-backdrop.tsx";
import ItemDialog, { type EditingItem } from "./item-dialog.tsx";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import { BRAND } from "@/lib/brand-colors.ts";

const ACCENT_BLUE = BRAND.primary;

/** Below 1280px the category column folds under the product name so names never collapse. */
const MENU_TABLE_GRID =
  "grid items-center gap-3 grid-cols-[32px_minmax(170px,1fr)_84px_118px_158px_96px] xl:gap-4 xl:grid-cols-[36px_minmax(220px,1fr)_160px_96px_140px_170px_104px]";
const TH = "text-[13px] font-semibold text-[#0b1220]";
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
  prepConfig?: unknown;
};

type MenuManagementProps = {
  licenseKey: string;
  /** Logged on stock movements when adjusting mall supply from the table. */
  stockActorName?: string;
  /** Enterprise: mall kuzhinë/shank, supply strip, stock adjust from list. */
  enterpriseSupplyMall?: boolean;
  /** Enterprise: optional BOM / recipe on menu items (përbërës → furnizim). */
  enterpriseSupplyRecipe?: boolean;
  /** Admin vs manager: managers cannot delete, change VAT, or edit recipes/cost. */
  staffRole?: string;
  /** Rendered above the page header on the same background (e.g. Settings breadcrumb). */
  topBar?: ReactNode;
};

export default function MenuManagement({
  licenseKey,
  stockActorName = "",
  enterpriseSupplyMall = false,
  enterpriseSupplyRecipe = false,
  staffRole,
  topBar,
}: MenuManagementProps) {
  const { t, formatPrice } = usePosLocale();
  const isAdminStaff = staffRole === "admin";
  const canDeleteMenuItems = isAdminStaff;
  const canEditVat = isAdminStaff;
  const canEditRecipe = isAdminStaff;
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
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
      if (statusFilter === "active" && !item.available) return false;
      if (statusFilter === "inactive" && item.available) return false;
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
    if (!canDeleteMenuItems) {
      toast.error(t("menu_page.admin_only_delete"));
      return;
    }
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
    if (!canDeleteMenuItems) {
      toast.error(t("menu_page.admin_only_delete"));
      return;
    }
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
    if (!canDeleteMenuItems) {
      toast.error(t("menu_page.admin_only_delete"));
      return;
    }
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
    if (!canDeleteMenuItems) {
      toast.error(t("menu_page.admin_only_delete"));
      return;
    }
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
    <div className="relative isolate min-h-full overflow-hidden">
      <MenuBackdrop />
      <div className="space-y-6 p-6 lg:p-8">
      {topBar}
      {!isAdminStaff ? (
        <p className="text-xs text-amber-700/90 -mb-3">
          {t("menu_page.manager_hint")}
        </p>
      ) : null}
      {/* ─── 0. Page header ────────────────────────── */}
      <header className="flex min-w-0 items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#dbe7ff] bg-[linear-gradient(145deg,#f4f8ff,#e3edff)] text-[#2563eb] shadow-[0_8px_20px_-12px_rgba(37,99,235,0.55)]">
          <Package className="size-6" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#0b1220]">
            {t("settings.menu_link_title")}
          </h1>
          <p className="mt-1 text-[14px] text-[#475569]">{t("settings.menu_link_desc")}</p>
        </div>
      </header>

      {/* ─── 1. Category tiles ─────────────────────── */}
      <section className="space-y-3">
        <SectionHeading title={t("menu_page.categories")} />
        {categories.length === 0 ? (
          <div className="rounded-[22px] border border-[#e3ebf7] bg-white p-8 shadow-sm">
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
          <div className="flex flex-wrap gap-3">
            <CategoryCard
              icon={<LayoutGrid className="size-7" strokeWidth={1.8} style={{ color: "#2563eb" }} />}
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
                  if (glyph) return <span className="text-[30px] leading-none drop-shadow-sm">{glyph}</span>;
                  return <UtensilsCrossed className="size-7" strokeWidth={1.8} style={{ color: "#2563eb" }} />;
                })()}
                name={cat.name}
                countLabel={menuItemsCountLabel(getItemCountForCategory(cat._id), t)}
                isSelected={selectedCategoryId === cat._id}
                onClick={() => setSelectedCategoryId(cat._id)}
                onEdit={() => {
                  setEditingCategory({
                    _id: cat._id,
                    name: cat.name,
                    color: cat.color,
                    icon: cat.icon,
                    isActive: cat.isActive,
                    prepConfig: cat.prepConfig,
                  });
                  setCategoryDialogOpen(true);
                }}
                onDelete={canDeleteMenuItems ? () => handleDeleteCategory(cat._id) : undefined}
                isHidden={!cat.isActive}
              />
            ))}

            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setCategoryDialogOpen(true);
              }}
              className="flex h-[96px] w-[104px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[#c7d6ee] bg-white/70 text-[#334155] transition hover:border-[#2563eb] hover:text-[#2563eb]"
            >
              <Plus className="size-6 text-[#2563eb]" strokeWidth={2} />
              <span className="text-[12px] font-semibold">{t("menu_page.add_category")}</span>
            </button>
          </div>
        )}
      </section>

      {/* ─── 2. Toolbar ────────────────────────────── */}
      <section className="flex flex-wrap items-center gap-3">
        <div className="mr-2 shrink-0">
          <SectionHeading
            title={
              selectedCategoryId === "all"
                ? t("menu_page.all_items_title")
                : t("menu_page.category_items", { name: selectedCategoryDisplayName })
            }
            subtitle={t("menu_page.items_in_menu", {
              count:
                selectedCategoryId === "all" ? totalItemCount : getItemCountForCategory(selectedCategoryId),
            })}
          />
        </div>
        <div className="relative ml-auto w-[250px] min-w-[170px] shrink">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#0b1220]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("menu_page.search_ph")}
            className="h-12 rounded-2xl border-[#e3ebf7] bg-white pl-11 text-sm text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05)] placeholder:text-[#64748b]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#94a3b8] hover:text-[#334155]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <ToolbarSelect
          icon={<Layers className="size-[18px]" strokeWidth={1.9} />}
          value={selectedCategoryId}
          onChange={(v) => setSelectedCategoryId(v as Id<"menuCategories"> | "all")}
          options={[
            { value: "all", label: t("menu_page.all_categories") },
            ...categoriesForProductStrip.map((c) => ({ value: c._id, label: c.name })),
          ]}
        />
        <ToolbarSelect
          icon={<CircleDot className="size-[18px]" strokeWidth={1.9} />}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}
          options={[
            { value: "all", label: t("menu_page.status_all") },
            { value: "active", label: t("menu_page.status_active") },
            { value: "inactive", label: t("menu_page.status_inactive") },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3">
          {selectedFilteredCount > 0 && canDeleteMenuItems ? (
            <Button
              variant="outline"
              className="h-12 rounded-2xl border-red-200 bg-white px-4 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleDeleteSelectedItems}
            >
              <Trash2 className="mr-1.5 size-4" />
              {t("menu_page.delete_selected", { selectedCount: selectedFilteredCount })}
            </Button>
          ) : null}
          {enterpriseSupplyMall && mallView !== "none" ? (
            <Button
              variant="outline"
              className="h-12 rounded-2xl border-[#e3ebf7] bg-white px-4 font-semibold text-[#334155]"
              onClick={() => setMallStockPickerOpen(true)}
            >
              <Boxes className="mr-1.5 size-4" />
              {t("menu_page.mall_change_stock_btn")}
            </Button>
          ) : null}
          <div className="flex items-center gap-2">
            <ViewToggleButton
              active={viewMode === "grid"}
              label={t("menu_page.view_grid")}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="size-[18px]" strokeWidth={2} />
            </ViewToggleButton>
            <ViewToggleButton
              active={viewMode === "list"}
              label={t("menu_page.view_list")}
              onClick={() => setViewMode("list")}
            >
              <List className="size-[18px]" strokeWidth={2} />
            </ViewToggleButton>
          </div>
          <button
            type="button"
            className="inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-semibold shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)] transition hover:opacity-95"
            style={{ backgroundColor: "#1d5ff0", color: "#ffffff" }}
            onClick={() => {
              if ((!categories || categories.length === 0) && mallView === "none") {
                toast.error(t("menu_page.create_category_first"));
                return;
              }
              setEditingItem(null);
              setItemDialogOpen(true);
            }}
          >
            <Plus className="size-5" strokeWidth={2.2} />
            {enterpriseSupplyMall && mallView !== "none" ? t("menu_page.add_mall_item") : t("menu_page.add_item")}
          </button>
        </div>
      </section>

      {/* ─── 3. Products ───────────────────────────── */}
      {filteredItems && filteredItems.length === 0 && (
        <div className="rounded-[22px] border border-[#e3ebf7] bg-white py-12 shadow-sm">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package />
              </EmptyMedia>
              <EmptyTitle>{t("menu_page.empty_items")}</EmptyTitle>
              <EmptyDescription>
                {categories.length === 0
                  ? t("menu_page.empty_items_no_cat")
                  : searchQuery || statusFilter !== "all"
                    ? t("menu_page.empty_items_search")
                    : t("menu_page.empty_items_default")}
              </EmptyDescription>
            </EmptyHeader>
            {(categories.length > 0 || (enterpriseSupplyMall && mallView !== "none")) && !searchQuery && (
              <EmptyContent>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingItem(null);
                    setItemDialogOpen(true);
                  }}
                >
                  <Plus className="size-4 mr-1" />
                  {enterpriseSupplyMall && mallView !== "none" ? t("menu_page.add_mall_item") : t("menu_page.add_item")}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </div>
      )}

      {filteredItems && filteredItems.length > 0 && viewMode === "list" && (
        <div className="overflow-hidden rounded-[22px] border border-[#e3ebf7] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-28px_rgba(37,99,235,0.35)]">
          <div className={cn(MENU_TABLE_GRID, "bg-[#f7f9fd] px-5 py-3.5")}>
            <div className="flex justify-center">
              {canDeleteMenuItems ? <Checkbox checked={allChecked} onCheckedChange={toggleAll} /> : null}
            </div>
            <span className={TH}>{t("menu_page.col_product")}</span>
            <span className={cn(TH, "hidden xl:block")}>{t("menu_page.col_category")}</span>
            <span className={TH}>{t("menu_page.col_price")}</span>
            <span className={TH}>{t("menu_page.col_stock")}</span>
            <span className={TH}>{t("menu_page.col_availability")}</span>
            <span className={cn(TH, "text-center")}>{t("menu_page.col_actions")}</span>
          </div>

          {filteredItems.map((item) => {
            const category = categories.find((c) => c._id === item.categoryId);
            const isChecked = selectedItems.has(item._id);
            return (
              <div
                key={item._id}
                className={cn(
                  MENU_TABLE_GRID,
                  "border-t border-[#eef2f8] px-5 py-3 transition-colors",
                  isChecked ? "bg-[#f1f6ff]" : "bg-white hover:bg-[#fafcff]",
                )}
              >
                <div className="flex justify-center">
                  {canDeleteMenuItems ? (
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleItem(item._id)} />
                  ) : null}
                </div>

                <div className="flex min-w-0 items-center gap-3.5">
                  <ProductThumb item={item} className="size-12 rounded-xl" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[14px] font-bold text-[#0b1220]">{item.name}</p>
                      {item.isFavorite && <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />}
                    </div>
                    {item.description ? (
                      <p className="max-w-[260px] truncate text-[12px] text-[#64748b]">{item.description}</p>
                    ) : null}
                    <div className="mt-1 xl:hidden">
                      <CategoryChip category={category} />
                    </div>
                  </div>
                </div>

                <div className="hidden min-w-0 xl:block">
                  <CategoryChip category={category} />
                </div>

                <span className="text-[15px] font-bold tabular-nums text-[#0b1220]">
                  {formatPrice(typeof item.price === "number" && Number.isFinite(item.price) ? item.price : 0)}
                </span>

                <StockCell item={item} t={t} />

                <div className="flex items-center gap-2.5">
                  <AvailabilitySwitch
                    checked={item.available}
                    label={t("menu_page.col_availability")}
                    onChange={() => handleToggleAvailability(item._id)}
                  />
                  <StatusPill active={item.available} t={t} />
                </div>

                <RowActions
                  t={t}
                  onEdit={() => {
                    setEditingItem(item);
                    setItemDialogOpen(true);
                  }}
                  onDelete={canDeleteMenuItems ? () => handleDeleteItem(item._id) : undefined}
                  onStock={
                    enterpriseSupplyMall && mallView !== "none" && item.trackStock
                      ? () => openMallStockAdjust(item)
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {filteredItems && filteredItems.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filteredItems.map((item) => {
            const category = categories.find((c) => c._id === item.categoryId);
            return (
              <div
                key={item._id}
                className="group flex flex-col overflow-hidden rounded-[22px] border border-[#e3ebf7] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-28px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:border-[#bcd3fb]"
              >
                <div className="relative h-40 bg-[linear-gradient(150deg,#f5f9ff,#e8f0ff)]">
                  <ProductThumb item={item} className="h-full w-full" large />
                  <div className="absolute left-3 top-3">
                    <StatusPill active={item.available} t={t} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-[#0b1220]">{item.name}</p>
                    {item.description ? (
                      <p className="truncate text-[12px] text-[#64748b]">{item.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <CategoryChip category={category} />
                    <StockCell item={item} t={t} />
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#eef2f8] pt-3">
                    <span className="text-[17px] font-bold tabular-nums text-[#0b1220]">
                      {formatPrice(typeof item.price === "number" && Number.isFinite(item.price) ? item.price : 0)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <AvailabilitySwitch
                        checked={item.available}
                        label={t("menu_page.col_availability")}
                        onChange={() => handleToggleAvailability(item._id)}
                      />
                      <RowActions
                        t={t}
                        onEdit={() => {
                          setEditingItem(item);
                          setItemDialogOpen(true);
                        }}
                        onDelete={canDeleteMenuItems ? () => handleDeleteItem(item._id) : undefined}
                      />
                    </div>
                  </div>
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
              prepConfig: category.prepConfig,
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
          canEditVat={canEditVat}
          canEditRecipe={canEditRecipe}
          stockActorName={stockActorName}
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
                  (item as { staffMealAllowed?: boolean }).staffMealAllowed ===
                  true,
                staffMealPrice: (item as { staffMealPrice?: number }).staffMealPrice,
                staffMealFreeQty: (item as { staffMealFreeQty?: number }).staffMealFreeQty,
                staffMealDailyLimit: (item as { staffMealDailyLimit?: number }).staffMealDailyLimit,
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
                    ? "border-transparent bg-gradient-to-r from-brand to-[#22c55e] text-white shadow-md shadow-brand/15"
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
                    ? "border-transparent bg-gradient-to-r from-brand to-[#22c55e] text-white shadow-md shadow-brand/15"
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
        "group relative flex h-[96px] w-[104px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border px-2 transition",
        isSelected
          ? "border-[#2563eb] bg-[linear-gradient(160deg,#eef4ff,#dfeaff)] shadow-[0_0_0_3px_rgba(37,99,235,0.12),0_10px_22px_-14px_rgba(37,99,235,0.7)]"
          : "border-[#e3ebf7] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:border-[#bcd3fb]",
        isHidden && "opacity-40",
      )}
    >
      {(onEdit || onDelete) && (
        <div className="absolute -right-1.5 -top-1.5 z-10 hidden gap-0.5 group-hover:flex">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full border border-[#e3ebf7] bg-white shadow-sm hover:bg-[#f1f5f9]"
            >
              <Pencil className="size-3 text-[#334155]" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full border border-[#e3ebf7] bg-white shadow-sm hover:bg-red-50"
            >
              <Trash2 className="size-3 text-red-500" />
            </button>
          )}
        </div>
      )}
      <div className="flex h-9 items-center justify-center">{icon}</div>
      <span className="max-w-[92px] truncate text-[13px] font-bold text-[#0b1220]">{name}</span>
      <span className="text-[11px] leading-tight text-[#64748b]">{countLabel}</span>
    </div>
  );
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-[19px] font-bold leading-tight tracking-tight text-[#0b1220]">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-[13px] text-[#64748b]">{subtitle}</p> : null}
    </div>
  );
}

function ToolbarSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-12 w-[172px] shrink-0 rounded-2xl border-[#e3ebf7] bg-white px-4 text-[14px] font-semibold text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0 text-[#0b1220]">{icon}</span>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[13px] text-[#0b1220] focus:bg-[#f1f5ff] focus:text-[#0b1220]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ViewToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-12 items-center justify-center rounded-2xl border transition",
        active
          ? "border-transparent shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)]"
          : "border-[#e3ebf7] bg-white text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-[#bcd3fb]",
      )}
      style={active ? { backgroundColor: "#1d5ff0", color: "#ffffff" } : undefined}
    >
      {children}
    </button>
  );
}

function ProductThumb({
  item,
  className,
  large,
}: {
  item: Doc<"menuItems">;
  className?: string;
  large?: boolean;
}) {
  const imageUrl = (item as { imageUrl?: string | null }).imageUrl;
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden bg-[#f1f5fb]", className)}>
      {imageUrl ? (
        <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <span className={cn("font-bold text-[#94a3b8]", large ? "text-4xl" : "text-sm")}>
          {(item.name?.charAt(0) ?? "?").toUpperCase()}
        </span>
      )}
    </div>
  );
}

function CategoryChip({ category }: { category?: Doc<"menuCategories"> }) {
  if (!category) return <span className="text-[13px] text-[#94a3b8]">{"\u2014"}</span>;
  const glyph = (category.icon && String(category.icon).trim()) || emojiForCategoryName(category.name ?? "");
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#e3ebf7] bg-[#f7f9fd] px-2.5 py-1 text-[12px] font-semibold text-[#0b1220]">
      {glyph ? <span className="text-[14px] leading-none">{glyph}</span> : <UtensilsCrossed className="size-3.5 text-[#2563eb]" />}
      <span className="truncate">{category.name}</span>
    </span>
  );
}

/** Real stock info only: recipe ingredients (Enterprise), tracked stock, or a dash. */
function StockCell({ item, t }: { item: Doc<"menuItems">; t: Translate }) {
  const recipe = (item as { supplyRecipe?: unknown[] }).supplyRecipe;
  if (Array.isArray(recipe) && recipe.length > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0b1220]">
        <Layers className="size-4 text-[#334155]" strokeWidth={1.9} />
        {t("menu_page.ingredients_count", { count: recipe.length })}
      </span>
    );
  }
  if (item.trackStock) {
    const stock = item.currentStock ?? 0;
    const low = item.lowStockThreshold !== undefined && stock <= item.lowStockThreshold;
    const unit = item.stockUnit?.trim() === "pc" ? t("menu_page.stock_unit_pc") : item.stockUnit?.trim();
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums",
          stock <= 0 ? "text-red-500" : low ? "text-amber-500" : "text-[#0b1220]",
        )}
      >
        <Boxes className="size-4 opacity-70" strokeWidth={1.9} />
        {stock}
        {unit ? <span className="text-[11px] font-normal text-[#64748b]">{unit}</span> : null}
      </span>
    );
  }
  return <span className="text-[13px] text-[#94a3b8]">{"\u2014"}</span>;
}

function AvailabilitySwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
      style={{ backgroundColor: checked ? "#1d5ff0" : "#d7dee9" }}
    >
      <span
        className="absolute top-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.35)] transition-all"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}

function StatusPill({ active, t }: { active: boolean; t: Translate }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={
        active
          ? { backgroundColor: "#eaf8ee", color: "#15803d" }
          : { backgroundColor: "#fdeceb", color: "#dc2626" }
      }
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: active ? "#16a34a" : "#ef4444" }} />
      {active ? t("menu_page.status_active") : t("menu_page.status_inactive")}
    </span>
  );
}

function RowActions({
  t,
  onEdit,
  onDelete,
  onStock,
}: {
  t: Translate;
  onEdit: () => void;
  onDelete?: () => void;
  onStock?: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      {onStock ? (
        <button
          type="button"
          title={t("stock_page.change_title")}
          aria-label={t("stock_page.change_title")}
          onClick={onStock}
          className="flex size-9 cursor-pointer items-center justify-center rounded-xl text-[#334155] transition hover:bg-[#f1f5fb] hover:text-[#2563eb]"
        >
          <Boxes className="size-4" strokeWidth={2} />
        </button>
      ) : null}
      <button
        type="button"
        title={t("btn.edit")}
        aria-label={t("btn.edit")}
        onClick={onEdit}
        className="flex size-9 cursor-pointer items-center justify-center rounded-xl text-[#0b1220] transition hover:bg-[#f1f5fb]"
      >
        <Pencil className="size-[18px]" strokeWidth={2} />
      </button>
      {onDelete ? (
        <button
          type="button"
          title={t("btn.delete")}
          aria-label={t("btn.delete")}
          onClick={onDelete}
          className="flex size-9 cursor-pointer items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50"
        >
          <Trash2 className="size-[18px]" strokeWidth={2} />
        </button>
      ) : null}
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
          ? "bg-gradient-to-r from-brand to-[#22c55e] text-white"
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
          ? "bg-gradient-to-r from-brand to-[#22c55e] text-white border-transparent shadow-lg shadow-brand/10"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200 bg-white",
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
