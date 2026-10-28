/** Shared thermal-paper Design from Template Manager (`styles._design`). */

export type PrintDesign = {
  paperWidth: "58" | "80" | "custom";
  customWidth: string;
  orientation: "portrait" | "landscape";
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
  orientation: "portrait",
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
    orientation: pick(o.orientation, ["portrait", "landscape"] as const, "portrait"),
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

/** CSS appended at the end of each ticket stylesheet so Design wins over hardcoded 80mm/center. */
export function printDesignCss(source?: unknown): string {
  const d = readPrintDesign(source);
  const mm = paperWidthMm(d);
  const width = d.orientation === "landscape" ? `${Math.round(mm * 1.18)}mm` : `${mm}mm`;
  const dashStyle = d.dividerStyle === "none" ? "none" : d.dividerStyle;
  // Tall default page: Chromium often ignores `auto` height and clips to Letter.
  // Electron/dialog paths overwrite with a measured @page before printing.
  const page =
    d.orientation === "landscape"
      ? "landscape"
      : `${mm}mm 2000mm`;
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
    @page { size: ${page}; margin: 0; }
    html, body {
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    body {
      font-family: var(--print-font) !important;
      font-size: var(--print-size) !important;
      line-height: var(--print-lh) !important;
      text-align: var(--print-align);
      padding: var(--print-margin) !important;
      width: var(--print-width) !important;
      max-width: var(--print-width) !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
    }
    .sheet, .wrap {
      width: 100% !important;
      max-width: var(--print-width) !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding: var(--print-margin) !important;
      overflow: visible !important;
      page-break-inside: auto;
      break-inside: auto;
    }
    @media print {
      html, body {
        height: auto !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
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
  `;
}

/** Inline body CSS for builders that do not use a shared stylesheet (fiscal). */
export function printDesignInlineBody(source?: unknown): string {
  const d = readPrintDesign(source);
  const mm = paperWidthMm(d);
  const width = d.orientation === "landscape" ? Math.round(mm * 1.18) : mm;
  return [
    `font-family:${printFontFamily(d)}`,
    `font-size:${d.fontSize}px`,
    `line-height:${d.lineHeight}`,
    `text-align:${d.align}`,
    `color:#111`,
    `max-width:${width}mm`,
    `margin:0 auto`,
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
