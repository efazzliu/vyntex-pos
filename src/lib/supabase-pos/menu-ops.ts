import { supabase } from "@/lib/supabase.ts";
import { isMissingPgColumnError } from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import {
  menuCategoryFromRow,
  menuItemFromRow,
  menuFromRow,
} from "./mappers.ts";
import { normalizeSupplyRecipeForDb } from "./supply-recipe-ops.ts";
import { hasEnterpriseSupplyRecipe } from "@/pages/pos/_lib/plan-features.ts";
import {
  POS_DEFAULT_CURRENCY_DECIMALS,
  POS_DEFAULT_CURRENCY_POSITION,
  POS_DEFAULT_CURRENCY_SYMBOL,
  resolvePosCurrencyDecimals,
  resolvePosCurrencyPosition,
  resolvePosCurrencySymbol,
} from "@/lib/pos-locale-defaults.ts";
import { resolveMenuItemImageUrl } from "@/lib/menu-item-photo-urls.ts";
import { customizationConfigForDb } from "@/lib/menu-customizations.ts";
import { prepConfigForDb } from "@/lib/menu-prep-config.ts";
import {
  getCountryTaxCatalog,
  isVatRateAllowed,
  parsePosTaxSettings,
} from "@/lib/pos-tax-config.ts";
import type { RestaurantRow } from "./restaurant.ts";

function assertVenueVatRate(restaurant: RestaurantRow, vatRate: unknown) {
  if (vatRate === undefined) return;
  const fraction = Number(vatRate);
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error("VAT rate is invalid.");
  }
  if (!getCountryTaxCatalog(restaurant.country)) return;
  const settings = parsePosTaxSettings(restaurant.pos_tax_settings, {
    country: restaurant.country ?? "",
    businessType: restaurant.type ?? "restaurant",
    fallbackVatFraction: Number(restaurant.default_vat_rate ?? 0.2),
  });
  if (!isVatRateAllowed(fraction, settings, {
    country: restaurant.country ?? "",
    businessType: restaurant.type ?? "restaurant",
    fallbackVatFraction: Number(restaurant.default_vat_rate ?? 0.2),
  })) {
    throw new Error(
      "This tax rate is not enabled for this venue's country. Configure Tax & VAT in Settings.",
    );
  }
}

function pgMissingColumnMessage(error: { message?: string }, column: string): boolean {
  const m = String(error.message ?? "").toLowerCase();
  const c = column.toLowerCase();
  if (!m.includes(c)) return false;
  return (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    m.includes("schema cache")
  );
}

function staffMealDbFields(args: Record<string, unknown>): Record<string, unknown> {
  if (args.staffMealAllowed === undefined) return {};
  const allowed = args.staffMealAllowed === true;
  if (!allowed) {
    return {
      staff_meal_allowed: false,
      staff_meal_price: null,
      staff_meal_free_qty: null,
      staff_meal_daily_limit: null,
    };
  }
  const price = Number(args.staffMealPrice);
  const freeQty = Number(args.staffMealFreeQty);
  const dailyLimit = Number(args.staffMealDailyLimit);
  return {
    staff_meal_allowed: true,
    staff_meal_price: Number.isFinite(price) && price >= 0 ? price : 0,
    staff_meal_free_qty:
      Number.isFinite(freeQty) && freeQty > 0 ? Math.floor(freeQty) : 0,
    staff_meal_daily_limit:
      Number.isFinite(dailyLimit) && dailyLimit > 0 ? Math.floor(dailyLimit) : 0,
  };
}

function omitMissingStaffMealColumns(
  payload: Record<string, unknown>,
  error: { message?: string } | null,
): Record<string, unknown> | null {
  if (!error) return null;
  const cols = [
    "staff_meal_allowed",
    "staff_meal_price",
    "staff_meal_free_qty",
    "staff_meal_daily_limit",
  ];
  const next = { ...payload };
  let changed = false;
  for (const col of cols) {
    if (col in next && pgMissingColumnMessage(error, col)) {
      delete next[col];
      changed = true;
    }
  }
  return changed ? next : null;
}

