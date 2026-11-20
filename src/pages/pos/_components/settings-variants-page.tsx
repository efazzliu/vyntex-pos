import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import {
  newCustomizationGroupId,
  newCustomizationOptionId,
  normalizeCustomizationConfig,
  type MenuCustomizationGroup,
} from "@/lib/menu-customizations.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import {
  Box,
  CupSoda,
  Flame,
  Info,
  Layers,
  Milk,
  Pencil,
  Pizza,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

type Translate = (key: string, options?: Record<string, unknown>) => string;
type Item = Doc<"menuItems">;
type Category = Doc<"menuCategories">;

/** One variant group as the owner sees it: same name across products, options merged. */
type VariantRow = {
  key: string;
  name: string;
  options: { name: string; priceDelta: number }[];
  itemIds: string[];
  multi: boolean;
  required: boolean;
  addsPrice: boolean;
};

type DraftOption = { id: string; name: string; priceDelta: string };
type Draft = {
  originalKey: string | null;
  name: string;
  selectionType: "single" | "multi";
  required: boolean;
  options: DraftOption[];
  itemIds: Set<string>;
};

const GRID =
  "grid items-center gap-3 grid-cols-[32px_minmax(170px,1.1fr)_minmax(150px,1fr)_84px_120px_130px_120px_88px] xl:gap-4";
const TH = "text-[12px] font-semibold uppercase tracking-wide text-[#334155]";

function groupKey(name: string) {
  return name.trim().toLowerCase();
}

function iconForGroup(name: string) {
  const n = name.toLowerCase();
  if (/size|madh/i.test(n)) return CupSoda;
  if (/cook|pjek|done|well/i.test(n)) return Flame;
  if (/crust|pizza|brum/i.test(n)) return Pizza;
  if (/milk|qum/i.test(n)) return Milk;
  return SlidersHorizontal;
}

