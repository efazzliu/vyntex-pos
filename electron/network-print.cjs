/**
 * Network thermal printers added by IP (Settings → Add network printer) are not Windows
 * print queues, so `webContents.print()` cannot reach them. Render the same receipt HTML to
 * a bitmap at the head's dot width and send it as an ESC/POS raster image to port 9100.
 */
const net = require("node:net");
const { BrowserWindow } = require("electron");

const NETWORK_ADDRESS_RE = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/;
/** 203 dpi heads: 8 dots per mm. */
const DOTS_PER_MM = 8;
const CSS_PX_PER_MM = 96 / 25.4;
const RENDER_MAX_MS = 15000;
const SEND_TIMEOUT_MS = 8000;
const MAX_HEIGHT_DOTS = 24000;
/** Rows per GS v 0 block; small blocks keep cheap printers' input buffers from overflowing. */
const BAND_ROWS = 128;

function parseNetworkPrinterAddress(value) {
  const m = NETWORK_ADDRESS_RE.exec(String(value ?? "").trim());
  if (!m) return null;
  if (m[1].split(".").some((octet) => Number(octet) > 255)) return null;
  const port = m[2] ? Number(m[2]) : 9100;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: m[1], port };
}

/** Same printable area as `printableWidthMm` in `src/lib/print-page.ts`: 80 → 72 mm, 58 → 48 mm. */
function printableWidthMm(paperWidthMm) {
  return Math.max(40, paperWidthMm - (paperWidthMm <= 60 ? 10 : 8));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function renderReceiptImage(html, paperWidthMm) {
  const printableMm = printableWidthMm(paperWidthMm);
  const dots = Math.floor((printableMm * DOTS_PER_MM) / 8) * 8;
  // Lay out at the printable width in CSS px, render at the head's dot density.
  const zoom = dots / (printableMm * CSS_PX_PER_MM);
  const win = new BrowserWindow({
    show: false,
    width: dots,
    // Small start height: scrollHeight never reports less than the viewport.
    height: 64,
    useContentSize: true,
    webPreferences: {
      offscreen: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: zoom,
    },
  });
  const timer = setTimeout(() => {
    if (!win.isDestroyed()) win.destroy();
  }, RENDER_MAX_MS);
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await win.webContents.executeJavaScript(
      "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
    );
    await delay(200);
    const cssHeight = await win.webContents.executeJavaScript(
      "Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0))",
    );
    const height = Math.min(MAX_HEIGHT_DOTS, Math.max(8, Math.ceil(Number(cssHeight) * zoom)));
    win.setContentSize(dots, height);
    await delay(250);
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: dots, height });
    const size = image.getSize();
    if (size.width !== dots) return image.resize({ width: dots, quality: "best" });
    return image;
  } finally {
    clearTimeout(timer);
    if (!win.isDestroyed()) win.destroy();
  }
}

/** NativeImage → ESC/POS: init, raster bands (GS v 0), feed, partial cut. */
function imageToEscPos(image) {
  const { width, height: fullHeight } = image.getSize();
  const bitmap = image.toBitmap(); // BGRA
  const bytesPerRow = Math.ceil(width / 8);
  const dark = (i) => bitmap[i + 3] > 0 && 0.114 * bitmap[i] + 0.587 * bitmap[i + 1] + 0.299 * bitmap[i + 2] < 160;
  // Drop blank paper below the last printed row (keep a small margin before the cut).
  let lastInk = -1;
  for (let y = fullHeight - 1; y >= 0 && lastInk < 0; y--) {
    for (let x = 0; x < width; x++) {
      if (dark((y * width + x) * 4)) {
        lastInk = y;
        break;
      }
    }
  }
  const height = Math.min(fullHeight, Math.max(8, lastInk + 24));
  const parts = [Buffer.from([0x1b, 0x40])];
  for (let top = 0; top < height; top += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, height - top);
    const band = Buffer.alloc(bytesPerRow * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < width; x++) {
        if (dark(((top + y) * width + x) * 4)) band[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    parts.push(
      Buffer.from([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8]),
      band,
    );
  }
  parts.push(Buffer.from([0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00]));
  return Buffer.concat(parts);
}

function sendRaw({ host, port }, data) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let finished = false;
    const finish = (err) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };
    socket.setTimeout(SEND_TIMEOUT_MS, () => finish(new Error("printer-offline")));
    socket.on("error", (err) =>
      finish(
        new Error(
          ["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ETIMEDOUT"].includes(err?.code)
            ? "printer-offline"
            : String(err?.message ?? err),
        ),
      ),
    );
    socket.on("connect", () => {
      socket.write(data, (err) => {
        if (err) finish(err);
        else socket.end(() => finish());
      });
    });
  });
}

/** Resolves `{ ok, error? }` like `print-html-silent`. */
async function printHtmlToNetworkPrinter(html, address, paperWidthMm) {
  try {
    const image = await renderReceiptImage(html, paperWidthMm || 80);
    await sendRaw(address, imageToEscPos(image));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

module.exports = { parseNetworkPrinterAddress, printHtmlToNetworkPrinter, imageToEscPos };
