import { supabase } from "@/lib/supabase.ts";
import { isMissingPgColumnError } from "./db-errors.ts";
import { insertAuditLog } from "./dashboard-ops.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { uuidOrNull } from "./uuid.ts";
import { displayOrderNumber, saleFloorTableId } from "./mappers.ts";

function mapCustomer(c: Record<string, unknown>) {
  return {
    _id: c.id,
    _creationTime: new Date(c.created_at as string).getTime(),
    name: c.name,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    notes: c.notes ?? undefined,
    creditLimit:
      c.credit_limit != null ? Number(c.credit_limit) : undefined,
  };
}

export async function getDebtLedger(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("restaurant_id", r.id);

  const { data: orders } = await supabase
    .from("sales")
    .select("*")
    .eq("restaurant_id", r.id);

  const { data: payments } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("restaurant_id", r.id);

  const debtOrders = (orders ?? []).filter(
    (o) => o.payment_type === "debt" && o.status === "paid",
  );

  return (customers ?? []).map((customer) => {
    const custOrders = debtOrders.filter((o) => o.customer_id === customer.id);
    const custPayments = (payments ?? []).filter(
      (p) => p.customer_id === customer.id,
    );
    const totalDebt = custOrders.reduce((s, o) => s + Number(o.total), 0);
    const totalPaid = custPayments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.round((totalDebt - totalPaid) * 100) / 100;
    const sorted = [...custOrders].sort((a, b) =>
      (b.created_at as string).localeCompare(a.created_at as string),
    );
    return {
      ...mapCustomer(customer as Record<string, unknown>),
      totalDebt,
      totalPaid,
      balance,
      orderCount: custOrders.length,
      lastOrderDate: sorted[0]?.created_at ?? null,
    };
  });
}

