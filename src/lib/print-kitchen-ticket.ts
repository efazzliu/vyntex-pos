import { PRINT_POWERED_BY } from "@/lib/print-html.ts";
import { printDesignCss } from "@/lib/print-design.ts";

export type KitchenTicketLine = {
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: string;
};

export type KitchenTicketVisibility = {
  logo: boolean;
  divider: boolean;
  timestamp: boolean;
  orderNumber: boolean;
  waiterName: boolean;
  tableNumber: boolean;
  itemList: boolean;
  itemModifiers: boolean;
  itemNotes: boolean;
};

export const DEFAULT_KITCHEN_VISIBILITY: KitchenTicketVisibility = {
  logo: false,
  divider: true,
  timestamp: true,
  orderNumber: true,
  waiterName: true,
  tableNumber: true,
  itemList: true,
  itemModifiers: true,
  itemNotes: true,
};

export const KITCHEN_TICKET_TITLE = "KITCHEN";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function resolveKitchenTicketCopy(labels?: { headerText?: string }) {
  const header = (labels?.headerText ?? "").trim();
  const firstLine = header.split("\n")[0]?.trim() ?? "";
  const isLegacy = !firstLine || /^kitchen( order)?$/i.test(firstLine);
  return { title: isLegacy ? KITCHEN_TICKET_TITLE : firstLine };
}

export function visibilityFromKitchenElements(elements: {
  logo: boolean;
  divider: boolean;
  timestamp: boolean;
  orderNumber?: boolean;
  waiterName: boolean;
  tableNumber: boolean;
  itemList: boolean;
  itemModifiers?: boolean;
  itemNotes?: boolean;
}): KitchenTicketVisibility {
  return {
    logo: elements.logo,
    divider: elements.divider,
    timestamp: elements.timestamp,
    orderNumber: elements.orderNumber !== false,
    waiterName: elements.waiterName,
    tableNumber: elements.tableNumber,
    itemList: elements.itemList,
    itemModifiers: elements.itemModifiers !== false,
    itemNotes: elements.itemNotes !== false,
  };
}

export function visibilityFromKitchenTemplate(
  toggles?: {
    logo?: boolean;
    waiterName?: boolean;
    tableNumber?: boolean;
    timestamp?: boolean;
    orderNumber?: boolean;
  } | null,
  designExtra?: Record<string, unknown> | null,
): KitchenTicketVisibility {
  const el =
    designExtra?.elements && typeof designExtra.elements === "object"
      ? (designExtra.elements as Record<string, unknown>)
      : {};
  return {
    logo: bool(toggles?.logo, false),
    divider: bool(el.divider, true),
    timestamp: bool(toggles?.timestamp, true),
    orderNumber: bool(el.orderNumber ?? toggles?.orderNumber, true),
    waiterName: bool(toggles?.waiterName, true),
    tableNumber: bool(toggles?.tableNumber, true),
    itemList: bool(el.itemList, true),
    itemModifiers: bool(el.itemModifiers, true),
    itemNotes: bool(el.itemNotes, true),
  };
}

export function buildKitchenTicketHtml(args: {
  lines: KitchenTicketLine[];
  orderRef: string;
  tableName: string;
  waiterName: string;
  printedAt: Date;
  title?: string;
  tablePrefix?: string;
  pageTitle?: string;
  logoDataUrl?: string | null;
  hour12?: boolean;
  visibility?: Partial<KitchenTicketVisibility>;
  design?: unknown;
}): string {
  const {
    lines,
    orderRef,
    tableName,
    waiterName,
    printedAt,
    title = KITCHEN_TICKET_TITLE,
    tablePrefix = "TABLE",
    pageTitle = "Kitchen ticket",
    logoDataUrl,
    hour12 = false,
  } = args;
  const vis = { ...DEFAULT_KITCHEN_VISIBILITY, ...args.visibility };
  const time = printedAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12,
  });
  const date = printedAt.toLocaleDateString("en-GB").replace(/\//g, ".");
  const dash = vis.divider ? `<hr class="dash"/>` : `<div class="gap"></div>`;
  const logo = vis.logo
    ? logoDataUrl
      ? `<img src="${escapeHtml(logoDataUrl)}" alt="" class="logo"/>`
      : ""
    : "";

  const meta: string[] = [];
  if (vis.orderNumber) {
    meta.push(`<div><span>Order:</span> ${escapeHtml(orderRef)}</div>`);
  }
  if (vis.waiterName) {
    meta.push(`<div><span>Waiter:</span> ${escapeHtml(waiterName)}</div>`);
  }
  if (vis.timestamp) {
    meta.push(`<div><span>Time:</span> ${escapeHtml(time)}</div>`);
    meta.push(`<div><span>Date:</span> ${escapeHtml(date)}</div>`);
  }
  const metaHtml = meta.length ? `${dash}<div class="meta">${meta.join("")}</div>` : "";

  const itemsHtml = vis.itemList
    ? `${dash}<div class="items">${lines
        .map((line) => {
          const extras = [
            vis.itemModifiers && line.modifiers?.trim()
              ? `<div class="extra">${escapeHtml(line.modifiers.trim())}</div>`
              : "",
            vis.itemNotes && line.notes?.trim()
              ? `<div class="extra">${escapeHtml(line.notes.trim())}</div>`
              : "",
          ].join("");
          return `<div class="row"><span class="qty">${line.quantity}</span><div class="name">${escapeHtml(line.name)}${extras}</div></div>`;
        })
        .join("")}</div>`
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
      padding: 14px 12px 16px;
      color: #111;
      background: #fff;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.3;
    }
    .sheet { max-width: 80mm; margin: 0 auto; }
    .logo { display: block; max-height: 40px; max-width: 90px; margin: 0 auto 8px; object-fit: contain; }
    .title { text-align: center; font-size: 22px; font-weight: 800; letter-spacing: 0.18em; }
    .table { margin-top: 6px; text-align: center; font-size: 13px; font-weight: 800; letter-spacing: 0.2em; }
    .dash { border: none; border-top: 1px dashed #bbb; margin: 12px 0; }
    .gap { height: 10px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12px; }
    .meta span { color: #666; }
    .items { display: flex; flex-direction: column; gap: 10px; }
    .row { display: flex; gap: 10px; align-items: flex-start; }
    .qty { min-width: 1.1em; font-size: 20px; font-weight: 800; line-height: 1; }
    .name { font-size: 15px; font-weight: 700; line-height: 1.25; }
    .extra { margin-top: 3px; font-size: 12px; font-weight: 500; color: #444; }
    .powered { margin-top: 14px; text-align: center; font-size: 9px; color: #888; }
    @media print { body { padding: 6px; } }
    ${printDesignCss(args.design)}
  </style>
</head>
<body>
  <div class="sheet">
    ${logo}
    ${title ? `<div class="title">${escapeHtml(title)}</div>` : ""}
    ${vis.tableNumber ? `<div class="table">${escapeHtml(tablePrefix ? `${tablePrefix} ${tableName}` : tableName)}</div>` : ""}
    ${metaHtml}
    ${itemsHtml}
    <div class="powered">${PRINT_POWERED_BY}</div>
  </div>
</body>
</html>`;
}
