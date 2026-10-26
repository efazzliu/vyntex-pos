import { PRINT_POWERED_BY } from "@/lib/print-html.ts";
import { printDesignCss } from "@/lib/print-design.ts";

export type ComplimentaryLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ComplimentaryBusiness = {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
};

export type ComplimentaryVisibility = {
  logo: boolean;
  storeInfo: boolean;
  divider: boolean;
  timestamp: boolean;
  orderNumber: boolean;
  operator: boolean;
  waiterName: boolean;
  tableNumber: boolean;
  itemList: boolean;
  menuValue: boolean;
  complimentaryWriteoff: boolean;
  totalDue: boolean;
  complimentaryNotice: boolean;
  thankYou: boolean;
};

export const DEFAULT_COMPLIMENTARY_VISIBILITY: ComplimentaryVisibility = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  orderNumber: true,
  operator: true,
  waiterName: true,
  tableNumber: true,
  itemList: true,
  menuValue: true,
  complimentaryWriteoff: false,
  totalDue: true,
  complimentaryNotice: true,
  thankYou: true,
};

export const COMPLIMENTARY_TITLE = "WITH COMPLIMENTS";
export const COMPLIMENTARY_BADGE = "ON THE HOUSE";
export const COMPLIMENTARY_NOTICE = "COMPLIMENTARY — NOT A SALE";
export const COMPLIMENTARY_FOOTER = "Enjoy your treat";
export const COMPLIMENTARY_MOTTO = "GOOD FOOD · GREAT PEOPLE";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const GIFT_SVG = `<svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M7.5 14.5h21v4.2H7.5z" fill="#111"/>
  <rect x="7.5" y="18.7" width="21" height="12.3" stroke="#111" stroke-width="1.6"/>
  <path d="M18 14.5v16.5" stroke="#fff" stroke-width="1.7"/>
  <path d="M18 14.6c-3.4-4.2-8-4.1-8-1.2 0 2.4 3.6 3 8 1.2Z" stroke="#111" stroke-width="1.5"/>
  <path d="M18 14.6c3.4-4.2 8-4.1 8-1.2 0 2.4-3.6 3-8 1.2Z" stroke="#111" stroke-width="1.5"/>
</svg>`;

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function resolveComplimentaryCopy(labels?: {
  headerText?: string;
  footerText?: string;
  legalText?: string;
  tagline?: string;
}) {
  const header = (labels?.headerText ?? "").trim();
  const footer = (labels?.footerText ?? "").trim();
  const firstLine = header.split("\n")[0]?.trim() ?? "";
  const isLegacy = !firstLine || /^complimentary$/i.test(firstLine);
  return {
    title: isLegacy ? COMPLIMENTARY_TITLE : firstLine,
    footerText:
      !footer || /^on the house/i.test(footer)
        ? COMPLIMENTARY_FOOTER
        : footer,
    legalText:
      typeof labels?.legalText === "string" && labels.legalText.trim()
        ? labels.legalText.trim()
        : COMPLIMENTARY_NOTICE,
    tagline:
      typeof labels?.tagline === "string" && labels.tagline.trim()
        ? labels.tagline.trim()
        : COMPLIMENTARY_MOTTO,
  };
}

export function visibilityFromComplimentaryElements(elements: {
  logo: boolean;
  storeInfo: boolean;
  divider: boolean;
  timestamp: boolean;
  orderNumber?: boolean;
  operator?: boolean;
  waiterName: boolean;
  tableNumber: boolean;
  itemList: boolean;
  subtotal?: boolean;
  discount?: boolean;
  totalDue?: boolean;
  preliminaryNotice?: boolean;
  thankYou: boolean;
}): ComplimentaryVisibility {
  return {
    logo: elements.logo,
    storeInfo: elements.storeInfo,
    divider: elements.divider,
    timestamp: elements.timestamp,
    orderNumber: elements.orderNumber !== false,
    operator: elements.operator !== false,
    waiterName: elements.waiterName,
    tableNumber: elements.tableNumber,
    itemList: elements.itemList,
    menuValue: elements.subtotal !== false,
    complimentaryWriteoff: false,
    totalDue: elements.totalDue !== false,
    complimentaryNotice: elements.preliminaryNotice !== false,
    thankYou: elements.thankYou,
  };
}

export function visibilityFromComplimentaryTemplate(
  toggles?: {
    logo?: boolean;
    footerText?: boolean;
    waiterName?: boolean;
    tableNumber?: boolean;
    timestamp?: boolean;
    orderNumber?: boolean;
  } | null,
  designExtra?: Record<string, unknown> | null,
): ComplimentaryVisibility {
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
    operator: bool(el.operator, true),
    waiterName: bool(toggles?.waiterName, true),
    tableNumber: bool(toggles?.tableNumber, true),
    itemList: bool(el.itemList, true),
    menuValue: bool(el.subtotal, true),
    complimentaryWriteoff: false,
    totalDue: bool(el.totalDue, true),
    complimentaryNotice: bool(el.preliminaryNotice, true),
    thankYou: bool(toggles?.footerText, true),
  };
}

