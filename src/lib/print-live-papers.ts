/**
 * Live POS print for papers that previously only had Test print / old window.print.
 * Loads the saved Template Manager `_design` and sends HTML to the receipt printer.
 */

import {
  buildComplimentarySlipHtml,
  complimentaryPrintExtras,
  resolveComplimentaryCopy,
  visibilityFromComplimentaryTemplate,
} from "@/lib/print-complimentary-slip.ts";
import {
  buildDebtVoucherHtml,
  debtVoucherPrintExtras,
  resolveDebtVoucherCopy,
  visibilityFromDebtTemplate,
} from "@/lib/print-debt-voucher.ts";
import {
  buildExpenseVoucherHtml,
  resolveExpenseVoucherCopy,
  visibilityFromExpenseTemplate,
} from "@/lib/print-expense-voucher.ts";
import {
  buildXReportHtml,
  resolveXReportCopy,
  visibilityFromXTemplate,
  type XReportTotals,
} from "@/lib/print-x-report.ts";
import {
  buildZReportHtml,
  resolveZReportCopy,
  visibilityFromZTemplate,
  type ZReportTotals,
} from "@/lib/print-z-report.ts";
import { resolvePinLoginBranding } from "@/lib/supabase-pos/license-sync.ts";
import {
  DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  hasElectronSilentPrintIpc,
  isSilentPrintQueueableError,
  tryPrintHtmlDocumentAsync,
  type PrintHtmlAsyncOutcome,
} from "@/lib/print-html.ts";
import { enqueueHtmlPrintJob, flushPrintQueueNow } from "@/lib/print-queue.ts";
import { loadPaperPrintDeviceName } from "@/lib/pos-print-device.ts";
import { runPosQuery } from "@/lib/supabase-pos/pos-router.ts";

type TemplateRow = {
  templateType: string;
  printerId?: string | null;
  toggles?: {
    logo?: boolean;
    footerText?: boolean;
    waiterName?: boolean;
    tableNumber?: boolean;
    timestamp?: boolean;
    orderNumber?: boolean;
    unitPrices?: boolean;
  };
  labels?: { headerText?: string; footerText?: string };
  styles?: Record<string, unknown>;
};

type SaleItemRow = {
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  station?: string;
  status: string;
};

type SaleOrderRow = {
  items: SaleItemRow[];
  tableName?: string;
  staffName?: string;
  orderNumber?: number;
  subtotal: number;
  tax: number;
  total: number;
  customerName?: string;
  _id: string;
};

type CompanyRow = {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
};

