/**
 * Sales receipt HTML + silent print after payment.
 * - Fiscal: admin template "Fiscal Receipt" (`fiscal_receipt`).
 * - Non-fiscal pre-bill: admin template "Pre-Bill" (`non_fiscal_receipt`) in Settings → Templates.
 */

import { getPinLoginBranding } from "@/lib/local-db.ts";
import {
  hasElectronSilentPrintIpc,
  tryPrintHtmlDocumentAsync,
  type PrintHtmlAsyncOutcome,
} from "@/lib/print-html.ts";
import { runPosQuery } from "@/lib/supabase-pos/pos-router.ts";

export type FiscalReceiptStrings = {
  orderLabel: string;
  tableLabel: string;
  waiterLabel: string;
  dateLabel: string;
  itemsSectionTitle: string;
  subtotalLabel: string;
  taxLabel: string;
  totalLabel: string;
  poweredBy: string;
};

type TemplateToggles = {
  logo: boolean;
  headerText: boolean;
  footerText: boolean;
  waiterName: boolean;
  tableNumber: boolean;
  timestamp: boolean;
  unitPrices: boolean;
  taxDetails: boolean;
  orderNumber: boolean;
};

type TemplateLabels = { headerText: string; footerText: string };

type LineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function styleFromMap(
  styles: Record<string, Record<string, unknown>> | undefined,
  key: string,
): string {
  const s = styles?.[key];
  if (!s || typeof s !== "object") return "";
  const parts: string[] = [];
  if (typeof s.fontSize === "number") parts.push(`font-size:${s.fontSize}px`);
  if (s.bold === true) parts.push("font-weight:700");
  if (s.bold === false) parts.push("font-weight:400");
  if (s.italic === true) parts.push("font-style:italic");
  if (s.uppercase === true) parts.push("text-transform:uppercase");
  if (s.textAlign === "left" || s.textAlign === "center" || s.textAlign === "right") {
    parts.push(`text-align:${s.textAlign}`);
  }
  return parts.join(";");
}

function formatOrderRef(orderNumber: number | undefined, fallbackId: string): string {
  if (orderNumber != null && Number.isFinite(orderNumber)) {
    return `ORD-${String(orderNumber).padStart(4, "0")}`;
  }
  const short = fallbackId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return short ? `ORD-${short}` : "ORD-—";
}

