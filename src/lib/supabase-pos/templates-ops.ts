import { supabase } from "@/lib/supabase.ts";
import { assertNoPgError } from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { uuidOrNull } from "./uuid.ts";

const TEMPLATE_TYPES = [
  "fiscal_receipt",
  "non_fiscal_receipt",
  "kitchen_ticket",
  "bar_ticket",
  "waiter_shift_report",
  "x_report",
  "z_report",
  "complimentary_slip",
  "expense_voucher",
  "debt_voucher",
] as const;

type TemplateType = (typeof TEMPLATE_TYPES)[number];

function isTemplateType(s: string): s is TemplateType {
  return (TEMPLATE_TYPES as readonly string[]).includes(s);
}

const DEFAULT_TOGGLES: Record<
  TemplateType,
  {
    logo: boolean;
    headerText: boolean;
    footerText: boolean;
    waiterName: boolean;
    tableNumber: boolean;
    timestamp: boolean;
    unitPrices: boolean;
    taxDetails: boolean;
    orderNumber: boolean;
  }
> = {
  fiscal_receipt: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: true,
    taxDetails: true,
    orderNumber: true,
  },
  non_fiscal_receipt: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: true,
    taxDetails: false,
    orderNumber: true,
  },
  kitchen_ticket: {
    logo: false,
    headerText: true,
    footerText: false,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: false,
    taxDetails: false,
    orderNumber: true,
  },
  bar_ticket: {
    logo: false,
    headerText: true,
    footerText: false,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: false,
    taxDetails: false,
    orderNumber: true,
  },
  waiter_shift_report: {
    logo: true,
    headerText: true,
    footerText: false,
    waiterName: true,
    tableNumber: false,
    timestamp: true,
    unitPrices: false,
    taxDetails: true,
    orderNumber: false,
  },
  x_report: {
    logo: true,
    headerText: true,
    footerText: false,
    waiterName: false,
    tableNumber: false,
    timestamp: true,
    unitPrices: false,
    taxDetails: true,
    orderNumber: false,
  },
  z_report: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: false,
    tableNumber: false,
    timestamp: true,
    unitPrices: false,
    taxDetails: true,
    orderNumber: false,
  },
  complimentary_slip: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: false,
    taxDetails: false,
    orderNumber: true,
  },
  expense_voucher: {
    logo: true,
    headerText: true,
    footerText: false,
    waiterName: true,
    tableNumber: false,
    timestamp: true,
    unitPrices: false,
    taxDetails: false,
    orderNumber: false,
  },
  debt_voucher: {
    logo: true,
    headerText: true,
    footerText: true,
    waiterName: true,
    tableNumber: true,
    timestamp: true,
    unitPrices: true,
    taxDetails: false,
    orderNumber: true,
  },
};

const DEFAULT_LABELS: Record<
  TemplateType,
  { headerText: string; footerText: string }
> = {
  fiscal_receipt: {
    headerText: "FISCAL RECEIPT\nFiscal Receipt",
    footerText: "Thank you for your visit!",
  },
  non_fiscal_receipt: {
    headerText: "PRE-BILL",
    footerText: "This is not a fiscal document",
  },
  kitchen_ticket: {
    headerText: "KITCHEN ORDER",
    footerText: "",
  },
  bar_ticket: {
    headerText: "BAR ORDER",
    footerText: "",
  },
  waiter_shift_report: {
    headerText: "SHIFT REPORT",
    footerText: "",
  },
  x_report: {
    headerText: "X-REPORT",
    footerText: "",
  },
  z_report: {
    headerText: "Z-REPORT (END OF DAY)",
    footerText: "Fiscal closure complete",
  },
  complimentary_slip: {
    headerText: "COMPLIMENTARY",
    footerText: "On the house - Thank you!",
  },
  expense_voucher: {
    headerText: "EXPENSE VOUCHER",
    footerText: "",
  },
  debt_voucher: {
    headerText: "DEBT VOUCHER",
    footerText: "Please pay at your earliest convenience",
  },
};

