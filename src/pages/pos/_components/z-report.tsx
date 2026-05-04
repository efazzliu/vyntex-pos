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
  FileText,
  Printer,
  XCircle,
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
import { format } from "date-fns";
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
import { usePosLocale } from "./pos-locale-provider.tsx";
import {
  STAFF_PIN_MAX_LEN,
  STAFF_PIN_MIN_LEN,
  isValidStaffPinLength,
  sanitizeStaffPinInput,
} from "../_lib/staff-pin.ts";

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
  const { t, formatPrice } = usePosLocale();
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [selectedShiftForClose, setSelectedShiftForClose] = useState<
    ReportData["shiftDetails"][0] | null
  >(null);
  const [dayClosed, setDayClosed] = useState(false);

  const reportQuery = useQuery('pos.dashboard.getZReport', { licenseKey });
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

  // Merge shift details with sales data from staffBreakdown
  const activeShifts = report.shiftDetails.filter((s) => s.clockOut === null);
  const closedShifts = report.shiftDetails.filter((s) => s.clockOut !== null);

  const normStaffKey = (id: string | undefined) =>
    id ? id.trim().toLowerCase() : "";

  const salesByStaffId: Record<string, { orders: number; revenue: number }> =
    {};
  const salesByName: Record<string, { orders: number; revenue: number }> = {};
  for (const s of report.staffBreakdown) {
    if (s.staffId) {
      salesByStaffId[normStaffKey(s.staffId)] = {
        orders: s.orders,
        revenue: s.revenue,
      };
    }
    salesByName[s.name] = { orders: s.orders, revenue: s.revenue };
  }

  const salesForShift = (shift: ReportData["shiftDetails"][0]) => {
    const byId = normStaffKey(shift.staffId);
    if (byId && salesByStaffId[byId]) {
      return salesByStaffId[byId];
    }
    return salesByName[shift.staffName];
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="size-6" />
            {t("zreport.title")}
          </h1>
          <p className="text-sm text-[#5a6580] mt-1">
            {t("zreport.subtitle_live", { name: report.restaurantName })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={onShowHistory}
            className="bg-[#1e2a45] hover:bg-[#2a3a5a] text-white"
          >
            <History className="size-4 mr-1.5" />
            {t("zreport.history")}
          </Button>
          {!dayClosed && (
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setSelectedShiftForClose(null);
                setShowCloseDialog(true);
              }}
            >
              <XCircle className="size-4 mr-1.5" />
              {t("zreport.close_day")}
            </Button>
          )}
          {dayClosed && (
            <span className="text-sm text-emerald-400 font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10">
              {t("zreport.day_closed")}
            </span>
          )}
        </div>
      </div>

      {/* Active Waiters */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] overflow-hidden">
        <div className="flex items-center gap-2 p-5 pb-3">
          <Users className="size-4 text-[#5a6580]" />
          <h3 className="text-sm font-semibold text-white">
            {t("zreport.active_shifts", { count: activeShifts.length })}
          </h3>
        </div>

        {activeShifts.length === 0 ? (
          <div className="text-center py-10 text-[#5a6580]">
            <Users className="size-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t("zreport.no_shifts")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#5a6580] text-xs border-b border-[#1e2a45]">
                  <th className="text-left px-5 pb-3 font-medium">
                    {t("zreport.col_waiter")}
                  </th>
                  <th className="text-left px-5 pb-3 font-medium">
                    {t("zreport.col_shift_start")}
                  </th>
                  <th className="text-right px-5 pb-3 font-medium">
                    {t("zreport.col_orders")}
                  </th>
                  <th className="text-right px-5 pb-3 font-medium">
                    {t("zreport.col_sales")}
                  </th>
                  <th className="text-right px-5 pb-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {activeShifts.map((shift, i) => {
                  const sales = salesForShift(shift);
                  return (
                    <tr
                      key={i}
                      className="border-t border-[#1e2a45] hover:bg-[#0A0F1E]/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1e2a45] flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-white">
                              {shift.staffName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              {shift.staffName}
                            </p>
                            <p className="text-xs text-[#5a6580]">
                              {posStaffRoleLabel(shift.staffRole ?? "waiter", t)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[#c0c7d6]">
                        {format(new Date(shift.clockIn), "HH:mm")}
                      </td>
                      <td className="px-5 py-3 text-right text-[#c0c7d6]">
                        {sales?.orders ?? 0}
                      </td>
                      <td className="px-5 py-3 text-right text-white font-semibold">
                        {formatPrice(sales?.revenue ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => {
                            setSelectedShiftForClose(shift);
                            setShowCloseDialog(true);
                          }}
                        >
                          {t("zreport.close_shift")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed Shifts (if any) */}
      {closedShifts.length > 0 && (
        <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-3">
            <Clock className="size-4 text-[#5a6580]" />
            <h3 className="text-sm font-semibold text-white">
              {t("zreport.closed_shifts", { count: closedShifts.length })}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#5a6580] text-xs border-b border-[#1e2a45]">
                  <th className="text-left px-5 pb-3 font-medium">
                    {t("zreport.col_waiter")}
                  </th>
                  <th className="text-left px-5 pb-3 font-medium">
                    {t("zreport.col_in")}
                  </th>
                  <th className="text-left px-5 pb-3 font-medium">
                    {t("zreport.col_out")}
                  </th>
                  <th className="text-right px-5 pb-3 font-medium">
                    {t("zreport.col_orders")}
                  </th>
                  <th className="text-right px-5 pb-3 font-medium">
                    {t("zreport.col_sales")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {closedShifts.map((shift, i) => {
                  const sales = salesForShift(shift);
                  return (
                    <tr
                      key={i}
                      className="border-t border-[#1e2a45] opacity-70"
                    >
                      <td className="px-5 py-3 text-white">
                        {shift.staffName}
                      </td>
                      <td className="px-5 py-3 text-[#c0c7d6]">
                        {format(new Date(shift.clockIn), "HH:mm")}
                      </td>
                      <td className="px-5 py-3 text-[#c0c7d6]">
                        {shift.clockOut
                          ? format(new Date(shift.clockOut), "HH:mm")
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-[#c0c7d6]">
                        {sales?.orders ?? 0}
                      </td>
                      <td className="px-5 py-3 text-right text-white font-semibold">
                        {formatPrice(sales?.revenue ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label={t("zreport.gross_revenue")}
          value={formatPrice(report.grossRevenue)}
        />
        <SummaryCard
          label={t("zreport.total_orders")}
          value={String(report.paidOrders)}
        />
        <SummaryCard
          label={t("zreport.to_hand_over")}
          value={formatPrice(report.totalToHandOver)}
          highlight
        />
        <SummaryCard
          label={t("zreport.z_number_label")}
          value={t("zreport.z_number", {
            num: String(report.zNumber).padStart(3, "0"),
          })}
        />
      </div>

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

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] p-4">
      <p className="text-xs text-[#5a6580] mb-1">{label}</p>
      <p
        className={cn(
          "text-lg font-bold",
          highlight ? "text-emerald-400" : "text-white"
        )}
      >
        {value}
      </p>
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

      void printWaiterShiftReport(
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
        }
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
  onBack,
  onSelectReport,
}: {
  licenseKey: string;
  onBack: () => void;
  onSelectReport: (index: number) => void;
}) {
  const historyQuery = useQuery('pos.dashboard.getZReportHistory', {
    licenseKey,
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
  reportIndex,
  onBack,
}: {
  licenseKey: string;
  reportIndex: number;
  onBack: () => void;
}) {
  const historyQuery = useQuery('pos.dashboard.getZReportHistory', {
    licenseKey,
  });
  const history = Array.isArray(historyQuery) ? historyQuery : [];

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
          onClick={() => window.print()}
          className="bg-[#1e2a45] hover:bg-[#2a3a5a] text-white"
        >
          <Printer className="size-4 mr-1.5" />
          Print
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
