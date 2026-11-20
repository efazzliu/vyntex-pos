import {
  customizationConfigForDb,
  normalizeCustomizationConfig,
  type MenuCustomizationGroup,
} from "@/lib/menu-customizations.ts";
import {
  MODIFIER_GROUPS_PREF_KEY,
  patchGeneralPrefsKey,
  readGeneralPrefsKey,
} from "./general-prefs-store.ts";

/**
 * Modifier groups created in Settings → Modifiers.
 * Products store assigned group IDs in `menu_items.modifier_group_ids` (Edit Product → Allow Modifiers).
 */
export async function getModifierLibrary(licenseKey: string): Promise<MenuCustomizationGroup[]> {
  try {
    return normalizeCustomizationConfig(await readGeneralPrefsKey(licenseKey, MODIFIER_GROUPS_PREF_KEY));
  } catch {
    return [];
  }
}

/** Insert or replace a group (matched by id). */
export async function saveModifierGroup(args: { licenseKey: string; group: unknown }) {
  const [group] = customizationConfigForDb([args.group as MenuCustomizationGroup]) ?? [];
  if (!group) throw new Error("Invalid modifier group");
  await patchGeneralPrefsKey(args.licenseKey, MODIFIER_GROUPS_PREF_KEY, (current) => {
    const list = normalizeCustomizationConfig(current);
    const at = list.findIndex((g) => g.id === group.id);
    if (at >= 0) list[at] = group;
    else list.push(group);
    return list;
  });
}

export async function deleteModifierGroup(args: { licenseKey: string; groupId: string }) {
  await patchGeneralPrefsKey(args.licenseKey, MODIFIER_GROUPS_PREF_KEY, (current) =>
    normalizeCustomizationConfig(current).filter((g) => g.id !== args.groupId),
  );
}

/** Persist library order after drag-and-drop in Settings → Modifiers. */
export async function reorderModifierGroups(args: { licenseKey: string; groupIds: string[] }) {
  await patchGeneralPrefsKey(args.licenseKey, MODIFIER_GROUPS_PREF_KEY, (current) => {
    const list = normalizeCustomizationConfig(current);
    const byId = new Map(list.map((g) => [g.id, g]));
    const ordered: MenuCustomizationGroup[] = [];
    for (const id of args.groupIds) {
      const g = byId.get(id);
      if (g) {
        ordered.push(g);
        byId.delete(id);
      }
    }
    for (const g of byId.values()) ordered.push(g);
    return ordered;
  });
}
