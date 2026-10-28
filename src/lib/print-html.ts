/**
 * Opens the system print dialog for a full HTML document without window.open.
 * Avoids popup blockers and Windows/Electron trying to resolve about:blank as an OS protocol.
 */

import {
  applyPaperWidthMmToPrintHtml,
  resolvePrinterPaperWidthMm,
} from "@/lib/print-paper-width.ts";

export const PRINT_POWERED_BY = "Powered by: www.vyntexpos.net";

function htmlWantsAutoPaperWidth(html: string): boolean {
  if (/--print-paper-mode\s*:\s*auto/i.test(html)) return true;
  if (!/--print-paper-mode\s*:/i.test(html)) return true;
  return false;
}

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

export type PrintHtmlSilentPayload =
  | string
  | { html: string; deviceName?: string };

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

/** Wait until document + images are ready so long layouts print completely. */
function whenPrintDocumentReady(doc: Document, win: Window): Promise<void> {
  const images = Array.from(doc.images ?? []);
  const imageWait = Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
    ),
  );
  const fontsWait =
    "fonts" in doc && doc.fonts?.ready
      ? doc.fonts.ready.then(() => undefined).catch(() => undefined)
      : Promise.resolve();
  return Promise.all([imageWait, fontsWait]).then(() => {
    // Two frames: let layout settle at the real iframe size (not 0×0).
    return new Promise<void>((resolve) => {
      win.requestAnimationFrame(() => {
        win.requestAnimationFrame(() => resolve());
      });
    });
  });
}

/** Grow iframe to paper width + inject exact @page so portrait fills the roll edge-to-edge. */
function fitPrintIframeToContent(iframe: HTMLIFrameElement, doc: Document): void {
  const body = doc.body;
  const html = doc.documentElement;
  if (!body || !html) return;

  const root = doc.defaultView?.getComputedStyle(html);
  const varMm = (root?.getPropertyValue("--print-width-mm") || "").trim();
  const varW = (root?.getPropertyValue("--print-width") || "").trim();
  const mmFromVar = Number(varMm);
  const mmMatch = varW.match(/([\d.]+)\s*mm/i);
  const widthMm = Math.min(
    120,
    Math.max(
      48,
      Number.isFinite(mmFromVar) && mmFromVar > 0
        ? mmFromVar
        : mmMatch
          ? Number(mmMatch[1]) || 80
          : 80,
    ),
  );
  // ~96dpi: mm → CSS px so the iframe matches the thermal paper width.
  const widthPx = Math.ceil((widthMm * 96) / 25.4) + 2;

  let pinEl = doc.getElementById("vyntex-print-paper-pin");
  if (!pinEl) {
    pinEl = doc.createElement("style");
    pinEl.id = "vyntex-print-paper-pin";
    doc.head.appendChild(pinEl);
  }
  pinEl.textContent =
    `html,body{width:${widthMm}mm!important;max-width:${widthMm}mm!important;` +
    `margin:0!important;box-sizing:border-box!important;overflow:visible!important}` +
    `.sheet,.wrap{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important}`;

  const heightPx = Math.max(
    body.scrollHeight || 0,
    html.scrollHeight || 0,
    body.offsetHeight || 0,
    600,
  );
  iframe.style.width = `${widthPx}px`;
  iframe.style.height = `${Math.ceil(heightPx + 48)}px`;

  const heightMm = Math.max(40, (heightPx * 25.4) / 96 + 8);

  let styleEl = doc.getElementById("vyntex-print-page-size");
  if (!styleEl) {
    styleEl = doc.createElement("style");
    styleEl.id = "vyntex-print-page-size";
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent =
    `@page{size:${widthMm}mm ${heightMm.toFixed(2)}mm;margin:0}` +
    `html,body{width:${widthMm}mm!important;max-width:${widthMm}mm!important;` +
    `margin:0!important;height:auto!important;overflow:visible!important}`;
}

/** Interactive print (browser/Electron print dialog). */
export function printHtmlDocument(htmlFullDocument: string): boolean {
  htmlFullDocument = ensurePrintPoweredByFooter(htmlFullDocument);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Off-screen at ~80mm paper width so portrait lays out to the roll, not a wide page.
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:302px;height:3200px;border:0;opacity:0;pointer-events:none;";
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
      fitPrintIframeToContent(iframe, doc);
      win.focus();
      win.print();
    } catch {
      cleanup();
      return;
    }
    // Keep iframe alive briefly so the print pipeline can snapshot full HTML.
    setTimeout(cleanup, 4000);
  };

  void whenPrintDocumentReady(doc, win)
    .then(runPrint)
    .catch(runPrint);
  return true;
}

export type PrintHtmlAsyncOutcome = { ok: boolean; error?: string };

/**
 * Max wait for Electron silent-print IPC before treating as timeout.
 * Must cover main-process start + spool windows (`SILENT_PRINT_START_MAX_MS` +
 * `SILENT_PRINT_SPOOL_MAX_MS` in `electron/main.cjs`) so long thermal layouts can
 * finish spooling instead of being cut off when the renderer gives up early.
 */
export const DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS = 30_000;

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

  // Design Auto: size ticket to the assigned OS printer's media before printing.
  if (htmlWantsAutoPaperWidth(htmlFullDocument)) {
    const inv = getDesktopSystemPrintersInvoker();
    if (inv) {
      try {
        const listed = await inv();
        if (listed.ok && listed.printers.length) {
          const want = (deviceName ?? "").toLowerCase();
          const match =
            (want
              ? listed.printers.find(
                  (p) =>
                    p.deviceName.toLowerCase() === want ||
                    p.displayName.toLowerCase() === want,
                )
              : null) ??
            listed.printers.find((p) => p.isDefault) ??
            listed.printers[0];
          const mm = resolvePrinterPaperWidthMm({
            deviceName: match.deviceName,
            displayName: match.displayName,
            paperWidthMm: match.paperWidthMm,
          });
          htmlFullDocument = applyPaperWidthMmToPrintHtml(htmlFullDocument, mm);
        }
      } catch {
        /* keep design CSS */
      }
    }
  }

  if (wantSilent && silentApi) {
    if (!(await canAttemptSilentPrint())) {
      return { ok: false, error: "no-physical-printer" };
    }
    try {
      const payload: PrintHtmlSilentPayload =
        deviceName && deviceName.length > 0
          ? { html: htmlFullDocument, deviceName }
          : htmlFullDocument;
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

export type DesktopSystemPrinterInfo = {
  deviceName: string;
  displayName: string;
  isDefault: boolean;
  isOffline?: boolean;
  /** Detected thermal paper width in mm (58/80/…) when known */
  paperWidthMm?: number;
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
