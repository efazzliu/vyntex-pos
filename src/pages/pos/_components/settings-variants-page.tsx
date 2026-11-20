import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { GENERAL_PREFS_NEED_COLUMN } from "@/lib/supabase-pos/general-prefs-store.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { FormSection, NumberStepper, Segmented, ToggleSwitch, variantGroupIcon } from "./drawer-form-kit.tsx";
import {
  newCustomizationOptionId,
  normalizeCustomizationConfig,
  selectionLimits,
  type MenuCustomizationGroup,
} from "@/lib/menu-customizations.ts";
import {
  draftToGroup,
  emptyVariantDraft,
  filledOptions,
  fitSelectionLimits,
  toMultipleChoice,
  groupToDraft,
  validateVariantDraft,
  type VariantDraft,
} from "@/lib/variant-group-form.ts";
import {
  Box,
  Check,
  GripVertical,
  Info,
  Layers,
  Pencil,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

type Translate = (key: string, options?: Record<string, unknown>) => string;
type Item = Doc<"menuItems">;
type Category = Doc<"menuCategories">;

/**
 * One variant group in the list: a group from the library (Settings → Variants), plus the
 * products that carry a copy of it. Groups that exist only on products (made in Edit Product
 * before the library existed) are listed too, matched by name.
 */
type VariantRow = {
  rowKey: string;
  /** The saved settings shown in the row (library copy first, else the first product copy). */
  group: MenuCustomizationGroup;
  inLibrary: boolean;
  itemIds: string[];
  /** Any product copy is switched on (for groups that only live on products). */
  active: boolean;
};

const GRID =
  "grid items-center gap-3 grid-cols-[32px_minmax(190px,1.2fr)_minmax(150px,1fr)_84px_132px_130px_150px_88px] xl:gap-4";
const TH = "text-[12px] font-semibold uppercase tracking-wide text-[#334155]";

const nameKey = (name: string) => name.trim().toLowerCase();

const iconForGroup = variantGroupIcon;

export default function SettingsVariantsPage({ licenseKey, t }: { licenseKey: string; t: Translate }) {
  const { formatPrice, currency } = usePosLocale();
  const itemsQuery = useQuery("pos.menu.getAllItems", { licenseKey }) as Item[] | undefined;
  const categoriesQuery = useQuery("pos.menu.getAllCategories", { licenseKey }) as Category[] | undefined;
  const libraryQuery = useQuery("pos.menu.getVariantLibrary", { licenseKey }) as MenuCustomizationGroup[] | undefined;
  const saveVariantGroup = useMutation("pos.menu.saveVariantGroup");
  const deleteVariantGroup = useMutation("pos.menu.deleteVariantGroup");
  const setItemCustomizations = useMutation("pos.menu.setItemCustomizations");

  const items = useMemo(() => itemsQuery ?? [], [itemsQuery]);
  const categories = useMemo(() => categoriesQuery ?? [], [categoriesQuery]);
  const library = useMemo(() => libraryQuery ?? [], [libraryQuery]);
  const groupsOf = (item: Item) =>
    normalizeCustomizationConfig((item as { customizationConfig?: unknown }).customizationConfig);

  const rows = useMemo<VariantRow[]>(() => {
    const byId = new Map<string, VariantRow>();
    const byName = new Map<string, VariantRow>();
    for (const g of library) {
      const row: VariantRow = { rowKey: g.id, group: g, inLibrary: true, itemIds: [], active: g.active !== false };
      byId.set(g.id, row);
      byName.set(nameKey(g.name), row);
    }
    for (const item of items) {
      for (const g of groupsOf(item)) {
        let row = byId.get(g.id) ?? byName.get(nameKey(g.name));
        if (!row) {
          row = { rowKey: `product:${nameKey(g.name)}`, group: g, inLibrary: false, itemIds: [], active: false };
          byName.set(nameKey(g.name), row);
        }
        if (!row.itemIds.includes(item._id)) row.itemIds.push(item._id);
        if (!row.inLibrary) row.active = row.active || g.active !== false;
      }
    }
    return [...new Set([...byId.values(), ...byName.values()])].sort((a, b) =>
      a.group.name.localeCompare(b.group.name, undefined, { sensitivity: "base" }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, library]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** `showLimitErrors`: Min/Max errors appear only after those fields were used or Save was tried. */
  const [editing, setEditing] = useState<{ row: VariantRow | null; draft: VariantDraft; showLimitErrors: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOption, setDragOption] = useState<string | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i._id as string, i])), [items]);
  const visible = rows.filter((r) => {
    if (search.trim() && !r.group.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (productFilter !== "all" && !r.itemIds.includes(productFilter)) return false;
    if (categoryFilter !== "all" && !r.itemIds.some((id) => itemById.get(id)?.categoryId === categoryFilter)) return false;
    return true;
  });
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.rowKey));
  const selectedVisible = visible.filter((r) => selected.has(r.rowKey));
  const productsForFilter = items
    .filter((i) => categoryFilter === "all" || i.categoryId === categoryFilter)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));

  const errorText = (err: unknown, fallbackKey: string) =>
    err instanceof Error && err.message === GENERAL_PREFS_NEED_COLUMN
      ? t("floor.room_needs_db")
      : errorMessageFromUnknown(err, t(fallbackKey));

  /** Replaces the row's copy on each product (keeps its position) or removes it when `group` is null. */
  const writeProducts = async (row: VariantRow, group: MenuCustomizationGroup | null) => {
    let failed = 0;
    for (const id of row.itemIds) {
      const item = itemById.get(id);
      if (!item) continue;
      const groups = groupsOf(item);
      const matches = (g: MenuCustomizationGroup) => g.id === row.group.id || nameKey(g.name) === nameKey(row.group.name);
      const next = group ? groups.map((g) => (matches(g) ? group : g)) : groups.filter((g) => !matches(g));
      try {
        await setItemCustomizations({ licenseKey, itemId: item._id, customizationConfig: next });
      } catch {
        failed += 1;
      }
    }
    return failed;
  };

  const openNew = () => setEditing({ row: null, draft: emptyVariantDraft(), showLimitErrors: false });
  const openEdit = (row: VariantRow) => setEditing({ row, draft: groupToDraft(row.group), showLimitErrors: false });
  /** `touchLimits`: the owner used Min/Max, so their errors may show from now on. */
  const setDraft = (draft: VariantDraft, touchLimits = false) =>
    setEditing((e) =>
      e ? { ...e, draft: fitSelectionLimits(draft), showLimitErrors: e.showLimitErrors || touchLimits } : e,
    );
  const draft = editing?.draft ?? null;

  /** Options, names and prices are kept; only the type-specific settings change. */
  const switchType = (type: "single" | "multi") => {
    if (!draft || draft.selectionType === type) return;
    setDraft(type === "multi" ? toMultipleChoice(draft) : { ...draft, selectionType: "single" });
  };

  const saveDraft = async () => {
    if (!editing || !draft) return;
    const others = rows.filter((r) => r.rowKey !== editing.row?.rowKey).map((r) => r.group.name);
    const problem = validateVariantDraft(draft, others);
    if (problem) {
      setEditing((e) => (e ? { ...e, showLimitErrors: true } : e));
      toast.error(t(problem.key, problem.params));
      return;
    }
    const group = draftToGroup(draft, editing.row?.group.id);
    setSaving(true);
    try {
      await saveVariantGroup({ licenseKey, group });
      const failed = editing.row ? await writeProducts(editing.row, group) : 0;
      if (failed > 0) toast.error(t("variants_page.save_partial", { count: failed }));
      else toast.success(t("variants_page.saved"));
      setEditing(null);
    } catch (err) {
      toast.error(errorText(err, "variants_page.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleRowActive = async (row: VariantRow) => {
    const { active: _drop, ...rest } = row.group;
    const group: MenuCustomizationGroup = row.active ? { ...rest, active: false } : rest;
    try {
      await saveVariantGroup({ licenseKey, group });
      const failed = await writeProducts(row, group);
      if (failed > 0) toast.error(t("variants_page.save_partial", { count: failed }));
    } catch (err) {
      toast.error(errorText(err, "variants_page.save_failed"));
    }
  };

  const removeRows = async (targets: VariantRow[]) => {
    if (targets.length === 0) return;
    const message =
      targets.length === 1
        ? t("variants_page.confirm_delete", { name: targets[0].group.name, count: targets[0].itemIds.length })
        : t("variants_page.confirm_delete_many", { count: targets.length });
    if (!window.confirm(message)) return;
    let failed = 0;
    for (const row of targets) {
      try {
        if (row.inLibrary) await deleteVariantGroup({ licenseKey, groupId: row.group.id });
        failed += await writeProducts(row, null);
      } catch (err) {
        failed += 1;
        toast.error(errorText(err, "variants_page.delete_failed"));
      }
    }
    setSelected(new Set());
    if (failed === 0) toast.success(t("variants_page.deleted"));
  };

  return (
    <div className="space-y-5">
      <header className="flex min-w-0 items-center gap-4 px-1">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#dbe7ff] bg-[linear-gradient(145deg,#f4f8ff,#e3edff)] text-[#2563eb] shadow-[0_8px_20px_-12px_rgba(37,99,235,0.55)]">
          <SlidersHorizontal className="size-6" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#0b1220]">
            {t("settings.menu_variants_title")}
          </h1>
          <p className="mt-1 text-[14px] text-[#475569]">{t("variants_page.desc")}</p>
        </div>
      </header>

      <div className="relative flex items-center gap-4 overflow-hidden rounded-[22px] border border-[#e3ebf7] bg-[linear-gradient(120deg,rgba(255,255,255,0.92),rgba(238,244,255,0.85))] px-5 py-4 shadow-[0_18px_36px_-30px_rgba(37,99,235,0.45)]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#dbe7ff] bg-white text-[#2563eb]">
          <Info className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 pr-28">
          <p className="text-[16px] font-bold text-[#0b1220]">{t("variants_page.info_title")}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-[#334155]">{t("variants_page.info_desc")}</p>
        </div>
        <CupsArt />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-[260px] min-w-[170px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#0b1220]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("variants_page.search_ph")}
            className="h-12 rounded-2xl border-[#e3ebf7] bg-white pl-11 text-sm text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05)] placeholder:text-[#64748b]"
          />
          {search ? (
            <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <FilterSelect
          icon={<Layers className="size-[18px]" strokeWidth={1.9} />}
          value={categoryFilter}
          onChange={(v) => {
            setCategoryFilter(v);
            setProductFilter("all");
          }}
          options={[{ value: "all", label: t("menu_page.all_categories") }, ...categories.map((c) => ({ value: c._id, label: c.name }))]}
        />
        <FilterSelect
          icon={<Box className="size-[18px]" strokeWidth={1.9} />}
          value={productFilter}
          onChange={setProductFilter}
          options={[
            { value: "all", label: t("variants_page.all_products") },
            ...productsForFilter.map((i) => ({ value: i._id, label: i.name })),
          ]}
        />
        <div className="ml-auto flex items-center gap-3">
          {selectedVisible.length > 0 ? (
            <button
              type="button"
              onClick={() => void removeRows(selectedVisible)}
              className="inline-flex h-12 items-center gap-1.5 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="size-4" />
              {t("menu_page.delete_selected", { selectedCount: selectedVisible.length })}
            </button>
          ) : null}
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-[15px] font-semibold shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)] transition hover:opacity-95"
            style={{ backgroundColor: "#1d5ff0", color: "#ffffff" }}
          >
            <Plus className="size-5" strokeWidth={2.2} />
            {t("variants_page.add")}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[22px] border border-[#e3ebf7] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-28px_rgba(37,99,235,0.35)]">
        <div className="min-w-[1000px]">
          <div className={cn(GRID, "bg-[#f7f9fd] px-5 py-2.5")}>
            <div className="flex justify-center">
              <Checkbox
                checked={allChecked}
                onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(visible.map((r) => r.rowKey)))}
              />
            </div>
            <span className={TH}>{t("variants_page.col_group")}</span>
            <span className={TH}>{t("variants_page.col_options")}</span>
            <span className={cn(TH, "text-center")}>{t("variants_page.col_products")}</span>
            <span className={TH}>{t("variants_page.col_type")}</span>
            <span className={TH}>{t("variants_page.col_price")}</span>
            <span className={TH}>{t("variants_page.col_status")}</span>
            <span className={cn(TH, "text-center")}>{t("menu_page.col_actions")}</span>
          </div>

          {itemsQuery === undefined || libraryQuery === undefined ? (
            <p className="px-5 py-10 text-center text-sm text-[#64748b]">{t("common.loading")}</p>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <SlidersHorizontal className="size-6 text-[#94a3b8]" />
              <p className="text-sm font-semibold text-[#0b1220]">
                {rows.length === 0 ? t("variants_page.empty") : t("categories_page.empty_filtered")}
              </p>
              {rows.length === 0 ? <p className="max-w-md text-[13px] text-[#64748b]">{t("variants_page.empty_desc")}</p> : null}
            </div>
          ) : (
            visible.map((row) => {
              const g = row.group;
              const Icon = iconForGroup(g.name);
              const checked = selected.has(row.rowKey);
              const shown = g.options.slice(0, 4);
              const multi = g.selectionType === "multi";
              const limits = selectionLimits(g);
              const addsPrice = g.options.some((o) => (o.priceDelta ?? 0) !== 0);
              return (
                <div
                  key={row.rowKey}
                  className={cn(GRID, "border-t border-[#eef2f8] px-5 py-2", checked ? "bg-[#f1f6ff]" : "bg-white hover:bg-[#fafcff]")}
                >
                  <div className="flex justify-center">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(row.rowKey)) next.delete(row.rowKey);
                          else next.add(row.rowKey);
                          return next;
                        })
                      }
                    />
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#dbe7ff] bg-[linear-gradient(145deg,#f5f9ff,#e4eeff)] text-[#2563eb]">
                      <Icon className="size-[18px]" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold text-[#0b1220]">{g.name}</span>
                      {g.description ? <span className="block truncate text-[12px] text-[#64748b]">{g.description}</span> : null}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {shown.map((o) => (
                      <span
                        key={o.id}
                        title={o.priceDelta ? `${o.priceDelta > 0 ? "+" : "−"}${formatPrice(Math.abs(o.priceDelta))}` : undefined}
                        className="rounded-full border border-[#e3ebf7] bg-[#f7f9fd] px-2.5 py-0.5 text-[12px] font-medium text-[#0b1220]"
                      >
                        {o.name}
                      </span>
                    ))}
                    {g.options.length > shown.length ? (
                      <span className="rounded-full bg-[#eef2fb] px-2 py-0.5 text-[12px] font-semibold text-[#334155]">
                        +{g.options.length - shown.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2fb] px-3 py-1 text-[13px] font-bold tabular-nums text-[#0b1220]">
                      <Box className="size-3.5" strokeWidth={2} />
                      {row.itemIds.length}
                    </span>
                  </div>
                  <span className="flex flex-col items-start gap-1">
                    <span
                      className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                      style={multi ? { backgroundColor: "#f3e8ff", color: "#7e22ce" } : { backgroundColor: "#e8f0ff", color: "#1d4ed8" }}
                    >
                      {multi ? t("variants_page.type_multi") : t("variants_page.type_single")}
                    </span>
                    <span className="text-[11px] font-medium" style={{ color: g.required ? "#c2410c" : "#64748b" }}>
                      {multi
                        ? t("variants_page.limits_short", { min: limits.min, max: limits.max })
                        : g.required
                          ? t("variants_page.required")
                          : t("variants_page.optional")}
                    </span>
                  </span>
                  <span className="text-[13px] text-[#0b1220]">
                    {addsPrice ? t("variants_page.price_adds") : t("variants_page.price_none")}
                  </span>
                  <span className="flex items-center gap-2">
                    <ToggleSwitch checked={row.active} label={t("variants_page.col_status")} onChange={() => void toggleRowActive(row)} />
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                      style={row.active ? { backgroundColor: "#eaf8ee", color: "#15803d" } : { backgroundColor: "#fdeceb", color: "#dc2626" }}
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: row.active ? "#16a34a" : "#ef4444" }} />
                      {row.active ? t("menu_page.status_active") : t("menu_page.status_inactive")}
                    </span>
                  </span>
                  <div className="flex items-center justify-center gap-1">
                    <IconAction label={t("btn.edit")} onClick={() => openEdit(row)}>
                      <Pencil className="size-[18px]" strokeWidth={2} />
                    </IconAction>
                    <IconAction label={t("btn.delete")} danger onClick={() => void removeRows([row])}>
                      <Trash2 className="size-[18px]" strokeWidth={2} />
                    </IconAction>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Sheet open={editing !== null} onOpenChange={(open) => (!open && !saving ? setEditing(null) : undefined)}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-[#e3ebf7] bg-[linear-gradient(180deg,#f7f9ff,#ffffff)] p-0 text-[#0b1220] sm:max-w-[640px] [&>button:last-child]:hidden">
          <SheetHeader className="flex-row items-center gap-3.5 space-y-0 border-b border-[#eef2f8] px-6 py-4 text-left">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#dbe7ff] bg-[linear-gradient(145deg,#f5f9ff,#e4eeff)] text-[#2563eb]">
              <Layers className="size-6" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-[22px] font-bold tracking-tight text-[#0b1220]">
                {editing?.row ? t("variants_page.edit_title") : t("variants_page.add_title")}
              </SheetTitle>
              <SheetDescription className="text-[13px] text-[#475569]">
                {editing?.row ? t("variants_page.dialog_desc_edit") : t("variants_page.dialog_desc")}
              </SheetDescription>
            </div>
            <button
              type="button"
              aria-label={t("btn.cancel")}
              disabled={saving}
              onClick={() => setEditing(null)}
              className="flex size-10 items-center justify-center rounded-xl border border-[#e3ebf7] bg-white text-[#0b1220] shadow-sm hover:bg-[#f1f5fb]"
            >
              <X className="size-[18px]" strokeWidth={2.2} />
            </button>
          </SheetHeader>

          {draft ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <FormSection icon={<Info className="size-[18px]" strokeWidth={2} />} title={t("variants_page.section_general")}>
                <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                  <label className="block space-y-1.5">
                    <span className="text-[13px] font-semibold">
                      {t("variants_page.field_name")} <span className="text-red-500">*</span>
                    </span>
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder={t("variants_page.field_name_ph")}
                      className="h-11 rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]"
                    />
                  </label>
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-semibold">{t("variants_page.col_status")}</span>
                    <Select value={draft.active ? "active" : "inactive"} onValueChange={(v) => setDraft({ ...draft, active: v === "active" })}>
                      <SelectTrigger className="h-11 w-full rounded-xl border-[#e3ebf7] bg-white font-semibold" style={{ color: draft.active ? "#15803d" : "#dc2626" }}>
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: draft.active ? "#16a34a" : "#ef4444" }} />
                          <SelectValue />
                        </span>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]">
                        <SelectItem value="active" className="text-[13px] focus:bg-[#f1f5ff]">{t("menu_page.status_active")}</SelectItem>
                        <SelectItem value="inactive" className="text-[13px] focus:bg-[#f1f5ff]">{t("menu_page.status_inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="mt-3 block space-y-1.5">
                  <span className="text-[13px] font-semibold">
                    {t("variants_page.field_description")}{" "}
                    <span className="font-medium text-[#2563eb]">({t("variants_page.optional_label")})</span>
                  </span>
                  <textarea
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder={t("variants_page.field_description_ph")}
                    rows={2}
                    className="w-full resize-y rounded-xl border border-[#e3ebf7] bg-white px-3 py-2.5 text-[14px] text-[#0b1220] outline-none placeholder:text-[#94a3b8] focus:border-[#1d5ff0] focus:ring-2 focus:ring-[#1d5ff0]/15"
                  />
                </label>
              </FormSection>

              <FormSection icon={<Settings2 className="size-[18px]" strokeWidth={2} />} title={t("variants_page.section_selection")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-semibold">{t("variants_page.field_selection_type")}</span>
                    <Segmented
                      value={draft.selectionType}
                      onChange={(v) => switchType(v as "single" | "multi")}
                      options={[
                        { value: "single", label: t("variants_page.type_single") },
                        { value: "multi", label: t("variants_page.type_multi") },
                      ]}
                    />
                    <p className="text-[12px] text-[#64748b]">
                      {draft.selectionType === "multi" ? t("variants_page.type_multi_help") : t("variants_page.type_single_help")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-semibold">{t("variants_page.field_requirement")}</span>
                    <Segmented
                      value={draft.required ? "required" : "optional"}
                      onChange={(v) => {
                        const required = v === "required";
                        const minTooLow = draft.selectionType === "multi" && required && Number(draft.minSelect) < 1;
                        setDraft({ ...draft, required, ...(minTooLow ? { minSelect: "1" } : {}) });
                      }}
                      options={[
                        { value: "required", label: t("variants_page.required") },
                        { value: "optional", label: t("variants_page.optional") },
                      ]}
                    />
                    <p className="text-[12px] text-[#64748b]">
                      {draft.required ? t("variants_page.required_help") : t("variants_page.optional_help")}
                    </p>
                  </div>

                  {draft.selectionType === "single" ? (
                    <div className="space-y-1.5">
                      <span className="text-[13px] font-semibold">{t("variants_page.field_default")}</span>
                      <Select
                        value={draft.defaultOptionId || "none"}
                        onValueChange={(v) => setDraft({ ...draft, defaultOptionId: v === "none" ? "" : v })}
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]">
                          <SelectItem value="none" className="text-[13px] focus:bg-[#f1f5ff]">{t("variants_page.default_none")}</SelectItem>
                          {filledOptions(draft).map((o) => (
                            <SelectItem key={o.id} value={o.id} className="text-[13px] focus:bg-[#f1f5ff]">
                              {o.name.trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[12px] text-[#64748b]">{t("variants_page.default_help")}</p>
                    </div>
                  ) : (
                    (() => {
                      // Limits count the option rows shown in the drawer (empty rows are dropped on save).
                      const rows = draft.options.length;
                      const hasOptions = rows > 0;
                      const cap = Math.max(1, rows);
                      const floor = draft.required ? 1 : 0;
                      const minN = /^\d+$/.test(draft.minSelect.trim()) ? Number(draft.minSelect) : NaN;
                      const maxN = /^\d+$/.test(draft.maxSelect.trim()) ? Number(draft.maxSelect) : NaN;
                      // Nothing to validate until there is an option; errors show only after the
                      // owner used Min/Max or tried to save.
                      const limitError = !hasOptions
                        ? null
                        : !Number.isFinite(minN)
                          ? t("variants_page.min_invalid")
                          : !Number.isFinite(maxN) || maxN < 1
                            ? t("variants_page.max_invalid")
                            : minN > maxN
                              ? t("variants_page.min_over_max")
                              : minN < floor
                                ? t("variants_page.min_required")
                                : null;
                      const shownError = editing?.showLimitErrors ? limitError : null;
                      const curMin = Number.isFinite(minN) ? minN : floor;
                      // Without options the minimum cannot go above its floor (0, or 1 when required).
                      const curMax = hasOptions ? (Number.isFinite(maxN) ? Math.min(cap, maxN) : cap) : floor;
                      /** Owner's own maximum; never below the minimum and never above the option count. */
                      const setCustomMax = (n: number) =>
                        setDraft({ ...draft, maxCustom: true, maxSelect: String(Math.min(cap, Math.max(Math.max(1, curMin), n))) }, true);
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <span className="text-[13px] font-semibold">{t("variants_page.field_min")}</span>
                            <NumberStepper
                              value={draft.minSelect}
                              invalid={Boolean(shownError) && (!Number.isFinite(minN) || minN > maxN || minN < floor)}
                              canDecrease={curMin > floor}
                              canIncrease={curMin < curMax}
                              decreaseLabel={t("variants_page.decrease")}
                              increaseLabel={t("variants_page.increase")}
                              onStep={(d) => setDraft({ ...draft, minSelect: String(Math.min(curMax, Math.max(floor, curMin + d))) }, true)}
                              // Typed minimum can never pass the maximum.
                              onType={(v) => setDraft({ ...draft, minSelect: v === "" ? "" : String(Math.min(Number(v), curMax)) }, true)}
                              onBlur={() =>
                                setDraft(
                                  { ...draft, minSelect: String(Math.min(curMax, Math.max(floor, Number.isFinite(minN) ? minN : floor))) },
                                  true,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[13px] font-semibold">{t("variants_page.field_max")}</span>
                            <NumberStepper
                              value={hasOptions ? draft.maxSelect : ""}
                              placeholder={hasOptions ? undefined : "—"}
                              disabled={!hasOptions}
                              invalid={Boolean(shownError) && (!Number.isFinite(maxN) || maxN < 1 || minN > maxN)}
                              canDecrease={hasOptions && curMax > Math.max(1, curMin)}
                              canIncrease={hasOptions && curMax < cap}
                              decreaseLabel={t("variants_page.decrease")}
                              increaseLabel={t("variants_page.increase")}
                              onStep={(d) => setCustomMax(curMax + d)}
                              // Typing marks the maximum as the owner's; capped at the option count.
                              onType={(v) =>
                                setDraft(
                                  { ...draft, maxCustom: true, maxSelect: v === "" ? "" : String(Math.min(Number(v), cap)) },
                                  true,
                                )
                              }
                              // Left empty: back to automatic (= number of options).
                              onBlur={() =>
                                draft.maxSelect.trim() === ""
                                  ? setDraft({ ...draft, maxCustom: false, maxSelect: String(rows) }, true)
                                  : setCustomMax(Number.isFinite(maxN) ? maxN : cap)
                              }
                            />
                          </div>
                          <p
                            className="col-span-2 -mt-1 text-[12px]"
                            style={{ color: shownError ? "#dc2626" : "#64748b" }}
                            role={shownError ? "alert" : undefined}
                          >
                            {!hasOptions
                              ? t("variants_page.limits_need_options")
                              : (shownError ??
                                (draft.maxCustom
                                  ? t("variants_page.limits_help_custom", { count: rows })
                                  : t(rows === 1 ? "variants_page.limits_help_one" : "variants_page.limits_help", { count: rows })))}
                          </p>
                        </div>
                      );
                    })()
                  )}

                  <div className="space-y-1.5">
                    <span className="text-[13px] font-semibold">{t("variants_page.field_price_mode")}</span>
                    <Select value={draft.priceMode} onValueChange={(v) => setDraft({ ...draft, priceMode: v as "add" | "none" })}>
                      <SelectTrigger className="h-11 w-full rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]">
                        <SelectItem value="add" className="text-[13px] focus:bg-[#f1f5ff]">{t("variants_page.price_adds")}</SelectItem>
                        <SelectItem value="none" className="text-[13px] focus:bg-[#f1f5ff]">{t("variants_page.price_none")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[12px] text-[#64748b]">{t("variants_page.price_mode_help")}</p>
                  </div>
                </div>
              </FormSection>

              <FormSection
                icon={<Box className="size-[18px]" strokeWidth={2} />}
                title={t("variants_page.section_options")}
                subtitle={t("variants_page.section_options_desc")}
                action={
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, options: [...draft.options, { id: newCustomizationOptionId(), name: "", priceDelta: "0" }] })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)]"
                    style={{ backgroundColor: "#1d5ff0", color: "#ffffff" }}
                  >
                    <Plus className="size-4" strokeWidth={2.2} />
                    {t("variants_page.add_option")}
                  </button>
                }
              >
                <div className="overflow-hidden rounded-xl border border-[#e3ebf7] bg-white">
                  <div className="grid grid-cols-[22px_32px_1fr_150px_36px] items-center gap-2 bg-[#f7f9fd] px-3 py-2 text-[12px] font-semibold text-[#334155]">
                    <span />
                    <span>#</span>
                    <span>
                      {t("variants_page.col_option_name")} <span className="text-red-500">*</span>
                    </span>
                    <span>{t("variants_page.col_price")}</span>
                    <span />
                  </div>
                  {draft.options.map((o, idx) => (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        setDragOption(o.id);
                      }}
                      onDragEnd={() => setDragOption(null)}
                      onDragOver={(e) => {
                        if (dragOption && dragOption !== o.id) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragOption || dragOption === o.id) return;
                        const list = [...draft.options];
                        const from = list.findIndex((x) => x.id === dragOption);
                        const [moved] = list.splice(from, 1);
                        list.splice(list.findIndex((x) => x.id === o.id) + (from <= idx ? 1 : 0), 0, moved);
                        setDraft({ ...draft, options: list });
                        setDragOption(null);
                      }}
                      className={cn(
                        "grid grid-cols-[22px_32px_1fr_150px_36px] items-center gap-2 border-t border-[#eef2f8] px-3 py-2",
                        dragOption === o.id && "opacity-50",
                      )}
                    >
                      <GripVertical className="size-4 cursor-grab text-[#64748b]" />
                      <span className="flex size-7 items-center justify-center rounded-lg bg-[#eef2fb] text-[12px] font-bold text-[#0b1220]">
                        {idx + 1}
                      </span>
                      <Input
                        value={o.name}
                        onChange={(e) => {
                          const options = [...draft.options];
                          options[idx] = { ...o, name: e.target.value };
                          setDraft({ ...draft, options });
                        }}
                        placeholder={t("variants_page.option_ph")}
                        className="h-10 rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]"
                      />
                      <div className="flex h-10 items-center overflow-hidden rounded-xl border border-[#e3ebf7] bg-white focus-within:border-[#1d5ff0]">
                        <span className="flex h-full items-center border-r border-[#e3ebf7] bg-[#f7f9fd] px-2.5 text-[13px] font-semibold text-[#0b1220]">
                          {currency.symbol}
                        </span>
                        <input
                          value={draft.priceMode === "none" ? "0" : o.priceDelta}
                          disabled={draft.priceMode === "none"}
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={t("variants_page.price_delta")}
                          onChange={(e) => {
                            const options = [...draft.options];
                            options[idx] = { ...o, priceDelta: e.target.value };
                            setDraft({ ...draft, options });
                          }}
                          className="h-full min-w-0 flex-1 bg-transparent px-2 text-[14px] tabular-nums text-[#0b1220] outline-none disabled:text-[#94a3b8]"
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={t("btn.delete")}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            options: draft.options.filter((x) => x.id !== o.id),
                            defaultOptionId: draft.defaultOptionId === o.id ? "" : draft.defaultOptionId,
                          })
                        }
                        className="flex size-9 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-[#64748b]">{t("variants_page.price_sign_help")}</p>
              </FormSection>

              <p className="flex items-start gap-2 rounded-xl border border-[#dbe7ff] bg-[#f3f7ff] px-3 py-2.5 text-[12px] text-[#334155]">
                <Info className="mt-0.5 size-4 shrink-0 text-[#2563eb]" />
                {editing?.row && editing.row.itemIds.length > 0
                  ? t("variants_page.assign_note_edit", { count: editing.row.itemIds.length })
                  : t("variants_page.assign_note")}
              </p>
            </div>
          ) : null}

          <div className="flex gap-3 border-t border-[#eef2f8] bg-white px-6 py-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(null)}
              className="h-12 flex-1 rounded-2xl border border-[#e3ebf7] bg-white text-[15px] font-semibold text-[#0b1220] shadow-sm hover:bg-[#f7f9fd]"
            >
              {t("btn.cancel")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraft()}
              className="inline-flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)] disabled:opacity-60"
              style={{ backgroundColor: "#1d5ff0", color: "#ffffff" }}
            >
              <Check className="size-5" strokeWidth={2.4} />
              {saving ? t("common.loading") : editing?.row ? t("variants_page.save_changes") : t("variants_page.create_group")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterSelect({
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
      <SelectTrigger className="h-12 w-[190px] shrink-0 rounded-2xl border-[#e3ebf7] bg-white px-4 text-[14px] font-semibold text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0">{icon}</span>
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

function CupsArt() {
  const cup = (x: number, w: number, h: number, label: string) => (
    <g key={label}>
      <path d={`M${x} ${92 - h + 8}h${w}l-${w * 0.08} ${h - 8}h-${w * 0.84}z`} fill="#ffffff" stroke="#c7d6f5" />
      <rect x={x - 2} y={92 - h} width={w + 4} height="9" rx="4" fill="#3b82f6" />
      <text x={x + w / 2} y={92 - h * 0.35} textAnchor="middle" fontSize={w * 0.36} fontWeight="800" fill="#1d4ed8" fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 120 100" className="pointer-events-none absolute bottom-2 right-4 h-[72px] w-[104px]" aria-hidden>
      <ellipse cx="62" cy="94" rx="50" ry="4" fill="#1e3a8a" opacity="0.08" />
      {cup(8, 26, 40, "S")}
      {cup(42, 32, 56, "M")}
      {cup(82, 34, 72, "L")}
    </svg>
  );
}
