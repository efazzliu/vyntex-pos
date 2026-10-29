/** Shared thermal-paper Design from Template Manager (`styles._design`). */

export type PrintDesign = {
  paperWidth: "58" | "80" | "custom";
  customWidth: string;
  font: "default" | "mono" | "sans";
  fontSize: number;
  align: "left" | "center" | "right";
  lineHeight: number;
  sectionSpacing: "tight" | "normal" | "loose";
  margin: "tight" | "normal" | "loose";
  dividerStyle: "dashed" | "dotted" | "solid" | "none";
  lineThickness: "thin" | "normal" | "thick";
  qrSize: "small" | "medium" | "large";
};

export const DEFAULT_PRINT_DESIGN: PrintDesign = {
  paperWidth: "80",
  customWidth: "80",
  font: "default",
  fontSize: 12,
  align: "center",
  lineHeight: 1.2,
  sectionSpacing: "normal",
  margin: "normal",
  dividerStyle: "dashed",
  lineThickness: "normal",
  qrSize: "medium",
};

const FONT_MIN = 8;
const FONT_MAX = 24;
const MM_MIN = 48;
const MM_MAX = 110;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function unwrapDesignSource(source?: unknown): Record<string, unknown> {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const rec = source as Record<string, unknown>;
  if (rec._design && typeof rec._design === "object" && !Array.isArray(rec._design)) {
    return rec._design as Record<string, unknown>;
  }
  return rec;
}

export function readPrintDesign(source?: unknown): PrintDesign {
  const o = unwrapDesignSource(source);
  const fontSize = num(o.fontSize, DEFAULT_PRINT_DESIGN.fontSize);
  const lineHeight = num(o.lineHeight, DEFAULT_PRINT_DESIGN.lineHeight);
  return {
    paperWidth: pick(o.paperWidth, ["58", "80", "custom"] as const, "80"),
    customWidth: typeof o.customWidth === "string" ? o.customWidth : "80",
    font: pick(o.font, ["default", "mono", "sans"] as const, "default"),
    fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(fontSize))),
    align: pick(o.align, ["left", "center", "right"] as const, "center"),
    lineHeight: Math.min(2, Math.max(0.9, lineHeight)),
    sectionSpacing: pick(o.sectionSpacing, ["tight", "normal", "loose"] as const, "normal"),
    margin: pick(o.margin, ["tight", "normal", "loose"] as const, "normal"),
    dividerStyle: pick(o.dividerStyle, ["dashed", "dotted", "solid", "none"] as const, "dashed"),
    lineThickness: pick(o.lineThickness, ["thin", "normal", "thick"] as const, "normal"),
    qrSize: pick(o.qrSize, ["small", "medium", "large"] as const, "medium"),
  };
}

export function paperWidthMm(design: PrintDesign): number {
  if (design.paperWidth === "58") return 58;
  if (design.paperWidth === "80") return 80;
  const n = Number(design.customWidth);
  if (!Number.isFinite(n)) return 80;
  return Math.min(MM_MAX, Math.max(MM_MIN, Math.round(n)));
}

export function printFontFamily(design: PrintDesign): string {
  if (design.font === "mono") {
    return 'ui-monospace, "Geist Mono", "Courier New", monospace';
  }
  if (design.font === "sans") {
    return "ui-sans-serif, system-ui, sans-serif";
  }
  return '"Helvetica Neue", Helvetica, Arial, sans-serif';
}

function dashWidth(design: PrintDesign): string {
  if (design.lineThickness === "thin") return "1px";
  if (design.lineThickness === "thick") return "2px";
  return "1.5px";
}

function sectionPx(design: PrintDesign): string {
  if (design.sectionSpacing === "tight") return "6px";
  if (design.sectionSpacing === "loose") return "20px";
  return "12px";
}

function marginPx(design: PrintDesign): string {
  if (design.margin === "tight") return "6px";
  if (design.margin === "loose") return "18px";
  return "12px";
}

