/**
 * Prints a just-sent POS order (kitchen/bar ticket). In Electron, prints silently
 * to the default printer; in the browser, uses the system print dialog (hidden iframe).
 */
export type SentOrderTicketLine = {
  name: string;
  quantity: number;
  notes?: string;
  modifiers?: string;
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
  licenseKey?: string;
  tablePrefix?: string;
};

import {
  DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  hasElectronSilentPrintIpc,
  isSilentPrintQueueableError,
  tryPrintHtmlDocumentAsync,
  type PrintHtmlAsyncOutcome,
} from "@/lib/print-html.ts";
import { enqueueHtmlPrintJob, flushPrintQueueNow } from "@/lib/print-queue.ts";
import {
  buildPreBillHtml,
  formatPreBillMoney,
  preBillPrintExtras,
  resolvePreBillCopy,
  visibilityFromTemplate,
  type PreBillBusiness,
} from "@/lib/print-pre-bill.ts";
import { resolvePinLoginBranding } from "@/lib/supabase-pos/license-sync.ts";
import { loadPaperPrintDeviceName } from "@/lib/pos-print-device.ts";
import { runPosQuery } from "@/lib/supabase-pos/pos-router.ts";
import {
  buildKitchenTicketHtml,
  resolveKitchenTicketCopy,
  visibilityFromKitchenTemplate,
} from "@/lib/print-kitchen-ticket.ts";
import {
  buildBarTicketHtml,
  resolveBarTicketCopy,
  visibilityFromBarTemplate,
} from "@/lib/print-bar-ticket.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kitchenTicketHour12(extra?: Record<string, unknown> | null) {
  const content =
    extra?.content && typeof extra.content === "object"
      ? (extra.content as Record<string, unknown>)
      : undefined;
  return content?.timeFormat === "12h";
}

