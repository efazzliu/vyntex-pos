import type {
  AdminLoginHistoryEntry,
  AdminNotificationPrefs,
  AdminUiPrefs,
  AdminUserMetadata,
} from "./admin-settings-types.ts";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_UI_PREFS,
} from "./admin-settings-types.ts";

const LOCAL_UI_KEY = "vyntex-admin-ui";

export function readLocalUiPrefs(): Partial<AdminUiPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LOCAL_UI_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<AdminUiPrefs>;
  } catch {
    return {};
  }
}

export function writeLocalUiPrefs(prefs: AdminUiPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_UI_KEY, JSON.stringify(prefs));
}

export function mergeUiPrefs(meta?: AdminUserMetadata["admin_ui"]): AdminUiPrefs {
  const local = readLocalUiPrefs();
  return {
    sidebarCollapsed: local.sidebarCollapsed ?? meta?.sidebarCollapsed ?? DEFAULT_UI_PREFS.sidebarCollapsed,
    compactMode: local.compactMode ?? meta?.compactMode ?? DEFAULT_UI_PREFS.compactMode,
    accentColor: local.accentColor ?? meta?.accentColor ?? DEFAULT_UI_PREFS.accentColor,
  };
}

export function mergeNotificationPrefs(
  meta?: AdminUserMetadata["admin_notifications"],
): AdminNotificationPrefs {
  return {
    email: meta?.email ?? DEFAULT_NOTIFICATION_PREFS.email,
    push: meta?.push ?? DEFAULT_NOTIFICATION_PREFS.push,
    sound: meta?.sound ?? DEFAULT_NOTIFICATION_PREFS.sound,
    billingAlerts: meta?.billingAlerts ?? DEFAULT_NOTIFICATION_PREFS.billingAlerts,
    licenseExpiryAlerts: meta?.licenseExpiryAlerts ?? DEFAULT_NOTIFICATION_PREFS.licenseExpiryAlerts,
  };
}

export function appendLoginHistory(
  existing: AdminLoginHistoryEntry[] | undefined,
  userAgent: string,
  ip?: string,
): AdminLoginHistoryEntry[] {
  const now = new Date().toISOString();
  const next: AdminLoginHistoryEntry = { at: now, userAgent, ...(ip ? { ip } : {}) };
  const list = existing ?? [];
  const recent = list[0];
  if (recent && recent.userAgent === userAgent && Date.now() - new Date(recent.at).getTime() < 60_000) {
    return list;
  }
  return [next, ...list].slice(0, 25);
}

export function applyAccentCss(accentHex: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--admin-accent", accentHex);
  document.documentElement.style.setProperty("--primary", accentHex);
}

export function accentHexForId(id: AdminUiPrefs["accentColor"]): string {
  const map: Record<AdminUiPrefs["accentColor"], string> = {
    blue: "#0066FF",
    cyan: "#06b6d4",
    emerald: "#10b981",
    violet: "#8b5cf6",
    rose: "#f43f5e",
    amber: "#f59e0b",
  };
  return map[id];
}
