/** Map Supabase rows to Convex Doc-shaped objects the UI expects. */

export function staffFromRow(r: {
  id: string;
  created_at: string;
  name: string;
  role: string;
  pin_hash: string;
  is_active: boolean;
  permissions: Record<string, unknown> | null;
}) {
  return {
    _id: r.id,
    _creationTime: new Date(r.created_at).getTime(),
    name: r.name,
    role: r.role,
    pinHash: r.pin_hash,
    isActive: r.is_active,
    permissions: r.permissions ?? undefined,
  };
}

export function floorTableFromRow(r: {
  id: string;
  created_at: string;
  name: string;
  seats: number;
  zone: string;
  status: string;
  pos_x: number | null;
  pos_y: number | null;
  shape: string | null;
  table_scale: number | null;
}) {
  return {
    _id: r.id,
    _creationTime: new Date(r.created_at).getTime(),
    name: r.name,
    seats: r.seats,
    zone: r.zone,
    status: r.status,
    posX: r.pos_x ?? 100,
    posY: r.pos_y ?? 100,
    shape: (r.shape ?? "square") as "square" | "circle" | "rectangle",
    tableScale: r.table_scale != null ? Number(r.table_scale) : 1,
  };
}

export function menuCategoryFromRow(r: {
  id: string;
  created_at: string;
  name: string;
  color: string;
  display_order: number;
  is_active: boolean;
  icon?: string | null;
}) {
  return {
    _id: r.id,
    _creationTime: new Date(r.created_at).getTime(),
    name: r.name,
    color: r.color,
    displayOrder: r.display_order,
    isActive: r.is_active,
    icon: r.icon?.trim() ? r.icon.trim() : undefined,
  };
}

export function menuItemFromRow(r: {
  id: string;
  created_at: string;
  category_id: string | null;
  menu_id: string | null;
  name: string;
  description: string | null;
  price: number | string;
  available: boolean;
  display_order: number;
  station: string | null;
  vat_rate: number | string | null;
  image_url: string | null;
  is_favorite: boolean | null;
  staff_meal_allowed?: boolean | null;
  total_sold: number | null;
  track_stock: boolean | null;
  stock_unit: string | null;
  current_stock: number | string | null;
  low_stock_threshold: number | string | null;
}) {
  return {
    _id: r.id,
    _creationTime: new Date(r.created_at).getTime(),
    categoryId: r.category_id ?? "",
    menuId: r.menu_id ?? undefined,
    name: r.name,
    description: r.description ?? undefined,
    price: Number(r.price),
    available: r.available,
    displayOrder: r.display_order,
    station: (r.station as "kitchen" | "bar" | undefined) ?? undefined,
    vatRate: r.vat_rate != null ? Number(r.vat_rate) : 0.2,
    imageStorageId: undefined,
    imageUrl: r.image_url ?? undefined,
    isFavorite: r.is_favorite ?? false,
    staffMealAllowed: r.staff_meal_allowed !== false,
    totalSold: r.total_sold ?? 0,
    trackStock: r.track_stock ?? false,
    stockUnit: r.stock_unit as never,
    currentStock:
      r.current_stock != null ? Number(r.current_stock) : undefined,
    lowStockThreshold:
      r.low_stock_threshold != null
        ? Number(r.low_stock_threshold)
        : undefined,
  };
}

export function menuFromRow(r: {
  id: string;
  created_at: string;
  name: string;
  display_order: number;
  is_active: boolean;
}) {
  return {
    _id: r.id,
    _creationTime: new Date(r.created_at).getTime(),
    name: r.name,
    displayOrder: r.display_order,
    isActive: r.is_active,
  };
}

/**
 * Prefer DB `order_number` (sequential per restaurant). Fallback only if still null
 * (e.g. column missing): pseudo-# from UUID — confusing for staff; keep column applied.
 */
export function displayOrderNumber(
  id: string,
  orderNumber: number | null | undefined,
): number {
  if (orderNumber != null && Number(orderNumber) > 0) return Number(orderNumber);
  const hex = id.replace(/-/g, "").slice(0, 10);
  const n = parseInt(hex, 16);
  if (!Number.isFinite(n) || n === 0) return 1;
  return (Math.abs(n) % 899_999) + 100_000;
}

/** Floor table UUID: prefer `table_id`, else legacy `table_ref` (text UUID) for stale PostgREST cache. */
export function saleFloorTableId(r: {
  table_id?: string | null;
  table_ref?: string | null;
}): string {
  const a = typeof r.table_id === "string" ? r.table_id.trim() : "";
  if (a) return a;
  const b = typeof r.table_ref === "string" ? r.table_ref.trim() : "";
  return b;
}

export function saleToOrderDoc(r: {
  id: string;
  created_at: string;
  restaurant_id: string;
  table_id?: string | null;
  table_ref?: string | null;
  staff_id: string | null;
  status: string;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  notes: string | null;
  payment_method: string | null;
  payment_type: string | null;
  customer_id: string | null;
  customer_name: string | null;
  paid_at: string | null;
  order_number?: number | null;
  paid_amount?: number | string | null;
}) {
  const paid =
    r.paid_amount != null && r.paid_amount !== ""
      ? Number(r.paid_amount)
      : 0;
  const totalNum = Number(r.total);
  return {
    _id: r.id,
    _creationTime: new Date(r.created_at).getTime(),
    restaurantId: r.restaurant_id,
    tableId: saleFloorTableId(r),
    staffId: r.staff_id ?? "",
    orderNumber: displayOrderNumber(r.id, r.order_number),
    status: r.status,
    subtotal: Number(r.subtotal),
    tax: Number(r.tax),
    total: totalNum,
    paidAmount: Math.round(Math.max(0, paid) * 100) / 100,
    balanceDue: Math.round(Math.max(0, totalNum - paid) * 100) / 100,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    paidAt: r.paid_at ?? undefined,
    paymentMethod: r.payment_method ?? undefined,
    paymentType: r.payment_type ?? undefined,
    customerId: r.customer_id ?? undefined,
    customerName: r.customer_name ?? undefined,
    fiscalStatus: String(r.payment_type ?? "").toLowerCase() === "fiscal",
  };
}
