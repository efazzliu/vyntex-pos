import { supabase } from "@/lib/supabase.ts";
import { assertNoPgError } from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { getCategories, getAllItems } from "./menu-ops.ts";

export async function getStockItems(licenseKey: string) {
  const [categories, items] = await Promise.all([
    getCategories(licenseKey),
    getAllItems(licenseKey),
  ]);
  const catMap = new Map(categories.map((c) => [c._id, c]));
  const trackedItems = items.filter((i) => i.trackStock);

  const enriched = trackedItems.map((item) => {
    const category = item.categoryId ? catMap.get(item.categoryId) : undefined;
    const current = item.currentStock ?? 0;
    const lowTh = item.lowStockThreshold;
    const isLowStock =
      lowTh !== undefined && current > 0 && current <= lowTh;
    const isOutOfStock = current <= 0;
    return {
      ...item,
      categoryName: category?.name ?? "Unknown",
      categoryColor: category?.color ?? "#5a6580",
      isLowStock,
      isOutOfStock,
    };
  });

  return enriched.sort((a, b) => {
    if (a.isOutOfStock !== b.isOutOfStock) return a.isOutOfStock ? -1 : 1;
    if (a.isLowStock !== b.isLowStock) return a.isLowStock ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

type MenuStockRow = {
  id: string;
  restaurant_id: string;
  current_stock: number | string | null;
  track_stock: boolean | null;
  low_stock_threshold: number | string | null;
};

async function loadTrackedMenuItem(
  licenseKey: string,
  itemId: string,
): Promise<{ restaurantId: string; row: MenuStockRow }> {
  const r = await getRestaurantByLicense(licenseKey);
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, restaurant_id, current_stock, track_stock, low_stock_threshold")
    .eq("id", itemId)
    .eq("restaurant_id", r.id)
    .maybeSingle();
  assertNoPgError("Load menu item", error);
  if (!data) throw new Error("Item not found");
  if (!data.track_stock) {
    throw new Error("Stock tracking is not enabled for this item");
  }
  return { restaurantId: r.id, row: data as MenuStockRow };
}

async function getLastStockLog(itemId: string, restaurantId: string) {
  const { data, error } = await supabase
    .from("pos_stock_logs")
    .select("type, change, created_at")
    .eq("menu_item_id", itemId)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function addStock(args: {
  licenseKey: string;
  itemId: string;
  quantity: number;
  staffName: string;
  note?: string;
}): Promise<number> {
  const { restaurantId, row } = await loadTrackedMenuItem(
    args.licenseKey,
    args.itemId,
  );
  if (args.quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  const last = await getLastStockLog(args.itemId, restaurantId);
  if (last) {
    const timeSinceLastMs =
      Date.now() - new Date(last.created_at as string).getTime();
    if (
      timeSinceLastMs < 200 &&
      last.type === "manual_addition" &&
      Number(last.change) === args.quantity
    ) {
      throw new Error(
        "Duplicate entry detected. Please wait a moment before adding the same quantity again.",
      );
    }
  }

  const previousStock = Number(row.current_stock ?? 0);
  const newStock = previousStock + args.quantity;

  const { error: upErr } = await supabase
    .from("menu_items")
    .update({ current_stock: newStock })
    .eq("id", args.itemId);
  assertNoPgError("Update stock", upErr);

  const { error: logErr } = await supabase.from("pos_stock_logs").insert({
    restaurant_id: restaurantId,
    menu_item_id: args.itemId,
    staff_name: args.staffName,
    type: "manual_addition",
    change: args.quantity,
    balance_after: newStock,
    note: args.note?.trim() || null,
  });
  assertNoPgError("Log stock change", logErr);

  return newStock;
}

export async function removeStock(args: {
  licenseKey: string;
  itemId: string;
  quantity: number;
  staffName: string;
  note?: string;
}): Promise<number> {
  const { restaurantId, row } = await loadTrackedMenuItem(
    args.licenseKey,
    args.itemId,
  );
  if (args.quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  const last = await getLastStockLog(args.itemId, restaurantId);
  if (last) {
    const timeSinceLastMs =
      Date.now() - new Date(last.created_at as string).getTime();
    if (
      timeSinceLastMs < 200 &&
      last.type === "adjustment" &&
      Number(last.change) === -args.quantity
    ) {
      throw new Error(
        "Duplicate entry detected. Please wait a moment before removing the same quantity again.",
      );
    }
  }

  const previousStock = Number(row.current_stock ?? 0);
  const newStock = previousStock - args.quantity;

  const { error: upErr } = await supabase
    .from("menu_items")
    .update({ current_stock: newStock })
    .eq("id", args.itemId);
  assertNoPgError("Update stock", upErr);

  const { error: logErr } = await supabase.from("pos_stock_logs").insert({
    restaurant_id: restaurantId,
    menu_item_id: args.itemId,
    staff_name: args.staffName,
    type: "adjustment",
    change: -args.quantity,
    balance_after: newStock,
    note: args.note?.trim() || null,
  });
  assertNoPgError("Log stock change", logErr);

  return newStock;
}

export async function setStock(args: {
  licenseKey: string;
  itemId: string;
  newStock: number;
  staffName: string;
  note?: string;
}): Promise<number> {
  const { restaurantId, row } = await loadTrackedMenuItem(
    args.licenseKey,
    args.itemId,
  );
  const previousStock = Number(row.current_stock ?? 0);
  const change = args.newStock - previousStock;

  const { error: upErr } = await supabase
    .from("menu_items")
    .update({ current_stock: args.newStock })
    .eq("id", args.itemId);
  assertNoPgError("Update stock", upErr);

  const noteText =
    args.note?.trim() ||
    `Set from ${previousStock} to ${args.newStock}`;

  const { error: logErr } = await supabase.from("pos_stock_logs").insert({
    restaurant_id: restaurantId,
    menu_item_id: args.itemId,
    staff_name: args.staffName,
    type: "manual_set",
    change,
    balance_after: args.newStock,
    note: noteText,
  });
  assertNoPgError("Log stock change", logErr);

  return args.newStock;
}

export async function getAllLogs(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const { data, error } = await supabase
    .from("pos_stock_logs")
    .select("*")
    .eq("restaurant_id", r.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return [];

  const rows = data ?? [];
  const itemIds = [
    ...new Set(
      rows
        .map((row) => row.menu_item_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const names: Record<string, string> = {};
  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("menu_items")
      .select("id, name")
      .in("id", itemIds);
    for (const it of items ?? []) {
      names[it.id] = it.name;
    }
  }

  return rows.map((row) => ({
    _id: row.id,
    menuItemId: row.menu_item_id,
    staffName: row.staff_name,
    type: row.type,
    change: Number(row.change),
    balanceAfter: Number(row.balance_after),
    note: row.note,
    createdAt: row.created_at,
    itemName: row.menu_item_id
      ? (names[row.menu_item_id as string] ?? "Deleted item")
      : "Deleted item",
  }));
}

export async function getItemLogs(args: {
  licenseKey: string;
  menuItemId: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("pos_stock_logs")
    .select("*")
    .eq("restaurant_id", r.id)
    .eq("menu_item_id", args.menuItemId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];

  return (data ?? []).map((row) => ({
    _id: row.id,
    menuItemId: row.menu_item_id,
    staffName: row.staff_name,
    type: row.type,
    change: Number(row.change),
    balanceAfter: Number(row.balance_after),
    note: row.note,
    createdAt: row.created_at,
  }));
}
