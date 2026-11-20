import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet.tsx";
import { cn } from "@/lib/utils.ts";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { GENERAL_PREFS_NEED_COLUMN } from "@/lib/supabase-pos/general-prefs-store.ts";
import {
  newCustomizationOptionId,
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
import { usePosLocale } from "./pos-locale-provider.tsx";
import { FormSection, NumberStepper, Segmented, ToggleSwitch, variantGroupIcon } from "./drawer-form-kit.tsx";
import {
  Check,
  CircleDot,
  EyeOff,
  GripVertical,
  Info,
  Layers,
  ListChecks,
  Pencil,
  Plus,
  Puzzle,
  Search,
  Settings2,
  SquareCheck,
  Trash2,
  X,
} from "lucide-react";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const BRAND = "#1d5ff0";
const GRID =
  "grid items-center gap-3 grid-cols-[36px_28px_minmax(200px,1.4fr)_minmax(140px,1fr)_100px_100px_88px_100px_96px] xl:gap-4";
const TH = "text-[12px] font-semibold uppercase tracking-wide text-[#334155]";

/** Allows typing +, -, digits, one decimal separator (`.` or `,`). */
function sanitizePriceDelta(raw: string) {
  let value = raw.replace(/[^\d.,+-]/g, "");
  if (value.startsWith("+")) value = value.slice(1);
  const neg = value.startsWith("-");
  value = (neg ? "-" : "") + value.replace(/-/g, "");
  const sep = value.includes(",") ? "," : value.includes(".") ? "." : "";
  if (!sep) return value;
  const [head, ...rest] = value.split(sep);
  return `${head}${sep}${rest.join("").replace(/[.,]/g, "")}`;
}

export default function SettingsModifiersPage({ licenseKey, t }: { licenseKey: string; t: Translate }) {
  const { currency } = usePosLocale();
  const libraryQuery = useQuery("pos.menu.getModifierLibrary", { licenseKey }) as
    | MenuCustomizationGroup[]
    | undefined;
  const saveModifierGroup = useMutation("pos.menu.saveModifierGroup");
  const deleteModifierGroup = useMutation("pos.menu.deleteModifierGroup");
  const reorderModifierGroups = useMutation("pos.menu.reorderModifierGroups");

  const library = useMemo(() => libraryQuery ?? [], [libraryQuery]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{
    group: MenuCustomizationGroup | null;
    draft: VariantDraft;
    showLimitErrors: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOption, setDragOption] = useState<string | null>(null);
  const [dragRowId, setDragRowId] = useState<string | null>(null);

  const visible = library.filter((g) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return g.name.toLowerCase().includes(q) || (g.description ?? "").toLowerCase().includes(q);
  });
  const allChecked = visible.length > 0 && visible.every((g) => selected.has(g.id));
  const selectedVisible = visible.filter((g) => selected.has(g.id));

  const stats = useMemo(() => {
    const groups = library.length;
    const options = library.reduce((n, g) => n + g.options.length, 0);
    const active = library.filter((g) => g.active !== false).length;
    return { groups, options, active, inactive: groups - active };
  }, [library]);

  const errorText = (err: unknown, fallbackKey: string) =>
    err instanceof Error && err.message === GENERAL_PREFS_NEED_COLUMN
      ? t("floor.room_needs_db")
      : errorMessageFromUnknown(err, t(fallbackKey));

  const openNew = () =>
    setEditing({
      group: null,
      draft: { ...emptyVariantDraft(), priceMode: "add" },
      showLimitErrors: false,
    });
  const openEdit = (group: MenuCustomizationGroup) =>
    setEditing({
      group,
      draft: { ...groupToDraft(group), priceMode: "add" },
      showLimitErrors: false,
    });
  const setDraft = (draft: VariantDraft, touchLimits = false) =>
    setEditing((e) =>
      e ? { ...e, draft: fitSelectionLimits(draft), showLimitErrors: e.showLimitErrors || touchLimits } : e,
    );
  const draft = editing?.draft ?? null;

  const switchType = (type: "single" | "multi") => {
    if (!draft || draft.selectionType === type) return;
    setDraft(type === "multi" ? toMultipleChoice(draft) : { ...draft, selectionType: "single" });
  };

  const saveDraft = async () => {
    if (!editing || !draft) return;
    const others = library.filter((g) => g.id !== editing.group?.id).map((g) => g.name);
    const draftForSave = { ...draft, priceMode: "add" as const };
    const problem = validateVariantDraft(draftForSave, others);
    if (problem) {
      setEditing((e) => (e ? { ...e, showLimitErrors: true } : e));
      toast.error(t(problem.key.replace("variants_page.", "modifiers_page."), problem.params));
      return;
    }
    const group = draftToGroup(draftForSave, editing.group?.id);
    setSaving(true);
    try {
      await saveModifierGroup({ licenseKey, group });
      toast.success(t("modifiers_page.saved"));
      setEditing(null);
    } catch (err) {
      toast.error(errorText(err, "modifiers_page.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const removeGroups = async (targets: MenuCustomizationGroup[]) => {
    if (targets.length === 0) return;
    const message =
      targets.length === 1
        ? t("modifiers_page.confirm_delete", { name: targets[0].name })
        : t("modifiers_page.confirm_delete_many", { count: targets.length });
    if (!window.confirm(message)) return;
    let failed = 0;
    for (const group of targets) {
      try {
        await deleteModifierGroup({ licenseKey, groupId: group.id });
      } catch (err) {
        failed += 1;
        toast.error(errorText(err, "modifiers_page.delete_failed"));
      }
    }
    setSelected(new Set());
    if (failed === 0) toast.success(t("modifiers_page.deleted"));
  };

  const moveRow = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = library.map((g) => g.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    try {
      await reorderModifierGroups({ licenseKey, groupIds: next });
    } catch (err) {
      toast.error(errorText(err, "modifiers_page.save_failed"));
    }
  };

  const namedOptions = draft ? filledOptions(draft) : [];
  const optionCount = draft?.options.length ?? 0;
  const minN = draft ? Number(draft.minSelect) : 0;
  const maxN = draft ? Number(draft.maxSelect) : 0;
  const nameInvalid = Boolean(editing?.showLimitErrors && draft && !draft.name.trim());
  const minInvalid = Boolean(editing?.showLimitErrors && draft?.selectionType === "multi" && !/^\d+$/.test(draft.minSelect.trim()));
  const maxInvalid = Boolean(
    editing?.showLimitErrors &&
      draft?.selectionType === "multi" &&
      (!/^\d+$/.test(draft.maxSelect.trim()) || maxN < 1 || maxN > optionCount || (Number.isFinite(minN) && minN > maxN)),
  );

  return (
    <div className="space-y-5">
      <header className="flex min-w-0 flex-wrap items-center gap-4 px-1">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#dbe7ff] bg-[linear-gradient(145deg,#f4f8ff,#e3edff)] text-[#2563eb] shadow-[0_8px_20px_-12px_rgba(37,99,235,0.55)]">
          <Layers className="size-6" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#0b1220]">
            {t("settings.menu_modifiers_title")}
          </h1>
          <p className="mt-1 text-[14px] text-[#475569]">{t("modifiers_page.desc")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-[260px] min-w-[170px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#0b1220]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("modifiers_page.search_ph")}
              className="h-12 rounded-2xl border-[#e3ebf7] bg-white pl-11 text-sm text-[#0b1220] shadow-[0_1px_2px_rgba(15,23,42,0.05)] placeholder:text-[#64748b]"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          {selectedVisible.length > 0 ? (
            <button
              type="button"
              onClick={() => void removeGroups(selectedVisible)}
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
            style={{ backgroundColor: BRAND, color: "#ffffff" }}
          >
            <Plus className="size-5" strokeWidth={2.2} />
            {t("modifiers_page.add")}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Puzzle className="size-5" strokeWidth={1.9} />}
          iconClass="bg-[#eef4ff] text-[#1d5ff0]"
          value={stats.groups}
          label={t("modifiers_page.stat_groups")}
        />
        <StatCard
          icon={<ListChecks className="size-5" strokeWidth={1.9} />}
          iconClass="bg-[#eef4ff] text-[#1d5ff0]"
          value={stats.options}
          label={t("modifiers_page.stat_options")}
        />
        <StatCard
          icon={<SquareCheck className="size-5" strokeWidth={1.9} />}
          iconClass="bg-[#ecfdf5] text-[#059669]"
          value={stats.active}
          label={t("modifiers_page.stat_active")}
        />
        <StatCard
          icon={<EyeOff className="size-5" strokeWidth={1.9} />}
          iconClass="bg-[#f1f5f9] text-[#64748b]"
          value={stats.inactive}
          label={t("modifiers_page.stat_inactive")}
        />
      </div>

      <div className="overflow-x-auto rounded-[22px] border border-[#e3ebf7] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-28px_rgba(37,99,235,0.35)]">
        <div className="min-w-[1080px]">
          <div className={cn(GRID, "bg-[#f7f9fd] px-5 py-2.5")}>
            <div className="flex justify-center">
              <Checkbox
                checked={allChecked}
                onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(visible.map((g) => g.id)))}
              />
            </div>
            <span />
            <span className={TH}>{t("modifiers_page.col_group")}</span>
            <span className={TH}>{t("modifiers_page.col_type")}</span>
            <span className={TH}>{t("modifiers_page.col_required")}</span>
            <span className={TH}>{t("modifiers_page.col_selection")}</span>
            <span className={cn(TH, "text-center")}>{t("modifiers_page.col_options")}</span>
            <span className={TH}>{t("modifiers_page.col_status")}</span>
            <span className={cn(TH, "text-center")}>{t("menu_page.col_actions")}</span>
          </div>

          {libraryQuery === undefined ? (
            <p className="px-5 py-10 text-center text-sm text-[#64748b]">{t("common.loading")}</p>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <Puzzle className="size-6 text-[#94a3b8]" />
              <p className="text-sm font-semibold text-[#0b1220]">
                {library.length === 0 ? t("modifiers_page.empty") : t("categories_page.empty_filtered")}
              </p>
              {library.length === 0 ? (
                <p className="max-w-md text-[13px] text-[#64748b]">{t("modifiers_page.empty_desc")}</p>
              ) : null}
            </div>
          ) : (
            visible.map((group) => {
              const Icon = variantGroupIcon(group.name);
              const checked = selected.has(group.id);
              const multi = group.selectionType === "multi";
              const limits = selectionLimits(group);
              const active = group.active !== false;
              return (
                <div
                  key={group.id}
                  onDragOver={(e) => {
                    if (dragRowId && dragRowId !== group.id) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragRowId) void moveRow(dragRowId, group.id);
                    setDragRowId(null);
                  }}
                  className={cn(
                    GRID,
                    "border-t border-[#eef2f8] px-5 py-3",
                    checked ? "bg-[#f1f6ff]" : "bg-white hover:bg-[#fafcff]",
                    dragRowId === group.id && "opacity-50",
                  )}
                >
                  <div className="flex justify-center">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        })
                      }
                    />
                  </div>
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragRowId(group.id);
                    }}
                    onDragEnd={() => setDragRowId(null)}
                    title={t("modifiers_page.drag")}
                    className="flex cursor-grab justify-center text-[#94a3b8]"
                  >
                    <GripVertical className="size-5" />
                  </span>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#dbe7ff] bg-[linear-gradient(145deg,#f5f9ff,#e4eeff)] text-[#2563eb]">
                      <Icon className="size-5" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold text-[#0b1220]">{group.name}</span>
                      {group.description ? (
                        <span className="block truncate text-[12px] text-[#64748b]">{group.description}</span>
                      ) : null}
                    </span>
                  </div>
                  <span
                    className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                    style={
                      multi
                        ? { backgroundColor: "#f3e8ff", color: "#7e22ce" }
                        : { backgroundColor: "#e8f0ff", color: "#1d4ed8" }
                    }
                  >
                    {multi ? <SquareCheck className="size-3.5" /> : <CircleDot className="size-3.5" />}
                    {multi ? t("modifiers_page.type_multi") : t("modifiers_page.type_single")}
                  </span>
                  <span
                    className={cn(
                      "text-[13px] font-semibold",
                      group.required ? "text-[#1d4ed8]" : "text-[#64748b]",
                    )}
                  >
                    {group.required ? t("modifiers_page.required") : t("modifiers_page.optional")}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums text-[#0b1220]">
                    {multi ? `${limits.min} - ${limits.max}` : "1"}
                  </span>
                  <div className="flex justify-center">
                    <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-[#eef2fb] px-3 py-1 text-[13px] font-bold tabular-nums text-[#0b1220]">
                      {group.options.length}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0b1220]">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: active ? "#22c55e" : "#94a3b8" }}
                    />
                    {active ? t("modifiers_page.status_active") : t("modifiers_page.status_inactive")}
                  </span>
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      title={t("btn.edit")}
                      aria-label={t("btn.edit")}
                      onClick={() => openEdit(group)}
                      className="flex size-9 items-center justify-center rounded-full bg-[#eef4ff] text-[#1d5ff0] transition hover:bg-[#dde8ff]"
                    >
                      <Pencil className="size-[16px]" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      title={t("btn.delete")}
                      aria-label={t("btn.delete")}
                      onClick={() => void removeGroups([group])}
                      className="flex size-9 items-center justify-center rounded-full bg-[#fff1f2] text-red-500 transition hover:bg-red-100"
                    >
                      <Trash2 className="size-[16px]" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Sheet open={editing !== null} onOpenChange={(open) => (!open && !saving ? setEditing(null) : undefined)}>
        <SheetContent
          side="right"
          className={cn(
            "flex h-dvh max-h-dvh w-full flex-col gap-0 overflow-hidden border-l border-[#e3ebf7] bg-white p-0 shadow-[0_24px_64px_-28px_rgba(15,23,42,0.45)]",
            "sm:w-1/2 sm:max-w-[50vw]",
          )}
        >
          <SheetHeader className="shrink-0 border-b border-[#e3ebf7] bg-white px-6 py-5 pr-14 text-left">
            <SheetTitle className="text-[20px] font-bold tracking-tight text-[#0b1220]">
              {editing?.group ? t("modifiers_page.edit_title") : t("modifiers_page.add_title")}
            </SheetTitle>
            <SheetDescription className="text-[13px] text-[#64748b]">
              {editing?.group ? t("modifiers_page.dialog_desc_edit") : t("modifiers_page.dialog_desc")}
            </SheetDescription>
          </SheetHeader>

          {draft ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f7f9fd] px-5 py-5">
              <FormSection icon={<Info className="size-[18px]" strokeWidth={2} />} title={t("modifiers_page.section_general")}>
                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-[13px] font-semibold text-[#0b1220]">
                      {t("modifiers_page.field_name")} <span className="text-red-500">*</span>
                    </span>
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder={t("modifiers_page.field_name_ph")}
                      className={cn(
                        "h-11 rounded-xl bg-white text-[#0b1220]",
                        nameInvalid ? "border-red-400 focus-visible:ring-red-200" : "border-[#e3ebf7]",
                      )}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[13px] font-semibold text-[#0b1220]">
                      {t("modifiers_page.field_description")}{" "}
                      <span className="font-medium text-[#2563eb]">({t("modifiers_page.optional_label")})</span>
                    </span>
                    <Input
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      placeholder={t("modifiers_page.field_description_ph")}
                      className="h-11 rounded-xl border-[#e3ebf7] bg-white text-[#0b1220]"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e3ebf7] bg-white px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0b1220]">{t("modifiers_page.col_status")}</p>
                      <p className="text-[12px] text-[#64748b]">
                        {draft.active ? t("modifiers_page.status_active") : t("modifiers_page.status_inactive")}
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={draft.active}
                      label={t("modifiers_page.col_status")}
                      onChange={() => setDraft({ ...draft, active: !draft.active })}
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection icon={<Settings2 className="size-[18px]" strokeWidth={2} />} title={t("modifiers_page.section_selection")}>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-semibold text-[#0b1220]">{t("modifiers_page.field_selection_type")}</span>
                    <Segmented
                      value={draft.selectionType}
                      onChange={(v) => switchType(v as "single" | "multi")}
                      options={[
                        { value: "single", label: t("modifiers_page.type_single") },
                        { value: "multi", label: t("modifiers_page.type_multi") },
                      ]}
                    />
                    <p className="text-[12px] text-[#64748b]">
                      {draft.selectionType === "multi"
                        ? t("modifiers_page.type_multi_help")
                        : t("modifiers_page.type_single_help")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-semibold text-[#0b1220]">{t("modifiers_page.field_requirement")}</span>
                    <Segmented
                      value={draft.required ? "required" : "optional"}
                      onChange={(v) =>
                        setDraft({
                          ...draft,
                          required: v === "required",
                          ...(draft.selectionType === "multi" && v === "required" && Number(draft.minSelect) < 1
                            ? { minSelect: "1" }
                            : {}),
                        })
                      }
                      options={[
                        { value: "required", label: t("modifiers_page.required") },
                        { value: "optional", label: t("modifiers_page.optional") },
                      ]}
                    />
                    <p className="text-[12px] text-[#64748b]">
                      {draft.required ? t("modifiers_page.required_help") : t("modifiers_page.optional_help")}
                    </p>
                  </div>

                  {draft.selectionType === "single" ? (
                    <div className="space-y-1.5">
                      <span className="text-[13px] font-semibold text-[#0b1220]">{t("modifiers_page.field_default")}</span>
                      <select
                        value={draft.defaultOptionId}
                        onChange={(e) => setDraft({ ...draft, defaultOptionId: e.target.value })}
                        className="h-11 w-full rounded-xl border border-[#e3ebf7] bg-white px-3 text-[14px] font-medium text-[#0b1220]"
                      >
                        <option value="">{t("modifiers_page.default_none")}</option>
                        {namedOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[12px] text-[#64748b]">{t("modifiers_page.default_help")}</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <span className="text-[13px] font-semibold text-[#0b1220]">{t("modifiers_page.field_min")}</span>
                        <NumberStepper
                          value={draft.minSelect}
                          invalid={minInvalid}
                          canDecrease={Number.isFinite(minN) && minN > (draft.required ? 1 : 0)}
                          canIncrease={Number.isFinite(minN) && Number.isFinite(maxN) && minN < maxN}
                          decreaseLabel={t("modifiers_page.decrease")}
                          increaseLabel={t("modifiers_page.increase")}
                          onStep={(d) =>
                            setDraft(
                              {
                                ...draft,
                                minSelect: String(Math.max(draft.required ? 1 : 0, minN + d)),
                              },
                              true,
                            )
                          }
                          onType={(v) => setDraft({ ...draft, minSelect: v }, true)}
                          onBlur={() => setDraft(fitSelectionLimits(draft), true)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[13px] font-semibold text-[#0b1220]">{t("modifiers_page.field_max")}</span>
                        <NumberStepper
                          value={draft.maxSelect}
                          invalid={maxInvalid}
                          canDecrease={Number.isFinite(maxN) && maxN > Math.max(1, Number.isFinite(minN) ? minN : 1)}
                          canIncrease={Number.isFinite(maxN) && maxN < optionCount}
                          decreaseLabel={t("modifiers_page.decrease")}
                          increaseLabel={t("modifiers_page.increase")}
                          onStep={(d) =>
                            setDraft({ ...draft, maxSelect: String(Math.max(1, maxN + d)), maxCustom: true }, true)
                          }
                          onType={(v) => setDraft({ ...draft, maxSelect: v, maxCustom: true }, true)}
                          onBlur={() => setDraft(fitSelectionLimits(draft), true)}
                        />
                        <p className="text-[12px] text-[#64748b]">
                          {draft.maxCustom
                            ? t("modifiers_page.limits_help_custom", { count: optionCount })
                            : t("modifiers_page.limits_help", { count: optionCount })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </FormSection>

              <FormSection
                icon={<ListChecks className="size-[18px]" strokeWidth={2} />}
                title={t("modifiers_page.section_options")}
                subtitle={t("modifiers_page.section_options_desc")}
                action={
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        priceMode: "add",
                        options: [...draft.options, { id: newCustomizationOptionId(), name: "", priceDelta: "0" }],
                      })
                    }
                    className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-[13px] font-semibold"
                    style={{ backgroundColor: BRAND, color: "#ffffff" }}
                  >
                    <Plus className="size-4" strokeWidth={2.2} />
                    {t("modifiers_page.add_option")}
                  </button>
                }
              >
                <div className="space-y-2">
                  <div className="grid grid-cols-[28px_minmax(0,1fr)_132px_36px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                    <span />
                    <span>{t("modifiers_page.col_option_name")}</span>
                    <span>{t("modifiers_page.price_delta")}</span>
                    <span />
                  </div>
                  {draft.options.map((o, idx) => {
                    const dup =
                      Boolean(editing?.showLimitErrors) &&
                      o.name.trim() !== "" &&
                      draft.options.some(
                        (other, j) =>
                          j !== idx && other.name.trim().toLowerCase() === o.name.trim().toLowerCase(),
                      );
                    const priceBad =
                      Boolean(editing?.showLimitErrors) &&
                      o.name.trim() !== "" &&
                      !Number.isFinite(Number(String(o.priceDelta).trim().replace(",", ".")));
                    return (
                      <div
                        key={o.id}
                        onDragOver={(e) => {
                          if (dragOption && dragOption !== o.id) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!dragOption) return;
                          setDraft({
                            ...draft,
                            options: (() => {
                              const list = [...draft.options];
                              const from = list.findIndex((x) => x.id === dragOption);
                              const to = list.findIndex((x) => x.id === o.id);
                              if (from < 0 || to < 0) return draft.options;
                              const [moved] = list.splice(from, 1);
                              list.splice(to, 0, moved);
                              return list;
                            })(),
                          });
                          setDragOption(null);
                        }}
                        className={cn(
                          "grid grid-cols-[28px_minmax(0,1fr)_132px_36px] items-center gap-2 rounded-xl border bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                          dup || priceBad ? "border-red-300" : "border-[#e3ebf7]",
                          dragOption === o.id && "opacity-50",
                        )}
                      >
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            setDragOption(o.id);
                          }}
                          onDragEnd={() => setDragOption(null)}
                          title={t("modifiers_page.drag")}
                          className="flex cursor-grab justify-center text-[#94a3b8]"
                        >
                          <GripVertical className="size-4" />
                        </span>
                        <Input
                          value={o.name}
                          onChange={(e) => {
                            const options = [...draft.options];
                            options[idx] = { ...o, name: e.target.value };
                            setDraft({ ...draft, options });
                          }}
                          placeholder={t("modifiers_page.option_ph")}
                          className="h-10 border-0 bg-transparent px-1 text-[14px] shadow-none focus-visible:ring-0"
                        />
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[#64748b]">
                            {currency.symbol}
                          </span>
                          <Input
                            value={o.priceDelta}
                            inputMode="decimal"
                            onChange={(e) => {
                              const options = [...draft.options];
                              options[idx] = { ...o, priceDelta: sanitizePriceDelta(e.target.value) };
                              setDraft({ ...draft, priceMode: "add", options });
                            }}
                            className={cn(
                              "h-10 border bg-[#f7f9fd] pl-7 text-[13px] tabular-nums",
                              priceBad ? "border-red-400" : "border-[#e3ebf7]",
                            )}
                            aria-label={t("modifiers_page.price_delta")}
                          />
                        </div>
                        <button
                          type="button"
                          aria-label={t("btn.delete")}
                          disabled={draft.options.length <= 1}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              options:
                                draft.options.length <= 1
                                  ? draft.options
                                  : draft.options.filter((x) => x.id !== o.id),
                              defaultOptionId: draft.defaultOptionId === o.id ? "" : draft.defaultOptionId,
                            })
                          }
                          className="flex size-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </FormSection>

              <p className="px-1 text-[12px] text-[#64748b]">{t("modifiers_page.assign_note")}</p>
            </div>
          ) : null}

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#e3ebf7] bg-white px-6 py-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(null)}
              className="h-11 rounded-xl border border-[#e3ebf7] bg-white px-4 text-sm font-semibold text-[#334155]"
            >
              {t("btn.cancel")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraft()}
              className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-[0_10px_22px_-12px_rgba(37,99,235,0.9)] disabled:opacity-60"
              style={{ backgroundColor: BRAND, color: "#ffffff" }}
            >
              {saving
                ? t("common.loading")
                : editing?.group
                  ? t("modifiers_page.save_changes")
                  : t("modifiers_page.create_group")}
              {!saving ? <Check className="size-4" strokeWidth={2.4} /> : null}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({
  icon,
  iconClass,
  value,
  label,
}: {
  icon: ReactNode;
  iconClass: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-[#e3ebf7] bg-white/90 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", iconClass)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[22px] font-bold tabular-nums leading-none text-[#0b1220]">{value}</p>
        <p className="mt-1 truncate text-[12px] font-medium text-[#64748b]">{label}</p>
      </div>
    </div>
  );
}
