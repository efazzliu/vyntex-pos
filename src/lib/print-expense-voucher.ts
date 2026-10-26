import { PRINT_POWERED_BY } from "@/lib/print-html.ts";
import { printDesignCss } from "@/lib/print-design.ts";

export const EXPENSE_VOUCHER_TITLE = "EXPENSE";
export const EXPENSE_VOUCHER_SUBTITLE = "CASH OUT";

export type ExpenseVoucherVisibility = {
  logo: boolean;
  storeInfo: boolean;
  divider: boolean;
  timestamp: boolean;
  operator: boolean;
};

export const DEFAULT_EXPENSE_VISIBILITY: ExpenseVoucherVisibility = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  operator: true,
};

export type ExpenseVoucherLine = {
  note: string;
  amount: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveExpenseVoucherCopy(labels?: {
  headerText?: string;
  footerText?: string;
}) {
  const header = (labels?.headerText ?? "").trim();
  const firstLine = header.split("\n")[0]?.trim() ?? "";
  const isLegacy = !firstLine || /^expense(\s+voucher)?$/i.test(firstLine);
  return {
    title: isLegacy ? EXPENSE_VOUCHER_TITLE : firstLine,
    footer: (labels?.footerText ?? "").trim(),
  };
}

export function visibilityFromExpenseElements(elements: {
  logo: boolean;
  storeInfo: boolean;
  divider: boolean;
  timestamp: boolean;
  operator: boolean;
}): ExpenseVoucherVisibility {
  return {
    logo: elements.logo,
    storeInfo: elements.storeInfo,
    divider: elements.divider,
    timestamp: elements.timestamp,
    operator: elements.operator,
  };
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function visibilityFromExpenseTemplate(
  toggles?: { logo?: boolean; timestamp?: boolean } | null,
  designExtra?: Record<string, unknown> | null,
): ExpenseVoucherVisibility {
  const el =
    designExtra?.elements && typeof designExtra.elements === "object"
      ? (designExtra.elements as Record<string, unknown>)
      : {};
  return {
    logo: bool(toggles?.logo, true),
    storeInfo: bool(el.storeInfo, true),
    divider: bool(el.divider, true),
    timestamp: bool(toggles?.timestamp ?? el.timestamp, true),
    operator: bool(el.operator, true),
  };
}

export function buildExpenseVoucherHtml(args: {
  title?: string;
  footer?: string;
  storeName: string;
  venueName?: string;
  staffName: string;
  approvedBy?: string;
  printedAt: Date;
  lines: ExpenseVoucherLine[];
  formatPrice: (amount: number) => string;
  logoDataUrl?: string | null;
  pageTitle?: string;
  visibility?: Partial<ExpenseVoucherVisibility>;
  design?: unknown;
}): string {
  const vis = { ...DEFAULT_EXPENSE_VISIBILITY, ...args.visibility };
  const title = args.title ?? EXPENSE_VOUCHER_TITLE;
  const footer = (args.footer ?? "").trim();
  const total = args.lines.reduce((sum, line) => sum + line.amount, 0);
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
  const lines = args.lines
    .map(
      (line) =>
        `<div class="row"><span>${escapeHtml(line.note)}</span><span>${escapeHtml(args.formatPrice(line.amount))}</span></div>`,
    )
    .join("");

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
    .total { font-size: 15px; font-weight: 800; }
    .footer { margin-top: 10px; text-align: center; font-size: 11px; color: #666; }
    .powered { margin-top: 14px; text-align: center; font-size: 9px; color: #888; }
    @media print { body { padding: 6px; } }
    ${printDesignCss(args.design)}
  </style>
</head>
<body>
  <div class="sheet">
    ${logo}
    <div class="title">${escapeHtml(title)}</div>
    <div class="sub">${EXPENSE_VOUCHER_SUBTITLE}</div>
    ${vis.storeInfo ? `<div class="store">${escapeHtml(args.storeName)}</div>${args.venueName ? `<div class="venue">${escapeHtml(args.venueName)}</div>` : ""}` : ""}
    ${dash}
    <div class="row"><span>Staff</span><span>${escapeHtml(args.staffName)}</span></div>
    ${vis.timestamp ? `<div class="row"><span>Printed</span><span>${escapeHtml(printed)}</span></div>` : ""}
    ${vis.operator && args.approvedBy ? `<div class="row"><span>Approved by</span><span>${escapeHtml(args.approvedBy)}</span></div>` : ""}
    ${dash}
    ${lines}
    ${dash}
    <div class="row total"><span>TOTAL</span><span>${escapeHtml(args.formatPrice(total))}</span></div>
    ${footer ? `<div class="footer">${escapeHtml(footer)}</div>` : ""}
    <div class="powered">${PRINT_POWERED_BY}</div>
  </div>
</body>
</html>`;
}
