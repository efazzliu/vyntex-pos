import { supabase } from "@/lib/supabase.ts";
import { isMissingPgColumnError } from "./db-errors.ts";
import { clearRestaurantCache, getRestaurantByLicense } from "./restaurant.ts";

/**
 * Extra data stored inside `restaurants.pos_general_prefs` next to the General settings
 * (no schema change). `updateGeneralPrefs` keeps these keys because the General form only
 * knows its own fields.
 */
export const FLOOR_ROOMS_PREF_KEY = "floorRooms";
export const VARIANT_GROUPS_PREF_KEY = "variantGroups";
export const MODIFIER_GROUPS_PREF_KEY = "modifierGroups";
export const PRESERVED_PREF_KEYS = [
  FLOOR_ROOMS_PREF_KEY,
  VARIANT_GROUPS_PREF_KEY,
  MODIFIER_GROUPS_PREF_KEY,
] as const;

/** Thrown when the database has no `pos_general_prefs` column (migration 044 not applied). */
export const GENERAL_PREFS_NEED_COLUMN = "FLOOR_ROOMS_NEED_COLUMN";

function rethrowMissingColumn(error: { message?: string }): never {
  if (isMissingPgColumnError(String(error.message ?? ""), "pos_general_prefs")) {
    throw new Error(GENERAL_PREFS_NEED_COLUMN);
  }
  throw error;
}

/** Fresh read (not the cached restaurant row) so two devices do not overwrite each other. */
export async function readGeneralPrefs(restaurantId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("pos_general_prefs")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error) rethrowMissingColumn(error);
  const prefs = (data as { pos_general_prefs?: unknown } | null)?.pos_general_prefs;
  return prefs && typeof prefs === "object" && !Array.isArray(prefs)
    ? (prefs as Record<string, unknown>)
    : {};
}

export async function readGeneralPrefsKey(licenseKey: string, key: string): Promise<unknown> {
  const r = await getRestaurantByLicense(licenseKey);
  return (await readGeneralPrefs(r.id))[key];
}

/** Read-modify-write of one key; the rest of the prefs object is kept as it is. */
export async function patchGeneralPrefsKey(
  licenseKey: string,
  key: string,
  mutate: (current: unknown) => unknown,
) {
  const r = await getRestaurantByLicense(licenseKey);
  const prefs = await readGeneralPrefs(r.id);
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_general_prefs: { ...prefs, [key]: mutate(prefs[key]) } })
    .eq("id", r.id);
  if (error) rethrowMissingColumn(error);
  clearRestaurantCache(licenseKey);
}
