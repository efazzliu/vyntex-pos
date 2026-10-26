import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { cn } from "@/lib/utils.ts";
import {
  Banknote,
  Check,
  CheckCircle2,
  Eye,
  Printer,
  Table2,
  UserRound,
  Hash,
} from "lucide-react";
import { usePosLocale } from "./pos-locale-provider.tsx";
import {
  publishCustomerDisplaySnapshot,
  readCachedCustomerDisplaySnapshot,
  readLocalCustomerDisplay,
} from "@/lib/pos-customer-display.ts";

type OrderLine = {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  status: string;
  notes?: string;
};

export type CashPaymentConfirmed = {
  amount: number;
  received: number;
  change: number;
  wasPartial: boolean;
  orderId: string;
};

type CashPaymentScreenProps = {
  licenseKey: string;
  orderId: string;
  orderNumber?: number | string | null;
  tableName: string;
  waiterName: string;
  amountDue: number;
  subtotal: number;
  tax: number;
  orderTotal: number;
  paidSoFar: number;
  receiptTypeLabel: string;
  cashReceivedInput: string;
  onCashReceivedChange: (value: string) => void;
  isSubmitting: boolean;
  confirmed: CashPaymentConfirmed | null;
  onComplete: () => void;
  onCancel: () => void;
  onPrint?: () => void;
  onDone: () => void;
};

function appendMoneyKey(prev: string, key: string, maxDecimals: number): string {
  if (key === "clear") return "";
  if (key === "bksp") return prev.slice(0, -1);
  if (key === ".") {
    if (maxDecimals <= 0) return prev;
    if (prev.includes(".")) return prev;
    return prev === "" ? "0." : `${prev}.`;
  }
  if (!/^\d$/.test(key)) return prev;
  const next = prev + key;
  const frac = next.split(".")[1];
  if (frac !== undefined && frac.length > maxDecimals) return prev;
  if (prev === "0" && !prev.includes(".")) return key;
  return next;
}

function sanitizeMoneyInput(raw: string, maxDecimals: number): string {
  let out = "";
  let sawDot = false;
  for (const ch of raw.replace(",", ".")) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && maxDecimals > 0 && !sawDot) {
      out += ".";
      sawDot = true;
    }
  }
  if (!out.includes(".")) return out;
  const [intPart, frac = ""] = out.split(".");
  return `${intPart}.${frac.slice(0, maxDecimals)}`;
}

