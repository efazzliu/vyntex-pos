import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Banknote,
  Calendar,
  ChartColumn,
  ClipboardCheck,
  FileText,
  Layers,
  Utensils,
  LogOut,
  Printer,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  History,
  ArrowLeft,
  ChefHat,
  Wine,
  CreditCard,
  HandCoins,
  Gift,
  Trash2,
  Ban,
  Wallet,
  ArrowDown,
  Clock,
  Users,
  Receipt,
} from "lucide-react";
import { format, isSameDay, isYesterday, type Locale } from "date-fns";
import { enUS, sq as sqLocale } from "date-fns/locale";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import {
  hashString,
  verifyPin,
  verifyLocalStaffPin,
  getDataCache,
  clearStaffOpenShiftLocal,
  clearAllOpenShiftsLocal,
} from "@/lib/local-db.ts";
import { verifyAdminPin } from "@/lib/supabase-pos.ts";
import { uuidOrNull } from "@/lib/supabase-pos/uuid.ts";
import {
  printWaiterShiftReport,
  type WaiterShiftTemplateToggles,
} from "@/lib/print-waiter-shift-report.ts";
import { loadPaperPrintDeviceName } from "@/lib/pos-print-device.ts";
import {
  printXReportNow,
  printZReportNow,
  xTotalsFromLiveReport,
  zTotalsFromLiveReport,
} from "@/lib/print-live-papers.ts";
import {
  isSilentPrintQueueableError,
  type PrintHtmlAsyncOutcome,
} from "@/lib/print-html.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import {
  STAFF_PIN_MAX_LEN,
  STAFF_PIN_MIN_LEN,
  isValidStaffPinLength,
  sanitizeStaffPinInput,
} from "../_lib/staff-pin.ts";

function lastXPrintKey(licenseKey: string) {
  return `pos-last-x-print:${licenseKey}`;
}

function readLastXPrint(licenseKey: string): string | null {
  try {
    const value = localStorage.getItem(lastXPrintKey(licenseKey));
    return value && !Number.isNaN(Date.parse(value)) ? value : null;
  } catch {
    return null;
  }
}

function writeLastXPrint(licenseKey: string, iso: string) {
  try {
    localStorage.setItem(lastXPrintKey(licenseKey), iso);
  } catch {
    /* ignore private-mode storage */
  }
}

async function printReportPaper(
  run: () => Promise<PrintHtmlAsyncOutcome>,
  failMessage: string,
) {
  try {
    const printed = await run();
    if (!printed.ok) {
      const electronApp = Boolean(
        typeof window !== "undefined" &&
          (window as Window & { desktop?: { isElectron?: boolean } }).desktop
            ?.isElectron,
      );
      const queued = electronApp && isSilentPrintQueueableError(printed.error);
      if (!queued) toast.error(failMessage);
      return false;
    }
    return true;
  } catch {
    toast.error(failMessage);
    return false;
  }
}

function reportMomentLabel(
  iso: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  locale: Locale,
) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  if (isSameDay(date, new Date())) return format(date, "HH:mm");
  if (isYesterday(date)) return t("zreport.yesterday");
  return format(date, "d MMM yyyy", { locale });
}

function queryEntries<T>(query: unknown): T[] {
  if (!query || typeof query !== "object" || !("entries" in query)) return [];
  const entries = (query as { entries: unknown }).entries;
  return Array.isArray(entries) ? (entries as T[]) : [];
}

function queryTotal(query: unknown): number | null {
  if (query === undefined) return null;
  if (!query || typeof query !== "object" || !("total" in query)) return 0;
  const total = Number((query as { total: unknown }).total);
  return Number.isFinite(total) ? total : 0;
}

function posStaffRoleLabel(role: string, t: (k: string) => string): string {
  const key = `staff.role_${role}`;
  const out = t(key);
  return out === key ? role : out;
}

function waiterExpenseLines(
  data:
    | {
        entries?: Array<{ note?: string; amount: number }>;
        expenses?: Array<{ note?: string; amount: number }>;
      }
    | null
    | undefined,
): Array<{ note: string; amount: number }> {
  if (!data) return [];
  const list = Array.isArray(data.entries)
    ? data.entries
    : Array.isArray(data.expenses)
      ? data.expenses
      : [];
  return list.map((e) => ({ note: e.note ?? "—", amount: e.amount }));
}

type ZReportProps = {
  licenseKey: string;
  staffId: string;
  staffName: string;
};

type ViewMode = "live" | "history" | "history-detail";

export default function ZReport({
  licenseKey,
  staffId,
  staffName,
}: ZReportProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [selectedReportIdx, setSelectedReportIdx] = useState<number | null>(
    null
  );

  if (viewMode === "history") {
    return (
      <ZReportHistory
        licenseKey={licenseKey}
        staffId={staffId}
        onBack={() => setViewMode("live")}
        onSelectReport={(idx) => {
          setSelectedReportIdx(idx);
          setViewMode("history-detail");
        }}
      />
    );
  }

  if (viewMode === "history-detail" && selectedReportIdx !== null) {
    return (
      <ZReportHistoryDetail
        licenseKey={licenseKey}
        staffId={staffId}
        reportIndex={selectedReportIdx}
        onBack={() => setViewMode("history")}
      />
    );
  }

  return (
    <LiveZReport
      licenseKey={licenseKey}
      staffId={staffId}
      staffName={staffName}
      onShowHistory={() => setViewMode("history")}
    />
  );
}

// ── Live Z-Report ─────────────────────────────────────

