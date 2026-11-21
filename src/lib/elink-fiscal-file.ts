/**
 * Drops a Datecs/FPrint coupon into C:\Temp for Enternet E-Link.
 * Tax group numbers match C:\Program Files\E-Link\appsettings.json:
 * 5 → E (18%), 4 → D (8%), 3 → C (0%).
 */

import { resolveOrderWithItemsForPrint } from "@/lib/supabase-pos/order-print-cache.ts";

type FiscalItem = {
  _id?: string;
  menuItemId?: string;
  name?: string;
  price?: number;
  quantity?: number;
  status?: string;
  vatRate?: number;
};

export type ElinkFiscalResult = { ok: boolean; error?: string; path?: string };

function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function quantity(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3);
}

function articleName(name: string): string {
  const clean = name.replace(/[;\r\n]/g, " ").replace(/\s+/g, " ").trim();
  const cut = Array.from(clean).slice(0, 30).join("");
  return cut || "Artikull";
}

/** Kosovo Datecs groups programmed in this PC's E-Link config. */
function taxGroup(vatRate: unknown): number {
  let rate = Number(vatRate);
  if (!Number.isFinite(rate) || rate < 0) rate = 0.18;
  if (rate > 1) rate = rate / 100;
  if (rate >= 0.12) return 5;
  if (rate >= 0.04) return 4;
  return 3;
}

function paymentCode(method: string | undefined): number {
  if (method === "card") return 3;
  if (method === "cash" || !method) return 0;
  return 1;
}

/**
 * Enternet field order:
 * name;price;qty;stand;group;tax;0;PLU;discount%;discount value
 * PLU 0 is rejected by the fiscal printer (article does not exist).
 */
function pluCode(item: FiscalItem): string {
  const raw = String(item.menuItemId ?? item._id ?? item.name ?? "artikull");
  let hash = 2166136261;
  for (const ch of raw) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return String((hash >>> 0) % 899999 + 100000);
}

function buildCouponBody(
  items: FiscalItem[],
  method: string | undefined,
  settled?: { id: string; quantity: number }[],
  payAmount?: number,
): { body: string; orderSum: number } | { error: "partial" | "no-lines" } {
  const active = items.filter((item) => item.status !== "cancelled" && item.status !== "voided");
  const settledQty = new Map<string, number>();
  if (settled && settled.length > 0) {
    for (const line of settled) {
      const id = line.id.trim();
      const qty = Number(line.quantity);
      if (!id || !Number.isFinite(qty) || qty <= 0) continue;
      settledQty.set(id, (settledQty.get(id) ?? 0) + qty);
    }
  }

  const chosen =
    settledQty.size > 0
      ? active.filter((item) => item._id && settledQty.has(item._id))
      : active;

  const fullSum = active.reduce((sum, item) => {
    const price = Number(item.price);
    const qty = Number(item.quantity);
    if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) return sum;
    return sum + Math.round(price * qty * 100) / 100;
  }, 0);

  if (
    settledQty.size === 0 &&
    payAmount != null &&
    payAmount > 0 &&
    payAmount < fullSum - 0.009
  ) {
    return { error: "partial" };
  }

  const commands: string[] = [];
  let total = 0;
  for (const item of chosen) {
    const price = Number(item.price);
    let qty = Number(item.quantity);
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(qty) || qty <= 0) continue;
    if (item._id && settledQty.has(item._id)) {
      qty = Math.min(qty, settledQty.get(item._id) ?? qty);
    }
    if (qty <= 0) continue;
    const lineTotal = Math.round(price * qty * 100) / 100;
    total += lineTotal;
    commands.push(
      `S,1,______,_,__;${articleName(String(item.name ?? ""))};${money(price)};${quantity(qty)};1;1;${taxGroup(item.vatRate)};0;${pluCode(item)};0;0;`,
    );
  }

  if (commands.length === 0 || total <= 0) return { error: "no-lines" };

  commands.push(`T,1,______,_,__;${paymentCode(method)}`);
  return { body: commands.join("\n"), orderSum: total };
}

/** Writes the lines just sent, without waiting for payment. */
export async function sendLinesFiscalFileToElink(args: {
  lines: FiscalItem[];
  orderRef: string;
  paymentMethod?: string;
}): Promise<ElinkFiscalResult> {
  const write = window.desktop?.writeElinkFiscalFile;
  if (!write) return { ok: false, error: "elink-desktop" };

  const built = buildCouponBody(args.lines, args.paymentMethod);
  if ("error" in built) return { ok: false, error: built.error === "partial" ? "elink-partial" : "elink" };

  const written = await write({ body: built.body, orderRef: args.orderRef });
  if (!written.ok) return { ok: false, error: "elink" };
  return written;
}

export async function sendOrderFiscalFileToElink(args: {
  licenseKey: string;
  orderId: string;
  paymentMethod?: string;
  settledSaleItems?: { id: string; quantity: number }[];
  payAmount?: number;
  orderNumber?: number;
}): Promise<ElinkFiscalResult> {
  const write = window.desktop?.writeElinkFiscalFile;
  if (!write) return { ok: false, error: "elink-desktop" };

  const raw = await resolveOrderWithItemsForPrint(args.licenseKey, args.orderId);
  const built = buildCouponBody(
    (raw.items ?? []) as FiscalItem[],
    args.paymentMethod,
    args.settledSaleItems,
    args.payAmount,
  );
  if ("error" in built) return { ok: false, error: built.error === "partial" ? "elink-partial" : "elink" };

  const orderRef =
    args.orderNumber != null
      ? String(args.orderNumber)
      : raw.orderNumber != null
        ? String(raw.orderNumber)
        : args.orderId.slice(0, 8);

  const written = await write({ body: built.body, orderRef });
  if (!written.ok) return { ok: false, error: "elink" };
  return written;
}
