const fs = require("node:fs");
const path = require("node:path");

/** E-Link (Enternet) watches this folder. See C:\\Program Files\\E-Link\\appsettings.json */
const INPUT_DIR = "C:\\Temp";

const COMMAND_LINE = /^[STPC],[0-9]+,______,_,__;/;

/**
 * FP-700KS speaks command 58. AUTO sends command 49 and the printer answers
 * -150001 SYNTAX ERROR. Letter E is disabled on this unit (-150403); 18% is B.
 * File tax code stays 5. Only the live E-Link config is adjusted.
 */
function patchElinkForFp700Ks() {
  const files = [
    "C:\\ProgramData\\E-Link\\appsettings.json",
    "C:\\Program Files\\E-Link\\appsettings.json",
  ];
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      const next = text
        .replace(/"SaleCommand"\s*:\s*"(?:Auto|FP-700|FP700Plus|FP-700Plus)"/g, '"SaleCommand": "FP700"')
        .replace(/"5"\s*:\s*"E"/g, '"5": "B"');
      if (next === text) continue;
      JSON.parse(next);
      fs.writeFileSync(file, next);
    } catch {
      /* Program Files may be read-only. A bad rewrite is skipped. */
    }
  }
}

/** E-Link reads coupons as Windows-1250. Albanian ç/ë share those bytes with Latin-1. */
function encodeWindows1250(text) {
  const bytes = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    bytes[i] = code < 256 ? code : 0x3f;
  }
  return bytes;
}

function registerElinkFiscalIpc(ipcMain) {
  patchElinkForFp700Ks();
  ipcMain.removeHandler("elink-write-fiscal");
  ipcMain.handle("elink-write-fiscal", async (_event, payload) => {
    const body = payload && typeof payload.body === "string" ? payload.body : "";
    const orderRef =
      payload && typeof payload.orderRef === "string" ? payload.orderRef : "order";
    if (!body || body.length > 100_000) return { ok: false, error: "invalid-file" };

    const lines = body.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0 || lines.length > 200) return { ok: false, error: "invalid-file" };
    for (const line of lines) {
      if (!COMMAND_LINE.test(line) || line.length > 240) {
        return { ok: false, error: "invalid-file" };
      }
    }
    if (!lines.some((line) => line.startsWith("S,")) || !lines.some((line) => line.startsWith("T,"))) {
      return { ok: false, error: "invalid-file" };
    }

    patchElinkForFp700Ks();

    const safeRef = orderRef.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "order";
    const name = `vyntex-${safeRef}-${Date.now()}.inp`;
    const finalPath = path.join(INPUT_DIR, name);
    const tmpPath = `${finalPath}.writing`;
    const text = `${lines.join("\r\n")}\r\n`;

    try {
      fs.mkdirSync(INPUT_DIR, { recursive: true });
      fs.writeFileSync(tmpPath, encodeWindows1250(text));
      fs.renameSync(tmpPath, finalPath);
      return { ok: true, path: finalPath };
    } catch (err) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
      const message = err && err.message ? String(err.message) : "write-failed";
      return { ok: false, error: message };
    }
  });
}

module.exports = { registerElinkFiscalIpc };
