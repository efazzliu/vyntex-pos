export const SETTINGS_CATEGORY_IDS = [
  "general",
  "payments",
  "menu",
  "devices",
  "users",
  "tax",
  "notifications",
  "integrations",
  "money",
  "backup",
  "security",
  "print",
  "customerDisplay",
  "other",
] as const;

export type SettingsCategoryId = (typeof SETTINGS_CATEGORY_IDS)[number];

export const POS_TIMEZONES = [
  "Europe/Tirane",
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
