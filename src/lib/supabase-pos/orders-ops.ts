import { supabase } from "@/lib/supabase.ts";
import {
  assertNoPgError,
  isMissingPgColumnError,
  isPgCheckConstraintError,
} from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { isLocalDevicePosAdmin, staffIdsEqual, uuidOrNull } from "./uuid.ts";
import {
  displayOrderNumber,
  saleFloorTableId,
  saleToOrderDoc,
} from "./mappers.ts";
import { insertAuditLog } from "./dashboard-ops.ts";
import {
  getFloorTableNameOrUnknown,
  isPostgrestExposeOrCacheError,
  updateFloorTableStatusSafe,
} from "./floor-sync.ts";
import { isOpenSaleStatus, loadOpenSalesForTable } from "./tables-ops.ts";
import { assertStaffPermission } from "./staff-auth.ts";
import { applySupplyRecipeAfterSale } from "./supply-recipe-ops.ts";
import {
  customizationPriceDelta,
  mergeNotesWithCustomizations,
  normalizeSelectedCustomizations,
  type SelectedCustomization,
} from "@/lib/menu-customizations.ts";
import {
  parsePosStockRules,
  stockRulesFromRestaurantRow,
  type OrderAvailabilityRules,
} from "@/lib/pos-order-availability.ts";
import type { RestaurantRow } from "./restaurant.ts";

/** Hidden on replaced lines so the order list does not treat a swap as a delete. */
const REPLACED_LINE_MARK = "⟦pos:replaced⟧";
const RETURNED_LINE_MARK = "⟦pos:returned⟧";
/** Set when current_stock was deducted at send so pay/waste do not deduct twice. */
const STOCK_COMMITTED_MARK = "⟦pos:stock⟧";

function saleLineWasReplaced(notes: string | null | undefined): boolean {
  const n = String(notes ?? "");
  return n.includes(REPLACED_LINE_MARK) || n.includes(RETURNED_LINE_MARK);
}

function notesWithMark(
  notes: string | null | undefined,
  mark: string,
): string {
  const cur = String(notes ?? "");
  if (cur.includes(mark)) return cur;
  const trimmed = cur.trim();
  return trimmed ? `${trimmed}\n${mark}` : mark;
}

function notesWithReplacedMark(notes: string | null | undefined): string {
  return notesWithMark(notes, REPLACED_LINE_MARK);
}

function notesWithReturnedMark(notes: string | null | undefined): string {
  return notesWithMark(notes, RETURNED_LINE_MARK);
}

function notesWithoutReplacedMark(
  notes: string | null | undefined,
): string | undefined {
  const s = String(notes ?? "")
    .split("\n")
    .filter(
      (line) =>
        line.trim() !== REPLACED_LINE_MARK &&
        line.trim() !== RETURNED_LINE_MARK &&
        line.trim() !== STOCK_COMMITTED_MARK,
    )
    .join("\n")
    .replaceAll(REPLACED_LINE_MARK, "")
    .replaceAll(RETURNED_LINE_MARK, "")
    .replaceAll(STOCK_COMMITTED_MARK, "")
    .trim();
  return s || undefined;
}

function saleLineStockCommitted(notes: string | null | undefined): boolean {
  return String(notes ?? "").includes(STOCK_COMMITTED_MARK);
}

function notesWithStockCommittedMark(
  notes: string | null | undefined,
): string {
  return notesWithMark(notes, STOCK_COMMITTED_MARK);
}

function itemRowToDoc(r: {
  id: string;
  sale_id: string;
  menu_item_id: string | null;
  name: string;
  price: number | string;
  quantity: number | string;
  notes: string | null;
  station: string | null;
  status: string;
  vat_rate: number | string | null;
  created_at?: string | null;
  selected_customizations?: unknown;
}) {
  const selectedCustomizations = normalizeSelectedCustomizations(
    r.selected_customizations,
  );
  return {
    _id: r.id,
    orderId: r.sale_id,
    menuItemId: r.menu_item_id ?? "",
    name: r.name,
    price: Number(r.price),
    quantity: Number(r.quantity),
    notes: notesWithoutReplacedMark(r.notes),
    station: (r.station as "kitchen" | "bar" | undefined) ?? undefined,
    status: r.status,
    vatRate: r.vat_rate != null ? Number(r.vat_rate) : 0.2,
    createdAt: r.created_at ?? undefined,
    replaced: saleLineWasReplaced(r.notes),
    ...(selectedCustomizations.length > 0 ? { selectedCustomizations } : {}),
  };
}

async function recalcSaleTotals(saleId: string) {
  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("price, quantity, status")
    .eq("sale_id", saleId);
  assertNoPgError("Recalc sale lines", itemsErr);
  let subtotal = 0;
  for (const it of items ?? []) {
    const st = String(it.status ?? "");
    if (st === "cancelled" || st === "voided") continue;
    subtotal += Number(it.price) * Number(it.quantity);
  }
  const tax = 0;
  const total = subtotal;
  const { error: saleErr } = await supabase
    .from("sales")
    .update({ subtotal, tax, total })
    .eq("id", saleId);
  assertNoPgError("Recalc sale totals", saleErr);
}

function parseSettledSaleItemIds(args: Record<string, unknown>): string[] {
  const raw = args.settledSaleItemIds;
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter(Boolean);
}

type SettledSaleQty = { id: string; quantity: number | null };

function parseSettledSaleQuantities(
  args: Record<string, unknown>,
): SettledSaleQty[] {
  const rawItems = args.settledSaleItems;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const merged = new Map<string, number>();
    for (const x of rawItems) {
      if (!x || typeof x !== "object") continue;
      const rec = x as Record<string, unknown>;
      const id = String(rec.id ?? "").trim();
      const qty = Number(rec.quantity);
      if (!id || !Number.isFinite(qty) || qty <= 0) continue;
      merged.set(id, (merged.get(id) ?? 0) + qty);
    }
    return [...merged.entries()].map(([id, quantity]) => ({ id, quantity }));
  }
  return parseSettledSaleItemIds(args).map((id) => ({ id, quantity: null }));
}

function buildSettledLinePlan(
  lineById: Map<string, Record<string, unknown>>,
  orderId: string,
  allocations: SettledSaleQty[],
): {
  settledSum: number;
  stockRows: Record<string, unknown>[];
  deleteIds: string[];
  reduce: { id: string; nextQty: number }[];
  settledIds: string[];
} {
  let settledSum = 0;
  const stockRows: Record<string, unknown>[] = [];
  const deleteIds: string[] = [];
  const reduce: { id: string; nextQty: number }[] = [];
  const settledIds: string[] = [];
  const qtyEps = 0.0005;

  for (const alloc of allocations) {
    const row = lineById.get(alloc.id);
    if (!row) throw new Error("Invalid sale line for split payment");
    if (String(row.sale_id) !== String(orderId)) {
      throw new Error("Sale line does not belong to this order");
    }
    const st = String(row.status ?? "");
    if (st === "cancelled" || st === "voided") {
      throw new Error("Cannot pay a cancelled or voided line");
    }
    const lineQty = Number(row.quantity);
    if (!Number.isFinite(lineQty) || lineQty <= 0) {
      throw new Error("Invalid sale line quantity");
    }
    const take =
      alloc.quantity == null ? lineQty : Math.min(lineQty, alloc.quantity);
    if (!Number.isFinite(take) || take <= 0) {
      throw new Error("Invalid settle quantity");
    }
    if (alloc.quantity != null && alloc.quantity - take > qtyEps) {
      throw new Error("Settle quantity exceeds the line");
    }
    settledSum += Number(row.price) * take;
    stockRows.push({ ...row, quantity: take });
    settledIds.push(alloc.id);
    if (take >= lineQty - qtyEps) deleteIds.push(alloc.id);
    else {
      reduce.push({
        id: alloc.id,
        nextQty: Math.round((lineQty - take) * 1000) / 1000,
      });
    }
  }

  return {
    settledSum: Math.round(settledSum * 100) / 100,
    stockRows,
    deleteIds,
    reduce,
    settledIds,
  };
}

async function applySettledLinePlan(
  plan: ReturnType<typeof buildSettledLinePlan>,
  orderId: string,
) {
  if (plan.deleteIds.length > 0) {
    const { error: delErr } = await supabase
      .from("sale_items")
      .delete()
      .in("id", plan.deleteIds);
    assertNoPgError("Remove paid sale lines", delErr);
  }
  for (const row of plan.reduce) {
    const { error: upErr } = await supabase
      .from("sale_items")
      .update({ quantity: row.nextQty })
      .eq("id", row.id);
    assertNoPgError("Reduce paid sale line quantity", upErr);
  }
  await recalcSaleTotals(orderId);
}