function parseMoney(raw: string): number {
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function amountToInput(amount: number, decimals: number): string {
  return amount.toFixed(decimals);
}

function quickDenoms(due: number): number[] {
  const base = [5, 10, 20, 50, 100];
  if (due >= 80) base.push(200);
  if (due >= 200) base.push(500);
  return base;
}

export default function CashPaymentScreen({
  licenseKey,
  orderId,
  orderNumber,
  tableName,
  waiterName,
  amountDue,
  subtotal,
  tax,
  orderTotal,
  paidSoFar,
  receiptTypeLabel,
  cashReceivedInput,
  onCashReceivedChange,
  isSubmitting,
  confirmed,
  onComplete,
  onCancel,
  onPrint,
  onDone,
}: CashPaymentScreenProps) {
  const { t, formatPrice, currency } = usePosLocale();
  const [showPreview, setShowPreview] = useState(true);

  const orderData = useQuery("pos.orders.getOrderWithItems", {
    licenseKey,
    orderId,
  });

  const received = parseMoney(cashReceivedInput);
  const hasReceived = cashReceivedInput.trim() !== "";
  const enough = hasReceived && received + 0.0001 >= amountDue;
  const change = enough
    ? Math.round((received - amountDue) * 100) / 100
    : 0;
  const shortfall = hasReceived && !enough
    ? Math.round((amountDue - received) * 100) / 100
    : 0;

  const lines = useMemo(() => {
    const items = (orderData?.items ?? []) as OrderLine[];
    const grouped: { key: string; name: string; price: number; qty: number }[] =
      [];
    for (const item of items) {
      if (item.status === "cancelled" || item.status === "voided") continue;
      const key = `${item.name.trim().toLowerCase()}|${Math.round(item.price * 100)}|${(item.notes ?? "").trim().toLowerCase()}`;
      const existing = grouped.find((g) => g.key === key);
      if (existing) existing.qty += item.quantity;
      else {
        grouped.push({
          key,
          name: item.name,
          price: item.price,
          qty: item.quantity,
        });
      }
    }
    return grouped;
  }, [orderData]);

  useEffect(() => {
    const displaySettings = readLocalCustomerDisplay(licenseKey);
    if (!displaySettings.enabled) return;
    const prev = readCachedCustomerDisplaySnapshot(licenseKey);
    publishCustomerDisplaySnapshot({
      v: 1,
      kind: "snapshot",
      licenseKey,
      at: Date.now(),
      phase: enough || confirmed ? "change" : "order",
      venueName: prev?.venueName ?? "",
      settings: displaySettings,
      items: lines.map((row) => ({
        name: row.name,
        quantity: row.qty,
        lineTotal: formatPrice(row.price * row.qty),
      })),
      subtotal: formatPrice(subtotal),
      tax: formatPrice(tax),
      total: formatPrice(orderTotal),
      change: formatPrice(confirmed?.change ?? change),
    });
  }, [
    licenseKey,
    enough,
    confirmed,
    lines,
    subtotal,
    tax,
    orderTotal,
    change,
    formatPrice,
  ]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (confirmed || isSubmitting) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          "[data-cash-received-input], textarea, select, [contenteditable='true']",
        )
      ) {
        return;
      }
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        onCashReceivedChange(
          appendMoneyKey(cashReceivedInput, event.key, currency.decimals),
        );
        return;
      }
      if (event.key === "." || event.key === ",") {
        event.preventDefault();
        onCashReceivedChange(
          appendMoneyKey(cashReceivedInput, ".", currency.decimals),
        );
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        onCashReceivedChange(
          appendMoneyKey(cashReceivedInput, "bksp", currency.decimals),
        );
      }
      if (event.key === "Delete") {
        event.preventDefault();
        onCashReceivedChange("");
      }
      if (event.key === "Enter" && enough) {
        event.preventDefault();
        onComplete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    cashReceivedInput,
    confirmed,
    currency.decimals,
    enough,
    isSubmitting,
    onCashReceivedChange,
    onComplete,
  ]);

  const orderLabel =
    orderNumber != null && String(orderNumber).trim() !== ""
      ? `#${orderNumber}`
      : "—";

  const status = confirmed
    ? confirmed.wasPartial
      ? t("order.cash_status_partial")
      : t("order.cash_status_paid")
    : enough
      ? t("order.cash_status_ready")
      : t("order.cash_status_awaiting");

  const statusTone = confirmed
    ? confirmed.wasPartial
      ? "bg-sky-50 text-sky-700 ring-sky-200"
      : "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : enough
      ? "bg-brand/10 text-brand ring-brand/20"
      : "bg-amber-50 text-amber-700 ring-amber-200";

  const press = (key: string) =>
    onCashReceivedChange(appendMoneyKey(cashReceivedInput, key, currency.decimals));

  if (confirmed) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5 pt-3">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[1.75rem] border border-white/70 bg-white/75 px-6 py-10 text-center shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] backdrop-blur-xl">
          <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-brand to-[#22c55e] text-white shadow-[0_12px_28px_-12px_rgba(0,91,214,0.7)]">
            <CheckCircle2 className="size-8" strokeWidth={2} />
          </span>
          <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {t("order.cash_confirmed_kicker")}
          </p>
          <h3 className="mt-2 text-[1.85rem] font-semibold tracking-[-0.04em] text-slate-950">
            {confirmed.wasPartial
              ? t("order.cash_confirmed_partial_title")
              : t("order.cash_confirmed_title")}
          </h3>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-500">
            {confirmed.wasPartial
              ? t("order.cash_confirmed_partial_body")
              : t("order.cash_confirmed_body")}
          </p>
          <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-2">
            <ConfirmStat
              label={t("order.cash_amount_due")}
              value={formatPrice(confirmed.amount)}
            />
            <ConfirmStat
              label={t("order.cash_received_amount")}
              value={formatPrice(confirmed.received)}
            />
            <ConfirmStat
              label={t("order.cash_change_due")}
              value={formatPrice(confirmed.change)}
              accent
            />
          </div>
          <span
            className={cn(
              "mt-5 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1",
              statusTone,
            )}
          >
            {confirmed.wasPartial
              ? t("order.cash_status_partial")
              : t("order.cash_table_closed")}
          </span>
          <div className="mt-8 flex w-full max-w-md flex-col gap-2">
            {onPrint ? (
              <button
                type="button"
                onClick={onPrint}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:text-slate-950"
              >
                <Printer className="size-4" />
                {t("order.cash_print_receipt")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDone}
              className="h-12 rounded-2xl bg-gradient-to-r from-brand to-[#22c55e] text-sm font-semibold text-white shadow-[0_12px_28px_-14px_rgba(0,91,214,0.8)] transition hover:opacity-95"
            >
              {t("order.cash_done")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const denoms = quickDenoms(amountDue);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MetaChip icon={Hash} label={t("order.cash_meta_order")} value={orderLabel} />
        <MetaChip icon={Table2} label={t("order.cash_meta_table")} value={tableName || "—"} />
        <MetaChip icon={UserRound} label={t("order.cash_meta_waiter")} value={waiterName || "—"} />
        <span
          className={cn(
            "ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1",
            statusTone,
          )}
        >
          {status}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/70 p-4 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.4)] backdrop-blur-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
            {t("order.cash_amount_due")}
          </p>
          <p className="mt-1 text-[2.55rem] font-semibold leading-none tracking-[-0.05em] text-slate-950 tabular-nums">
            {formatPrice(amountDue)}
          </p>
          <p className="mt-2 text-[12px] text-slate-400">{receiptTypeLabel}</p>

          <label className="mt-5 block">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              {t("order.cash_received_amount")}
            </span>
            <input
              data-cash-received-input=""
              autoFocus
              inputMode="decimal"
              autoComplete="off"
              value={cashReceivedInput}
              placeholder={amountToInput(0, currency.decimals)}
              onChange={(event) =>
                onCashReceivedChange(
                  sanitizeMoneyInput(event.target.value, currency.decimals),
                )
              }
              className="mt-1 w-full bg-transparent text-[2rem] font-semibold tracking-[-0.045em] text-brand outline-none placeholder:text-slate-300 tabular-nums"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() =>
                onCashReceivedChange(amountToInput(amountDue, currency.decimals))
              }
              className="h-8 rounded-full bg-brand px-3 text-[11px] font-semibold text-white"
            >
              {t("order.cash_exact")}
            </button>
            {denoms.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() =>
                  onCashReceivedChange(amountToInput(n, currency.decimals))
                }
                className={cn(
                  "h-8 rounded-full bg-white px-3 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80 transition hover:text-brand",
                  parseMoney(cashReceivedInput) === n &&
                    "bg-brand/10 text-brand ring-brand/30",
                )}
              >
                {formatPrice(n)}
              </button>
            ))}
          </div>

          <div
            className={cn(
              "mt-4 rounded-2xl px-3.5 py-3 ring-1",
              enough
                ? "bg-emerald-50/80 ring-emerald-100"
                : shortfall > 0
                  ? "bg-amber-50/80 ring-amber-100"
                  : "bg-slate-50/80 ring-slate-100",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {enough
                ? t("order.cash_change_due")
                : shortfall > 0
                  ? t("order.cash_need_more")
                  : t("order.cash_change_due")}
            </p>
            <p
              className={cn(
                "mt-1 text-[1.55rem] font-semibold leading-none tracking-[-0.04em] tabular-nums",
                enough ? "text-emerald-700" : "text-slate-950",
              )}
            >
              {formatPrice(enough ? change : shortfall)}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  press(d);
                }}
                className="h-11 rounded-xl bg-[#eef2f7] text-lg font-medium text-slate-900 transition hover:bg-[#e4e9ef] active:scale-[0.98]"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                if (currency.decimals > 0) press(".");
              }}
              className="h-11 rounded-xl bg-[#eef2f7] text-lg font-medium text-slate-900 transition hover:bg-[#e4e9ef]"
            >
              {currency.decimals > 0 ? "." : ""}
            </button>
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                press("0");
              }}
              className="h-11 rounded-xl bg-[#eef2f7] text-lg font-medium text-slate-900 transition hover:bg-[#e4e9ef]"
            >
              0
            </button>
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                press("bksp");
              }}
              className="h-11 rounded-xl bg-[#eef2f7] text-lg font-medium text-slate-900 transition hover:bg-[#e4e9ef]"
            >
              ⌫
            </button>
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              type="button"
              disabled={!enough || isSubmitting}
              onClick={onComplete}
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-[#22c55e] text-[15px] font-semibold text-white shadow-[0_16px_32px_-16px_rgba(0,91,214,0.75)] transition hover:opacity-95 disabled:cursor-default disabled:opacity-40"
            >
              <Banknote className="size-4" />
              {isSubmitting ? t("common.loading") : t("order.cash_complete")}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
              className="h-10 text-[13px] font-semibold text-slate-400 transition hover:text-slate-700 disabled:opacity-40"
            >
              {t("order.cash_cancel")}
            </button>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/80 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.4)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                {t("order.cash_order_summary")}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-slate-950">
                {t("order.cash_preview_receipt")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="grid size-9 place-items-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:text-slate-950"
              aria-label={t("order.cash_preview_receipt")}
            >
              {showPreview ? <Check className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-4">
            <div className="rounded-2xl bg-[#f8fafc] px-3.5 py-3 ring-1 ring-slate-100">
              <div className="mb-3 text-center">
                <p className="text-[12px] font-semibold tracking-tight text-slate-950">
                  Vyntex POS
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  {tableName} · {orderLabel}
                </p>
              </div>
              {showPreview ? (
                <ul className="space-y-2">
                  {lines.map((line) => (
                    <li
                      key={line.key}
                      className="flex items-start justify-between gap-2 text-[12px]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800">
                          {line.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatPrice(line.price)} × {line.qty}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-slate-950">
                        {formatPrice(line.price * line.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-[12px] text-slate-400">
                  {t("order.cash_preview_hidden")}
                </p>
              )}
              <div className="mt-3 space-y-1.5 border-t border-dashed border-slate-200 pt-3 text-[12px]">
                <SummaryRow label={t("common.subtotal")} value={formatPrice(subtotal)} />
                <SummaryRow label={t("common.tax")} value={formatPrice(tax)} />
                <SummaryRow
                  label={t("common.total")}
                  value={formatPrice(orderTotal)}
                  strong
                />
                {paidSoFar > 0.009 ? (
                  <SummaryRow
                    label={t("order.paid_so_far")}
                    value={formatPrice(paidSoFar)}
                  />
                ) : null}
                <SummaryRow
                  label={t("order.due_now")}
                  value={formatPrice(amountDue)}
                  strong
                  accent
                />
              </div>
            </div>
          </div>

          {onPrint ? (
            <div className="p-4 pt-3">
              <button
                type="button"
                onClick={onPrint}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[13px] font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:text-slate-950"
              >
                <Printer className="size-4" />
                {t("order.cash_print_receipt")}
              </button>
            </div>
          ) : (
            <div className="h-4" />
          )}
        </aside>
      </div>
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200/70 backdrop-blur-sm">
      <Icon className="size-3 text-brand" />
      <span className="font-medium text-slate-400">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </span>
  );
}

function ConfirmStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-2.5 py-3 ring-1 ring-slate-100">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-[13px] font-semibold tabular-nums",
          accent ? "text-brand" : "text-slate-950",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
  accent = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className={strong ? "font-semibold text-slate-800" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          accent
            ? "font-semibold text-brand"
            : strong
              ? "font-semibold text-slate-950"
              : "text-slate-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}
