/**
 * Opens the system print dialog for a full HTML document without window.open.
 * Avoids popup blockers and Windows/Electron trying to resolve about:blank as an OS protocol.
 */

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

/** Interactive print (browser/Electron print dialog). */
export function printHtmlDocument(htmlFullDocument: string): boolean {
  htmlFullDocument = ensurePrintPoweredByFooter(htmlFullDocument);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Off-screen but real size: zero-size iframes clip multi-page thermal content.
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:480px;height:2400px;border:0;opacity:0;pointer-events:none;";
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
    // Keep iframe alive briefly so the print pipeline can snapshot full HTML.
    setTimeout(cleanup, 2500);
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
