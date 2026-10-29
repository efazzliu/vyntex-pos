const { app, BrowserWindow, dialog, shell, ipcMain, screen } = require("electron");
const { registerAppUpdateIpc } = require("./app-update.cjs");
const {
  resolvePrinterPaperWidthMm,
  applyPaperWidthMmToPrintHtml,
  htmlWantsAutoPaperWidth,
} = require("./print-paper-width.cjs");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function isBrokenPipeError(err) {
  if (!err || typeof err !== "object") return false;
  const code = String(err.code ?? "");
  const msg = String(err.message ?? "");
  return (
    code === "EPIPE" ||
    code === "ERR_STREAM_DESTROYED" ||
    msg.includes("EPIPE") ||
    msg.includes("broken pipe")
  );
}

function ignoreBrokenStdoutPipes() {
  for (const stream of [process.stdout, process.stderr]) {
    if (!stream || typeof stream.on !== "function") continue;
    stream.on("error", (err) => {
      if (isBrokenPipeError(err)) return;
    });
  }
}

ignoreBrokenStdoutPipes();

process.on("uncaughtException", (err) => {
  if (isBrokenPipeError(err)) return;
  if (typeof console.error === "function") {
    try {
      console.error("[electron] uncaughtException", err);
    } catch {
      /* stdout may already be gone */
    }
  }
});

const isDev = !app.isPackaged;

/** Must match package.json build.appId so Windows taskbar / shortcuts use this app, not generic Electron. */
const WINDOWS_APP_ID = "com.vyntex.restaurantpos";
if (process.platform === "win32") {
  app.setAppUserModelId(WINDOWS_APP_ID);
}

function resolveWindowIconPath() {
  if (app.isPackaged) {
    const unpacked = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "electron",
      "icon.ico",
    );
    if (fs.existsSync(unpacked)) return unpacked;
  }
  return path.join(__dirname, "icon.ico");
}

const MAX_SILENT_PRINT_HTML = 4 * 1024 * 1024;

/**
 * Max time to start a silent print job (load HTML + call webContents.print).
 * Once print() is in flight we extend this so long thermal receipts can spool
 * fully before the hidden window is destroyed (destroy mid-job truncates output).
 */
const SILENT_PRINT_START_MAX_MS = 4000;
/** Extra time after print() is invoked for the OS/driver to accept the full job. */
const SILENT_PRINT_SPOOL_MAX_MS = 25000;
/** Keep the hidden window briefly after success so drivers finish reading HTML. */
const SILENT_PRINT_DESTROY_DELAY_MS = 1500;

/** CSS px → microns (1in = 96 CSS px = 25_400 microns). */
const CSS_PX_TO_MICRON = 25400 / 96;

/**
 * Measure laid-out receipt size and map to Chromium pageSize (microns).
 * Portrait uses the Design paper width (58/80mm) flush to the left edge — never Letter.
 */