export function buildFiscalReceiptHtml(args: {
  toggles: TemplateToggles;
  labels: TemplateLabels;
  styles: Record<string, Record<string, unknown>>;
  lines: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  orderRef: string;
  tableName: string;
  waiterName: string;
  printedAt: Date;
  formatPrice: (n: number) => string;
  strings: FiscalReceiptStrings;
  logoDataUrl: string | null;
  /** Browser print tab title */
  pageTitle?: string;
}): string {
  const {
    toggles,
    labels,
    styles,
    lines,
    subtotal,
    tax,
    total,
    orderRef,
    tableName,
    waiterName,
    printedAt,
    formatPrice,
    strings,
    logoDataUrl,
    pageTitle = "Receipt",
  } = args;

  const dash =
    "border-bottom:1px dashed #999;margin:10px 0;padding-bottom:8px;";
  const body =
    "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:#111;max-width:280px;margin:0 auto;padding:12px;background:#fff;";
  const rowFlex =
    "display:flex;justify-content:space-between;gap:8px;align-items:baseline;";
  const sx = (...parts: string[]) => parts.filter(Boolean).join(";");
  const headerLines = labels.headerText
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const headerMain = headerLines[0] ?? labels.headerText.trim();
  const headerSub = headerLines.slice(1).join(" · ");

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(pageTitle)}</title>`;
  html += `<style>@media print{body{padding:4px}}</style></head><body style="${escapeHtml(body)}">`;

  if (toggles.logo) {
    html += `<div style="text-align:center;margin-bottom:8px;">`;
    if (logoDataUrl) {
      html += `<img src="${escapeHtml(logoDataUrl)}" alt="" style="max-height:56px;max-width:120px;object-fit:contain;"/>`;
    } else {
      html += `<div style="width:56px;height:56px;margin:0 auto;background:#eee;display:flex;align-items:center;justify-content:center;font-size:8px;color:#999;">LOGO</div>`;
    }
    html += `</div>`;
  }

  if (toggles.headerText) {
    html += `<div style="${dash}">`;
    html += `<div style="${escapeHtml(styleFromMap(styles, "header"))}text-align:center;font-size:14px;font-weight:700;">${escapeHtml(headerMain)}</div>`;
    if (headerSub) {
      html += `<div style="${escapeHtml(styleFromMap(styles, "subheader"))}text-align:center;color:#666;font-size:11px;margin-top:4px;">${escapeHtml(headerSub)}</div>`;
    }
    html += `</div>`;
  }

  html += `<div style="${dash}">`;
  const infoStyle = styleFromMap(styles, "infoRow");
  if (toggles.orderNumber) {
    html += `<div style="${escapeHtml(sx(infoStyle, rowFlex))}"><span>${escapeHtml(strings.orderLabel)}</span><span>${escapeHtml(orderRef)}</span></div>`;
  }
  if (toggles.tableNumber) {
    html += `<div style="${escapeHtml(sx(infoStyle, rowFlex))}"><span>${escapeHtml(strings.tableLabel)}</span><span>${escapeHtml(tableName)}</span></div>`;
  }
  if (toggles.waiterName) {
    html += `<div style="${escapeHtml(sx(infoStyle, rowFlex))}"><span>${escapeHtml(strings.waiterLabel)}</span><span>${escapeHtml(waiterName)}</span></div>`;
  }
  if (toggles.timestamp) {
    const ds = printedAt.toLocaleString();
    html += `<div style="${escapeHtml(sx(infoStyle, rowFlex))}"><span>${escapeHtml(strings.dateLabel)}</span><span>${escapeHtml(ds)}</span></div>`;
  }
  html += `</div>`;

  html += `<div style="${dash}">`;
  html += `<div style="${escapeHtml(styleFromMap(styles, "sectionTitle"))}text-align:center;color:#666;font-size:10px;letter-spacing:0.12em;margin-bottom:6px;">${escapeHtml(strings.itemsSectionTitle)}</div>`;
  for (const line of lines) {
    const itemStyle = styleFromMap(styles, "itemRow");
    const pricePart =
      toggles.unitPrices
        ? `<span>${escapeHtml(formatPrice(line.lineTotal))}</span>`
        : "";
    html += `<div style="${escapeHtml(sx(itemStyle, rowFlex, "margin:3px 0"))}"><span>${line.quantity}× ${escapeHtml(line.name)}${line.notes ? ` <small style="color:#666">(${escapeHtml(line.notes)})</small>` : ""}</span>${pricePart}</div>`;
  }
  html += `</div>`;

  html += `<div style="${dash}">`;
  const totLab = styleFromMap(styles, "totalLabel");
  const totVal = styleFromMap(styles, "totalValue");
  html += `<div style="${escapeHtml(sx(totLab, totVal, rowFlex))}"><span>${escapeHtml(strings.subtotalLabel)}</span><span>${escapeHtml(formatPrice(subtotal))}</span></div>`;
  if (toggles.taxDetails) {
    html += `<div style="${escapeHtml(sx(totLab, totVal, rowFlex))}"><span>${escapeHtml(strings.taxLabel)}</span><span>${escapeHtml(formatPrice(tax))}</span></div>`;
  }
  html += `<div style="${escapeHtml(sx("border-top:1px solid #333", "margin:8px 0", "padding-top:6px", totLab, totVal, rowFlex, "font-weight:700", "font-size:13px"))}"><span>${escapeHtml(strings.totalLabel)}</span><span>${escapeHtml(formatPrice(total))}</span></div>`;
  html += `</div>`;

  if (toggles.footerText && labels.footerText.trim()) {
    html += `<div style="${dash}text-align:center;">`;
    html += `<div style="${escapeHtml(styleFromMap(styles, "footer"))}">${escapeHtml(labels.footerText.trim())}</div>`;
    html += `</div>`;
  }

  html += `<div style="text-align:center;color:#888;font-size:10px;margin-top:8px;">`;
  html += `${escapeHtml(printedAt.toLocaleString())}<br/>${escapeHtml(strings.poweredBy)}`;
  html += `</div>`;

  html += `</body></html>`;
  return html;
}

const DEFAULT_FISCAL_TOGGLES: TemplateToggles = {
  logo: true,
  headerText: true,
  footerText: true,
  waiterName: true,
  tableNumber: true,
  timestamp: true,
  unitPrices: true,
  taxDetails: true,
  orderNumber: true,
};

const DEFAULT_FISCAL_LABELS: TemplateLabels = {
  headerText: "FISCAL RECEIPT\nFiscal Receipt",
  footerText: "Thank you for your visit!",
};

const DEFAULT_NON_FISCAL_TOGGLES: TemplateToggles = {
  logo: true,
  headerText: true,
  footerText: true,
  waiterName: true,
  tableNumber: true,
  timestamp: true,
  unitPrices: true,
  taxDetails: false,
  orderNumber: true,
};

const DEFAULT_NON_FISCAL_LABELS: TemplateLabels = {
  headerText: "PRE-BILL",
  footerText: "This is not a fiscal document",
};

function mergeReceiptTemplate(
  raw: unknown,
  defaultToggles: TemplateToggles,
  defaultLabels: TemplateLabels,
): {
  toggles: TemplateToggles;
  labels: TemplateLabels;
  styles: Record<string, Record<string, unknown>>;
} {
  if (!raw || typeof raw !== "object") {
    return {
      toggles: { ...defaultToggles },
      labels: { ...defaultLabels },
      styles: {},
    };
  }
  const t = raw as {
    toggles?: Partial<TemplateToggles>;
    labels?: Partial<TemplateLabels>;
    styles?: Record<string, Record<string, unknown>>;
  };
  return {
    toggles: { ...defaultToggles, ...t.toggles },
    labels: {
      headerText:
        typeof t.labels?.headerText === "string"
          ? t.labels.headerText
          : defaultLabels.headerText,
      footerText:
        typeof t.labels?.footerText === "string"
          ? t.labels.footerText
          : defaultLabels.footerText,
    },
    styles:
      t.styles && typeof t.styles === "object" && !Array.isArray(t.styles)
        ? t.styles
        : {},
  };
}

