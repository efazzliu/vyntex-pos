const STORAGE_KEY = "vyntex-waiter-notif-dismissed";

type DismissedMap = Record<string, string>;

/**
 * Waiter-only view state: hiding a kitchen notification card never changes the
 * order. The stored signature makes the card come back when the kitchen sends
 * something new or marks an item ready.
 */
export function readDismissedNotifications(): DismissedMap {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: DismissedMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function write(map: DismissedMap): void {
  try {
    if (Object.keys(map).length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function dismissNotification(
  current: DismissedMap,
  key: string,
  signature: string,
): DismissedMap {
  const next = { ...current, [key]: signature };
  write(next);
  return next;
}

export function restoreNotification(
  current: DismissedMap,
  key: string,
): DismissedMap {
  const next = { ...current };
  delete next[key];
  write(next);
  return next;
}

export function isNotificationDismissed(
  map: DismissedMap,
  key: string,
  signature: string,
): boolean {
  return map[key] === signature;
}