function mergeToggles(
  type: TemplateType,
  raw: unknown,
): (typeof DEFAULT_TOGGLES)[TemplateType] {
  const d = DEFAULT_TOGGLES[type];
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    logo: typeof o.logo === "boolean" ? o.logo : d.logo,
    headerText: typeof o.headerText === "boolean" ? o.headerText : d.headerText,
    footerText: typeof o.footerText === "boolean" ? o.footerText : d.footerText,
    waiterName: typeof o.waiterName === "boolean" ? o.waiterName : d.waiterName,
    tableNumber:
      typeof o.tableNumber === "boolean" ? o.tableNumber : d.tableNumber,
    timestamp: typeof o.timestamp === "boolean" ? o.timestamp : d.timestamp,
    unitPrices: typeof o.unitPrices === "boolean" ? o.unitPrices : d.unitPrices,
    taxDetails: typeof o.taxDetails === "boolean" ? o.taxDetails : d.taxDetails,
    orderNumber:
      typeof o.orderNumber === "boolean" ? o.orderNumber : d.orderNumber,
  };
}

function mergeLabels(
  type: TemplateType,
  raw: unknown,
): { headerText: string; footerText: string } {
  const d = DEFAULT_LABELS[type];
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    headerText:
      typeof o.headerText === "string" ? o.headerText : d.headerText,
    footerText:
      typeof o.footerText === "string" ? o.footerText : d.footerText,
  };
}

function mergeStyles(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

export async function listTemplates(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const { data, error } = await supabase
    .from("receipt_templates")
    .select("*")
    .eq("restaurant_id", r.id);

  if (error) {
    console.warn("[POS] listTemplates:", error.message);
    return TEMPLATE_TYPES.map((type) => ({
      _id: null,
      templateType: type,
      toggles: { ...DEFAULT_TOGGLES[type] },
      labels: { ...DEFAULT_LABELS[type] },
      styles: {},
      printerId: null,
      isCustomized: false,
    }));
  }

  const savedMap = new Map<string, (typeof data)[number]>();
  for (const row of data ?? []) {
    const tt = row.template_type as string;
    if (isTemplateType(tt)) savedMap.set(tt, row);
  }

  return TEMPLATE_TYPES.map((type) => {
    const existing = savedMap.get(type);
    return {
      _id: existing?.id ?? null,
      templateType: type,
      toggles: mergeToggles(type, existing?.toggles),
      labels: mergeLabels(type, existing?.labels),
      styles: mergeStyles(existing?.styles),
      printerId: (existing?.printer_id as string | null) ?? null,
      isCustomized: Boolean(existing),
    };
  });
}

export async function saveTemplate(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  const templateTypeRaw = args.templateType as string;
  if (!isTemplateType(templateTypeRaw)) {
    throw new Error("Invalid template type");
  }
  const type = templateTypeRaw;

  const r = await getRestaurantByLicense(licenseKey);
  const toggles = args.toggles as Record<string, unknown> | undefined;
  const labels = args.labels as Record<string, unknown> | undefined;
  const styles = args.styles as Record<string, unknown> | undefined;
  const printerArg = args.printerId as string | undefined;

  const row = {
    restaurant_id: r.id,
    template_type: type,
    toggles: mergeToggles(type, toggles),
    labels: mergeLabels(type, labels),
    styles: mergeStyles(styles),
    printer_id: uuidOrNull(printerArg ?? "") ?? null,
  };

  const { error } = await supabase.from("receipt_templates").upsert(row, {
    onConflict: "restaurant_id,template_type",
  });
  assertNoPgError("Save receipt template", error);
}

export async function resetTemplate(args: Record<string, unknown>) {
  const licenseKey = args.licenseKey as string;
  const templateTypeRaw = args.templateType as string;
  if (!isTemplateType(templateTypeRaw)) {
    throw new Error("Invalid template type");
  }

  const r = await getRestaurantByLicense(licenseKey);
  const { error } = await supabase
    .from("receipt_templates")
    .delete()
    .eq("restaurant_id", r.id)
    .eq("template_type", templateTypeRaw);

  assertNoPgError("Reset receipt template", error);
}
