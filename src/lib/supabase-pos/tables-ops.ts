import { nextFloorTableSlot } from "@/lib/pos-floor-layout.ts";
import { supabase } from "@/lib/supabase.ts";
import { isMissingPgColumnError } from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { floorTableFromRow } from "./mappers.ts";
import { isPostgrestExposeOrCacheError } from "./floor-sync.ts";
export async function getTables(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const { data, error } = await supabase
    .from("pos_floor_tables")
    .select("*")
    .eq("restaurant_id", r.id)
    .order("zone", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) =>
    floorTableFromRow(row as Parameters<typeof floorTableFromRow>[0]),
  );
}

export function isOpenSaleStatus(status: unknown): boolean {
  const st = String(status ?? "").toLowerCase();
  return st !== "paid" && st !== "cancelled" && st !== "voided";
}

function normalizeUuidLower(s: string): string | null {
  const t = s.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t)
    ? t
    : null;
}

/**
 * Same linkage as `getOrdersByTable`: `table_ref` first, then `table_id`.
 * Tries normalized UUID on `table_ref` (text column casing / backfill) so the floor is not stuck on "Free".
 */
export async function loadOpenSalesForTable(
  restaurantId: string,
  tableId: string,
): Promise<
  { staff_id?: string | null; total?: number | string | null }[]
> {
  const tid = String(tableId).trim();
  if (!tid) return [];

  const fetchOpen = async (
    column: "table_ref" | "table_id",
    value: string,
  ) => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq(column, value);
    if (error) return [];
    return (data ?? []).filter((s) => isOpenSaleStatus(s.status));
  };

  const byRefExact = await fetchOpen("table_ref", tid);
  if (byRefExact.length) return byRefExact;

  const uuidLo = normalizeUuidLower(tid);
  if (uuidLo && uuidLo !== tid) {
    const byRefNorm = await fetchOpen("table_ref", uuidLo);
    if (byRefNorm.length) return byRefNorm;
  }

  if (uuidLo) {
    const byTableId = await fetchOpen("table_id", uuidLo);
    if (byTableId.length) return byTableId;
  }

  return [];
}

export async function getTableOrderSummaries(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const tables = await getTables(licenseKey);
  const summaries: Record<
    string,
    { staffId: string; staffName: string; total: number }
  > = {};

  const pairs = await Promise.all(
    tables.map(async (t) => ({
      table: t,
      rows: await loadOpenSalesForTable(r.id, t._id),
    })),
  );

  const staffIds = new Set<string>();
  for (const { rows } of pairs) {
    for (const row of rows) {
      if (row.staff_id) staffIds.add(String(row.staff_id));
    }
  }

  const staffMap: Record<string, string> = {};
  if (staffIds.size > 0) {
    const { data: staffRows } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", [...staffIds]);
    for (const s of staffRows ?? []) {
      staffMap[s.id] = s.name;
      staffMap[String(s.id).toLowerCase()] = s.name;
    }
  }

  for (const { table, rows } of pairs) {
    if (!rows.length) continue;

    const total = rows.reduce((sum, o) => sum + Number(o.total ?? 0), 0);
    const primary =
      rows.find((o) => o.staff_id) ?? rows[rows.length - 1];
    const sid = primary.staff_id as string | null;

    summaries[table._id] = {
      staffId: sid ?? "",
      staffName: sid
        ? (staffMap[sid] ??
            staffMap[String(sid).toLowerCase()] ??
            "Unknown")
        : "Open",
      total,
    };
  }

  return summaries;
}

export async function createTable(args: {
  licenseKey: string;
  name?: string;
  seats: number;
  zone: string;
  posX?: number;
  posY?: number;
  shape?: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const existing = await getTables(args.licenseKey);
  const zoneTables = existing.filter((t) => t.zone === args.zone);
  const tableName =
    args.name?.trim() ||
    `T${zoneTables.length + 1}`;

  const slot = nextFloorTableSlot(zoneTables.length);
  const full = {
    restaurant_id: r.id,
    name: tableName,
    seats: args.seats,
    zone: args.zone.trim(),
    pos_x: args.posX ?? slot.posX,
    pos_y: args.posY ?? slot.posY,
    shape: (args.shape as string | undefined) ?? "square",
    status: "available" as const,
  };

  let { data, error } = await supabase
    .from("pos_floor_tables")
    .insert(full)
    .select("id")
    .single();

  const msg = error?.message ?? "";
  const missingLayoutCol =
    isMissingPgColumnError(msg, "shape") ||
    isMissingPgColumnError(msg, "pos_x") ||
    isMissingPgColumnError(msg, "pos_y") ||
    isMissingPgColumnError(msg, "table_scale");

  if (error && missingLayoutCol) {
    ({ data, error } = await supabase
      .from("pos_floor_tables")
      .insert({
        restaurant_id: r.id,
        name: tableName,
        seats: args.seats,
        zone: args.zone.trim(),
        status: "available",
      })
      .select("id")
      .single());
  }

  if (error) {
    const m = error.message ?? String(error);
    if (isPostgrestExposeOrCacheError(m)) {
      throw new Error(
        "Floor tables API unavailable. In Supabase run migration 002 (pos_floor_tables), then: NOTIFY pgrst, 'reload schema'; or wait ~1 minute.",
      );
    }
    throw new Error(
      [m, error.hint].filter((x): x is string => Boolean(x?.trim())).join(" — "),
    );
  }
  return data!.id as string;
}

export async function deleteTable(args: {
  licenseKey: string;
  tableId: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("pos_floor_tables")
    .delete()
    .eq("id", args.tableId);
  if (error) throw error;
}

export async function updateTable(args: {
  licenseKey: string;
  tableId: string;
  name?: string;
  seats?: number;
  zone?: string;
  shape?: string;
  tableScale?: number;
  tableScaleY?: number;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const patch: Record<string, unknown> = {};
  if (args.name != null) patch.name = args.name;
  if (args.seats != null) patch.seats = args.seats;
  if (args.zone != null) patch.zone = args.zone;
  if (args.shape != null) patch.shape = args.shape;
  if (args.tableScale != null) patch.table_scale = args.tableScale;
  if (args.tableScaleY != null) patch.table_scale_y = args.tableScaleY;

  let { error } = await supabase
    .from("pos_floor_tables")
    .update(patch)
    .eq("id", args.tableId);

  if (
    error &&
    args.tableScaleY != null &&
    isMissingPgColumnError(error.message ?? "", "table_scale_y")
  ) {
    delete patch.table_scale_y;
    ({ error } = await supabase
      .from("pos_floor_tables")
      .update(patch)
      .eq("id", args.tableId));
  }
  if (error) throw error;
}

export async function moveTable(args: {
  licenseKey: string;
  tableId: string;
  posX: number;
  posY: number;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("pos_floor_tables")
    .update({ pos_x: args.posX, pos_y: args.posY })
    .eq("id", args.tableId);
  if (error) throw error;
}

export async function renameZone(args: {
  licenseKey: string;
  oldName: string;
  newName: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("pos_floor_tables")
    .update({ zone: args.newName.trim() })
    .eq("restaurant_id", r.id)
    .eq("zone", args.oldName);
  if (error) throw error;
}

export async function deleteZone(args: {
  licenseKey: string;
  zone: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("pos_floor_tables")
    .delete()
    .eq("restaurant_id", r.id)
    .eq("zone", args.zone);
  if (error) throw error;
}

export async function setTableStatus(args: {
  licenseKey: string;
  tableId: string;
  status: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("pos_floor_tables")
    .update({ status: args.status })
    .eq("id", args.tableId);
  if (error) throw error;
}
