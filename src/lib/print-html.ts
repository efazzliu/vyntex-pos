/**
 * Opens the system print dialog for a full HTML document without window.open.
 * Avoids popup blockers and Windows/Electron trying to resolve about:blank as an OS protocol.
 */
import { prepareReceiptPaper, type ReceiptPaper } from "./print-page.ts";
import {
  buildCalibrationPageHtml,
  getPrinterCalibration,
  type PrinterCalibration,
} from "./print-calibration.ts";

export const PRINT_POWERED_BY = "Powered by: www.vyntexpos.net";

export function ensurePrintPoweredByFooter(html: string): string {
  if (/www\.vyntexpos\.net/i.test(html) && /powered by/i.test(html)) {
    return html;
  }
  const footer =
    `<div class="vyntex-powered-by" style="text-align:center;color:#888;font-size:10px;margin-top:12px;letter-spacing:0.02em;">${PRINT_POWERED_BY}</div>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }
  return `${html}${footer}`;
}

export type PrintHtmlSilentResult = { ok: boolean; error?: string };

export type PrintPageSizeMm = { widthMm: number; heightMm: number };

/** `none`: the HTML already places content (calibration / ruler); default: driver printable area. */
export type PrintMarginType = "none" | "printableArea";

export type PrintHtmlSilentPayload =
  | string
  | {
      html: string;
      deviceName?: string;
      pageSize?: PrintPageSizeMm;
      marginType?: PrintMarginType;
    };

async function preparePaperSafely(
  html: string,
  calibration?: PrinterCalibration | null,
): Promise<ReceiptPaper | null> {
  try {
    return await prepareReceiptPaper(html, calibration);
  } catch {
    return null;
  }
}

/** OS queue the main process will pick when no device name is given (default physical printer). */
async function defaultPhysicalPrinterName(): Promise<string | undefined> {
  const inv = getDesktopSystemPrintersInvoker();
  if (!inv) return undefined;
  try {
    const r = await inv();
    if (!r.ok || r.printers.length === 0) return undefined;
    return (r.printers.find((p) => p.isDefault) ?? r.printers[0]).deviceName;
  } catch {
    return undefined;
  }
}

async function calibrationForDevice(deviceName?: string): Promise<PrinterCalibration | null> {
  const name = deviceName?.trim() || (await defaultPhysicalPrinterName());
  return getPrinterCalibration(name);
}

function getDesktopPrintSilent():
  | ((payload: PrintHtmlSilentPayload) => Promise<PrintHtmlSilentResult>)
  | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    desktop?: {
      printHtmlSilent?: (
        payload: PrintHtmlSilentPayload,
      ) => Promise<PrintHtmlSilentResult>;
    };
  };
  return w.desktop?.printHtmlSilent;
}

/** True when the desktop app preload exposes silent print IPC (Electron only). */
export function hasElectronSilentPrintIpc(): boolean {
  return typeof getDesktopPrintSilent() === "function";
}

/** Electron: physical OS printers available (excludes PDF/virtual). */
export async function getPhysicalPrinterCount(): Promise<number | null> {
  const inv = getDesktopSystemPrintersInvoker();
  if (!inv) return null;
  const r = await inv();
  if (!r.ok) return 0;
  return r.printers.length;
}

/** Skip silent IPC when there is no real printer — avoids Windows blocking dialogs. */
export async function canAttemptSilentPrint(): Promise<boolean> {
  if (!hasElectronSilentPrintIpc()) return true;
  const count = await getPhysicalPrinterCount();
  return count === null ? true : count > 0;
}

/** Interactive print (browser/Electron print dialog). */
export function printHtmlDocument(htmlFullDocument: string): boolean {
  htmlFullDocument = ensurePrintPoweredByFooter(htmlFullDocument);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }
  doc.open();
  doc.write(htmlFullDocument);
  doc.close();

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* ignore */
    }
  };

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
      return;
    }
    setTimeout(cleanup, 1000);
  };

  setTimeout(runPrint, 0);
  return true;
}

export type PrintHtmlAsyncOutcome = { ok: boolean; error?: string };

/**
 * Max wait for Electron silent-print IPC before treating as timeout.
 * Must be ≥ main-process print cap (`SILENT_PRINT_JOB_MAX_MS` in `electron/main.cjs`) so the
 * renderer does not abandon the invoke while a hidden print window is still open (Windows
 * can show a blocking "Waiting for printer connection…" dialog until that job ends).
 */
export const DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS = 2200;

/** Errors after which we keep HTML in the local print queue for retry (Electron / offline printer). */
export function isSilentPrintQueueableError(error: string | undefined): boolean {
  return (
    error === "no-physical-printer" ||
    error === "printer-offline" ||
    error === "silent-timeout" ||
    error === "timeout"
  );
}

/**
 * Like {@link printHtmlDocumentAsync} but returns OS / IPC error codes (e.g. `no-physical-printer`).
 */
export async function tryPrintHtmlDocumentAsync(
  htmlFullDocument: string,
  options?: {
    silent?: boolean;
    allowInteractiveFallback?: boolean;
    /** Windows: exact OS printer name (match Settings — use Address if set). */
    deviceName?: string;
    /** Upper bound for Electron silent IPC. Helps avoid UI blocking when printer is offline. */
    silentTimeoutMs?: number;
  },
): Promise<PrintHtmlAsyncOutcome> {
  htmlFullDocument = ensurePrintPoweredByFooter(htmlFullDocument);
  const allowDialog = options?.allowInteractiveFallback !== false;
  const wantSilent = options?.silent === true;
  const silentApi = wantSilent ? getDesktopPrintSilent() : undefined;
  const deviceName = options?.deviceName?.trim();
  const silentTimeoutMs =
    typeof options?.silentTimeoutMs === "number"
      ? options.silentTimeoutMs
      : DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS;
  const sourceHtml = htmlFullDocument;
  const dialogPaper = await preparePaperSafely(sourceHtml);
  htmlFullDocument = dialogPaper?.html ?? sourceHtml;

  if (wantSilent && silentApi) {
    if (!(await canAttemptSilentPrint())) {
      return { ok: false, error: "no-physical-printer" };
    }
    try {
      const calibration = dialogPaper ? await calibrationForDevice(deviceName) : null;
      const paper = calibration ? await preparePaperSafely(sourceHtml, calibration) : dialogPaper;
      const payload: PrintHtmlSilentPayload = {
        html: paper?.html ?? htmlFullDocument,
        ...(deviceName && deviceName.length > 0 ? { deviceName } : {}),
        ...(paper ? { pageSize: { widthMm: paper.widthMm, heightMm: paper.heightMm } } : {}),
        ...(paper?.calibrated ? { marginType: "none" as const } : {}),
      };
      const r = await Promise.race([
        silentApi(payload),
        new Promise<PrintHtmlSilentResult>((resolve) =>
          window.setTimeout(
            () => resolve({ ok: false, error: "silent-timeout" }),
            Math.max(0, silentTimeoutMs),
          )
        ),
      ]);
      if (r.ok) return { ok: true };
      if (!allowDialog) {
        return { ok: false, error: r.error ?? "silent-failed" };
      }
      const dialogOk = printHtmlDocument(htmlFullDocument);
      return {
        ok: dialogOk,
        error: dialogOk ? undefined : "dialog-failed",
      };
    } catch (e) {
      if (!allowDialog) {
        return { ok: false, error: String(e) };
      }
      const dialogOk = printHtmlDocument(htmlFullDocument);
      return { ok: dialogOk };
    }
  }

  if (wantSilent && !silentApi && !allowDialog) {
    return { ok: false, error: "no-silent-ipc" };
  }

  const dialogOk = printHtmlDocument(htmlFullDocument);
  return { ok: dialogOk, error: dialogOk ? undefined : "dialog-failed" };
}

/**
 * When running in Electron, uses main-process silent print (default OS printer).
 * If silent fails and `allowInteractiveFallback` is true (default), opens the print dialog.
 */
export async function printHtmlDocumentAsync(
  htmlFullDocument: string,
  options?: {
    silent?: boolean;
    allowInteractiveFallback?: boolean;
    deviceName?: string;
  },
): Promise<boolean> {
  const r = await tryPrintHtmlDocumentAsync(htmlFullDocument, options);
  return r.ok;
}

export type ReceiptPdfMode = "preview" | "save";

export type ReceiptPdfOutcome = {
  ok: boolean;
  /** Saved/preview file path (desktop app). */
  path?: string;
  /** Browser fallback: the print dialog opened so the user can pick "Save as PDF". */
  viaDialog?: boolean;
  cancelled?: boolean;
  widthMm?: number;
  heightMm?: number;
  error?: string;
};

type DesktopPdfPayload = {
  html: string;
  widthMm: number;
  heightMm: number;
  mode: ReceiptPdfMode;
  fileName: string;
  marginType?: PrintMarginType;
};

function getDesktopPrintToPdf():
  | ((payload: DesktopPdfPayload) => Promise<{ ok: boolean; path?: string; cancelled?: boolean; error?: string }>)
  | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    desktop?: {
      printHtmlToPdf?: (
        payload: DesktopPdfPayload,
      ) => Promise<{ ok: boolean; path?: string; cancelled?: boolean; error?: string }>;
    };
  };
  return w.desktop?.printHtmlToPdf;
}

function safePdfFileName(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 80);
  return base || "receipt";
}

/**
 * Renders the exact receipt HTML used for printing to a PDF sized to the paper
 * (width from the Design, height from the content). Desktop: real PDF file; browser:
 * print dialog with the same page size so the user can choose "Save as PDF".
 */
export async function exportReceiptPdf(
  htmlFullDocument: string,
  options: {
    mode: ReceiptPdfMode;
    fileName: string;
    /** Assigned OS printer: its calibration (paper width, printable band) shapes the PDF. */
    deviceName?: string;
  },
): Promise<ReceiptPdfOutcome> {
  const html = ensurePrintPoweredByFooter(htmlFullDocument);
  const toPdf = getDesktopPrintToPdf();
  const calibration = toPdf ? await calibrationForDevice(options.deviceName) : null;
  const paper = await preparePaperSafely(html, calibration);
  if (!paper) return { ok: false, error: "not-a-receipt" };
  if (!toPdf) {
    const opened = printHtmlDocument(paper.html);
    return {
      ok: opened,
      viaDialog: true,
      widthMm: paper.widthMm,
      heightMm: paper.heightMm,
      error: opened ? undefined : "dialog-failed",
    };
  }
  try {
    const r = await toPdf({
      html: paper.html,
      widthMm: paper.widthMm,
      heightMm: paper.heightMm,
      mode: options.mode,
      fileName: safePdfFileName(options.fileName),
      ...(paper.calibrated ? { marginType: "none" as const } : {}),
    });
    return { ...r, widthMm: paper.widthMm, heightMm: paper.heightMm };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

const CALIBRATION_PAGE_HEIGHT_MM = 46;

/** Prints the edge-to-edge ruler on one printer (no margins, no calibration applied). */
export async function printCalibrationPage(args: {
  deviceName?: string;
  paperWidthMm: number;
  title: string;
  hint: string;
}): Promise<PrintHtmlAsyncOutcome> {
  const html = buildCalibrationPageHtml(args.paperWidthMm, args.title, args.hint);
  const silentApi = getDesktopPrintSilent();
  if (!silentApi) {
    const opened = printHtmlDocument(html);
    return { ok: opened, error: opened ? undefined : "dialog-failed" };
  }
  if (!(await canAttemptSilentPrint())) return { ok: false, error: "no-physical-printer" };
  try {
    const r = await Promise.race([
      silentApi({
        html,
        ...(args.deviceName?.trim() ? { deviceName: args.deviceName.trim() } : {}),
        pageSize: { widthMm: args.paperWidthMm, heightMm: CALIBRATION_PAGE_HEIGHT_MM },
        marginType: "none",
      }),
      new Promise<PrintHtmlSilentResult>((resolve) =>
        window.setTimeout(() => resolve({ ok: false, error: "silent-timeout" }), DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS),
      ),
    ]);
    return r.ok ? { ok: true } : { ok: false, error: r.error ?? "silent-failed" };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

/** Opens the ruler page as a PDF (desktop) so the layout can be checked without a printer. */
export async function previewCalibrationPdf(args: {
  paperWidthMm: number;
  title: string;
  hint: string;
}): Promise<ReceiptPdfOutcome> {
  const html = buildCalibrationPageHtml(args.paperWidthMm, args.title, args.hint);
  const toPdf = getDesktopPrintToPdf();
  if (!toPdf) {
    const opened = printHtmlDocument(html);
    return { ok: opened, viaDialog: true, error: opened ? undefined : "dialog-failed" };
  }
  try {
    const r = await toPdf({
      html,
      widthMm: args.paperWidthMm,
      heightMm: CALIBRATION_PAGE_HEIGHT_MM,
      mode: "preview",
      fileName: `calibration-${Math.round(args.paperWidthMm)}mm`,
      marginType: "none",
    });
    return { ...r, widthMm: args.paperWidthMm, heightMm: CALIBRATION_PAGE_HEIGHT_MM };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

export type DesktopSystemPrinterInfo = {
  deviceName: string;
  displayName: string;
  isDefault: boolean;
  isOffline?: boolean;
};

export type GetSystemPrintersResult =
  | { ok: true; printers: DesktopSystemPrinterInfo[] }
  | { ok: false; error: string };

/** Electron only: lists physical OS print queues (excludes PDF/virtual). */
export function getDesktopSystemPrintersInvoker():
  | (() => Promise<GetSystemPrintersResult>)
  | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    desktop?: { getSystemPrinters?: () => Promise<GetSystemPrintersResult> };
  };
  const fn = w.desktop?.getSystemPrinters;
  return typeof fn === "function" ? fn.bind(w.desktop) : undefined;
}
