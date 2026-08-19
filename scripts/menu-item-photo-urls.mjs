/** @typedef {{ pattern: RegExp, url: string }} PhotoRule */

const unsplash = (id) =>
  `https://images.unsplash.com/${id}?w=400&h=400&fit=crop&q=80`;

/** @type {PhotoRule[]} */
const PHOTO_RULES = [
  { pattern: /coca|cola|fanta|sprite|schweppes|red bull|ice tea|tonic|pellegrino/i, url: unsplash("photo-1629203851122-3726ecdf080e") },
  { pattern: /ujë|uje|water|sparkling/i, url: unsplash("photo-1548839140-5a94179182b9") },
  { pattern: /kafe|espress|macchiato|cappuccino|latte|mocha|doppio|flat white|çaj|caj|tea/i, url: unsplash("photo-1514434755162-1ce173684178") },
  { pattern: /mojito|aperol|negroni|gin|whiskey|martini|colada|spritz|koktej|cocktail/i, url: unsplash("photo-1551538827-9b079410582d") },
  { pattern: /bira|heineken|corona|peja|beer/i, url: unsplash("photo-1608270587082-7544a4eed7c0") },
  { pattern: /verë|vere|prosecco|cabernet|wine/i, url: unsplash("photo-1510814340209-7c0345a615a1") },
  { pattern: /pizza|margherita|capricciosa|diavola|calzone|prosciutto|quattro|tuna/i, url: unsplash("photo-1513104890138-7c749659a591") },
  { pattern: /hamburger|cheeseburger|burger|sandwich/i, url: unsplash("photo-1568901346835-23c9450c58c0") },
  { pattern: /pomfrit|fries/i, url: unsplash("photo-1573080496219-bb080dd4f877") },
  { pattern: /bruschetta|carpaccio|burrata|antipasta/i, url: unsplash("photo-1572441713132-51a540ae523f") },
  { pattern: /sallat|salad|cezar|caesar/i, url: unsplash("photo-1512621776951-a57141f2eefd") },
  { pattern: /supë|supe|soup/i, url: unsplash("photo-1547592166-23ac45744acd") },
  { pattern: /fileto|rib-eye|ribeye|viçi|vici|steak|biftek/i, url: unsplash("photo-1546838720-76d91c3903a7") },
  { pattern: /pule|chicken|pollo/i, url: unsplash("photo-1598103442097-8b74394b95c6") },
  { pattern: /salmon|tartar|deti|seafood|risotto deti/i, url: unsplash("photo-1467003909585-bf5adee770bf") },
  { pattern: /risotto|gnocchi/i, url: unsplash("photo-1476124369491-e7addf5db371") },
  { pattern: /pasta|carbonara|bolognese|spaghetti|truffle pasta/i, url: unsplash("photo-1621996346565-e3dbc646d9a9") },
  { pattern: /tiramisu|cheesecake|bakllava|akullore|gelato|panna|brûlée|brulee|ëmbëls|embels|dessert/i, url: unsplash("photo-1571877227200-a0d98ea607e9") },
];

/** @type {Record<string, string>} */
const CATEGORY_DEFAULTS = {
  pije: unsplash("photo-1629203851122-3726ecdf080e"),
  kafe: unsplash("photo-1514434755162-1ce173684178"),
  kokteje: unsplash("photo-1551538827-9b079410582d"),
  bira: unsplash("photo-1608270587082-7544a4eed7c0"),
  "bira & verë": unsplash("photo-1510814340209-7c0345a615a1"),
  antipasta: unsplash("photo-1572441713132-51a540ae523f"),
  kryesor: unsplash("photo-1546838720-76d91c3903a7"),
  pizza: unsplash("photo-1513104890138-7c749659a591"),
  ëmbëlsira: unsplash("photo-1571877227200-a0d98ea607e9"),
  embelsira: unsplash("photo-1571877227200-a0d98ea607e9"),
};

const GENERIC_FOOD = unsplash("photo-1504674900247-0877df9cc836");

function normalizeCategoryKey(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function photoUrlForMenuItem(name, categoryName = "") {
  const haystack = `${name} ${categoryName}`;
  for (const rule of PHOTO_RULES) {
    if (rule.pattern.test(haystack)) return rule.url;
  }
  const catKey = normalizeCategoryKey(categoryName);
  if (CATEGORY_DEFAULTS[catKey]) return CATEGORY_DEFAULTS[catKey];
  return GENERIC_FOOD;
}