function designOf(row?: TemplateRow): Record<string, unknown> | undefined {
  const styles = row?.styles;
  if (!styles || typeof styles._design !== "object" || styles._design == null) {
    return undefined;
  }
  return styles._design as Record<string, unknown>;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function contentStore(design?: Record<string, unknown>) {
  const content =
    design?.content && typeof design.content === "object"
      ? (design.content as Record<string, unknown>)
      : {};
  return {
    storeName: text(content.storeName),
    venueName: text(content.venueName),
  };
}

function vatFromGross(revenue: number) {
  return Math.round((revenue * 0.2) / 1.2 * 100) / 100;
}

function formatOrderRef(orderNumber: number | undefined, fallbackId: string): string {
  if (orderNumber != null && Number.isFinite(orderNumber)) {
    return `#${orderNumber}`;
  }
  const short = fallbackId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return short ? `#${short}` : "#—";
}

function groupedSaleLines(items: SaleItemRow[]) {
  const active = items.filter((i) => i.status !== "cancelled" && i.status !== "voided");
  const grouped: Array<{
    key: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];
  for (const item of active) {
    const unitPrice = Number(item.price);
    const key = [
      item.name.trim().toLowerCase(),
      Math.round(unitPrice * 100),
      (item.notes ?? "").trim().toLowerCase(),
      item.station ?? "",
    ].join("|");
    const hit = grouped.find((g) => g.key === key);
    if (hit) {
      hit.quantity += item.quantity;
      hit.lineTotal = Math.round(hit.unitPrice * hit.quantity * 100) / 100;
      continue;
    }
    grouped.push({
      key,
      name: item.name,
      quantity: item.quantity,
      unitPrice,
      lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
    });
  }
  return grouped.map(({ name, quantity, unitPrice, lineTotal }) => ({
    name,
    quantity,
    unitPrice,
    lineTotal,
  }));
}

async function loadTemplate(licenseKey: string, templateType: string) {
  try {
    const list = (await runPosQuery("pos.templates.listTemplates", {
      licenseKey,
    })) as TemplateRow[];
    return list?.find((row) => row.templateType === templateType);
  } catch {
    return undefined;
  }
}

async function loadPaperDeviceName(
  licenseKey: string,
  templateType: string,
  row?: TemplateRow,
  preferred?: string,
) {
  return loadPaperPrintDeviceName({
    licenseKey,
    templateType,
    templatePrinterId: row?.printerId,
    fallback: preferred,
  });
}

async function loadLogoAndCompany(licenseKey: string, design?: Record<string, unknown>) {
  let logoDataUrl =
    typeof design?.logoDataUrl === "string" && design.logoDataUrl.trim()
      ? design.logoDataUrl
      : null;
  if (!logoDataUrl) {
    try {
      const branding = await resolvePinLoginBranding(licenseKey);
      logoDataUrl = branding.logoDataUrl ?? null;
    } catch {
      /* ignore */
    }
  }
  let company: CompanyRow | undefined;
  try {
    company = (await runPosQuery("pos.settings.getCompanyDetails", {
      licenseKey,
    })) as CompanyRow;
  } catch {
    /* ignore */
  }
  const address = text(design?.address);
  return {
    logoDataUrl,
    business: {
      name: contentStore(design).storeName || company?.name || "VYNTEX",
      address: address || company?.address,
      city: address ? undefined : company?.city,
      phone: company?.phone,
      website: text(design?.website, "www.vyntexpos.net"),
    },
  };
}

async function silentPrintHtml(
  html: string,
  deviceName: string | undefined,
  jobType: "ticket" | "bill" | "receipt" | "custom",
): Promise<PrintHtmlAsyncOutcome> {
  const outcome = await tryPrintHtmlDocumentAsync(html, {
    silent: true,
    allowInteractiveFallback: !hasElectronSilentPrintIpc(),
    deviceName,
    silentTimeoutMs: DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  });
  if (outcome.ok) {
    void flushPrintQueueNow().catch(() => {});
  } else if (isSilentPrintQueueableError(outcome.error)) {
    void enqueueHtmlPrintJob({
      html,
      deviceName,
      silent: true,
      allowInteractiveFallback: !hasElectronSilentPrintIpc(),
      jobType,
      createdAt: new Date().toISOString(),
      lastError: outcome.error,
    }).catch(() => {});
  }
  return outcome;
}

async function loadPaidOrder(licenseKey: string, orderId: string) {
  const { resolveOrderWithItemsForPrint } = await import(
    "@/lib/supabase-pos/order-print-cache.ts"
  );
  return (await resolveOrderWithItemsForPrint(
    licenseKey,
    orderId,
  )) as SaleOrderRow;
}

export async function printComplimentarySlipForPay(args: {
  licenseKey: string;
  orderId: string;
  formatPrice: (n: number) => string;
  deviceName?: string;
  approvedBy?: string;
}): Promise<PrintHtmlAsyncOutcome> {
  const row = await loadTemplate(args.licenseKey, "complimentary_slip");
  const extra = designOf(row);
  const extras = complimentaryPrintExtras(extra);
  const copy = resolveComplimentaryCopy({
    ...row?.labels,
    legalText: extras.legalText,
    tagline: extras.motto,
  });
  const raw = await loadPaidOrder(args.licenseKey, args.orderId);
  const lines = groupedSaleLines(raw.items);
  const menuValue = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const { logoDataUrl, business } = await loadLogoAndCompany(args.licenseKey, extra);
  const html = buildComplimentarySlipHtml({
    ...copy,
    venueLine: extras.venueLine,
    itemsHeading:
      extras.itemsHeading.trim() === "ITEMS" || !extras.itemsHeading.trim()
        ? "TREAT"
        : extras.itemsHeading,
    dateFormat: extras.dateFormat,
    hour12: extras.hour12,
    fieldLabels: extras.fieldLabels,
    lines,
    menuValue,
    orderRef: formatOrderRef(raw.orderNumber, raw._id),
    tableName: raw.tableName ?? "—",
    waiterName: raw.staffName ?? "—",
    approvedBy: args.approvedBy || raw.staffName || "Admin",
    printedAt: new Date(),
    formatPrice: args.formatPrice,
    logoDataUrl,
    business: {
      ...business,
      name: extras.storeName || business.name,
    },
    visibility: visibilityFromComplimentaryTemplate(row?.toggles, extra),
    pageTitle: "Complimentary slip",
    design: extra,
  });
  const deviceName = await loadPaperDeviceName(
    args.licenseKey,
    "complimentary_slip",
    row,
    args.deviceName,
  );
  return silentPrintHtml(html, deviceName, "receipt");
}

export async function printDebtVoucherForPay(args: {
  licenseKey: string;
  orderId: string;
  formatPrice: (n: number) => string;
  deviceName?: string;
  customerName?: string;
}): Promise<PrintHtmlAsyncOutcome> {
  const row = await loadTemplate(args.licenseKey, "debt_voucher");
  const extra = designOf(row);
  const extras = debtVoucherPrintExtras(extra);
  const copy = resolveDebtVoucherCopy({
    ...row?.labels,
    legalText: extras.legalText,
    tagline: extras.motto,
  });
  const raw = await loadPaidOrder(args.licenseKey, args.orderId);
  const lines = groupedSaleLines(raw.items);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const total = Number(raw.total) || subtotal;
  const { logoDataUrl, business } = await loadLogoAndCompany(args.licenseKey, extra);
  const html = buildDebtVoucherHtml({
    ...copy,
    venueLine: extras.venueLine,
    itemsHeading: extras.itemsHeading,
    dateFormat: extras.dateFormat,
    hour12: extras.hour12,
    fieldLabels: extras.fieldLabels,
    lines,
    subtotal,
    discount: 0,
    total,
    orderRef: formatOrderRef(raw.orderNumber, raw._id),
    tableName: raw.tableName ?? "—",
    waiterName: raw.staffName ?? "—",
    customerName: args.customerName?.trim() || raw.customerName || "Customer",
    printedAt: new Date(),
    formatPrice: args.formatPrice,
    logoDataUrl,
    business: {
      ...business,
      name: extras.storeName || business.name,
    },
    visibility: visibilityFromDebtTemplate(row?.toggles, extra),
    pageTitle: "Debt voucher",
    design: extra,
  });
  const deviceName = await loadPaperDeviceName(
    args.licenseKey,
    "debt_voucher",
    row,
    args.deviceName,
  );
  return silentPrintHtml(html, deviceName, "receipt");
}

export async function printExpenseVoucherNow(args: {
  licenseKey: string;
  formatPrice: (n: number) => string;
  staffName: string;
  approvedBy?: string;
  note: string;
  amount: number;
  deviceName?: string;
}): Promise<PrintHtmlAsyncOutcome> {
  const row = await loadTemplate(args.licenseKey, "expense_voucher");
  const extra = designOf(row);
  const copy = resolveExpenseVoucherCopy(row?.labels);
  const store = contentStore(extra);
  const { logoDataUrl, business } = await loadLogoAndCompany(args.licenseKey, extra);
  const html = buildExpenseVoucherHtml({
    title: copy.title,
    footer: copy.footer,
    storeName: store.storeName || business.name,
    venueName: store.venueName,
    staffName: args.staffName,
    approvedBy: args.approvedBy,
    printedAt: new Date(),
    lines: [{ note: args.note, amount: args.amount }],
    formatPrice: args.formatPrice,
    logoDataUrl,
    pageTitle: "Expense voucher",
    visibility: visibilityFromExpenseTemplate(row?.toggles, extra),
    design: extra,
  });
  const deviceName = await loadPaperDeviceName(
    args.licenseKey,
    "expense_voucher",
    row,
    args.deviceName,
  );
  return silentPrintHtml(html, deviceName, "receipt");
}

export async function printXReportNow(args: {
  licenseKey: string;
  formatPrice: (n: number) => string;
  storeName?: string;
  totals: XReportTotals;
  deviceName?: string;
}): Promise<PrintHtmlAsyncOutcome> {
  const row = await loadTemplate(args.licenseKey, "x_report");
  const extra = designOf(row);
  const copy = resolveXReportCopy(row?.labels);
  const store = contentStore(extra);
  const { logoDataUrl, business } = await loadLogoAndCompany(args.licenseKey, extra);
  const html = buildXReportHtml({
    title: copy.title,
    storeName: store.storeName || args.storeName || business.name,
    venueName: store.venueName,
    printedAt: new Date(),
    totals: args.totals,
    formatPrice: args.formatPrice,
    logoDataUrl,
    pageTitle: "X-Report",
    visibility: visibilityFromXTemplate(row?.toggles, extra),
    design: extra,
  });
  const deviceName = await loadPaperDeviceName(
    args.licenseKey,
    "x_report",
    row,
    args.deviceName,
  );
  return silentPrintHtml(html, deviceName, "receipt");
}

export async function printZReportNow(args: {
  licenseKey: string;
  formatPrice: (n: number) => string;
  storeName?: string;
  totals: ZReportTotals;
  printedAt?: Date;
  deviceName?: string;
}): Promise<PrintHtmlAsyncOutcome> {
  const row = await loadTemplate(args.licenseKey, "z_report");
  const extra = designOf(row);
  const copy = resolveZReportCopy(row?.labels);
  const store = contentStore(extra);
  const { logoDataUrl, business } = await loadLogoAndCompany(args.licenseKey, extra);
  const html = buildZReportHtml({
    title: copy.title,
    footer: copy.footer,
    storeName: store.storeName || args.storeName || business.name,
    venueName: store.venueName,
    printedAt: args.printedAt ?? new Date(),
    totals: args.totals,
    formatPrice: args.formatPrice,
    logoDataUrl,
    pageTitle: "Z-Report",
    visibility: visibilityFromZTemplate(row?.toggles, extra),
    design: extra,
  });
  const deviceName = await loadPaperDeviceName(
    args.licenseKey,
    "z_report",
    row,
    args.deviceName,
  );
  return silentPrintHtml(html, deviceName, "receipt");
}

export function xTotalsFromLiveReport(report: {
  grossRevenue: number;
  cardTotal: number;
  debtTotal: number;
  complimentaryTotal: number;
  paidOrders: number;
  staffBreakdown?: Array<{ paidCash?: number }>;
}): XReportTotals {
  const fromStaff = (report.staffBreakdown ?? []).reduce(
    (sum, row) => sum + Number(row.paidCash ?? 0),
    0,
  );
  const paidCash =
    fromStaff > 0
      ? Math.round(fromStaff * 100) / 100
      : Math.max(
          0,
          Math.round(
            (report.grossRevenue -
              report.cardTotal -
              report.debtTotal -
              report.complimentaryTotal) *
              100,
          ) / 100,
        );
  return {
    revenue: report.grossRevenue,
    paidCash,
    paidCard: report.cardTotal,
    paidDebt: report.debtTotal,
    paidComplimentary: report.complimentaryTotal,
    vat: vatFromGross(report.grossRevenue),
    orders: report.paidOrders,
  };
}

export function zTotalsFromLiveReport(args: {
  zNumber: number;
  grossRevenue: number;
  cardTotal: number;
  debtTotal: number;
  complimentaryTotal: number;
  wasteTotal?: number;
  voidsTotal?: number;
  openingCash?: number;
  cashExpenses?: number;
  paidOrders: number;
  closedBy: string;
  staffBreakdown?: Array<{ paidCash?: number }>;
}): ZReportTotals {
  const x = xTotalsFromLiveReport({
    grossRevenue: args.grossRevenue,
    cardTotal: args.cardTotal,
    debtTotal: args.debtTotal,
    complimentaryTotal: args.complimentaryTotal,
    paidOrders: args.paidOrders,
    staffBreakdown: args.staffBreakdown,
  });
  const waste = Number(args.wasteTotal ?? 0);
  const voids = Number(args.voidsTotal ?? 0);
  const expenses = Number(args.cashExpenses ?? 0);
  const opening = Number(args.openingCash ?? 0);
  const deductions =
    Math.round(
      (args.cardTotal + args.debtTotal + args.complimentaryTotal + waste + voids + expenses) *
        100,
    ) / 100;
  const handover =
    Math.round((args.grossRevenue + opening - deductions) * 100) / 100;
  return {
    zNumber: `Z-${String(args.zNumber).padStart(3, "0")}`,
    revenue: args.grossRevenue,
    paidCash: x.paidCash,
    paidCard: args.cardTotal,
    paidDebt: args.debtTotal,
    paidComplimentary: args.complimentaryTotal,
    vat: x.vat,
    openingCash: opening,
    deductions,
    handover,
    orders: args.paidOrders,
    closedBy: args.closedBy,
  };
}