/** Stock + total_sold for lines being paid (before rows are deleted on split). */
async function applyStockSoldForSaleItemRows(
  restaurantId: string,
  lines: Array<Record<string, unknown>>,
  staffName: string,
  orderLabel: string,
  menuIdBySnapshot: Map<string, string> | null,
  licenseKey: string,
) {
  const qtyByMenuId = new Map<string, number>();
  const qtyDeductByMenuId = new Map<string, number>();
  for (const it of lines) {
    const st = String(it.status ?? "");
    if (st === "cancelled" || st === "voided") continue;
    const rawFk = it.menu_item_id as string | null | undefined;
    const fk =
      rawFk && String(rawFk).trim() !== ""
        ? String(rawFk).trim()
        : menuIdBySnapshot?.get(
            saleLineLookupKey(String(it.name ?? ""), Number(it.price)),
          ) ?? null;
    if (!fk) continue;
    const qty = Number(it.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    qtyByMenuId.set(fk, (qtyByMenuId.get(fk) ?? 0) + qty);
    if (!saleLineStockCommitted(it.notes as string | null | undefined)) {
      qtyDeductByMenuId.set(fk, (qtyDeductByMenuId.get(fk) ?? 0) + qty);
    }
  }
  if (qtyByMenuId.size === 0) return;

  const fks = [...qtyByMenuId.keys()];
  const { data: menuRows, error: menuLoadErr } = await supabase
    .from("menu_items")
    .select("id, total_sold, track_stock, current_stock")
    .in("id", fks);
  assertNoPgError("Load menu items for partial pay stock", menuLoadErr);
  const miById = new Map((menuRows ?? []).map((m) => [String(m.id), m]));

  const stockLogRows: Record<string, unknown>[] = await Promise.all(
    fks.map(async (fk) => {
      const qty = qtyByMenuId.get(fk) ?? 0;
      const mi = miById.get(fk);
      if (!mi) return null;

      const prevSold = Number(mi.total_sold ?? 0);
      const prevStock = Number(mi.current_stock ?? 0);
      const track = Boolean(mi.track_stock);

      const deductQty = qtyDeductByMenuId.get(fk) ?? 0;
      const updates: Record<string, unknown> = { total_sold: prevSold + qty };
      let balanceAfter = prevStock;
      if (track && deductQty > 0) {
        balanceAfter = Math.max(0, prevStock - deductQty);
        updates.current_stock = balanceAfter;
      }

      const { error: upErr } = await supabase
        .from("menu_items")
        .update(updates)
        .eq("id", fk);
      assertNoPgError("Update menu item after partial line pay", upErr);

      if (track && deductQty > 0) {
        return {
          restaurant_id: restaurantId,
          menu_item_id: fk,
          staff_name: staffName,
          type: "sale" as const,
          change: -deductQty,
          balance_after: balanceAfter,
          note: `Order ${orderLabel}`,
        };
      }
      return null;
    }),
  ).then((rows) => rows.filter((x): x is NonNullable<typeof x> => x != null));

  if (stockLogRows.length > 0) {
    const { error: batchLogErr } = await supabase
      .from("pos_stock_logs")
      .insert(stockLogRows);
    assertNoPgError("Log stock sale (partial split)", batchLogErr);
  }

  await applySupplyRecipeAfterSale({
    restaurantId,
    qtyByMenuItemId: qtyDeductByMenuId,
    staffName,
    contextNote: `Order ${orderLabel}`,
    licenseKey,
  });
}

/** Deduct tracked stock for wasted/sent lines. Never goes below 0. */
async function deductTrackedStockClamped(args: {
  licenseKey: string;
  staffName: string;
  note: string;
  logType: string;
  lines: Array<{
    menu_item_id?: string | null;
    quantity?: number | string;
    status?: string | null;
    notes?: string | null;
  }>;
}): Promise<void> {
  const r = await getRestaurantByLicense(args.licenseKey);
  const qtyByMenuId = new Map<string, number>();
  for (const it of args.lines) {
    if (saleLineIsUnsent(it.status)) continue;
    if (saleLineStockCommitted(it.notes)) continue;
    const fk = String(it.menu_item_id ?? "").trim();
    if (!fk) continue;
    const qty = Number(it.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    qtyByMenuId.set(fk, (qtyByMenuId.get(fk) ?? 0) + qty);
  }
  if (qtyByMenuId.size === 0) return;

  const fks = [...qtyByMenuId.keys()];
  const { data: menuRows, error: menuLoadErr } = await supabase
    .from("menu_items")
    .select("id, track_stock, current_stock")
    .in("id", fks);
  assertNoPgError("Load menu items for waste stock", menuLoadErr);
  const miById = new Map((menuRows ?? []).map((m) => [String(m.id), m]));

  const stockLogRows: Record<string, unknown>[] = [];
  for (const fk of fks) {
    const qty = qtyByMenuId.get(fk) ?? 0;
    const mi = miById.get(fk);
    if (!mi || !mi.track_stock) continue;
    const prevStock = Number(mi.current_stock ?? 0);
    const balanceAfter = Math.max(0, prevStock - qty);
    const { error: upErr } = await supabase
      .from("menu_items")
      .update({ current_stock: balanceAfter })
      .eq("id", fk);
    assertNoPgError("Deduct waste stock", upErr);
    stockLogRows.push({
      restaurant_id: r.id,
      menu_item_id: fk,
      staff_name: args.staffName,
      type: args.logType,
      change: -(prevStock - balanceAfter),
      balance_after: balanceAfter,
      note: args.note,
    });
  }
  if (stockLogRows.length > 0) {
    const { error: logErr } = await supabase
      .from("pos_stock_logs")
      .insert(stockLogRows);
    assertNoPgError("Log waste stock", logErr);
  }
}

function orderAvailabilityRulesFromRestaurant(
  r: RestaurantRow,
): OrderAvailabilityRules {
  return {
    honorKitchenStop: r.pos_enforce_availability === true,
    blockOutOfStock: parsePosStockRules(stockRulesFromRestaurantRow(r)).blockOutOfStock,
  };
}

/**
 * Deduct current_stock when items are sent to kitchen/bar.
 * Throws UNAVAILABLE_STOCK if blocking is on and there is not enough left.
 */
async function commitTrackedStockOnSend(args: {
  licenseKey: string;
  staffName: string;
  note: string;
  lines: Array<{
    menu_item_id?: string | null;
    quantity?: number | string;
    name?: string | null;
  }>;
}): Promise<Map<string, number>> {
  const r = await getRestaurantByLicense(args.licenseKey);
  const blockOutOfStock =
    orderAvailabilityRulesFromRestaurant(r).blockOutOfStock;
  const qtyByMenuId = new Map<string, number>();
  for (const it of args.lines) {
    const fk = String(it.menu_item_id ?? "").trim();
    if (!fk) continue;
    const qty = Number(it.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    qtyByMenuId.set(fk, (qtyByMenuId.get(fk) ?? 0) + qty);
  }
  if (qtyByMenuId.size === 0) return qtyByMenuId;

  const fks = [...qtyByMenuId.keys()];
  const { data: menuRows, error: menuLoadErr } = await supabase
    .from("menu_items")
    .select("id, name, track_stock, current_stock")
    .in("id", fks);
  assertNoPgError("Load menu items for send stock", menuLoadErr);
  const miById = new Map((menuRows ?? []).map((m) => [String(m.id), m]));

  for (const fk of fks) {
    const qty = qtyByMenuId.get(fk) ?? 0;
    const mi = miById.get(fk);
    if (!mi || !mi.track_stock) continue;
    const prevStock = Number(mi.current_stock ?? 0);
    const name = String(mi.name ?? fk);
    if (
      blockOutOfStock &&
      (!Number.isFinite(prevStock) || prevStock < qty)
    ) {
      throw new Error(`UNAVAILABLE_STOCK:${name}`);
    }
  }

  const stockLogRows: Record<string, unknown>[] = [];
  for (const fk of fks) {
    const qty = qtyByMenuId.get(fk) ?? 0;
    const mi = miById.get(fk);
    if (!mi || !mi.track_stock) continue;
    const prevStock = Number.isFinite(Number(mi.current_stock ?? 0))
      ? Number(mi.current_stock ?? 0)
      : 0;
    const balanceAfter = prevStock - qty;
    const { error: upErr } = await supabase
      .from("menu_items")
      .update({ current_stock: balanceAfter })
      .eq("id", fk);
    assertNoPgError("Deduct stock on send", upErr);
    stockLogRows.push({
      restaurant_id: r.id,
      menu_item_id: fk,
      staff_name: args.staffName,
      type: "sale",
      change: -qty,
      balance_after: balanceAfter,
      note: args.note,
    });
  }
  if (stockLogRows.length > 0) {
    const { error: logErr } = await supabase
      .from("pos_stock_logs")
      .insert(stockLogRows);
    assertNoPgError("Log stock on send", logErr);
  }

  await applySupplyRecipeAfterSale({
    restaurantId: r.id,
    qtyByMenuItemId: qtyByMenuId,
    staffName: args.staffName,
    contextNote: args.note,
    licenseKey: args.licenseKey,
  });
  return qtyByMenuId;
}

/** Put tracked stock back (return / replace of a sent line). */
async function restoreTrackedStock(args: {
  licenseKey: string;
  staffName: string;
  note: string;
  logType: string;
  qtyByMenuId: Map<string, number>;
}): Promise<void> {
  if (args.qtyByMenuId.size === 0) return;
  const r = await getRestaurantByLicense(args.licenseKey);
  const fks = [...args.qtyByMenuId.keys()];
  const { data: menuRows, error: menuLoadErr } = await supabase
    .from("menu_items")
    .select("id, track_stock, current_stock")
    .in("id", fks);
  assertNoPgError("Load menu items for stock restore", menuLoadErr);
  const miById = new Map((menuRows ?? []).map((m) => [String(m.id), m]));

  const stockLogRows: Record<string, unknown>[] = [];
  for (const fk of fks) {
    const qty = args.qtyByMenuId.get(fk) ?? 0;
    if (qty <= 0) continue;
    const mi = miById.get(fk);
    if (!mi || !mi.track_stock) continue;
    const prevStock = Number(mi.current_stock ?? 0);
    const balanceAfter = prevStock + qty;
    const { error: upErr } = await supabase
      .from("menu_items")
      .update({ current_stock: balanceAfter })
      .eq("id", fk);
    assertNoPgError("Restore tracked stock", upErr);
    stockLogRows.push({
      restaurant_id: r.id,
      menu_item_id: fk,
      staff_name: args.staffName,
      type: args.logType,
      change: qty,
      balance_after: balanceAfter,
      note: args.note,
    });
  }
  if (stockLogRows.length > 0) {
    const { error: logErr } = await supabase
      .from("pos_stock_logs")
      .insert(stockLogRows);
    assertNoPgError("Log stock restore", logErr);
  }
}

type SaleItemInsertRow = {
  sale_id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  menu_item_id: string | null;
  station: string | null;
  vat_rate: number;
  selected_customizations?: SelectedCustomization[];
  status?: string;
};

function saleItemToInsertShapes(args: SaleItemInsertRow) {
  const minimal: Record<string, unknown> = {
    sale_id: args.sale_id,
    name: args.name,
    price: args.price,
    quantity: args.quantity,
    notes: args.notes,
    status: args.status ?? "pending",
  };
  const withVatStation: Record<string, unknown> = {
    ...minimal,
    vat_rate: args.vat_rate,
  };
  if (args.station) withVatStation.station = args.station;

  const full: Record<string, unknown> = { ...withVatStation };
  if (args.menu_item_id) full.menu_item_id = args.menu_item_id;
  if (args.selected_customizations?.length) {
    full.selected_customizations = args.selected_customizations;
  }
  return { minimal, withVatStation, full };
}

/** PostgREST cache may lag migration 002 (`menu_item_id`, `station`, `vat_rate`). */
async function insertSaleItemWithSchemaFallback(
  args: SaleItemInsertRow,
): Promise<void> {
  const { minimal, withVatStation, full } = saleItemToInsertShapes(args);

  let { error } = await supabase.from("sale_items").insert(full);
  if (error && isPostgrestExposeOrCacheError(error.message)) {
    const withoutCustom = { ...full };
    delete withoutCustom.selected_customizations;
    ({ error } = await supabase.from("sale_items").insert(withoutCustom));
  }
  if (error && isPostgrestExposeOrCacheError(error.message)) {
    console.warn("[POS] sale_items full insert (retry without menu_item_id):", error.message);
    ({ error } = await supabase.from("sale_items").insert(withVatStation));
  }
  if (error && isPostgrestExposeOrCacheError(error.message)) {
    console.warn("[POS] sale_items mid insert (bootstrap columns only):", error.message);
    ({ error } = await supabase.from("sale_items").insert(minimal));
  }
  assertNoPgError("Add line to order", error);
}

/** One round-trip for many lines (was N sequential menu + insert pairs). */
async function insertSaleItemsBatchWithSchemaFallback(
  rows: SaleItemInsertRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const shapes = rows.map(saleItemToInsertShapes);
  const fullRows = shapes.map((s) => s.full);

  let { error } = await supabase.from("sale_items").insert(fullRows);
  if (error && isPostgrestExposeOrCacheError(error.message)) {
    const withoutCustom = fullRows.map((row) => {
      const next = { ...row };
      delete next.selected_customizations;
      return next;
    });
    ({ error } = await supabase.from("sale_items").insert(withoutCustom));
  }
  if (error && isPostgrestExposeOrCacheError(error.message)) {
    console.warn(
      "[POS] sale_items batch full insert (retry without menu_item_id):",
      error.message,
    );
    ({ error } = await supabase
      .from("sale_items")
      .insert(shapes.map((s) => s.withVatStation)));
  }
  if (error && isPostgrestExposeOrCacheError(error.message)) {
    console.warn(
      "[POS] sale_items batch mid insert (bootstrap columns only):",
      error.message,
    );
    ({ error } = await supabase
      .from("sale_items")
      .insert(shapes.map((s) => s.minimal)));
  }
  assertNoPgError("Add lines to order (batch)", error);
}

/**
 * Human order # per restaurant (1, 2, 3…). Fills `sales.order_number` when null
 * so the UI does not fall back to UUID-derived pseudo-numbers.
 */
async function assignDisplayOrderNumberIfMissing(
  saleId: string,
  restaurantId: string,
): Promise<void> {
  const { data: self, error: sErr } = await supabase
    .from("sales")
    .select("order_number")
    .eq("id", saleId)
    .maybeSingle();
  if (sErr || !self) return;
  if (self.order_number != null && Number(self.order_number) > 0) return;

  const { data: peak, error: pErr } = await supabase
    .from("sales")
    .select("order_number")
    .eq("restaurant_id", restaurantId)
    .not("order_number", "is", null)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pErr) {
    if (isMissingPgColumnError(pErr.message, "order_number")) return;
    return;
  }

  const next =
    peak?.order_number != null && Number(peak.order_number) > 0
      ? Number(peak.order_number) + 1
      : 1;

  const { error: uErr } = await supabase
    .from("sales")
    .update({ order_number: next })
    .eq("id", saleId)
    .is("order_number", null);

  if (uErr && !isMissingPgColumnError(uErr.message, "order_number")) {
    console.warn("[POS] assign order_number failed", uErr.message);
  }
}

export async function getOrdersByTable(args: {
  licenseKey: string;
  tableId: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  let rows = await loadOpenSalesForTable(r.id, args.tableId);
  for (const row of rows) {
    const id = (row as { id: string }).id;
    if (id) await assignDisplayOrderNumberIfMissing(id, r.id);
  }
  rows = await loadOpenSalesForTable(r.id, args.tableId);
  return rows.map((row) =>
    saleToOrderDoc(row as Parameters<typeof saleToOrderDoc>[0]),
  );
}

export type KitchenQueueLine = {
  lineId: string;
  saleId: string;
  orderNumber: number;
  tableId?: string;
  tableName: string;
  name: string;
  quantity: number;
  notes?: string;
  station?: "kitchen" | "bar";
  status: string;
  /** When the line was sent / created (pressed to kitchen). */
  createdAt: string;
  /** When kitchen marked the line ready (if tracked). */
  readyAt?: string;
};

/**
 * Active tickets for kitchen / bar display (items sent but not yet marked ready).
 */
export async function getKitchenQueue(args: {
  licenseKey: string;
}): Promise<KitchenQueueLine[]> {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data: sales, error: sErr } = await supabase
    .from("sales")
    .select("id, order_number, status, table_id, table_ref, created_at")
    .eq("restaurant_id", r.id)
    .in("status", ["open", "sent-to-kitchen"]);

  assertNoPgError("Kitchen queue sales", sErr);
  const saleRows = sales ?? [];
  if (saleRows.length === 0) return [];

  const saleIds = saleRows.map((x) => String(x.id));
  const saleById = new Map(
    saleRows.map((row) => [String(row.id), row] as const),
  );

  const selectWithStation = supabase
    .from("sale_items")
    .select("id, sale_id, name, quantity, notes, station, status, created_at")
    .in("sale_id", saleIds)
    .in("status", ["sent", "preparing"]);
  let itemsRes = await selectWithStation;
  let rowsMissingStation = false;
  if (
    itemsRes.error &&
    isMissingPgColumnError(itemsRes.error.message, "station")
  ) {
    rowsMissingStation = true;
    console.warn(
      "[POS] sale_items.station column missing; kitchen queue treats all lines as kitchen.",
    );
    itemsRes = await supabase
      .from("sale_items")
      .select("id, sale_id, name, quantity, notes, status, created_at")
      .in("sale_id", saleIds)
      .in("status", ["sent", "preparing"]);
  }
  assertNoPgError("Kitchen queue items", itemsRes.error);
  const items = itemsRes.data;

  const floorIds = [
    ...new Set(
      saleRows
        .map((row) => saleFloorTableId(row as Parameters<typeof saleFloorTableId>[0]))
        .filter((id) => id.length > 0),
    ),
  ];
  const tableNameById = new Map<string, string>();
  if (floorIds.length > 0) {
    const { data: tblRows, error: tErr } = await supabase
      .from("pos_floor_tables")
      .select("id, name")
      .in("id", floorIds);
    if (!tErr) {
      for (const t of tblRows ?? []) {
        tableNameById.set(String(t.id), String(t.name ?? "Table"));
      }
    }
  }

  const out: KitchenQueueLine[] = [];
  for (const it of items ?? []) {
    const sid = String(it.sale_id ?? "");
    const sale = saleById.get(sid);
    if (!sale) continue;
    const fid = saleFloorTableId(sale as Parameters<typeof saleFloorTableId>[0]);
    const tableName = fid ? (tableNameById.get(fid) ?? "Table") : "—";
    const on = displayOrderNumber(
      sid,
      (sale as { order_number?: number | null }).order_number,
    );
    const station = rowsMissingStation
      ? undefined
      : ((it as { station?: string | null }).station as
          | "kitchen"
          | "bar"
          | null
          | undefined) ?? undefined;
    out.push({
      lineId: String(it.id),
      saleId: sid,
      orderNumber: on,
      tableId: fid || undefined,
      tableName,
      name: String(it.name ?? ""),
      quantity: Number(it.quantity),
      notes: (it.notes as string | null) ?? undefined,
      station,
      status: String(it.status ?? ""),
      createdAt: String(it.created_at ?? ""),
    });
  }

  out.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return out;
}

/**
 * Waiter phone notifications: kitchen station lines only (sent/preparing/ready)
 * for open tickets that belong to this waiter (grouped by table in the UI).
 */
export async function getWaiterKitchenNotifications(args: {
  licenseKey: string;
  staffId?: string;
}): Promise<KitchenQueueLine[]> {
  const waiterId = uuidOrNull(args.staffId);
  if (!waiterId) return [];

  const r = await getRestaurantByLicense(args.licenseKey);
  const { data: sales, error: sErr } = await supabase
    .from("sales")
    .select("id, order_number, status, table_id, table_ref, created_at, staff_id")
    .eq("restaurant_id", r.id)
    .in("status", ["open", "sent-to-kitchen"]);

  assertNoPgError("Waiter kitchen notifications sales", sErr);
  const saleRows = (sales ?? []).filter((row) =>
    staffIdsEqual(
      (row as { staff_id?: string | null }).staff_id,
      waiterId,
    ),
  );
  if (saleRows.length === 0) return [];

  const saleIds = saleRows.map((x) => String(x.id));
  const saleById = new Map(
    saleRows.map((row) => [String(row.id), row] as const),
  );

  let rowsMissingStation = false;
  let rowsMissingReadyAt = false;
  const selectCols = (withStation: boolean, withReadyAt: boolean) => {
    const base = withStation
      ? "id, sale_id, name, quantity, notes, station, status, created_at"
      : "id, sale_id, name, quantity, notes, status, created_at";
    return withReadyAt ? `${base}, ready_at` : base;
  };

  let itemsRes = await supabase
    .from("sale_items")
    .select(selectCols(true, true))
    .in("sale_id", saleIds)
    .in("status", ["sent", "preparing", "ready"]);

  if (
    itemsRes.error &&
    isMissingPgColumnError(itemsRes.error.message, "ready_at")
  ) {
    rowsMissingReadyAt = true;
    itemsRes = await supabase
      .from("sale_items")
      .select(selectCols(true, false))
      .in("sale_id", saleIds)
      .in("status", ["sent", "preparing", "ready"]);
  }
  if (
    itemsRes.error &&
    isMissingPgColumnError(itemsRes.error.message, "station")
  ) {
    rowsMissingStation = true;
    itemsRes = await supabase
      .from("sale_items")
      .select(selectCols(false, !rowsMissingReadyAt))
      .in("sale_id", saleIds)
      .in("status", ["sent", "preparing", "ready"]);
    if (
      itemsRes.error &&
      isMissingPgColumnError(itemsRes.error.message, "ready_at")
    ) {
      rowsMissingReadyAt = true;
      itemsRes = await supabase
        .from("sale_items")
        .select(selectCols(false, false))
        .in("sale_id", saleIds)
        .in("status", ["sent", "preparing", "ready"]);
    }
  }
  assertNoPgError("Waiter kitchen notifications items", itemsRes.error);
  const items = itemsRes.data;

  // Resolve station from menu when sale_items.station is missing/null (common in older DBs).
  const stationByMenuName = new Map<string, "kitchen" | "bar">();
  {
    const { data: menuRows, error: mErr } = await supabase
      .from("menu_items")
      .select("name, station")
      .eq("restaurant_id", r.id);
    if (!mErr) {
      for (const m of menuRows ?? []) {
        const nameKey = String(m.name ?? "")
          .trim()
          .toLowerCase();
        const st = String(m.station ?? "").toLowerCase();
        if (!nameKey) continue;
        if (st === "kitchen" || st === "bar") {
          stationByMenuName.set(nameKey, st);
        }
      }
    }
  }

  const floorIds = [
    ...new Set(
      saleRows
        .map((row) => saleFloorTableId(row as Parameters<typeof saleFloorTableId>[0]))
        .filter((id) => id.length > 0),
    ),
  ];
  const tableNameById = new Map<string, string>();
  if (floorIds.length > 0) {
    const { data: tblRows, error: tErr } = await supabase
      .from("pos_floor_tables")
      .select("id, name")
      .in("id", floorIds);
    if (!tErr) {
      for (const t of tblRows ?? []) {
        tableNameById.set(String(t.id), String(t.name ?? "Table"));
      }
    }
  }

  const out: KitchenQueueLine[] = [];
  for (const it of items ?? []) {
    const sid = String(it.sale_id ?? "");
    const sale = saleById.get(sid);
    if (!sale) continue;
    const fid = saleFloorTableId(sale as Parameters<typeof saleFloorTableId>[0]);
    const tableName = fid ? (tableNameById.get(fid) ?? "Table") : "—";
    const on = displayOrderNumber(
      sid,
      (sale as { order_number?: number | null }).order_number,
    );
    const itemName = String(it.name ?? "");
    const fromRow = rowsMissingStation
      ? undefined
      : ((it as { station?: string | null }).station as
          | "kitchen"
          | "bar"
          | null
          | undefined) ?? undefined;
    const fromMenu = stationByMenuName.get(itemName.trim().toLowerCase());
    const station: "kitchen" | "bar" | undefined =
      fromRow === "kitchen" || fromRow === "bar"
        ? fromRow
        : fromMenu;

    // Waiter notifications: kitchen tickets only (never bar).
    if (station !== "kitchen") continue;

    const readyRaw = rowsMissingReadyAt
      ? null
      : ((it as { ready_at?: string | null }).ready_at ?? null);
    const readyAt =
      readyRaw && String(readyRaw).trim() !== ""
        ? String(readyRaw)
        : undefined;

    out.push({
      lineId: String(it.id),
      saleId: sid,
      orderNumber: on,
      tableId: fid || undefined,
      tableName,
      name: itemName,
      quantity: Number(it.quantity),
      notes: (it.notes as string | null) ?? undefined,
      station: "kitchen",
      status: String(it.status ?? ""),
      createdAt: String(it.created_at ?? ""),
      readyAt,
    });
  }

  // Ready first (newest ready first), then cooking (oldest first).
  out.sort((a, b) => {
    const aReady = a.status === "ready" ? 0 : 1;
    const bReady = b.status === "ready" ? 0 : 1;
    if (aReady !== bReady) return aReady - bReady;
    const aTs = new Date(
      aReady === 0 ? (a.readyAt || a.createdAt) : a.createdAt,
    ).getTime();
    const bTs = new Date(
      bReady === 0 ? (b.readyAt || b.createdAt) : b.createdAt,
    ).getTime();
    return aReady === 0 ? bTs - aTs : aTs - bTs;
  });
  return out;
}

export async function bumpKitchenTicketItem(args: {
  licenseKey: string;
  lineId: string;
  saleId: string;
}): Promise<void> {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data: sale, error: sErr } = await supabase
    .from("sales")
    .select("id, restaurant_id")
    .eq("id", args.saleId)
    .single();
  assertNoPgError("Bump kitchen: load sale", sErr);
  if (!sale || String(sale.restaurant_id) !== r.id) {
    throw new Error("Order not found");
  }

  const { data: line, error: lErr } = await supabase
    .from("sale_items")
    .select("id, sale_id, status")
    .eq("id", args.lineId)
    .single();
  assertNoPgError("Bump kitchen: load line", lErr);
  if (!line || String(line.sale_id) !== args.saleId) {
    throw new Error("Line not found");
  }
  const st = String(line.status ?? "");
  if (st !== "sent" && st !== "preparing") {
    throw new Error("Item is not on the kitchen queue");
  }

  const readyAt = new Date().toISOString();
  let { error: uErr } = await supabase
    .from("sale_items")
    .update({ status: "ready", ready_at: readyAt })
    .eq("id", args.lineId);
  if (uErr && isMissingPgColumnError(uErr.message, "ready_at")) {
    ({ error: uErr } = await supabase
      .from("sale_items")
      .update({ status: "ready" })
      .eq("id", args.lineId));
  }
  assertNoPgError("Bump kitchen: update line", uErr);
}

/**
 * Waiter optional ack: mark a ready kitchen line as delivered to the table.
 */
export async function markWaiterLineDelivered(args: {
  licenseKey: string;
  lineId: string;
  saleId: string;
}): Promise<void> {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data: sale, error: sErr } = await supabase
    .from("sales")
    .select("id, restaurant_id")
    .eq("id", args.saleId)
    .single();
  assertNoPgError("Deliver line: load sale", sErr);
  if (!sale || String(sale.restaurant_id) !== r.id) {
    throw new Error("Order not found");
  }

  const { data: line, error: lErr } = await supabase
    .from("sale_items")
    .select("id, sale_id, status")
    .eq("id", args.lineId)
    .single();
  assertNoPgError("Deliver line: load line", lErr);
  if (!line || String(line.sale_id) !== args.saleId) {
    throw new Error("Line not found");
  }
  if (String(line.status ?? "").toLowerCase() !== "ready") {
    throw new Error("Item is not ready for delivery");
  }

  const servedAt = new Date().toISOString();
  let { error: uErr } = await supabase
    .from("sale_items")
    .update({ status: "served", served_at: servedAt })
    .eq("id", args.lineId);
  if (uErr && isMissingPgColumnError(uErr.message, "served_at")) {
    ({ error: uErr } = await supabase
      .from("sale_items")
      .update({ status: "served" })
      .eq("id", args.lineId));
  }
  assertNoPgError("Deliver line: update line", uErr);
}

