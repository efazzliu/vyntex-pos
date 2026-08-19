export type MenuCustomizationOption = {
  id: string;
  name: string;
  priceDelta?: number;
  isDefault?: boolean;
};

export type MenuCustomizationGroup = {
  id: string;
  name: string;
  required?: boolean;
  /** single = one choice; multi = pick many */
  selectionType?: "single" | "multi";
  options: MenuCustomizationOption[];
};

export type SelectedCustomization = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
};

export function newCustomizationGroupId(): string {
  return crypto.randomUUID();
}

export function newCustomizationOptionId(): string {
  return crypto.randomUUID();
}

export function normalizeCustomizationConfig(raw: unknown): MenuCustomizationGroup[] {
  if (!Array.isArray(raw)) return [];
  const groups: MenuCustomizationGroup[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const name = String(rec.name ?? "").trim();
    if (!name) continue;
    const groupId = String(rec.id ?? newCustomizationGroupId()).trim() || newCustomizationGroupId();
    const optionsRaw = Array.isArray(rec.options) ? rec.options : [];
    const options: MenuCustomizationOption[] = [];
    for (const optRow of optionsRaw) {
      if (!optRow || typeof optRow !== "object") continue;
      const opt = optRow as Record<string, unknown>;
      const optionName = String(opt.name ?? "").trim();
      if (!optionName) continue;
      const optionId =
        String(opt.id ?? newCustomizationOptionId()).trim() || newCustomizationOptionId();
      const priceDelta = Number(opt.priceDelta ?? opt.price_delta ?? 0);
      options.push({
        id: optionId,
        name: optionName,
        priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0,
        isDefault: Boolean(opt.isDefault ?? opt.is_default),
      });
    }
    if (options.length === 0) continue;
    groups.push({
      id: groupId,
      name,
      required: Boolean(rec.required),
      selectionType: rec.selectionType === "multi" || rec.selection_type === "multi" ? "multi" : "single",
      options,
    });
  }
  return groups;
}

export function normalizeSelectedCustomizations(raw: unknown): SelectedCustomization[] {
  if (!Array.isArray(raw)) return [];
  const out: SelectedCustomization[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const groupId = String(rec.groupId ?? rec.group_id ?? "").trim();
    const groupName = String(rec.groupName ?? rec.group_name ?? "").trim();
    const optionId = String(rec.optionId ?? rec.option_id ?? "").trim();
    const optionName = String(rec.optionName ?? rec.option_name ?? "").trim();
    if (!groupId || !optionId || !optionName) continue;
    const priceDelta = Number(rec.priceDelta ?? rec.price_delta ?? 0);
    out.push({
      groupId,
      groupName: groupName || groupId,
      optionId,
      optionName,
      priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0,
    });
  }
  return out;
}

export function customizationConfigForDb(
  groups: MenuCustomizationGroup[] | undefined,
): MenuCustomizationGroup[] | undefined {
  if (groups === undefined) return undefined;
  return normalizeCustomizationConfig(groups);
}

export function getMenuItemCustomizationGroups(
  item: { customizationConfig?: unknown } | null | undefined,
): MenuCustomizationGroup[] {
  return normalizeCustomizationConfig(item?.customizationConfig);
}

export function hasMenuItemCustomizations(
  item: { customizationConfig?: unknown } | null | undefined,
): boolean {
  return getMenuItemCustomizationGroups(item).length > 0;
}

export function customizationSelectionKey(
  selections: SelectedCustomization[] | undefined,
): string {
  if (!selections?.length) return "";
  return [...selections]
    .sort((a, b) =>
      `${a.groupId}:${a.optionId}`.localeCompare(`${b.groupId}:${b.optionId}`),
    )
    .map((s) => `${s.groupId}:${s.optionId}`)
    .join("|");
}

export function cartLineKey(args: {
  menuItemId: string;
  selectedCustomizations?: SelectedCustomization[];
  notes?: string;
}): string {
  return `${args.menuItemId}|${customizationSelectionKey(args.selectedCustomizations)}|${(args.notes ?? "").trim()}`;
}

export function customizationPriceDelta(
  selections: SelectedCustomization[] | undefined,
): number {
  if (!selections?.length) return 0;
  return selections.reduce((sum, s) => sum + (s.priceDelta ?? 0), 0);
}

export function resolvedMenuItemUnitPrice(
  basePrice: number,
  selections: SelectedCustomization[] | undefined,
): number {
  return Math.round((basePrice + customizationPriceDelta(selections)) * 100) / 100;
}

export function defaultSelectionsForGroups(
  groups: MenuCustomizationGroup[],
): SelectedCustomization[] {
  const out: SelectedCustomization[] = [];
  for (const group of groups) {
    const defaults = group.options.filter((o) => o.isDefault);
    const picks = defaults.length > 0 ? defaults : group.required ? [group.options[0]] : [];
    for (const opt of picks) {
      out.push({
        groupId: group.id,
        groupName: group.name,
        optionId: opt.id,
        optionName: opt.name,
        priceDelta: opt.priceDelta ?? 0,
      });
    }
  }
  return out;
}

export function validateCustomizationSelections(
  groups: MenuCustomizationGroup[],
  selections: SelectedCustomization[],
): string | null {
  for (const group of groups) {
    const picked = selections.filter((s) => s.groupId === group.id);
    if (group.required && picked.length === 0) {
      return group.name;
    }
    if (group.selectionType !== "multi" && picked.length > 1) {
      return group.name;
    }
  }
  return null;
}

export function toggleCustomizationSelection(
  groups: MenuCustomizationGroup[],
  current: SelectedCustomization[],
  group: MenuCustomizationGroup,
  option: MenuCustomizationOption,
): SelectedCustomization[] {
  const withoutGroup = current.filter((s) => s.groupId !== group.id);
  const existing = current.find(
    (s) => s.groupId === group.id && s.optionId === option.id,
  );
  if (group.selectionType === "multi") {
    if (existing) {
      return current.filter(
        (s) => !(s.groupId === group.id && s.optionId === option.id),
      );
    }
    return [
      ...current,
      {
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta ?? 0,
      },
    ];
  }
  if (existing) return withoutGroup;
  return [
    ...withoutGroup,
    {
      groupId: group.id,
      groupName: group.name,
      optionId: option.id,
      optionName: option.name,
      priceDelta: option.priceDelta ?? 0,
    },
  ];
}

export function formatCustomizationsForDisplay(
  selections: SelectedCustomization[] | undefined,
): string {
  if (!selections?.length) return "";
  const byGroup = new Map<string, string[]>();
  for (const s of selections) {
    const key = s.groupName || s.groupId;
    const list = byGroup.get(key) ?? [];
    list.push(s.optionName);
    byGroup.set(key, list);
  }
  return [...byGroup.entries()]
    .map(([group, opts]) => `${group}: ${opts.join(", ")}`)
    .join(" · ");
}

export function mergeNotesWithCustomizations(
  selections: SelectedCustomization[] | undefined,
  notes?: string,
): string | undefined {
  const parts: string[] = [];
  const custom = formatCustomizationsForDisplay(selections);
  if (custom) parts.push(custom);
  const note = notes?.trim();
  if (note) parts.push(note);
  return parts.length ? parts.join(" | ") : undefined;
}