async function measurePrintPageSize(webContents) {
  try {
    const metrics = await webContents.executeJavaScript(`
      (() => {
        const body = document.body;
        const html = document.documentElement;
        if (!body || !html) return null;
        const root = getComputedStyle(html);
        const bodyCs = getComputedStyle(body);
        const varW = (root.getPropertyValue("--print-width") || "").trim();
        const varMm = (root.getPropertyValue("--print-width-mm") || "").trim();
        const maxW = (bodyCs.maxWidth || bodyCs.width || "").trim();
        const orient = (root.getPropertyValue("--print-orientation") || "portrait").trim();
        const parseMm = (s) => {
          const m = String(s).match(/([\\d.]+)\\s*mm/i);
          return m ? Number(m[1]) : NaN;
        };
        let widthMm = Number(varMm);
        if (!Number.isFinite(widthMm)) widthMm = parseMm(varW);
        if (!Number.isFinite(widthMm)) widthMm = parseMm(maxW);
        if (!Number.isFinite(widthMm) || widthMm < 40) widthMm = 80;
        widthMm = Math.min(120, Math.max(48, widthMm));
        // Pin content to paper width (left edge) before measuring height.
        const id = "vyntex-print-paper-pin";
        let pin = document.getElementById(id);
        if (!pin) {
          pin = document.createElement("style");
          pin.id = id;
          document.head.appendChild(pin);
        }
        pin.textContent =
          "html,body{width:" + widthMm + "mm!important;max-width:" + widthMm +
          "mm!important;margin:0!important;padding-left:0!important;padding-right:0!important;" +
          "box-sizing:border-box!important;overflow:visible!important}" +
          ".sheet,.wrap{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important}";
        const heightPx = Math.max(
          body.scrollHeight || 0,
          html.scrollHeight || 0,
          body.offsetHeight || 0,
          html.clientHeight || 0,
        );
        return {
          heightPx: Math.max(1, heightPx),
          widthMm,
          orientation: orient === "landscape" ? "landscape" : "portrait",
        };
      })()
    `);
    if (!metrics || typeof metrics !== "object") return null;
    const widthMm = Number(metrics.widthMm) || 80;
    const heightPx = Number(metrics.heightPx) || 0;
    if (!(heightPx > 0)) return null;
    // Pad so powered-by / last lines are never clipped by driver rounding.
    const heightMm = Math.max(40, (heightPx * CSS_PX_TO_MICRON) / 1000 + 8);
    const widthMicrons = Math.round(widthMm * 1000);
    const heightMicrons = Math.round(heightMm * 1000);
    // Exact @page = paper width × content height; flush to left (thermal origin).
    await webContents.executeJavaScript(`
      (() => {
        const id = "vyntex-print-page-size";
        let el = document.getElementById(id);
        if (!el) {
          el = document.createElement("style");
          el.id = id;
          document.head.appendChild(el);
        }
        el.textContent =
          "@page{size:${widthMm}mm ${heightMm.toFixed(2)}mm;margin:0}" +
          "html,body{width:${widthMm}mm!important;max-width:${widthMm}mm!important;" +
          "margin:0!important;height:auto!important;overflow:visible!important}";
        return true;
      })()
    `);
    return { width: widthMicrons, height: heightMicrons };
  } catch (err) {
    if (isDev) console.warn("[print-html-silent] measurePrintPageSize:", err);
    return null;
  }
}

/** Drivers that open "Save as…" / file dialogs — never use these for POS silent print. */
const VIRTUAL_PRINTER_RE =
  /print to pdf|save as pdf|save print|microsoft print to pdf|print to file|onenote|pdf writer|adobe pdf|pdfcreator|cutepdf|foxit|bullzip|nova pdf|fax|xps document|microsoft xps|document writer|freepdf|pdf24|export to pdf|wondershare|virtual pdf|redirected|paperless|\bpdf\s*printer\b/i;

function isVirtualPrinter(p) {
  const blob = [p.name, p.displayName, p.description].filter(Boolean).join("\n");
  return VIRTUAL_PRINTER_RE.test(blob);
}

/**
 * Only physical printers. If the OS default is PDF-only, pick another real device
 * (e.g. Canon). If there is no non-virtual printer, return undefined — we must not
 * call print without a device name or Windows opens "Save Print Output As".
 */
function pickPrinterDeviceName(printers) {
  if (!printers?.length) return undefined;
  const physical = printers.filter((p) => !isVirtualPrinter(p));
  if (physical.length === 0) return undefined;

  const def = printers.find((p) => p.isDefault === true);
  if (def?.name && !isVirtualPrinter(def)) return def.name;

  for (const p of printers) {
    const o = p.options;
    if (
      o &&
      (o.isDefault === true || String(o["printer-is-default"]) === "true") &&
      !isVirtualPrinter(p)
    ) {
      return p.name;
    }
  }
  return physical[0].name;
}

/**
 * Prefer the sender (main POS window): a fresh hidden window often returns an
 * empty printer list on Windows, so silent print had no deviceName and failed.
 */