function saleRowMatchesTable(
  sale: { table_ref?: unknown; table_id?: unknown },
  tableId: string,
): boolean {
  const tid = String(tableId).trim();
  if (!tid) return false;
  const ref = String(sale.table_ref ?? "").trim();
  if (ref === tid) return true;
  const uuidLo =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tid,
    )
      ? tid.trim().toLowerCase()
      : null;
  if (uuidLo && ref.toLowerCase() === uuidLo) return true;
  const saleTid =
    sale.table_id != null ? String(sale.table_id).trim().toLowerCase() : "";
  if (uuidLo && saleTid === uuidLo) return true;
  return false;
}

/** Insert empty open sale + floor sync (shared by createOrder and submitCartOrder). */
async function insertNewOpenSale(args: {
  restaurantId: string;
  tableId: string;
  staffId: string;
}): Promise<string> {
  const staffId = uuidOrNull(args.staffId);
  const tableUuid = uuidOrNull(args.tableId);
  const insertRow: Record<string, unknown> = {
    restaurant_id: args.restaurantId,
    table_ref: args.tableId,
    staff_id: staffId,
    status: "open",
    subtotal: 0,
    tax: 0,
    total: 0,
  };
  if (tableUuid) insertRow.table_id = tableUuid;

  const { data, error } = await supabase
    .from("sales")
    .insert(insertRow)
    .select("id")
    .single();

  assertNoPgError("Create order", error);
  const id = data!.id as string;

  await Promise.all([
    assignDisplayOrderNumberIfMissing(id, args.restaurantId),
    updateFloorTableStatusSafe(
      args.tableId,
      "occupied",
      "Mark table occupied",
    ),
  ]);

  return id;
}

