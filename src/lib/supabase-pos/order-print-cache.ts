/**
 * Resolve order+items for local bill/receipt printing when offline.
 * Prefers in-memory TanStack cache, then IndexedDB, then live Supabase.
 */

import { queryClient } from "@/components/providers/query-client.tsx";
import { getDataCache, saveDataCache } from "@/lib/local-db.ts";
import { posQueryKey, runPosQuery } from "@/lib/supabase-pos/pos-router.ts";

export type OrderWithItemsForPrint = {
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    notes?: string;
    station?: string;
    status: string;
  }>;
  tableName?: string;
  staffName?: string;
  orderNumber?: number;
  subtotal: number;
  tax: number;
  total: number;
  customerName?: string;
  _id: string;
};

export function orderWithItemsIndexedDbKey(
  licenseKey: string,
  orderId: string,
): string {
  return `orderWithItems:${licenseKey}:${orderId}`;
}

function asOrderWithItems(value: unknown): OrderWithItemsForPrint | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Partial<OrderWithItemsForPrint>;
  if (!Array.isArray(row.items) || typeof row._id !== "string") return undefined;
  return row as OrderWithItemsForPrint;
}

export async function cacheOrderWithItems(
  licenseKey: string,
  orderId: string,
  value: unknown,
): Promise<void> {
  const parsed = asOrderWithItems(value);
  if (!parsed) return;
  await saveDataCache(orderWithItemsIndexedDbKey(licenseKey, orderId), parsed);
}

export async function getCachedOrderWithItems(
  licenseKey: string,
  orderId: string,
): Promise<OrderWithItemsForPrint | undefined> {
  const fromTan = asOrderWithItems(
    queryClient.getQueryData(
      posQueryKey("pos.orders.getOrderWithItems", { licenseKey, orderId }),
    ),
  );
  if (fromTan) return fromTan;

  return asOrderWithItems(
    await getDataCache(orderWithItemsIndexedDbKey(licenseKey, orderId)),
  );
}

/** Cache-first, then network. Throws if neither has a usable order. */
export async function resolveOrderWithItemsForPrint(
  licenseKey: string,
  orderId: string,
): Promise<OrderWithItemsForPrint> {
  const cached = await getCachedOrderWithItems(licenseKey, orderId);
  if (cached) return cached;

  const live = asOrderWithItems(
    await runPosQuery("pos.orders.getOrderWithItems", { licenseKey, orderId }),
  );
  if (!live) throw new Error("Order not found");
  void cacheOrderWithItems(licenseKey, orderId, live);
  return live;
}
