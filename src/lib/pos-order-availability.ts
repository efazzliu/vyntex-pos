export type OrderBlockReason = "stopped" | "stock";

export type OrderableMenuItem = {
  name?: string;
  available?: boolean;
  trackStock?: boolean;
  currentStock?: number | null;
};

export const ORDER_AVAILABILITY_LS_PREFIX = "vyntex.pos.enforceAvailability:";

export function parseEnforceOrderAvailability(raw: unknown): boolean {
  return raw === true;
}

export function readLocalEnforceOrderAvailability(licenseKey: string): boolean {
  try {
    return localStorage.getItem(ORDER_AVAILABILITY_LS_PREFIX + licenseKey) === "1";
  } catch {
    return false;
  }
}

export function writeLocalEnforceOrderAvailability(
  licenseKey: string,
  enforce: boolean,
): void {
  try {
    const key = ORDER_AVAILABILITY_LS_PREFIX + licenseKey;
    if (enforce) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function resolveEnforceOrderAvailability(
  cloud: unknown,
  licenseKey: string,
): boolean {
  if (typeof cloud === "boolean") return cloud;
  return readLocalEnforceOrderAvailability(licenseKey);
}

/** When enforcement is off, hide kitchen-stopped items. When on, show them greyed. */
export function isMenuItemShownForOrdering(
  item: { available?: boolean },
  enforce: boolean,
): boolean {
  if (enforce) return true;
  return item.available !== false;
}

export function getOrderBlockReason(
  item: OrderableMenuItem,
  quantityWanted: number,
  enforce: boolean,
): OrderBlockReason | null {
  if (!enforce) return null;
  if (item.available === false) return "stopped";
  if (item.trackStock) {
    const stock = Number(item.currentStock ?? 0);
    if (!Number.isFinite(stock) || stock < quantityWanted) return "stock";
  }
  return null;
}

export function parseOrderBlockError(
  err: unknown,
): { reason: OrderBlockReason; name: string } | null {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const stopped = raw.match(/UNAVAILABLE_STOPPED:([^\n]+)/);
  if (stopped?.[1]) return { reason: "stopped", name: stopped[1].trim() };
  const stock = raw.match(/UNAVAILABLE_STOCK:([^\n]+)/);
  if (stock?.[1]) return { reason: "stock", name: stock[1].trim() };
  return null;
}
