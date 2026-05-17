export type AdminAccentColor = "blue" | "cyan" | "emerald" | "violet" | "rose" | "amber";

export type AdminNotificationPrefs = {
  email: boolean;
  push: boolean;
  sound: boolean;
  billingAlerts: boolean;
  licenseExpiryAlerts: boolean;
};

export type AdminLoginHistoryEntry = {
  at: string;
  userAgent: string;
  ip?: string;
};

export type AdminUiPrefs = {
  sidebarCollapsed: boolean;
  compactMode: boolean;
  accentColor: AdminAccentColor;
};

export type AdminUserMetadata = {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  language?: string;
  timezone?: string;
  admin_notifications?: Partial<AdminNotificationPrefs>;
  admin_login_history?: AdminLoginHistoryEntry[];
  admin_ui?: Partial<AdminUiPrefs>;
};

export const DEFAULT_NOTIFICATION_PREFS: AdminNotificationPrefs = {
  email: true,
  push: false,
  sound: true,
  billingAlerts: true,
  licenseExpiryAlerts: true,
};

export const DEFAULT_UI_PREFS: AdminUiPrefs = {
  sidebarCollapsed: false,
  compactMode: false,
  accentColor: "blue",
};

export const ADMIN_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "sq", label: "Shqip" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
] as const;

export const ADMIN_ACCENT_OPTIONS: Array<{ id: AdminAccentColor; label: string; hex: string }> = [
  { id: "blue", label: "Blue", hex: "#0066FF" },
  { id: "cyan", label: "Cyan", hex: "#06b6d4" },
  { id: "emerald", label: "Emerald", hex: "#10b981" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
  { id: "rose", label: "Rose", hex: "#f43f5e" },
  { id: "amber", label: "Amber", hex: "#f59e0b" },
];

export const ADMIN_TIMEZONES = [
  "UTC",
  "Europe/Tirane",
  "Europe/Belgrade",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Tokyo",
] as const;

export function adminLanguageValue(language: string): string {
  return ADMIN_LANGUAGES.some((l) => l.value === language) ? language : "en";
}

export function adminTimezoneOptions(current: string): string[] {
  const list = [...ADMIN_TIMEZONES];
  if (current && !list.includes(current as (typeof ADMIN_TIMEZONES)[number])) {
    list.unshift(current);
  }
  return list;
}

export function adminTimezoneValue(timezone: string): string {
  const options = adminTimezoneOptions(timezone);
  return options.includes(timezone) ? timezone : "Europe/Tirane";
}