function justify(align: PrintDesign["align"]): string {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

function logoMargin(align: PrintDesign["align"]): string {
  if (align === "left") return "0 auto 8px 0";
  if (align === "right") return "0 0 8px auto";
  return "0 auto 8px";
}

/** Page height used until the print pipeline measures the real receipt (see `print-page.ts`). */
export const FALLBACK_PAGE_HEIGHT_MM = 297;

/** Physical page width in mm for the selected paper (receipts are always portrait). */
export function printPageWidthMm(design: PrintDesign): number {
  return paperWidthMm(design);
}

/** CSS appended at the end of each ticket stylesheet so Design wins over hardcoded 80mm/center. */
export function printDesignCss(source?: unknown): string {
  const d = readPrintDesign(source);
  const pageMm = printPageWidthMm(d);
  const width = `${pageMm}mm`;
  const dashStyle = d.dividerStyle === "none" ? "none" : d.dividerStyle;
  return `
    :root {
      --print-align: ${d.align};
      --print-justify: ${justify(d.align)};
      --print-font: ${printFontFamily(d)};
      --print-size: ${d.fontSize}px;
      --print-lh: ${d.lineHeight};
      --print-width: ${width};
      --print-dash-style: ${dashStyle};
      --print-dash-width: ${d.dividerStyle === "none" ? "0" : dashWidth(d)};
      --print-section: ${sectionPx(d)};
      --print-margin: ${marginPx(d)};
    }
    @page { size: ${pageMm}mm ${FALLBACK_PAGE_HEIGHT_MM}mm; margin: 0; }
    html { margin: 0 !important; padding: 0 !important; background: #fff; }
    body {
      box-sizing: border-box !important;
      width: auto !important;
      max-width: none !important;
      margin: 0 !important;
      font-family: var(--print-font) !important;
      font-size: var(--print-size) !important;
      line-height: var(--print-lh) !important;
      text-align: var(--print-align);
      padding: var(--print-margin) !important;
      overflow-wrap: break-word;
    }
    body:has(> .sheet), body:has(> .wrap) { padding: 0 !important; }
    .sheet, .wrap {
      box-sizing: border-box !important;
      width: 100% !important;
      max-width: 100% !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding: var(--print-margin) !important;
    }
    .dash, hr.dash {
      border: none !important;
      border-top: var(--print-dash-width) var(--print-dash-style) #bbb !important;
      margin: var(--print-section) 0 !important;
    }
    .border-b, .sec {
      border-bottom-style: var(--print-dash-style) !important;
      border-bottom-width: var(--print-dash-width) !important;
    }
    .border-top {
      border-top-style: var(--print-dash-style) !important;
      border-top-width: var(--print-dash-width) !important;
    }
    .gap { height: var(--print-section) !important; }
    .title, .sub, .store, .venue, .notice, .footer, .powered, .doc-title, .doc-sub,
    .legal, .thanks, .tag, .head, .foot, .ho, .ho-lab, .brand, .contact, .items-h, .table {
      text-align: var(--print-align) !important;
    }
    .brand-row { justify-content: var(--print-justify) !important; }
    img.logo, .logo {
      display: block;
      margin: ${logoMargin(d.align)} !important;
    }
    .badge { margin-left: ${d.align === "left" ? "0" : "auto"}; margin-right: ${d.align === "right" ? "0" : "auto"}; }
    ${pageMm <= 60 ? NARROW_TABLE_CSS : ""}
  `;
}

/**
 * 58 mm heads print ~48 mm and the head's dead zones already act as margins: tighten side
 * padding and table gutters (not font sizes) so 4 columns and the totals block fit.
 * Also applied by printer calibration when a narrow printer receives a wider template.
 */
export const NARROW_TABLE_CSS = `
    body, .sheet, .wrap { padding-left: 4px !important; padding-right: 4px !important; }
    body:has(> .sheet), body:has(> .wrap) { padding-left: 0 !important; padding-right: 0 !important; }
    table th { letter-spacing: 0.04em !important; }
    table th, table td { padding-left: 2px !important; padding-right: 2px !important; }
    table th:first-child, table td:first-child { padding-left: 0 !important; }
    table th:last-child, table td:last-child { padding-right: 0 !important; }
    .totals { width: 100% !important; margin-left: 0 !important; }
    .t-row { gap: 8px !important; }
`;

/** Inline body CSS for builders that do not use a shared stylesheet (fiscal). */
export function printDesignInlineBody(source?: unknown): string {
  const d = readPrintDesign(source);
  return [
    `font-family:${printFontFamily(d)}`,
    `font-size:${d.fontSize}px`,
    `line-height:${d.lineHeight}`,
    `text-align:${d.align}`,
    `color:#111`,
    `margin:0`,
    `padding:${marginPx(d)}`,
    `background:#fff`,
  ].join(";");
}

export function printDesignDividerInline(source?: unknown): string {
  const d = readPrintDesign(source);
  const gap = sectionPx(d);
  if (d.dividerStyle === "none") {
    return `margin:${gap} 0;padding-bottom:8px;`;
  }
  return `border-bottom:${dashWidth(d)} ${d.dividerStyle} #999;margin:${gap} 0;padding-bottom:8px;`;
}