function isRlsViolation(error: { message?: string; code?: string }): boolean {
  const m = String(error.message ?? "").toLowerCase();
  return (
    m.includes("row-level security") ||
    m.includes("violates row-level security") ||
    String(error.code ?? "") === "42501"
  );
}

/** Same naming rules as Convex `ensureSupplyCategory` (menuItems require category_id). */
const SUPPLY_CATEGORY_NAMES = new Set([
  "furnizim",
  "mall",
  "mall kuzhine",
  "mall kuzhinë",
  "stok",
  "stoku",
  "inventory",
]);

function normalizeSupplyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function ensureSupplyCategory(args: { licenseKey: string }) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name")
    .eq("restaurant_id", r.id);

  if (error) throw error;

  for (const row of data ?? []) {
    const rec = row as { id?: string; name?: string };
    const n = rec.name;
    if (
      typeof n === "string" &&
      typeof rec.id === "string" &&
      SUPPLY_CATEGORY_NAMES.has(normalizeSupplyCategoryName(n))
    ) {
      return rec.id;
    }
  }

  return createCategory({
    licenseKey: args.licenseKey,
    name: "Furnizim",
    color: "#0d9488",
    icon: "📦",
  });
}

export async function getCategories(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const { data, error } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("restaurant_id", r.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) =>
    menuCategoryFromRow(row as Parameters<typeof menuCategoryFromRow>[0]),
  );
}

export async function getAllItems(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const { data: cats } = await supabase
    .from("menu_categories")
    .select("id, name")
    .eq("restaurant_id", r.id);
  const categoryNameById = new Map(
    (cats ?? []).map((c) => [String(c.id), String(c.name)]),
  );

  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", r.id)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const item = menuItemFromRow(row as Parameters<typeof menuItemFromRow>[0]);
    return {
      ...item,
      imageUrl: resolveMenuItemImageUrl(
        item,
        categoryNameById.get(item.categoryId) ?? "",
      ),
    };
  });
}

export async function getGuestMenu(restaurantId: string) {
  const id = restaurantId.trim();
  if (!id) throw new Error("missing_venue");

  let venueName = "";
  let currencySymbol = POS_DEFAULT_CURRENCY_SYMBOL;
  let currencyPosition: "prefix" | "suffix" = POS_DEFAULT_CURRENCY_POSITION;
  let currencyDecimals = POS_DEFAULT_CURRENCY_DECIMALS;

  const { data: rest } = await supabase
    .from("restaurants")
    .select(
      "id, name, currency_symbol, currency_position, currency_decimals, license_status",
    )
    .eq("id", id)
    .maybeSingle();

  if (rest) {
    venueName = String(rest.name ?? "").trim();
    currencySymbol = resolvePosCurrencySymbol(rest.currency_symbol);
    currencyPosition = resolvePosCurrencyPosition(rest.currency_position);
    currencyDecimals = resolvePosCurrencyDecimals(rest.currency_decimals);
  }

  const { data: cats, error: cErr } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("restaurant_id", id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (cErr) throw cErr;

  const { data: items, error: iErr } = await supabase
    .from("menu_items")
    .select("*")
    .eq("restaurant_id", id)
    .order("display_order", { ascending: true });
  if (iErr) throw iErr;

  const categories = (cats ?? [])
    .map((row) =>
      menuCategoryFromRow(row as Parameters<typeof menuCategoryFromRow>[0]),
    )
    .filter(
      (c) => !SUPPLY_CATEGORY_NAMES.has(normalizeSupplyCategoryName(c.name)),
    );
  const allowedCats = new Set(categories.map((c) => c._id));
  const categoryNameById = new Map(categories.map((c) => [c._id, c.name]));
  const menuItems = (items ?? [])
    .map((row) => {
      const item = menuItemFromRow(row as Parameters<typeof menuItemFromRow>[0]);
      return {
        ...item,
        imageUrl: resolveMenuItemImageUrl(
          item,
          categoryNameById.get(item.categoryId) ?? "",
        ),
      };
    })
    .filter((i) => i.available && allowedCats.has(i.categoryId));

  return {
    venueName,
    currencySymbol,
    currencyPosition,
    currencyDecimals,
    categories,
    items: menuItems,
  };
}

export async function getMenus(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const { data, error } = await supabase
    .from("pos_menus")
    .select("*")
    .eq("restaurant_id", r.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) =>
    menuFromRow(row as Parameters<typeof menuFromRow>[0]),
  );
}

