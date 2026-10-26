export type PrepOption = {
  id: string;
  name: string;
  /** Optional amount added to the unit price when this extra is selected. */
  priceDelta?: number;
};

export type PrepChoiceGroup = {
  id: string;
  name: string;
  options: PrepOption[];
};

export type PrepConfig = {
  choiceGroups: PrepChoiceGroup[];
  /** Free removals/modifications, e.g. no mushrooms. */
  toggles: PrepOption[];
  toggleGroupName?: string;
  /** Additions that increase the product unit price. */
  paidExtras: PrepOption[];
  quickNotes: PrepOption[];
  /** Whether the waiter may write one-off preparation instructions. */
  allowWaiterCustomInstructions: boolean;
};

export type PrepSelections = {
  choices: Record<string, string>;
  toggles: string[];
  quickNotes: string[];
  /** One-off, free instructions created by the waiter for this order line. */
  customOptions: string[];
  freeText: string;
};

export function newPrepId(): string {
  return crypto.randomUUID();
}

export function emptyPrepConfig(): PrepConfig {
  return {
    choiceGroups: [],
    toggles: [],
    paidExtras: [],
    quickNotes: [],
    allowWaiterCustomInstructions: true,
  };
}

export function emptyPrepSelections(): PrepSelections {
  return {
    choices: {},
    toggles: [],
    quickNotes: [],
    customOptions: [],
    freeText: "",
  };
}

function normalizeOptions(raw: unknown): PrepOption[] {
  if (!Array.isArray(raw)) return [];
  const out: PrepOption[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const name = String(rec.name ?? "").trim();
    if (!name) continue;
    const id = String(rec.id ?? newPrepId()).trim() || newPrepId();
    const priceDelta = Number(rec.priceDelta ?? rec.price_delta ?? 0);
    out.push({
      id,
      name,
      priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0,
    });
  }
  return out;
}

export function normalizePrepConfig(raw: unknown): PrepConfig {
  if (!raw || typeof raw !== "object") return emptyPrepConfig();
  const rec = raw as Record<string, unknown>;
  const groupsRaw = Array.isArray(rec.choiceGroups)
    ? rec.choiceGroups
    : Array.isArray(rec.choice_groups)
      ? rec.choice_groups
      : [];
  const choiceGroups: PrepChoiceGroup[] = [];
  for (const row of groupsRaw) {
    if (!row || typeof row !== "object") continue;
    const g = row as Record<string, unknown>;
    const name = String(g.name ?? "").trim();
    const options = normalizeOptions(g.options);
    if (!name || options.length === 0) continue;
    choiceGroups.push({
      id: String(g.id ?? newPrepId()).trim() || newPrepId(),
      name,
      options,
    });
  }
  const legacyToggles = normalizeOptions(rec.toggles);
  const explicitPaidExtras = normalizeOptions(
    rec.paidExtras ?? rec.paid_extras,
  ).filter((option) => (option.priceDelta ?? 0) > 0);
  const toggles = legacyToggles.map((option) => ({
    ...option,
    priceDelta: 0,
  }));
  const paidExtras = [...explicitPaidExtras];
  for (const option of legacyToggles) {
    if (
      (option.priceDelta ?? 0) > 0 &&
      !paidExtras.some((extra) => extra.id === option.id)
    ) {
      paidExtras.push(option);
    }
  }
  const freeToggles = toggles.filter(
    (option) => !paidExtras.some((extra) => extra.id === option.id),
  );
  const quickNotes = normalizeOptions(
    rec.quickNotes ?? rec.quick_notes ?? rec.chips,
  );
  const toggleGroupName = String(
    rec.toggleGroupName ?? rec.toggle_group_name ?? "",
  ).trim();
  const allowWaiterCustomInstructions =
    (rec.allowWaiterCustomInstructions ??
      rec.allow_waiter_custom_instructions) !== false;
  return {
    choiceGroups,
    toggles: freeToggles,
    ...(toggleGroupName ? { toggleGroupName } : {}),
    paidExtras,
    quickNotes,
    allowWaiterCustomInstructions,
  };
}

export function prepConfigForDb(config: PrepConfig | undefined): PrepConfig | undefined {
  if (config === undefined) return undefined;
  return normalizePrepConfig(config);
}

