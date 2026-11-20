import {
  customizationConfigForDb,
  normalizeCustomizationConfig,
  type MenuCustomizationGroup,
} from "@/lib/menu-customizations.ts";
import {
  VARIANT_GROUPS_PREF_KEY,
  patchGeneralPrefsKey,
  readGeneralPrefsKey,
} from "./general-prefs-store.ts";

/**
 * Variant groups created in Settings → Variants, before they are assigned to any product.
 * Products get a copy (same group id) in `menu_items.customization_config` from Edit Product.
 */
export async function getVariantLibrary(licenseKey: string): Promise<MenuCustomizationGroup[]> {
  try {
    return normalizeCustomizationConfig(await readGeneralPrefsKey(licenseKey, VARIANT_GROUPS_PREF_KEY));
  } catch {
    return [];
  }
}

/** Insert or replace a group (matched by id). */
export async function saveVariantGroup(args: { licenseKey: string; group: unknown }) {
  const [group] = customizationConfigForDb([args.group as MenuCustomizationGroup]) ?? [];
  if (!group) throw new Error("Invalid variant group");
  await patchGeneralPrefsKey(args.licenseKey, VARIANT_GROUPS_PREF_KEY, (current) => {
    const list = normalizeCustomizationConfig(current);
    const at = list.findIndex((g) => g.id === group.id);
    if (at >= 0) list[at] = group;
    else list.push(group);
    return list;
  });
}

export async function deleteVariantGroup(args: { licenseKey: string; groupId: string }) {
  await patchGeneralPrefsKey(args.licenseKey, VARIANT_GROUPS_PREF_KEY, (current) =>
    normalizeCustomizationConfig(current).filter((g) => g.id !== args.groupId),
  );
}