export async function createCustomer(args: {
  licenseKey: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  creditLimit?: number;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("customers")
    .insert({
      restaurant_id: r.id,
      name: args.name.trim(),
      phone: args.phone ?? null,
      email: args.email ?? null,
      notes: args.notes ?? null,
      credit_limit: args.creditLimit ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

export async function updateCustomer(args: Record<string, unknown>) {
  await getRestaurantByLicense(args.licenseKey as string);
  const { error } = await supabase
    .from("customers")
    .update({
      name: args.name,
      phone: args.phone,
      email: args.email,
      notes: args.notes,
      credit_limit: args.creditLimit,
    })
    .eq("id", args.customerId as string);
  if (error) throw error;
}

export async function settleDebt(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  const r = await getRestaurantByLicense(licenseKey);
  const customerId = args.customerId as string;
  const amount = Number(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }
  const methodRaw = String(args.method ?? "cash").trim().toLowerCase();
  if (methodRaw !== "cash" && methodRaw !== "card" && methodRaw !== "other") {
    throw new Error("Invalid payment method.");
  }
  const staffName = String(args.staffName ?? "").trim() || "Unknown";

  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("name")
    .eq("id", customerId)
    .eq("restaurant_id", r.id)
    .maybeSingle();
  if (custErr) throw custErr;
  if (!customer) throw new Error("Customer not found for this venue.");
  const customerName = String(customer?.name ?? "Customer");

  const { error } = await supabase.from("debt_payments").insert({
    restaurant_id: r.id,
    customer_id: customerId,
    amount,
    method: methodRaw,
    staff_id: uuidOrNull(args.staffId as string),
    staff_name: staffName,
    notes: (args.notes as string) ?? null,
  });
  if (error) throw error;

  try {
    const notes = (args.notes as string | undefined)?.trim();
    let details = `Debt payment of $${amount.toFixed(2)} (${methodRaw}) from ${customerName}`;
    if (notes) details += ` — ${notes}`;
    await insertAuditLog({
      licenseKey,
      staffId: uuidOrNull(args.staffId as string) ?? undefined,
      staffName,
      action: "debt_settlement",
      details,
      metadata: { customerId, customerName, amount, method: methodRaw },
    });
  } catch (err) {
    console.warn("[POS] debt_settlement audit log:", err);
  }

  return { ok: true as const };
}

type StatementCharge = {
  type: "charge";
  id: string;
  date: string;
  amount: number;
  staffName: string;
  tableName: string;
  orderNumber: number;
  items: { name: string; quantity: number; price: number }[];
};

type StatementPayment = {
  type: "payment";
  id: string;
  date: string;
  amount: number;
  staffName: string;
  method: string;
  notes?: string;
};

export async function getCustomerStatement(args: {
  licenseKey: string;
  customerId: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);

  const { data: customerRow, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", args.customerId)
    .eq("restaurant_id", r.id)
    .maybeSingle();
  if (custErr) throw custErr;
  if (!customerRow) throw new Error("Customer not found");

  let debtSalesRes = await supabase
    .from("sales")
    .select(
      "id, total, paid_at, created_at, staff_id, table_id, table_ref, order_number",
    )
    .eq("restaurant_id", r.id)
    .eq("customer_id", args.customerId)
    .eq("payment_type", "debt")
    .eq("status", "paid");
  if (
    debtSalesRes.error &&
    isMissingPgColumnError(debtSalesRes.error.message, "order_number")
  ) {
    debtSalesRes = await supabase
      .from("sales")
      .select(
        "id, total, paid_at, created_at, staff_id, table_id, table_ref",
      )
      .eq("restaurant_id", r.id)
      .eq("customer_id", args.customerId)
      .eq("payment_type", "debt")
      .eq("status", "paid");
  }
  const { data: debtSales, error: salesErr } = debtSalesRes;
  if (salesErr) throw salesErr;

  const { data: paymentRows, error: payErr } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("restaurant_id", r.id)
    .eq("customer_id", args.customerId);
  if (payErr) throw payErr;

  const orders = debtSales ?? [];
  const saleIds = orders.map((o) => o.id as string).filter(Boolean);

  const staffIds = [
    ...new Set(
      orders
        .map((o) => o.staff_id as string | null | undefined)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const tableIds = [
    ...new Set(
      orders
        .map((o) => saleFloorTableId(o as { table_id?: string | null; table_ref?: string | null }))
        .filter(Boolean),
    ),
  ];

  const staffById: Record<string, string> = {};
  if (staffIds.length > 0) {
    const { data: staffRows, error: stErr } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", staffIds);
    if (!stErr) {
      for (const s of staffRows ?? []) {
        staffById[s.id] = s.name;
      }
    }
  }

  const tableById: Record<string, string> = {};
  if (tableIds.length > 0) {
    const { data: tableRows, error: tbErr } = await supabase
      .from("pos_floor_tables")
      .select("id, name")
      .in("id", tableIds);
    if (!tbErr) {
      for (const tbl of tableRows ?? []) {
        tableById[tbl.id] = tbl.name;
      }
    }
  }

  type LineRow = {
    sale_id: string;
    name: string;
    price: number | string;
    quantity: number | string;
    status: string;
  };
  let allLines: LineRow[] = [];
  if (saleIds.length > 0) {
    const { data: lines, error: liErr } = await supabase
      .from("sale_items")
      .select("sale_id, name, price, quantity, status")
      .in("sale_id", saleIds);
    if (!liErr) allLines = (lines ?? []) as LineRow[];
  }
  const linesBySale = new Map<string, LineRow[]>();
  for (const line of allLines) {
    const sid = line.sale_id;
    const arr = linesBySale.get(sid);
    if (arr) arr.push(line);
    else linesBySale.set(sid, [line]);
  }

  const chargeTransactions: StatementCharge[] = orders.map((order) => {
    const oid = order.id as string;
    const tid = saleFloorTableId(
      order as { table_id?: string | null; table_ref?: string | null },
    );
    const rawLines = linesBySale.get(oid) ?? [];
    const items = rawLines
      .filter(
        (i) => i.status !== "cancelled" && i.status !== "voided",
      )
      .map((i) => ({
        name: i.name,
        quantity: Number(i.quantity),
        price: Number(i.price),
      }));

    const dateRaw = (order.paid_at ?? order.created_at) as string;
    const staffId = order.staff_id as string | null | undefined;

    return {
      type: "charge" as const,
      id: oid,
      date: dateRaw,
      amount: Number(order.total),
      staffName: staffId ? staffById[staffId] ?? "Unknown" : "Unknown",
      tableName: tid ? tableById[tid] ?? "—" : "—",
      orderNumber: displayOrderNumber(
        oid,
        order.order_number as number | null | undefined,
      ),
      items,
    };
  });

  const paymentTransactions: StatementPayment[] = (paymentRows ?? []).map(
    (p) => ({
      type: "payment" as const,
      id: p.id as string,
      date: p.created_at as string,
      amount: Number(p.amount),
      staffName: String(p.staff_name ?? ""),
      method: String(p.method ?? "cash"),
      notes: p.notes ? String(p.notes) : undefined,
    }),
  );

  const transactions: (StatementCharge | StatementPayment)[] = [
    ...chargeTransactions,
    ...paymentTransactions,
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const totalDebt = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalPaid = (paymentRows ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const balance = Math.round((totalDebt - totalPaid) * 100) / 100;

  return {
    customer: mapCustomer(customerRow as Record<string, unknown>),
    transactions,
    totalDebt,
    totalPaid,
    balance,
  };
}
