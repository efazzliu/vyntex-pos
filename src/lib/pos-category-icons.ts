/**
 * Emoji picker rows (category dialog) + smart defaults from category name when `icon` is empty.
 */

export const CATEGORY_ICON_PICKER: readonly { emoji: string; label: string }[] = [
  { emoji: "🍕", label: "Pizza" },
  { emoji: "🍔", label: "Burger" },
  { emoji: "🍟", label: "Fries" },
  { emoji: "🌭", label: "Hot dog" },
  { emoji: "🥪", label: "Sandwich" },
  { emoji: "🌮", label: "Taco" },
  { emoji: "🌯", label: "Burrito" },
  { emoji: "🥙", label: "Wrap" },
  { emoji: "🍗", label: "Chicken" },
  { emoji: "🍖", label: "Meat / ribs" },
  { emoji: "🥩", label: "Steak" },
  { emoji: "🥓", label: "Bacon / breakfast" },
  { emoji: "🍳", label: "Eggs / breakfast" },
  { emoji: "🥞", label: "Pancakes" },
  { emoji: "🧇", label: "Waffle" },
  { emoji: "🍝", label: "Pasta" },
  { emoji: "🍜", label: "Ramen / noodles" },
  { emoji: "🍲", label: "Soup / stew" },
  { emoji: "🥘", label: "Pan / paella" },
  { emoji: "🍛", label: "Curry / rice bowl" },
  { emoji: "🍱", label: "Bento / combo" },
  { emoji: "🍣", label: "Sushi" },
  { emoji: "🍙", label: "Rice ball" },
  { emoji: "🍚", label: "Rice" },
  { emoji: "🥗", label: "Salad" },
  { emoji: "🥒", label: "Pickles / sides" },
  { emoji: "🥟", label: "Dumplings" },
  { emoji: "🦐", label: "Seafood" },
  { emoji: "🐟", label: "Fish" },
  { emoji: "🦞", label: "Lobster" },
  { emoji: "🥐", label: "Bakery" },
  { emoji: "🥖", label: "Bread" },
  { emoji: "🍞", label: "Toast" },
  { emoji: "🥨", label: "Pretzel / snack" },
  { emoji: "🧀", label: "Cheese" },
  { emoji: "🍰", label: "Cake" },
  { emoji: "🎂", label: "Birthday cake" },
  { emoji: "🧁", label: "Cupcake" },
  { emoji: "🍩", label: "Donut" },
  { emoji: "🍪", label: "Cookie" },
  { emoji: "🍫", label: "Chocolate" },
  { emoji: "🍬", label: "Candy" },
  { emoji: "🍭", label: "Lollipop" },
  { emoji: "🍮", label: "Pudding" },
  { emoji: "🍨", label: "Ice cream" },
  { emoji: "🍧", label: "Shaved ice" },
  { emoji: "☕", label: "Coffee" },
  { emoji: "🫖", label: "Tea pot" },
  { emoji: "🍵", label: "Tea" },
  { emoji: "🧋", label: "Bubble tea" },
  { emoji: "🥤", label: "Soft drink" },
  { emoji: "🧃", label: "Juice box" },
  { emoji: "🥛", label: "Milk / shake" },
  { emoji: "🍺", label: "Beer" },
  { emoji: "🍻", label: "Cheers" },
  { emoji: "🍷", label: "Wine" },
  { emoji: "🥂", label: "Sparkling" },
  { emoji: "🍸", label: "Cocktail" },
  { emoji: "🍹", label: "Cocktail / tropical" },
  { emoji: "🥃", label: "Spirits" },
  { emoji: "🍼", label: "Baby / kids" },
  { emoji: "🧊", label: "Ice / cold" },
  { emoji: "💧", label: "Water" },
  { emoji: "🌶️", label: "Spicy" },
  { emoji: "🧄", label: "Garlic / savory" },
  { emoji: "🧅", label: "Onion" },
  { emoji: "🍄", label: "Mushroom" },
  { emoji: "🥜", label: "Nuts / snacks" },
  { emoji: "🌰", label: "Chestnut" },
  { emoji: "🫒", label: "Olive" },
  { emoji: "🥑", label: "Avocado" },
  { emoji: "🍅", label: "Tomato / veg" },
  { emoji: "🥕", label: "Carrot / veg" },
  { emoji: "🌽", label: "Corn" },
  { emoji: "🫑", label: "Pepper" },
  { emoji: "🥦", label: "Broccoli / healthy" },
  { emoji: "🥬", label: "Greens / vegan" },
  { emoji: "🌱", label: "Vegan / plant" },
  { emoji: "🍴", label: "Dining" },
  { emoji: "🍽️", label: "Plate" },
  { emoji: "⭐", label: "Special" },
  { emoji: "🔥", label: "Popular / spicy" },
];

