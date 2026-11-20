export const STOCK_UNITS = ["pc", "kg", "g", "lt", "ml", "bottle", "box"] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

/** Units in the same group convert into each other (kg ↔ g, lt ↔ ml); count units never mix. */
const UNIT_BASE: Record<StockUnit, { group: string; factor: number }> = {
  kg: { group: "mass", factor: 1000 },
  g: { group: "mass", factor: 1 },
  lt: { group: "volume", factor: 1000 },
  ml: { group: "volume", factor: 1 },
  pc: { group: "pc", factor: 1 },
  bottle: { group: "bottle", factor: 1 },
  box: { group: "box", factor: 1 },
};

export function isStockUnit(unit: unknown): unit is StockUnit {
  return typeof unit === "string" && (STOCK_UNITS as readonly string[]).includes(unit);
}

/** Units a recipe line may use for an ingredient stocked in `stockUnit`. */
export function compatibleUnits(stockUnit: string | null | undefined): StockUnit[] {
  if (!isStockUnit(stockUnit)) return [...STOCK_UNITS];
  const group = UNIT_BASE[stockUnit].group;
  return STOCK_UNITS.filter((u) => UNIT_BASE[u].group === group);
}

/** `qty` in `from` expressed in `to`; null when the units cannot be converted. */
export function convertStockQty(
  qty: number,
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  if (!isStockUnit(from) || !isStockUnit(to) || from === to) return qty;
  if (UNIT_BASE[from].group !== UNIT_BASE[to].group) return null;
  return (qty * UNIT_BASE[from].factor) / UNIT_BASE[to].factor;
}

const INGREDIENT_EMOJI: { pattern: RegExp; emoji: string }[] = [
  { pattern: /chees|djath/i, emoji: "🧀" },
  { pattern: /bun|bread|buk|brioche/i, emoji: "🍞" },
  { pattern: /chicken|pul|fillet|file/i, emoji: "🍗" },
  { pattern: /beef|meat|mish|patty|steak|vi[cç]/i, emoji: "🥩" },
  { pattern: /bacon|proshut|ham/i, emoji: "🥓" },
  { pattern: /fish|peshk|salmon|tuna/i, emoji: "🐟" },
  { pattern: /egg|vez/i, emoji: "🥚" },
  { pattern: /tomat|domat/i, emoji: "🍅" },
  { pattern: /lettuce|sallat|marul/i, emoji: "🥬" },
  { pattern: /onion|qep/i, emoji: "🧅" },
  { pattern: /potato|patat/i, emoji: "🥔" },
  { pattern: /mushroom|kërpudh|kerpudh/i, emoji: "🍄" },
  { pattern: /milk|qum[eë]sht|cream|krem/i, emoji: "🥛" },
  { pattern: /butter|gjalp/i, emoji: "🧈" },
  { pattern: /oil|vaj|olive|ulli/i, emoji: "🫒" },
  { pattern: /flour|miell|wheat/i, emoji: "🌾" },
  { pattern: /salt|krip/i, emoji: "🧂" },
  { pattern: /sugar|sheqer/i, emoji: "🍬" },
  { pattern: /coffee|kafe/i, emoji: "☕" },
  { pattern: /lemon|lime|limon/i, emoji: "🍋" },
  { pattern: /ice|akull/i, emoji: "🧊" },
  { pattern: /sauce|salc|ketchup|mayo/i, emoji: "🥫" },
  { pattern: /water|uj[eë]/i, emoji: "💧" },
];

export function ingredientEmoji(name: string): string | undefined {
  return INGREDIENT_EMOJI.find((r) => r.pattern.test(name))?.emoji;
}
