/**
 * Thermal HTML for closing a waiter shift, aligned with Template Manager → Waiter Shift Report.
 */
import { printHtmlDocumentAsync } from "@/lib/print-html.ts";
import { format } from "date-fns";

export type WaiterShiftTemplateToggles = {
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

export type WaiterShiftTemplate = {
  toggles: WaiterShiftTemplateToggles;
  labels: { headerText: string; footerText: string };
  styles: Record<string, unknown>;
};

/** Defaults match supabase-pos/templates-ops.ts waiter_shift_report */
export const DEFAULT_WAITER_SHIFT_TEMPLATE: WaiterShiftTemplate = {
  toggles: {
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
  labels: {
    headerText: "SHIFT REPORT",
    footerText: "",
  },
  styles: {},
};

type ElementStyle = {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  uppercase?: boolean;
  textAlign?: string;
};

function parseStyle(raw: unknown): ElementStyle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    fontSize: typeof o.fontSize === "number" ? o.fontSize : undefined,
    bold: typeof o.bold === "boolean" ? o.bold : undefined,
    italic: typeof o.italic === "boolean" ? o.italic : undefined,
    uppercase: typeof o.uppercase === "boolean" ? o.uppercase : undefined,
    textAlign: typeof o.textAlign === "string" ? o.textAlign : undefined,
  };
}

