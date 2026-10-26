export type StaffMealRule = {
  allowed: boolean;
  /** Price after free units. 0 = remaining units are also free. */
  staffPrice: number;
  /** First N units per local calendar day are free. */
  freeQty: number;
  /** Max units per staff per local calendar day. 0 = unlimited. */
  dailyLimit: number;
};

export type StaffMealCharge = {
  allowedQty: number;
  blocked: boolean;
  freeQty: number;
  paidQty: number;
  staffPrice: number;
  total: number;
  unitCharges: number[];
};

type StaffMealFields = {
  staffMealAllowed?: boolean | null;
  staffMealPrice?: number | null;
  staffMealFreeQty?: number | null;
  staffMealDailyLimit?: number | null;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isStaffMealAllowed(item: StaffMealFields | null | undefined): boolean {
  if (item?.staffMealAllowed !== true) return false;
  return (
    item.staffMealPrice != null ||
    item.staffMealFreeQty != null ||
    item.staffMealDailyLimit != null
  );
}

export function normalizeStaffMealRule(
  raw: StaffMealFields | null | undefined,
): StaffMealRule {
  const staffPrice = Number(raw?.staffMealPrice);
  const freeQty = Number(raw?.staffMealFreeQty);
  const dailyLimit = Number(raw?.staffMealDailyLimit);
  return {
    allowed: raw?.staffMealAllowed === true,
    staffPrice: Number.isFinite(staffPrice) && staffPrice > 0 ? staffPrice : 0,
    freeQty: Number.isFinite(freeQty) && freeQty > 0 ? Math.floor(freeQty) : 0,
    dailyLimit:
      Number.isFinite(dailyLimit) && dailyLimit > 0 ? Math.floor(dailyLimit) : 0,
  };
}

export function isSameLocalCalendarDay(
  iso: string | undefined,
  now = new Date(),
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function qtyUsedToday(
  entries:
    | Array<{ createdAt?: string; items?: unknown[] }>
    | undefined,
  menuItemId: string,
): number {
  if (!entries?.length) return 0;
  const id = String(menuItemId);
  let qty = 0;
  for (const entry of entries) {
    if (!isSameLocalCalendarDay(entry.createdAt)) continue;
    const items = Array.isArray(entry.items) ? entry.items : [];
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const rec = raw as Record<string, unknown>;
      const mid = String(rec.menuItemId ?? rec.menu_item_id ?? "");
      if (mid !== id) continue;
      const q = Number(rec.quantity);
      if (Number.isFinite(q) && q > 0) qty += q;
    }
  }
  return qty;
}

export function remainingStaffMealQty(
  rule: StaffMealRule,
  used: number,
): number | null {
  if (rule.dailyLimit <= 0) return null;
  return Math.max(0, rule.dailyLimit - Math.max(0, used));
}

export function chargeStaffMeal(
  rule: StaffMealRule,
  alreadyUsed: number,
  requestedQty: number,
): StaffMealCharge {
  const used = Math.max(0, alreadyUsed);
  const want = Math.max(0, Math.floor(requestedQty));
  const remaining = remainingStaffMealQty(rule, used);
  const allowedQty = remaining == null ? want : Math.min(want, remaining);
  const blocked = remaining != null && want > remaining;
  const freeLeft = Math.max(0, rule.freeQty - used);
  const freeQty = Math.min(allowedQty, freeLeft);
  const paidQty = allowedQty - freeQty;
  const staffPrice = rule.staffPrice;
  const unitCharges = [
    ...Array.from({ length: freeQty }, () => 0),
    ...Array.from({ length: paidQty }, () => staffPrice),
  ];
  return {
    allowedQty,
    blocked,
    freeQty,
    paidQty,
    staffPrice,
    total: roundMoney(paidQty * staffPrice),
    unitCharges,
  };
}

export function staffMealLimitError(
  name: string,
  limit: number,
): string {
  return `"${name}" is limited to ${limit} per day for staff. / "${name}" lejohet vetëm ${limit} copë në ditë.`;
}

export function staffMealNotAllowedError(name: string): string {
  return `"${name}" is not enabled for staff meals. / "${name}" nuk është i lejuar për vakt stafi.`;
}