export function hasPrepConfig(config: PrepConfig | null | undefined): boolean {
  if (!config) return false;
  return (
    config.choiceGroups.length > 0 ||
    config.toggles.length > 0 ||
    config.paidExtras.length > 0 ||
    config.quickNotes.length > 0 ||
    config.allowWaiterCustomInstructions === false
  );
}

export function resolveItemPrepConfig(
  item: { prepConfig?: unknown } | null | undefined,
  category: { prepConfig?: unknown } | null | undefined,
): PrepConfig {
  const fromItem = normalizePrepConfig(item?.prepConfig);
  if (hasPrepConfig(fromItem)) return fromItem;
  return normalizePrepConfig(category?.prepConfig);
}

function noteParts(text: string): string[] {
  return text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function formatPrepNotes(
  config: PrepConfig,
  selections: PrepSelections,
): string {
  const parts: string[] = [];
  for (const group of config.choiceGroups) {
    const optionId = selections.choices[group.id];
    const option = group.options.find((o) => o.id === optionId);
    if (option) parts.push(option.name);
  }
  for (const toggle of config.toggles) {
    if (selections.toggles.includes(toggle.id)) parts.push(toggle.name);
  }
  for (const extra of config.paidExtras) {
    if (selections.toggles.includes(extra.id)) parts.push(extra.name);
  }
  for (const chip of config.quickNotes) {
    if (selections.quickNotes.includes(chip.id)) parts.push(chip.name);
  }
  for (const custom of selections.customOptions ?? []) {
    const value = custom.trim();
    if (
      value &&
      !parts.some((part) => part.toLowerCase() === value.toLowerCase())
    ) {
      parts.push(value);
    }
  }
  const extra = selections.freeText.trim();
  if (extra) {
    for (const piece of noteParts(extra)) {
      if (!parts.some((p) => p.toLowerCase() === piece.toLowerCase())) {
        parts.push(piece);
      }
    }
  }
  return parts.join(", ");
}

export function prepExtrasPrice(
  config: PrepConfig,
  selections: PrepSelections | undefined,
): number {
  if (!selections) return 0;
  const fromPaid = config.paidExtras.reduce(
    (sum, option) =>
      selections.toggles.includes(option.id)
        ? sum + (option.priceDelta ?? 0)
        : sum,
    0,
  );
  const fromQuick = config.quickNotes.reduce(
    (sum, chip) =>
      selections.quickNotes.includes(chip.id)
        ? sum + (chip.priceDelta ?? 0)
        : sum,
    0,
  );
  return Math.round((fromPaid + fromQuick) * 100) / 100;
}

export function parsePrepSelections(
  config: PrepConfig,
  notes: string | undefined,
): PrepSelections {
  const next = emptyPrepSelections();
  const parts = noteParts(notes ?? "");
  if (parts.length === 0) return next;

  const leftover: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    let matched = false;
    for (const group of config.choiceGroups) {
      const option = group.options.find((o) => o.name.toLowerCase() === lower);
      if (option) {
        next.choices[group.id] = option.id;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const toggle = config.toggles.find((o) => o.name.toLowerCase() === lower);
    if (toggle) {
      next.toggles.push(toggle.id);
      continue;
    }
    const paidExtra = config.paidExtras.find(
      (o) => o.name.toLowerCase() === lower,
    );
    if (paidExtra) {
      next.toggles.push(paidExtra.id);
      continue;
    }
    const chip = config.quickNotes.find((o) => o.name.toLowerCase() === lower);
    if (chip) {
      next.quickNotes.push(chip.id);
      continue;
    }
    leftover.push(part);
  }
  next.freeText = leftover.join(", ");
  return next;
}

export function togglePrepChoice(
  current: PrepSelections,
  groupId: string,
  optionId: string,
): PrepSelections {
  const selected = current.choices[groupId] === optionId;
  const choices = { ...current.choices };
  if (selected) delete choices[groupId];
  else choices[groupId] = optionId;
  return { ...current, choices };
}

export function togglePrepId(
  ids: string[],
  optionId: string,
): string[] {
  return ids.includes(optionId)
    ? ids.filter((id) => id !== optionId)
    : [...ids, optionId];
}