export async function printSentOrderTicket(
  opts: PrintSentOrderTicketOptions,
): Promise<PrintHtmlAsyncOutcome> {
  const lines = opts.lines;
  const isBar = lines.length > 0 && lines.every((line) => line.station === "bar");
  const isKitchen =
    lines.length > 0 && lines.every((line) => line.station !== "bar");
  const allSameStation =
    lines.length > 0 &&
    (lines.every((l) => l.station === "bar") ||
      lines.every((l) => l.station !== "bar"));

  let html = "";
  if (isKitchen || isBar) {
    const titleRe = isBar
      ? /^bar(\s+(order|ticket))?$/i
      : /^kitchen(\s+(order|ticket))?$/i;
    const resolveCopy = isBar ? resolveBarTicketCopy : resolveKitchenTicketCopy;
    const visibilityFromTemplate = isBar
      ? visibilityFromBarTemplate
      : visibilityFromKitchenTemplate;
    const buildHtml = isBar ? buildBarTicketHtml : buildKitchenTicketHtml;
    const templateType = isBar ? "bar_ticket" : "kitchen_ticket";
    let visibility = visibilityFromTemplate();
    let title = titleRe.test(opts.title.trim())
      ? resolveCopy().title
      : opts.title;
    let logoDataUrl: string | null = null;
    let hour12 = false;
    let extra: Record<string, unknown> | undefined;
    if (opts.licenseKey) {
      try {
        const templatesList = (await runPosQuery("pos.templates.listTemplates", {
          licenseKey: opts.licenseKey,
        })) as Array<{
          templateType: string;
          printerId?: string | null;
          toggles?: {
            logo?: boolean;
            waiterName?: boolean;
            tableNumber?: boolean;
            timestamp?: boolean;
            orderNumber?: boolean;
          };
          labels?: { headerText?: string; footerText?: string };
          styles?: Record<string, unknown>;
        }>;
        const row = templatesList?.find((x) => x.templateType === templateType);
        extra =
          row?.styles && typeof row.styles._design === "object"
            ? (row.styles._design as Record<string, unknown>)
            : undefined;
        visibility = visibilityFromTemplate(row?.toggles, extra);
        hour12 = kitchenTicketHour12(extra);
        const copy = resolveCopy(row?.labels);
        if (titleRe.test(opts.title.trim())) {
          title = copy.title;
        }
        if (typeof extra?.logoDataUrl === "string" && extra.logoDataUrl) {
          logoDataUrl = extra.logoDataUrl;
        }
      } catch {
        /* use defaults */
      }
    }
    html = buildHtml({
      lines: lines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        notes: line.notes,
        modifiers: line.modifiers,
      })),
      orderRef: opts.orderValue,
      tableName: opts.tableName,
      waiterName: opts.staffName,
      printedAt: new Date(),
      title,
      tablePrefix: opts.tablePrefix ?? "TABLE",
      pageTitle: opts.title,
      logoDataUrl,
      hour12,
      visibility,
      design: extra,
    });
  } else {
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
    html = `<!DOCTYPE html>
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
  }

  const paperType = isBar ? "bar_ticket" : isKitchen ? "kitchen_ticket" : "";
  const resolvedDevice = opts.licenseKey && paperType
    ? await loadPaperPrintDeviceName({
        licenseKey: opts.licenseKey,
        templateType: paperType,
        fallback: opts.deviceName,
      })
    : opts.deviceName;

  const outcome = await tryPrintHtmlDocumentAsync(html, {
    silent: true,
    // Browser / plain Vite: no IPC — must use the print dialog. Electron: silent only.
    allowInteractiveFallback: !hasElectronSilentPrintIpc(),
    deviceName: resolvedDevice,
    silentTimeoutMs: DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  });

  if (outcome.ok) {
    void flushPrintQueueNow().catch(() => {});
  } else if (isSilentPrintQueueableError(outcome.error)) {
    // Keep locally; no background OS retry (see initPrintQueueOnStartup).
    void enqueueHtmlPrintJob({
      html,
      deviceName: resolvedDevice,
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
  licenseKey?: string;
  business?: PreBillBusiness;
  logoDataUrl?: string | null;
  guests?: number;
};

export async function printPosBill(
  opts: PrintPosBillOptions,
): Promise<PrintHtmlAsyncOutcome> {
  const pending = opts.pendingLines ?? [];
  const lines = [
    ...opts.lines,
    ...pending.map((line) => ({
      ...line,
      notes: line.notes || opts.pendingSectionTitle || undefined,
    })),
  ];
  const subtotal = opts.combinedSubtotal ?? opts.subtotal;
  const total = opts.combinedTotal ?? opts.total;
  const discount = Math.max(0, Math.round((subtotal - total) * 100) / 100);

  let logoDataUrl = opts.logoDataUrl ?? null;
  if (!logoDataUrl && opts.licenseKey) {
    try {
      const branding = await resolvePinLoginBranding(opts.licenseKey);
      logoDataUrl = branding.logoDataUrl ?? null;
    } catch {
      /* optional */
    }
  }

  let visibility = visibilityFromTemplate();
  let copy = resolvePreBillCopy();
  let website = opts.business?.website;
  let address = opts.business?.address;
  let extras = preBillPrintExtras();
  let extra: Record<string, unknown> | undefined;
  if (opts.licenseKey) {
    try {
      const templatesList = (await runPosQuery("pos.templates.listTemplates", {
        licenseKey: opts.licenseKey,
      })) as Array<{
        templateType: string;
        toggles?: {
          logo?: boolean;
          footerText?: boolean;
          waiterName?: boolean;
          tableNumber?: boolean;
          timestamp?: boolean;
          taxDetails?: boolean;
          orderNumber?: boolean;
          unitPrices?: boolean;
        };
        labels?: { headerText?: string; footerText?: string };
        styles?: Record<string, unknown>;
      }>;
      const row = templatesList?.find((x) => x.templateType === "non_fiscal_receipt");
      extra =
        row?.styles && typeof row.styles._design === "object"
          ? (row.styles._design as Record<string, unknown>)
          : undefined;
      visibility = visibilityFromTemplate(row?.toggles, extra);
      extras = preBillPrintExtras(extra);
      copy = resolvePreBillCopy({
        ...row?.labels,
        subtitle: extras.content.subtitle,
        legalText: extras.content.legalText,
        tagline: extras.content.motto,
      });
      if (typeof extra?.website === "string" && extra.website.trim()) {
        website = extra.website.trim();
      }
      if (typeof extra?.address === "string" && extra.address.trim()) {
        address = extra.address.trim();
      }
      if (typeof extra?.logoDataUrl === "string" && extra.logoDataUrl) {
        logoDataUrl = extra.logoDataUrl;
      }
    } catch {
      /* use defaults */
    }
  }

  const html = buildPreBillHtml({
    ...copy,
    venueLine: extras.venueLine,
    itemsHeading: extras.itemsHeading,
    showQtyPrefix: extras.showQtyPrefix,
    dateFormat: extras.dateFormat,
    hour12: extras.hour12,
    lines,
    subtotal,
    discount,
    tax: opts.combinedTax ?? opts.tax,
    total,
    orderRef: opts.orderValue,
    tableName: opts.tableName,
    waiterName: opts.staffName,
    operatorName: opts.staffName,
    guests: opts.guests,
    printedAt: new Date(),
    formatPrice: (n) => formatPreBillMoney(n, extras.content, opts.formatPrice),
    logoDataUrl: visibility.logo ? logoDataUrl : null,
    business: opts.business
      ? {
          ...opts.business,
          name: extras.content.storeName || opts.business.name,
          website,
          address,
        }
      : { name: extras.content.storeName || "VYNTEX", website, address },
    visibility,
    design: extra,
    fieldLabels: {
      ...extras.fieldLabels,
      table: extras.fieldLabels.table || opts.tableLabel,
      order: opts.orderLabel,
      waiter: extras.fieldLabels.waiter || opts.staffLabel,
      subtotal: extras.fieldLabels.subtotal || opts.subtotalLabel,
      tax: opts.taxLabel,
      total: extras.fieldLabels.total || opts.totalLabel,
    },
    pageTitle: opts.title,
  });

  const outcome = await tryPrintHtmlDocumentAsync(html, {
    silent: true,
    allowInteractiveFallback: !hasElectronSilentPrintIpc(),
    silentTimeoutMs: DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS,
  });

  if (outcome.ok) {
    void flushPrintQueueNow().catch(() => {});
  } else if (isSilentPrintQueueableError(outcome.error)) {
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
  licenseKey?: string;
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
      licenseKey: opts.licenseKey,
      tablePrefix: opts.forLabel,
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
