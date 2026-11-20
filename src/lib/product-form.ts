import {
  formatTaxPercent,
  fractionToPercent,
  percentToFraction,
} from "@/lib/pos-tax-config.ts";

/** Form logic for the Edit Product drawer, kept free of React so it can be tested. */

export type ProductField =
  | "name"
  | "price"
  | "category"
  | "station"
  | "staffPrice"
  | "staffFreeQty"
  | "staffDailyLimit"
  | "stock"
  | "lowStock"
  | "recipe"
  | "sku"
  | "barcode";

/** Field → locale key of the message to show. */
export type ProductFormErrors = Partial<Record<ProductField, string>>;

/** Accepts "3,5" as well as "3.5". Empty or invalid → NaN. */
export function parseDecimal(raw: string): number {
  const s = raw.trim().replace(",", ".");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

function parseWhole(raw: string): number {
  const s = raw.trim();
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

/** 0.085 → "8.5" (one decimal kept, never rounded to a whole percent). */
export function vatPercentFromFraction(rate: number | null | undefined): string {
  const n = Number(rate ?? 0.2);
  return formatTaxPercent(fractionToPercent(Number.isFinite(n) ? n : 0.2));
}

export function vatFractionFromPercent(percent: string): number {
  return percentToFraction(parseDecimal(percent) || 0);
}

/**
 * "opening": tracking starts here, the quantity is saved with the product.
 * "adjust": the product already has stock; a changed quantity is saved as a logged stock set.
 */
export function stockEditMode(
  item: { trackStock?: boolean; currentStock?: number | null } | null | undefined,
): "opening" | "adjust" {
  return item?.trackStock && item.currentStock != null ? "adjust" : "opening";
}

export type ProductFormInput = {
  name: string;
  price: string;
  categoryId?: string;
  needsCategory: boolean;
  station?: string;
  needsStation: boolean;
  staffMealAllowed: boolean;
  staffMealPricingMode: "free" | "custom";
  staffMealCustomPrice: string;
  staffMealFreeQty: string;
  staffMealDailyLimit: string;
  trackStock: boolean;
  stockMode: "opening" | "adjust";
  initialStock: string;
  lowStockThreshold: string;
  recipeLines: { supplyMenuItemId: string; qty: string }[];
  sku?: string;
  barcode?: string;
  /** SKUs / barcodes of the venue's other products (lower-cased). */
  takenSkus?: ReadonlySet<string>;
  takenBarcodes?: ReadonlySet<string>;
};

/**
 * EAN-8 / UPC-A / EAN-13 / GTIN-14 must carry a valid check digit; other in-house codes may use
 * letters, digits and dashes (4–32 characters).
 */
export function isValidBarcode(raw: string): boolean {
  const code = raw.trim();
  if (/^\d+$/.test(code) && [8, 12, 13, 14].includes(code.length)) {
    const digits = code.split("").map(Number);
    const check = digits.pop()!;
    const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === check;
  }
  return /^[A-Za-z0-9-]{4,32}$/.test(code);
}

export function isValidSku(raw: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,31}$/.test(raw.trim());
}

export function validateProductForm(f: ProductFormInput): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!f.name.trim()) errors.name = "menu.err_name";

  const price = parseDecimal(f.price);
  if (!Number.isFinite(price) || price < 0) errors.price = "menu.err_price";

  if (f.needsCategory && !String(f.categoryId ?? "").trim()) errors.category = "menu.err_category";
  if (f.needsStation && f.station !== "kitchen" && f.station !== "bar") {
    errors.station = "menu.item_station_required";
  }

  if (f.staffMealAllowed) {
    const limit = parseWhole(f.staffMealDailyLimit);
    if (f.staffMealDailyLimit.trim() && (!Number.isFinite(limit) || limit < 1)) {
      errors.staffDailyLimit = "menu.err_staff_meal_daily_limit";
    }
    if (f.staffMealPricingMode === "custom") {
      const staffPrice = parseDecimal(f.staffMealCustomPrice);
      if (!Number.isFinite(staffPrice) || staffPrice < 0) errors.staffPrice = "menu.err_staff_meal_price";
      const free = parseWhole(f.staffMealFreeQty);
      if (f.staffMealFreeQty.trim() && !Number.isFinite(free)) {
        errors.staffFreeQty = "menu.err_staff_meal_free_qty_invalid";
      } else if (Number.isFinite(free) && Number.isFinite(limit) && limit > 0 && free > limit) {
        errors.staffFreeQty = "menu.err_staff_meal_free_qty";
      }
    }
  }

  if (f.trackStock) {
    if (f.initialStock.trim()) {
      const stock = parseDecimal(f.initialStock);
      if (!Number.isFinite(stock) || stock < 0) errors.stock = "menu.err_stock_invalid";
    }
    if (f.lowStockThreshold.trim()) {
      const low = parseDecimal(f.lowStockThreshold);
      if (!Number.isFinite(low) || low < 0) errors.lowStock = "menu.err_low_stock_invalid";
    }
  }

  const badRecipeLine = f.recipeLines.some((l) => {
    if (!l.supplyMenuItemId.trim()) return l.qty.trim() !== "";
    const q = parseDecimal(l.qty);
    return !Number.isFinite(q) || q <= 0;
  });
  if (badRecipeLine) errors.recipe = "menu.err_recipe_line";

  const sku = (f.sku ?? "").trim();
  if (sku) {
    if (!isValidSku(sku)) errors.sku = "menu.err_sku_invalid";
    else if (f.takenSkus?.has(sku.toLowerCase())) errors.sku = "menu.err_sku_taken";
  }
  const barcode = (f.barcode ?? "").trim();
  if (barcode) {
    if (!isValidBarcode(barcode)) errors.barcode = "menu.err_barcode_invalid";
    else if (f.takenBarcodes?.has(barcode.toLowerCase())) errors.barcode = "menu.err_barcode_taken";
  }

  return errors;
}

/** Staff-meal columns as stored on `menu_items` (only read when staff meals are allowed). */
export function staffMealPayload(f: Pick<
  ProductFormInput,
  "staffMealAllowed" | "staffMealPricingMode" | "staffMealCustomPrice" | "staffMealFreeQty" | "staffMealDailyLimit"
>): { staffMealPrice?: number; staffMealFreeQty?: number; staffMealDailyLimit?: number } {
  if (!f.staffMealAllowed) return {};
  const limit = parseWhole(f.staffMealDailyLimit);
  const dailyLimit = Number.isFinite(limit) && limit > 0 ? limit : 0;
  if (f.staffMealPricingMode === "free") {
    return { staffMealPrice: 0, staffMealFreeQty: dailyLimit, staffMealDailyLimit: dailyLimit };
  }
  const free = parseWhole(f.staffMealFreeQty);
  return {
    staffMealPrice: Math.max(0, parseDecimal(f.staffMealCustomPrice) || 0),
    staffMealFreeQty: Number.isFinite(free) && free > 0 ? free : 0,
    staffMealDailyLimit: dailyLimit,
  };
}