type SalesReceiptTemplateType = "fiscal_receipt" | "non_fiscal_receipt";

async function printPosSalesReceipt(args: {
  licenseKey: string;
  orderId: string;
  strings: FiscalReceiptStrings;
  formatPrice: (n: number) => string;
  templateType: SalesReceiptTemplateType;
  pageTitle: string;
  /** Electron: OS printer name (Settings → printer Address if set, else Name). */
  deviceName?: string;
}): Promise<PrintHtmlAsyncOutcome> {
  const {
    licenseKey,
    orderId,
    strings,
    formatPrice,
    templateType,
    pageTitle,
    deviceName,
  } = args;

  const templatesList = (await runPosQuery("pos.templates.listTemplates", {
    licenseKey,
  })) as Array<{
    templateType: string;
    toggles?: TemplateToggles;
    labels?: TemplateLabels;
    styles?: Record<string, Record<string, unknown>>;
  }>;

  const templateRow = templatesList?.find((x) => x.templateType === templateType);
  const defaults =
    templateType === "fiscal_receipt"
      ? { toggles: DEFAULT_FISCAL_TOGGLES, labels: DEFAULT_FISCAL_LABELS }
      : { toggles: DEFAULT_NON_FISCAL_TOGGLES, labels: DEFAULT_NON_FISCAL_LABELS };
  const { toggles, labels, styles } = mergeReceiptTemplate(
    templateRow,
    defaults.toggles,
    defaults.labels,
  );

  const raw = (await runPosQuery("pos.orders.getOrderWithItems", {
    licenseKey,
    orderId,
  })) as {
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
    _id: string;
  };

  const mergeKey = (item: (typeof raw.items)[number]) => {
    const notes = (item.notes ?? "").trim().toLowerCase();
    const name = item.name.trim().toLowerCase();
    const price = Math.round(Number(item.price) * 100) / 100;
    const station = item.station ?? "";
    return `${name}|${price}|${notes}|${station}`;
  };

  const activeItems = raw.items.filter(
    (i) => i.status !== "cancelled" && i.status !== "voided",
  );

  type Grouped = {
    key: string;
    name: string;
    unitPrice: number;
    qty: number;
    notes?: string;
  };
  const grouped: Grouped[] = [];
  for (const item of activeItems) {
    const key = mergeKey(item);
    const ex = grouped.find((g) => g.key === key);
    if (ex) ex.qty += item.quantity;
    else {
      grouped.push({
        key,
        name: item.name,
        unitPrice: Number(item.price),
        qty: item.quantity,
        notes: item.notes?.trim() || undefined,
      });
    }
  }

  const lines: LineItem[] = grouped.map((g) => ({
    name: g.name,
    quantity: g.qty,
    unitPrice: g.unitPrice,
    lineTotal: Math.round(g.unitPrice * g.qty * 100) / 100,
    notes: g.notes,
  }));

  let logoDataUrl: string | null = null;
  try {
    const branding = await getPinLoginBranding(licenseKey);
    logoDataUrl = branding.logoDataUrl ?? null;
  } catch {
    /* ignore */
  }

  const html = buildFiscalReceiptHtml({
    toggles,
    labels,
    styles,
    lines,
    subtotal: Number(raw.subtotal),
    tax: Number(raw.tax),
    total: Number(raw.total),
    orderRef: formatOrderRef(raw.orderNumber, raw._id),
    tableName: raw.tableName ?? "—",
    waiterName: raw.staffName ?? "—",
    printedAt: new Date(),
    formatPrice,
    strings,
    logoDataUrl,
    pageTitle,
  });

  return tryPrintHtmlDocumentAsync(html, {
    silent: true,
    allowInteractiveFallback: !hasElectronSilentPrintIpc(),
    deviceName,
  });
}

/**
 * Loads `fiscal_receipt` template, order lines, optional PIN logo; prints like kitchen tickets.
 */
export async function printFiscalReceiptForPay(args: {
  licenseKey: string;
  orderId: string;
  strings: FiscalReceiptStrings;
  formatPrice: (n: number) => string;
  deviceName?: string;
}): Promise<PrintHtmlAsyncOutcome> {
  return printPosSalesReceipt({
    ...args,
    templateType: "fiscal_receipt",
    pageTitle: "Fiscal receipt",
  });
}

/**
 * Loads `non_fiscal_receipt` (Pre-Bill) template after non-fiscal payment.
 */
export async function printNonFiscalReceiptForPay(args: {
  licenseKey: string;
  orderId: string;
  strings: FiscalReceiptStrings;
  formatPrice: (n: number) => string;
  deviceName?: string;
}): Promise<PrintHtmlAsyncOutcome> {
  return printPosSalesReceipt({
    ...args,
    templateType: "non_fiscal_receipt",
    pageTitle: "Pre-bill",
  });
}