function webContentsCandidates(event) {
  const tryContents = [];
  if (event?.sender && typeof event.sender.getPrintersAsync === "function") {
    tryContents.push(event.sender);
  }
  for (const win of BrowserWindow.getAllWindows()) {
    const wc = win.webContents;
    if (typeof wc.getPrintersAsync === "function" && !tryContents.includes(wc)) {
      tryContents.push(wc);
    }
  }
  return tryContents;
}

/** First non-empty printer list from POS window(s). */
async function getPrintersForSilentPrint(event) {
  for (const wc of webContentsCandidates(event)) {
    try {
      const printers = await wc.getPrintersAsync();
      if (printers?.length) return printers;
    } catch (err) {
      if (isDev) console.warn("[print-html-silent] getPrintersAsync:", err);
    }
  }
  return [];
}

/** Skip silent print when the OS reports the queue offline (avoids Windows "Waiting for printer connection…"). */
function isPrinterOffline(p) {
  if (!p) return false;
  // Chromium: 2 = stopped / error
  if (p.status === 2) return true;
  const blob = [
    p.description,
    p.options?.["printer-state"],
    p.options?.["printer-state-reasons"],
    p.options?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /offline|unavailable|error|stopped|paused|not\s+ready|no\s+paper/i.test(blob);
}

function findPhysicalPrinter(printers, deviceName) {
  const physical = printers.filter((p) => !isVirtualPrinter(p));
  for (const p of physical) {
    if (p.name === deviceName) return p;
  }
  return undefined;
}

function matchPhysicalPrinterName(printers, requested) {
  const q = String(requested ?? "").trim();
  if (!q) return undefined;
  const lower = q.toLowerCase();
  const physical = printers.filter((p) => !isVirtualPrinter(p));
  for (const p of physical) {
    if (p.name === q) return p.name;
    if (p.displayName === q) return p.name;
  }
  for (const p of physical) {
    if (String(p.name ?? "").toLowerCase() === lower) return p.name;
    if (String(p.displayName ?? "").toLowerCase() === lower) return p.name;
  }
  return undefined;
}

/**
 * If `requestedDeviceName` is set, use that OS printer when it exists and is physical.
 * Otherwise fall back to the default physical printer.
 */
async function resolvePrintDeviceName(event, requestedDeviceName) {
  const printers = await getPrintersForSilentPrint(event);
  const req =
    typeof requestedDeviceName === "string" ? requestedDeviceName.trim() : "";
  if (req) {
    const matched = matchPhysicalPrinterName(printers, req);
    if (matched) return matched;
  }
  return pickPrinterDeviceName(printers);
}

const CSS_PX_PER_MM = 96 / 25.4;

/** Receipt page size from the renderer (`print-page.ts`), clamped to sane thermal-roll bounds. */
function readPageSizeMm(payload) {
  const size = payload && typeof payload === "object" ? payload.pageSize ?? payload : null;
  const w = Number(size?.widthMm);
  const h = Number(size?.heightMm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return {
    widthMm: Math.min(300, Math.max(40, w)),
    heightMm: Math.min(3000, Math.max(40, h)),
  };
}

function paperWindowWidthPx(pageSize) {
  return pageSize ? Math.max(160, Math.ceil(pageSize.widthMm * CSS_PX_PER_MM)) : 420;
}

/** Same rule as `printableWidthMm` in `src/lib/print-page.ts`: 58 mm → 48 mm, 80 mm → 72 mm. */
function printableWidthMm(paperWidthMm) {
  const unprintable = paperWidthMm <= 60 ? 10 : 8;
  return Math.max(40, paperWidthMm - unprintable);
}

function registerPrintHtmlSilentIpc() {
  ipcMain.removeHandler("print-html-silent");
  ipcMain.handle("print-html-silent", async (event, payload) => {
    const html =
      typeof payload === "string"
        ? payload
        : payload && typeof payload.html === "string"
          ? payload.html
          : "";
    const deviceNameOpt =
      typeof payload === "object" &&
      payload !== null &&
      typeof payload.deviceName === "string"
        ? payload.deviceName
        : undefined;
    const pageSize = readPageSizeMm(payload);
    // `none`: the HTML already carries calibrated side padding (or is the ruler page).
    const marginType = payload && payload.marginType === "none" ? "none" : "printableArea";

    if (typeof html !== "string" || html.length === 0) {
      return { ok: false, error: "invalid-html" };
    }
    if (html.length > MAX_SILENT_PRINT_HTML) {
      return { ok: false, error: "html-too-large" };
    }

    const deviceNameFromMain = await resolvePrintDeviceName(
      event,
      deviceNameOpt,
    );
    if (!deviceNameFromMain) {
      if (isDev) {
        console.warn(
          "[print-html-silent] No physical printer found (only PDF/virtual or empty list).",
        );
      }
      return { ok: false, error: "no-physical-printer" };
    }

    const printersForJob = await getPrintersForSilentPrint(event);
    const targetPrinter = findPhysicalPrinter(printersForJob, deviceNameFromMain);
    if (targetPrinter && isPrinterOffline(targetPrinter)) {
      return { ok: false, error: "printer-offline" };
    }

    // Auto paper width: size the ticket to whatever media the OS printer reports.
    // Renderer-prepared receipts (with `pageSize`) already resolved width/calibration.
    let htmlForPrint = html;
    if (!pageSize && (htmlWantsAutoPaperWidth(html) || /--print-paper-mode\s*:\s*auto/i.test(html))) {
      const paperMm = resolvePrinterPaperWidthMm(
        targetPrinter || { name: deviceNameFromMain, deviceName: deviceNameFromMain },
      );
      htmlForPrint = applyPaperWidthMmToPrintHtml(html, paperMm);
      if (isDev) {
        console.log(
          `[print-html-silent] Auto paper width → ${paperMm}mm for ${deviceNameFromMain}`,
        );
      }
    }

    return await new Promise((resolve) => {
      // Narrow off-screen window (~80mm @ 96dpi) so portrait layouts to paper width,
      // not a wide Letter-like canvas that recenters the ticket.
      const printWin = new BrowserWindow({
        show: false,
        width: pageSize ? paperWindowWidthPx(pageSize) : 340,
        height: 2400,
        useContentSize: true,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      let settled = false;
      let timeoutId = null;
      let destroyDelayId = null;
      let printStarted = false;

      const canUsePrintWindow = () =>
        !settled &&
        printWin &&
        !printWin.isDestroyed() &&
        printWin.webContents &&
        !printWin.webContents.isDestroyed();

      const destroyPrintWindow = () => {
        try {
          if (printWin && !printWin.isDestroyed()) printWin.destroy();
        } catch {
          /* ignore */
        }
      };

      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (destroyDelayId) clearTimeout(destroyDelayId);
        // Delay destroy on success so Windows thermal drivers can finish reading.
        if (ok) {
          destroyDelayId = setTimeout(destroyPrintWindow, SILENT_PRINT_DESTROY_DELAY_MS);
        } else {
          destroyPrintWindow();
        }
        resolve({ ok, error });
      };

      const armTimeout = (ms) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          finish(false, "timeout");
        }, ms);
      };

      armTimeout(SILENT_PRINT_START_MAX_MS);

      const done = (ok, error) => {
        finish(ok, error);
      };

      printWin.webContents.on("did-fail-load", (_e, _code, errorDesc) => {
        done(false, errorDesc || "load-failed");
      });

      const runPrint = (opts, cb) => {
        if (!canUsePrintWindow()) {
          cb(false, "destroyed");
          return;
        }
        try {
          if (!printStarted) {
            printStarted = true;
            armTimeout(SILENT_PRINT_SPOOL_MAX_MS);
          }
          printWin.webContents.print(opts, (success, failureReason) => {
            if (settled) return;
            cb(success, failureReason);
          });
        } catch (err) {
          cb(false, String(err?.message ?? err));
        }
      };

      printWin.webContents.once("did-finish-load", () => {
        setTimeout(async () => {
          if (!canUsePrintWindow()) return;

          const name = deviceNameFromMain;

          let attempts;
          if (pageSize) {
            // Renderer-prepared receipt (`print-page.ts`): exact paper mm × measured height.
            // Without it Windows uses the driver default (often A4/Letter) and the narrow
            // receipt lands off-centre on the roll. `printableArea` starts the layout at the
            // head's first printable dot; `none` when the HTML already carries calibration.
            attempts = [
              {
                printBackground: true,
                pageSize: {
                  width: Math.round(pageSize.widthMm * 1000),
                  height: Math.round(pageSize.heightMm * 1000),
                },
                margins: { marginType },
              },
            ];
          } else {
            const measured = await measurePrintPageSize(printWin.webContents);
            if (!canUsePrintWindow()) return;
            // Explicit micron pageSize beats Letter/A4 clipping; CSS @page injected to match.
            // Fallback attempt keeps preferCSSPageSize if the driver rejects custom size.
            attempts = measured
              ? [
                  {
                    printBackground: true,
                    preferCSSPageSize: true,
                    margins: { marginType: "none" },
                    pageSize: measured,
                  },
                  {
                    printBackground: true,
                    preferCSSPageSize: false,
                    margins: { marginType: "none" },
                    pageSize: measured,
                  },
                ]
              : [
                  {
                    printBackground: true,
                    preferCSSPageSize: true,
                    margins: { marginType: "none" },
                  },
                ];
          }

          const normalize = (list) =>
            list.map((ex) => {
              const { printBackground, ...rest } = ex;
              return { ex: rest, printBackground };
            });

          const normalized = normalize(attempts);

          const runChain = (i, lastReason) => {
            if (!canUsePrintWindow()) return;
            if (i >= normalized.length) {
              done(false, String(lastReason ?? "print-failed"));
              return;
            }
            const { ex, printBackground } = normalized[i];
            const opts = {
              silent: true,
              printBackground: Boolean(printBackground),
              deviceName: name,
              ...ex,
            };
            runPrint(opts, (success, failureReason) => {
              if (settled) return;
              if (success) {
                done(true);
                return;
              }
              const r = failureReason ?? lastReason;
              if (isDev) {
                console.warn("[print-html-silent] attempt failed:", r, opts);
              }
              runChain(i + 1, r);
            });
          };

          runChain(0, undefined);
        }, 300);
      });

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlForPrint)}`;
      printWin.loadURL(dataUrl).catch((err) => {
        done(false, String(err?.message ?? err));
      });
    });
  });
}

const PDF_RENDER_MAX_MS = 15000;

/** Renders receipt HTML in a hidden window and returns a PDF buffer at the exact paper size. */
function renderReceiptPdf(html, pageSize, edgeToEdge) {
  return new Promise((resolve, reject) => {
    const pdfWin = new BrowserWindow({
      show: false,
      width: paperWindowWidthPx(pageSize),
      height: 900,
      webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true },
    });
    let settled = false;
    const finish = (err, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (!pdfWin.isDestroyed()) pdfWin.destroy();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve(data);
    };
    const timer = setTimeout(() => finish(new Error("pdf-timeout")), PDF_RENDER_MAX_MS);
    pdfWin.webContents.on("did-fail-load", (_e, _code, desc) => finish(new Error(desc || "load-failed")));
    pdfWin.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        if (settled || pdfWin.isDestroyed()) return;
        // Side margins = the head's dead zones, so the PDF shows exactly what reaches the paper.
        // Calibrated receipts and the ruler page already carry their own side padding.
        const sideIn = edgeToEdge
          ? 0
          : (pageSize.widthMm - printableWidthMm(pageSize.widthMm)) / 2 / 25.4;
        pdfWin.webContents
          .printToPDF({
            printBackground: true,
            preferCSSPageSize: false,
            pageSize: {
              width: pageSize.widthMm / 25.4,
              height: pageSize.heightMm / 25.4,
            },
            margins: { top: 0, bottom: 0, left: sideIn, right: sideIn },
          })
          .then((data) => finish(null, data))
          .catch((err) => finish(err instanceof Error ? err : new Error(String(err))));
      }, 200);
    });
    pdfWin
      .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      .catch((err) => finish(err instanceof Error ? err : new Error(String(err))));
  });
}

function openPdfPreviewWindow(filePath, title, parent) {
  const preview = new BrowserWindow({
    width: 560,
    height: 860,
    title,
    autoHideMenuBar: true,
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, plugins: true },
  });
  preview.setTitle(title);
  preview.on("page-title-updated", (e) => e.preventDefault());
  preview.webContents.on("did-fail-load", () => {
    if (!preview.isDestroyed()) preview.destroy();
    void shell.openPath(filePath);
  });
  preview.loadURL(pathToFileURL(filePath).toString()).catch(() => {
    void shell.openPath(filePath);
  });
}

function registerPrintHtmlToPdfIpc() {
  ipcMain.removeHandler("print-html-to-pdf");
  ipcMain.handle("print-html-to-pdf", async (event, payload) => {
    const html = payload && typeof payload.html === "string" ? payload.html : "";
    if (!html) return { ok: false, error: "invalid-html" };
    if (html.length > MAX_SILENT_PRINT_HTML) return { ok: false, error: "html-too-large" };
    const pageSize = readPageSizeMm(payload);
    if (!pageSize) return { ok: false, error: "invalid-page-size" };
    const mode = payload.mode === "save" ? "save" : "preview";
    const baseName = String(payload.fileName || "receipt").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "receipt";
    const sizeLabel = `${Math.round(pageSize.widthMm)}mm`;
    const parent = BrowserWindow.fromWebContents(event.sender);
    try {
      const data = await renderReceiptPdf(html, pageSize, payload.marginType === "none");
      if (mode === "save") {
        const saveOptions = {
          title: "Export PDF",
          defaultPath: path.join(app.getPath("downloads"), `${baseName} (${sizeLabel}).pdf`),
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        };
        const result = parent
          ? await dialog.showSaveDialog(parent, saveOptions)
          : await dialog.showSaveDialog(saveOptions);
        if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
        fs.writeFileSync(result.filePath, data);
        return { ok: true, path: result.filePath };
      }
      const dir = path.join(os.tmpdir(), "vyntex-pdf-preview");
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${baseName} (${sizeLabel}) ${Date.now()}.pdf`);
      fs.writeFileSync(filePath, data);
      openPdfPreviewWindow(filePath, `${baseName} — ${sizeLabel} × ${Math.round(pageSize.heightMm)}mm`, parent);
      return { ok: true, path: filePath };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) };
    }
  });
}

