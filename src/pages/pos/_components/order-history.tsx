import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { format, isSameDay } from "date-fns";
import {
  ClipboardList,
  Search,
  CheckCircle2,
  XCircle,
  Filter,
  Receipt,
  Printer,
  ChevronRight,
  Clock,
  CreditCard,
  Banknote,
  FileWarning,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePosLocale } from "./pos-locale-provider.tsx";

type OrderHistoryProps = {
  licenseKey: string;
  staffId: string;
  staffName: string;
  staffRole: string;
};

type ClosedOrder = {
  _id: Id<"orders">;
  orderNumber: number;
  tableName: string;
  staffName: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  paymentType?: string;
  fiscalStatus: boolean;
  createdAt: string;
  paidAt?: string;
  originalTotal?: number;
  customerName?: string;
};

const PAYMENT_METHOD_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  other: Receipt,
};

function paymentMethodLabel(method: string, t: (k: string) => string): string {
  const key =
    method === "cash"
      ? "payment.cash"
      : method === "card"
        ? "payment.card"
        : method === "other"
          ? "payment.other"
          : "";
  if (!key) return method;
  const out = t(key);
  return out === key ? method : out;
}

function orderHistoryAnchorDate(o: ClosedOrder): Date {
  return new Date(o.paidAt ?? o.createdAt);
}

function isOrderOnLocalCalendarDay(o: ClosedOrder, day: Date): boolean {
  return isSameDay(orderHistoryAnchorDate(o), day);
}

function orderHistorySortTime(o: ClosedOrder): number {
  return orderHistoryAnchorDate(o).getTime();
}

function buildTodayDisplaySequenceById(orders: ClosedOrder[]): Map<string, number> {
  const sorted = [...orders].sort(
    (a, b) => orderHistorySortTime(a) - orderHistorySortTime(b),
  );
  const map = new Map<string, number>();
  sorted.forEach((o, i) => map.set(String(o._id), i + 1));
  return map;
}

function paymentTypeLabel(type: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    fiscal: "dashboard.pay_fiscal",
    non_fiscal: "dashboard.pay_non_fiscal",
    no_receipt: "dashboard.pay_no_receipt",
    debt: "dashboard.pay_debt",
    complimentary: "dashboard.pay_complimentary",
  };
  const key = map[type];
  if (!key) return type;
  const out = t(key);
  return out === key ? type : out;
}

/** Column template: wider horizontal rhythm (closer to Total / Payment / Fiscal grouping). */
const ORDER_HISTORY_GRID =
  "grid grid-cols-[52px_minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1.2fr)_minmax(92px,0.95fr)_minmax(104px,1fr)_68px_40px] gap-x-5 gap-y-1 max-sm:gap-x-3";