type Rule = { keys: string[]; emoji: string };

/** Longer / more specific phrases first (first match wins). */
const NAME_RULES: Rule[] = [
  { keys: ["ice cream", "gelato", "akullore"], emoji: "🍨" },
  { keys: ["bubble tea", "boba"], emoji: "🧋" },
  { keys: ["hot dog"], emoji: "🌭" },
  { keys: ["fish and chips"], emoji: "🐟" },
  { keys: ["french fries", "patate", "fries"], emoji: "🍟" },
  { keys: ["ice tea", "iced tea"], emoji: "🍵" },
  { keys: ["breakfast", "mengjes", "mëngjes"], emoji: "🍳" },
  { keys: ["sandwich", "sando"], emoji: "🥪" },
  { keys: ["burrito"], emoji: "🌯" },
  { keys: ["taco", "mexican", "meksik"], emoji: "🌮" },
  { keys: ["sushi", "sashimi", "japan"], emoji: "🍣" },
  { keys: ["ramen", "noodle", "noodles"], emoji: "🍜" },
  { keys: ["spaghetti", "pasta", "italian", "italiane"], emoji: "🍝" },
  { keys: ["pizza", "pica"], emoji: "🍕" },
  { keys: ["burger", "hamburger", "cheeseburger"], emoji: "🍔" },
  { keys: ["chicken", "pulë", "pule", "wings", "krah"], emoji: "🍗" },
  { keys: ["steak", "biftek", "grill", "bbq", "barbekju", "rib"], emoji: "🥩" },
  { keys: ["seafood", "lobster", "karkalec", "shrimp"], emoji: "🦐" },
  { keys: ["fish", "peshk", "salmon", "tuna"], emoji: "🐟" },
  { keys: ["salad", "sallate", "sallatë", "sallata"], emoji: "🥗" },
  { keys: ["soup", "supe", "supë"], emoji: "🍲" },
  { keys: ["curry", "kari"], emoji: "🍛" },
  { keys: ["bento", "combo", "set menu"], emoji: "🍱" },
  { keys: ["rice", "oriz", "pilaf"], emoji: "🍚" },
  { keys: ["dumpling", "gyoza", "ravioli"], emoji: "🥟" },
  { keys: ["bakery", "buke", "bukë", "croissant"], emoji: "🥐" },
  { keys: ["dessert", "ëmbëlsir", "embelsir", "sweet", "torte", "tortë"], emoji: "🍰" },
  { keys: ["cupcake", "muffin"], emoji: "🧁" },
  { keys: ["donut", "doughnut"], emoji: "🍩" },
  { keys: ["cookie", "biskot"], emoji: "🍪" },
  { keys: ["chocolate", "çokollat", "cokollat"], emoji: "🍫" },
  { keys: ["pancake", "waffle"], emoji: "🥞" },
  { keys: ["coffee", "kafe", "espresso", "cappuccino", "latte", "macchiato"], emoji: "☕" },
  { keys: ["tea", "çaj", "caj", "chai"], emoji: "🍵" },
  { keys: ["wine", "verë", "vere", "vino"], emoji: "🍷" },
  { keys: ["beer", "birre", "birrë", "draft"], emoji: "🍺" },
  { keys: ["cocktail", "mocktail", "mojito"], emoji: "🍹" },
  { keys: ["juice", "lëng", "leng", "smoothie", "fruits"], emoji: "🧃" },
  { keys: ["soda", "cola", "soft drink", "energy"], emoji: "🥤" },
  { keys: ["water", "ujë", "uje"], emoji: "💧" },
  { keys: ["drink", "beverage", "pije", "pijet", "beverages"], emoji: "🥤" },
  { keys: ["vegan", "vegetarian", "vegjetarian", "plant"], emoji: "🌱" },
  { keys: ["spicy", "picant", "djegës", "djeges"], emoji: "🌶️" },
  { keys: ["kids", "fëmij", "femij", "children"], emoji: "🍼" },
  { keys: ["snack", "finger food"], emoji: "🥨" },
  { keys: ["wrap", "kebab", "gyros", "souvlaki"], emoji: "🥙" },
];

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Suggest an emoji from the category title when the DB has no `icon` set.
 */
export function emojiForCategoryName(name: string): string | undefined {
  const raw = name.trim().toLowerCase();
  if (!raw) return undefined;
  const n = normalizeForMatch(name);
  const hay = `${raw} ${n}`;
  for (const { keys, emoji } of NAME_RULES) {
    for (const k of keys) {
      const kn = normalizeForMatch(k);
      if (hay.includes(k) || hay.includes(kn) || n.includes(kn)) return emoji;
    }
  }
  return undefined;
}
