const fs = require("node:fs");
const path = require("node:path");

/** E-Link (Enternet) watches this folder. See C:\\Program Files\\E-Link\\appsettings.json */
const INPUT_DIR = "C:\\Temp";

const COMMAND_LINE = /^[STPC],[0-9]+,______,_,__;/;

function registerElinkFiscalIpc(ipcMain) {
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

    const safeRef = orderRef.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "order";
    const name = `vyntex-${safeRef}-${Date.now()}.inp`;
    const finalPath = path.join(INPUT_DIR, name);
    const tmpPath = `${finalPath}.writing`;
    const text = `${lines.join("\r\n")}\r\n`;

    try {
      fs.mkdirSync(INPUT_DIR, { recursive: true });
      fs.writeFileSync(tmpPath, text, "utf8");
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
