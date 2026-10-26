export const SETTINGS_CATEGORY_IDS = [
  "general",
  "payments",
  "menu",
  "devices",
  "users",
  "tax",
  "notifications",
  "integrations",
  "inventory",
  "storage",
  "security",
  "print",
  "customerDisplay",
  "phoneApp",
  "other",
  "license",
] as const;

export type SettingsCategoryId = (typeof SETTINGS_CATEGORY_IDS)[number];

export const POS_TIMEZONES = [
  "Europe/Tirane",
  "Europe/Pristina",
  "Europe/Belgrade",
  "Europe/Skopje",
  "Europe/Athens",
  "Europe/Rome",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/London",
  "UTC",
  "America/New_York",
  "Asia/Dubai",
] as const;

export const PAYMENT_ROLES_LS_PREFIX = "vyntex.pos.paymentRoles:";

export type PaymentManagerRoles = {
  admin: boolean;
  manager: boolean;
  waiter: boolean;
};

export const DEFAULT_PAYMENT_ROLES: PaymentManagerRoles = {
  admin: true,
  manager: true,
  waiter: false,
};

export function readPaymentManagerRoles(licenseKey: string): PaymentManagerRoles {
  try {
    const raw = localStorage.getItem(PAYMENT_ROLES_LS_PREFIX + licenseKey);
    if (!raw) return { ...DEFAULT_PAYMENT_ROLES };
    const parsed = JSON.parse(raw) as Partial<PaymentManagerRoles>;
    return {
      admin: true,
      manager: parsed.manager !== false,
      waiter: parsed.waiter === true,
    };
  } catch {
    return { ...DEFAULT_PAYMENT_ROLES };
  }
}

export function writePaymentManagerRoles(
  licenseKey: string,
  roles: PaymentManagerRoles,
): void {
  localStorage.setItem(
    PAYMENT_ROLES_LS_PREFIX + licenseKey,
    JSON.stringify({ ...roles, admin: true }),
  );
}

export type PosGeneralPrefs = {
  dateFormat: "dmy" | "mdy" | "ymd";
  timeFormat: "24h" | "12h";
  defaultOrderType: "dine_in" | "takeaway" | "delivery";
  defaultTableService: boolean;
  receiptLanguage: "en" | "sq";
};

export const DEFAULT_GENERAL_PREFS: PosGeneralPrefs = {
  dateFormat: "dmy",
  timeFormat: "24h",
  defaultOrderType: "dine_in",
  defaultTableService: true,
  receiptLanguage: "en",
};

const GENERAL_PREFS_LS_PREFIX = "vyntex.pos.generalPrefs:";

export function parseGeneralPrefs(raw: unknown): PosGeneralPrefs {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    dateFormat:
      o.dateFormat === "mdy" || o.dateFormat === "ymd" ? o.dateFormat : "dmy",
    timeFormat: o.timeFormat === "12h" ? "12h" : "24h",
    defaultOrderType:
      o.defaultOrderType === "takeaway" || o.defaultOrderType === "delivery"
        ? o.defaultOrderType
        : "dine_in",
    defaultTableService: o.defaultTableService !== false,
    receiptLanguage: o.receiptLanguage === "sq" ? "sq" : "en",
  };
}

export function readLocalGeneralPrefs(licenseKey: string): PosGeneralPrefs {
  try {
    const raw = localStorage.getItem(GENERAL_PREFS_LS_PREFIX + licenseKey);
    if (!raw) return { ...DEFAULT_GENERAL_PREFS };
    return parseGeneralPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GENERAL_PREFS };
  }
}

export function writeLocalGeneralPrefs(licenseKey: string, prefs: PosGeneralPrefs): void {
  localStorage.setItem(GENERAL_PREFS_LS_PREFIX + licenseKey, JSON.stringify(prefs));
}