export default function OrderHistory({
  licenseKey,
  staffId,
  staffName,
  staffRole,
}: OrderHistoryProps) {
  const { t, formatPrice } = usePosLocale();
  const closedOrders = useQuery('pos.orders.getClosedOrders', { licenseKey });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNonFiscal, setFilterNonFiscal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [selectedDisplaySequence, setSelectedDisplaySequence] = useState<number | null>(null);

  const isLoading = closedOrders === undefined;
  const canManage = staffRole === "admin" || staffRole === "manager";

  const todayOrders = useMemo(() => {
    if (!closedOrders) return [];
    const day = new Date();
    return closedOrders.filter((o) => isOrderOnLocalCalendarDay(o, day));
  }, [closedOrders]);

  const displaySequenceById = useMemo(
    () => buildTodayDisplaySequenceById(todayOrders),
    [todayOrders],
  );

  // Filter orders (only today's shift / calendar day)
  const filteredOrders = useMemo(() => {
    let results = todayOrders;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter((o) => {
        const seq = displaySequenceById.get(String(o._id));
        return (
          (o.tableName ?? "").toLowerCase().includes(q) ||
          (o.staffName ?? "").toLowerCase().includes(q) ||
          String(o.orderNumber).includes(q) ||
          (seq !== undefined && String(seq).includes(q))
        );
      });
    }

    if (filterNonFiscal) {
      results = results.filter((o) => !o.fiscalStatus && o.status === "paid");
    }

    return results;
  }, [todayOrders, searchQuery, filterNonFiscal, displaySequenceById]);

  // ── Loading ────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-64 bg-[#131A2E]" />
        <Skeleton className="h-12 w-full bg-[#131A2E]" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl bg-[#131A2E]" />
        ))}
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────
  if (todayOrders.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <Header />
        <div className="mt-16">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardList />
              </EmptyMedia>
              <EmptyTitle>{t("orders_hist.empty_title")}</EmptyTitle>
              <EmptyDescription>{t("orders_hist.empty_desc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  // Counts for the stats bar (today only)
  const totalOrders = todayOrders.length;
  const fiscalizedCount = todayOrders.filter((o) => o.fiscalStatus).length;
  const nonFiscalCount = todayOrders.filter((o) => !o.fiscalStatus && o.status === "paid").length;
  const totalRevenue = todayOrders
    .filter((o) => o.status === "paid")
    .reduce((s, o) => s + o.total, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Header />

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatPill label={t("orders_hist.stat_total")} value={totalOrders} color="#0066FF" />
        <StatPill label={t("orders_hist.stat_fiscal")} value={fiscalizedCount} color="#22C55E" />
        <StatPill label={t("orders_hist.stat_non_fiscal")} value={nonFiscalCount} color="#EF4444" />
        <StatPill label={t("orders_hist.stat_revenue")} value={formatPrice(totalRevenue)} color="#F59E0B" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5a6580]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("orders_hist.search_ph")}
            className="bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] pl-10 h-10"
          />
        </div>
        <Button
          variant={filterNonFiscal ? "default" : "secondary"}
          size="sm"
          onClick={() => setFilterNonFiscal(!filterNonFiscal)}
          className={cn(
            "h-10 shrink-0",
            filterNonFiscal
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
              : "bg-[#131A2E] text-[#8b93a7] hover:bg-[#1e2a45] border border-[#1e2a45]"
          )}
        >
          <Filter className="size-4 mr-1.5" />
          {t("orders_hist.filter_non_fiscal")}
          {nonFiscalCount > 0 && (
            <span className="ml-1.5 bg-red-500/30 text-red-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {nonFiscalCount}
            </span>
          )}
        </Button>
      </div>

      {/* Order table */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] overflow-hidden">
        {/* Header row */}
        <div
          className={cn(
            ORDER_HISTORY_GRID,
            "items-center px-4 py-4 border-b border-[#1e2a45] bg-[#0D1326]",
          )}
        >
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider">
            {t("orders_hist.col_hash")}
          </span>
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider">
            {t("orders_hist.col_table")}
          </span>
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider">
            {t("orders_hist.col_waiter")}
          </span>
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider">
            {t("orders_hist.col_closed")}
          </span>
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider text-right">
            {t("orders_hist.col_total")}
          </span>
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider text-center">
            {t("orders_hist.col_payment")}
          </span>
          <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-wider text-center">
            {t("orders_hist.col_fiscal")}
          </span>
          <span />
        </div>

        {/* Scrollable rows */}
        <div className="max-h-[calc(100vh-420px)] overflow-auto">
          {filteredOrders.length === 0 ? (
            <div className="px-4 py-10 text-center text-[#5a6580] text-sm">
              {t("orders_hist.no_match")}
            </div>
          ) : (
            filteredOrders.map((order) => (
              <OrderRow
                key={order._id}
                order={order}
                displaySequence={displaySequenceById.get(String(order._id)) ?? 0}
                onSelect={() => {
                  setSelectedOrderId(order._id);
                  setSelectedDisplaySequence(
                    displaySequenceById.get(String(order._id)) ?? null,
                  );
                }}
                t={t}
                formatPrice={formatPrice}
              />
            ))
          )}
        </div>
      </div>

      {/* Count footer */}
      <p className="text-xs text-[#5a6580]">
        {t("orders_hist.footer", { shown: filteredOrders.length, total: totalOrders })}
      </p>

      {/* Order Detail Side Panel */}
      <OrderDetailSheet
        licenseKey={licenseKey}
        orderId={selectedOrderId}
        listDisplaySequence={selectedDisplaySequence}
        staffId={staffId as Id<"staff">}
        staffName={staffName}
        canManage={canManage}
        onClose={() => {
          setSelectedOrderId(null);
          setSelectedDisplaySequence(null);
        }}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function Header() {
  const { t } = usePosLocale();
  return (
    <div>
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <ClipboardList className="size-6" />
        {t("nav.order_history")}
      </h1>
      <p className="text-[#8b93a7] text-sm mt-1">{t("orders_hist.subtitle")}</p>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#131A2E] px-4 py-3 flex items-center gap-3">
      <div
        className="w-2 h-8 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <div>
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-[10px] text-[#5a6580] uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function OrderRow({
  order,
  displaySequence,
  onSelect,
  t,
  formatPrice,
}: {
  order: ClosedOrder;
  displaySequence: number;
  onSelect: () => void;
  t: (k: string, options?: Record<string, unknown>) => string;
  formatPrice: (n: number) => string;
}) {
  const MethodIcon =
    PAYMENT_METHOD_ICONS[order.paymentMethod ?? ""] ?? Receipt;
  const methodLabel = order.paymentMethod
    ? paymentMethodLabel(order.paymentMethod, t)
    : "—";

  return (
    <button
      onClick={onSelect}
      className={cn(
        ORDER_HISTORY_GRID,
        "items-center px-4 py-5 border-b border-[#1e2a45]/50 last:border-b-0 hover:bg-[#1a2240] transition-colors cursor-pointer w-full text-left",
      )}
    >
      {/* Order # (sequential for today, 1…n) */}
      <span className="text-sm font-mono font-semibold text-white tabular-nums">
        {displaySequence > 0 ? displaySequence : "—"}
      </span>

      {/* Table */}
      <span className="text-sm text-white truncate">
        {(order.tableName ?? "").trim() || "—"}
      </span>

      {/* Waiter */}
      <span className="text-sm text-[#8b93a7] truncate">
        {(order.staffName ?? "").trim() || "—"}
      </span>

      {/* Closed at */}
      <span className="text-xs text-[#8b93a7]">
        {order.paidAt ? format(new Date(order.paidAt), "dd MMM HH:mm") : "—"}
      </span>

      {/* Total */}
      <span className="text-sm font-semibold text-white text-right">
        {formatPrice(order.total)}
      </span>

      {/* Payment method */}
      <div className="flex items-center justify-center">
        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-[#0A0F1E] text-[#8b93a7]">
          <MethodIcon className="size-3" />
          {methodLabel}
        </span>
      </div>

      {/* Fiscal status */}
      <div className="flex justify-center">
        {order.status === "cancelled" ? (
          <span className="text-[10px] text-[#5a6580]">{t("orders_hist.fiscal_na")}</span>
        ) : order.fiscalStatus ? (
          <CheckCircle2 className="size-5 text-emerald-400" />
        ) : (
          <XCircle className="size-5 text-red-400" />
        )}
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <ChevronRight className="size-4 text-[#3a4560]" />
      </div>
    </button>
  );
}

// ── Order Detail Sheet ──────────────────────────────────

type OrderDetailSheetProps = {
  licenseKey: string;
  orderId: Id<"orders"> | null;
  /** Today's list row number (1…n), if opened from the list */
  listDisplaySequence: number | null;
  staffId: Id<"staff">;
  staffName: string;
  canManage: boolean;
  onClose: () => void;
};

function OrderDetailSheet({
  licenseKey,
  orderId,
  listDisplaySequence,
  staffId,
  staffName,
  canManage,
  onClose,
}: OrderDetailSheetProps) {
  const { t, formatPrice } = usePosLocale();
  const orderDetail = useQuery(
    'pos.orders.getOrderWithItems',
    orderId ? { licenseKey, orderId } : "skip"
  );
  const generateFiscal = useMutation('pos.orders.generateFiscalCoupon');
  const [fiscalizing, setFiscalizing] = useState(false);

  const isFiscalized = orderDetail?.fiscalStatus === true || orderDetail?.paymentType === "fiscal";

  const handleGenerateFiscal = async () => {
    if (!orderId || !canManage) return;
    setFiscalizing(true);
    try {
      await generateFiscal({ licenseKey, orderId, staffId });
      toast.success(t("orders_hist.fiscal_toast_ok"));
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message: string };
        toast.error(data.message);
      } else {
        toast.error(t("orders_hist.fiscal_toast_fail"));
      }
    } finally {
      setFiscalizing(false);
    }
  };

  const handleReprint = () => {
    toast.info(t("orders_hist.reprint_toast"));
  };

  return (
    <Sheet open={orderId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="bg-[#131A2E] border-[#1e2a45] text-white w-full sm:max-w-lg p-0 flex flex-col [&>button]:text-[#8b93a7]"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-[#1e2a45] shrink-0">
          <SheetTitle className="text-white text-lg flex items-center gap-2">
            <Receipt className="size-5" />
            {orderDetail
              ? t("orders_hist.detail_order", {
                  number:
                    listDisplaySequence != null && listDisplaySequence > 0
                      ? listDisplaySequence
                      : orderDetail.orderNumber,
                })
              : t("common.loading")}
          </SheetTitle>
        </SheetHeader>

        {!orderDetail ? (
          <div className="flex-1 p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 bg-[#0A0F1E]" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Order metadata */}
              <div className="px-6 py-4 space-y-3 border-b border-[#1e2a45]">
                <div className="grid grid-cols-2 gap-3">
                  <MetaItem
                    icon={Clock}
                    label={t("orders_hist.opened")}
                    value={format(new Date(orderDetail.createdAt), "dd MMM yyyy HH:mm")}
                  />
                  <MetaItem
                    icon={Clock}
                    label={t("orders_hist.closed")}
                    value={
                      orderDetail.paidAt
                        ? format(new Date(orderDetail.paidAt), "dd MMM yyyy HH:mm")
                        : "—"
                    }
                  />
                  <MetaItem
                    icon={Receipt}
                    label={t("orders_hist.col_table")}
                    value={orderDetail.tableName}
                  />
                  <MetaItem
                    icon={ShieldCheck}
                    label={t("orders_hist.col_waiter")}
                    value={orderDetail.staffName}
                  />
                </div>

                {/* Fiscal + Payment badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className={cn(
                    "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                    isFiscalized
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-red-500/15 text-red-400"
                  )}>
                    {isFiscalized ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                    {isFiscalized
                      ? t("orders_hist.fiscalized")
                      : t("orders_hist.not_fiscalized")}
                  </span>
                  {orderDetail.paymentType && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#0A0F1E] text-[#8b93a7]">
                      {paymentTypeLabel(orderDetail.paymentType, t)}
                    </span>
                  )}
                  {orderDetail.paymentMethod && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#0A0F1E] text-[#8b93a7]">
                      {paymentMethodLabel(orderDetail.paymentMethod, t)}
                    </span>
                  )}
                  {orderDetail.status === "cancelled" && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400">
                      {t("orders_hist.cancelled")}
                    </span>
                  )}
                </div>

                {orderDetail.customerName && (
                  <p className="text-xs">
                    <span className="text-[#8b93a7]">{t("audit.label_customer")}: </span>
                    <span className="text-white">{orderDetail.customerName}</span>
                  </p>
                )}
              </div>

              {/* Itemized receipt */}
              <div className="px-6 py-4">
                <h3 className="text-xs font-semibold text-[#5a6580] uppercase tracking-wider mb-3">
                  {t("common.items")}
                </h3>
                <div className="space-y-1">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_50px_70px_70px] gap-2 pb-2 border-b border-[#1e2a45]/50">
                    <span className="text-[10px] text-[#5a6580] uppercase tracking-wider">
                      {t("orders_hist.col_product")}
                    </span>
                    <span className="text-[10px] text-[#5a6580] uppercase tracking-wider text-center">
                      {t("orders_hist.col_qty")}
                    </span>
                    <span className="text-[10px] text-[#5a6580] uppercase tracking-wider text-right">
                      {t("orders_hist.col_unit")}
                    </span>
                    <span className="text-[10px] text-[#5a6580] uppercase tracking-wider text-right">
                      {t("orders_hist.col_subtotal")}
                    </span>
                  </div>

                  <AnimatePresence>
                    {orderDetail.items
                      .filter((item) => item.status !== "cancelled" && item.status !== "voided")
                      .map((item) => (
                        <motion.div
                          key={item._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="grid grid-cols-[1fr_50px_70px_70px] gap-2 py-2 border-b border-[#1e2a45]/30 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{item.name}</p>
                            {item.notes && (
                              <p className="text-[10px] text-[#5a6580] truncate">{item.notes}</p>
                            )}
                          </div>
                          <span className="text-sm text-[#8b93a7] text-center">{item.quantity}</span>
                          <span className="text-sm text-[#8b93a7] text-right">
                            {formatPrice(item.price)}
                          </span>
                          <span className="text-sm font-medium text-white text-right">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </motion.div>
                      ))}
                  </AnimatePresence>

                  {/* Voided items (grayed out) */}
                  {orderDetail.items
                    .filter((item) => item.status === "voided")
                    .map((item) => (
                      <div
                        key={item._id}
                        className="grid grid-cols-[1fr_50px_70px_70px] gap-2 py-2 border-b border-[#1e2a45]/30 last:border-b-0 opacity-40 line-through"
                      >
                        <span className="text-sm text-[#8b93a7] truncate">{item.name}</span>
                        <span className="text-sm text-[#5a6580] text-center">{item.quantity}</span>
                        <span className="text-sm text-[#5a6580] text-right">
                          {formatPrice(item.price)}
                        </span>
                        <span className="text-sm text-[#5a6580] text-right">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="mt-4 pt-3 border-t border-[#1e2a45] space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8b93a7]">{t("common.subtotal")}</span>
                    <span className="text-white">{formatPrice(orderDetail.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8b93a7]">{t("common.tax")}</span>
                    <span className="text-white">{formatPrice(orderDetail.tax)}</span>
                  </div>
                  {orderDetail.originalTotal !== undefined && orderDetail.originalTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-400">{t("orders_hist.original_total")}</span>
                      <span className="text-amber-400 line-through">
                        {formatPrice(orderDetail.originalTotal)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-1 border-t border-[#1e2a45]">
                    <span className="text-white">{t("common.total")}</span>
                    <span className="text-white">{formatPrice(orderDetail.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {canManage && orderDetail.status === "paid" && (
              <div className="px-6 py-4 border-t border-[#1e2a45] shrink-0 space-y-2">
                {!isFiscalized && (
                  <Button
                    onClick={handleGenerateFiscal}
                    disabled={fiscalizing}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
                  >
                    <FileWarning className="size-4 mr-2" />
                    {fiscalizing
                      ? t("orders_hist.generating")
                      : t("orders_hist.generate_fiscal")}
                  </Button>
                )}
                {isFiscalized && (
                  <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium">
                    <CheckCircle2 className="size-4" />
                    {t("orders_hist.fiscalized")}
                    {orderDetail.fiscalizedAt && (
                      <span className="text-emerald-400/60 text-xs ml-1">
                        ({format(new Date(orderDetail.fiscalizedAt), "dd MMM HH:mm")})
                      </span>
                    )}
                  </div>
                )}
                <Button
                  variant="secondary"
                  onClick={handleReprint}
                  className="w-full bg-[#0A0F1E] border border-[#1e2a45] text-[#8b93a7] hover:text-white hover:bg-[#1e2a45] h-10"
                >
                  <Printer className="size-4 mr-2" />
                  {t("orders_hist.reprint_btn")}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MetaItem({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-4 text-[#5a6580] mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-[#5a6580] uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white">{value}</p>
      </div>
    </div>
  );
}
