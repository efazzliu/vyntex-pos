import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  CalendarClock,
  FileSpreadsheet,
  FileText,
  Mail,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { cn } from "@/lib/utils.ts";
import {
  buildReportHtml,
  downloadExcelReport,
  excelReportBase64,
  isScheduleDue,
  isValidReportEmail,
  localYmd,
  normalizeReportSchedules,
  printPdfReport,
  sendVenueReportEmail,
  weekdayLabel,
  type CustomReportPayload,
  type ReportExportFormat,
  type ReportFrequency,
  type ReportSchedule,
  type ReportSection,
  REPORT_SECTIONS,
} from "@/lib/dashboard-custom-reports.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type EnterpriseCustomReportsProps = {
  licenseKey: string;
  staffId: string;
  staffRole: string;
  venueFallbackName: string;
  fromYmd: string;
  toYmd: string;
  language: "en" | "sq";
  formatPrice: (value: number) => string;
  loading: boolean;
  kpis: {
    totalRevenue: number;
    barRevenue: number;
    kitchenRevenue: number;
    totalOrders: number;
  };
  products: Array<{ name: string; quantity: number; revenue: number }>;
  categories: Array<{ name: string; quantity: number; revenue: number }>;
  staff: Array<{ name: string; orders: number; revenue: number }>;
  payments: { cash: number; card: number; debt: number };
  fiscal: {
    fiscalCount: number;
    fiscalTotal: number;
    nonFiscalCount: number;
    nonFiscalTotal: number;
  };
  orders: Array<{
    orderNumber: number;
    tableName: string;
    staffName: string;
    status: string;
    total: number;
  }>;
  t: Translate;
};

const SECTION_KEYS: Record<ReportSection, string> = {
  summary: "dashboard.reports_section_summary",
  products: "dashboard.reports_section_products",
  categories: "dashboard.reports_section_categories",
  staff: "dashboard.reports_section_staff",
  payments: "dashboard.reports_section_payments",
  fiscal: "dashboard.reports_section_fiscal",
  orders: "dashboard.reports_section_orders",
};