export async function createCategory(args: {
  licenseKey: string;
  name: string;
  color: string;
  icon?: string;
  prepConfig?: unknown;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { count } = await supabase
    .from("menu_categories")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", r.id);

  const prepNorm = prepConfigForDb(args.prepConfig as never);
  const base: Record<string, unknown> = {
    restaurant_id: r.id,
    name: args.name.trim(),
    color: args.color,
    display_order: (count ?? 0) + 1,
    is_active: true,
  };
  const withIcon =
    args.icon !== undefined && String(args.icon).trim() !== ""
      ? { ...base, icon: String(args.icon).trim() }
      : base;
  const withPrep =
    prepNorm !== undefined ? { ...withIcon, prep_config: prepNorm } : withIcon;

  const { data, error } = await writeCategoryDroppingMissingColumns(withPrep, (payload) =>
    supabase.from("menu_categories").insert(payload).select("id").single(),
  );

  if (error) throw error;
  return (data as { id: string }).id;
}

/** Older venues may lack `icon` / `prep_config`; retry without each missing column. */
const OPTIONAL_CATEGORY_COLUMNS = ["prep_config", "icon"] as const;

async function writeCategoryDroppingMissingColumns<T>(
  payload: Record<string, unknown>,
  write: (payload: Record<string, unknown>) => PromiseLike<{ data: T; error: { message?: string } | null }>,
): Promise<{ data: T; error: { message?: string } | null }> {
  let current = { ...payload };
  for (;;) {
    const result = await write(current);
    if (!result.error) return result;
    const missing = OPTIONAL_CATEGORY_COLUMNS.find(
      (column) =>
        column in current &&
        (pgMissingColumnMessage(result.error!, column) ||
          isMissingPgColumnError(result.error!.message ?? "", column)),
    );
    if (!missing) return result;
    const { [missing]: _dropped, ...rest } = current;
    current = rest;
  }
}

export async function updateCategory(args: {
  licenseKey: string;
  categoryId: string;
  name: string;
  color: string;
  icon?: string;
  isActive?: boolean;
  prepConfig?: unknown;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const patch: Record<string, unknown> = {
    name: args.name.trim(),
    color: args.color,
    is_active: args.isActive ?? true,
  };
  if (args.icon !== undefined) {
    patch.icon = String(args.icon).trim() || null;
  }
  const prepNorm = prepConfigForDb(args.prepConfig as never);
  if (prepNorm !== undefined) {
    patch.prep_config = prepNorm;
  }

  const { error } = await writeCategoryDroppingMissingColumns(patch, (payload) =>
    supabase.from("menu_categories").update(payload).eq("id", args.categoryId),
  );

  if (error) throw error;
}

export async function deleteCategory(args: {
  licenseKey: string;
  categoryId: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("menu_categories")
    .delete()
    .eq("id", args.categoryId);
  if (error) throw error;
}

function assertMenuItemStation(
  station: unknown,
): asserts station is "kitchen" | "bar" {
  if (station !== "kitchen" && station !== "bar") {
    throw new Error(
      "Station must be kitchen or bar. / Stacioni duhet të jetë kuzhinë ose bar.",
    );
  }
}

function parseImageUrlArg(args: Record<string, unknown>): string | null | undefined {
  if (args.imageUrl !== undefined) {
    const url = args.imageUrl;
    if (url === null) return null;
    const trimmed = String(url).trim();
    return trimmed || null;
  }
  return undefined;
}

export async function createItem(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  const { materializeMenuItemImageUrlArg } = await import(
    "@/lib/supabase-pos/menu-photo-storage.ts"
  );
  args = await materializeMenuItemImageUrlArg(args);
  const r = await getRestaurantByLicense(licenseKey);
  assertMenuItemStation(args.station);
  assertVenueVatRate(r, args.vatRate);

  const { data: orderRow } = await supabase
    .from("menu_items")
    .select("display_order")
    .eq("restaurant_id", r.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const displayOrderFallback =
    (args.displayOrder as number) ??
    (orderRow?.display_order != null ? Number(orderRow.display_order) + 1 : 0);

  const payload: Record<string, unknown> = {
    restaurant_id: r.id,
    category_id: args.categoryId as string,
    menu_id: (args.menuId as string) ?? null,
    name: (args.name as string).trim(),
    description: (args.description as string) ?? null,
    price: args.price as number,
    available: (args.available as boolean) ?? true,
    display_order: displayOrderFallback,
    station: args.station as string,
    vat_rate: (args.vatRate as number) ?? (r.default_vat_rate ?? 0.2),
    is_favorite: (args.isFavorite as boolean) ?? false,
    ...staffMealDbFields(args),
    track_stock: (args.trackStock as boolean) ?? false,
    stock_unit: (args.stockUnit as string) ?? null,
    current_stock: (args.currentStock as number) ?? null,
    low_stock_threshold: (args.lowStockThreshold as number) ?? null,
  };

  const imageUrl = parseImageUrlArg(args);
  if (imageUrl !== undefined) {
    payload.image_url = imageUrl;
  }

  const recipeNorm = normalizeSupplyRecipeForDb(args.supplyRecipe);
  if (
    recipeNorm !== undefined &&
    hasEnterpriseSupplyRecipe(r.plan) &&
    recipeNorm.length > 0
  ) {
    payload.supply_recipe = recipeNorm;
  }

  const customizationNorm = customizationConfigForDb(
    args.customizationConfig as never,
  );
  if (customizationNorm !== undefined) {
    payload.customization_config = customizationNorm;
  }

  const prepNorm = prepConfigForDb(args.prepConfig as never);
  if (prepNorm !== undefined) {
    payload.prep_config = prepNorm;
  }

  let { data, error } = await supabase
    .from("menu_items")
    .insert(payload)
    .select("id")
    .single();

  if (error && pgMissingColumnMessage(error, "supply_recipe")) {
    const { supply_recipe: _sr, ...withoutRecipe } = payload;
    ({ data, error } = await supabase
      .from("menu_items")
      .insert(withoutRecipe)
      .select("id")
      .single());
  }

  if (error && pgMissingColumnMessage(error, "customization_config")) {
    const { customization_config: _cc, ...withoutCustom } = payload;
    ({ data, error } = await supabase
      .from("menu_items")
      .insert(withoutCustom)
      .select("id")
      .single());
  }

  if (error && pgMissingColumnMessage(error, "prep_config")) {
    const { prep_config: _pc, ...withoutPrep } = payload;
    ({ data, error } = await supabase
      .from("menu_items")
      .insert(withoutPrep)
      .select("id")
      .single());
  }

  const withoutStaffMeal = omitMissingStaffMealColumns(payload, error);
  if (withoutStaffMeal) {
    ({ data, error } = await supabase
      .from("menu_items")
      .insert(withoutStaffMeal)
      .select("id")
      .single());
  }

  if (error) {
    if (isRlsViolation(error)) {
      throw new Error(
        "Supabase RLS bllokon insert te menu_items. Ekzekuto supabase/ensure_pos_menu_tables.sql (politikat pos_dev_menu_items). / Row-level security blocked saving the menu item.",
      );
    }
    throw error;
  }
  return data!.id as string;
}

export async function updateItem(args: Record<string, unknown>) {
  const { materializeMenuItemImageUrlArg } = await import(
    "@/lib/supabase-pos/menu-photo-storage.ts"
  );
  args = await materializeMenuItemImageUrlArg(args);
  const r = await getRestaurantByLicense(args.licenseKey as string);
  assertMenuItemStation(args.station);
  assertVenueVatRate(r, args.vatRate);

  const patch: Record<string, unknown> = {
    name: args.name,
    description: args.description,
    price: args.price,
    available: args.available,
    display_order: args.displayOrder,
    station: args.station,
    category_id: args.categoryId,
    menu_id: args.menuId,
    is_favorite: args.isFavorite,
    ...staffMealDbFields(args),
    track_stock: args.trackStock,
    stock_unit: args.stockUnit,
    current_stock: args.currentStock,
    low_stock_threshold: args.lowStockThreshold,
  };
  if (args.vatRate !== undefined) {
    patch.vat_rate = args.vatRate;
  }

  const imageUrl = parseImageUrlArg(args);
  if (imageUrl !== undefined) {
    patch.image_url = imageUrl;
  }

  const recipeNormUpdate = normalizeSupplyRecipeForDb(args.supplyRecipe);
  if (recipeNormUpdate !== undefined) {
    patch.supply_recipe = hasEnterpriseSupplyRecipe(r.plan)
      ? recipeNormUpdate
      : [];
  }

  const customizationNormUpdate = customizationConfigForDb(
    args.customizationConfig as never,
  );
  if (customizationNormUpdate !== undefined) {
    patch.customization_config = customizationNormUpdate;
  }

  const prepNormUpdate = prepConfigForDb(args.prepConfig as never);
  if (prepNormUpdate !== undefined) {
    patch.prep_config = prepNormUpdate;
  }

  Object.keys(patch).forEach((k) => {
    if (patch[k] === undefined) delete patch[k];
  });
  let { error } = await supabase
    .from("menu_items")
    .update(patch)
    .eq("id", args.itemId as string);

  if (error && pgMissingColumnMessage(error, "supply_recipe")) {
    const { supply_recipe: _sr, ...withoutRecipe } = patch;
    ({ error } = await supabase
      .from("menu_items")
      .update(withoutRecipe)
      .eq("id", args.itemId as string));
  }

  if (error && pgMissingColumnMessage(error, "customization_config")) {
    const { customization_config: _cc, ...withoutCustom } = patch;
    ({ error } = await supabase
      .from("menu_items")
      .update(withoutCustom)
      .eq("id", args.itemId as string));
  }

  if (error && pgMissingColumnMessage(error, "prep_config")) {
    const { prep_config: _pc, ...withoutPrep } = patch;
    ({ error } = await supabase
      .from("menu_items")
      .update(withoutPrep)
      .eq("id", args.itemId as string));
  }

  const withoutStaffMealPatch = omitMissingStaffMealColumns(patch, error);
  if (withoutStaffMealPatch) {
    ({ error } = await supabase
      .from("menu_items")
      .update(withoutStaffMealPatch)
      .eq("id", args.itemId as string));
  }

  if (error) {
    if (isRlsViolation(error)) {
      throw new Error(
        "Supabase RLS bllokon përditësimin e menu_items. Ekzekuto supabase/ensure_pos_menu_tables.sql. / Row-level security blocked updating the menu item.",
      );
    }
    throw error;
  }
}

export async function deleteItem(args: {
  licenseKey: string;
  itemId: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", args.itemId);
  if (error) throw error;
}

export async function toggleItemAvailability(args: {
  licenseKey: string;
  itemId: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data: row } = await supabase
    .from("menu_items")
    .select("available")
    .eq("id", args.itemId)
    .eq("restaurant_id", r.id)
    .single();
  if (!row) return;
  await supabase
    .from("menu_items")
    .update({ available: !row.available })
    .eq("id", args.itemId)
    .eq("restaurant_id", r.id);
}

export async function createMenu(args: { licenseKey: string; name: string }) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { count } = await supabase
    .from("pos_menus")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", r.id);
  const { data, error } = await supabase
    .from("pos_menus")
    .insert({
      restaurant_id: r.id,
      name: args.name.trim(),
      display_order: (count ?? 0) + 1,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

export async function deleteMenu(args: {
  licenseKey: string;
  menuId: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase.from("pos_menus").delete().eq("id", args.menuId);
  if (error) throw error;
}

export async function updateMenu(args: {
  licenseKey: string;
  menuId: string;
  name: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("pos_menus")
    .update({ name: args.name.trim() })
    .eq("id", args.menuId);
  if (error) throw error;
}

export async function generateUploadUrl(_args: Record<string, unknown>) {
  throw new Error(
    "Ngarkimi i fotove përdor Supabase Storage direkt. / Menu photos upload directly via Supabase Storage.",
  );
}
