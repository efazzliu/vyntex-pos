import {
  cartLineKey,
  type SelectedCustomization,
} from "@/lib/menu-customizations.ts";

const STORAGE_KEY = "vyntex-waiter-menu-selection";
const CHANGED = "vyntex-waiter-menu-selection-changed";

export type WaiterMenuSelectionLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  station?: "kitchen" | "bar";
  vatRate?: number;
  notes?: string;
  selectedCustomizations?: SelectedCustomization[];
};

function notify(): void {
  try {
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* ignore */
  }
}

export function getWaiterMenuSelection(): WaiterMenuSelectionLine[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is WaiterMenuSelectionLine =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as WaiterMenuSelectionLine).menuItemId === "string" &&
        typeof (row as WaiterMenuSelectionLine).name === "string" &&
        Number((row as WaiterMenuSelectionLine).quantity) > 0,
    );
  } catch {
    return [];
  }
}

export function setWaiterMenuSelection(lines: WaiterMenuSelectionLine[]): void {
  try {
    if (lines.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* ignore */
  }
  notify();
}

export function clearWaiterMenuSelection(): void {
  setWaiterMenuSelection([]);
}

export function addWaiterMenuSelectionLine(
  line: WaiterMenuSelectionLine,
): WaiterMenuSelectionLine[] {
  const qty = Math.max(1, Math.round(Number(line.quantity) || 1));
  const key = cartLineKey(line);
  const prev = getWaiterMenuSelection();
  const existing = prev.find((row) => cartLineKey(row) === key);
  const next = existing
    ? prev.map((row) =>
        cartLineKey(row) === key
          ? { ...row, quantity: row.quantity + qty }
          : row,
      )
    : [...prev, { ...line, quantity: qty }];
  setWaiterMenuSelection(next);
  return next;
}

export function waiterMenuSelectionQty(lines: WaiterMenuSelectionLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function waiterMenuSelectionQtyForItem(
  lines: WaiterMenuSelectionLine[],
  menuItemId: string,
): number {
  return lines
    .filter((line) => line.menuItemId === menuItemId)
    .reduce((sum, line) => sum + line.quantity, 0);
}

export function subscribeWaiterMenuSelection(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener(CHANGED, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGED, handler);
    window.removeEventListener("storage", handler);
  };
}
