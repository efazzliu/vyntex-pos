const { app, BrowserWindow, shell, ipcMain, screen } = require("electron");
const { registerAppUpdateIpc } = require("./app-update.cjs");
const fs = require("node:fs");
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
const SILENT_PRINT_DESTROY_DELAY_MS = 750;

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

    return await new Promise((resolve) => {
      // Tall off-screen window so long thermal layouts lay out fully before print.
      const printWin = new BrowserWindow({
        show: false,
        width: 480,
        height: 2400,
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
        setTimeout(() => {
          if (!canUsePrintWindow()) return;

          const name = deviceNameFromMain;
          // One attempt per job: retries belong in the renderer queue with backoff.
          // preferCSSPageSize + no margins: honor @page thermal width/height so
          // long receipts are not clipped to Letter/A4.
          const attempts = [
            {
              printBackground: true,
              preferCSSPageSize: true,
              margins: { marginType: "none" },
            },
          ];

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
        }, 250);
      });

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      printWin.loadURL(dataUrl).catch((err) => {
        done(false, String(err?.message ?? err));
      });
    });
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
