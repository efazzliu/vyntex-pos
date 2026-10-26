import { PRINT_POWERED_BY } from "@/lib/print-html.ts";
import { printDesignCss } from "@/lib/print-design.ts";

export type DebtVoucherLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type DebtVoucherBusiness = {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
};

export type DebtVoucherVisibility = {
  logo: boolean;
  storeInfo: boolean;
  divider: boolean;
  timestamp: boolean;
  orderNumber: boolean;
  waiterName: boolean;
  tableNumber: boolean;
  customerName: boolean;
  itemList: boolean;
  showUnitPrices: boolean;
  discount: boolean;
  subtotal: boolean;
  totalDue: boolean;
  balanceNotice: boolean;
  thankYou: boolean;
};

export const DEFAULT_DEBT_VOUCHER_VISIBILITY: DebtVoucherVisibility = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  orderNumber: true,
  waiterName: true,
  tableNumber: true,
  customerName: true,
  itemList: true,
  showUnitPrices: true,
  discount: false,
  subtotal: false,
  totalDue: true,
  balanceNotice: true,
  thankYou: true,
};

export const DEBT_VOUCHER_TITLE = "ON ACCOUNT";
export const DEBT_VOUCHER_BADGE = "PAY LATER";
export const DEBT_VOUCHER_NOTICE = "BALANCE DUE — NOT A FISCAL RECEIPT";
export const DEBT_VOUCHER_FOOTER = "Please pay at your earliest convenience";
export const DEBT_VOUCHER_MOTTO = "GOOD FOOD · GREAT PEOPLE";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LEDGER_SVG = `<svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="8" y="5.5" width="20" height="25" rx="1.6" stroke="#111" stroke-width="1.6"/>
  <path d="M12 13h12M12 18.2h12M12 23.4h8" stroke="#111" stroke-width="1.5" stroke-linecap="square"/>
</svg>`;

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function resolveDebtVoucherCopy(labels?: {
  headerText?: string;
  footerText?: string;
  legalText?: string;
  tagline?: string;
}) {
  const header = (labels?.headerText ?? "").trim();
  const footer = (labels?.footerText ?? "").trim();
  const firstLine = header.split("\n")[0]?.trim() ?? "";
  const isLegacy = !firstLine || /^debt voucher$/i.test(firstLine);
  return {
    title: isLegacy ? DEBT_VOUCHER_TITLE : firstLine,
    footerText: footer || DEBT_VOUCHER_FOOTER,
    legalText:
      typeof labels?.legalText === "string" && labels.legalText.trim()
        ? labels.legalText.trim()
        : DEBT_VOUCHER_NOTICE,
    tagline:
      typeof labels?.tagline === "string" && labels.tagline.trim()
        ? labels.tagline.trim()
        : DEBT_VOUCHER_MOTTO,
  };
}

export function visibilityFromDebtElements(elements: {
  logo: boolean;
  storeInfo: boolean;
  divider: boolean;
  timestamp: boolean;
  orderNumber?: boolean;
  waiterName: boolean;
  tableNumber: boolean;
  customerName?: boolean;
  itemList: boolean;
  unitPrices?: boolean;
  discount?: boolean;
  subtotal?: boolean;
  totalDue?: boolean;
  preliminaryNotice?: boolean;
  thankYou: boolean;
}): DebtVoucherVisibility {
  return {
    logo: elements.logo,
    storeInfo: elements.storeInfo,
    divider: elements.divider,
    timestamp: elements.timestamp,
    orderNumber: elements.orderNumber !== false,
    waiterName: elements.waiterName,
    tableNumber: elements.tableNumber,
    customerName: elements.customerName !== false,
    itemList: elements.itemList,
    showUnitPrices: elements.unitPrices !== false,
    discount: false,
    subtotal: false,
    totalDue: elements.totalDue !== false,
    balanceNotice: elements.preliminaryNotice !== false,
    thankYou: elements.thankYou,
  };
}

