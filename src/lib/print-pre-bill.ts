import { PRINT_POWERED_BY } from "@/lib/print-html.ts";
import { printDesignCss } from "@/lib/print-design.ts";

export type PreBillLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
  modifiers?: string;
};

export type PreBillBusiness = {
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  website?: string;
};

export type PreBillVisibility = {
  logo: boolean;
  storeInfo: boolean;
  divider: boolean;
  timestamp: boolean;
  orderNumber: boolean;
  operator: boolean;
  waiterName: boolean;
  tableNumber: boolean;
  guests: boolean;
  itemList: boolean;
  itemModifiers: boolean;
  itemNotes: boolean;
  showUnitPrices: boolean;
  discount: boolean;
  showZeroDiscount: boolean;
  subtotal: boolean;
  taxSummary: boolean;
  totalDue: boolean;
  preliminaryNotice: boolean;
  paymentMethod: boolean;
  thankYou: boolean;
  qrCode: boolean;
};

export const DEFAULT_PRE_BILL_VISIBILITY: PreBillVisibility = {
  logo: true,
  storeInfo: true,
  divider: true,
  timestamp: true,
  orderNumber: true,
  operator: false,
  waiterName: true,
  tableNumber: true,
  guests: true,
  itemList: true,
  itemModifiers: true,
  itemNotes: true,
  showUnitPrices: true,
  discount: true,
  showZeroDiscount: false,
  subtotal: true,
  taxSummary: false,
  totalDue: true,
  preliminaryNotice: true,
  paymentMethod: false,
  thankYou: true,
  qrCode: false,
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CUTLERY_SVG = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M13.2 4.2c.4 0 .7.5.7 1.1v7.2c0 1.1-.6 1.8-1.4 2v16.2c0 .7-.5 1.3-1.2 1.3s-1.2-.6-1.2-1.3V14.5c-.8-.2-1.4-.9-1.4-2V5.3c0-.6.3-1.1.7-1.1s.7.5.7 1.1v6.4h.7V5.3c0-.6.3-1.1.7-1.1s.7.5.7 1.1v6.4h.7V5.3c0-.6.3-1.1.7-1.1Z" fill="#111"/>
  <path d="M24.8 4.5c.7 0 1.2.6 1.2 1.3v9.4c2 1 3.2 2.6 3.2 4.6 0 2.4-1.7 4.3-4.1 4.8v6.1c0 .7-.5 1.3-1.2 1.3s-1.2-.6-1.2-1.3V24.6c-2.4-.5-4.1-2.4-4.1-4.8 0-2 1.2-3.6 3.2-4.6V5.8c0-.7.5-1.3 1.2-1.3h1.8Z" fill="#111"/>
</svg>`;

export function resolvePreBillCopy(labels?: {
  headerText?: string;
  footerText?: string;
  subtitle?: string;
  legalText?: string;
  tagline?: string;
}) {
  const header = (labels?.headerText ?? "").trim();
  const footer = (labels?.footerText ?? "").trim();
  const [first = "", ...restParts] = header.split("\n");
  const firstLine = first.trim();
  const rest = restParts.join(" ").trim();
  const isLegacy = !firstLine || /^non[-\s]?fiscal/i.test(firstLine);
  const subtitle =
    typeof labels?.subtitle === "string" ? labels.subtitle.trim() : rest;
  return {
    title: isLegacy ? "PRE-BILL" : firstLine,
    subtitle,
    footerText:
      !footer || /this is not a fiscal/i.test(footer) || /preliminary bill/i.test(footer)
        ? "Thank you for your visit!"
        : footer,
    legalText:
      typeof labels?.legalText === "string"
        ? labels.legalText.trim()
        : "PRELIMINARY BILL — NOT A FISCAL RECEIPT",
    tagline:
      typeof labels?.tagline === "string"
        ? labels.tagline.trim()
        : "GOOD FOOD · GREAT PEOPLE",
  };
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function readPreBillContentExtra(designExtra?: Record<string, unknown> | null) {
  const o =
    designExtra?.content && typeof designExtra.content === "object"
      ? (designExtra.content as Record<string, unknown>)
      : {};
  const str = (key: string) => (typeof o[key] === "string" ? o[key] : undefined);
  return {
    storeName: str("storeName"),
    venueName: str("venueName"),
    motto:
      (typeof designExtra?.motto === "string" ? designExtra.motto : undefined) ??
      str("motto") ??
      (typeof designExtra?.tagline === "string" ? designExtra.tagline : undefined),
    subtitle:
      str("subtitle") ??
      (typeof designExtra?.subtitle === "string" ? designExtra.subtitle : undefined),
    legalText:
      str("legalText") ??
      (typeof designExtra?.legalText === "string" ? designExtra.legalText : undefined),
    itemsTitle: str("itemsTitle"),
    showQtyPrefix: false,
    showUnitPrices: typeof o.showUnitPrices === "boolean" ? o.showUnitPrices : undefined,
    dateFormat: undefined,
    hour12: false,
    currency:
      o.currency === "none" || o.currency === "eur" || o.currency === "all"
        ? o.currency
        : undefined,
    currencyPosition:
      o.currencyPosition === "before" || o.currencyPosition === "after"
        ? o.currencyPosition
        : undefined,
    tableLabel: undefined,
    dateLabel: undefined,
    timeLabel: undefined,
    guestsLabel: undefined,
    waiterLabel: undefined,
    operatorLabel: undefined,
    subtotalLabel: undefined,
    totalLabel: undefined,
    discountLabel: undefined,
    colQty: str("colQty"),
    colItem: str("colItem"),
    colPrice: str("colPrice"),
    colLineTotal: str("colLineTotal"),
  };
}

export function formatPreBillMoney(
  n: number,
  content?: { currency?: string; currencyPosition?: string },
  fallback?: (n: number) => string,
) {
  if (!content?.currency) {
    return fallback ? fallback(n) : n.toFixed(2);
  }
  const digits = content.currency === "all" ? 0 : 2;
  const num = n.toFixed(digits);
  const sym = content.currency === "eur" ? "€" : content.currency === "all" ? "L" : "";
  if (!sym) return num;
  return content.currencyPosition === "before" ? `${sym}${num}` : `${num} ${sym}`;
}

export function preBillPrintExtras(designExtra?: Record<string, unknown> | null) {
  const content = readPreBillContentExtra(designExtra);
  return {
    content,
    venueLine: content.venueName,
    itemsHeading: content.itemsTitle,
    showQtyPrefix: content.showQtyPrefix,
    dateFormat: content.dateFormat,
    hour12: content.hour12,
    fieldLabels: {
      table: content.tableLabel,
      date: content.dateLabel,
      time: content.timeLabel,
      guests: content.guestsLabel,
      waiter: content.waiterLabel,
      operator: content.operatorLabel,
      subtotal: content.subtotalLabel,
      total: content.totalLabel,
      discount: content.discountLabel,
      colQty: content.colQty,
      colItem: content.colItem,
      colPrice: content.colPrice,
      colLineTotal: content.colLineTotal,
    },
  };
}

export function visibilityFromReceiptElements(
  elements: {
    logo: boolean;
    storeInfo: boolean;
    divider: boolean;
    timestamp: boolean;
    fiscalNumber: boolean;
    orderNumber?: boolean;
    operator: boolean;
    waiterName: boolean;
    tableNumber: boolean;
    guestCount?: boolean;
    itemList: boolean;
    itemModifiers?: boolean;
    itemNotes?: boolean;
    discount?: boolean;
    unitPrices?: boolean;
    subtotal?: boolean;
    taxSummary: boolean;
    totalDue?: boolean;
    preliminaryNotice?: boolean;
    paymentMethod: boolean;
    thankYou: boolean;
    qrCode: boolean;
  },
): PreBillVisibility {
  return {
    logo: elements.logo,
    storeInfo: elements.storeInfo,
    divider: elements.divider,
    timestamp: elements.timestamp,
    orderNumber: elements.orderNumber !== false,
    operator: false,
    waiterName: elements.waiterName,
    tableNumber: elements.tableNumber,
    guests: false,
    itemList: elements.itemList,
    itemModifiers: false,
    itemNotes: false,
    showUnitPrices: elements.unitPrices !== false,
    discount: elements.discount !== false,
    showZeroDiscount: false,
    subtotal: elements.subtotal !== false,
    taxSummary: false,
    totalDue: elements.totalDue !== false,
    preliminaryNotice: elements.preliminaryNotice !== false,
    paymentMethod: false,
    thankYou: elements.thankYou,
    qrCode: false,
  };
}

export function visibilityFromTemplate(
  toggles?: {
    logo?: boolean;
    footerText?: boolean;
    waiterName?: boolean;
    tableNumber?: boolean;
    timestamp?: boolean;
    taxDetails?: boolean;
    orderNumber?: boolean;
    unitPrices?: boolean;
  },
  designExtra?: Record<string, unknown> | null,
): PreBillVisibility {
  const el =
    designExtra?.elements && typeof designExtra.elements === "object"
      ? (designExtra.elements as Record<string, unknown>)
      : {};
  return {
    logo: bool(toggles?.logo, true),
    storeInfo: bool(el.storeInfo, true),
    divider: bool(el.divider, true),
    timestamp: bool(toggles?.timestamp, true),
    orderNumber: bool(el.orderNumber, true),
    operator: false,
    waiterName: bool(toggles?.waiterName, true),
    tableNumber: bool(toggles?.tableNumber, true),
    guests: false,
    itemList: bool(el.itemList, true),
    itemModifiers: false,
    itemNotes: false,
    showUnitPrices: bool(el.unitPrices ?? toggles?.unitPrices, true),
    discount: bool(el.discount, true),
    showZeroDiscount: bool(el.showZeroDiscount, false),
    subtotal: bool(el.subtotal, true),
    taxSummary: false,
    totalDue: bool(el.totalDue, true),
    preliminaryNotice: bool(el.preliminaryNotice, true),
    paymentMethod: false,
    thankYou: bool(toggles?.footerText, true),
    qrCode: false,
  };
}

export function buildPreBillHtml(args: {
  lines: PreBillLine[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  orderRef: string;
  tableName: string;
  waiterName: string;
  operatorName?: string;
  paymentMethod?: string;
  guests?: number;
  printedAt: Date;
  formatPrice: (n: number) => string;
  logoDataUrl?: string | null;
  business?: PreBillBusiness;
  title?: string;
  subtitle?: string;
  footerText?: string;
  legalText?: string;
  tagline?: string;
  pageTitle?: string;
  venueLine?: string;
  itemsHeading?: string;
  showQtyPrefix?: boolean;
  dateFormat?: "short" | "long";
  hour12?: boolean;
  visibility?: Partial<PreBillVisibility>;
  fieldLabels?: {
    table?: string;
    date?: string;
    time?: string;
    guests?: string;
    order?: string;
    waiter?: string;
    operator?: string;
    payment?: string;
    subtotal?: string;
    tax?: string;
    total?: string;
    discount?: string;
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
    tax = 0,
    total,
    orderRef,
    tableName,
    waiterName,
    operatorName = "Admin",
    paymentMethod = "Cash",
    guests,
    printedAt,
    formatPrice,
    logoDataUrl,
    business,
    title = "PRE-BILL",
    subtitle = "",
    footerText = "Thank you for your visit!",
    legalText = "PRELIMINARY BILL — NOT A FISCAL RECEIPT",
    tagline = "GOOD FOOD · GREAT PEOPLE",
    pageTitle = "Pre-bill",
    venueLine,
    itemsHeading,
    showQtyPrefix = false,
    dateFormat = "short",
    hour12 = false,
    fieldLabels = {},
  } = args;
  const vis = { ...DEFAULT_PRE_BILL_VISIBILITY, ...args.visibility };

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
      : CUTLERY_SVG
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
  if (vis.guests && guests != null) {
    metaItems.push(
      `<div><span>${escapeHtml(fieldLabels.guests || "Guests")}:</span> ${guests}</div>`,
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
      `<div><span>${escapeHtml(fieldLabels.operator || "Operator")}:</span> ${escapeHtml(operatorName)}</div>`,
    );
  }
  const metaHtml = metaItems.length
    ? `${dash}<div class="meta">${metaItems.join("")}</div>`
    : "";

  const splitLineExtras = (line: PreBillLine) => {
    if (line.modifiers || !line.notes) {
      return { modifiers: line.modifiers?.trim(), notes: line.notes?.trim() };
    }
    const idx = line.notes.indexOf(" | ");
    if (idx === -1) {
      return line.notes.includes(": ")
        ? { modifiers: line.notes.trim(), notes: undefined }
        : { modifiers: undefined, notes: line.notes.trim() };
    }
    return {
      modifiers: line.notes.slice(0, idx).trim() || undefined,
      notes: line.notes.slice(idx + 3).trim() || undefined,
    };
  };
  const itemRows = lines
    .map((line) => {
      const itemName = showQtyPrefix ? `${line.quantity}x ${line.name}` : line.name;
      const extra = splitLineExtras(line);
      const extras = [
        vis.itemModifiers && extra.modifiers
          ? `<div class="note">${escapeHtml(extra.modifiers)}</div>`
          : "",
        vis.itemNotes && extra.notes
          ? `<div class="note">${escapeHtml(extra.notes)}</div>`
          : "",
      ].join("");
      return `<tr>
        <td>${line.quantity}</td>
        <td>${escapeHtml(itemName)}${extras}</td>
        ${vis.showUnitPrices ? `<td class="r">${escapeHtml(formatPrice(line.unitPrice))}</td>` : ""}
        <td class="r">${escapeHtml(formatPrice(line.lineTotal))}</td>
      </tr>`;
    })
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
  const discountRow =
    vis.discount && (discount > 0 || vis.showZeroDiscount)
      ? `<div class="t-row"><span>${escapeHtml(fieldLabels.discount || "Discount")}${discountPct > 0 ? ` (${discountPct}%)` : ""}</span><span>-${escapeHtml(formatPrice(discount))}</span></div>`
      : "";
  const taxRow =
    vis.taxSummary && tax > 0
      ? `<div class="t-row"><span>${escapeHtml(fieldLabels.tax || "TVSH")}</span><span>${escapeHtml(formatPrice(tax))}</span></div>`
      : "";
  const subtotalRow = vis.subtotal
    ? `<div class="t-row"><span>${escapeHtml(fieldLabels.subtotal || "Subtotal")}</span><span>${escapeHtml(formatPrice(subtotal))}</span></div>`
    : "";
  const totalRow = vis.totalDue
    ? `<div class="t-row grand"><span>${escapeHtml(fieldLabels.total || "TOTAL")}</span><span>${escapeHtml(formatPrice(total))}</span></div>`
    : "";
  const totalsHtml =
    subtotalRow || discountRow || taxRow || totalRow
      ? `${dash}<div class="totals">${subtotalRow}${discountRow}${taxRow}${totalRow}</div>`
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
    .doc-title { text-align: center; font-size: 14px; font-weight: 800; letter-spacing: 0.1em; }
    .doc-sub { margin-top: 6px; text-align: center; font-size: 10px; letter-spacing: 0.2em; color: #555; }
    .items-h { font-size: 9px; letter-spacing: 0.2em; color: #888; margin: 0 0 10px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; line-height: 1.45; }
    .meta span { color: #666; }
    table { width: 100%; border-collapse: separate; border-spacing: 0 7px; }
    th { padding: 0 6px 8px 0; text-align: left; font-size: 9px; letter-spacing: 0.14em; color: #666; font-weight: 700; }
    th.r { padding: 0 0 8px 6px; }
    th.r, td.r { text-align: right; }
    td { padding: 2px 6px 2px 0; vertical-align: top; line-height: 1.45; }
    td.r { padding: 2px 0 2px 6px; }
    .note { color: #777; font-size: 10px; }
    .totals { width: 62%; margin: 4px 0 0 auto; }
    .t-row { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
    .grand { margin-top: 8px; font-size: 15px; font-weight: 800; }
    .legal { margin-top: 16px; text-align: center; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; }
    .thanks { margin-top: 6px; text-align: center; font-size: 11px; color: #444; }
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
    ${subtitle ? `<div class="doc-sub">${escapeHtml(subtitle)}</div>` : ""}
    ${metaHtml}
    ${itemsHtml}
    ${totalsHtml}
    ${vis.preliminaryNotice && legalText ? `<div class="legal">${escapeHtml(legalText)}</div>` : ""}
    ${thanksHtml}
    <div class="orn"><hr/>${CUTLERY_SVG}<hr/></div>
    ${tagline ? `<div class="tag">${escapeHtml(tagline)}</div>` : ""}
    <div class="powered">${PRINT_POWERED_BY}</div>
  </div>
</body>
</html>`;
}