export async function createOrder(args: {
  licenseKey: string;
  tableId: string;
  staffId: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  return insertNewOpenSale({
    restaurantId: r.id,
    tableId: args.tableId,
    staffId: args.staffId,
  });
}

/**
 * Claim an unclaimed sale for this waiter, or verify they already own it.
 * Device admin (`staffId` not a UUID) skips enforcement so managers can help.
 */
async function assertSaleStaffCanEdit(saleId: string, staffId: string): Promise<void> {
  const sid = uuidOrNull(staffId);
  if (!sid) return;

  const { data: row, error } = await supabase
    .from("sales")
    .select("staff_id")
    .eq("id", saleId)
    .maybeSingle();
  assertNoPgError("Load sale for staff assignment", error);

  const raw = row?.staff_id;
  const existing =
    raw != null && String(raw).trim() !== ""
      ? uuidOrNull(String(raw))
      : null;

  if (!existing) {
    const { error: upErr } = await supabase
      .from("sales")
      .update({ staff_id: sid })
      .eq("id", saleId);
    assertNoPgError("Assign waiter to order", upErr);
    return;
  }

  if (existing.toLowerCase() !== sid.toLowerCase()) {
    throw new Error("This order belongs to another waiter.");
  }
}

/** Same as `assertSaleStaffCanEdit` but reuses `staff_id` from an already-loaded `sales` row (saves one round-trip). */
async function assertSaleStaffCanEditFromLoadedSale(
  saleId: string,
  staffId: string,
  loadedStaffId: unknown,
): Promise<void> {
  const sid = uuidOrNull(staffId);
  if (!sid) return;

  const raw = loadedStaffId;
  const existing =
    raw != null && String(raw).trim() !== ""
      ? uuidOrNull(String(raw))
      : null;

  if (!existing) {
    const { error: upErr } = await supabase
      .from("sales")
      .update({ staff_id: sid })
      .eq("id", saleId);
    assertNoPgError("Assign waiter to order", upErr);
    return;
  }

  if (existing.toLowerCase() !== sid.toLowerCase()) {
    throw new Error("This order belongs to another waiter.");
  }
}

async function staffRoleAllowsOrderOverride(staffId: string): Promise<boolean> {
  const sid = uuidOrNull(staffId);
  if (!sid) return true;
  const { data, error } = await supabase
    .from("staff")
    .select("role")
    .eq("id", sid)
    .maybeSingle();
  if (error || !data) return false;
  const r = String(data.role ?? "").toLowerCase();
  return r === "admin" || r === "manager";
}

/** Waiter must own the sale unless they are admin/manager (or device admin). */
async function assertSaleStaffCanEditForTableMove(
  saleId: string,
  staffId: string,
): Promise<void> {
  if (await staffRoleAllowsOrderOverride(staffId)) return;
  await assertSaleStaffCanEdit(saleId, staffId);
}

export type OrderLineInput = {
  menuItemId: string;
  quantity: number;
  notes?: string;
  name?: string;
  price?: number;
  station?: "kitchen" | "bar";
  vatRate?: number;
  selectedCustomizations?: SelectedCustomization[];
};

type MenuItemSnap = {
  id: string;
  name: string;
  price: number | string;
  station: string | null;
  vat_rate: number | string | null;
};

function resolveLineToSaleItemRow(
  orderId: string,
  line: OrderLineInput,
  menuById: Map<string, MenuItemSnap>,
): SaleItemInsertRow {
  const mi = menuById.get(line.menuItemId);
  const name = (mi?.name ?? line.name)?.trim();
  const basePrice =
    mi != null ? Number(mi.price) : line.price != null ? Number(line.price) : NaN;
  const delta = customizationPriceDelta(line.selectedCustomizations);
  const resolvedPrice =
    line.price != null && Number.isFinite(Number(line.price))
      ? Number(line.price)
      : basePrice + delta;
  const price = resolvedPrice;
  if (!name || !Number.isFinite(price)) {
    throw new Error(
      "Menu item not found. Refresh the menu screen (cached items may use old ids after switching to Supabase).",
    );
  }

  const station = mi?.station ?? line.station ?? null;
  const vatRate =
    mi?.vat_rate != null ? Number(mi.vat_rate) : (line.vatRate ?? 0.2);
  const menuItemFk = mi?.id ?? uuidOrNull(line.menuItemId);
  const selected = normalizeSelectedCustomizations(line.selectedCustomizations);
  const notes =
    mergeNotesWithCustomizations(selected, line.notes) ?? line.notes ?? null;

  return {
    sale_id: orderId,
    name,
    price,
    quantity: line.quantity,
    notes,
    menu_item_id: menuItemFk,
    station,
    vat_rate: Number.isFinite(vatRate) ? vatRate : 0.2,
    ...(selected.length > 0 ? { selected_customizations: selected } : {}),
  };
}

async function insertOneOrderLine(
  orderId: string,
  line: OrderLineInput,
): Promise<void> {
  const { data: mi, error: miErr } = await supabase
    .from("menu_items")
    .select("id, name, price, station, vat_rate")
    .eq("id", line.menuItemId)
    .maybeSingle();

  if (miErr) {
    if (isPostgrestExposeOrCacheError(miErr.message)) {
      console.warn(
        "[POS] menu_items not in API schema; using cart snapshot:",
        miErr.message,
      );
    } else {
      assertNoPgError("Load menu item", miErr);
    }
  }

  const menuById = new Map<string, MenuItemSnap>();
  if (mi) menuById.set(line.menuItemId, mi as MenuItemSnap);
  const row = resolveLineToSaleItemRow(orderId, line, menuById);
  await insertSaleItemWithSchemaFallback(row);
}

/** Bulk insert cart lines + totals (caller handles license + staff assert when needed). */
async function insertOrderLinesAndRecalc(
  orderId: string,
  lines: OrderLineInput[],
): Promise<void> {
  if (lines.length === 0) return;

  const uniqueIds = [...new Set(lines.map((l) => l.menuItemId).filter(Boolean))];
  const menuById = new Map<string, MenuItemSnap>();

  if (uniqueIds.length > 0) {
    const { data: menuRows, error: menuErr } = await supabase
      .from("menu_items")
      .select("id, name, price, station, vat_rate")
      .in("id", uniqueIds);

    if (menuErr) {
      if (isPostgrestExposeOrCacheError(menuErr.message)) {
        console.warn(
          "[POS] menu_items batch load failed; using line snapshots where needed:",
          menuErr.message,
        );
      } else {
        assertNoPgError("Load menu items for order", menuErr);
      }
    }
    for (const m of menuRows ?? []) {
      menuById.set(m.id as string, m as MenuItemSnap);
    }
  }

  const insertRows: SaleItemInsertRow[] = lines.map((line) =>
    resolveLineToSaleItemRow(orderId, line, menuById),
  );
  await insertSaleItemsBatchWithSchemaFallback(insertRows);
  await recalcSaleTotals(orderId);
}

async function assertMenuLinesOrderable(
  licenseKey: string,
  lines: OrderLineInput[],
) {
  const r = await getRestaurantByLicense(licenseKey);
  const rules = orderAvailabilityRulesFromRestaurant(r);

  const qtyById = new Map<string, number>();
  for (const line of lines) {
    const id = String(line.menuItemId ?? "").trim();
    if (!id) continue;
    const q = Number(line.quantity ?? 0);
    if (!Number.isFinite(q) || q <= 0) continue;
    qtyById.set(id, (qtyById.get(id) ?? 0) + q);
  }
  if (qtyById.size === 0) return;

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, available, track_stock, current_stock")
    .eq("restaurant_id", r.id)
    .in("id", [...qtyById.keys()]);
  assertNoPgError("Check item availability", error);

  const byId = new Map((data ?? []).map((row) => [String(row.id), row]));
  for (const [id, qty] of qtyById) {
    const row = byId.get(id);
    const name = String(row?.name ?? id);
    if (rules.honorKitchenStop && (!row || row.available === false)) {
      throw new Error(`UNAVAILABLE_STOPPED:${name}`);
    }
    if (
      rules.blockOutOfStock &&
      row?.track_stock &&
      Number(row.current_stock ?? 0) < qty
    ) {
      throw new Error(`UNAVAILABLE_STOCK:${name}`);
    }
  }
}

/** One round-trip recalc after all lines (faster than addItemToOrder per line). */
export async function addItemsToOrderBulk(args: {
  licenseKey: string;
  orderId: string;
  lines: OrderLineInput[];
  /** When set, claims the sale for this waiter if `staff_id` is still null (shows table on others' floor plans). */
  staffId?: string;
  /** Optional; used client-side for targeted TanStack invalidation only. */
  tableId?: string;
}) {
  void args.tableId;
  await getRestaurantByLicense(args.licenseKey);
  if (args.staffId) {
    await assertSaleStaffCanEdit(args.orderId, args.staffId);
  }
  await assertMenuLinesOrderable(args.licenseKey, args.lines);
  await insertOrderLinesAndRecalc(args.orderId, args.lines);
}

export async function addItemToOrder(
  args: {
    licenseKey: string;
    orderId: string;
  } & OrderLineInput,
) {
  await getRestaurantByLicense(args.licenseKey);
  await assertMenuLinesOrderable(args.licenseKey, [args]);
  await insertOneOrderLine(args.orderId, args);
  await recalcSaleTotals(args.orderId);
}

type MarkSentArgs = {
  licenseKey: string;
  orderId: string;
  staffId?: string;
  staffName?: string;
  /** Optional; client-side cache invalidation only. */
  tableId?: string;
  /** Cart lines with menu ids — used when sale_items.menu_item_id is missing from schema cache. */
  stockLines?: OrderLineInput[];
};

type PendingSendRow = {
  id: string;
  station?: string | null;
  name?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  notes?: string | null;
  menu_item_id?: string | null;
};

async function loadPendingItemsToSend(orderId: string): Promise<PendingSendRow[]> {
  const attempts = [
    "id, station, name, quantity, price, notes, menu_item_id",
    "id, name, quantity, price, notes, menu_item_id",
    "id, station, name, quantity, price, notes",
    "id, name, quantity, price, notes",
    "id, name, quantity, price",
  ];
  let lastErr: { message: string } | null = null;
  for (const sel of attempts) {
    const res = await supabase
      .from("sale_items")
      .select(sel)
      .eq("sale_id", orderId)
      .eq("status", "pending");
    if (!res.error) {
      return (res.data ?? []).map((r) => ({
        id: String(r.id),
        station: (r as { station?: string | null }).station ?? null,
        name: (r as { name?: string | null }).name ?? null,
        quantity: (r as { quantity?: number | string | null }).quantity ?? 0,
        price: (r as { price?: number | string | null }).price ?? 0,
        notes: (r as { notes?: string | null }).notes ?? null,
        menu_item_id: (r as { menu_item_id?: string | null }).menu_item_id ?? null,
      }));
    }
    lastErr = res.error;
    const msg = res.error.message;
    const retryable =
      isPostgrestExposeOrCacheError(msg) ||
      isMissingPgColumnError(msg, "station") ||
      isMissingPgColumnError(msg, "menu_item_id") ||
      isMissingPgColumnError(msg, "notes");
    if (!retryable) {
      assertNoPgError("Load items to send", res.error);
    }
  }
  assertNoPgError("Load items to send", lastErr);
  return [];
}

/**
 * Mark pending lines sent + kitchen status (no license / staff checks — caller must validate).
 */
async function executeMarkOrderSentToKitchen(args: MarkSentArgs): Promise<{
  kitchenItems: number;
  barItems: number;
  ticketOrderRef: string;
}> {
  void args.tableId;

  const [saleRow, pending] = await Promise.all([
    (async () => {
      let saleRes = await supabase
        .from("sales")
        .select("id, order_number, staff_id, table_id, table_ref")
        .eq("id", args.orderId)
        .single();
      if (
        saleRes.error &&
        isMissingPgColumnError(saleRes.error.message, "order_number")
      ) {
        console.warn(
          "[POS] sales.order_number missing; ticket uses derived #. Apply supabase/ensure_sales_order_number.sql if you want DB order numbers.",
        );
        saleRes = await supabase
          .from("sales")
          .select("id, staff_id, table_id, table_ref")
          .eq("id", args.orderId)
          .single();
      }
      assertNoPgError("Load sale for send", saleRes.error);
      const row = saleRes.data;
      if (!row) throw new Error("Order not found");
      return row;
    })(),
    loadPendingItemsToSend(args.orderId),
  ]);

  if (!pending.length) {
    throw new Error("No new items to send");
  }

  let kitchenItems = 0;
  let barItems = 0;
  for (const row of pending) {
    if (row.station === "bar") barItems += 1;
    else kitchenItems += 1;
  }

  const lineRows: {
    id: string;
    name: string;
    quantity: number | string;
    price: number | string;
    station: string | null;
    notes: string | null;
  }[] = pending.map((row) => ({
    id: row.id,
    name: String(row.name ?? ""),
    quantity: row.quantity ?? 0,
    price: row.price ?? 0,
    station: (row.station as string | null) ?? null,
    notes: row.notes ?? null,
  }));

  let staffName = (args.staffName ?? "").trim();
  if (!staffName) {
    const sid =
      uuidOrNull(args.staffId) ?? uuidOrNull(saleRow.staff_id ?? undefined);
    if (sid) {
      const { data: st } = await supabase
        .from("staff")
        .select("name")
        .eq("id", sid)
        .maybeSingle();
      staffName = (st?.name as string) ?? "Unknown";
    } else {
      staffName = "Unknown";
    }
  }

  const orderNumber = displayOrderNumber(
    saleRow.id,
    (saleRow as { order_number?: number | null }).order_number,
  );
  const committedQtys = await commitTrackedStockOnSend({
    licenseKey: args.licenseKey,
    staffName,
    note: `Sent — Order #${orderNumber}`,
    lines:
      args.stockLines && args.stockLines.length > 0
        ? args.stockLines.map((line) => ({
            menu_item_id: line.menuItemId,
            quantity: line.quantity,
            name: line.name,
          }))
        : pending.map((row) => ({
            menu_item_id: row.menu_item_id,
            quantity: row.quantity ?? 0,
            name: row.name,
          })),
  });

  const ids = pending.map((row) => row.id);
  try {
    const sentAt = new Date().toISOString();
    let sentRes = await supabase
      .from("sale_items")
      .update({ status: "sent", sent_at: sentAt })
      .in("id", ids);
    if (
      sentRes.error &&
      isMissingPgColumnError(sentRes.error.message, "sent_at")
    ) {
      sentRes = await supabase
        .from("sale_items")
        .update({ status: "sent" })
        .in("id", ids);
    }
    assertNoPgError("Mark items sent", sentRes.error);

    const saleStatusRes = await supabase
      .from("sales")
      .update({ status: "sent-to-kitchen" })
      .eq("id", args.orderId);
    assertNoPgError("Update order to sent", saleStatusRes.error);
  } catch (err) {
    await restoreTrackedStock({
      licenseKey: args.licenseKey,
      staffName,
      note: `Send failed — restore Order #${orderNumber}`,
      logType: "adjustment",
      qtyByMenuId: committedQtys,
    }).catch((restoreErr) =>
      console.warn("[POS] restore stock after failed send:", restoreErr),
    );
    throw err;
  }

  void Promise.all(
    pending.map((row) =>
      supabase
        .from("sale_items")
        .update({ notes: notesWithStockCommittedMark(row.notes) })
        .eq("id", row.id),
    ),
  ).catch((noteErr) =>
    console.warn("[POS] stock-committed note on send:", noteErr),
  );

  const floorId = saleFloorTableId(saleRow);
  const [, tableNameForAudit] = await Promise.all([
    floorId
      ? updateFloorTableStatusSafe(floorId, "occupied", "Update table status")
      : Promise.resolve(undefined),
    floorId
      ? getFloorTableNameOrUnknown(floorId)
      : Promise.resolve("Unknown"),
  ]);

  try {
    let staffName = (args.staffName ?? "").trim();
    if (!staffName) {
      const sid =
        uuidOrNull(args.staffId) ?? uuidOrNull(saleRow.staff_id ?? undefined);
      if (sid) {
        const { data: st } = await supabase
          .from("staff")
          .select("name")
          .eq("id", sid)
          .maybeSingle();
        staffName = (st?.name as string) ?? "Unknown";
      } else {
        staffName = "Unknown";
      }
    }

    const orderNumber = displayOrderNumber(saleRow.id, saleRow.order_number);
    const metaItems = lineRows.map((row) => ({
      name: String(row.name ?? ""),
      quantity: Number(row.quantity),
      price: Number(row.price),
      station: (row.station as "kitchen" | "bar" | undefined) ?? undefined,
      notes: row.notes ?? undefined,
    }));
    const total = metaItems.reduce(
      (s, i) => s + i.price * i.quantity,
      0,
    );
    const itemSummary = metaItems.map((i) => `${i.quantity}x ${i.name}`).join(", ");
    const auditStaffId =
      uuidOrNull(args.staffId) ?? uuidOrNull(saleRow.staff_id ?? undefined);

    const tableName = tableNameForAudit ?? "Unknown";
    void insertAuditLog({
      licenseKey: args.licenseKey,
      staffId: auditStaffId ?? undefined,
      staffName,
      action: "item_ordered",
      details: `${staffName}: ${itemSummary} — ${tableName}`,
      metadata: {
        orderId: args.orderId,
        orderNumber,
        tableName,
        items: metaItems,
        total,
      },
    }).catch((err) => console.warn("[POS] item_ordered audit log:", err));
  } catch (err) {
    console.warn("[POS] item_ordered audit prep:", err);
  }

  const ticketOrderRef = `#${displayOrderNumber(
    saleRow.id,
    (saleRow as { order_number?: number | null }).order_number,
  )}`;

  return { kitchenItems, barItems, ticketOrderRef };
}

export async function sendOrder(args: MarkSentArgs) {
  void args.tableId;
  await getRestaurantByLicense(args.licenseKey);
  if (args.staffId) {
    await assertSaleStaffCanEdit(args.orderId, args.staffId);
  }
  return executeMarkOrderSentToKitchen(args);
}

/**
 * One network round-trip from the POS UI: create sale (if needed), add lines, send to kitchen.
 * Replaces sequential createOrder + addItemsToOrderBulk + sendOrder (~3× latency).
 */
export async function submitCartOrder(args: {
  licenseKey: string;
  tableId: string;
  staffId: string;
  staffName: string;
  existingOrderId?: string | null;
  lines: OrderLineInput[];
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  if (args.lines.length === 0) {
    throw new Error("No new items to send");
  }

  let orderId: string;
  const existing =
    args.existingOrderId != null && String(args.existingOrderId).trim() !== ""
      ? String(args.existingOrderId).trim()
      : null;

  if (existing) {
    let saleRes = await supabase
      .from("sales")
      .select(
        "id, status, restaurant_id, table_ref, table_id, order_number, staff_id",
      )
      .eq("id", existing)
      .single();
    if (
      saleRes.error &&
      isMissingPgColumnError(saleRes.error.message, "order_number")
    ) {
      saleRes = await supabase
        .from("sales")
        .select("id, status, restaurant_id, table_ref, table_id, staff_id")
        .eq("id", existing)
        .single();
    }
    assertNoPgError("Load order for submit", saleRes.error);
    const sale = saleRes.data;
    if (!sale) throw new Error("Order not found");
    if (String(sale.restaurant_id) !== String(r.id)) {
      throw new Error("Order not found");
    }
    if (!isOpenSaleStatus(sale.status)) {
      throw new Error("Order is closed");
    }
    if (!saleRowMatchesTable(sale, args.tableId)) {
      throw new Error("Order is for a different table");
    }
    orderId = sale.id as string;
    if (args.staffId) {
      await assertSaleStaffCanEditFromLoadedSale(
        orderId,
        args.staffId,
        (sale as { staff_id?: unknown }).staff_id,
      );
    }
  } else {
    orderId = await insertNewOpenSale({
      restaurantId: r.id,
      tableId: args.tableId,
      staffId: args.staffId,
    });
    if (args.staffId) {
      await assertSaleStaffCanEdit(orderId, args.staffId);
    }
  }
  await assertMenuLinesOrderable(args.licenseKey, args.lines);
  await insertOrderLinesAndRecalc(orderId, args.lines);
  const sendResult = await executeMarkOrderSentToKitchen({
    licenseKey: args.licenseKey,
    orderId,
    staffId: args.staffId,
    staffName: args.staffName,
    tableId: args.tableId,
    stockLines: args.lines,
  });
  const orderSnapshot = await getOrderWithItems({
    licenseKey: args.licenseKey,
    orderId,
  });
  return { ...sendResult, orderSnapshot };
}

export async function printBill(args: Record<string, unknown>) {
  const licenseKey = String(args.licenseKey ?? "");
  const orderId = String(args.orderId ?? "");
  if (!licenseKey || !orderId) return true;
  const r = await getRestaurantByLicense(licenseKey);
  const { data: order, error } = await supabase
    .from("sales")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order || order.restaurant_id !== r.id) throw new Error("Order not found");
  const tableId =
    saleFloorTableId(order as Parameters<typeof saleFloorTableId>[0]) ||
    String(args.tableId ?? "");
  if (tableId) {
    await updateFloorTableStatusSafe(tableId, "bill-printed", "Request bill");
  }
  return true;
}

function saleLineLookupKey(name: string, price: number) {
  return `${name.trim().toLowerCase()}|${Math.round(price * 100)}`;
}

/** Map name+unit price → menu_items.id so paid lines without FK still hit stock + total_sold. */
async function buildMenuItemIdLookupBySnapshot(restaurantId: string) {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, price")
    .eq("restaurant_id", restaurantId);
  assertNoPgError("Load menu for sale/stock link", error);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const k = saleLineLookupKey(String(row.name ?? ""), Number(row.price));
    if (!map.has(k)) map.set(k, row.id as string);
  }
  return map;
}

