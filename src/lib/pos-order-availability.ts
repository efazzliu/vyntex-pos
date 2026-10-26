export type OrderBlockReason = "stopped" | "stock";

export type OrderableMenuItem = {
  name?: string;
  available?: boolean;
  trackStock?: boolean;
  currentStock?: number | null;
};

export type OrderAvailabilityRules = {
  honorKitchenStop: boolean;
  blockOutOfStock: boolean;
};

export type PosStockRules = {
  blockOutOfStock: boolean;
  defaultLowStockThreshold: number;
};

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export const DEFAULT_POS_STOCK_RULES: PosStockRules = {
  blockOutOfStock: true,
  defaultLowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
};

export const ORDER_AVAILABILITY_LS_PREFIX = "vyntex.pos.enforceAvailability:";
export const STOCK_RULES_LS_PREFIX = "vyntex.pos.stockRules:";

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

function clampLowStockThreshold(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LOW_STOCK_THRESHOLD;
  return Math.min(9999, Math.max(0, Math.round(n)));
}

export function parsePosStockRules(raw: unknown): PosStockRules {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    blockOutOfStock: o.blockOutOfStock !== false,
    defaultLowStockThreshold: clampLowStockThreshold(
      o.defaultLowStockThreshold,
    ),
  };
}

export function serializePosStockRules(rules: PosStockRules): PosStockRules {
  return parsePosStockRules(rules);
}

/** Column `pos_stock_rules` when it exists, otherwise rules kept on payment settings. */
export function stockRulesFromRestaurantRow(
  row:
    | {
        pos_stock_rules?: unknown;
        pos_payment_settings?: unknown;
      }
    | null
    | undefined,
): unknown {
  if (!row) return undefined;
  if (Object.prototype.hasOwnProperty.call(row, "pos_stock_rules")) {
    return row.pos_stock_rules;
  }
  const pay = row.pos_payment_settings;
  if (pay && typeof pay === "object" && "stockRules" in pay) {
    return (pay as { stockRules?: unknown }).stockRules;
  }
  return undefined;
}

export function readLocalPosStockRules(licenseKey: string): PosStockRules {
  try {
    const raw = localStorage.getItem(STOCK_RULES_LS_PREFIX + licenseKey);
    if (!raw) return { ...DEFAULT_POS_STOCK_RULES };
    return parsePosStockRules(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_POS_STOCK_RULES };
  }
}

export function writeLocalPosStockRules(
  licenseKey: string,
  rules: PosStockRules,
): void {
  try {
    localStorage.setItem(
      STOCK_RULES_LS_PREFIX + licenseKey,
      JSON.stringify(serializePosStockRules(rules)),
    );
  } catch {
    /* ignore */
  }
}

export function asOrderAvailabilityRules(
  rules: boolean | OrderAvailabilityRules | undefined,
): OrderAvailabilityRules {
  if (rules && typeof rules === "object") {
    return {
      honorKitchenStop: rules.honorKitchenStop === true,
      blockOutOfStock: rules.blockOutOfStock !== false,
    };
  }
  return {
    honorKitchenStop: rules === true,
    blockOutOfStock: true,
  };
}

export function resolveOrderAvailabilityRulesFromCompany(
  company:
    | {
        enforceOrderAvailability?: unknown;
        stockRules?: unknown;
      }
    | null
    | undefined,
  licenseKey: string,
): OrderAvailabilityRules {
  const stock = parsePosStockRules(
    company?.stockRules ?? readLocalPosStockRules(licenseKey),
  );
  return {
    honorKitchenStop: resolveEnforceOrderAvailability(
      company?.enforceOrderAvailability,
      licenseKey,
    ),
    blockOutOfStock: stock.blockOutOfStock,
  };
}

export function effectiveLowStockThreshold(
  itemThreshold: number | null | undefined,
  venueDefault: number = DEFAULT_LOW_STOCK_THRESHOLD,
): number {
  if (itemThreshold == null) return clampLowStockThreshold(venueDefault);
  const n = Number(itemThreshold);
  if (!Number.isFinite(n)) return clampLowStockThreshold(venueDefault);
  return n;
}

/** When kitchen-stop blocking is off, hide stopped items. When on, show them greyed. */
export function isMenuItemShownForOrdering(
  item: { available?: boolean },
  honorKitchenStop: boolean,
): boolean {
  if (honorKitchenStop) return true;
  return item.available !== false;
}

/**
 * Kitchen-stopped items honour the venue kitchen-stop toggle.
 * Tracked stock below the wanted qty is blocked only when block-out-of-stock is on.
 */
export function getOrderBlockReason(
  item: OrderableMenuItem,
  quantityWanted: number,
  rules: boolean | OrderAvailabilityRules,
): OrderBlockReason | null {
  const r = asOrderAvailabilityRules(rules);
  if (r.blockOutOfStock && item.trackStock) {
    const stock = Number(item.currentStock ?? 0);
    if (!Number.isFinite(stock) || stock < quantityWanted) return "stock";
  }
  if (r.honorKitchenStop && item.available === false) return "stopped";
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
