/**
 * Default floor-plan slot for the n-th table in a zone (0-based n).
 * Keeps Supabase `createTable` in sync with Convex `createTable` and the floor editor.
 */
export function nextFloorTableSlot(n: number): { posX: number; posY: number } {
  const col = n % 6;
  const row = Math.floor(n / 6);
  return { posX: 40 + col * 140, posY: 40 + row * 120 };
}
