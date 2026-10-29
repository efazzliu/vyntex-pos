/**
 * Sizes every receipt to its real paper: width from the Design (58 / 80 / custom mm),
 * height measured from the rendered content, so thermal rolls and PDFs never fall back
 * to the printer's default A4/Letter page.
 */
import { FALLBACK_PAGE_HEIGHT_MM, NARROW_TABLE_CSS } from "./print-design.ts";
import { calibrationPaddingMm, type PrinterCalibration } from "./print-calibration.ts";

const CSS_PX_PER_MM = 96 / 25.4;
/** Feed below the last line so the cutter does not clip the footer. */
const BOTTOM_FEED_MM = 4;
const MIN_HEIGHT_MM = 40;
const MAX_HEIGHT_MM = 3000;
const PAGE_STYLE_ID = "vyntex-page-size";

export type ReceiptPaper = {
  html: string;
  widthMm: number;
  heightMm: number;
  /** True when a printer calibration placed the content (print/PDF must then use zero margins). */
  calibrated: boolean;
};

const CALIBRATION_STYLE_ID = "vyntex-calibration";
/** Printable bands up to this width get the 58 mm table rules, whatever the template width. */
const NARROW_BAND_MM = 52;

function applyCalibrationPadding(html: string, c: PrinterCalibration): string {
  const { leftMm, rightMm } = calibrationPaddingMm(c);
  const narrow = c.endMm - c.startMm <= NARROW_BAND_MM ? NARROW_TABLE_CSS : "";
  const rule = `<style id="${CALIBRATION_STYLE_ID}">html{box-sizing:border-box;padding-left:${leftMm}mm !important;padding-right:${rightMm}mm !important}${narrow}</style>`;
  const cleaned = html.replace(new RegExp(`<style id="${CALIBRATION_STYLE_ID}">[\\s\\S]*?</style>`, "i"), "");
  if (/<\/head>/i.test(cleaned)) return cleaned.replace(/<\/head>/i, `${rule}</head>`);
  return `${rule}${cleaned}`;
}

/** Paper width written by `printDesignCss` (`--print-width: 80mm`); null for non-receipt documents. */
export function receiptWidthMm(html: string): number | null {
  const match = /--print-width:\s*([\d.]+)mm/i.exec(html);
  const n = match ? Number(match[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function applyReceiptPageSize(html: string, widthMm: number, heightMm: number): string {
  const rule = `<style id="${PAGE_STYLE_ID}">@page{size:${widthMm}mm ${heightMm}mm;margin:0}</style>`;
  const cleaned = html.replace(new RegExp(`<style id="${PAGE_STYLE_ID}">[\\s\\S]*?</style>`, "i"), "");
  if (/<\/head>/i.test(cleaned)) return cleaned.replace(/<\/head>/i, `${rule}</head>`);
  return `${rule}${cleaned}`;
}

async function waitForAssets(doc: Document): Promise<void> {
  const images = Array.from(doc.images).map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
  );
  const fonts = (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
  await Promise.race([
    Promise.all([...images, fonts ?? Promise.resolve()]),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

/** Renders the receipt off-screen at the paper width and returns its height in mm. */
export async function measureReceiptHeightMm(html: string, widthMm: number): Promise<number> {
  if (typeof document === "undefined") return FALLBACK_PAGE_HEIGHT_MM;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${Math.ceil(widthMm * CSS_PX_PER_MM)}px`,
    "height:200px",
    "border:0",
    "opacity:0",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) return FALLBACK_PAGE_HEIGHT_MM;
    doc.open();
    doc.write(html);
    doc.close();
    await waitForAssets(doc);
    const heightPx = Math.max(
      doc.documentElement.scrollHeight,
      doc.body?.scrollHeight ?? 0,
      doc.body?.getBoundingClientRect().height ?? 0,
    );
    const mm = Math.ceil(heightPx / CSS_PX_PER_MM + BOTTOM_FEED_MM);
    return Math.min(MAX_HEIGHT_MM, Math.max(MIN_HEIGHT_MM, mm));
  } catch {
    return FALLBACK_PAGE_HEIGHT_MM;
  } finally {
    iframe.remove();
  }
}

/**
 * Thermal heads print narrower than the roll (58 mm → ~48 mm, 80 mm → ~72 mm). Both the
 * physical print (driver printable area) and the PDF (matching side margins) lay out there.
 * Keep in sync with `printableWidthMm` in `electron/main.cjs`.
 */
export function printableWidthMm(paperWidthMm: number): number {
  const unprintable = paperWidthMm <= 60 ? 10 : 8;
  return Math.max(40, paperWidthMm - unprintable);
}

/**
 * Measures the receipt inside the printable width and pins `@page` to its real paper size.
 * With a printer calibration, the printer's paper width wins and the content is padded into
 * the calibrated printable band. Returns null for non-receipt documents (no `--print-width`).
 */
export async function prepareReceiptPaper(
  html: string,
  calibration?: PrinterCalibration | null,
): Promise<ReceiptPaper | null> {
  const templateWidthMm = receiptWidthMm(html);
  if (templateWidthMm === null) return null;
  if (calibration) {
    const padded = applyCalibrationPadding(html, calibration);
    const heightMm = await measureReceiptHeightMm(padded, calibration.paperWidthMm);
    return {
      html: applyReceiptPageSize(padded, calibration.paperWidthMm, heightMm),
      widthMm: calibration.paperWidthMm,
      heightMm,
      calibrated: true,
    };
  }
  // Auto width may resolve to 58 mm only at print time, after the template CSS was built.
  const sized = templateWidthMm <= 60 ? applyNarrowRules(html) : html;
  const heightMm = await measureReceiptHeightMm(sized, printableWidthMm(templateWidthMm));
  return {
    html: applyReceiptPageSize(sized, templateWidthMm, heightMm),
    widthMm: templateWidthMm,
    heightMm,
    calibrated: false,
  };
}

const NARROW_STYLE_ID = "vyntex-narrow";

function applyNarrowRules(html: string): string {
  if (html.includes(`id="${NARROW_STYLE_ID}"`)) return html;
  const rule = `<style id="${NARROW_STYLE_ID}">${NARROW_TABLE_CSS}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${rule}</head>`);
  return `${rule}${html}`;
}