function LiveZReport({
  licenseKey,
  staffId,
  staffName,
  onShowHistory,
}: {
  licenseKey: string;
  staffId: string;
  staffName: string;
  onShowHistory: () => void;
}) {
  const { t, formatPrice, language } = usePosLocale();
  const dateLocale = language === "sq" ? sqLocale : enUS;
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [selectedShiftForClose, setSelectedShiftForClose] = useState<
    ReportData["shiftDetails"][0] | null
  >(null);
  const [dayClosed, setDayClosed] = useState(false);
  const [printingX, setPrintingX] = useState(false);
  const [lastXPrint, setLastXPrint] = useState<string | null>(() =>
    readLastXPrint(licenseKey),
  );

  const reportQuery = useQuery('pos.dashboard.getZReport', { licenseKey, staffId });
  const expensesQuery = useQuery("pos.expenses.getAllUnclearedExpenses", { licenseKey });
  const consumptionQuery = useQuery("pos.staffConsumption.getAllUnclearedConsumption", {
    licenseKey,
  });
  const historyQuery = useQuery("pos.dashboard.getZReportHistory", {
    licenseKey,
    staffId,
  });
  const report =
    reportQuery &&
    typeof reportQuery === "object" &&
    !Array.isArray(reportQuery) &&
    "restaurantName" in reportQuery
      ? reportQuery
      : {
          zNumber: 1,
          restaurantName: "Restaurant POS",
          date: new Date().toISOString(),
          shiftStart: new Date().toISOString(),
          shiftEnd: new Date().toISOString(),
          shiftDetails: [],
          staffBreakdown: [],
          barRevenue: 0,
          kitchenRevenue: 0,
          grossRevenue: 0,
          cashTotal: 0,
          cardTotal: 0,
          debtTotal: 0,
          complimentaryTotal: 0,
          wasteTotal: 0,
          voidsTotal: 0,
          totalToHandOver: 0,
          paidOrders: 0,
          totalOrders: 0,
          cancelledOrders: 0,
          voidedCount: 0,
        };

  const activeShifts = report.shiftDetails.filter((s) => s.clockOut === null);

  const normStaffKey = (id: string | undefined) =>
    id ? id.trim().toLowerCase() : "";

  const breakdownFor = (shift: ReportData["shiftDetails"][0]) => {
    const byId = normStaffKey(shift.staffId);
    if (byId) {
      const row = report.staffBreakdown.find(
        (s) => normStaffKey(s.staffId) === byId,
      );
      if (row) return row;
    }
    return report.staffBreakdown.find((s) => s.name === shift.staffName);
  };

  const expenseRows = queryEntries<{
    staffId?: string;
    staffName?: string;
    amount?: number;
  }>(expensesQuery);
  const consumptionRows = queryEntries<{ staffId?: string; total?: number }>(
    consumptionQuery,
  );
  const expenseById: Record<string, number> = {};
  const expenseByName: Record<string, number> = {};
  for (const row of expenseRows) {
    const amount = Number(row.amount ?? 0);
    const id = normStaffKey(row.staffId);
    if (id) expenseById[id] = (expenseById[id] ?? 0) + amount;
    const name = row.staffName?.trim();
    if (name) expenseByName[name] = (expenseByName[name] ?? 0) + amount;
  }
  const consumptionById: Record<string, number> = {};
  for (const row of consumptionRows) {
    const id = normStaffKey(row.staffId);
    if (!id) continue;
    consumptionById[id] = (consumptionById[id] ?? 0) + Number(row.total ?? 0);
  }
  const expenseFor = (shift: ReportData["shiftDetails"][0]) => {
    const id = normStaffKey(shift.staffId);
    if (id && expenseById[id] != null) return expenseById[id];
    return expenseByName[shift.staffName] ?? 0;
  };
  const consumptionFor = (shift: ReportData["shiftDetails"][0]) => {
    const id = normStaffKey(shift.staffId);
    return id ? (consumptionById[id] ?? 0) : 0;
  };

  const history = Array.isArray(historyQuery)
    ? (historyQuery as Array<{ createdAt?: string }>)
    : [];
  const latestZ = history.find((row) => typeof row.createdAt === "string");
  const todayLabel = format(new Date(), "d MMM yyyy", { locale: dateLocale });
  const cashTotal = Number(
    (report as { cashTotal?: number }).cashTotal ??
      report.staffBreakdown.reduce((sum, row) => sum + Number(row.paidCash ?? 0), 0),
  );
  const cardTotal = Number(report.cardTotal ?? 0);
  const debtTotal = Number(report.debtTotal ?? 0);
  const freeTotal = Number(report.complimentaryTotal ?? 0);
  const salesTotal =
    Math.round((cashTotal + cardTotal + debtTotal + freeTotal) * 100) / 100;
  const expenseTotal = queryTotal(expensesQuery);
  const consumptionTotal = queryTotal(consumptionQuery);
  const summaryTiles: Array<{
    key: string;
    icon: typeof Layers;
    label: string;
    value: string;
    tone: "plain" | "expense" | "consumption";
  }> = [
    {
      key: "sales",
      icon: Layers,
      label: t("zreport.summary_sales"),
      value: formatPrice(salesTotal),
      tone: "plain",
    },
    {
      key: "cash",
      icon: Banknote,
      label: t("zreport.col_cash"),
      value: formatPrice(cashTotal),
      tone: "plain",
    },
    {
      key: "card",
      icon: CreditCard,
      label: t("zreport.col_card"),
      value: formatPrice(cardTotal),
      tone: "plain",
    },
    {
      key: "debt",
      icon: HandCoins,
      label: t("zreport.col_debt"),
      value: formatPrice(debtTotal),
      tone: "plain",
    },
    {
      key: "free",
      icon: Gift,
      label: t("zreport.col_free"),
      value: formatPrice(freeTotal),
      tone: "plain",
    },
    {
      key: "expense",
      icon: Receipt,
      label: t("zreport.col_expense"),
      value: expenseTotal == null ? "—" : formatPrice(expenseTotal),
      tone: "expense",
    },
    {
      key: "consumption",
      icon: Utensils,
      label: t("zreport.col_consumption"),
      value: consumptionTotal == null ? "—" : formatPrice(consumptionTotal),
      tone: "consumption",
    },
  ];

  const openCloseShift = (shift: ReportData["shiftDetails"][0] | null) => {
    if (!shift) {
      if (activeShifts.length === 1) {
        setSelectedShiftForClose(activeShifts[0]);
        setShowCloseDialog(true);
        return;
      }
      toast.info(t("zreport.pick_shift"));
      document.getElementById("open-shifts")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    setSelectedShiftForClose(shift);
    setShowCloseDialog(true);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-auto h-full">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#005bd6]">
            <ClipboardCheck className="size-6" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight text-[#0f172a]">
              {t("nav.shift_closing")}
            </h1>
            <p className="mt-0.5 text-sm text-[#64748b]">{t("zreport.page_lead")}</p>
          </div>
        </div>
        <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e6edf5] bg-white px-3 text-sm font-medium text-[#0f172a]">
          <Calendar className="size-4 text-[#64748b]" />
          {t("zreport.today_date", { date: todayLabel })}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="flex flex-col rounded-[22px] border border-[#e6edf5] bg-white p-5">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f4f7fb] text-[#334155]">
            <UserRound className="size-5" strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 text-[18px] font-bold text-[#0f172a]">{t("zreport.close_shift")}</h2>
          <p className="mt-1 flex-1 text-sm leading-snug text-[#64748b]">{t("zreport.close_shift_lead")}</p>
          <button
            type="button"
            disabled={activeShifts.length === 0}
            onClick={() => openCloseShift(null)}
            className="mt-5 h-11 w-full rounded-xl bg-[#2563eb] text-sm font-semibold disabled:opacity-50"
            style={{ color: "#ffffff" }}
          >
            {t("zreport.close_shift")}
          </button>
        </section>

        <section className="flex flex-col rounded-[22px] border border-[#e6edf5] bg-white p-5">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f4f7fb] text-[#334155]">
            <Printer className="size-5" strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 text-[18px] font-bold text-[#0f172a]">{t("zreport.print_x")}</h2>
          <p className="mt-1 flex-1 text-sm leading-snug text-[#64748b]">{t("zreport.print_x_lead")}</p>
          <button
            type="button"
            disabled={printingX}
            onClick={() => {
              setPrintingX(true);
              void printReportPaper(
                () =>
                  printXReportNow({
                    licenseKey,
                    formatPrice,
                    storeName: report.restaurantName,
                    totals: xTotalsFromLiveReport(report),
                  }),
                t("zreport.print_failed"),
              )
                .then((ok) => {
                  if (!ok) return;
                  const iso = new Date().toISOString();
                  writeLastXPrint(licenseKey, iso);
                  setLastXPrint(iso);
                })
                .finally(() => setPrintingX(false));
            }}
            className="mt-5 h-11 w-full rounded-xl border border-[#2563eb] bg-white text-sm font-semibold text-[#2563eb] disabled:opacity-50"
          >
            {t("zreport.print_x")}
          </button>
        </section>

        <section className="relative flex flex-col rounded-[22px] border border-[#e6edf5] bg-white p-5">
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 text-[12px] font-medium text-[#d97706]">
            <TriangleAlert className="size-3.5" />
            {t("zreport.admin_required")}
          </span>
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f4f7fb] text-[#334155]">
            <ShieldCheck className="size-5" strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 text-[18px] font-bold text-[#0f172a]">{t("zreport.close_day")}</h2>
          <p className="mt-1 flex-1 text-sm leading-snug text-[#64748b]">{t("zreport.close_day_lead")}</p>
          {dayClosed ? (
            <span className="mt-5 inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
              {t("zreport.day_closed")}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelectedShiftForClose(null);
                setShowCloseDialog(true);
              }}
              className="mt-5 h-11 w-full shrink-0 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: "#0f172a", color: "#ffffff" }}
            >
              {t("zreport.close_day")}
            </button>
          )}
        </section>
      </div>

      <section className="rounded-[22px] border border-[#e6edf5] bg-white px-4 py-4 sm:px-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#f4f7fb] text-[#334155]">
            <ChartColumn className="size-4" strokeWidth={1.75} />
          </span>
          <h2 className="text-[16px] font-bold text-[#0f172a]">
            {t("zreport.today_summary")}{" "}
            <span className="font-medium text-[#94a3b8]">({t("zreport.live_badge")})</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {summaryTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.key}
                className={cn(
                  "flex min-w-0 flex-col items-center rounded-2xl px-2 py-3 text-center",
                  tile.tone === "expense" && "bg-[#fff1f2] text-[#e11d48]",
                  tile.tone === "consumption" && "bg-[#f5f3ff] text-[#7c3aed]",
                  tile.tone === "plain" && "bg-[#f4f7fb] text-[#64748b]",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                <p className="mt-2 text-[12px] font-medium">{tile.label}</p>
                <p
                  className={cn(
                    "mt-0.5 text-[15px] font-bold tabular-nums",
                    tile.tone === "plain" && "text-[#0f172a]",
                  )}
                >
                  {tile.value}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="open-shifts" className="overflow-hidden rounded-[22px] border border-[#e6edf5] bg-white">
        <div className="flex items-center gap-2 px-5 py-4">
          <Users className="size-4 text-[#64748b]" />
          <h2 className="text-[16px] font-bold text-[#0f172a]">{t("zreport.open_shifts")}</h2>
        </div>
        {activeShifts.length === 0 ? (
          <div className="px-5 pb-8 text-center text-sm text-[#64748b]">
            <Users className="mx-auto mb-2 size-8 opacity-40" />
            <p>{t("zreport.no_shifts")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-y border-[#eef2f6] bg-[#f8fafc] text-left text-[12px] font-medium text-[#94a3b8]">
                  <th className="px-5 py-3 font-medium">{t("zreport.col_staff")}</th>
                  <th className="px-3 py-3 font-medium">{t("zreport.col_started")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("zreport.col_cash")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("zreport.col_card")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("zreport.col_debt")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("zreport.col_free")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("zreport.col_expense")}</th>
                  <th className="px-3 py-3 text-right font-medium">{t("zreport.col_consumption")}</th>
                  <th className="px-3 py-3 font-medium">{t("zreport.col_status")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("zreport.col_action")}</th>
                </tr>
              </thead>
              <tbody>
                {activeShifts.map((shift, i) => {
                  const sales = breakdownFor(shift);
                  return (
                    <tr key={shift.shiftId ?? i} className="border-b border-[#f1f5f9] last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]">
                            <UserRound className="size-4" />
                          </span>
                          <span className="font-semibold text-[#0f172a]">{shift.staffName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-[#475569]">
                        {format(new Date(shift.clockIn), "HH:mm")}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[#0f172a]">
                        {formatPrice(sales?.paidCash ?? 0)}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[#0f172a]">
                        {formatPrice(sales?.paidCard ?? 0)}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[#0f172a]">
                        {formatPrice(sales?.paidDebt ?? 0)}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[#0f172a]">
                        {formatPrice(sales?.paidComplimentary ?? 0)}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[#0f172a]">
                        {expensesQuery === undefined ? "—" : formatPrice(expenseFor(shift))}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-[#0f172a]">
                        {consumptionQuery === undefined ? "—" : formatPrice(consumptionFor(shift))}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#16a34a]">
                          <span className="size-1.5 rounded-full bg-[#22c55e]" />
                          {t("zreport.status_open")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openCloseShift(shift)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563eb]"
                        >
                          <LogOut className="size-3.5" />
                          {t("zreport.close_shift")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-[#e6edf5] bg-white">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[#64748b]" />
            <h2 className="text-[16px] font-bold text-[#0f172a]">{t("zreport.latest_reports")}</h2>
          </div>
          <button
            type="button"
            onClick={onShowHistory}
            className="text-sm font-semibold text-[#2563eb]"
          >
            {t("zreport.view_history")} →
          </button>
        </div>
        {!lastXPrint && !latestZ?.createdAt ? (
          <p className="px-5 pb-5 text-sm text-[#64748b]">{t("zreport.no_reports")}</p>
        ) : (
          <div className="border-t border-[#f1f5f9]">
            {lastXPrint ? (
              <div className="flex items-center gap-3 px-5 py-3.5">
                <FileText className="size-4 text-[#64748b]" />
                <span className="font-medium text-[#0f172a]">{t("zreport.x_report")}</span>
                <span className="text-sm text-[#64748b]">
                  {reportMomentLabel(lastXPrint, t, dateLocale)}
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-[#16a34a]">
                  <span className="size-1.5 rounded-full bg-[#22c55e]" />
                  {t("zreport.status_printed")}
                </span>
              </div>
            ) : null}
            {latestZ?.createdAt ? (
              <div className="flex items-center gap-3 border-t border-[#f1f5f9] px-5 py-3.5">
                <FileText className="size-4 text-[#64748b]" />
                <span className="font-medium text-[#0f172a]">{t("zreport.z_report")}</span>
                <span className="text-sm text-[#64748b]">
                  {reportMomentLabel(latestZ.createdAt, t, dateLocale)}
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-sm font-medium text-[#64748b]">
                  <span className="size-1.5 rounded-full bg-[#94a3b8]" />
                  {t("zreport.status_closed")}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Close Shift / Day Dialog */}
      <CloseShiftDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        report={report}
        licenseKey={licenseKey}
        staffId={staffId}
        staffName={staffName}
        initialShift={selectedShiftForClose}
        onClosed={() => {
          setDayClosed(true);
          setShowCloseDialog(false);
        }}
      />
    </div>
  );
}

// ── Thermal Receipt Preview ───────────────────────────

type ReportData = {
  zNumber: number;
  date: string;
  restaurantName: string;
  currency?: string;
  shiftStart: string;
  shiftEnd: string;
  barRevenue: number;
  kitchenRevenue: number;
  grossRevenue: number;
  cardTotal: number;
  debtTotal: number;
  complimentaryTotal: number;
  wasteTotal: number;
  voidsTotal: number;
  totalToHandOver: number;
  totalOrders: number;
  paidOrders: number;
  cancelledOrders: number;
  voidedCount: number;
  openingCash?: number;
  staffBreakdown: Array<{
    staffId?: string;
    name: string;
    orders: number;
    revenue: number;
    paidCash?: number;
    paidCard?: number;
    paidDebt?: number;
    paidComplimentary?: number;
  }>;
  shiftDetails: Array<{
    staffId?: string;
    shiftId?: string;
    staffName: string;
    staffRole?: string;
    clockIn: string;
    clockOut: string | null;
    openingCash?: number;
  }>;
};

function ReceiptPreview({
  report,
  staffName,
  cashExpenses,
  closedByName,
}: {
  report: ReportData;
  staffName: string;
  cashExpenses?: number;
  closedByName?: string;
}) {
  const expenses = cashExpenses ?? 0;
  const openCash = report.openingCash ?? 0;
  const finalHandOver = Math.round(
    (report.totalToHandOver + openCash - expenses) * 100
  ) / 100;
  const totalDeductions =
    report.cardTotal +
    report.debtTotal +
    report.complimentaryTotal +
    report.wasteTotal +
    report.voidsTotal +
    expenses;
  const dateStr = format(new Date(report.date), "dd/MM/yyyy");
  const shiftStartStr = format(new Date(report.shiftStart), "HH:mm");
  const shiftEndStr = format(new Date(report.shiftEnd), "HH:mm");
  const zId = `Z-${String(report.zNumber).padStart(3, "0")}`;

  return (
    <div className="w-full max-w-sm bg-white text-black font-mono text-xs p-6 rounded shadow-lg print:shadow-none print:rounded-none">
      {/* Header */}
      <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
        <p className="font-bold text-sm tracking-wider">
          {report.restaurantName}
        </p>
        <p className="text-[10px] text-gray-500 mt-1">SHIFT CLOSING REPORT</p>
        <p className="font-bold text-base mt-1 tracking-widest">{zId}</p>
      </div>

      {/* Details */}
      <div className="border-b border-dashed border-gray-400 pb-3 mb-3 space-y-0.5">
        <ReceiptRow label="Date" value={dateStr} />
        <ReceiptRow label="Shift Start" value={shiftStartStr} />
        <ReceiptRow label="Shift End" value={shiftEndStr} />
        <ReceiptRow label="Waiter" value={staffName} />
        {closedByName && (
          <ReceiptRow label="Closed By" value={closedByName} />
        )}
        <ReceiptRow label="Orders" value={String(report.paidOrders)} />
        {(report.openingCash ?? 0) > 0 && (
          <ReceiptRow
            label="Opening Cash"
            value={`$${(report.openingCash ?? 0).toFixed(2)}`}
            icon={<Wallet className="size-3 inline mr-1" />}
          />
        )}
      </div>

      {/* Revenue Breakdown */}
      <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
        <p className="font-bold text-center text-[10px] tracking-wider text-gray-500 mb-2">
          REVENUE BREAKDOWN
        </p>
        <ReceiptRow
          label="BAR"
          value={`$${report.barRevenue.toFixed(2)}`}
          icon={<Wine className="size-3 inline mr-1" />}
        />
        <ReceiptRow
          label="KITCHEN"
          value={`$${report.kitchenRevenue.toFixed(2)}`}
          icon={<ChefHat className="size-3 inline mr-1" />}
        />
        <div className="border-t border-gray-300 mt-1 pt-1">
          <ReceiptRow
            label="GROSS REVENUE"
            value={`$${report.grossRevenue.toFixed(2)}`}
            bold
          />
        </div>
      </div>

      {/* Deductions */}
      <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
        <p className="font-bold text-center text-[10px] tracking-wider text-gray-500 mb-2">
          DEDUCTIONS
        </p>
        <ReceiptRow
          label="CARD"
          value={`-$${report.cardTotal.toFixed(2)}`}
          icon={<CreditCard className="size-3 inline mr-1" />}
          dimmed={report.cardTotal === 0}
        />
        <ReceiptRow
          label="DEBT"
          value={`-$${report.debtTotal.toFixed(2)}`}
          icon={<HandCoins className="size-3 inline mr-1" />}
          dimmed={report.debtTotal === 0}
        />
        <ReceiptRow
          label="COMPLIMENTARY"
          value={`-$${report.complimentaryTotal.toFixed(2)}`}
          icon={<Gift className="size-3 inline mr-1" />}
          dimmed={report.complimentaryTotal === 0}
        />
        <ReceiptRow
          label="WASTE"
          value={`-$${report.wasteTotal.toFixed(2)}`}
          icon={<Trash2 className="size-3 inline mr-1" />}
          dimmed={report.wasteTotal === 0}
        />
        <ReceiptRow
          label="VOIDS"
          value={`-$${report.voidsTotal.toFixed(2)}`}
          icon={<Ban className="size-3 inline mr-1" />}
          dimmed={report.voidsTotal === 0}
        />
        <ReceiptRow
          label="CASH EXPENSES"
          value={`-$${expenses.toFixed(2)}`}
          icon={<Wallet className="size-3 inline mr-1" />}
          dimmed={expenses === 0}
        />
        <div className="border-t border-gray-300 mt-1 pt-1">
          <ReceiptRow
            label="TOTAL DEDUCTIONS"
            value={`-$${totalDeductions.toFixed(2)}`}
            bold
          />
        </div>
      </div>

      {/* Final */}
      <div className="text-center py-3">
        <p className="text-[10px] text-gray-500 tracking-wider mb-1">
          <ArrowDown className="size-3 inline mr-1" />
          TOTAL TO HAND OVER
        </p>
        <p className="text-2xl font-black tracking-tight">
          ${finalHandOver.toFixed(2)}
        </p>
        {(report.openingCash ?? 0) > 0 && (
          <p className="text-[9px] text-gray-500 mt-1">
            Opening Cash ${(report.openingCash ?? 0).toFixed(2)} + Sales ${report.grossRevenue.toFixed(2)} − Deductions $
            {totalDeductions.toFixed(2)}
          </p>
        )}
        {!(report.openingCash ?? 0) && (
          <p className="text-[9px] text-gray-400 mt-1">
            Gross ${report.grossRevenue.toFixed(2)} − Deductions $
            {totalDeductions.toFixed(2)}
          </p>
        )}
      </div>

      {/* Staff breakdown */}
      {report.staffBreakdown.length > 0 && (
        <div className="border-t border-dashed border-gray-400 pt-3 mt-3">
          <p className="font-bold text-center text-[10px] tracking-wider text-gray-500 mb-2">
            STAFF BREAKDOWN
          </p>
          {report.staffBreakdown.map((s, i) => (
            <ReceiptRow
              key={i}
              label={s.name}
              value={`${s.orders} ord · $${s.revenue.toFixed(2)}`}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-dashed border-gray-400 pt-3 mt-3 text-center">
        <p className="text-[9px] text-gray-400">
          {format(new Date(), "dd/MM/yyyy HH:mm:ss")}
        </p>
        <p className="text-[9px] text-gray-400 mt-0.5">
          REPORT {zId} · {report.restaurantName}
        </p>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  bold,
  dimmed,
  icon,
}: {
  label: string;
  value: string;
  bold?: boolean;
  dimmed?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex justify-between py-0.5",
        bold && "font-bold",
        dimmed && "text-gray-400"
      )}
    >
      <span className="flex items-center">
        {icon}
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

// ── Close Shift Dialog (waiter list + per-waiter close + close day) ──

function formatPosMutationError(e: unknown, fallback: string): string {
  if (e instanceof Error && String(e.message ?? "").trim()) {
    return e.message;
  }
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object" && "error" in e) {
    const inner = (e as { error: unknown }).error;
    if (typeof inner === "string" && inner.trim()) return inner;
    if (inner && typeof inner === "object" && "message" in inner) {
      const im = (inner as { message: unknown }).message;
      if (typeof im === "string" && im.trim()) return im;
    }
  }
  return fallback;
}

type ShiftDetail = ReportData["shiftDetails"][0];

function CloseShiftDialog({
  open,
  onOpenChange,
  report,
  licenseKey,
  staffId,
  staffName,
  initialShift,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ReportData;
  licenseKey: string;
  staffId: string;
  staffName: string;
  initialShift: ShiftDetail | null;
  onClosed: () => void;
}) {
  const { t, formatPrice } = usePosLocale();
  type DialogStep = "close-waiter-pin" | "expenses" | "close-day-pin";

  const [step, setStep] = useState<DialogStep>(
    initialShift ? "close-waiter-pin" : "expenses"
  );
  const [selectedShift, setSelectedShift] = useState<ShiftDetail | null>(
    initialShift
  );
  const [cashExpenses, setCashExpenses] = useState("0");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const closeStaffShiftMut = useMutation('pos.staff.closeStaffShift');
  const closeDay = useMutation('pos.dashboard.closeDay');
  const clearAllExpensesMut = useMutation('pos.expenses.clearAllExpenses');
  const clearAllConsumptionMut = useMutation(
    "pos.staffConsumption.clearAllConsumption",
  );
  const syncDeviceClosePinMut = useMutation(
    "pos.settings.syncDeviceClosePinHash",
  );

  const receiptTemplates = useQuery(
    "pos.templates.listTemplates",
    open ? { licenseKey } : "skip"
  ) as
    | Array<{
        templateType: string;
        printerId?: string | null;
        toggles: Record<string, boolean>;
        labels: { headerText: string; footerText: string };
        styles: Record<string, unknown>;
      }>
    | undefined;

  // Fetch expenses for the selected waiter
  const waiterExpenses = useQuery(
    'pos.expenses.getStaffExpenses',
    selectedShift?.staffId
      ? { licenseKey, staffId: selectedShift.staffId as Id<"staff"> }
      : "skip"
  );

  const waiterConsumption = useQuery(
    "pos.staffConsumption.getStaffConsumption",
    selectedShift?.staffId
      ? { licenseKey, staffId: selectedShift.staffId as Id<"staff"> }
      : "skip"
  );

  // Fetch all uncleared expenses for Close Day
  const allExpenses = useQuery(
    'pos.expenses.getAllUnclearedExpenses',
    step === "expenses" || step === "close-day-pin"
      ? { licenseKey }
      : "skip"
  );

  const closeWaiterExpenseLines = waiterExpenseLines(
    waiterExpenses as Parameters<typeof waiterExpenseLines>[0],
  );
  const closeWaiterExpenseTotal =
    waiterExpenses &&
    typeof waiterExpenses === "object" &&
    "total" in waiterExpenses
      ? Number((waiterExpenses as { total: number }).total)
      : 0;
  const consumptionEntries =
    waiterConsumption &&
    typeof waiterConsumption === "object" &&
    Array.isArray((waiterConsumption as { entries?: unknown[] }).entries)
      ? (
          waiterConsumption as {
            entries: Array<{ _id: string; total: number }>;
          }
        ).entries
      : [];
  const consumptionTotal =
    waiterConsumption &&
    typeof waiterConsumption === "object" &&
    "total" in waiterConsumption
      ? Number((waiterConsumption as { total: number }).total)
      : 0;

  // Reset on open
  useEffect(() => {
    if (open) {
      if (initialShift) {
        setStep("close-waiter-pin");
        setSelectedShift(initialShift);
      } else {
        setStep("expenses");
        setSelectedShift(null);
      }
      setCashExpenses("0");
      setPin("");
      setPinError("");
    }
  }, [open, initialShift]);

  const parsedExpenses = allExpenses?.total ?? (parseFloat(cashExpenses) || 0);
  const openCash = report.openingCash ?? 0;
  const finalHandOver =
    Math.round((report.totalToHandOver + openCash - parsedExpenses) * 100) /
    100;

  // ── Close individual waiter shift ──
  const handleCloseWaiterPin = async () => {
    if (!selectedShift?.shiftId) return;
    if (!isValidStaffPinLength(pin.length)) {
      setPinError(
        t("staff.err_pin_digits", {
          min: STAFF_PIN_MIN_LEN,
          max: STAFF_PIN_MAX_LEN,
        }),
      );
      return;
    }
    setIsClosing(true);
    setPinError("");
    try {
      const hashed = await hashString(pin);
      const [localAdmin, remoteAdmin] = await Promise.all([
        verifyPin(pin),
        verifyAdminPin(licenseKey, hashed),
      ]);
      if (!localAdmin && !remoteAdmin) {
        setPinError("Invalid admin PIN");
        setPin("");
        setIsClosing(false);
        return;
      }

      await closeStaffShiftMut({
        licenseKey,
        shiftId: selectedShift.shiftId as Id<"shifts">,
        staffName: selectedShift.staffName,
        adminStaffId: (remoteAdmin?.adminId ?? staffId) as Id<"staff">,
        adminStaffName: remoteAdmin?.adminName ?? localAdmin?.name ?? staffName,
      });

      let sid = selectedShift.staffId;
      if (!sid) {
        const list =
          (await getDataCache<Doc<"staff">[]>(`staff:${licenseKey}`)) ?? [];
        sid = list.find((s) => s.name === selectedShift.staffName)?._id;
      }
      if (sid) {
        await clearStaffOpenShiftLocal(licenseKey, sid);
      }

      const clockOutIso = new Date().toISOString();
      const closedByName =
        remoteAdmin?.adminName ?? localAdmin?.name ?? staffName;

      const normKey = (id: string | undefined) =>
        id ? id.trim().toLowerCase() : "";
      const sk = normKey(selectedShift.staffId);
      let orders = 0;
      let revenue = 0;
      let paidCash = 0;
      let paidCard = 0;
      let paidDebt = 0;
      let paidComplimentary = 0;
      if (sk) {
        const row = report.staffBreakdown.find(
          (s) => normKey(s.staffId) === sk
        );
        if (row) {
          orders = row.orders;
          revenue = row.revenue;
          paidCash = row.paidCash ?? 0;
          paidCard = row.paidCard ?? 0;
          paidDebt = row.paidDebt ?? 0;
          paidComplimentary = row.paidComplimentary ?? 0;
        }
      }
      if (!revenue && !orders) {
        const byName = report.staffBreakdown.find(
          (s) => s.name === selectedShift.staffName
        );
        if (byName) {
          orders = byName.orders;
          revenue = byName.revenue;
          paidCash = byName.paidCash ?? 0;
          paidCard = byName.paidCard ?? 0;
          paidDebt = byName.paidDebt ?? 0;
          paidComplimentary = byName.paidComplimentary ?? 0;
        }
      }

      const waiterTmpl = receiptTemplates?.find(
        (tmpl) => tmpl.templateType === "waiter_shift_report"
      );

      void loadPaperPrintDeviceName({
        licenseKey,
        templateType: "waiter_shift_report",
        templatePrinterId: waiterTmpl?.printerId,
      }).then((deviceName) =>
        printWaiterShiftReport(
          waiterTmpl
            ? {
                toggles: waiterTmpl.toggles as WaiterShiftTemplateToggles,
                labels: waiterTmpl.labels,
                styles: waiterTmpl.styles ?? {},
              }
            : null,
          {
            restaurantName: report.restaurantName,
            waiterName: selectedShift.staffName,
            closedByName,
            clockInIso: selectedShift.clockIn,
            clockOutIso,
            orders,
            revenue,
            paidCash,
            paidCard,
            paidDebt,
            paidComplimentary,
            openingCash: selectedShift.openingCash ?? 0,
            expenseTotal: closeWaiterExpenseTotal,
            expenseLines: closeWaiterExpenseLines,
            damagesTotal: consumptionTotal,
          },
          formatPrice,
          {
            silent: true,
            subheaderTitle: t("shift.waiter_shift_report_title"),
            deviceName,
          },
        ),
      );

      toast.success(`Shift closed for ${selectedShift.staffName}`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to close shift");
    } finally {
      setIsClosing(false);
    }
  };

  // ── Close day (full Z-Report) ──
  const handleCloseDayPin = async () => {
    if (!isValidStaffPinLength(pin.length)) {
      setPinError(
        t("staff.err_pin_digits", {
          min: STAFF_PIN_MIN_LEN,
          max: STAFF_PIN_MAX_LEN,
        }),
      );
      return;
    }
    setIsClosing(true);
    setPinError("");
    try {
      const hashed = await hashString(pin);
      const [localAdmin, remoteAdmin] = await Promise.all([
        verifyPin(pin),
        verifyAdminPin(licenseKey, hashed),
      ]);
      if (!localAdmin && !remoteAdmin) {
        setPinError("Invalid admin PIN");
        setPin("");
        setIsClosing(false);
        return;
      }

      const closedShifts = report.shiftDetails
        .filter(
          (s): s is ShiftDetail & { clockOut: string } => s.clockOut !== null
        )
        .map((s) => ({
          staffName: s.staffName,
          clockIn: s.clockIn,
          clockOut: s.clockOut,
        }));

      const now = new Date().toISOString();
      const activeShiftsForClose = report.shiftDetails
        .filter((s) => s.clockOut === null)
        .map((s) => ({
          staffName: s.staffName,
          clockIn: s.clockIn,
          clockOut: now,
        }));

      let closeByStaffId = remoteAdmin?.adminId ?? staffId;
      let closeByName =
        remoteAdmin?.adminName ?? localAdmin?.name ?? staffName;

      if (!uuidOrNull(closeByStaffId)) {
        const ls = await verifyLocalStaffPin(hashed);
        if (ls && (ls.role === "admin" || ls.role === "manager")) {
          closeByStaffId = ls.convexId;
          closeByName = ls.name;
        }
      }

      // Always persist this PIN hash on the restaurant row before closeDay so the server can
      // authorize even when staff.pin_hash is out of sync (same PIN was verified above).
      await syncDeviceClosePinMut({ licenseKey, pinHash: hashed });

      await closeDay({
        licenseKey,
        staffId: closeByStaffId as Id<"staff">,
        staffName: closeByName,
        pinHash: hashed,
        cashExpenses: parsedExpenses,
        reportData: {
          zNumber: report.zNumber,
          restaurantName: report.restaurantName,
          closedByStaffName: closeByName,
          openingCash: report.openingCash ?? 0,
          barRevenue: report.barRevenue,
          kitchenRevenue: report.kitchenRevenue,
          grossRevenue: report.grossRevenue,
          cardTotal: report.cardTotal,
          debtTotal: report.debtTotal,
          complimentaryTotal: report.complimentaryTotal,
          wasteTotal: report.wasteTotal,
          voidsTotal: report.voidsTotal,
          totalToHandOver: report.totalToHandOver,
          totalOrders: report.totalOrders,
          paidOrders: report.paidOrders,
          cancelledOrders: report.cancelledOrders,
          shiftStart: report.shiftStart,
          shiftEnd: now,
          staffBreakdown: report.staffBreakdown.map((s) => ({
            staffName: s.name,
            orders: s.orders,
            revenue: s.revenue,
            paidCash: s.paidCash ?? 0,
          })),
          shiftDetails: [...closedShifts, ...activeShiftsForClose],
        },
      });

      await clearAllExpensesMut({ licenseKey });
      await clearAllConsumptionMut({ licenseKey });

      await clearAllOpenShiftsLocal(licenseKey);

      toast.success(
        `${t("zreport.day_closed_success", { z: String(report.zNumber).padStart(3, "0"), amount: formatPrice(finalHandOver) })}`,
      );
      void printReportPaper(
        () =>
          printZReportNow({
            licenseKey,
            formatPrice,
            storeName: report.restaurantName,
            totals: zTotalsFromLiveReport({
              zNumber: report.zNumber,
              grossRevenue: report.grossRevenue,
              cardTotal: report.cardTotal,
              debtTotal: report.debtTotal,
              complimentaryTotal: report.complimentaryTotal,
              wasteTotal: report.wasteTotal,
              voidsTotal: report.voidsTotal,
              openingCash: report.openingCash,
              cashExpenses: parsedExpenses,
              paidOrders: report.paidOrders,
              closedBy: closeByName,
              staffBreakdown: report.staffBreakdown,
            }),
          }),
        t("zreport.print_failed"),
      );
      onClosed();
    } catch (e) {
      toast.error(
        formatPosMutationError(e, t("zreport.close_day_failed")),
      );
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131A2E] border-[#1e2a45] text-white max-w-lg">
        {/* ── Step: Admin PIN for individual waiter ── */}
        {step === "close-waiter-pin" && selectedShift && (
          <>
            <DialogHeader>
              <DialogTitle>
                Close Shift &mdash; {selectedShift.staffName}
              </DialogTitle>
              <DialogDescription className="text-[#8b93a7]">
                Enter admin PIN to confirm closing this shift
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="p-3 rounded-lg bg-[#0A0F1E] border border-[#1e2a45] text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#5a6580]">Clock In</span>
                  <span className="text-white">
                    {format(new Date(selectedShift.clockIn), "HH:mm")}
                  </span>
                </div>
                {(selectedShift.openingCash ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#5a6580]">Opening Cash</span>
                    <span className="text-white">
                      {formatPrice(selectedShift.openingCash ?? 0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Waiter's expenses */}
              {closeWaiterExpenseLines.length > 0 && (
                <div className="p-3 rounded-lg bg-[#0A0F1E] border border-amber-500/30 text-sm space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium mb-1">
                    <Receipt className="size-3.5" />
                    Expenses ({closeWaiterExpenseLines.length})
                  </div>
                  {closeWaiterExpenseLines.map((exp, idx) => (
                    <div
                      key={`${exp.note}-${idx}`}
                      className="flex justify-between text-xs"
                    >
                      <span className="text-[#c0c7d6] truncate mr-2">
                        {exp.note}
                      </span>
                      <span className="text-amber-400 shrink-0 font-medium">
                        {formatPrice(exp.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[#1e2a45] pt-1 flex justify-between font-semibold text-xs">
                    <span className="text-[#8b93a7]">Total Expenses</span>
                    <span className="text-amber-400">
                      {formatPrice(closeWaiterExpenseTotal)}
                    </span>
                  </div>
                </div>
              )}

              {consumptionEntries.length > 0 && (
                <div className="p-3 rounded-lg bg-[#0A0F1E] border border-rose-500/30 text-sm space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-400 text-xs font-medium mb-1">
                    <Trash2 className="size-3.5" />
                    Staff use / damages ({consumptionEntries.length})
                  </div>
                  {consumptionEntries.map((row) => (
                    <div
                      key={row._id}
                      className="flex justify-between text-xs"
                    >
                      <span className="text-[#c0c7d6] truncate mr-2">
                        Consumption
                      </span>
                      <span className="text-rose-400 shrink-0 font-medium">
                        {formatPrice(row.total)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[#1e2a45] pt-1 flex justify-between font-semibold text-xs">
                    <span className="text-[#8b93a7]">Total</span>
                    <span className="text-rose-400">
                      {formatPrice(consumptionTotal)}
                    </span>
                  </div>
                </div>
              )}

              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => {
                  setPin(sanitizeStaffPinInput(e.target.value));
                  setPinError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCloseWaiterPin();
                }}
                placeholder="Enter admin PIN"
                className="bg-[#0A0F1E] border-[#1e2a45] text-white text-center text-xl tracking-[0.3em]"
                maxLength={STAFF_PIN_MAX_LEN}
                autoFocus
              />
              {pinError && (
                <p className="text-red-400 text-xs text-center">{pinError}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="bg-[#1e2a45] hover:bg-[#2a3a5a] text-white"
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCloseWaiterPin}
                disabled={!isValidStaffPinLength(pin.length) || isClosing}
              >
                {isClosing ? "Closing..." : "Confirm Close"}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: Cash expenses (Close Day) ── */}
        {step === "expenses" && (
          <>
            <DialogHeader>
              <DialogTitle>Close Day</DialogTitle>
              <DialogDescription className="text-[#8b93a7]">
                Z-{String(report.zNumber).padStart(3, "0")} &middot; Review
                expenses before finalizing
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8b93a7]">Gross Revenue</span>
                  <span className="text-white font-semibold">
                    {formatPrice(report.grossRevenue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8b93a7]">Non-Cash Deductions</span>
                  <span className="text-red-400 font-semibold">
                    -
                    {formatPrice(
                      report.cardTotal +
                        report.debtTotal +
                        report.complimentaryTotal +
                        report.wasteTotal +
                        report.voidsTotal,
                    )}
                  </span>
                </div>
              </div>

              {/* Logged expenses from waiters */}
              {allExpenses &&
                Array.isArray(allExpenses.entries) &&
                allExpenses.entries.length > 0 && (
                <div className="p-3 rounded-lg bg-[#0A0F1E] border border-amber-500/30 text-sm space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium mb-1">
                    <Receipt className="size-3.5" />
                    Logged Expenses ({allExpenses.entries.length})
                  </div>
                  {allExpenses.entries.map((exp) => (
                    <div key={exp._id} className="flex justify-between text-xs">
                      <span className="text-[#c0c7d6] truncate mr-2">
                        <span className="text-[#5a6580]">{exp.staffName}:</span> {exp.note}
                      </span>
                      <span className="text-amber-400 shrink-0 font-medium">
                        {formatPrice(exp.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-[#1e2a45] pt-1 flex justify-between font-semibold text-xs">
                    <span className="text-[#8b93a7]">Total Expenses</span>
                    <span className="text-amber-400">
                      {formatPrice(allExpenses.total)}
                    </span>
                  </div>
                </div>
              )}

              {allExpenses &&
                Array.isArray(allExpenses.entries) &&
                allExpenses.entries.length === 0 && (
                <div className="text-center py-3 text-[#5a6580] text-sm">
                  No expenses logged today
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#0A0F1E] border border-emerald-500/20">
                <p className="text-xs text-[#5a6580] mb-1">
                  Total to Hand Over
                </p>
                <p className="text-3xl font-black text-emerald-400">
                  {formatPrice(finalHandOver)}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                className="bg-[#1e2a45] hover:bg-[#2a3a5a] text-white"
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setPin("");
                  setPinError("");
                  setStep("close-day-pin");
                }}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: Admin PIN (Close Day) ── */}
        {step === "close-day-pin" && (
          <>
            <DialogHeader>
              <DialogTitle>Admin Authorization</DialogTitle>
              <DialogDescription className="text-[#8b93a7]">
                Enter admin PIN to close Z-
                {String(report.zNumber).padStart(3, "0")} and hand over{" "}
                {formatPrice(finalHandOver)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => {
                  setPin(sanitizeStaffPinInput(e.target.value));
                  setPinError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCloseDayPin();
                }}
                placeholder="Enter admin PIN"
                className="bg-[#0A0F1E] border-[#1e2a45] text-white text-center text-xl tracking-[0.3em]"
                maxLength={STAFF_PIN_MAX_LEN}
                autoFocus
              />
              {pinError && (
                <p className="text-red-400 text-xs text-center">{pinError}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                onClick={() => setStep("expenses")}
                className="bg-[#1e2a45] hover:bg-[#2a3a5a] text-white"
              >
                Back
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCloseDayPin}
                disabled={!isValidStaffPinLength(pin.length) || isClosing}
              >
                {isClosing ? "Closing..." : "Confirm & Close"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Z-Report History ──────────────────────────────────

function ZReportHistory({
  licenseKey,
  staffId,
  onBack,
  onSelectReport,
}: {
  licenseKey: string;
  staffId?: string;
  onBack: () => void;
  onSelectReport: (index: number) => void;
}) {
  const historyQuery = useQuery('pos.dashboard.getZReportHistory', {
    licenseKey,
    staffId,
  });
  const history = Array.isArray(historyQuery) ? historyQuery : [];

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-auto h-full">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="size-6" />
            Shift History
          </h1>
          <p className="text-sm text-[#5a6580] mt-1">
            Past closed Z-Reports
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 text-[#5a6580]">
          <FileText className="size-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No closed shifts yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((r, idx) => (
            <button
              key={r._id}
              onClick={() => onSelectReport(idx)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#0D1326] border border-[#1e2a45] hover:border-[#2a3a5a] transition-all cursor-pointer text-left"
            >
              <div className="w-12 h-12 rounded-lg bg-[#1e2a45] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">
                  Z-{String(r.zNumber).padStart(3, "0")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">
                  {format(new Date(r.createdAt), "MMM d, yyyy · h:mm a")}
                </p>
                <p className="text-xs text-[#5a6580] mt-0.5">
                  Closed by {r.closedByStaffName} &middot; Gross $
                  {r.grossRevenue.toFixed(2)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-400">
                  ${r.totalToHandOver.toFixed(2)}
                </p>
                <p className="text-[10px] text-[#5a6580]">handed over</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── History Detail ─────────────────────────────────────

function ZReportHistoryDetail({
  licenseKey,
  staffId,
  reportIndex,
  onBack,
}: {
  licenseKey: string;
  staffId?: string;
  reportIndex: number;
  onBack: () => void;
}) {
  const historyQuery = useQuery('pos.dashboard.getZReportHistory', {
    licenseKey,
    staffId,
  });
  const history = Array.isArray(historyQuery) ? historyQuery : [];

  const { formatPrice, t } = usePosLocale();
  const [printingZ, setPrintingZ] = useState(false);
  const r = history[reportIndex];
  if (!r) {
    onBack();
    return null;
  }

  // Map stored report data to the shape ReceiptPreview expects
  const reportForReceipt: ReportData = {
    zNumber: r.zNumber,
    date: r.createdAt,
    restaurantName: "",
    shiftStart: r.shiftStart,
    shiftEnd: r.shiftEnd,
    barRevenue: r.barRevenue,
    kitchenRevenue: r.kitchenRevenue,
    grossRevenue: r.grossRevenue,
    cardTotal: r.cardTotal,
    debtTotal: r.debtTotal,
    complimentaryTotal: r.complimentaryTotal,
    wasteTotal: r.wasteTotal,
    voidsTotal: r.voidsTotal,
    totalToHandOver: r.totalToHandOver + r.cashExpenses, // Pass pre-expense value
    totalOrders: r.totalOrders,
    paidOrders: r.paidOrders,
    cancelledOrders: r.cancelledOrders,
    voidedCount: 0,
    openingCash: r.openingCash ?? 0,
    staffBreakdown: r.staffBreakdown.map((s) => ({
      name: s.staffName,
      orders: s.orders,
      revenue: s.revenue,
    })),
    shiftDetails: r.shiftDetails.map((s) => ({
      staffName: s.staffName,
      clockIn: s.clockIn,
      clockOut: s.clockOut,
    })),
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-auto h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-[#1e2a45] text-[#8b93a7] hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white">
            Z-{String(r.zNumber).padStart(3, "0")}
          </h1>
          <p className="text-sm text-[#5a6580]">
            Closed {format(new Date(r.createdAt), "MMM d, yyyy · h:mm a")} by{" "}
            {r.closedByStaffName}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={printingZ}
          onClick={() => {
            setPrintingZ(true);
            void printReportPaper(
              () =>
                printZReportNow({
                  licenseKey,
                  formatPrice,
                  storeName:
                    typeof r.restaurantName === "string"
                      ? r.restaurantName
                      : undefined,
                  printedAt: new Date(r.createdAt),
                  totals: zTotalsFromLiveReport({
                    zNumber: r.zNumber,
                    grossRevenue: r.grossRevenue,
                    cardTotal: r.cardTotal,
                    debtTotal: r.debtTotal,
                    complimentaryTotal: r.complimentaryTotal,
                    wasteTotal: r.wasteTotal,
                    voidsTotal: r.voidsTotal,
                    openingCash: r.openingCash ?? 0,
                    cashExpenses: r.cashExpenses,
                    paidOrders: r.paidOrders,
                    closedBy: r.closedByStaffName ?? "—",
                  }),
                }),
              t("zreport.print_failed"),
            ).finally(() => setPrintingZ(false));
          }}
          className="bg-[#1e2a45] hover:bg-[#2a3a5a] text-white"
        >
          <Printer className="size-4 mr-1.5" />
          {t("zreport.print")}
        </Button>
      </div>

      <div className="flex justify-center">
        <ReceiptPreview
          report={reportForReceipt}
          staffName={r.staffBreakdown[0]?.staffName ?? "—"}
          cashExpenses={r.cashExpenses}
          closedByName={r.closedByStaffName}
        />
      </div>
    </div>
  );
}

// ── Shared Helper ─────────────────────────────────────

function DetailPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="size-4 text-[#5a6580]" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}
