type PhotoRule = { pattern: RegExp; url: string };

/** Verified Unsplash IDs (404-checked). */
const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/${id}?w=400&h=400&fit=crop&q=80`;

const PHOTO_RULES: PhotoRule[] = [
  { pattern: /coca|cola|fanta|sprite|schweppes|red bull|ice tea|tonic|pellegrino/i, url: UNSPLASH("photo-1629203851122-3726ecdf080e") },
  { pattern: /ujë|uje|water|sparkling/i, url: UNSPLASH("photo-1556679343-c7306c1976bc") },
  { pattern: /kafe|espress|macchiato|cappuccino|latte|mocha|doppio|flat white|çaj|caj|tea/i, url: UNSPLASH("photo-1495474472287-4d71bcdd2085") },
  { pattern: /mojito|aperol|negroni|gin|whiskey|martini|colada|spritz|koktej|cocktail/i, url: UNSPLASH("photo-1556679343-c7306c1976bc") },
  { pattern: /bira|heineken|corona|peja|beer/i, url: UNSPLASH("photo-1563379091339-03b21ab4a4f8") },
  { pattern: /verë|vere|prosecco|cabernet|wine/i, url: UNSPLASH("photo-1513475382585-d06e58bcb0e0") },
  { pattern: /pizza|margherita|capricciosa|diavola|calzone|prosciutto|quattro|tuna/i, url: UNSPLASH("photo-1513104890138-7c749659a591") },
  { pattern: /hamburger|cheeseburger|burger|sandwich/i, url: UNSPLASH("photo-1606755962773-d324e0a13086") },
  { pattern: /pomfrit|fries/i, url: UNSPLASH("photo-1573080496219-bb080dd4f877") },
  { pattern: /bruschetta|carpaccio|burrata|antipasta/i, url: UNSPLASH("photo-1551218808-94e220e084d2") },
  { pattern: /sallat|salad|cezar|caesar/i, url: UNSPLASH("photo-1512621776951-a57141f2eefd") },
  { pattern: /supë|supe|soup/i, url: UNSPLASH("photo-1547592166-23ac45744acd") },
  { pattern: /fileto|rib-eye|ribeye|viçi|vici|steak|biftek/i, url: UNSPLASH("photo-1555939594-58d7cb561ad1") },
  { pattern: /pule|chicken|pollo/i, url: UNSPLASH("photo-1598103442097-8b74394b95c6") },
  { pattern: /salmon|tartar|deti|seafood|risotto deti/i, url: UNSPLASH("photo-1555939594-58d7cb561ad1") },
  { pattern: /risotto|gnocchi/i, url: UNSPLASH("photo-1476124369491-e7addf5db371") },
  { pattern: /pasta|carbonara|bolognese|spaghetti|truffle pasta/i, url: UNSPLASH("photo-1621996346565-e3dbc646d9a9") },
  { pattern: /tiramisu|cheesecake|bakllava|akullore|gelato|panna|brûlée|brulee|ëmbëls|embels|dessert/i, url: UNSPLASH("photo-1571877227200-a0d98ea607e9") },
];

const CATEGORY_DEFAULTS: Record<string, string> = {
  pije: UNSPLASH("photo-1629203851122-3726ecdf080e"),
  kafe: UNSPLASH("photo-1495474472287-4d71bcdd2085"),
  kokteje: UNSPLASH("photo-1556679343-c7306c1976bc"),
  bira: UNSPLASH("photo-1563379091339-03b21ab4a4f8"),
  "bira & verë": UNSPLASH("photo-1513475382585-d06e58bcb0e0"),
  antipasta: UNSPLASH("photo-1551218808-94e220e084d2"),
  kryesor: UNSPLASH("photo-1555939594-58d7cb561ad1"),
  pizza: UNSPLASH("photo-1513104890138-7c749659a591"),
  ëmbëlsira: UNSPLASH("photo-1571877227200-a0d98ea607e9"),
  embelsira: UNSPLASH("photo-1571877227200-a0d98ea607e9"),
  starters: UNSPLASH("photo-1551218808-94e220e084d2"),
  mains: UNSPLASH("photo-1555939594-58d7cb561ad1"),
  drinks: UNSPLASH("photo-1495474472287-4d71bcdd2085"),
  desserts: UNSPLASH("photo-1571877227200-a0d98ea607e9"),
};

const GENERIC_FOOD = UNSPLASH("photo-1504674900247-0877df9cc836");

/** Legacy seed URLs that return 404 on Unsplash — treat as missing. */
const BROKEN_UNSPLASH_IDS = [
  "photo-1514434755162-1ce173684178",
  "photo-1568901346835-23c9450c58c0",
  "photo-1546838720-76d91c3903a7",
  "photo-1551538827-9b079410582d",
  "photo-1608270587082-7544a4eed7c0",
  "photo-1510814340209-7c0345a615a1",
  "photo-1572441713132-51a540ae523f",
  "photo-1467003909585-bf5adee770bf",
  "photo-1548839140-5a94179182b9",
];

function isBrokenStoredPhotoUrl(url: string): boolean {
  return BROKEN_UNSPLASH_IDS.some((id) => url.includes(id));
}

function normalizeCategoryKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Stable stock photo URL for a menu item (seed data, demo, backfill). */
export function photoUrlForMenuItem(name: string, categoryName = ""): string {
  const haystack = `${name} ${categoryName}`;
  for (const rule of PHOTO_RULES) {
    if (rule.pattern.test(haystack)) return rule.url;
  }
  const catKey = normalizeCategoryKey(categoryName);
  if (CATEGORY_DEFAULTS[catKey]) return CATEGORY_DEFAULTS[catKey];
  return GENERIC_FOOD;
}

/** Use stored image_url when set; otherwise fall back to a stock photo. */
export function resolveMenuItemImageUrl(
  item: { name: string; imageUrl?: string | null },
  categoryName = "",
): string {
  const stored = item.imageUrl?.trim();
  if (stored && !isBrokenStoredPhotoUrl(stored)) return stored;
  return photoUrlForMenuItem(item.name, categoryName);
}