export async function payOrder(args: Record<string, unknown>) {
  void args.tableId;
  const licenseKey = args.licenseKey as string;
  const orderId = args.orderId as string;
  let paymentMethod = String(args.paymentMethod ?? "cash");
  if (paymentMethod === "qr") paymentMethod = "other";
  let paymentType = String(args.paymentType ?? "no_receipt");
  const r = await getRestaurantByLicense(licenseKey);

  const { data: order, error: loadErr } = await supabase
    .from("sales")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  assertNoPgError("Load sale for payment", loadErr);
  if (!order || String(order.restaurant_id) !== String(r.id)) {
    throw new Error("Order not found");
  }

  const paidTableIdEarly = saleFloorTableId(
    order as Parameters<typeof saleFloorTableId>[0],
  );
  if (String(order.status ?? "").toLowerCase() === "paid") {
    if (paidTableIdEarly) {
      await updateFloorTableStatusSafe(
        paidTableIdEarly,
        "available",
        "Free table after payment",
      );
    }
    return;
  }

  const orderTotal = Number(order.total ?? 0);
  const prevPaidRaw = (order as { paid_amount?: unknown }).paid_amount;
  const prevPaid =
    Math.round(Math.max(0, Number(prevPaidRaw ?? 0)) * 100) / 100;
  let fullRemaining =
    Math.round(Math.max(0, orderTotal - prevPaid) * 100) / 100;
  const eps = 0.009;

  const rawAmount = args.amount;
  const requested =
    rawAmount != null && rawAmount !== ""
      ? Math.round(Number(rawAmount) * 100) / 100
      : null;

  let portion =
    requested != null && Number.isFinite(requested) && requested > 0
      ? requested
      : fullRemaining;

  if (portion <= 0) {
    await recalcSaleTotals(orderId);
    const { data: refreshed, error: refreshErr } = await supabase
      .from("sales")
      .select("total, paid_amount")
      .eq("id", orderId)
      .maybeSingle();
    assertNoPgError("Reload sale totals for payment", refreshErr);
    const refreshedTotal = Number(refreshed?.total ?? 0);
    const refreshedPaid =
      Math.round(
        Math.max(0, Number((refreshed as { paid_amount?: unknown } | null)?.paid_amount ?? 0)) *
          100,
      ) / 100;
    fullRemaining = Math.round(Math.max(0, refreshedTotal - refreshedPaid) * 100) / 100;
    portion =
      requested != null && Number.isFinite(requested) && requested > 0
        ? requested
        : fullRemaining;
  }

  if (portion <= 0) {
    throw new Error("Nothing to pay");
  }
  if (portion > fullRemaining + eps) {
    throw new Error("Amount exceeds balance due");
  }

  const isFinal = portion >= fullRemaining - eps;

  if (paymentType === "debt") {
    await assertStaffPermission({
      licenseKey,
      staffId: args.staffId as string | undefined,
      permission: "canChargeDebt",
    });
  }
  if (paymentType === "complimentary") {
    await assertStaffPermission({
      licenseKey,
      staffId: args.staffId as string | undefined,
      permission: "canMarkComplimentary",
    });
  }

  if (!isFinal) {
    if (paymentType === "debt" || paymentType === "complimentary") {
      throw new Error(
        "For split payments, use Cash or Card until the balance is cleared.",
      );
    }

    const settledAlloc = parseSettledSaleQuantities(args);
    const staffNameLog =
      String((args.staffName as string | undefined) ?? "").trim() || "System";

    if (settledAlloc.length > 0) {
      const { data: allLines, error: loadAllErr } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", orderId);
      assertNoPgError("Load sale items for split settle", loadAllErr);
      const lineById = new Map(
        (allLines ?? []).map((row) => [String(row.id), row as Record<string, unknown>]),
      );
      const plan = buildSettledLinePlan(lineById, orderId, settledAlloc);
      if (Math.abs(plan.settledSum - portion) > eps) {
        throw new Error("Selected lines do not match the payment amount");
      }

      const needsSnap = plan.stockRows.some((it) => {
        const rawFk = it.menu_item_id as string | null | undefined;
        return !rawFk || String(rawFk).trim() === "";
      });
      const menuIdBySnapshot = needsSnap
        ? await buildMenuItemIdLookupBySnapshot(r.id)
        : null;

      const orderNumber = displayOrderNumber(
        String(order.id),
        order.order_number as number | null | undefined,
      );
      await applyStockSoldForSaleItemRows(
        r.id,
        plan.stockRows,
        staffNameLog,
        order.order_number != null ? `#${order.order_number}` : String(orderId).slice(0, 8),
        menuIdBySnapshot,
        licenseKey,
      );

      await applySettledLinePlan(plan, orderId);
      const settledSaleItemIds = plan.settledIds;

      const { data: saleAfter, error: saleReloadErr } = await supabase
        .from("sales")
        .select("*")
        .eq("id", orderId)
        .single();
      assertNoPgError("Reload sale after split", saleReloadErr);
      const Tn = Math.round(Number(saleAfter?.total ?? 0) * 100) / 100;
      const remainder = Math.round((Tn - prevPaid) * 100) / 100;

      const { error: pErr2 } = await supabase
        .from("sales")
        .update({
          paid_amount: prevPaid,
          payment_method: paymentMethod,
          payment_type: paymentType,
        })
        .eq("id", orderId);
      if (pErr2) {
        if (isMissingPgColumnError(pErr2.message, "paid_amount")) {
          throw new Error(
            "Split bills need column sales.paid_amount. Run supabase/ensure_sales_paid_amount.sql in Supabase.",
          );
        }
        assertNoPgError("Update sale after line split", pErr2);
      }

      const paidTableId = saleFloorTableId(
        order as Parameters<typeof saleFloorTableId>[0],
      );
      const tableNameForAudit = paidTableId
        ? await getFloorTableNameOrUnknown(paidTableId)
        : "Unknown";

      if (remainder <= eps) {
        if (Tn <= eps) {
          const nowClose = new Date().toISOString();
          const { error: closeErr } = await supabase
            .from("sales")
            .update({
              status: "paid",
              paid_at: nowClose,
              payment_method: paymentMethod,
              payment_type: paymentType,
              paid_amount: 0,
              subtotal: 0,
              tax: 0,
              total: 0,
            })
            .eq("id", orderId);
          assertNoPgError("Close empty sale after split", closeErr);
          const paidTableClose = saleFloorTableId(
            order as Parameters<typeof saleFloorTableId>[0],
          );
          if (paidTableClose) {
            await updateFloorTableStatusSafe(
              paidTableClose,
              "available",
              "Free table after payment",
            );
          }
          try {
            void insertAuditLog({
              licenseKey,
              staffId: uuidOrNull(args.staffId as string | undefined) ?? undefined,
              staffName: staffNameLog,
              action: "payment",
              details: `Payment (${paymentType}) — Order #${orderNumber} — closed after split (no remaining lines)`,
              metadata: {
                orderId,
                orderNumber,
                tableName: tableNameForAudit ?? "Unknown",
                paymentMethod,
                paymentType,
                partial: true,
                settledSaleItemIds,
              },
            }).catch((err) => console.warn("[POS] split close audit:", err));
          } catch (err) {
            console.warn("[POS] split close audit prep:", err);
          }
          return;
        }
        return payOrder({
          licenseKey,
          orderId,
          paymentMethod,
          paymentType,
          customerId: args.customerId,
          customerName: args.customerName,
          staffId: args.staffId,
          staffName: args.staffName,
          tableId: args.tableId,
        });
      }

      try {
        void insertAuditLog({
          licenseKey,
          staffId: uuidOrNull(args.staffId as string | undefined) ?? undefined,
          staffName: staffNameLog,
          action: "payment",
          details: `Partial payment (lines removed): $${portion.toFixed(2)} (${paymentType}) — Order #${orderNumber} — new balance $${remainder.toFixed(2)}`,
          metadata: {
            orderId,
            orderNumber,
            tableName: tableNameForAudit ?? "Unknown",
            paymentMethod,
            paymentType,
            partial: true,
            portion,
            prevPaid,
            settledSaleItemIds,
            newOrderTotal: Tn,
            remainder,
          },
        }).catch((err) => console.warn("[POS] partial pay audit:", err));
      } catch (err) {
        console.warn("[POS] partial pay audit prep:", err);
      }
      return;
    }

    const newPaid = Math.round((prevPaid + portion) * 100) / 100;
    const { error: pErr } = await supabase
      .from("sales")
      .update({
        paid_amount: newPaid,
        payment_method: paymentMethod,
        payment_type: paymentType,
      })
      .eq("id", orderId);
    if (pErr) {
      if (isMissingPgColumnError(pErr.message, "paid_amount")) {
        throw new Error(
          "Split bills need column sales.paid_amount. Run supabase/ensure_sales_paid_amount.sql in Supabase.",
        );
      }
      assertNoPgError("Record partial payment", pErr);
    }

    const orderNumber = displayOrderNumber(
      String(order.id),
      order.order_number as number | null | undefined,
    );
    const paidTableId = saleFloorTableId(
      order as Parameters<typeof saleFloorTableId>[0],
    );
    const tableNameForAudit = paidTableId
      ? await getFloorTableNameOrUnknown(paidTableId)
      : "Unknown";

    try {
      void insertAuditLog({
        licenseKey,
        staffId: uuidOrNull(args.staffId as string | undefined) ?? undefined,
        staffName:
          String((args.staffName as string | undefined) ?? "").trim() ||
          "System",
        action: "payment",
        details: `Partial payment: $${portion.toFixed(2)} (${paymentType}) — Order #${orderNumber} — remaining was $${fullRemaining.toFixed(2)}`,
        metadata: {
          orderId,
          orderNumber,
          tableName: tableNameForAudit ?? "Unknown",
          paymentMethod,
          paymentType,
          partial: true,
          portion,
          prevPaid,
          newPaid,
          orderTotal,
        },
      }).catch((err) => console.warn("[POS] partial pay audit:", err));
    } catch (err) {
      console.warn("[POS] partial pay audit prep:", err);
    }
    return;
  }

  const fullPathAlloc = parseSettledSaleQuantities(args);
  if (
    fullPathAlloc.length > 0 &&
    requested != null &&
    paymentType !== "complimentary"
  ) {
    const { data: allLinesF, error: loadAllErrF } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", orderId);
    assertNoPgError("Load sale items for final line settle", loadAllErrF);
    const lineByIdF = new Map(
      (allLinesF ?? []).map((row) => [String(row.id), row as Record<string, unknown>]),
    );
    const planF = buildSettledLinePlan(lineByIdF, orderId, fullPathAlloc);
    if (Math.abs(planF.settledSum - portion) > eps) {
      throw new Error("Selected lines do not match the payment amount");
    }
    if (Math.abs(planF.settledSum - fullRemaining) > eps) {
      throw new Error(
        "Selected lines must cover the full remaining balance for this payment",
      );
    }
    const needsSnapF = planF.stockRows.some((it) => {
      const rawFk = it.menu_item_id as string | null | undefined;
      return !rawFk || String(rawFk).trim() === "";
    });
    const menuIdBySnapshotF = needsSnapF
      ? await buildMenuItemIdLookupBySnapshot(r.id)
      : null;
    await applyStockSoldForSaleItemRows(
      r.id,
      planF.stockRows,
      String((args.staffName as string | undefined) ?? "").trim() || "System",
      order.order_number != null
        ? `#${order.order_number}`
        : String(orderId).slice(0, 8),
      menuIdBySnapshotF,
      licenseKey,
    );
    await applySettledLinePlan(planF, orderId);
  }

  if (prevPaid > 0 && paymentType === "complimentary") {
    throw new Error("Complimentary is not available after partial payments.");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "paid",
    paid_at: now,
    payment_method: paymentMethod,
    payment_type: paymentType,
    paid_amount: paymentType === "complimentary" ? 0 : orderTotal,
  };

  if (paymentType === "complimentary") {
    patch.subtotal = 0;
    patch.tax = 0;
    patch.total = 0;
    patch.paid_amount = 0;
  }
  if (paymentType === "debt") {
    if (args.customerId) patch.customer_id = args.customerId;
    if (args.customerName) patch.customer_name = args.customerName;
  }

  const { error: fullErr } = await supabase
    .from("sales")
    .update(patch)
    .eq("id", orderId);
  if (fullErr) {
    if (isMissingPgColumnError(fullErr.message, "paid_amount")) {
      const { error: retryErr } = await supabase
        .from("sales")
        .update(
          Object.fromEntries(
            Object.entries(patch).filter(([k]) => k !== "paid_amount"),
          ),
        )
        .eq("id", orderId);
      assertNoPgError("Complete order payment", retryErr);
    } else if (
      paymentType === "no_receipt" &&
      isPgCheckConstraintError(fullErr.message, "payment_type")
    ) {
      paymentType = "non_fiscal";
      patch.payment_type = paymentType;
      const { error: retryTypeErr } = await supabase
        .from("sales")
        .update(patch)
        .eq("id", orderId);
      assertNoPgError("Complete order payment", retryTypeErr);
    } else {
      assertNoPgError("Complete order payment", fullErr);
    }
  }

  const itemsSelect =
    "id, menu_item_id, name, price, quantity, status, station, notes" as const;
  let itemsRes = await supabase
    .from("sale_items")
    .select(itemsSelect)
    .eq("sale_id", orderId);

  if (itemsRes.error) {
    const msg = itemsRes.error.message ?? "";
    const retryWide =
      isPostgrestExposeOrCacheError(msg) ||
      isMissingPgColumnError(msg, "station") ||
      isMissingPgColumnError(msg, "menu_item_id") ||
      isMissingPgColumnError(msg, "notes");
    if (retryWide) {
      itemsRes = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", orderId);
    }
  }
  if (itemsRes.error) {
    console.warn("[POS] payOrder load items:", itemsRes.error.message);
  }
  const items = itemsRes.data;

  const staffNameLog =
    String((args.staffName as string | undefined) ?? "").trim() || "System";
  const orderLabel =
    order.order_number != null ? `#${order.order_number}` : String(orderId).slice(0, 8);

  const needsMenuSnapshot =
    paymentType !== "complimentary" &&
    (items ?? []).some((it) => {
      const st = String(it.status ?? "");
      if (st === "cancelled" || st === "voided") return false;
      const rawFk = it.menu_item_id as string | null | undefined;
      return !rawFk || String(rawFk).trim() === "";
    });

  let menuIdBySnapshot: Map<string, string> | null = null;
  try {
    menuIdBySnapshot = needsMenuSnapshot
      ? await buildMenuItemIdLookupBySnapshot(r.id)
      : null;
  } catch (err) {
    console.warn("[POS] payOrder menu snapshot:", err);
  }

  const lineIdsToServe: string[] = [];
  const payableRows: Record<string, unknown>[] = [];

  for (const it of items ?? []) {
    if (it.status === "cancelled" || it.status === "voided") continue;
    lineIdsToServe.push(String(it.id));
    if (paymentType === "complimentary") continue;
    payableRows.push(it as Record<string, unknown>);
  }

  if (lineIdsToServe.length > 0) {
    const { error: serveAllErr } = await supabase
      .from("sale_items")
      .update({ status: "served" })
      .in("id", lineIdsToServe);
    if (serveAllErr) {
      console.warn("[POS] payOrder mark served:", serveAllErr.message);
    }
  }

  if (payableRows.length > 0) {
    try {
      await applyStockSoldForSaleItemRows(
        r.id,
        payableRows,
        staffNameLog,
        orderLabel,
        menuIdBySnapshot,
        licenseKey,
      );
    } catch (err) {
      console.warn("[POS] payOrder stock:", err);
    }
  }

  const paidTableId = saleFloorTableId(order as Parameters<typeof saleFloorTableId>[0]);
  let tableNameForAudit = "Unknown";
  try {
    if (paidTableId) {
      await updateFloorTableStatusSafe(
        paidTableId,
        "available",
        "Free table after payment",
      );
      tableNameForAudit = await getFloorTableNameOrUnknown(paidTableId);
    }
  } catch (err) {
    console.warn("[POS] payOrder table cleanup:", err);
  }

  try {
    const originalTotal = Number(order.total ?? 0);
    const orderNumber = displayOrderNumber(
      String(order.id),
      order.order_number as number | null | undefined,
    );
    const tableName = tableNameForAudit ?? "Unknown";

    const paymentLabels: Record<string, string> = {
      fiscal: "Fiscal receipt",
      non_fiscal: "Non-fiscal receipt",
      no_receipt: "No receipt",
      debt: "Debt / account",
      complimentary: "On the house",
    };
    const typeLabel = paymentLabels[paymentType] ?? paymentType;
    let auditDetails = `Payment: ${typeLabel} (${paymentMethod}) - Order #${orderNumber} - $${originalTotal.toFixed(2)}`;
    if (paymentType === "debt" && args.customerName) {
      auditDetails += ` - Customer: ${args.customerName}`;
    }
    if (paymentType === "complimentary") {
      auditDetails += ` - Value given away: $${originalTotal.toFixed(2)}`;
    }

    let auditAction: "payment" | "complimentary_order" | "debt_order" = "payment";
    if (paymentType === "complimentary") auditAction = "complimentary_order";
    if (paymentType === "debt") auditAction = "debt_order";

    const orderItemsForMeta = (items ?? [])
      .filter((i) => i.status !== "cancelled" && i.status !== "voided")
      .map((i) => ({
        name: String(i.name ?? ""),
        quantity: Number(i.quantity),
        price: Number(i.price),
        station: (i.station as "kitchen" | "bar" | undefined) ?? undefined,
        notes: (i.notes as string | null) ?? undefined,
      }));

    void insertAuditLog({
      licenseKey,
      staffId: uuidOrNull(args.staffId as string | undefined) ?? undefined,
      staffName: staffNameLog,
      action: auditAction,
      details: auditDetails,
      metadata: {
        orderId,
        orderNumber,
        tableName,
        paymentMethod,
        paymentType,
        customerName: args.customerName as string | undefined,
        items: orderItemsForMeta,
        total: originalTotal,
      },
    }).catch((err) => console.warn("[POS] payOrder audit log:", err));
  } catch (err) {
    console.warn("[POS] payOrder audit prep:", err);
  }
}

