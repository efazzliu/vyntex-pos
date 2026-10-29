/**
 * Per-printer calibration for thermal rolls. Drivers differ in where the head starts
 * printing and how wide it prints, so each OS print queue (on this device) can store
 * the paper width and the first/last printable millimetre read off the ruler page.
 */
import { printableWidthMm } from "./print-page.ts";

export type PrinterCalibration = {
  paperWidthMm: number;
  /** First printable mm from the left paper edge. */
  startMm: number;
  /** Last printable mm from the left paper edge. */
  endMm: number;
};

const STORAGE_KEY = "vyntex-printer-calibration";
export const PAPER_MIN_MM = 40;
export const PAPER_MAX_MM = 120;
/** Keeps the first/last character off the exact edge of the printable area. */
const SAFETY_MM = 0.5;

function deviceKey(deviceName: string): string {
  return deviceName.trim().toLowerCase();
}

function readAll(): Record<string, PrinterCalibration> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PrinterCalibration>) : {};
  } catch {
    return {};
  }
}

export function defaultPrinterCalibration(paperWidthMm: number): PrinterCalibration {
  const paper = Math.min(PAPER_MAX_MM, Math.max(PAPER_MIN_MM, Math.round(paperWidthMm)));
  const printable = printableWidthMm(paper);
  const startMm = (paper - printable) / 2;
  return { paperWidthMm: paper, startMm, endMm: startMm + printable };
}

export function normalizePrinterCalibration(input: Partial<PrinterCalibration>): PrinterCalibration | null {
  const paper = Number(input.paperWidthMm);
  const start = Number(input.startMm);
  const end = Number(input.endMm);
  if (![paper, start, end].every(Number.isFinite)) return null;
  if (paper < PAPER_MIN_MM || paper > PAPER_MAX_MM) return null;
  if (start < 0 || end > paper || end - start < 30) return null;
  return { paperWidthMm: Math.round(paper), startMm: start, endMm: end };
}

export function getPrinterCalibration(deviceName: string | null | undefined): PrinterCalibration | null {
  if (!deviceName?.trim()) return null;
  const stored = readAll()[deviceKey(deviceName)];
  return stored ? normalizePrinterCalibration(stored) : null;
}

export function savePrinterCalibration(deviceName: string, calibration: PrinterCalibration | null): void {
  const all = readAll();
  const key = deviceKey(deviceName);
  if (calibration) all[key] = calibration;
  else delete all[key];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full / private mode: calibration simply not persisted */
  }
}

/** Side padding (mm) that keeps receipt content inside the calibrated printable band. */
export function calibrationPaddingMm(c: PrinterCalibration): { leftMm: number; rightMm: number } {
  return {
    leftMm: Math.max(0, c.startMm + SAFETY_MM),
    rightMm: Math.max(0, c.paperWidthMm - c.endMm + SAFETY_MM),
  };
}

/** Ruler page: ticks every mm, numbers every 5 mm, printed edge to edge with no margins. */
export function buildCalibrationPageHtml(paperWidthMm: number, title: string, hint: string): string {
  const w = Math.round(paperWidthMm);
  const ticks: string[] = [];
  const labels: string[] = [];
  for (let mm = 0; mm <= w; mm += 1) {
    const major = mm % 10 === 0;
    const mid = mm % 5 === 0;
    const h = major ? 6 : mid ? 4 : 2;
    ticks.push(`<i style="left:${mm}mm;height:${h}mm"></i>`);
    if (mid) labels.push(`<b style="left:${mm}mm">${mm}</b>`);
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title><style id="vyntex-page-size">@page{size:${w}mm 46mm;margin:0}</style><style>
    @page { size: ${w}mm 46mm; margin: 0; }
    html, body { margin: 0; padding: 0; width: ${w}mm; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
    .ruler { position: relative; width: ${w}mm; height: 16mm; }
    .ruler i { position: absolute; top: 0; width: 0.25mm; margin-left: -0.125mm; background: #000; }
    .ruler b { position: absolute; top: 7mm; font-size: 7.5px; font-weight: 700; transform: translateX(-50%); }
    .line { width: ${w}mm; border-top: 0.3mm solid #000; }
    .txt { padding: 2mm 0; text-align: center; font-size: 10px; line-height: 1.35; }
    .txt strong { font-size: 12px; }
  </style></head><body>
    <div class="ruler">${ticks.join("")}${labels.join("")}</div>
    <div class="line"></div>
    <div class="txt"><strong>${esc(title)}</strong><br/>${esc(hint)}</div>
  </body></html>`;
}