function registerGetSystemPrintersIpc() {
  ipcMain.removeHandler("get-system-printers");
  ipcMain.handle("get-system-printers", async (event) => {
    try {
      const printers = await getPrintersForSilentPrint(event);
      const physical = printers.filter((p) => !isVirtualPrinter(p));
      return {
        ok: true,
        printers: physical.map((p) => ({
          deviceName: p.name,
          displayName: String(p.displayName ?? p.name ?? ""),
          isDefault: Boolean(p.isDefault),
          isOffline: isPrinterOffline(p),
          paperWidthMm: resolvePrinterPaperWidthMm(p),
        })),
      };
    } catch (err) {
      return {
        ok: false,
        error: String(err?.message ?? err),
      };
    }
  });
}

function createWindow() {
  const iconPath = resolveWindowIconPath();

  /** Fit laptops, touch AIOs, and small tablets: never force a window larger than the work area. */
  let winX;
  let winY;
  let winWidth = 1440;
  let winHeight = 900;
  let minWidth = 800;
  let minHeight = 560;
  try {
    const primary = screen.getPrimaryDisplay();
    const area = primary.workArea ?? { x: 0, y: 0, width: 1280, height: 800 };
    const aw = Math.max(480, area.width);
    const ah = Math.max(400, area.height);
    minWidth = Math.min(800, Math.max(360, aw - 16));
    minHeight = Math.min(560, Math.max(400, ah - 16));
    winWidth = Math.min(1440, Math.max(minWidth, aw - 32));
    winHeight = Math.min(900, Math.max(minHeight, ah - 32));
    winX = Math.round(area.x + (aw - winWidth) / 2);
    winY = Math.round(area.y + (ah - winHeight) / 2);
  } catch {
    /* fall back to defaults */
  }

  const win = new BrowserWindow({
    ...(typeof winX === "number" && typeof winY === "number" ? { x: winX, y: winY } : {}),
    width: winWidth,
    height: winHeight,
    minWidth,
    minHeight,
    backgroundColor: "#0A0F1E",
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
      try {
        console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
      } catch (err) {
        if (!isBrokenPipeError(err)) throw err;
      }
    });
    win.webContents.on("render-process-gone", (_e, details) => {
      console.error("[electron] render-process-gone", details);
    });
    win.webContents.on("did-fail-load", (_e, code, desc, validatedURL) => {
      console.error("[electron] did-fail-load", code, desc, validatedURL);
    });
    win.webContents.on("did-finish-load", () => {
      console.log("[electron] loaded", devUrl);
    });
    win.loadURL(devUrl).catch((err) => {
      console.error("[electron] loadURL failed:", err);
    });
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "..", "dist", "index.html");
    win.loadURL(pathToFileURL(indexPath).toString());
  }
}