export async function getClosedOrders(args: { licenseKey: string }) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("restaurant_id", r.id)
    .in("status", ["paid", "cancelled"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const tableIds = [
    ...new Set(
      rows
        .map((row) =>
          saleFloorTableId(row as Parameters<typeof saleFloorTableId>[0]),
        )
        .filter((id) => id.length > 0),
    ),
  ];
  const staffIds = [
    ...new Set(
      rows
        .map((row) => row.staff_id as string | null | undefined)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  const tableNameById = new Map<string, string>();
  if (tableIds.length > 0) {
    const { data: trows, error: terr } = await supabase
      .from("pos_floor_tables")
      .select("id, name")
      .in("id", tableIds);
    if (terr && !isPostgrestExposeOrCacheError(terr.message)) {
      assertNoPgError("getClosedOrders floor tables", terr);
    }
    for (const t of trows ?? []) {
      const id = typeof t.id === "string" ? t.id : "";
      const name = typeof t.name === "string" ? t.name.trim() : "";
      if (id && name) tableNameById.set(id, name);
    }
  }

  const staffNameById = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: srows, error: serr } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", staffIds);
    if (serr) assertNoPgError("getClosedOrders staff", serr);
    for (const s of srows ?? []) {
      const id = typeof s.id === "string" ? s.id : "";
      const name = typeof s.name === "string" ? s.name.trim() : "";
      if (id && name) staffNameById.set(id, name);
    }
  }

  return rows.map((row) => {
    const doc = saleToOrderDoc(row as Parameters<typeof saleToOrderDoc>[0]);
    const fid = saleFloorTableId(row as Parameters<typeof saleFloorTableId>[0]);
    let tableName = "—";
    if (fid) {
      tableName = tableNameById.get(fid) ?? "Unknown";
    }
    let staffName = "—";
    if (doc.staffId) {
      staffName = staffNameById.get(doc.staffId) ?? "Unknown";
    }
    return { ...doc, tableName, staffName };
  });
}

export async function getOrderWithItems(args: {
  licenseKey: string;
  orderId: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { data: order } = await supabase
    .from("sales")
    .select("*")
    .eq("id", args.orderId)
    .single();
  if (!order) throw new Error("Order not found");

  const { data: items } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", args.orderId);

  let tableName = "Unknown";
  const withItemsTableId = saleFloorTableId(
    order as Parameters<typeof saleFloorTableId>[0],
  );
  if (withItemsTableId) {
    tableName = await getFloorTableNameOrUnknown(withItemsTableId);
  }

  let staffName = "Unknown";
  if (order.staff_id) {
    const { data: s } = await supabase
      .from("staff")
      .select("name")
      .eq("id", order.staff_id)
      .single();
    if (s) staffName = s.name;
  }

  const odoc = saleToOrderDoc(order as Parameters<typeof saleToOrderDoc>[0]);
  return {
    ...odoc,
    items: (items ?? []).map((row) =>
      itemRowToDoc(row as Parameters<typeof itemRowToDoc>[0]),
    ),
    tableName,
    staffName,
  };
}

function voidItemIdsFromArgs(args: Record<string, unknown>): string[] {
  const bulk = args.itemIds as string[] | undefined;
  if (Array.isArray(bulk) && bulk.length > 0) {
    return bulk.map((id) => String(id)).filter(Boolean);
  }
  const one = (args.orderItemId ?? args.itemId) as string | undefined;
  return one ? [String(one)] : [];
}

export async function voidItem(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  await assertStaffPermission({
    licenseKey,
    staffId: args.staffId as string | undefined,
    permission: "canVoidItems",
  });
  await getRestaurantByLicense(licenseKey);
  const ids = voidItemIdsFromArgs(args);
  if (ids.length === 0) return;

  let saleId = args.orderId as string | undefined;
  if (!saleId && ids.length > 0) {
    const { data: row } = await supabase
      .from("sale_items")
      .select("sale_id")
      .eq("id", ids[0]!)
      .maybeSingle();
    saleId = row?.sale_id as string | undefined;
  }

  const { data: voidedLines, error: loadErr } = await supabase
    .from("sale_items")
    .select("id, name, quantity, price, sale_id, menu_item_id, status, notes")
    .in("id", ids);
  if (loadErr) throw loadErr;

  const { error } = await supabase
    .from("sale_items")
    .update({ status: "voided" })
    .in("id", ids);
  if (error) throw error;

  if (saleId) await recalcSaleTotals(saleId);

  const lines = voidedLines ?? [];
  if (lines.length === 0) return;

  const reasonCode = String(args.reasonCode ?? "").trim();
  const reasonLabel = String(args.reasonLabel ?? "").trim();
  const reasonNote = String(args.reasonNote ?? "").trim();
  const reasonText = [reasonLabel || reasonCode, reasonNote]
    .filter(Boolean)
    .join(": ");

  if (reasonText) {
    for (const row of lines) {
      const id = String(row.id);
      const prev = String((row as { notes?: string | null }).notes ?? "").trim();
      const next = prev
        ? `${prev}\n${reasonText}`
        : reasonText;
      const { error: noteErr } = await supabase
        .from("sale_items")
        .update({ notes: next })
        .eq("id", id);
      if (noteErr) {
        console.warn("[POS] void reason note:", noteErr.message);
      }
    }
  }

  try {
    const staffIdArg = args.staffId as string | undefined;
    let staffName = String(args.staffName ?? "").trim();
    const sid = uuidOrNull(staffIdArg);
    if (!staffName && sid) {
      const { data: st } = await supabase
        .from("staff")
        .select("name")
        .eq("id", sid)
        .maybeSingle();
      staffName = (st?.name as string) ?? "Unknown";
    }
    if (!staffName) staffName = "Unknown";

    const resolvedSaleId = saleId ?? (lines[0]?.sale_id as string | undefined);
    let tableName = "Unknown";
    let orderNumber: number | undefined;
    if (resolvedSaleId) {
      const { data: sale } = await supabase
        .from("sales")
        .select("*")
        .eq("id", resolvedSaleId)
        .maybeSingle();
      if (sale) {
        orderNumber = displayOrderNumber(
          String(sale.id),
          sale.order_number as number | null | undefined,
        );
        const fid = saleFloorTableId(
          sale as Parameters<typeof saleFloorTableId>[0],
        );
        if (fid) tableName = await getFloorTableNameOrUnknown(fid);
      }
    }

    const parts = lines.map(
      (row) =>
        `"${String(row.name ?? "")}" x${Number(row.quantity)} ($${Number(row.price).toFixed(2)} each)`,
    );
    const details = reasonText
      ? `Voided ${parts.join("; ")} - Table: ${tableName} - Reason: ${reasonText}`
      : `Voided ${parts.join("; ")} - Table: ${tableName}`;

    await insertAuditLog({
      licenseKey,
      staffId: sid ?? undefined,
      staffName,
      action: "void_item",
      details,
      metadata: {
        orderId: resolvedSaleId,
        orderNumber,
        tableName,
        reasonCode: reasonCode || undefined,
        reason: reasonText || undefined,
        items: lines.map((row) => ({
          name: String(row.name ?? ""),
          quantity: Number(row.quantity),
          price: Number(row.price),
        })),
      },
    });
  } catch (err) {
    console.warn("[POS] void_item audit log:", err);
  }

  let staffNameForStock = String(args.staffName ?? "").trim();
  if (!staffNameForStock) {
    const sid = uuidOrNull(args.staffId as string | undefined);
    if (sid) {
      const { data: st } = await supabase
        .from("staff")
        .select("name")
        .eq("id", sid)
        .maybeSingle();
      staffNameForStock = (st?.name as string) ?? "Unknown";
    } else {
      staffNameForStock = "Unknown";
    }
  }

  await deductTrackedStockClamped({
    licenseKey,
    staffName: staffNameForStock,
    note: reasonText
      ? `Waste / delete — ${reasonText}`
      : "Waste / delete",
    logType: "waste",
    lines: lines.map((row) => ({
      menu_item_id: row.menu_item_id as string | null,
      quantity: row.quantity as number | string,
      status: (row as { status?: string }).status,
      notes: (row as { notes?: string | null }).notes,
    })),
  });
}

function saleLineIsUnsent(status: unknown): boolean {
  const st = String(status ?? "")
    .trim()
    .toLowerCase();
  return st === "" || st === "pending";
}

async function patchSaleItemProductFields(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  let { error } = await supabase.from("sale_items").update(patch).eq("id", id);
  if (error && isPostgrestExposeOrCacheError(error.message)) {
    const fallback: Record<string, unknown> = {
      name: patch.name,
      price: patch.price,
      notes: patch.notes,
    };
    if (patch.quantity != null) fallback.quantity = patch.quantity;
    ({ error } = await supabase.from("sale_items").update(fallback).eq("id", id));
  }
  assertNoPgError("Update replaced line", error);
}

/**
 * Replace `quantity` units on the given lines.
 * Unsent (`pending`) units are rewritten in place so they never look voided.
 * Units already sent to kitchen are voided and the replacement is inserted as sent.
 */
export async function replaceOrderItemUnits(args: {
  licenseKey: string;
  orderId: string;
  tableId?: string;
  staffId?: string;
  staffName?: string;
  itemIds: string[];
  quantity: number;
  replacement: OrderLineInput;
}) {
  void args.tableId;
  await getRestaurantByLicense(args.licenseKey);
  const orderId = String(args.orderId ?? "").trim();
  if (!orderId) throw new Error("Order not found");
  if (args.staffId) {
    await assertSaleStaffCanEditForTableMove(orderId, args.staffId);
  }

  const ids = (args.itemIds ?? []).map((id) => String(id)).filter(Boolean);
  const wanted = Math.max(0, Math.floor(Number(args.quantity) || 0));
  if (ids.length === 0 || wanted <= 0) return { swapped: 0, returned: 0 };

  await assertMenuLinesOrderable(args.licenseKey, [
    { ...args.replacement, quantity: wanted },
  ]);

  const { data: rows, error: loadErr } = await supabase
    .from("sale_items")
    .select("id, quantity, status, sale_id")
    .in("id", ids);
  assertNoPgError("Load lines to replace", loadErr);

  const byId = new Map(
    (rows ?? []).map((row) => [String(row.id), row] as const),
  );

  let remaining = wanted;
  const pendingFullIds: string[] = [];
  const pendingPartial: { id: string; keep: number; take: number }[] = [];
  const sentIds: string[] = [];
  let pendingUnits = 0;
  let sentUnits = 0;

  for (const id of ids) {
    if (remaining <= 0) break;
    const row = byId.get(id);
    if (!row) continue;
    const st = String(row.status ?? "");
    if (st === "voided" || st === "cancelled") continue;
    const q = Number(row.quantity);
    if (!Number.isFinite(q) || q <= 0) continue;
    const take = Math.min(q, remaining);
    if (saleLineIsUnsent(st)) {
      pendingUnits += take;
      if (take >= q) pendingFullIds.push(id);
      else pendingPartial.push({ id, keep: q - take, take });
    } else {
      sentUnits += take;
      sentIds.push(id);
    }
    remaining -= take;
  }

  if (pendingUnits + sentUnits <= 0) return { swapped: 0, returned: 0 };

  const uniqueIds = [...new Set([args.replacement.menuItemId].filter(Boolean))];
  const menuById = new Map<string, MenuItemSnap>();
  if (uniqueIds.length > 0) {
    const { data: menuRows, error: menuErr } = await supabase
      .from("menu_items")
      .select("id, name, price, station, vat_rate")
      .in("id", uniqueIds);
    if (menuErr) {
      if (isPostgrestExposeOrCacheError(menuErr.message)) {
        console.warn(
          "[POS] menu_items load for replace failed; using line snapshot:",
          menuErr.message,
        );
      } else {
        assertNoPgError("Load replacement menu item", menuErr);
      }
    }
    for (const m of menuRows ?? []) {
      menuById.set(m.id as string, m as MenuItemSnap);
    }
  }

  const resolved = resolveLineToSaleItemRow(
    orderId,
    { ...args.replacement, quantity: 1 },
    menuById,
  );
  const productPatch: Record<string, unknown> = {
    name: resolved.name,
    price: resolved.price,
    notes: resolved.notes,
    menu_item_id: resolved.menu_item_id,
    station: resolved.station,
    vat_rate: resolved.vat_rate,
    selected_customizations: resolved.selected_customizations ?? [],
  };

  for (const id of pendingFullIds) {
    await patchSaleItemProductFields(id, productPatch);
  }
  for (const part of pendingPartial) {
    const { error } = await supabase
      .from("sale_items")
      .update({ quantity: part.keep })
      .eq("id", part.id);
    assertNoPgError("Split unsent line for replace", error);
    await insertSaleItemWithSchemaFallback({
      ...resolved,
      quantity: part.take,
      status: "pending",
    });
  }

  if (sentUnits > 0) {
    await voidItemUnits({
      licenseKey: args.licenseKey,
      orderId,
      tableId: args.tableId,
      staffId: args.staffId,
      staffName: args.staffName,
      itemIds: sentIds,
      quantity: sentUnits,
      asReplacement: true,
    });
    const staffName = String(args.staffName ?? "").trim() || "Unknown";
    await commitTrackedStockOnSend({
      licenseKey: args.licenseKey,
      staffName,
      note: "Replacement sent",
      lines: [
        {
          menu_item_id: resolved.menu_item_id,
          quantity: sentUnits,
          name: resolved.name,
        },
      ],
    });
    await insertSaleItemWithSchemaFallback({
      ...resolved,
      quantity: sentUnits,
      status: "sent",
      notes: notesWithStockCommittedMark(resolved.notes),
    });
  }

  await recalcSaleTotals(orderId);
  return { swapped: pendingUnits, returned: sentUnits };
}

/** Void only `quantity` units from the given sale lines (does not void extra copies). */
export async function voidItemUnits(args: {
  licenseKey: string;
  orderId?: string;
  tableId?: string;
  staffId?: string;
  staffName?: string;
  itemIds: string[];
  quantity: number;
  /** When true, the order list hides these lines (swap, not a visible delete). */
  asReplacement?: boolean;
  /** Return unused product — no waste stock deduction. */
  asReturn?: boolean;
}) {
  void args.tableId;
  await assertStaffPermission({
    licenseKey: args.licenseKey,
    staffId: args.staffId,
    permission: "canVoidItems",
  });
  await getRestaurantByLicense(args.licenseKey);
  const ids = (args.itemIds ?? []).map((id) => String(id)).filter(Boolean);
  const wanted = Math.max(0, Math.floor(Number(args.quantity) || 0));
  if (ids.length === 0 || wanted <= 0) return;

  const { data: rows, error: loadErr } = await supabase
    .from("sale_items")
    .select("id, name, quantity, price, sale_id, status, notes, menu_item_id")
    .in("id", ids);
  assertNoPgError("Load lines to void units", loadErr);

  const open = (rows ?? []).filter((row) => {
    const st = String(row.status ?? "");
    return st !== "voided" && st !== "cancelled";
  });
  const notesById = new Map(
    (rows ?? []).map((row) => [String(row.id), row.notes as string | null]),
  );

  let remaining = wanted;
  const toVoid: string[] = [];
  const toReduce: { id: string; quantity: number }[] = [];
  const restoreQtyByMenuId = new Map<string, number>();
  for (const row of open) {
    if (remaining <= 0) break;
    const q = Number(row.quantity);
    if (!Number.isFinite(q) || q <= 0) continue;
    const take = Math.min(q, remaining);
    if (
      (args.asReturn || args.asReplacement) &&
      saleLineStockCommitted(row.notes as string | null) &&
      !saleLineIsUnsent(row.status)
    ) {
      const fk = String(row.menu_item_id ?? "").trim();
      if (fk) {
        restoreQtyByMenuId.set(fk, (restoreQtyByMenuId.get(fk) ?? 0) + take);
      }
    }
    if (q <= remaining) {
      toVoid.push(String(row.id));
      remaining -= q;
    } else {
      toReduce.push({ id: String(row.id), quantity: q - remaining });
      remaining = 0;
    }
  }

  if (toVoid.length > 0) {
    if (args.asReplacement || args.asReturn) {
      const markNotes = args.asReturn
        ? notesWithReturnedMark
        : notesWithReplacedMark;
      for (const id of toVoid) {
        const { error } = await supabase
          .from("sale_items")
          .update({
            status: "voided",
            notes: markNotes(notesById.get(id)),
          })
          .eq("id", id);
        assertNoPgError("Mark returned units", error);
      }
    } else {
      const { error } = await supabase
        .from("sale_items")
        .update({ status: "voided" })
        .in("id", toVoid);
      assertNoPgError("Void replaced units", error);
    }
  }
  for (const row of toReduce) {
    const { error } = await supabase
      .from("sale_items")
      .update({ quantity: row.quantity })
      .eq("id", row.id);
    assertNoPgError("Reduce remaining units", error);
  }

  const saleId =
    args.orderId ??
    (open[0]?.sale_id as string | undefined) ??
    undefined;
  if (saleId) await recalcSaleTotals(saleId);

  if (restoreQtyByMenuId.size > 0) {
    const staffName = String(args.staffName ?? "").trim() || "Unknown";
    await restoreTrackedStock({
      licenseKey: args.licenseKey,
      staffName,
      note: args.asReturn ? "Returned unused" : "Replaced item",
      logType: args.asReturn ? "return" : "adjustment",
      qtyByMenuId: restoreQtyByMenuId,
    });
  }
}

/** Return unused sent units. Does not deduct stock (product goes back). */
export async function returnOrderItemUnits(args: {
  licenseKey: string;
  orderId?: string;
  tableId?: string;
  staffId?: string;
  staffName?: string;
  itemIds: string[];
  quantity: number;
}) {
  await voidItemUnits({
    ...args,
    asReturn: true,
  });
}

export async function updateOrderStatus(_args: Record<string, unknown>) {
  return null;
}
export async function updateItemQuantity(_args: Record<string, unknown>) {
  return null;
}
export async function removeItemFromOrder(_args: Record<string, unknown>) {
  return null;
}
export async function updateItemStatus(_args: Record<string, unknown>) {
  return null;
}
export async function generateFiscalCoupon(_args: Record<string, unknown>) {
  return null;
}

/** Paid sales that can still be promoted to fiscal (non_fiscal / no_receipt). */
export async function getNonFiscalOrders(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  const r = await getRestaurantByLicense(licenseKey);
  const { data: rows, error } = await supabase
    .from("sales")
    .select("*")
    .eq("restaurant_id", r.id)
    .eq("status", "paid")
    .in("payment_type", ["non_fiscal", "no_receipt"])
    .order("created_at", { ascending: false })
    .limit(200);
  assertNoPgError("Load non-fiscal orders", error);

  const staffIds = [
    ...new Set(
      (rows ?? [])
        .map((x) => x.staff_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const staffMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: stRows, error: stErr } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", staffIds);
    assertNoPgError("Load staff for non-fiscal list", stErr);
    for (const s of stRows ?? []) {
      staffMap.set(String(s.id), String(s.name ?? "Unknown"));
    }
  }

  const floorIds = [
    ...new Set(
      (rows ?? [])
        .map((row) => saleFloorTableId(row as Parameters<typeof saleFloorTableId>[0]))
        .filter((id) => id.trim() !== ""),
    ),
  ];
  const tableNameById = new Map<string, string>();
  if (floorIds.length > 0) {
    const { data: tblRows, error: tblErr } = await supabase
      .from("pos_floor_tables")
      .select("id, name")
      .in("id", floorIds);
    if (!tblErr) {
      for (const t of tblRows ?? []) {
        tableNameById.set(String(t.id), String(t.name ?? "Table"));
      }
    }
  }

  return (rows ?? []).map((row) => {
    const doc = saleToOrderDoc(row as Parameters<typeof saleToOrderDoc>[0]);
    const fid = saleFloorTableId(row as Parameters<typeof saleFloorTableId>[0]);
    const tableName = fid ? (tableNameById.get(fid) ?? "Unknown") : "Unknown";
    const sid = row.staff_id ? String(row.staff_id) : "";
    return {
      _id: doc._id,
      orderNumber: doc.orderNumber,
      tableName,
      staffName: sid ? (staffMap.get(sid) ?? "Unknown") : "Unknown",
      total: doc.total,
      paidAt: doc.paidAt,
      paymentType: doc.paymentType,
    };
  });
}

/**
 * Manager/admin: mark a paid non-fiscal sale as fiscal (same as printing a fiscal receipt after the fact).
 */
function staffRoleIsAdminOrManager(role: unknown): boolean {
  const r = String(role ?? "")
    .trim()
    .toLowerCase();
  return r === "admin" || r === "manager";
}

export async function fiscalizeOrderBulk(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  const orderId = args.orderId as string;
  const staffIdArg = args.staffId as string;
  const sid = uuidOrNull(staffIdArg);
  const localAdmin = isLocalDevicePosAdmin(staffIdArg);
  if (!sid && !localAdmin) {
    throw new Error("Only registered staff can fiscalize orders.");
  }

  const r = await getRestaurantByLicense(licenseKey);

  if (sid) {
    const { data: staff, error: stErr } = await supabase
      .from("staff")
      .select("id, role")
      .eq("id", sid)
      .maybeSingle();
    assertNoPgError("Load staff for fiscalize", stErr);
    if (!staff || !staffRoleIsAdminOrManager(staff.role)) {
      throw new Error("Only admin or manager can fiscalize orders.");
    }
  }

  let saleRes = await supabase
    .from("sales")
    .select("id, restaurant_id, status, payment_type, order_number, total")
    .eq("id", orderId)
    .maybeSingle();
  if (
    saleRes.error &&
    isMissingPgColumnError(saleRes.error.message, "order_number")
  ) {
    console.warn(
      "[POS] sales.order_number missing for fiscalize; audit uses derived #. Apply supabase/ensure_sales_order_number.sql for DB order numbers.",
    );
    saleRes = await supabase
      .from("sales")
      .select("id, restaurant_id, status, payment_type, total")
      .eq("id", orderId)
      .maybeSingle();
  }
  assertNoPgError("Load sale to fiscalize", saleRes.error);
  const sale = saleRes.data;
  if (!sale || String(sale.restaurant_id) !== r.id) {
    throw new Error("Order not found.");
  }
  if (String(sale.status) !== "paid") {
    throw new Error("Can only fiscalize paid orders.");
  }

  const pt = String(sale.payment_type ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (pt === "fiscal") {
    return { skipped: true as const };
  }
  if (pt !== "non_fiscal" && pt !== "no_receipt" && pt !== "") {
    throw new Error("This payment type cannot be converted to fiscal.");
  }

  const { error: upErr } = await supabase
    .from("sales")
    .update({ payment_type: "fiscal" })
    .eq("id", orderId);
  assertNoPgError("Mark sale as fiscal", upErr);

  try {
    const staffName = String(args.staffName ?? "").trim() || "Staff";
    const on = displayOrderNumber(
      String(sale.id),
      sale.order_number as number | null | undefined,
    );
    await insertAuditLog({
      licenseKey,
      staffId: sid ?? undefined,
      staffName,
      action: "late_fiscal",
      details: `Late fiscal coupon for Order #${on} ($${Number(sale.total ?? 0).toFixed(2)}) — ${staffName}`,
      metadata: { orderId: sale.id, orderNumber: on },
    });
  } catch (err) {
    console.warn("[POS] late_fiscal audit log:", err);
  }

  return { skipped: false as const };
}

export async function logBulkFiscalization(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  const staffIdArg = args.staffId as string;
  const staffName = String(args.staffName ?? "").trim() || "Staff";
  const count = Number(args.count ?? 0);
  const sid = uuidOrNull(staffIdArg);
  const localAdmin = isLocalDevicePosAdmin(staffIdArg);
  if ((!sid && !localAdmin) || count <= 0) return null;

  const r = await getRestaurantByLicense(licenseKey);

  let roleLabel = "Manager";
  if (sid) {
    const { data: staff, error: stErr } = await supabase
      .from("staff")
      .select("role")
      .eq("id", sid)
      .maybeSingle();
    assertNoPgError("Load staff for bulk fiscal log", stErr);
    if (!staff || !staffRoleIsAdminOrManager(staff.role)) {
      throw new Error("Only admin or manager can log bulk fiscalization.");
    }
    roleLabel = String(staff.role).toLowerCase() === "admin" ? "Admin" : "Manager";
  } else {
    roleLabel = "Device admin";
  }

  await insertAuditLog({
    licenseKey,
    staffId: sid ?? undefined,
    staffName,
    action: "bulk_fiscal",
    details: `${roleLabel} ${staffName} performed bulk fiscalization on ${count} order${count === 1 ? "" : "s"}`,
    metadata: { count, localDeviceAdmin: localAdmin },
  });
  return null;
}

function sortOpenSalesByCreatedAsc(
  rows: { id: string; created_at?: string | null }[],
) {
  return [...rows].sort((a, b) => {
    const ta = new Date(String(a.created_at ?? 0)).getTime();
    const tb = new Date(String(b.created_at ?? 0)).getTime();
    return ta - tb;
  });
}

async function patchSaleTableLink(saleId: string, tableId: string) {
  const tid = tableId.trim();
  const tableUuid = uuidOrNull(tid);
  const updateRow: Record<string, unknown> = { table_ref: tid };
  if (tableUuid) updateRow.table_id = tableUuid;
  else updateRow.table_id = null;
  const { error } = await supabase
    .from("sales")
    .update(updateRow)
    .eq("id", saleId);
  assertNoPgError("Update sale table link", error);
}

async function syncFloorStatusFromOpenSales(
  restaurantId: string,
  tableId: string,
) {
  const open = await loadOpenSalesForTable(restaurantId, tableId);
  const next = open.length > 0 ? "occupied" : "available";
  await updateFloorTableStatusSafe(
    tableId,
    next,
    "Sync floor status after table transfer/merge",
  );
}

export async function transferOrdersToTable(args: {
  licenseKey: string;
  fromTableId: string;
  toTableId: string;
  staffId: string;
  staffName: string;
}) {
  const from = args.fromTableId.trim();
  const to = args.toTableId.trim();
  if (!from || !to || from === to) {
    throw new Error("Invalid source or target table.");
  }

  await assertStaffPermission({
    licenseKey: args.licenseKey,
    staffId: args.staffId,
    permission: "canTransferTables",
  });
  const r = await getRestaurantByLicense(args.licenseKey);
  const sourceSales = await loadOpenSalesForTable(r.id, from);
  if (sourceSales.length === 0) {
    throw new Error("No open order on this table to transfer.");
  }

  const destSales = await loadOpenSalesForTable(r.id, to);
  if (destSales.length > 0) {
    throw new Error(
      "Target table already has an open bill. Use merge to combine tables.",
    );
  }

  for (const row of sourceSales) {
    const saleId = String((row as { id: string }).id);
    await assertSaleStaffCanEditForTableMove(saleId, args.staffId);
    await patchSaleTableLink(saleId, to);
  }

  await syncFloorStatusFromOpenSales(r.id, from);
  await syncFloorStatusFromOpenSales(r.id, to);

  const fromName = await getFloorTableNameOrUnknown(from);
  const toName = await getFloorTableNameOrUnknown(to);
  const saleIds = sourceSales.map((s) => String((s as { id: string }).id));

  await insertAuditLog({
    licenseKey: args.licenseKey,
    staffId: uuidOrNull(args.staffId) ?? undefined,
    staffName: args.staffName.trim() || "Staff",
    action: "table_transfer",
    details: `Transferred ${sourceSales.length} open bill(s) from ${fromName} to ${toName}`,
    metadata: {
      fromTableId: from,
      toTableId: to,
      saleIds,
    },
  });

  return { ok: true as const };
}

export async function mergeTableOrders(args: {
  licenseKey: string;
  fromTableId: string;
  toTableId: string;
  staffId: string;
  staffName: string;
}) {
  const from = args.fromTableId.trim();
  const to = args.toTableId.trim();
  if (!from || !to || from === to) {
    throw new Error("Invalid source or target table.");
  }

  await assertStaffPermission({
    licenseKey: args.licenseKey,
    staffId: args.staffId,
    permission: "canMergeTables",
  });
  const r = await getRestaurantByLicense(args.licenseKey);
  const sourceRows = await loadOpenSalesForTable(r.id, from);
  const destRows = await loadOpenSalesForTable(r.id, to);

  if (sourceRows.length === 0) {
    throw new Error("No open order on the source table to merge.");
  }
  if (destRows.length === 0) {
    throw new Error(
      "Target table has no open bill. Use transfer to move the order.",
    );
  }
  if (destRows.length > 1) {
    throw new Error(
      "Target table has more than one open bill. Resolve them before merging.",
    );
  }

  const destSorted = sortOpenSalesByCreatedAsc(
    destRows as { id: string; created_at?: string | null }[],
  );
  const primaryDestId = destSorted[0]!.id;

  const sourceSorted = sortOpenSalesByCreatedAsc(
    sourceRows as { id: string; created_at?: string | null }[],
  );

  await assertSaleStaffCanEditForTableMove(primaryDestId, args.staffId);

  for (const src of sourceSorted) {
    if (src.id === primaryDestId) continue;
    await assertSaleStaffCanEditForTableMove(src.id, args.staffId);

    const { error: mvErr } = await supabase
      .from("sale_items")
      .update({ sale_id: primaryDestId })
      .eq("sale_id", src.id);
    assertNoPgError("Merge sale lines", mvErr);

    const { error: cxErr } = await supabase
      .from("sales")
      .update({ status: "cancelled" })
      .eq("id", src.id);
    assertNoPgError("Cancel merged source sale", cxErr);
  }

  await recalcSaleTotals(primaryDestId);
  await syncFloorStatusFromOpenSales(r.id, from);
  await syncFloorStatusFromOpenSales(r.id, to);

  const fromName = await getFloorTableNameOrUnknown(from);
  const toName = await getFloorTableNameOrUnknown(to);
  const mergedSaleIds = sourceSorted
    .filter((s) => s.id !== primaryDestId)
    .map((s) => s.id);

  await insertAuditLog({
    licenseKey: args.licenseKey,
    staffId: uuidOrNull(args.staffId) ?? undefined,
    staffName: args.staffName.trim() || "Staff",
    action: "table_merge",
    details: `Merged bill(s) from ${fromName} into ${toName}`,
    metadata: {
      fromTableId: from,
      toTableId: to,
      targetSaleId: primaryDestId,
      mergedSaleIds,
    },
  });

  return { ok: true as const, targetOrderId: primaryDestId };
}
