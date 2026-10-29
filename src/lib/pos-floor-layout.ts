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

type FloorTableRect = {
  posX?: number | null;
  posY?: number | null;
  shape?: string | null;
  tableScale?: number | null;
  tableScaleY?: number | null;
};

const FLOOR_PAD = 32;
/** Free space kept between a new table and its neighbours. */
const FLOOR_GAP = 12;

/** First default grid slot that does not overlap any table already in the room. */
export function firstFreeFloorSlot(
  tables: FloorTableRect[],
  shape: string = "square",
): { posX: number; posY: number } {
  const { w, h } = tableFootprint(shape, 1, 1);
  const rects = tables.map((t) => {
    const { x, y } = tableScaleXY(t);
    const size = tableFootprint(t.shape, x, y);
    return { x: t.posX ?? 100, y: t.posY ?? 100, w: size.w, h: size.h };
  });
  for (let n = 0; n < 600; n++) {
    const s = nextFloorTableSlot(n);
    const overlaps = rects.some(
      (r) =>
        s.posX < r.x + r.w + FLOOR_GAP &&
        s.posX + w + FLOOR_GAP > r.x &&
        s.posY < r.y + r.h + FLOOR_GAP &&
        s.posY + h + FLOOR_GAP > r.y,
    );
    if (!overlaps) return s;
  }
  return nextFloorTableSlot(tables.length);
}

/**
 * Canvas for one room with a fixed origin at (0, 0), so moving a table never shifts the
 * others. Only legacy negative positions push the origin further up/left.
 * `growPx` adds room right/below so the editor can drag tables outward.
 */
export function floorCanvasBox(
  tables: FloorTableRect[],
  growPx = 0,
): { minX: number; minY: number; width: number; height: number } {
  if (tables.length === 0) {
    return { minX: 0, minY: 0, width: 400 + growPx, height: 280 + growPx };
  }
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
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
  return {
    minX,
    minY,
    width: maxX - minX + FLOOR_PAD + growPx,
    height: maxY - minY + FLOOR_PAD + growPx,
  };
}

/** Bounding box of one room’s tables, padded — floor canvas scrolls when this exceeds the viewport. */
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
