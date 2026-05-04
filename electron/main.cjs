const { app, BrowserWindow, shell, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

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

    return await new Promise((resolve) => {
      const printWin = new BrowserWindow({
        show: false,
        width: 420,
        height: 720,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      let settled = false;

      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        try {
          printWin.close();
        } catch {
          /* ignore */
        }
        resolve({ ok, error });
      };

      const timeout = setTimeout(() => {
        finish(false, "timeout");
      }, 45_000);

      const done = (ok, error) => {
        clearTimeout(timeout);
        finish(ok, error);
      };

      printWin.webContents.on("did-fail-load", (_e, _code, errorDesc) => {
        done(false, errorDesc || "load-failed");
      });

      const runPrint = (opts, cb) => {
        printWin.webContents.print(opts, cb);
      };

      printWin.webContents.once("did-finish-load", () => {
        setTimeout(() => {
          const name = deviceNameFromMain;
          const win32 = process.platform === "win32";
          // Never omit deviceName: implicit "default" is often Print to PDF → Save dialog.
          const attempts = win32
            ? [
                {},
                { scaleFactor: 0.99 },
                { printBackground: true },
                { printBackground: true, scaleFactor: 0.99 },
              ]
            : [{}, { printBackground: true }];

          const normalize = (list) =>
            list.map((ex) => {
              const { printBackground, ...rest } = ex;
              return { ex: rest, printBackground };
            });

          const normalized = normalize(attempts);

          const runChain = (i, lastReason) => {
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
        }, 150);
      });

      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      printWin.loadURL(dataUrl).catch((err) => {
        done(false, String(err?.message ?? err));
      });
    });
  });
}

function createWindow() {
  const iconPath = resolveWindowIconPath();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
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
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
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

app.whenReady().then(() => {
  registerPrintHtmlSilentIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