export function visibilityFromDebtTemplate(
  toggles?: {
    logo?: boolean;
    footerText?: boolean;
    waiterName?: boolean;
    tableNumber?: boolean;
    timestamp?: boolean;
    orderNumber?: boolean;
    unitPrices?: boolean;
  } | null,
  designExtra?: Record<string, unknown> | null,
): DebtVoucherVisibility {
  const el =
    designExtra?.elements && typeof designExtra.elements === "object"
      ? (designExtra.elements as Record<string, unknown>)
      : {};
  return {
    logo: bool(toggles?.logo, true),
    storeInfo: bool(el.storeInfo, true),
    divider: bool(el.divider, true),
    timestamp: bool(toggles?.timestamp, true),
    orderNumber: bool(el.orderNumber ?? toggles?.orderNumber, true),
    waiterName: bool(toggles?.waiterName, true),
    tableNumber: bool(toggles?.tableNumber, true),
    customerName: bool(el.customerName, true),
    itemList: bool(el.itemList, true),
    showUnitPrices: bool(el.unitPrices ?? toggles?.unitPrices, true),
    discount: false,
    subtotal: false,
    totalDue: bool(el.totalDue, true),
    balanceNotice: bool(el.preliminaryNotice, true),
    thankYou: bool(toggles?.footerText, true),
  };
}

export function debtVoucherPrintExtras(designExtra?: Record<string, unknown> | null) {
  const content =
    designExtra?.content && typeof designExtra.content === "object"
      ? (designExtra.content as Record<string, unknown>)
      : {};
  const text = (value: unknown, fallback = "") =>
    typeof value === "string" ? value : fallback;
  return {
    venueLine: text(content.venueName),
    itemsHeading: text(content.itemsTitle, "ITEMS"),
    storeName: text(content.storeName),
    dateFormat: content.dateFormat === "long" ? "long" : "short",
    hour12: content.timeFormat === "12h",
    legalText: text(content.legalText, DEBT_VOUCHER_NOTICE),
    motto: text(content.motto ?? designExtra?.motto, DEBT_VOUCHER_MOTTO),
    fieldLabels: {
      customer: "Customer",
      table: text(content.tableLabel, "Table"),
      date: text(content.dateLabel, "Date"),
      time: text(content.timeLabel, "Time"),
      order: "Order",
      waiter: text(content.waiterLabel, "Waiter"),
      colQty: text(content.colQty, "QTY"),
      colItem: text(content.colItem, "ITEM"),
      colPrice: text(content.colPrice, "PRICE"),
      colLineTotal: text(content.colLineTotal, "TOTAL"),
    },
  };
}

