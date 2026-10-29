/**
 * Resolve thermal paper width (mm) from the OS / assigned printer so Print Layout
 * does not require the user to pick 58/80 manually.
 */

export const PRINT_PAPER_MM_MIN = 48;
export const PRINT_PAPER_MM_MAX = 110;
export const PRINT_PAPER_MM_DEFAULT = 80;

function clampPaperMm(n: number): number {
  if (!Number.isFinite(n)) return PRINT_PAPER_MM_DEFAULT;
  return Math.min(PRINT_PAPER_MM_MAX, Math.max(PRINT_PAPER_MM_MIN, Math.round(n)));
}

/** Microns / hundredths / inches → mm when values look like media sizes. */
function numberToPaperMm(raw: number): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  // Microns (CUPS / Chromium often use these): 58000 → 58mm
  if (raw >= 40_000 && raw <= 130_000) return clampPaperMm(raw / 1000);
  // Hundredths of mm: 5800 → 58
  if (raw >= 4000 && raw <= 13000) return clampPaperMm(raw / 100);
  // Already mm
  if (raw >= 40 && raw <= 130) return clampPaperMm(raw);
  // Inches (2.28" ≈ 58mm, 3.15" ≈ 80mm)
  if (raw >= 1.5 && raw <= 5.5) return clampPaperMm(raw * 25.4);
  return null;
}

function parseMmFromText(blob: string): number | null {
  const s = blob.toLowerCase();
  const mm = s.match(/(\d{2,3})\s*mm\b/);
  if (mm) {
    const n = Number(mm[1]);
    if (n >= 40 && n <= 130) return clampPaperMm(n);
  }
  const inch = s.match(/(\d(?:\.\d+)?)\s*(?:in|inch|"|”)\b/);
  if (inch) {
    const n = Number(inch[1]);
    const asMm = numberToPaperMm(n);
    if (asMm) return asMm;
  }
  return null;
}

/**
 * Infer width from printer display/name (XP-80, TM-T20 80mm, 58mm Bluetooth, etc.).
 */
export function inferPaperWidthMmFromPrinterLabel(
  name?: string | null,
  displayName?: string | null,
): number | null {
  const blob = [name, displayName].filter(Boolean).join(" ").toLowerCase();
  if (!blob) return null;

  const fromText = parseMmFromText(blob);
  if (fromText) return fromText;

  // Common 58mm thermal brands / model tokens
  if (
    /\b(58|xp-58|xpos.?58|rpp02|rpp02n|mtp.?ii|mtp.?3|goojprt|muni?b|cat.?thermal.?58|pos.?58)\b/.test(
      blob,
    )
  ) {
    return 58;
  }
  // Common 80mm tokens
  if (
    /\b(80|xp-80|xpos.?80|tm-t|tm-m|epson.?tm|rp80|pos.?80|thermal.?80|receipt.?80)\b/.test(
      blob,
    )
  ) {
    return 80;
  }
  // Generic thermal receipt → default 80mm roll
  if (/\b(thermal|receipt|pos\s*printer|esc\/?pos)\b/.test(blob)) {
    return PRINT_PAPER_MM_DEFAULT;
  }
  return null;
}

/**
 * Walk Chromium/CUPS printer `options` for media width.
 */
export function inferPaperWidthMmFromPrinterOptions(
  options?: Record<string, unknown> | null,
): number | null {
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
      const asNum = Number(value);
      if (Number.isFinite(asNum)) {
        const n = numberToPaperMm(asNum);
        if (n) return n;
      }
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      for (const k of ["width", "x_dimension", "x-dimension", "XDimension", "media-width"]) {
        const raw = nested[k];
        if (typeof raw === "number") {
          const n = numberToPaperMm(raw);
          if (n) return n;
        }
        if (typeof raw === "string") {
          const fromText = parseMmFromText(raw);
          if (fromText) return fromText;
          const asNum = Number(raw);
          if (Number.isFinite(asNum)) {
            const n = numberToPaperMm(asNum);
            if (n) return n;
          }
        }
      }
    }
  }

  // Last resort: scan all option string values for "58mm" / "80mm"
  for (const value of Object.values(options)) {
    if (typeof value === "string") {
      const fromText = parseMmFromText(value);
      if (fromText) return fromText;
    }
  }
  return null;
}

export type PrinterPaperHint = {
  deviceName?: string | null;
  displayName?: string | null;
  name?: string | null;
  options?: Record<string, unknown> | null;
  /** Already resolved mm from Electron IPC */
  paperWidthMm?: number | null;
};

/** Best-effort mm for a physical printer. Defaults to 80 if unknown. */
export function resolvePrinterPaperWidthMm(printer?: PrinterPaperHint | null): number {
  if (!printer) return PRINT_PAPER_MM_DEFAULT;
  if (
    typeof printer.paperWidthMm === "number" &&
    Number.isFinite(printer.paperWidthMm)
  ) {
    return clampPaperMm(printer.paperWidthMm);
  }
  const fromOpts = inferPaperWidthMmFromPrinterOptions(printer.options ?? null);
  if (fromOpts) return fromOpts;
  const fromLabel = inferPaperWidthMmFromPrinterLabel(
    printer.deviceName ?? printer.name,
    printer.displayName,
  );
  if (fromLabel) return fromLabel;
  return PRINT_PAPER_MM_DEFAULT;
}

/**
 * Rewrite print HTML CSS vars so portrait layout uses the printer's mm width.
 * Safe no-op when html has no --print-width.
 */
export function applyPaperWidthMmToPrintHtml(html: string, widthMm: number): string {
  const mm = clampPaperMm(widthMm);
  const width = `${mm}mm`;
  let out = html;
  out = out.replace(
    /(--print-width\s*:\s*)[^;]+;/gi,
    `$1${width};`,
  );
  out = out.replace(
    /(--print-width-mm\s*:\s*)[^;]+;/gi,
    `$1${mm};`,
  );
  // @page size: WIDTH HEIGHT — keep height token, replace width
  out = out.replace(
    /@page\s*\{\s*size\s*:\s*[\d.]+mm(\s+[^;}]+)/gi,
    `@page { size: ${width}$1`,
  );
  // html/body width rules commonly emitted as Nmm
  out = out.replace(
    /(html[^{]*\{[^}]*?width\s*:\s*)[\d.]+mm/gi,
    `$1${width}`,
  );
  out = out.replace(
    /(body[^{]*\{[^}]*?(?:max-)?width\s*:\s*)[\d.]+mm/gi,
    `$1${width}`,
  );
  // Inline fiscal body style max-width/width
  out = out.replace(
    /((?:max-)?width\s*:\s*)[\d.]+mm/gi,
    `$1${width}`,
  );
  return out;
}
