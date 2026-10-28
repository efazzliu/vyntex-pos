/**
 * Electron-side paper width helpers (keep heuristics in sync with src/lib/print-paper-width.ts).
 */

const PRINT_PAPER_MM_MIN = 48;
const PRINT_PAPER_MM_MAX = 110;
const PRINT_PAPER_MM_DEFAULT = 80;

function clampPaperMm(n) {
  if (!Number.isFinite(n)) return PRINT_PAPER_MM_DEFAULT;
  return Math.min(PRINT_PAPER_MM_MAX, Math.max(PRINT_PAPER_MM_MIN, Math.round(n)));
}

function numberToPaperMm(raw) {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  if (raw >= 40_000 && raw <= 130_000) return clampPaperMm(raw / 1000);
  if (raw >= 4000 && raw <= 13000) return clampPaperMm(raw / 100);
  if (raw >= 40 && raw <= 130) return clampPaperMm(raw);
  if (raw >= 1.5 && raw <= 5.5) return clampPaperMm(raw * 25.4);
  return null;
}

function parseMmFromText(blob) {
  const s = String(blob || "").toLowerCase();
  const mm = s.match(/(\d{2,3})\s*mm\b/);
  if (mm) {
    const n = Number(mm[1]);
    if (n >= 40 && n <= 130) return clampPaperMm(n);
  }
  const inch = s.match(/(\d(?:\.\d+)?)\s*(?:in|inch|"|”)\b/);
  if (inch) return numberToPaperMm(Number(inch[1]));
  return null;
}

function inferFromLabel(name, displayName) {
  const blob = [name, displayName].filter(Boolean).join(" ").toLowerCase();
  if (!blob) return null;
  const fromText = parseMmFromText(blob);
  if (fromText) return fromText;
  if (
    /\b(58|xp-58|xpos.?58|rpp02|rpp02n|mtp.?ii|mtp.?3|goojprt|muni?b|pos.?58)\b/.test(
      blob,
    )
  ) {
    return 58;
  }
  if (
    /\b(80|xp-80|xpos.?80|tm-t|tm-m|epson.?tm|rp80|pos.?80|thermal.?80|receipt.?80)\b/.test(
      blob,
    )
  ) {
    return 80;
  }
  if (/\b(thermal|receipt|pos\s*printer|esc\/?pos)\b/.test(blob)) {
    return PRINT_PAPER_MM_DEFAULT;
  }
  return null;
}

function inferFromOptions(options) {
  if (!options || typeof options !== "object") return null;
  const preferKeys =
    /media|paper|page.?size|width|x-dimension|printer-media|default-media/i;
  for (const [key, value] of Object.entries(options)) {
    if (!preferKeys.test(key)) continue;
    if (typeof value === "number") {
      const n = numberToPaperMm(value);
      if (n) return n;
      continue;
    }
    if (typeof value === "string") {
      const fromText = parseMmFromText(value);
      if (fromText) return fromText;
      const n = numberToPaperMm(Number(value));
      if (n) return n;
    }
  }
  for (const value of Object.values(options)) {
    if (typeof value === "string") {
      const fromText = parseMmFromText(value);
      if (fromText) return fromText;
    }
  }
  return null;
}

function resolvePrinterPaperWidthMm(printer) {
  if (!printer) return PRINT_PAPER_MM_DEFAULT;
  if (typeof printer.paperWidthMm === "number" && Number.isFinite(printer.paperWidthMm)) {
    return clampPaperMm(printer.paperWidthMm);
  }
  const fromOpts = inferFromOptions(printer.options);
  if (fromOpts) return fromOpts;
  const fromLabel = inferFromLabel(printer.name || printer.deviceName, printer.displayName);
  if (fromLabel) return fromLabel;
  return PRINT_PAPER_MM_DEFAULT;
}

function applyPaperWidthMmToPrintHtml(html, widthMm) {
  const mm = clampPaperMm(widthMm);
  const width = `${mm}mm`;
  let out = String(html || "");
  out = out.replace(/(--print-width\s*:\s*)[^;]+;/gi, `$1${width};`);
  out = out.replace(/(--print-width-mm\s*:\s*)[^;]+;/gi, `$1${mm};`);
  out = out.replace(
    /@page\s*\{\s*size\s*:\s*[\d.]+mm(\s+[^;}]+)/gi,
    `@page { size: ${width}$1`,
  );
  out = out.replace(/((?:max-)?width\s*:\s*)[\d.]+mm/gi, `$1${width}`);
  return out;
}

/** True when Design left paper width on Auto. */
function htmlWantsAutoPaperWidth(html) {
  const s = String(html || "");
  if (/--print-paper-mode\s*:\s*auto/i.test(s)) return true;
  // Older saved tickets had no mode flag — treat as auto so printer mm wins.
  if (!/--print-paper-mode\s*:/i.test(s)) return true;
  return false;
}

module.exports = {
  PRINT_PAPER_MM_DEFAULT,
  resolvePrinterPaperWidthMm,
  applyPaperWidthMmToPrintHtml,
  htmlWantsAutoPaperWidth,
  inferFromLabel,
  inferFromOptions,
};
