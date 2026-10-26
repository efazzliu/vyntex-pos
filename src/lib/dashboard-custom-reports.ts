import { printHtmlDocument } from "@/lib/print-html.ts";
import { supabase } from "@/lib/supabase.ts";

export const REPORT_SECTIONS = [
  "summary",
  "products",
  "categories",
  "staff",
  "payments",
  "fiscal",
  "orders",
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];
export type ReportFrequency = "daily" | "weekly" | "monthly";
export type ReportExportFormat = "excel" | "pdf" | "both";

export type ReportSchedule = {
  id: string;
  email: string;
  frequency: ReportFrequency;
  weekday: number;
  hour: number;
  format: ReportExportFormat;
  sections: ReportSection[];
  enabled: boolean;
  lastSentYmd: string | null;
};

export type ReportRow = {
  label: string;
  values: Array<string | number>;
};

export type ReportSheet = {
  title: string;
  headers: string[];
  rows: ReportRow[];
};

export type CustomReportPayload = {
  venueName: string;
  fromYmd: string;
  toYmd: string;
  generatedAt: string;
  sheets: ReportSheet[];
};

const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export function isReportSection(value: string): value is ReportSection {
  return (REPORT_SECTIONS as readonly string[]).includes(value);
}

export function normalizeReportSchedules(raw: unknown): ReportSchedule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeReportSchedule(item))
    .filter((item): item is ReportSchedule => item !== null);
}

function normalizeReportSchedule(raw: unknown): ReportSchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const email = String(row.email ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return null;
  const frequency =
    row.frequency === "weekly" || row.frequency === "monthly"
      ? row.frequency
      : "daily";
  const weekday = clampInt(row.weekday, 1, 7, 1);
  const hour = clampInt(row.hour, 0, 23, 8);
  const format =
    row.format === "pdf" || row.format === "both" ? row.format : "excel";
  const sections = Array.isArray(row.sections)
    ? row.sections
        .map((section) => String(section))
        .filter(isReportSection)
    : [...REPORT_SECTIONS];
  if (sections.length === 0) return null;
  return {
    id: String(row.id ?? crypto.randomUUID()),
    email,
    frequency,
    weekday,
    hour,
    format,
    sections,
    enabled: row.enabled !== false,
    lastSentYmd:
      typeof row.lastSentYmd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.lastSentYmd)
        ? row.lastSentYmd
        : null,
  };
}

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const next = Math.round(Number(value));
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

export function isValidReportEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function localYmd(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isScheduleDue(
  schedule: ReportSchedule,
  now = new Date(),
): boolean {
  if (!schedule.enabled) return false;
  const today = localYmd(now);
  if (schedule.lastSentYmd === today) return false;
  if (now.getHours() < schedule.hour) return false;
  if (schedule.frequency === "weekly") {
    const mondayBased = now.getDay() === 0 ? 7 : now.getDay();
    return mondayBased === schedule.weekday;
  }
  if (schedule.frequency === "monthly") {
    return now.getDate() === 1;
  }
  return true;
}

export function weekdayLabel(weekday: number, language: "en" | "sq"): string {
  const en = WEEKDAYS_EN[weekday - 1] ?? "Mo";
  if (language === "sq") {
    return (["Hë", "Ma", "Më", "En", "Pr", "Sh", "Di"] as const)[weekday - 1] ?? "Hë";
  }
  return en;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellXml(value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(String(value))}</Data></Cell>`;
}

export function buildExcelXml(report: CustomReportPayload): string {
  const worksheets = report.sheets
    .map((sheet) => {
      const header = `<Row>${sheet.headers.map((header) => cellXml(header)).join("")}</Row>`;
      const rows = sheet.rows
        .map((row) => `<Row>${cellXml(row.label)}${row.values.map(cellXml).join("")}</Row>`)
        .join("");
      const name = xmlEscape(sheet.title.slice(0, 31) || "Report");
      return `<Worksheet ss:Name="${name}"><Table>${header}${rows}</Table></Worksheet>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${xmlEscape(report.venueName)}</Title>
  </DocumentProperties>
  ${worksheets}
</Workbook>`;
}

export function downloadExcelReport(report: CustomReportPayload): void {
  const xml = buildExcelXml(report);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vyntex-report-${report.fromYmd}-${report.toYmd}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function excelReportBase64(report: CustomReportPayload): string {
  const xml = buildExcelXml(report);
  return btoa(unescape(encodeURIComponent(xml)));
}

export function buildReportHtml(report: CustomReportPayload): string {
  const sheets = report.sheets
    .map((sheet) => {
      const head = sheet.headers
        .map((header) => `<th>${escapeHtml(header)}</th>`)
        .join("");
      const body = sheet.rows
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.label)}</td>${row.values
              .map((value) => `<td>${escapeHtml(String(value))}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      return `<h2>${escapeHtml(sheet.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.venueName)} — Report</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #0f172a; padding: 28px; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    p { color: #64748b; margin: 0 0 20px; font-size: 13px; }
    h2 { font-size: 15px; margin: 22px 0 8px; color: #005BD6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 12px; }
    th { background: #f8fafc; color: #475569; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.venueName)}</h1>
  <p>${escapeHtml(report.fromYmd)} → ${escapeHtml(report.toYmd)} · ${escapeHtml(report.generatedAt)}</p>
  ${sheets}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printPdfReport(report: CustomReportPayload): void {
  printHtmlDocument(buildReportHtml(report));
}

export async function sendVenueReportEmail(args: {
  licenseKey: string;
  to: string;
  subject: string;
  html: string;
  attachment?: {
    filename: string;
    contentBase64: string;
    contentType: string;
  };
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-venue-report", {
    body: args,
  });
  if (error) {
    throw new Error(error.message || "Could not send the report email.");
  }
  const payload = data as { error?: string } | null;
  if (payload?.error) {
    throw new Error(payload.error);
  }
}
