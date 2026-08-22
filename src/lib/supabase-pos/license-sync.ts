import {
  DEFAULT_PIN_LOGIN_BRANDING,
  normalizePhoneAccessBranding,
  normalizePinLoginBranding,
  saveDataCache,
  savePhoneAccessBranding,
  savePinLoginBranding,
  saveStaffCache,
  type LocalStaff,
  type PhoneAccessBranding,
  type PinLoginBranding,
} from "@/lib/local-db.ts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import { getRestaurantByLicense } from "@/lib/supabase-pos/restaurant.ts";
import { posTablesIndexedDbKey } from "@/lib/supabase-pos/cache-keys.ts";
import { runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import {
  fetchPhoneAccessBrandingFromCloud,
  fetchPinBrandingFromCloud,
  fetchPosThemeFromCloud,
  savePhoneAccessBrandingToCloud,
  savePinBrandingToCloud,
  savePosThemeToCloud,
} from "@/lib/supabase-pos/settings-ops.ts";
const POS_THEME_STORAGE_KEY = "vyntex-pos-theme";

type StaffRow = {
  _id: string;
  name: string;
  role: LocalStaff["role"];
  pinHash: string;
  isActive: boolean;
};

function staffRowsToLocal(rows: StaffRow[]): LocalStaff[] {
  return rows.map((s) => ({
    convexId: s._id,
    name: s.name,
    role: s.role,
    pinHash: s.pinHash,
    isActive: s.isActive,
  }));
}

/** True when at least one staff row exists in Supabase for this license. */
export async function cloudHasStaff(licenseKey: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const rows = (await runPosQuery("pos.staff.getStaff", {
      licenseKey,
    })) as StaffRow[] | undefined;
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

/** Cloud branding first, then IndexedDB mirror. */
export async function resolvePinLoginBranding(
  licenseKey: string,
): Promise<PinLoginBranding> {
  if (isSupabaseConfigured) {
    try {
      const fromCloud = await fetchPinBrandingFromCloud(licenseKey);
      if (fromCloud) {
        await savePinLoginBranding(licenseKey, fromCloud);
        return fromCloud;
      }
    } catch {
      /* fall through to local */
    }
  }
  const { getPinLoginBranding } = await import("@/lib/local-db.ts");
  return getPinLoginBranding(licenseKey);
}

export async function resolvePhoneAccessBranding(
  licenseKey: string,
): Promise<PhoneAccessBranding> {
  if (isSupabaseConfigured) {
    try {
      const fromCloud = await fetchPhoneAccessBrandingFromCloud(licenseKey);
      if (fromCloud) {
        await savePhoneAccessBranding(licenseKey, fromCloud);
        return fromCloud;
      }
    } catch {
      /* fall through to local */
    }
  }
  const { getPhoneAccessBranding } = await import("@/lib/local-db.ts");
  return getPhoneAccessBranding(licenseKey);
}

export async function persistPhoneAccessBranding(
  licenseKey: string,
  branding: PhoneAccessBranding,
): Promise<void> {
  const normalized = normalizePhoneAccessBranding(branding);
  await savePhoneAccessBranding(licenseKey, normalized);
  if (isSupabaseConfigured) {
    try {
      await savePhoneAccessBrandingToCloud(licenseKey, normalized);
    } catch (err) {
      console.warn("[license-sync] phone access branding cloud save failed", err);
    }
  }
}

/** Save to cloud (when configured) and local IndexedDB. */
export async function persistPinLoginBranding(
  licenseKey: string,
  branding: PinLoginBranding,
): Promise<void> {
  const normalized = normalizePinLoginBranding(branding);
  await savePinLoginBranding(licenseKey, normalized);
  if (isSupabaseConfigured) {
    try {
      await savePinBrandingToCloud(licenseKey, normalized);
    } catch (err) {
      console.warn("[license-sync] pin branding cloud save failed", err);
    }
  }
}

export function applyPosThemeFromCloud(theme: string | null | undefined): void {
  if (theme !== "light" && theme !== "dark") return;
  try {
    localStorage.setItem(POS_THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-pos-theme", theme);
  } catch {
    /* ignore */
  }
}

export async function persistPosTheme(
  licenseKey: string,
  theme: "light" | "dark",
): Promise<void> {
  try {
    localStorage.setItem(POS_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  if (!isSupabaseConfigured) return;
  try {
    await savePosThemeToCloud(licenseKey, theme);
  } catch (err) {
    console.warn("[license-sync] pos theme cloud save failed", err);
  }
}

/**
 * Pull license data from Supabase into IndexedDB so a new PC matches the old one after activation.
 */
export async function hydratePosLicenseData(licenseKey: string): Promise<void> {
  if (!isSupabaseConfigured || !licenseKey.trim()) return;

  const tasks: Promise<void>[] = [];

  tasks.push(
    (async () => {
      const rows = (await runPosQuery("pos.staff.getStaff", {
        licenseKey,
      })) as StaffRow[] | undefined;
      if (rows?.length) {
        await saveStaffCache(staffRowsToLocal(rows));
        await saveDataCache(`staff:${licenseKey}`, rows);
      }
    })(),
  );

  tasks.push(
    (async () => {
      const company = await runPosQuery("pos.settings.getCompanyDetails", {
        licenseKey,
      });
      if (company !== undefined) {
        await saveDataCache(`company:${licenseKey}`, company);
      }
    })(),
  );

  tasks.push(
    (async () => {
      const categories = await runPosQuery("pos.menu.getCategories", {
        licenseKey,
      });
      if (categories !== undefined) {
        await saveDataCache(`categories:${licenseKey}`, categories);
      }
    })(),
  );

  tasks.push(
    (async () => {
      const items = await runPosQuery("pos.menu.getAllItems", { licenseKey });
      if (items !== undefined) {
        await saveDataCache(`menuItems:${licenseKey}`, items);
      }
    })(),
  );

  tasks.push(
    (async () => {
      const menus = await runPosQuery("pos.menu.getMenus", { licenseKey });
      if (menus !== undefined) {
        await saveDataCache(`menus:${licenseKey}`, menus);
      }
    })(),
  );

  tasks.push(
    (async () => {
      const tables = await runPosQuery("pos.tables.getTables", { licenseKey });
      if (tables !== undefined) {
        await saveDataCache(posTablesIndexedDbKey(licenseKey), tables);
      }
    })(),
  );

  tasks.push(
    (async () => {
      try {
        const branding = await fetchPinBrandingFromCloud(licenseKey);
        if (branding) {
          await savePinLoginBranding(licenseKey, branding);
        }
      } catch {
        /* optional column */
      }
    })(),
  );

  tasks.push(
    (async () => {
      try {
        const theme = await fetchPosThemeFromCloud(licenseKey);
        applyPosThemeFromCloud(theme);
      } catch {
        /* optional column */
      }
    })(),
  );

  tasks.push(
    (async () => {
      try {
        const branding = await fetchPhoneAccessBrandingFromCloud(licenseKey);
        if (branding) {
          await savePhoneAccessBranding(licenseKey, branding);
        }
      } catch {
        /* optional column */
      }
    })(),
  );

  await Promise.allSettled(tasks);

  try {
    const r = await getRestaurantByLicense(licenseKey);
    await supabase
      .from("restaurants")
      .update({ last_pos_sync_at: new Date().toISOString() })
      .eq("id", r.id);
  } catch {
    /* column may be missing until migration 029 */
  }
}

export { DEFAULT_PIN_LOGIN_BRANDING };