export function buildDebtVoucherHtml(args: {
  lines: DebtVoucherLine[];
  subtotal: number;
  discount?: number;
  total: number;
  orderRef: string;
  tableName: string;
  waiterName: string;
  customerName?: string;
  printedAt: Date;
  formatPrice: (n: number) => string;
  logoDataUrl?: string | null;
  business?: DebtVoucherBusiness;
  title?: string;
  footerText?: string;
  legalText?: string;
  tagline?: string;
  pageTitle?: string;
  venueLine?: string;
  itemsHeading?: string;
  dateFormat?: "short" | "long";
  hour12?: boolean;
  visibility?: Partial<DebtVoucherVisibility>;
  fieldLabels?: {
    customer?: string;
    table?: string;
    date?: string;
    time?: string;
    order?: string;
    waiter?: string;
    colQty?: string;
    colItem?: string;
    colPrice?: string;
    colLineTotal?: string;
  };
  design?: unknown;
}): string {
  const {
    lines,
    subtotal,
    discount = 0,
    total,
    orderRef,
    tableName,
    waiterName,
    customerName = "Customer",
    printedAt,
    formatPrice,
    logoDataUrl,
    business,
    title = DEBT_VOUCHER_TITLE,
    footerText = DEBT_VOUCHER_FOOTER,
    legalText = DEBT_VOUCHER_NOTICE,
    tagline = DEBT_VOUCHER_MOTTO,
    pageTitle = "Debt voucher",
    venueLine,
    itemsHeading,
    dateFormat = "short",
    hour12 = false,
    fieldLabels = {},
  } = args;
  const vis = { ...DEFAULT_DEBT_VOUCHER_VISIBILITY, ...args.visibility };

  const brand = (business?.name || "VYNTEX").trim().toUpperCase();
  const address = [business?.address, business?.city].filter(Boolean).join(", ");
  const phone = business?.phone?.trim() || "";
  const website = (business?.website || "").replace(/^https?:\/\//, "");
  const date =
    dateFormat === "long"
      ? printedAt.toLocaleDateString(undefined, {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : printedAt.toLocaleDateString("en-GB").replace(/\//g, ".");
  const time = printedAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12,
  });
  const logo = vis.logo
    ? logoDataUrl
      ? `<img src="${escapeHtml(logoDataUrl)}" alt="" style="max-height:52px;max-width:120px;object-fit:contain;"/>`
      : LEDGER_SVG
    : "";

  const dash = vis.divider ? `<hr class="dash"/>` : `<div class="gap"></div>`;
  const brandHtml =
    vis.storeInfo || vis.logo
      ? `<div class="brand">
      <div class="brand-row">
        ${vis.storeInfo ? `<div class="brand-name">${escapeHtml(brand)}</div>` : ""}
        ${logo}
      </div>
      ${vis.storeInfo && venueLine ? `<div class="brand-sub">${escapeHtml(venueLine.toUpperCase())}</div>` : ""}
      ${
        vis.storeInfo
          ? `<div class="contact">
        ${address ? `${escapeHtml(address)}<br/>` : ""}
        ${phone ? `Tel: ${escapeHtml(phone)}<br/>` : ""}
        ${website ? escapeHtml(website) : ""}
      </div>`
          : ""
      }
    </div>`
      : "";

  const metaItems: string[] = [];
  if (vis.customerName) {
    metaItems.push(
      `<div class="wide"><span>${escapeHtml(fieldLabels.customer || "Customer")}:</span> ${escapeHtml(customerName)}</div>`,
    );
  }
  if (vis.tableNumber) {
    metaItems.push(
      `<div><span>${escapeHtml(fieldLabels.table || "Table")}:</span> ${escapeHtml(tableName)}</div>`,
    );
  }
  if (vis.timestamp) {
    metaItems.push(
      `<div><span>${escapeHtml(fieldLabels.date || "Date")}:</span> ${escapeHtml(date)}</div>`,
    );
  }
  if (vis.timestamp) {
    metaItems.push(
      `<div><span>${escapeHtml(fieldLabels.time || "Time")}:</span> ${escapeHtml(time)}</div>`,
    );
  }
  if (vis.orderNumber) {
    metaItems.push(
      `<div><span>${escapeHtml(fieldLabels.order || "Order")}:</span> ${escapeHtml(orderRef)}</div>`,
    );
  }
  if (vis.waiterName) {
    metaItems.push(
      `<div><span>${escapeHtml(fieldLabels.waiter || "Waiter")}:</span> ${escapeHtml(waiterName)}</div>`,
    );
  }
  const metaHtml = metaItems.length
    ? `${dash}<div class="meta">${metaItems.join("")}</div>`
    : "";

  const itemRows = lines
    .map(
      (line) => `<tr>
        <td>${line.quantity}</td>
        <td>${escapeHtml(line.name)}</td>
        ${vis.showUnitPrices ? `<td class="r">${escapeHtml(formatPrice(line.unitPrice))}</td>` : ""}
        <td class="r">${escapeHtml(formatPrice(line.lineTotal))}</td>
      </tr>`,
    )
    .join("");
  const heading = itemsHeading?.trim()
    ? `<div class="items-h">${escapeHtml(itemsHeading.trim())}</div>`
    : "";
  const itemsHtml = vis.itemList
    ? `${dash}${heading}<table>
      <thead>
        <tr><th>${escapeHtml(fieldLabels.colQty || "QTY")}</th><th>${escapeHtml(fieldLabels.colItem || "ITEM")}</th>${vis.showUnitPrices ? `<th class="r">${escapeHtml(fieldLabels.colPrice || "PRICE")}</th>` : ""}<th class="r">${escapeHtml(fieldLabels.colLineTotal || "TOTAL")}</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>`
    : "";

  const discountPct =
    discount > 0 && subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0;
  const subtotalRow = vis.subtotal
    ? `<div class="t-row"><span>Subtotal</span><span>${escapeHtml(formatPrice(subtotal))}</span></div>`
    : "";
  const discountRow =
    vis.discount && discount > 0
      ? `<div class="t-row"><span>Discount${discountPct > 0 ? ` (${discountPct}%)` : ""}</span><span>-${escapeHtml(formatPrice(discount))}</span></div>`
      : "";
  const totalRow = vis.totalDue
    ? `<div class="t-row grand"><span>TOTAL DUE</span><span>${escapeHtml(formatPrice(total))}</span></div>`
    : "";
  const totalsHtml =
    subtotalRow || discountRow || totalRow
      ? `${dash}<div class="totals">${subtotalRow}${discountRow}${totalRow}</div>`
      : "";

  const thanksHtml = vis.thankYou
    ? `<div class="thanks">${escapeHtml(footerText)}</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 18px 16px 20px;
      color: #111;
      background: #fff;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.35;
    }
    .sheet { max-width: 80mm; margin: 0 auto; }
    .brand { text-align: center; }
    .brand-row { display: flex; align-items: center; justify-content: center; gap: 10px; }
    .brand-name { font-size: 22px; font-weight: 800; letter-spacing: 0.12em; }
    .brand-sub { margin-top: 4px; font-size: 9px; letter-spacing: 0.38em; color: #444; }
    .contact { margin-top: 12px; text-align: center; font-size: 11px; color: #333; line-height: 1.5; }
    .dash { border: none; border-top: 1px dashed #bbb; margin: 16px 0; }
    .gap { height: 14px; }
    .doc-title { text-align: center; font-size: 14px; font-weight: 800; letter-spacing: 0.16em; }
    .badge {
      margin: 12px auto 0;
      width: fit-content;
      border: 2px solid #111;
      padding: 5px 14px;
      font-size: 10px; font-weight: 800; letter-spacing: 0.28em;
    }
    .items-h { font-size: 9px; letter-spacing: 0.2em; color: #888; margin: 0 0 10px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; line-height: 1.45; }
    .meta span { color: #666; }
    .meta .wide { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: separate; border-spacing: 0 7px; }
    th { padding: 0 6px 8px 0; text-align: left; font-size: 9px; letter-spacing: 0.14em; color: #666; font-weight: 700; }
    th.r { padding: 0 0 8px 6px; }
    th.r, td.r { text-align: right; }
    td { padding: 2px 6px 2px 0; vertical-align: top; line-height: 1.45; }
    td.r { padding: 2px 0 2px 6px; }
    .totals { width: 68%; margin: 4px 0 0 auto; }
    .t-row { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
    .grand { margin-top: 8px; font-size: 15px; font-weight: 800; }
    .legal { margin-top: 16px; text-align: center; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; }
    .thanks { margin-top: 8px; text-align: center; font-size: 12px; color: #333; }
    .orn { display: flex; align-items: center; gap: 8px; margin: 16px 0 8px; }
    .orn hr { flex: 1; border: none; border-top: 1px solid #111; }
    .tag { text-align: center; font-size: 8px; letter-spacing: 0.24em; color: #666; }
    .powered { margin-top: 10px; text-align: center; font-size: 9px; color: #888; }
    @media print { body { padding: 8px; } }
    ${printDesignCss(args.design)}
  </style>
</head>
<body>
  <div class="sheet">
    ${brandHtml}
    ${dash}
    ${title ? `<div class="doc-title">${escapeHtml(title)}</div>` : ""}
    <div class="badge">${DEBT_VOUCHER_BADGE}</div>
    ${metaHtml}
    ${itemsHtml}
    ${totalsHtml}
    ${vis.balanceNotice && legalText ? `<div class="legal">${escapeHtml(legalText)}</div>` : ""}
    ${thanksHtml}
    <div class="orn"><hr/>${LEDGER_SVG}<hr/></div>
    ${tagline ? `<div class="tag">${escapeHtml(tagline)}</div>` : ""}
    <div class="powered">${PRINT_POWERED_BY}</div>
  </div>
</body>
</html>`;
}
