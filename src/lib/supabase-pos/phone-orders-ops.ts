import { supabase } from "@/lib/supabase.ts";
import { assertNoPgError } from "./db-errors.ts";
import {
  displayOrderNumber,
  saleFloorTableId,
} from "./mappers.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { isOpenSaleStatus } from "./tables-ops.ts";

export type PhoneOrderUiStatus = "waiting" | "preparing" | "ready";

export type PhoneActiveOrderCard = {
  saleId: string;
  orderNumber: number;
  tableName: string;
  total: number;
  createdAt: string;
  items: { name: string; quantity: number }[];
  uiStatus: PhoneOrderUiStatus;
};

export type PhoneHistoryOrderRow = {
  saleId: string;
  orderNumber: number;
  tableName: string;
  total: number;
  paidAt: string | null;
  createdAt: string;
};

function startOfLocalDayIso(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return x.toISOString();
}

function deriveUiStatus(
  saleStatus: string,
  itemStatuses: string[],
): PhoneOrderUiStatus {
  const saleSt = String(saleStatus ?? "").toLowerCase();
  const relevant = itemStatuses.filter((s) => {
    const x = String(s ?? "").toLowerCase();
    return x !== "voided" && x !== "cancelled";
  });
  if (relevant.length === 0) {
    return saleSt === "sent-to-kitchen" ? "preparing" : "waiting";
  }
  const st = relevant.map((s) => String(s ?? "pending").toLowerCase());
  if (st.every((x) => x === "ready")) return "ready";
  if (st.some((x) => x === "sent" || x === "preparing")) return "preparing";
  if (saleSt === "sent-to-kitchen") return "preparing";
  return "waiting";
}

/**
 * Porosi të hapura (jo të paguara / jo të anuluara) për listën në app-in e telefonit.
 */
export async function fetchPhoneActiveOrders(
  licenseKey: string,
): Promise<PhoneActiveOrderCard[]> {
  const r = await getRestaurantByLicense(licenseKey);
  const { data: sales, error: sErr } = await supabase
    .from("sales")
    .select("id, order_number, status, table_id, table_ref, total, created_at")
    .eq("restaurant_id", r.id)
    .order("created_at", { ascending: false });
  assertNoPgError("Phone orders: sales", sErr);

  const open = (sales ?? []).filter((row) => isOpenSaleStatus(row.status));
  if (open.length === 0) return [];

  const saleIds = open.map((x) => String(x.id));
  const { data: lines, error: lErr } = await supabase
    .from("sale_items")
    .select("sale_id, name, quantity, status")
    .in("sale_id", saleIds);
  assertNoPgError("Phone orders: lines", lErr);

  const linesBySale = new Map<string, { name: string; quantity: number; status: string }[]>();
  for (const row of lines ?? []) {
    const sid = String(row.sale_id ?? "");
    const st = String(row.status ?? "").toLowerCase();
    if (st === "voided" || st === "cancelled") continue;
    const list = linesBySale.get(sid) ?? [];
    list.push({
      name: String(row.name ?? "Item"),
      quantity: Number(row.quantity ?? 0),
      status: String(row.status ?? "pending"),
    });
    linesBySale.set(sid, list);
  }

  const floorIds = [
    ...new Set(
      open
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

  const cards: PhoneActiveOrderCard[] = [];
  for (const sale of open) {
    const sid = String(sale.id);
    const rows = linesBySale.get(sid) ?? [];
    const fid = saleFloorTableId(sale as Parameters<typeof saleFloorTableId>[0]);
    const tableName = fid ? (tableNameById.get(fid) ?? "—") : "—";
    const uiStatus = deriveUiStatus(
      String(sale.status ?? ""),
      rows.map((x) => x.status),
    );
    const items = rows.map(({ name, quantity }) => ({ name, quantity }));
    cards.push({
      saleId: sid,
      orderNumber: displayOrderNumber(
        sid,
        (sale as { order_number?: number | null }).order_number,
      ),
      tableName,
      total: Number((sale as { total?: unknown }).total ?? 0),
      createdAt: String((sale as { created_at?: string }).created_at ?? ""),
      items,
      uiStatus,
    });
  }

  cards.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return cards;
}

/**
 * Porosi të paguara sot (historik i shkurtër në telefon).
 */
export async function fetchPhoneOrdersHistoryToday(
  licenseKey: string,
  limit = 25,
): Promise<PhoneHistoryOrderRow[]> {
  const r = await getRestaurantByLicense(licenseKey);
  const dayStart = startOfLocalDayIso(new Date());
  const { data: sales, error } = await supabase
    .from("sales")
    .select("id, order_number, status, table_id, table_ref, total, paid_at, created_at")
    .eq("restaurant_id", r.id)
    .eq("status", "paid")
    .gte("created_at", dayStart)
    .order("created_at", { ascending: false })
    .limit(limit);
  assertNoPgError("Phone orders: history", error);

  const rows = sales ?? [];
  const floorIds = [
    ...new Set(
      rows
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

  return rows.map((sale) => {
    const sid = String(sale.id);
    const fid = saleFloorTableId(sale as Parameters<typeof saleFloorTableId>[0]);
    const tableName = fid ? (tableNameById.get(fid) ?? "—") : "—";
    return {
      saleId: sid,
      orderNumber: displayOrderNumber(
        sid,
        (sale as { order_number?: number | null }).order_number,
      ),
      tableName,
      total: Number((sale as { total?: unknown }).total ?? 0),
      paidAt: (sale as { paid_at?: string | null }).paid_at ?? null,
      createdAt: String((sale as { created_at?: string }).created_at ?? ""),
    };
  });
}
