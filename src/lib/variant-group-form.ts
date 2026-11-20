import {
  newCustomizationGroupId,
  newCustomizationOptionId,
  type MenuCustomizationGroup,
} from "./menu-customizations.ts";

export type VariantDraftOption = { id: string; name: string; priceDelta: string };

/** Form state of the Add / Edit Variant Group drawer (strings for the number inputs). */
export type VariantDraft = {
  name: string;
  description: string;
  active: boolean;
  selectionType: "single" | "multi";
  required: boolean;
  /** Single choice only. */
  defaultOptionId: string;
  /** Multiple choice only. */
  minSelect: string;
  maxSelect: string;
  /**
   * `false`: the maximum is automatic and always equals the number of option rows, so adding
   * or removing an option updates it. `true`: the owner set it; it is kept when options are
   * added and only lowered when it would exceed the option count.
   */
  maxCustom: boolean;
  priceMode: "add" | "none";
  options: VariantDraftOption[];
};

export type VariantDraftError = { key: string; params?: Record<string, unknown> };

export function emptyVariantDraft(): VariantDraft {
  const options = [
    { id: newCustomizationOptionId(), name: "", priceDelta: "0" },
    { id: newCustomizationOptionId(), name: "", priceDelta: "0" },
  ];
  return {
    name: "",
    description: "",
    active: true,
    selectionType: "single",
    required: false,
    defaultOptionId: "",
    minSelect: "0",
    maxSelect: autoMax(options.length),
    maxCustom: false,
    priceMode: "add",
    options,
  };
}

export function groupToDraft(group: MenuCustomizationGroup): VariantDraft {
  const multi = group.selectionType === "multi";
  const count = group.options.length;
  const savedMax = multi ? group.maxSelect : undefined;
  return {
    name: group.name,
    description: group.description ?? "",
    active: group.active !== false,
    selectionType: multi ? "multi" : "single",
    required: Boolean(group.required),
    defaultOptionId: multi ? "" : (group.options.find((o) => o.isDefault)?.id ?? ""),
    minSelect: String(multi ? (group.minSelect ?? (group.required ? 1 : 0)) : 0),
    maxSelect: String(savedMax !== undefined ? Math.min(savedMax, count) : count),
    // A saved maximum below the option count was chosen by the owner; equal means "all".
    maxCustom: savedMax !== undefined && savedMax < count,
    priceMode: group.options.some((o) => (o.priceDelta ?? 0) !== 0) ? "add" : "none",
    options: group.options.map((o) => ({ id: o.id, name: o.name, priceDelta: String(o.priceDelta ?? 0) })),
  };
}

const parsePrice = (s: string) => Number(s.trim().replace(",", "."));
const parseCount = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

/** Options with a name, in drawer order. */
export function filledOptions(draft: VariantDraft) {
  return draft.options.filter((o) => o.name.trim());
}

/** Maximum that will be saved: the option count while automatic, else the owner's number. */
function resolvedMax(draft: VariantDraft, namedOptions: number) {
  return draft.maxCustom ? parseCount(draft.maxSelect) : namedOptions;
}

/** Automatic maximum for this many option rows; unset ("") while there are none. */
const autoMax = (rows: number) => (rows > 0 ? String(rows) : "");

/** Switching to Multiple Choice starts with an automatic maximum (= the number of options). */
export function toMultipleChoice(draft: VariantDraft): VariantDraft {
  return fitSelectionLimits({
    ...draft,
    selectionType: "multi",
    minSelect: draft.required ? "1" : "0",
    maxSelect: autoMax(draft.options.length),
    maxCustom: false,
    defaultOptionId: "",
  });
}

/**
 * Keeps multiple-choice limits consistent after any edit, against the option rows shown:
 * - automatic maximum follows the row count;
 * - a custom maximum is kept, but lowered when it exceeds the row count;
 * - the minimum is lowered when it exceeds the maximum (so max is never below min).
 * Empty / half-typed fields are left alone so the owner can keep typing.
 */
export function fitSelectionLimits(draft: VariantDraft): VariantDraft {
  if (draft.selectionType !== "multi") return draft;
  const rows = draft.options.length;
  let { minSelect, maxSelect, maxCustom } = draft;
  if (rows === 0) {
    // No options: nothing to limit yet; the first option starts an automatic maximum of 1.
    maxSelect = "";
    maxCustom = false;
  } else if (!maxCustom) {
    maxSelect = autoMax(rows);
  } else {
    const typed = parseCount(maxSelect);
    if (Number.isFinite(typed) && typed > rows) maxSelect = String(rows);
  }
  const max = parseCount(maxSelect);
  const min = parseCount(minSelect);
  if (Number.isFinite(min) && Number.isFinite(max) && max >= 1 && min > max) minSelect = String(max);
  return minSelect === draft.minSelect && maxSelect === draft.maxSelect && maxCustom === draft.maxCustom
    ? draft
    : { ...draft, minSelect, maxSelect, maxCustom };
}

/**
 * First problem with the draft, or null. `otherNames`: names of the other variant groups
 * (a group name must be unique, case-insensitive).
 */
export function validateVariantDraft(draft: VariantDraft, otherNames: string[]): VariantDraftError | null {
  const name = draft.name.trim();
  if (!name) return { key: "variants_page.name_required" };
  if (otherNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) {
    return { key: "variants_page.name_exists" };
  }
  const options = filledOptions(draft);
  if (options.length === 0) return { key: "variants_page.options_required" };
  const seen = new Set<string>();
  for (const o of options) {
    const k = o.name.trim().toLowerCase();
    if (seen.has(k)) return { key: "variants_page.option_duplicate", params: { name: o.name.trim() } };
    seen.add(k);
  }
  if (draft.priceMode === "add" && options.some((o) => !Number.isFinite(parsePrice(o.priceDelta || "0")))) {
    return { key: "variants_page.price_invalid" };
  }
  if (draft.selectionType === "multi") {
    const min = parseCount(draft.minSelect);
    const max = resolvedMax(draft, options.length);
    if (!Number.isFinite(min)) return { key: "variants_page.min_invalid" };
    if (!Number.isFinite(max) || max < 1) return { key: "variants_page.max_invalid" };
    if (max > options.length) return { key: "variants_page.max_over_options", params: { count: options.length } };
    if (min > max) return { key: "variants_page.min_over_max" };
    if (draft.required && min < 1) return { key: "variants_page.min_required" };
  }
  return null;
}

/** Saved group from a valid draft (call `validateVariantDraft` first). Empty option rows are dropped. */
export function draftToGroup(draft: VariantDraft, id: string = newCustomizationGroupId()): MenuCustomizationGroup {
  const multi = draft.selectionType === "multi";
  const options = filledOptions(draft).map((o) => ({
    id: o.id,
    name: o.name.trim(),
    priceDelta: draft.priceMode === "none" ? 0 : Math.round(parsePrice(o.priceDelta || "0") * 100) / 100,
    ...(!multi && o.id === draft.defaultOptionId ? { isDefault: true } : {}),
  }));
  return {
    id,
    name: draft.name.trim(),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.active ? {} : { active: false }),
    required: draft.required,
    selectionType: multi ? "multi" : "single",
    ...(multi ? { minSelect: parseCount(draft.minSelect), maxSelect: resolvedMax(draft, options.length) } : {}),
    options,
  };
}