let customerDisplayWindow = null;

function customerDisplayTargetUrl() {
  const main = BrowserWindow.getAllWindows().find(
    (win) => win !== customerDisplayWindow && !win.isDestroyed(),
  );
  const current = main?.webContents.getURL() || "";
  const hashIndex = current.indexOf("#");
  const base = hashIndex >= 0 ? current.slice(0, hashIndex) : current;
  if (base) return `${base}#/pos/customer-display`;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL.replace(/\/$/, "")}/#/pos/customer-display`;
  }
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  return `${pathToFileURL(indexPath).toString()}#/pos/customer-display`;
}

function extraCustomerDisplays() {
  const all = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return all.filter((d) => d.id !== primary.id);
}

function registerCustomerDisplayIpc() {
  ipcMain.handle("customer-display-status", () => {
    const extra = extraCustomerDisplays();
    const open = Boolean(customerDisplayWindow && !customerDisplayWindow.isDestroyed());
    let displayLabel = null;
    if (open) {
      const bounds = customerDisplayWindow.getBounds();
      const hit = screen.getDisplayMatching(bounds);
      displayLabel = hit?.label || `${hit?.bounds?.width ?? ""}×${hit?.bounds?.height ?? ""}`;
    }
    return {
      open,
      extraDisplayCount: extra.length,
      displayLabel,
    };
  });

  ipcMain.handle("customer-display-open", () => {
    const extra = extraCustomerDisplays();
    const target = extra[0];
    if (!target) return { ok: false, error: "NO_EXTRA_DISPLAY" };

    if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
      customerDisplayWindow.setBounds(target.bounds);
      customerDisplayWindow.setFullScreen(true);
      customerDisplayWindow.focus();
      return { ok: true };
    }

    const iconPath = resolveWindowIconPath();
    customerDisplayWindow = new BrowserWindow({
      x: target.bounds.x,
      y: target.bounds.y,
      width: target.bounds.width,
      height: target.bounds.height,
      fullscreen: true,
      autoHideMenuBar: true,
      frame: false,
      backgroundColor: "#070B16",
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    customerDisplayWindow.setMenuBarVisibility(false);
    customerDisplayWindow.on("closed", () => {
      customerDisplayWindow = null;
    });
    customerDisplayWindow.loadURL(customerDisplayTargetUrl()).catch((err) => {
      console.error("[electron] customer-display load failed", err);
    });
    return { ok: true };
  });

  ipcMain.handle("customer-display-close", () => {
    if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
      customerDisplayWindow.close();
    }
    customerDisplayWindow = null;
    return { ok: true };
  });
}

app.whenReady().then(() => {
  registerPrintHtmlSilentIpc();
  registerPrintHtmlToPdfIpc();
  registerGetSystemPrintersIpc();
  registerAppUpdateIpc();
  registerCustomerDisplayIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
