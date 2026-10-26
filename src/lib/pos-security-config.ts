export const SESSION_TIMEOUT_MINUTES = [0, 5, 15, 30, 60] as const;

export type SessionTimeoutMinutes = (typeof SESSION_TIMEOUT_MINUTES)[number];

export type PosSecuritySettings = {
  sessionTimeoutMinutes: SessionTimeoutMinutes;
};

export const DEFAULT_POS_SECURITY_SETTINGS: PosSecuritySettings = {
  sessionTimeoutMinutes: 0,
};

export function parsePosSecuritySettings(raw: unknown): PosSecuritySettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const n = Number(o.sessionTimeoutMinutes);
  const sessionTimeoutMinutes = SESSION_TIMEOUT_MINUTES.includes(
    n as SessionTimeoutMinutes,
  )
    ? (n as SessionTimeoutMinutes)
    : 0;
  return { sessionTimeoutMinutes };
}

export function serializePosSecuritySettings(
  settings: PosSecuritySettings,
): PosSecuritySettings {
  return parsePosSecuritySettings(settings);
}

export const SECURITY_EVENT_ACTIONS = [
  "login",
  "logout",
  "login_failed",
  "device_revoke",
  "void_item",
  "item_deleted",
  "order_cancel",
  "staff_create",
  "staff_update",
  "day_close",
] as const;

export function isSecurityEventAction(action: string): boolean {
  return (SECURITY_EVENT_ACTIONS as readonly string[]).includes(action);
}