export default function SettingsVariantsPage({
  licenseKey,
  t,
}: {
  licenseKey: string;
  t: Translate;
}) {
  const { formatPrice } = usePosLocale();
  const itemsQuery = useQuery("pos.menu.getAllItems", { licenseKey }) as Item[] | undefined;
  const categoriesQuery = useQuery("pos.menu.getAllCategories", { licenseKey }) as Category[] | undefined;
  const setItemCustomizations = useMutation("pos.menu.setItemCustomizations");

  const items = useMemo(() => itemsQuery ?? [], [itemsQuery]);
  const categories = useMemo(() => categoriesQuery ?? [], [categoriesQuery]);
  const groupsOf = (item: Item) =>
    normalizeCustomizationConfig((item as { customizationConfig?: unknown }).customizationConfig);

  const rows = useMemo<VariantRow[]>(() => {
    const map = new Map<string, VariantRow>();
    for (const item of items) {
      for (const g of groupsOf(item)) {
        const key = groupKey(g.name);
        const row =
          map.get(key) ??
          ({ key, name: g.name, options: [], itemIds: [], multi: false, required: false, addsPrice: false } as VariantRow);
        row.itemIds.push(item._id);
        row.multi = row.multi || g.selectionType === "multi";
        row.required = row.required || Boolean(g.required);
        for (const o of g.options) {
          if (!row.options.some((x) => x.name.toLowerCase() === o.name.toLowerCase())) {
            row.options.push({ name: o.name, priceDelta: o.priceDelta ?? 0 });
          }
          if ((o.priceDelta ?? 0) !== 0) row.addsPrice = true;
        }
        map.set(key, row);
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [items]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const itemById = useMemo(() => new Map(items.map((i) => [i._id as string, i])), [items]);
  const visible = rows.filter((r) => {
    if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (productFilter !== "all" && !r.itemIds.includes(productFilter)) return false;
    if (categoryFilter !== "all" && !r.itemIds.some((id) => itemById.get(id)?.categoryId === categoryFilter)) return false;
    return true;
  });
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.key));
  const selectedVisible = visible.filter((r) => selected.has(r.key));

  /** Writes one product's groups; `mutate` returns the new list. */
  const writeItem = async (item: Item, mutate: (groups: MenuCustomizationGroup[]) => MenuCustomizationGroup[]) => {
    const next = mutate(groupsOf(item));
    await setItemCustomizations({ licenseKey, itemId: item._id, customizationConfig: next });
  };

  const openNew = () =>
    setDraft({
      originalKey: null,
      name: "",
      selectionType: "single",
      required: false,
      options: [
        { id: newCustomizationOptionId(), name: "", priceDelta: "0" },
        { id: newCustomizationOptionId(), name: "", priceDelta: "0" },
      ],
      itemIds: new Set(productFilter !== "all" ? [productFilter] : []),
    });

  const openEdit = (row: VariantRow) => {
    const sample = row.itemIds.map((id) => itemById.get(id)).find(Boolean);
    const group = sample ? groupsOf(sample).find((g) => groupKey(g.name) === row.key) : undefined;
    setDraft({
      originalKey: row.key,
      name: row.name,
      selectionType: group?.selectionType === "multi" ? "multi" : "single",
      required: Boolean(group?.required),
      options: (group?.options ?? row.options.map((o) => ({ id: newCustomizationOptionId(), ...o }))).map((o) => ({
        id: "id" in o && o.id ? o.id : newCustomizationOptionId(),
        name: o.name,
        priceDelta: String(o.priceDelta ?? 0),
      })),
      itemIds: new Set(row.itemIds),
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const options = draft.options
      .map((o) => ({ ...o, name: o.name.trim(), delta: Number(o.priceDelta.replace(",", ".")) }))
      .filter((o) => o.name);
    if (!name) return toast.error(t("variants_page.name_required"));
    if (options.length === 0) return toast.error(t("variants_page.options_required"));
    if (options.some((o) => !Number.isFinite(o.delta))) return toast.error(t("variants_page.price_invalid"));
    if (draft.itemIds.size === 0) return toast.error(t("variants_page.products_required"));
    const key = groupKey(name);
    if (key !== draft.originalKey && rows.some((r) => r.key === key)) {
      return toast.error(t("variants_page.name_exists"));
    }
    setSaving(true);
    const removeKeys = new Set([draft.originalKey, key].filter(Boolean) as string[]);
    const before = new Set(draft.originalKey ? rows.find((r) => r.key === draft.originalKey)?.itemIds ?? [] : []);
    const touched = new Set([...before, ...draft.itemIds]);
    let failed = 0;
    for (const id of touched) {
      const item = itemById.get(id);
      if (!item) continue;
      try {
        await writeItem(item, (groups) => {
          const existing = groups.find((g) => removeKeys.has(groupKey(g.name)));
          const rest = groups.filter((g) => !removeKeys.has(groupKey(g.name)));
          if (!draft.itemIds.has(id)) return rest;
          const group: MenuCustomizationGroup = {
            id: existing?.id ?? newCustomizationGroupId(),
            name,
            required: draft.required,
            selectionType: draft.selectionType,
            options: options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.delta })),
          };
          return existing ? groups.map((g) => (g === existing ? group : g)).filter((g) => g === group || !removeKeys.has(groupKey(g.name))) : [...rest, group];
        });
      } catch {
        failed += 1;
      }
    }
    setSaving(false);
    if (failed > 0) {
      toast.error(t("variants_page.save_partial", { count: failed }));
      return;
    }
    toast.success(t("variants_page.saved"));
    setDraft(null);
  };

  const removeRows = async (targets: VariantRow[]) => {
    if (targets.length === 0) return;
    const message =
      targets.length === 1
        ? t("variants_page.confirm_delete", { name: targets[0].name, count: targets[0].itemIds.length })
        : t("variants_page.confirm_delete_many", { count: targets.length });
    if (!window.confirm(message)) return;
    const keys = new Set(targets.map((r) => r.key));
    const ids = new Set(targets.flatMap((r) => r.itemIds));
    let failed = 0;
    for (const id of ids) {
      const item = itemById.get(id);
      if (!item) continue;
      try {
        await writeItem(item, (groups) => groups.filter((g) => !keys.has(groupKey(g.name))));
      } catch (err) {
        failed += 1;
        if (failed === 1) toast.error(errorMessageFromUnknown(err, t("variants_page.delete_failed")));
      }
    }
    setSelected(new Set());
    if (failed === 0) toast.success(t("variants_page.deleted"));
  };

  const productsForPicker = items
    .filter((i) => categoryFilter === "all" || i.categoryId === categoryFilter)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));

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
            ...productsForPicker.map((i) => ({ value: i._id, label: i.name })),
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
        <div className="min-w-[980px]">
          <div className={cn(GRID, "bg-[#f7f9fd] px-5 py-2.5")}>
            <div className="flex justify-center">
              <Checkbox
                checked={allChecked}
                onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(visible.map((r) => r.key)))}
              />
            </div>
            <span className={TH}>{t("variants_page.col_group")}</span>
            <span className={TH}>{t("variants_page.col_options")}</span>
            <span className={cn(TH, "text-center")}>{t("variants_page.col_products")}</span>
            <span className={TH}>{t("variants_page.col_type")}</span>
            <span className={TH}>{t("variants_page.col_price")}</span>
            <span className={TH}>{t("variants_page.col_required")}</span>
            <span className={cn(TH, "text-center")}>{t("menu_page.col_actions")}</span>
          </div>

          {itemsQuery === undefined ? (
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
              const Icon = iconForGroup(row.name);
              const checked = selected.has(row.key);
              const shown = row.options.slice(0, 4);
              return (
                <div
                  key={row.key}
                  className={cn(GRID, "border-t border-[#eef2f8] px-5 py-2", checked ? "bg-[#f1f6ff]" : "bg-white hover:bg-[#fafcff]")}
                >
                  <div className="flex justify-center">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(row.key)) next.delete(row.key);
                          else next.add(row.key);
                          return next;
                        })
                      }
                    />
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#dbe7ff] bg-[linear-gradient(145deg,#f5f9ff,#e4eeff)] text-[#2563eb]">
                      <Icon className="size-[18px]" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 truncate text-[14px] font-bold text-[#0b1220]">{row.name}</span>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {shown.map((o) => (
                      <span
                        key={o.name}
                        title={o.priceDelta ? `+${formatPrice(o.priceDelta)}` : undefined}
                        className="rounded-full border border-[#e3ebf7] bg-[#f7f9fd] px-2.5 py-0.5 text-[12px] font-medium text-[#0b1220]"
                      >
                        {o.name}
                      </span>
                    ))}
                    {row.options.length > shown.length ? (
                      <span className="rounded-full bg-[#eef2fb] px-2 py-0.5 text-[12px] font-semibold text-[#334155]">
                        +{row.options.length - shown.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2fb] px-3 py-1 text-[13px] font-bold tabular-nums text-[#0b1220]">
                      <Box className="size-3.5" strokeWidth={2} />
                      {row.itemIds.length}
                    </span>
                  </div>
                  <span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                      style={row.multi ? { backgroundColor: "#f3e8ff", color: "#7e22ce" } : { backgroundColor: "#e8f0ff", color: "#1d4ed8" }}
                    >
                      {row.multi ? t("variants_page.type_multi") : t("variants_page.type_single")}
                    </span>
                  </span>
                  <span className="text-[13px] text-[#0b1220]">
                    {row.addsPrice ? t("variants_page.price_adds") : t("variants_page.price_none")}
                  </span>
                  <span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                      style={row.required ? { backgroundColor: "#fff4e5", color: "#c2410c" } : { backgroundColor: "#eaf8ee", color: "#15803d" }}
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: row.required ? "#f97316" : "#16a34a" }} />
                      {row.required ? t("variants_page.required") : t("variants_page.optional")}
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

      <Dialog open={draft !== null} onOpenChange={(open) => (!open && !saving ? setDraft(null) : undefined)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-[#e3ebf7] bg-white text-[#0b1220]">
          <DialogHeader>
            <DialogTitle className="text-[#0b1220]">
              {draft?.originalKey ? t("variants_page.edit_title") : t("variants_page.add_title")}
            </DialogTitle>
            <DialogDescription className="text-[#64748b]">{t("variants_page.dialog_desc")}</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold">{t("variants_page.field_name")}</span>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={t("variants_page.field_name_ph")}
                  className="h-10 border-[#e3ebf7] bg-white text-[#0b1220]"
                />
              </label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  {(["single", "multi"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDraft({ ...draft, selectionType: type })}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-[13px] font-semibold transition",
                        draft.selectionType === type ? "border-[#1d5ff0] bg-[#eef4ff] text-[#1d5ff0]" : "border-[#e3ebf7] bg-white text-[#334155]",
                      )}
                    >
                      {type === "single" ? t("variants_page.type_single") : t("variants_page.type_multi")}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[13px] font-semibold">
                  <Checkbox checked={draft.required} onCheckedChange={(v) => setDraft({ ...draft, required: v === true })} />
                  {t("variants_page.required")}
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-[13px] font-semibold">{t("variants_page.field_options")}</span>
                {draft.options.map((o, idx) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <Input
                      value={o.name}
                      onChange={(e) => {
                        const options = [...draft.options];
                        options[idx] = { ...o, name: e.target.value };
                        setDraft({ ...draft, options });
                      }}
                      placeholder={t("variants_page.option_ph")}
                      className="h-10 flex-1 border-[#e3ebf7] bg-white text-[#0b1220]"
                    />
                    <div className="relative w-32">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#64748b]">+</span>
                      <Input
                        value={o.priceDelta}
                        inputMode="decimal"
                        onChange={(e) => {
                          const options = [...draft.options];
                          options[idx] = { ...o, priceDelta: e.target.value };
                          setDraft({ ...draft, options });
                        }}
                        className="h-10 border-[#e3ebf7] bg-white pl-6 text-[#0b1220]"
                        aria-label={t("variants_page.price_delta")}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={t("btn.delete")}
                      onClick={() => setDraft({ ...draft, options: draft.options.filter((x) => x.id !== o.id) })}
                      className="flex size-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, options: [...draft.options, { id: newCustomizationOptionId(), name: "", priceDelta: "0" }] })
                  }
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1d5ff0]"
                >
                  <Plus className="size-4" />
                  {t("variants_page.add_option")}
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-[13px] font-semibold">
                  {t("variants_page.field_products", { count: draft.itemIds.size })}
                </span>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[#e3ebf7] p-2">
                  {productsForPicker.length === 0 ? (
                    <p className="px-2 py-3 text-[13px] text-[#64748b]">{t("menu_page.empty_items")}</p>
                  ) : (
                    productsForPicker.map((item) => (
                      <label key={item._id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#f7f9fd]">
                        <Checkbox
                          checked={draft.itemIds.has(item._id)}
                          onCheckedChange={() => {
                            const ids = new Set(draft.itemIds);
                            if (ids.has(item._id)) ids.delete(item._id);
                            else ids.add(item._id);
                            setDraft({ ...draft, itemIds: ids });
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.name}</span>
                        <span className="text-[12px] tabular-nums text-[#64748b]">{formatPrice(item.price ?? 0)}</span>
                      </label>
                    ))
                  )}
                </div>
                {draft.originalKey ? <p className="text-[12px] text-[#64748b]">{t("variants_page.apply_note")}</p> : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <button
              type="button"
              disabled={saving}
              onClick={() => setDraft(null)}
              className="h-10 rounded-xl border border-[#e3ebf7] bg-white px-4 text-sm font-semibold text-[#334155]"
            >
              {t("btn.cancel")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraft()}
              className="h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
              style={{ backgroundColor: "#1d5ff0", color: "#ffffff" }}
            >
              {saving ? t("common.loading") : t("btn.save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