export default function EnterpriseCustomReports({
  licenseKey,
  staffId,
  staffRole,
  venueFallbackName,
  fromYmd,
  toYmd,
  language,
  formatPrice,
  loading,
  kpis,
  products,
  categories,
  staff,
  payments,
  fiscal,
  orders,
  t,
}: EnterpriseCustomReportsProps) {
  const canEdit = staffRole === "admin";
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<ReportSection[]>([
    "summary",
    "products",
    "payments",
  ]);
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<ReportFrequency>("daily");
  const [weekday, setWeekday] = useState(1);
  const [hour, setHour] = useState(8);
  const [format, setFormat] = useState<ReportExportFormat>("excel");
  const [saving, setSaving] = useState(false);
  const sendingRef = useRef(false);
  const sentTodayRef = useRef<Set<string>>(new Set());

  const schedulesQuery = useQuery("pos.dashboard.getReportSchedules", {
    licenseKey,
  });
  const saveSchedules = useMutation("pos.dashboard.saveReportSchedules");
  const markSent = useMutation("pos.dashboard.markReportSchedulesSent");

  const venueName =
    schedulesQuery &&
    typeof schedulesQuery === "object" &&
    "venueName" in schedulesQuery
      ? String(schedulesQuery.venueName || venueFallbackName)
      : venueFallbackName;
  const schedules = useMemo(
    () =>
      normalizeReportSchedules(
        schedulesQuery &&
          typeof schedulesQuery === "object" &&
          "schedules" in schedulesQuery
          ? schedulesQuery.schedules
          : [],
      ),
    [schedulesQuery],
  );

  const buildReport = useCallback(
    (activeSections: ReportSection[]): CustomReportPayload => {
      const sheets: CustomReportPayload["sheets"] = [];
      if (activeSections.includes("summary")) {
        sheets.push({
          title: t("dashboard.reports_sheet_summary"),
          headers: [
            t("dashboard.reports_col_metric"),
            t("dashboard.reports_col_value"),
          ],
          rows: [
            {
              label: t("dashboard.reports_metric_total_revenue"),
              values: [formatPrice(kpis.totalRevenue)],
            },
            {
              label: t("dashboard.reports_metric_bar"),
              values: [formatPrice(kpis.barRevenue)],
            },
            {
              label: t("dashboard.reports_metric_kitchen"),
              values: [formatPrice(kpis.kitchenRevenue)],
            },
            {
              label: t("dashboard.reports_metric_orders"),
              values: [kpis.totalOrders],
            },
          ],
        });
      }
      if (activeSections.includes("products")) {
        sheets.push({
          title: t("dashboard.reports_sheet_products"),
          headers: [
            t("dashboard.reports_col_name"),
            t("dashboard.reports_col_qty"),
            t("dashboard.reports_col_revenue"),
          ],
          rows: products.map((row) => ({
            label: row.name,
            values: [row.quantity, formatPrice(row.revenue)],
          })),
        });
      }
      if (activeSections.includes("categories")) {
        sheets.push({
          title: t("dashboard.reports_sheet_categories"),
          headers: [
            t("dashboard.reports_col_name"),
            t("dashboard.reports_col_qty"),
            t("dashboard.reports_col_revenue"),
          ],
          rows: categories.map((row) => ({
            label: row.name,
            values: [row.quantity, formatPrice(row.revenue)],
          })),
        });
      }
      if (activeSections.includes("staff")) {
        sheets.push({
          title: t("dashboard.reports_sheet_staff"),
          headers: [
            t("dashboard.reports_col_name"),
            t("dashboard.reports_col_orders"),
            t("dashboard.reports_col_revenue"),
          ],
          rows: staff.map((row) => ({
            label: row.name,
            values: [row.orders, formatPrice(row.revenue)],
          })),
        });
      }
      if (activeSections.includes("payments")) {
        sheets.push({
          title: t("dashboard.reports_sheet_payments"),
          headers: [
            t("dashboard.reports_col_metric"),
            t("dashboard.reports_col_value"),
          ],
          rows: [
            {
              label: t("dashboard.reports_metric_cash"),
              values: [formatPrice(payments.cash)],
            },
            {
              label: t("dashboard.reports_metric_card"),
              values: [formatPrice(payments.card)],
            },
            {
              label: t("dashboard.reports_metric_debt"),
              values: [formatPrice(payments.debt)],
            },
          ],
        });
      }
      if (activeSections.includes("fiscal")) {
        sheets.push({
          title: t("dashboard.reports_sheet_fiscal"),
          headers: [
            t("dashboard.reports_col_metric"),
            t("dashboard.reports_col_value"),
          ],
          rows: [
            {
              label: t("dashboard.reports_metric_fiscal"),
              values: [`${fiscal.fiscalCount} · ${formatPrice(fiscal.fiscalTotal)}`],
            },
            {
              label: t("dashboard.reports_metric_non_fiscal"),
              values: [
                `${fiscal.nonFiscalCount} · ${formatPrice(fiscal.nonFiscalTotal)}`,
              ],
            },
          ],
        });
      }
      if (activeSections.includes("orders")) {
        sheets.push({
          title: t("dashboard.reports_sheet_orders"),
          headers: [
            t("dashboard.reports_col_orders"),
            t("dashboard.reports_col_table"),
            t("dashboard.reports_col_staff"),
            t("dashboard.reports_col_status"),
            t("dashboard.reports_col_revenue"),
          ],
          rows: orders.map((row) => ({
            label: `#${row.orderNumber}`,
            values: [
              row.tableName,
              row.staffName,
              row.status,
              formatPrice(row.total),
            ],
          })),
        });
      }
      return {
        venueName,
        fromYmd,
        toYmd,
        generatedAt: new Date().toLocaleString(
          language === "sq" ? "sq-AL" : "en-GB",
        ),
        sheets,
      };
    },
    [
      categories,
      fiscal,
      formatPrice,
      fromYmd,
      kpis,
      language,
      orders,
      payments,
      products,
      staff,
      t,
      toYmd,
      venueName,
    ],
  );

  const persistSchedules = useCallback(
    async (next: ReportSchedule[]) => {
      await saveSchedules({
        licenseKey,
        staffId,
        schedules: next,
      });
    },
    [licenseKey, saveSchedules, staffId],
  );

  const sendReport = useCallback(
    async (target: ReportSchedule, silent = false) => {
      const report = buildReport(target.sections);
      if (report.sheets.length === 0) return;
      const html = buildReportHtml(report);
      const wantsExcel = target.format === "excel" || target.format === "both";
      await sendVenueReportEmail({
        licenseKey,
        to: target.email,
        subject: `${t("dashboard.reports_title")} ${fromYmd}–${toYmd}`,
        html,
        attachment: wantsExcel
          ? {
              filename: `vyntex-report-${fromYmd}-${toYmd}.xls`,
              contentBase64: excelReportBase64(report),
              contentType: "application/vnd.ms-excel",
            }
          : undefined,
      });
      if (!silent) toast.success(t("dashboard.reports_sent"));
    },
    [buildReport, fromYmd, licenseKey, t, toYmd],
  );

  useEffect(() => {
    if (loading || sendingRef.current || schedules.length === 0) return;
    const due = schedules.filter(
      (schedule) =>
        isScheduleDue(schedule) && !sentTodayRef.current.has(schedule.id),
    );
    if (due.length === 0) return;

    sendingRef.current = true;
    void (async () => {
      try {
        const next = [...schedules];
        for (const schedule of due) {
          sentTodayRef.current.add(schedule.id);
          try {
            await sendReport(schedule, true);
            const index = next.findIndex((item) => item.id === schedule.id);
            if (index >= 0) {
              next[index] = { ...next[index], lastSentYmd: localYmd() };
            }
            toast.success(
              t("dashboard.reports_due_sent", { email: schedule.email }),
            );
          } catch {
            toast.error(t("dashboard.reports_send_failed"));
          }
        }
        const sentIds = next
          .filter((item) => item.lastSentYmd === localYmd())
          .map((item) => item.id);
        if (sentIds.length > 0) {
          await markSent({ licenseKey, sentIds });
        }
      } finally {
        sendingRef.current = false;
      }
    })();
  }, [licenseKey, loading, markSent, schedules, sendReport, t]);

  const toggleSection = (section: ReportSection) => {
    setSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  };

  const exportExcel = () => {
    if (sections.length === 0) {
      toast.error(t("dashboard.reports_need_section"));
      return;
    }
    try {
      downloadExcelReport(buildReport(sections));
      toast.success(t("dashboard.reports_exported"));
    } catch {
      toast.error(t("dashboard.reports_export_failed"));
    }
  };

  const exportPdf = () => {
    if (sections.length === 0) {
      toast.error(t("dashboard.reports_need_section"));
      return;
    }
    try {
      printPdfReport(buildReport(sections));
      toast.success(t("dashboard.reports_pdf_ready"));
    } catch {
      toast.error(t("dashboard.reports_export_failed"));
    }
  };

  const addSchedule = async () => {
    if (!canEdit) {
      toast.error(t("dashboard.reports_admin_only"));
      return;
    }
    if (!isValidReportEmail(email)) {
      toast.error(t("dashboard.reports_invalid_email"));
      return;
    }
    if (sections.length === 0) {
      toast.error(t("dashboard.reports_need_section"));
      return;
    }
    setSaving(true);
    try {
      await persistSchedules([
        ...schedules,
        {
          id: crypto.randomUUID(),
          email: email.trim().toLowerCase(),
          frequency,
          weekday,
          hour,
          format,
          sections,
          enabled: true,
          lastSentYmd: null,
        },
      ]);
      setEmail("");
      toast.success(t("dashboard.reports_save_schedule"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("ensure_dashboard_report_schedules")
          ? t("dashboard.reports_sql_missing")
          : t("dashboard.reports_send_failed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const removeSchedule = async (id: string) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await persistSchedules(schedules.filter((item) => item.id !== id));
    } finally {
      setSaving(false);
    }
  };

  const localeTag = language === "sq" ? "sq-AL" : "en-GB";
  const formatRangeDay = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12).toLocaleDateString(
      localeTag,
      { day: "numeric", month: "short", year: "numeric" },
    );
  };
  const fieldClass =
    "h-11 w-full rounded-2xl border border-slate-200/80 bg-[#f7f9fc] px-3.5 text-[13px] font-medium text-slate-800 outline-none transition focus:border-brand-sky/50 focus:bg-white focus:ring-4 focus:ring-brand-sky/10";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("dashboard.reports_title")}
        className="group relative grid size-12 shrink-0 place-items-center rounded-2xl border border-white bg-white/95 text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-16px_rgba(15,23,42,0.28)] outline-none ring-1 ring-slate-200/70 transition hover:-translate-y-px hover:text-teal-700 hover:ring-teal-200/90 focus-visible:ring-2 focus-visible:ring-teal-500/35"
      >
        <FileSpreadsheet className="size-4" strokeWidth={2.15} />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 border-slate-200/80 bg-[#f4f7fb] p-0 text-slate-900 sm:max-w-[440px] [&>button:last-of-type]:rounded-full [&>button:last-of-type]:bg-white/15 [&>button:last-of-type]:text-white [&>button:last-of-type]:ring-1 [&>button:last-of-type]:ring-white/25"
        >
          <SheetHeader className="relative shrink-0 overflow-hidden px-5 pb-5 pt-5 pr-14 text-left text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand-sky to-brand-accent" />
            <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full border-[20px] border-white/10" />
            <div className="pointer-events-none absolute -bottom-10 right-10 size-24 rounded-full bg-white/10 blur-2xl" />
            <SheetTitle className="relative flex items-center gap-3 text-[20px] font-extrabold tracking-[-0.04em] text-white">
              <span className="grid size-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur-sm">
                <CalendarClock className="size-5" />
              </span>
              {t("dashboard.reports_title")}
            </SheetTitle>
            <SheetDescription className="relative mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/85">
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium ring-1 ring-white/15">
                {formatRangeDay(fromYmd)}
                {fromYmd !== toYmd ? ` → ${formatRangeDay(toYmd)}` : ""}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium ring-1 ring-white/15">
                {t("dashboard.reports_included", { count: sections.length })}
              </span>
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <section className="rounded-[1.35rem] border border-white bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-28px_rgba(15,23,42,0.35)]">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    {t("dashboard.reports_sections")}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {t("dashboard.reports_subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REPORT_SECTIONS.map((section) => {
                  const active = sections.includes(section);
                  return (
                    <button
                      key={section}
                      type="button"
                      onClick={() => toggleSection(section)}
                      className={cn(
                        "h-8 rounded-full px-3 text-[11px] font-semibold transition",
                        active
                          ? "bg-slate-950 text-[#ffffff] shadow-[0_8px_16px_-10px_rgba(15,23,42,0.7)]"
                          : "bg-[#f4f7fb] text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                      )}
                    >
                      {t(SECTION_KEYS[section])}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={exportExcel}
                className="group rounded-[1.35rem] border border-white bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5"
              >
                <span className="grid size-10 place-items-center rounded-2xl bg-brand/10 text-brand">
                  <FileSpreadsheet className="size-4" />
                </span>
                <p className="mt-3 text-[13px] font-bold tracking-[-0.02em] text-slate-950">
                  {t("dashboard.reports_export_excel")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {t("dashboard.reports_export_excel_hint")}
                </p>
              </button>
              <button
                type="button"
                onClick={exportPdf}
                className="group rounded-[1.35rem] border border-white bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-28px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5"
              >
                <span className="grid size-10 place-items-center rounded-2xl bg-brand-accent/12 text-[#2f9d00]">
                  <FileText className="size-4" />
                </span>
                <p className="mt-3 text-[13px] font-bold tracking-[-0.02em] text-slate-950">
                  {t("dashboard.reports_export_pdf")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {t("dashboard.reports_export_pdf_hint")}
                </p>
              </button>
            </section>

            <section className="rounded-[1.35rem] border border-white bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-28px_rgba(15,23,42,0.35)]">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-sky/10 text-[#0891b2]">
                  <Mail className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold tracking-[-0.02em] text-slate-950">
                    {t("dashboard.reports_schedule")}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    {canEdit
                      ? t("dashboard.reports_schedule_hint")
                      : t("dashboard.reports_admin_only")}
                  </p>
                </div>
              </div>

              {canEdit ? (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {t("dashboard.reports_email")}
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@venue.com"
                      className={fieldClass}
                    />
                  </label>
                  <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#f4f7fb] p-1">
                    {(["daily", "weekly", "monthly"] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setFrequency(item)}
                        className={cn(
                          "h-9 rounded-xl text-[11px] font-semibold transition",
                          frequency === item
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500 hover:text-slate-800",
                        )}
                      >
                        {t(`dashboard.reports_${item}`)}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        {t("dashboard.reports_hour")}
                      </span>
                      <select
                        value={hour}
                        onChange={(event) => setHour(Number(event.target.value))}
                        className={fieldClass}
                      >
                        {Array.from({ length: 24 }, (_, index) => (
                          <option key={index} value={index}>
                            {String(index).padStart(2, "0")}:00
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        {t("dashboard.reports_format")}
                      </span>
                      <select
                        value={format}
                        onChange={(event) =>
                          setFormat(event.target.value as ReportExportFormat)
                        }
                        className={fieldClass}
                      >
                        <option value="excel">{t("dashboard.reports_format_excel")}</option>
                        <option value="pdf">{t("dashboard.reports_format_pdf")}</option>
                        <option value="both">{t("dashboard.reports_format_both")}</option>
                      </select>
                    </label>
                  </div>
                  {frequency === "weekly" ? (
                    <label className="block">
                      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        {t("dashboard.reports_weekday")}
                      </span>
                      <select
                        value={weekday}
                        onChange={(event) => setWeekday(Number(event.target.value))}
                        className={fieldClass}
                      >
                        {Array.from({ length: 7 }, (_, index) => (
                          <option key={index + 1} value={index + 1}>
                            {weekdayLabel(index + 1, language)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void addSchedule()}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-[12px] font-bold text-[#ffffff] shadow-[0_12px_24px_-14px_rgba(15,23,42,0.9)] transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Plus className="size-4" />
                    {t("dashboard.reports_add_schedule")}
                  </button>
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {schedules.length === 0 ? (
                  <div className="rounded-2xl bg-[#f4f7fb] px-4 py-6 text-center">
                    <p className="text-[13px] font-semibold text-slate-700">
                      {t("dashboard.reports_empty")}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {t("dashboard.reports_schedule_hint")}
                    </p>
                  </div>
                ) : (
                  schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-[#f7f9fc] px-3 py-2.5"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#0891b2] shadow-sm">
                        <Mail className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-slate-800">
                          {schedule.email}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {t(`dashboard.reports_${schedule.frequency}`)} ·{" "}
                          {String(schedule.hour).padStart(2, "0")}:00
                          {schedule.frequency === "weekly"
                            ? ` · ${weekdayLabel(schedule.weekday, language)}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void sendReport(schedule).catch(() =>
                            toast.error(t("dashboard.reports_send_failed")),
                          )
                        }
                        className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900"
                        aria-label={t("dashboard.reports_send_now")}
                      >
                        <Send className="size-3.5" />
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => void removeSchedule(schedule.id)}
                          className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600"
                          aria-label={t("dashboard.reports_delete")}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
