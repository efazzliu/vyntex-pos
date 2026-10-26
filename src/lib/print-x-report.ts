import { PRINT_POWERED_BY } from "@/lib/print-html.ts";
import { printDesignCss } from "@/lib/print-design.ts";

export const X_REPORT_TITLE = "X-REPORT";
export const X_REPORT_NOTICE = "NOT A Z CLOSE";

export type XReportVisibility = {
  logo: boolean;
  storeInfo: boolean;
  divider: boolean;
  timestamp: boolean;
  paymentMethod: boolean;
  taxSummary: boolean;
};

export const DEFAULT_X_VISIBILITY: XReportVisibility = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  paymentMethod: true,
  taxSummary: true,
};

export type XReportTotals = {
  revenue: number;
  paidCash: number;
  paidCard: number;
  paidDebt: number;
  paidComplimentary: number;
  vat: number;
  orders: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveXReportCopy(labels?: { headerText?: string }) {
  const header = (labels?.headerText ?? "").trim();
  const firstLine = header.split("\n")[0]?.trim() ?? "";
  const isLegacy = !firstLine || /^x[-\s]?report$/i.test(firstLine);
  return { title: isLegacy ? X_REPORT_TITLE : firstLine };
}

export function visibilityFromXElements(elements: {
  logo: boolean;
  storeInfo: boolean;
  divider: boolean;
  timestamp: boolean;
  paymentMethod: boolean;
  taxSummary: boolean;
}): XReportVisibility {
  return {
    logo: elements.logo,
    storeInfo: elements.storeInfo,
    divider: elements.divider,
    timestamp: elements.timestamp,
    paymentMethod: elements.paymentMethod,
    taxSummary: elements.taxSummary,
  };
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function visibilityFromXTemplate(
  toggles?: { logo?: boolean; timestamp?: boolean } | null,
  designExtra?: Record<string, unknown> | null,
): XReportVisibility {
  const el =
    designExtra?.elements && typeof designExtra.elements === "object"
      ? (designExtra.elements as Record<string, unknown>)
      : {};
  return {
    logo: bool(toggles?.logo, true),
    storeInfo: bool(el.storeInfo, true),
    divider: bool(el.divider, true),
    timestamp: bool(toggles?.timestamp ?? el.timestamp, true),
    paymentMethod: bool(el.paymentMethod, true),
    taxSummary: bool(el.taxSummary, true),
  };
}

export function buildXReportHtml(args: {
  title?: string;
  storeName: string;
  venueName?: string;
  printedAt: Date;
  totals: XReportTotals;
  formatPrice: (amount: number) => string;
  logoDataUrl?: string | null;
  pageTitle?: string;
  visibility?: Partial<XReportVisibility>;
  design?: unknown;
}): string {
  const vis = { ...DEFAULT_X_VISIBILITY, ...args.visibility };
  const title = args.title ?? X_REPORT_TITLE;
  const printed = args.printedAt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dash = vis.divider ? `<hr class="dash"/>` : `<div class="gap"></div>`;
  const logo = vis.logo
    ? args.logoDataUrl
      ? `<img src="${escapeHtml(args.logoDataUrl)}" alt="" class="logo"/>`
      : ""
    : "";
  const payments = vis.paymentMethod
    ? `
      <div class="row dim"><span>Cash</span><span>${escapeHtml(args.formatPrice(args.totals.paidCash))}</span></div>
      <div class="row dim"><span>Card</span><span>${escapeHtml(args.formatPrice(args.totals.paidCard))}</span></div>
      ${args.totals.paidDebt ? `<div class="row dim"><span>Debt</span><span>${escapeHtml(args.formatPrice(args.totals.paidDebt))}</span></div>` : ""}
      ${args.totals.paidComplimentary ? `<div class="row dim"><span>Comp</span><span>${escapeHtml(args.formatPrice(args.totals.paidComplimentary))}</span></div>` : ""}`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(args.pageTitle ?? title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 14px 12px 16px; color: #111; background: #fff; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.35; }
    .sheet { max-width: 80mm; margin: 0 auto; }
    .logo { display: block; max-height: 40px; max-width: 90px; margin: 0 auto 8px; object-fit: contain; }
    .title { text-align: center; font-size: 18px; font-weight: 800; letter-spacing: 0.16em; }
    .sub { text-align: center; margin-top: 4px; font-size: 11px; letter-spacing: 0.18em; color: #666; }
    .store { text-align: center; margin-top: 8px; font-size: 11px; letter-spacing: 0.16em; color: #888; }
    .venue { text-align: center; font-size: 12px; color: #555; }
    .dash { border: none; border-top: 1px dashed #bbb; margin: 12px 0; }
    .gap { height: 10px; }
    .row { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; }
    .dim { color: #555; }
    .notice { text-align: center; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; }
    .powered { margin-top: 14px; text-align: center; font-size: 9px; color: #888; }
    @media print { body { padding: 6px; } }
    ${printDesignCss(args.design)}
  </style>
</head>
<body>
  <div class="sheet">
    ${logo}
    <div class="title">${escapeHtml(title)}</div>
    <div class="sub">MID-DAY</div>
    ${vis.storeInfo ? `<div class="store">${escapeHtml(args.storeName)}</div>${args.venueName ? `<div class="venue">${escapeHtml(args.venueName)}</div>` : ""}` : ""}
    ${dash}
    ${vis.timestamp ? `<div class="row"><span>Printed</span><span>${escapeHtml(printed)}</span></div><div class="row"><span>Orders</span><span>${args.totals.orders}</span></div>` : `<div class="row"><span>Orders</span><span>${args.totals.orders}</span></div>`}
    ${dash}
    <div class="row"><span>Gross sales</span><span>${escapeHtml(args.formatPrice(args.totals.revenue))}</span></div>
    ${payments}
    ${vis.taxSummary ? `<div class="row dim"><span>VAT (20%)</span><span>${escapeHtml(args.formatPrice(args.totals.vat))}</span></div>` : ""}
    ${dash}
    <div class="notice">${X_REPORT_NOTICE}</div>
    <div class="powered">${PRINT_POWERED_BY}</div>
  </div>
</body>
</html>`;
}
