const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");

/** E-Link (Enternet) watches this folder. See C:\\Program Files\\E-Link\\appsettings.json */
const INPUT_DIR = "C:\\Temp";
const ELINK_EXE = "C:\\Program Files\\E-Link\\E-Link.exe";
const STAMP = "C:\\ProgramData\\E-Link\\vyntex-fp700ks.stamp";
const STAMP_VALUE = "fp700-tax-b";

const COMMAND_LINE = /^[STPC],[0-9]+,______,_,__;/;
const CONFIG_FILES = [
  "C:\\ProgramData\\E-Link\\appsettings.json",
  "C:\\Program Files\\E-Link\\appsettings.json",
];

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function processRunning(image) {
  try {
    const out = execFileSync("tasklist", ["/FI", `IMAGENAME eq ${image}`, "/NH"], {
      encoding: "utf8",
      windowsHide: true,
    });
    return out.toLowerCase().includes(image.toLowerCase());
  } catch {
    return false;
  }
}

function stopImage(image) {
  try {
    execFileSync("taskkill", ["/IM", image, "/F", "/T"], { stdio: "ignore", windowsHide: true });
  } catch {
    /* already stopped */
  }
}

function stopElink() {
  stopImage("E-Link.exe");
  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (!processRunning("E-Link.exe")) return;
    sleepMs(200);
  }
}

function startElink() {
  if (!fs.existsSync(ELINK_EXE)) return false;
  const child = spawn(ELINK_EXE, [], {
    detached: true,
    stdio: "ignore",
    cwd: path.dirname(ELINK_EXE),
    windowsHide: false,
  });
  child.unref();
  const start = Date.now();
  while (Date.now() - start < 8000) {
    if (processRunning("E-Link.exe")) {
      sleepMs(1500);
      return true;
    }
    sleepMs(200);
  }
  return false;
}

function readConfig(file) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.toString("utf16le"), encoding: "utf16le" };
  }
  return { text: buf.toString("utf8"), encoding: "utf8" };
}

function writeConfig(file, text, encoding) {
  if (encoding === "utf16le") fs.writeFileSync(file, Buffer.from(text, "utf16le"));
  else fs.writeFileSync(file, text);
}

/**
 * FP-700KS speaks command 58. AUTO sends command 49 and the printer answers
 * -150001 SYNTAX ERROR. A running E-Link keeps the old command until it is
 * started again. Letter E is disabled (-150403); 18% is B. File tax code stays 5.
 */
function patchElinkForFp700Ks() {
  let changed = false;
  for (const file of CONFIG_FILES) {
    try {
      if (!fs.existsSync(file)) continue;
      const { text, encoding } = readConfig(file);
      const next = text
        .replace(/"SaleCommand"\s*:\s*"(?:Auto|FP-700|FP700Plus|FP-700Plus)"/g, '"SaleCommand": "FP700"')
        .replace(/"5"\s*:\s*"E"/g, '"5": "B"');
      if (next === text) continue;
      JSON.parse(next.replace(/^\uFEFF/, ""));
      writeConfig(file, next, encoding);
      changed = true;
    } catch {
      /* Program Files may be read-only. A bad rewrite is skipped. */
    }
  }
  return changed;
}

function configReady() {
  const live = "C:\\ProgramData\\E-Link\\appsettings.json";
  try {
    const { text } = readConfig(live);
    return /"SaleCommand"\s*:\s*"FP700"/.test(text) && /"5"\s*:\s*"B"/.test(text);
  } catch {
    return false;
  }
}

function stampReady() {
  try {
    return fs.readFileSync(STAMP, "utf8").trim() === STAMP_VALUE;
  } catch {
    return false;
  }
}

function clearStuckCoupons() {
  for (const dir of [INPUT_DIR, "C:\\Temp\\errors", "C:\\Temp\\PrintErrors"]) {
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/^vyntex-.*\.(inp|writing)$/i.test(name)) continue;
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        /* still open */
      }
    }
  }
}

/**
 * F-Link already watches C:\Temp and printed today's coupons on COM4.
 * E-Link takes that port, then the paper never comes out. Never start it.
 * The image name is not always fiskal.exe (Task Manager shows "F-Link").
 */
function ensureFiscalDriver() {
  if (!processRunning("E-Link.exe")) return;
  stopElink();
  sleepMs(1500);
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

    ensureFiscalDriver();

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
