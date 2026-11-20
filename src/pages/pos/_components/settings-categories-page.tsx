import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel.d.ts";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { emojiForCategoryName } from "@/lib/pos-category-icons.ts";
import {
  ArrowDown,
  ArrowUp,
  Box,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import CategoryDialog from "./category-dialog.tsx";

type Translate = (key: string, options?: Record<string, unknown>) => string;
type Category = Doc<"menuCategories">;
type Tab = "all" | "active" | "inactive";

const GRID =
  "grid items-center gap-3 grid-cols-[32px_minmax(200px,1fr)_96px_150px_120px_96px] xl:gap-4 xl:grid-cols-[36px_minmax(260px,1fr)_120px_170px_140px_104px]";
const TH = "text-[13px] font-semibold text-[#0b1220]";

export default function SettingsCategoriesPage({
  licenseKey,
  t,
  canDelete,
}: {
  licenseKey: string;
  t: Translate;
  /** Admins only (same rule as the Products page). */
  canDelete: boolean;
}) {
  const categoriesQuery = useQuery("pos.menu.getAllCategories", { licenseKey }) as Category[] | undefined;
  const itemsQuery = useQuery("pos.menu.getAllItems", { licenseKey }) as Doc<"menuItems">[] | undefined;
  const updateCategory = useMutation("pos.menu.updateCategory");
  const deleteCategory = useMutation("pos.menu.deleteCategory");
  const setCategoryOrder = useMutation("pos.menu.setCategoryOrder");

  const [rows, setRows] = useState<Category[]>([]);
  useEffect(() => {
    if (categoriesQuery) {
      setRows([...categoriesQuery].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));
    }
  }, [categoriesQuery]);

  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [busyOrder, setBusyOrder] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const productCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of itemsQuery ?? []) {
      const key = String(item.categoryId ?? "");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [itemsQuery]);

  const activeCount = rows.filter((c) => c.isActive).length;
  const inactiveCount = rows.length - activeCount;

  const visible = rows.filter((c) => {
    if (tab === "active" && !c.isActive) return false;
    if (tab === "inactive" && c.isActive) return false;
    const q = search.trim().toLowerCase();
    if (q && !c.name.toLowerCase().includes(q)) return false;
    return true;
  });
  const allChecked = visible.length > 0 && visible.every((c) => selected.has(c._id));
  const selectedVisible = visible.filter((c) => selected.has(c._id));

  /** Saves a new full order (display_order 1..n); rolls back on failure. */
  const saveOrder = async (next: Category[]) => {
    if (busyOrder) return;
    const previous = rows;
    setRows(next.map((c, i) => ({ ...c, displayOrder: i + 1 })));
    setBusyOrder(true);
    try {
      await setCategoryOrder({
        licenseKey,
        orderedIds: next.map((c) => c._id),
        previousIds: previous.map((c) => c._id),
      });
    } catch (err) {
      setRows(previous);
      toast.error(errorMessageFromUnknown(err, t("categories_page.order_failed")));
    } finally {
      setBusyOrder(false);
    }
  };

  const move = async (id: Id<"menuCategories">, dir: -1 | 1) => {
    const from = rows.findIndex((c) => c._id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[from], next[to]] = [next[to], next[from]];
    await saveOrder(next);
  };

  /** Drag a card onto another: it takes that card's place. */
  const dropOn = async (targetId: string) => {
    const sourceId = dragId;
    setDragId(null);
    setDropId(null);
    if (!sourceId || sourceId === targetId) return;
    const from = rows.findIndex((c) => c._id === sourceId);
    const to = rows.findIndex((c) => c._id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await saveOrder(next);
  };

  const toggleActive = async (cat: Category) => {
    const nextActive = !cat.isActive;
    setRows((r) => r.map((c) => (c._id === cat._id ? { ...c, isActive: nextActive } : c)));
    try {
      await updateCategory({
        licenseKey,
        categoryId: cat._id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isActive: nextActive,
      });
    } catch (err) {
      setRows((r) => r.map((c) => (c._id === cat._id ? { ...c, isActive: cat.isActive } : c)));
      toast.error(errorMessageFromUnknown(err, t("categories_page.status_failed")));
    }
  };

  const remove = async (ids: Id<"menuCategories">[]) => {
    if (!canDelete || ids.length === 0) return;
    const withItems = ids.some((id) => (productCount.get(id) ?? 0) > 0);
    const message =
      ids.length > 1
        ? t("categories_page.confirm_delete_many", { count: ids.length })
        : withItems
          ? t("menu_page.confirm_del_cat_items")
          : t("menu_page.confirm_del_cat");
    if (!window.confirm(message)) return;
    let failed = 0;
    for (const id of ids) {
      try {
        await deleteCategory({ licenseKey, categoryId: id });
        setRows((r) => r.filter((c) => c._id !== id));
      } catch {
        failed += 1;
      }
    }
    setSelected(new Set());
    if (failed > 0) toast.error(t("menu_page.cat_delete_fail"));
    else toast.success(t("menu_page.cat_deleted"));
  };

  return (
    <div className="space-y-5">
      <header className="flex min-w-0 items-center gap-4 px-1">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#dbe7ff] bg-[linear-gradient(145deg,#f4f8ff,#e3edff)] text-[#2563eb] shadow-[0_8px_20px_-12px_rgba(37,99,235,0.55)]">
          <Layers className="size-6" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#0b1220]">
            {t("settings.menu_categories_title")}
          </h1>
          <p className="mt-1 text-[14px] text-[#475569]">{t("categories_page.desc")}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TabButton active={tab === "all"} onClick={() => setTab("all")} count={rows.length}>
            <Layers className="size-4" strokeWidth={2} />
            {t("categories_page.tab_all")}
          </TabButton>
          <TabButton active={tab === "active"} onClick={() => setTab("active")} count={activeCount}>
            <span className="size-2.5 rounded-full" style={{ backgroundColor: "#16a34a" }} />
            {t("menu_page.status_active")}
          </TabButton>
          <TabButton active={tab === "inactive"} onClick={() => setTab("inactive")} count={inactiveCount}>
            <span className="size-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />
            {t("menu_page.status_inactive")}
          </TabButton>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {canDelete && selectedVisible.length > 0 ? (
            <button
              type="button"
              onClick={() => void remove(selectedVisible.map((c) => c._id))}
              className="inline-flex h-12 items-center gap-1.5 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="size-4" />
              {t("menu_page.delete_selected", { selectedCount: selectedVisible.length })}
            </button>
          ) : null}
          <div className="relative w-[250px] min-w-[170px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#0b1220]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("categories_page.search_ph")}
              className="h-12 rounded-2xl border-[#e3ebf7] bg-white pl-11 text-sm text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05)] placeholder:text-[#64748b]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#334155]"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <ViewButton active={viewMode === "grid"} label={t("menu_page.view_grid")} onClick={() => setViewMode("grid")}>
              <LayoutGrid className="size-[18px]" strokeWidth={2} />
            </ViewButton>
            <ViewButton active={viewMode === "list"} label={t("menu_page.view_list")} onClick={() => setViewMode("list")}>
              <List className="size-[18px]" strokeWidth={2} />
            </ViewButton>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-semibold shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)] transition hover:opacity-95"
            style={{ backgroundColor: "#1d5ff0", color: "#ffffff" }}
          >
            <Plus className="size-5" strokeWidth={2.2} />
            {t("menu_page.add_category")}
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        categoriesQuery === undefined ? (
          <p className="py-10 text-center text-sm text-[#64748b]">{t("common.loading")}</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[22px] border border-[#e3ebf7] bg-white px-5 py-12 text-center">
            <UtensilsCrossed className="size-6 text-[#94a3b8]" />
            <p className="text-sm font-semibold text-[#0b1220]">
              {rows.length === 0 ? t("menu_page.no_categories") : t("categories_page.empty_filtered")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((cat) => {
              const index = rows.findIndex((c) => c._id === cat._id);
              const glyph = (cat.icon && String(cat.icon).trim()) || emojiForCategoryName(cat.name ?? "");
              const count = productCount.get(cat._id) ?? 0;
              return (
                <div
                  key={cat._id}
                  draggable={!busyOrder}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(cat._id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setDropId(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragId || dragId === cat._id) return;
                    e.preventDefault();
                    if (dropId !== cat._id) setDropId(cat._id);
                  }}
                  onDragLeave={() => {
                    if (dropId === cat._id) setDropId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void dropOn(cat._id);
                  }}
                  className={cn(
                    "group relative flex min-h-[176px] flex-col rounded-[22px] border bg-[linear-gradient(160deg,#ffffff_0%,#f8faff_100%)] p-4 transition",
                    "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-28px_rgba(37,99,235,0.45)] hover:-translate-y-0.5",
                    dropId === cat._id ? "border-[#2563eb] ring-2 ring-[#2563eb]/20" : "border-[#e3ebf7] hover:border-[#bcd3fb]",
                    dragId === cat._id && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <span
                      title={t("categories_page.drag_hint")}
                      className="flex size-8 cursor-grab items-center justify-center rounded-lg text-[#334155] active:cursor-grabbing"
                    >
                      <GripVertical className="size-4" strokeWidth={2.2} />
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("menu_page.col_actions")}
                          className="flex size-9 items-center justify-center rounded-full bg-white text-[#0b1220] shadow-[0_2px_8px_-4px_rgba(15,23,42,0.4)] transition hover:bg-[#f1f5fb]"
                        >
                          <MoreHorizontal className="size-[18px]" strokeWidth={2.4} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[170px] rounded-xl border-[#e3ebf7] bg-white p-1 text-[#0b1220]">
                        <DropdownMenuItem
                          className="gap-2 text-[13px] text-[#0b1220] focus:bg-[#f1f5ff] focus:text-[#0b1220]"
                          onSelect={() => {
                            setEditing(cat);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" /> {t("btn.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={index <= 0 || busyOrder}
                          className="gap-2 text-[13px] text-[#0b1220] focus:bg-[#f1f5ff] focus:text-[#0b1220]"
                          onSelect={() => void move(cat._id, -1)}
                        >
                          <ArrowUp className="size-4" /> {t("categories_page.move_up")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={index >= rows.length - 1 || busyOrder}
                          className="gap-2 text-[13px] text-[#0b1220] focus:bg-[#f1f5ff] focus:text-[#0b1220]"
                          onSelect={() => void move(cat._id, 1)}
                        >
                          <ArrowDown className="size-4" /> {t("categories_page.move_down")}
                        </DropdownMenuItem>
                        {canDelete ? (
                          <>
                            <DropdownMenuSeparator className="bg-[#eef2f8]" />
                            <DropdownMenuItem
                              className="gap-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700"
                              onSelect={() => void remove([cat._id])}
                            >
                              <Trash2 className="size-4" /> {t("btn.delete")}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="-mt-3 flex flex-1 items-center justify-center">
                    {glyph ? (
                      <span className="text-[58px] leading-none drop-shadow-[0_10px_12px_rgba(15,23,42,0.18)]">{glyph}</span>
                    ) : (
                      <UtensilsCrossed className="size-12 text-[#2563eb]" strokeWidth={1.6} />
                    )}
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[18px] font-bold tracking-tight text-[#0b1220]">{cat.name}</p>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-[#334155]">
                        <Box className="size-3.5" strokeWidth={2} />
                        {t(count === 1 ? "categories_page.products_count_one" : "categories_page.products_count", { count })}
                      </p>
                    </div>
                    <Switch
                      checked={cat.isActive}
                      label={t("categories_page.toggle_status")}
                      onChange={() => void toggleActive(cat)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : null}

      {viewMode === "list" ? (
      <div className="overflow-hidden rounded-[22px] border border-[#e3ebf7] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-28px_rgba(37,99,235,0.35)]">
        <div className={cn(GRID, "bg-[#f7f9fd] px-5 py-2.5")}>
          <div className="flex justify-center">
            {canDelete ? (
              <Checkbox
                checked={allChecked}
                onCheckedChange={() =>
                  setSelected(allChecked ? new Set() : new Set(visible.map((c) => c._id)))
                }
              />
            ) : null}
          </div>
          <span className={TH}>{t("categories_page.col_category")}</span>
          <span className={cn(TH, "text-center")}>{t("categories_page.col_products")}</span>
          <span className={cn(TH, "text-center")}>{t("categories_page.col_order")}</span>
          <span className={cn(TH, "text-center")}>{t("categories_page.col_status")}</span>
          <span className={cn(TH, "text-center")}>{t("menu_page.col_actions")}</span>
        </div>

        {categoriesQuery === undefined ? (
          <p className="px-5 py-10 text-center text-sm text-[#64748b]">{t("common.loading")}</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <UtensilsCrossed className="size-6 text-[#94a3b8]" />
            <p className="text-sm font-semibold text-[#0b1220]">
              {rows.length === 0 ? t("menu_page.no_categories") : t("categories_page.empty_filtered")}
            </p>
          </div>
        ) : (
          visible.map((cat) => {
            const index = rows.findIndex((c) => c._id === cat._id);
            const glyph = (cat.icon && String(cat.icon).trim()) || emojiForCategoryName(cat.name ?? "");
            const checked = selected.has(cat._id);
            return (
              <div
                key={cat._id}
                className={cn(
                  GRID,
                  "border-t border-[#eef2f8] px-5 py-1.5 transition-colors",
                  checked ? "bg-[#f1f6ff]" : "bg-white hover:bg-[#fafcff]",
                )}
              >
                <div className="flex justify-center">
                  {canDelete ? (
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(cat._id)) next.delete(cat._id);
                          else next.add(cat._id);
                          return next;
                        })
                      }
                    />
                  ) : null}
                </div>

                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#eef2f8] bg-[linear-gradient(150deg,#ffffff,#f1f5fd)] shadow-[0_4px_10px_-8px_rgba(15,23,42,0.4)]">
                    {glyph ? (
                      <span className="text-[20px] leading-none">{glyph}</span>
                    ) : (
                      <UtensilsCrossed className="size-4 text-[#2563eb]" />
                    )}
                  </span>
                  <span className="min-w-0 truncate text-[14px] font-bold text-[#0b1220]">{cat.name}</span>
                </div>

                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2fb] px-3 py-1 text-[13px] font-bold tabular-nums text-[#0b1220]">
                    <Box className="size-3.5" strokeWidth={2} />
                    {productCount.get(cat._id) ?? 0}
                  </span>
                </div>

                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-[#e3ebf7] bg-white px-1 py-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                    <OrderButton
                      label={t("categories_page.move_up")}
                      disabled={index <= 0 || busyOrder}
                      onClick={() => void move(cat._id, -1)}
                    >
                      <ChevronUp className="size-4" strokeWidth={2.4} />
                    </OrderButton>
                    <span className="min-w-[26px] text-center text-[14px] font-semibold tabular-nums text-[#0b1220]">
                      {index + 1}
                    </span>
                    <OrderButton
                      label={t("categories_page.move_down")}
                      disabled={index >= rows.length - 1 || busyOrder}
                      onClick={() => void move(cat._id, 1)}
                    >
                      <ChevronDown className="size-4" strokeWidth={2.4} />
                    </OrderButton>
                  </span>
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    title={t("categories_page.toggle_status")}
                    onClick={() => void toggleActive(cat)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition hover:opacity-85"
                    style={
                      cat.isActive
                        ? { backgroundColor: "#eaf8ee", color: "#15803d" }
                        : { backgroundColor: "#fdeceb", color: "#dc2626" }
                    }
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: cat.isActive ? "#16a34a" : "#ef4444" }} />
                    {cat.isActive ? t("menu_page.status_active") : t("menu_page.status_inactive")}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-1">
                  <IconAction
                    label={t("btn.edit")}
                    onClick={() => {
                      setEditing(cat);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-[18px]" strokeWidth={2} />
                  </IconAction>
                  {canDelete ? (
                    <IconAction label={t("btn.delete")} danger onClick={() => void remove([cat._id])}>
                      <Trash2 className="size-[18px]" strokeWidth={2} />
                    </IconAction>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
      ) : null}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        licenseKey={licenseKey}
        editing={
          editing
            ? {
                _id: editing._id,
                name: editing.name,
                color: editing.color,
                icon: editing.icon,
                isActive: editing.isActive,
                prepConfig: editing.prepConfig,
              }
            : null
        }
        onSaved={(category, mode) => {
          setRows((r) =>
            mode === "create"
              ? [...r, { ...(category as unknown as Category), displayOrder: r.length + 1 }]
              : r.map((c) => (c._id === category._id ? { ...c, ...category } : c)),
          );
        }}
      />
    </div>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex h-12 items-center gap-2 rounded-2xl border px-4 text-[14px] font-semibold transition",
        active
          ? "border-[#dbe7ff] bg-white text-[#1d5ff0] shadow-[0_8px_20px_-12px_rgba(37,99,235,0.55)]"
          : "border-transparent bg-white/60 text-[#0b1220] hover:bg-white",
      )}
    >
      {children}
      <span
        className="rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums"
        style={active ? { backgroundColor: "#1d5ff0", color: "#ffffff" } : { backgroundColor: "#e7ecf6", color: "#334155" }}
      >
        {count}
      </span>
      {active ? <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full" style={{ backgroundColor: "#1d5ff0" }} /> : null}
    </button>
  );
}

function ViewButton({
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

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      className="relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors"
      style={{ backgroundColor: checked ? "#1d5ff0" : "#d7dee9" }}
    >
      <span
        className="absolute top-1 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.35)] transition-all"
        style={{ left: checked ? 26 : 4 }}
      />
    </button>
  );
}

function OrderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-full text-[#0b1220] transition hover:bg-[#f1f5fb] disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function IconAction({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg transition",
        danger ? "text-red-500 hover:bg-red-50" : "text-[#0b1220] hover:bg-[#f1f5fb]",
      )}
    >
      {children}
    </button>
  );
}
