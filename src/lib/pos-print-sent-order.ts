/**
 * Prints a just-sent POS order (kitchen/bar ticket). In Electron, prints silently
 * to the default printer; in the browser, uses the system print dialog (hidden iframe).
 */
export type SentOrderTicketLine = {
  name: string;
  quantity: number;
  notes?: string;
  station?: "kitchen" | "bar";
  price?: number;
};

export type PrintSentOrderTicketOptions = {
  title: string;
  tableLabel: string;
  tableName: string;
  orderLabel: string;
  orderValue: string;
  staffLabel: string;
  staffName: string;
  printedLabel: string;
  stationKitchen: string;
  stationBar: string;
  lines: SentOrderTicketLine[];
  formatPrice: (amount: number) => string;
  /** Electron silent print: OS printer name (Settings → printer Address, else Name). */
  deviceName?: string;
};

import {
  DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  hasElectronSilentPrintIpc,
  isSilentPrintQueueableError,
  tryPrintHtmlDocumentAsync,
  type PrintHtmlAsyncOutcome,
} from "@/lib/print-html.ts";
import { enqueueHtmlPrintJob } from "@/lib/print-queue.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function printSentOrderTicket(
  opts: PrintSentOrderTicketOptions,
): Promise<PrintHtmlAsyncOutcome> {
  const lines = opts.lines;
  const allSameStation =
    lines.length > 0 &&
    (lines.every((l) => l.station === "bar") ||
      lines.every((l) => l.station !== "bar"));

  const rows = lines
    .map((l) => {
      const station =
        l.station === "bar" ? opts.stationBar : opts.stationKitchen;
      const notes = l.notes
        ? `<div class="notes">${escapeHtml(l.notes)}</div>`
        : "";
      const lineTotal =
        l.price != null ? l.price * l.quantity : null;
      const priceCol =
        lineTotal != null
          ? `<td class="r">${escapeHtml(opts.formatPrice(lineTotal))}</td>`
          : "";
      const stationRow =
        allSameStation
          ? ""
          : `<div class="st">${escapeHtml(station)}</div>`;
      return `<tr>
        <td><span class="qty">${l.quantity}×</span> ${escapeHtml(l.name)}${notes}${stationRow}</td>
        ${priceCol}
      </tr>`;
    })
    .join("");

  const hasPrice = lines.some((l) => l.price != null);
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(opts.title)}</title>
  <style>
    body { font-family: system-ui, Segoe UI, sans-serif; padding: 16px; color: #111; font-size: 14px; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 16px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 8px 0; border-bottom: 1px solid #ddd; }
    td.r { text-align: right; white-space: nowrap; padding-left: 8px; }
    .qty { font-weight: 700; }
    .notes { font-size: 11px; color: #666; margin-top: 4px; }
    .st { font-size: 10px; text-transform: uppercase; color: #888; margin-top: 4px; }
    @media print { body { padding: 8px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(opts.title)}</h1>
  <div class="meta">
    <div><strong>${escapeHtml(opts.tableLabel)}</strong> ${escapeHtml(opts.tableName)}</div>
    <div><strong>${escapeHtml(opts.orderLabel)}</strong> ${escapeHtml(opts.orderValue)}</div>
    <div><strong>${escapeHtml(opts.staffLabel)}</strong> ${escapeHtml(opts.staffName)}</div>
    <div><strong>${escapeHtml(opts.printedLabel)}</strong> ${escapeHtml(new Date().toLocaleString())}</div>
  </div>
  <table>
    ${hasPrice ? "<colgroup><col/><col style='width:72px'/></colgroup>" : ""}
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const outcome = await tryPrintHtmlDocumentAsync(html, {
    silent: true,
    // Browser / plain Vite: no IPC — must use the print dialog. Electron: silent only.
    allowInteractiveFallback: !hasElectronSilentPrintIpc(),
    deviceName: opts.deviceName,
    silentTimeoutMs: DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  });

  if (!outcome.ok && isSilentPrintQueueableError(outcome.error)) {
    // If the physical printer is missing/offline, keep the ticket locally and retry later.
    void enqueueHtmlPrintJob({
      html,
      deviceName: opts.deviceName,
      silent: true,
      allowInteractiveFallback: !hasElectronSilentPrintIpc(),
      jobType: "ticket",
      createdAt: new Date().toISOString(),
      lastError: outcome.error,
    }).catch(() => {});
  }

  return outcome;
}

/** Customer account / pro forma bill before payment. */
export type PosBillLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
};

export type PrintPosBillOptions = {
  title: string;
  tableLabel: string;
  tableName: string;
  orderLabel: string;
  orderValue: string;
  staffLabel: string;
  staffName: string;
  printedLabel: string;
  linesSectionTitle: string;
  pendingSectionTitle?: string;
  columnItem: string;
  columnUnitPrice: string;
  columnLineTotal: string;
  subtotalLabel: string;
  taxLabel: string;
  totalLabel: string;
  combinedTotalLabel?: string;
  lines: PosBillLine[];
  pendingLines?: PosBillLine[];
  subtotal: number;
  tax: number;
  total: number;
  combinedSubtotal?: number;
  combinedTax?: number;
  combinedTotal?: number;
  formatPrice: (amount: number) => string;
};

function billRowHtml(
  l: PosBillLine,
  formatPrice: (amount: number) => string,
): string {
  const notes = l.notes
    ? `<div class="notes">${escapeHtml(l.notes)}</div>`
    : "";
  return `<tr>
    <td><span class="qty">${l.quantity}×</span> ${escapeHtml(l.name)}${notes}</td>
    <td class="r mono">${escapeHtml(formatPrice(l.unitPrice))}</td>
    <td class="r mono">${escapeHtml(formatPrice(l.lineTotal))}</td>
  </tr>`;
}

function billTableHtml(
  title: string,
  lines: PosBillLine[],
  colItem: string,
  colUnit: string,
  colLine: string,
  formatPrice: (amount: number) => string,
): string {
  if (lines.length === 0) return "";
  return `<h2 class="sec">${escapeHtml(title)}</h2>
  <table class="bill">
    <thead><tr>
      <th>${escapeHtml(colItem)}</th>
      <th class="r">${escapeHtml(colUnit)}</th>
      <th class="r">${escapeHtml(colLine)}</th>
    </tr></thead>
    <tbody>${lines.map((l) => billRowHtml(l, formatPrice)).join("")}</tbody>
  </table>`;
}

export async function printPosBill(
  opts: PrintPosBillOptions,
): Promise<PrintHtmlAsyncOutcome> {
  const mainTable = billTableHtml(
    opts.linesSectionTitle,
    opts.lines,
    opts.columnItem,
    opts.columnUnitPrice,
    opts.columnLineTotal,
    opts.formatPrice,
  );
  const pendingTable =
    opts.pendingLines && opts.pendingLines.length > 0 && opts.pendingSectionTitle
      ? billTableHtml(
          opts.pendingSectionTitle,
          opts.pendingLines,
          opts.columnItem,
          opts.columnUnitPrice,
          opts.columnLineTotal,
          opts.formatPrice,
        )
      : "";

  const totalsBlock = (args: {
    subtotal: number;
    tax: number;
    total: number;
    label?: string;
  }) => {
    const head = args.label
      ? `<div class="tot-head">${escapeHtml(args.label)}</div>`
      : "";
    return `${head}
    <div class="tot-row"><span>${escapeHtml(opts.subtotalLabel)}</span><span class="mono">${escapeHtml(opts.formatPrice(args.subtotal))}</span></div>
    <div class="tot-row"><span>${escapeHtml(opts.taxLabel)}</span><span class="mono">${escapeHtml(opts.formatPrice(args.tax))}</span></div>
    <div class="tot-row strong"><span>${escapeHtml(opts.totalLabel)}</span><span class="mono">${escapeHtml(opts.formatPrice(args.total))}</span></div>`;
  };

  let totalsHtml = totalsBlock({
    subtotal: opts.subtotal,
    tax: opts.tax,
    total: opts.total,
  });

  if (
    opts.combinedTotalLabel != null &&
    opts.combinedSubtotal != null &&
    opts.combinedTax != null &&
    opts.combinedTotal != null
  ) {
    totalsHtml += `<div class="spacer"></div>${totalsBlock({
      subtotal: opts.combinedSubtotal,
      tax: opts.combinedTax,
      total: opts.combinedTotal,
      label: opts.combinedTotalLabel,
    })}`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(opts.title)}</title>
  <style>
    body { font-family: system-ui, Segoe UI, sans-serif; padding: 16px; color: #111; font-size: 14px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    h2.sec { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; margin: 16px 0 8px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 12px; line-height: 1.5; }
    table.bill { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    table.bill th { text-align: left; font-size: 11px; color: #666; padding: 6px 0; border-bottom: 1px solid #ccc; }
    table.bill th.r { text-align: right; }
    table.bill td { vertical-align: top; padding: 8px 0; border-bottom: 1px solid #eee; }
    table.bill td.r { text-align: right; white-space: nowrap; padding-left: 8px; }
    .mono { font-variant-numeric: tabular-nums; }
    .qty { font-weight: 700; }
    .notes { font-size: 11px; color: #666; margin-top: 4px; }
    .tot-head { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #333; margin: 12px 0 6px; }
    .tot-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .tot-row.strong { font-weight: 700; font-size: 15px; margin-top: 6px; padding-top: 8px; border-top: 1px solid #ddd; }
    .spacer { height: 8px; }
    @media print { body { padding: 8px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(opts.title)}</h1>
  <div class="meta">
    <div><strong>${escapeHtml(opts.tableLabel)}</strong> ${escapeHtml(opts.tableName)}</div>
    <div><strong>${escapeHtml(opts.orderLabel)}</strong> ${escapeHtml(opts.orderValue)}</div>
    <div><strong>${escapeHtml(opts.staffLabel)}</strong> ${escapeHtml(opts.staffName)}</div>
    <div><strong>${escapeHtml(opts.printedLabel)}</strong> ${escapeHtml(new Date().toLocaleString())}</div>
  </div>
  ${mainTable}
  ${pendingTable}
  <div class="totals">${totalsHtml}</div>
</body>
</html>`;

  const outcome = await tryPrintHtmlDocumentAsync(html, {
    silent: true,
    allowInteractiveFallback: !hasElectronSilentPrintIpc(),
    silentTimeoutMs: DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  });

  if (!outcome.ok && isSilentPrintQueueableError(outcome.error)) {
    void enqueueHtmlPrintJob({
      html,
      silent: true,
      allowInteractiveFallback: !hasElectronSilentPrintIpc(),
      jobType: "bill",
      createdAt: new Date().toISOString(),
      lastError: outcome.error,
    }).catch(() => {});
  }

  return outcome;
}

/** Kitchen/bar tickets for staff meals (badge title e.g. STAFF). */
export async function printStaffMealTickets(opts: {
  title: string;
  forLabel: string;
  consumerName: string;
  loggedByLabel: string;
  loggedByName: string;
  orderRefLabel: string;
  orderRefValue: string;
  printedLabel: string;
  stationKitchen: string;
  stationBar: string;
  lines: SentOrderTicketLine[];
  formatPrice: (amount: number) => string;
  kitchenDevice?: string;
  barDevice?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const kitchenLines = opts.lines.filter((l) => l.station !== "bar");
  const barLines = opts.lines.filter((l) => l.station === "bar");

  const printChunk = (
    lines: SentOrderTicketLine[],
    suffix: string,
    deviceName?: string,
  ) =>
    printSentOrderTicket({
      title: lines.length ? `${opts.title}${suffix}` : opts.title,
      tableLabel: opts.forLabel,
      tableName: opts.consumerName,
      orderLabel: opts.orderRefLabel,
      orderValue: opts.orderRefValue,
      staffLabel: opts.loggedByLabel,
      staffName: opts.loggedByName,
      printedLabel: opts.printedLabel,
      stationKitchen: opts.stationKitchen,
      stationBar: opts.stationBar,
      lines,
      formatPrice: opts.formatPrice,
      deviceName,
    });

  let printFailed = false;
  let printErrorCode: string | undefined;

  if (kitchenLines.length > 0) {
    const pr = await printChunk(
      kitchenLines,
      "",
      opts.kitchenDevice,
    );
    if (!pr.ok) {
      printFailed = true;
      printErrorCode = pr.error ?? printErrorCode;
    }
  }
  if (barLines.length > 0) {
    const pr = await printChunk(barLines, " — Bar", opts.barDevice);
    if (!pr.ok) {
      printFailed = true;
      printErrorCode = pr.error ?? printErrorCode;
    }
  }

  return {
    ok: !printFailed,
    error: printErrorCode,
  };
}