function styleAttr(key: string, styles: Record<string, unknown>): string {
  const s = parseStyle(styles[key]);
  const parts: string[] = [];
  if (s.fontSize != null) parts.push(`font-size:${s.fontSize}px`);
  if (s.bold) parts.push("font-weight:bold");
  if (s.italic) parts.push("font-style:italic");
  if (s.uppercase) parts.push("text-transform:uppercase");
  if (s.textAlign) parts.push(`text-align:${s.textAlign}`);
  return parts.length ? ` style="${parts.join(";")}"` : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string, opts?: { bold?: boolean; dim?: boolean }) {
  const dim = opts?.dim ? "color:#888;" : "";
  const fw = opts?.bold ? "font-weight:bold;" : "";
  return `<div class="r" style="${fw}${dim}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

export type WaiterShiftPrintPayload = {
  restaurantName: string;
  waiterName: string;
  closedByName?: string;
  clockInIso: string;
  clockOutIso: string;
  orders: number;
  /** All non-cancelled ticket totals (open + paid) — “pazari” bruto */
  revenue: number;
  /** Paid orders only — cash actually collected */
  paidCash: number;
  paidCard: number;
  paidDebt: number;
  paidComplimentary: number;
  openingCash: number;
  expenseTotal: number;
  expenseLines: Array<{ note: string; amount: number }>;
  /** Staff consumption / damages logged against this waiter (uncleared until shift close) */
  damagesTotal: number;
};

function vatFromInclusiveGross20(gross: number): { net: number; vat: number } {
  if (gross <= 0) return { net: 0, vat: 0 };
  const net = gross / 1.2;
  const vat = gross - net;
  return { net, vat };
}

/**
 * Builds a full HTML document (thermal-friendly) using template toggles, labels, and styles.
 */
export function buildWaiterShiftReportHtml(
  template: WaiterShiftTemplate,
  data: WaiterShiftPrintPayload,
  formatPrice: (amount: number) => string,
  subheaderTitle: string,
): string {
  const { toggles, labels, styles } = template;
  /** Cash the waiter should hand in: float + physical cash from paid sales − venue expenses − staff damages/consumption. Card/debt/complimentary are shown but not in this total. */
  const handOver =
    Math.round(
      (data.openingCash +
        data.paidCash -
        data.expenseTotal -
        data.damagesTotal) *
        100,
    ) / 100;
  const { vat: vatAmt } = vatFromInclusiveGross20(data.revenue);

  const shiftRange = `${format(new Date(data.clockInIso), "dd/MM/yyyy HH:mm")} – ${format(new Date(data.clockOutIso), "HH:mm")}`;
  const nowStr = format(new Date(), "dd/MM/yyyy HH:mm:ss");

  const headerInner = toggles.headerText
    ? `<div${styleAttr("header", styles)}>${escapeHtml(labels.headerText)}</div>`
    : `<div${styleAttr("header", styles)}>${escapeHtml(data.restaurantName)}</div>`;

  const logoBlock = toggles.logo
    ? `<div class="logo"><div class="logo-box">LOGO</div></div>`
    : "";

  const infoRows: string[] = [];
  if (toggles.timestamp) {
    infoRows.push(row("Printed", nowStr));
  }
  if (toggles.waiterName) {
    infoRows.push(row("Staff", data.waiterName));
  }
  if (data.closedByName) {
    infoRows.push(row("Closed by", data.closedByName));
  }
  infoRows.push(row("Shift", shiftRange));
  infoRows.push(row("Orders", String(data.orders)));

  if (data.openingCash > 0) {
    infoRows.push(row("Opening cash", formatPrice(data.openingCash)));
  }

  const revenueRows: string[] = [
    row("Gross sales (all tickets)", formatPrice(data.revenue)),
  ];
  if (data.paidCash > 0 || data.paidCard > 0 || data.paidDebt > 0 || data.paidComplimentary > 0) {
    revenueRows.push(row("Cash (paid)", formatPrice(data.paidCash), { dim: true }));
    if (data.paidCard > 0) {
      revenueRows.push(row("Card (paid)", formatPrice(data.paidCard), { dim: true }));
    }
    if (data.paidDebt > 0) {
      revenueRows.push(row("Customer debt (paid)", formatPrice(data.paidDebt), { dim: true }));
    }
    if (data.paidComplimentary > 0) {
      revenueRows.push(row("Complimentary (paid)", formatPrice(data.paidComplimentary), { dim: true }));
    }
  }
  if (toggles.taxDetails && data.revenue > 0) {
    revenueRows.push(
      row("VAT (20%, incl.)", formatPrice(vatAmt), { dim: true }),
    );
  }
  const revenueSection = `
    <div class="sec"${styleAttr("sectionTitle", styles)}>
      <p class="sec-title">REVENUE BREAKDOWN</p>
      <div${styleAttr("reportValue", styles)}>
        ${revenueRows.join("")}
      </div>
      <div class="tot-line">
        <div${styleAttr("totalValue", styles)}>
          ${row("GROSS TOTAL", formatPrice(data.revenue), { bold: true })}
        </div>
      </div>
    </div>`;

  const deductionRows: string[] = [];
  if (data.expenseTotal > 0 || data.expenseLines.length > 0) {
    const lines = data.expenseLines
      .map((e) =>
        row(
          e.note.slice(0, 42) + (e.note.length > 42 ? "…" : ""),
          `−${formatPrice(e.amount)}`,
          { dim: true },
        ),
      )
      .join("");
    deductionRows.push(`
      <p class="sec-title">EXPENSES (venue)</p>
      <div${styleAttr("reportValue", styles)}>${lines}</div>
      ${row("Total expenses", `−${formatPrice(data.expenseTotal)}`, { bold: true })}`);
  }
  if (data.damagesTotal > 0) {
    deductionRows.push(`
      <p class="sec-title">DAMAGES / STAFF USE</p>
      ${row("Total", `−${formatPrice(data.damagesTotal)}`, { bold: true })}`);
  }
  const deductionsSection =
    deductionRows.length > 0
      ? `<div class="sec">${deductionRows.join("")}</div>`
      : "";

  const footerBlock = toggles.footerText && labels.footerText.trim()
    ? `<div class="foot border-top"${styleAttr("footer", styles)}>${escapeHtml(labels.footerText)}</div>`
    : "";

  const body = `
  <div class="wrap">
    ${logoBlock}
    <div class="head border-b">${headerInner}
      <div class="sub"${styleAttr("subheader", styles)}>${escapeHtml(subheaderTitle)}</div>
      <div class="rn">${escapeHtml(data.restaurantName)}</div>
    </div>
    <div class="info border-b"${styleAttr("infoRow", styles)}>${infoRows.join("")}</div>
    ${revenueSection}
    ${deductionsSection}
    <div class="ho">
      <p class="ho-lab"${styleAttr("handoverLabel", styles)}>TOTAL TO HAND OVER</p>
      <p class="ho-val"${styleAttr("handoverValue", styles)}>${escapeHtml(formatPrice(handOver))}</p>
    </div>
    ${footerBlock}
    <div class="ts border-top"${styleAttr("timestamp", styles)}>
      <p>${escapeHtml(nowStr)}</p>
      <p class="muted">Powered by Vyntex POS</p>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(subheaderTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 12px; color: #111; margin: 0; padding: 12px; }
    .wrap { max-width: 80mm; margin: 0 auto; }
    .border-b { border-bottom: 1px dashed #999; padding-bottom: 10px; margin-bottom: 10px; }
    .border-top { border-top: 1px dashed #999; padding-top: 10px; margin-top: 10px; }
    .head { text-align: center; }
    .sub { color: #666; margin-top: 6px; font-size: 11px; }
    .rn { font-size: 11px; color: #444; margin-top: 4px; }
    .logo { text-align: center; margin-bottom: 8px; }
    .logo-box { width: 56px; height: 56px; margin: 0 auto; background: #eee; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #999; font-family: system-ui, sans-serif; }
    .r { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    .sec { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #999; }
    .sec-title { text-align: center; color: #666; font-size: 10px; letter-spacing: 0.06em; margin: 0 0 8px; }
    .tot-line { border-top: 1px solid #ccc; margin-top: 6px; padding-top: 6px; }
    .ho { text-align: center; padding: 12px 0; }
    .ho-lab { color: #666; font-size: 10px; letter-spacing: 0.06em; margin: 0 0 6px; }
    .ho-val { font-size: 22px; font-weight: 900; margin: 0; }
    .foot { text-align: center; font-size: 10px; }
    .ts { text-align: center; font-size: 9px; color: #888; }
    .ts .muted { margin-top: 4px; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export async function printWaiterShiftReport(
  template: WaiterShiftTemplate | null | undefined,
  data: WaiterShiftPrintPayload,
  formatPrice: (amount: number) => string,
  options?: { subheaderTitle?: string; silent?: boolean },
): Promise<boolean> {
  const merged: WaiterShiftTemplate = template
    ? {
        toggles: { ...DEFAULT_WAITER_SHIFT_TEMPLATE.toggles, ...template.toggles },
        labels: { ...DEFAULT_WAITER_SHIFT_TEMPLATE.labels, ...template.labels },
        styles:
          template.styles && typeof template.styles === "object"
            ? (template.styles as Record<string, unknown>)
            : {},
      }
    : DEFAULT_WAITER_SHIFT_TEMPLATE;

  const html = buildWaiterShiftReportHtml(
    merged,
    data,
    formatPrice,
    options?.subheaderTitle ?? "Waiter Shift Report",
  );
  return printHtmlDocumentAsync(html, {
    silent: options?.silent ?? true,
  });
}
