/**
 * Opens the system print dialog for a full HTML document without window.open.
 * Avoids popup blockers and Windows/Electron trying to resolve about:blank as an OS protocol.
 */

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

/** Interactive print (browser/Electron print dialog). */
export function printHtmlDocument(htmlFullDocument: string): boolean {
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
  const allowDialog = options?.allowInteractiveFallback !== false;
  const wantSilent = options?.silent === true;
  const silentApi = wantSilent ? getDesktopPrintSilent() : undefined;
  const deviceName = options?.deviceName?.trim();
  const silentTimeoutMs =
    typeof options?.silentTimeoutMs === "number"
      ? options.silentTimeoutMs
      : DEFAULT_SILENT_PRINT_IPC_TIMEOUT_MS;

  if (wantSilent && silentApi) {
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
