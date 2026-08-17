/**
 * Default floor-plan slot for the n-th table in a zone (0-based n).
 * Keeps Supabase `createTable` in sync with Convex `createTable` and the floor editor.
 */
export function nextFloorTableSlot(n: number): { posX: number; posY: number } {
  const col = n % 6;
  const row = Math.floor(n / 6);
  return { posX: 40 + col * 140, posY: 40 + row * 120 };
}

export function tableFootprint(
  shape?: string | null,
  scaleX = 1,
  scaleY = scaleX,
): { w: number; h: number } {
  const sx = Number.isFinite(scaleX) ? scaleX : 1;
  const sy = Number.isFinite(scaleY) ? scaleY : sx;
  return {
    w: ((shape ?? "square") === "rectangle" ? 120 : 80) * sx,
    h: 80 * sy,
  };
}

export const TABLE_SCALE_MIN = 0.4;
export const TABLE_SCALE_MAX = 3;

export function clampTableScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(TABLE_SCALE_MAX, Math.max(TABLE_SCALE_MIN, Math.round(n * 100) / 100));
}

/** Width (X) and height (Y) scale. Missing Y follows X so older tables stay uniform. */
export function tableScaleXY(t: {
  tableScale?: number | null;
  tableScaleY?: number | null;
}): { x: number; y: number } {
  const x = t.tableScale ?? 1;
  const y = t.tableScaleY ?? x;
  return { x, y };
}

/** Bounding box of one room’s tables, padded — used to fit the floor on screen without scroll. */
export function zoneContentBox(
  tables: {
    posX?: number | null;
    posY?: number | null;
    shape?: string | null;
    tableScale?: number | null;
    tableScaleY?: number | null;
  }[],
): { minX: number; minY: number; width: number; height: number } {
  if (tables.length === 0) {
    return { minX: 0, minY: 0, width: 400, height: 280 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tables) {
    const px = t.posX ?? 100;
    const py = t.posY ?? 100;
    const { x, y } = tableScaleXY(t);
    const { w, h } = tableFootprint(t.shape, x, y);
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px + w);
    maxY = Math.max(maxY, py + h);
  }
  const pad = 32;
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: Math.max(1, maxX - minX + pad * 2),
    height: Math.max(1, maxY - minY + pad * 2),
  };
}