export function complimentaryPrintExtras(designExtra?: Record<string, unknown> | null) {
  const content =
    designExtra?.content && typeof designExtra.content === "object"
      ? (designExtra.content as Record<string, unknown>)
      : {};
  const text = (value: unknown, fallback = "") =>
    typeof value === "string" ? value : fallback;
  return {
    venueLine: text(content.venueName),
    itemsHeading: text(content.itemsTitle, "TREAT"),
    storeName: text(content.storeName),
    dateFormat: content.dateFormat === "long" ? "long" : "short",
    hour12: content.timeFormat === "12h",
    legalText: text(content.legalText, COMPLIMENTARY_NOTICE),
    motto: text(content.motto ?? designExtra?.motto, COMPLIMENTARY_MOTTO),
    fieldLabels: {
      table: text(content.tableLabel, "Table"),
      date: text(content.dateLabel, "Date"),
      time: text(content.timeLabel, "Time"),
      order: "Order",
      waiter: text(content.waiterLabel, "Waiter"),
      approved: "Approved",
      colQty: text(content.colQty, "QTY"),
      colItem: text(content.colItem, "ITEM"),
    },
  };
}

export function buildComplimentarySlipHtml(args: {
  lines: ComplimentaryLine[];
  menuValue: number;
  orderRef: string;
  tableName: string;
  waiterName: string;
  approvedBy?: string;
  printedAt: Date;
  formatPrice: (n: number) => string;
  logoDataUrl?: string | null;
  business?: ComplimentaryBusiness;
  title?: string;
  footerText?: string;
  legalText?: string;
  tagline?: string;
  pageTitle?: string;
  venueLine?: string;
  itemsHeading?: string;
  dateFormat?: "short" | "long";
  hour12?: boolean;
  visibility?: Partial<ComplimentaryVisibility>;
  fieldLabels?: {
    table?: string;
    date?: string;
    time?: string;
    order?: string;
    waiter?: string;
    approved?: string;
    colQty?: string;
    colItem?: string;
  };
  design?: unknown;
}): string {
  const {
    lines,
    menuValue,
    orderRef,
    tableName,
    waiterName,
    approvedBy = "Admin",
    printedAt,
    formatPrice,
    logoDataUrl,
    business,
    title = COMPLIMENTARY_TITLE,
    footerText = COMPLIMENTARY_FOOTER,
    legalText = COMPLIMENTARY_NOTICE,
    tagline = COMPLIMENTARY_MOTTO,
    pageTitle = "Complimentary slip",
    venueLine,
    itemsHeading,
    dateFormat = "short",
    hour12 = false,
    fieldLabels = {},
  } = args;
  const vis = { ...DEFAULT_COMPLIMENTARY_VISIBILITY, ...args.visibility };

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
      : GIFT_SVG
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
  if (vis.operator) {
    metaItems.push(
      `<div><span>${escapeHtml(fieldLabels.approved || "Approved")}:</span> ${escapeHtml(approvedBy)}</div>`,
    );
  }
  const metaHtml = metaItems.length
    ? `${dash}<div class="meta">${metaItems.join("")}</div>`
    : "";

  const itemRows = lines
    .map(
      (line) => `<tr>
        <td class="qty">${line.quantity}</td>
        <td>${escapeHtml(line.name)}</td>
      </tr>`,
    )
    .join("");
  const heading = itemsHeading?.trim()
    ? `<div class="items-h">${escapeHtml(itemsHeading.trim())}</div>`
    : "";
  const itemsHtml = vis.itemList
    ? `${dash}${heading}<table>
      <thead>
        <tr><th>${escapeHtml(fieldLabels.colQty || "QTY")}</th><th>${escapeHtml(fieldLabels.colItem || "ITEM")}</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>`
    : "";

  const value = Math.max(0, menuValue);
  const menuRow = vis.menuValue
    ? `<div class="t-row"><span>Menu value</span><span>${escapeHtml(formatPrice(value))}</span></div>`
    : "";
  const writeoffRow = vis.complimentaryWriteoff
    ? `<div class="t-row"><span>Complimentary</span><span>−${escapeHtml(formatPrice(value))}</span></div>`
    : "";
  const totalRow = vis.totalDue
    ? `<div class="t-row grand"><span>TOTAL</span><span>${escapeHtml(formatPrice(0))}</span></div>`
    : "";
  const totalsHtml =
    menuRow || writeoffRow || totalRow
      ? `${dash}<div class="totals">${menuRow}${writeoffRow}${totalRow}</div>`
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
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.28em;
    }
    .items-h { font-size: 9px; letter-spacing: 0.28em; color: #888; margin: 0 0 10px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; line-height: 1.45; }
    .meta span { color: #666; }
    table { width: 100%; border-collapse: separate; border-spacing: 0 8px; }
    th { padding: 0 6px 8px 0; text-align: left; font-size: 9px; letter-spacing: 0.14em; color: #666; font-weight: 700; }
    td { padding: 2px 6px 2px 0; vertical-align: top; line-height: 1.45; }
    td.qty { width: 2.2em; }
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
    <div class="badge">${COMPLIMENTARY_BADGE}</div>
    ${metaHtml}
    ${itemsHtml}
    ${totalsHtml}
    ${vis.complimentaryNotice && legalText ? `<div class="legal">${escapeHtml(legalText)}</div>` : ""}
    ${thanksHtml}
    <div class="orn"><hr/>${GIFT_SVG}<hr/></div>
    ${tagline ? `<div class="tag">${escapeHtml(tagline)}</div>` : ""}
    <div class="powered">${PRINT_POWERED_BY}</div>
  </div>
</body>
</html>`;
}
