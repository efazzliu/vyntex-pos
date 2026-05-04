import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, sq } from "date-fns/locale";
import { CheckCircle2, Clock, Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import siteI18n from "@/lib/site-i18n.ts";
import {
  fetchPhoneActiveOrders,
  fetchPhoneOrdersHistoryToday,
  type PhoneActiveOrderCard,
  type PhoneHistoryOrderRow,
  type PhoneOrderUiStatus,
} from "@/lib/supabase-pos/phone-orders-ops.ts";
import { cn } from "@/lib/utils.ts";

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.length === 3 ? currency : "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  }
}

function relTime(iso: string): string {
  const lng = siteI18n.language.startsWith("sq") ? sq : enUS;
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: lng });
  } catch {
    return "";
  }
}

const STATUS_STYLES: Record<
  PhoneOrderUiStatus,
  { card: string; label: string; icon: typeof Clock }
> = {
  waiting: {
    card: "border-amber-200/90 bg-amber-50/80",
    label: "bg-amber-100/90 text-amber-900",
    icon: Clock,
  },
  preparing: {
    card: "border-[#0066FF]/25 bg-[#0066FF]/[0.06]",
    label: "bg-[#0066FF]/15 text-[#0044aa]",
    icon: Package,
  },
  ready: {
    card: "border-emerald-200/90 bg-emerald-50/80",
    label: "bg-emerald-100/90 text-emerald-900",
    icon: CheckCircle2,
  },
};

export default function PhoneOrdersPage() {
  const { t } = useTranslation("site");
  const { restaurant, refresh: refreshRestaurant } = useDashboardRestaurant();
  const [active, setActive] = useState<PhoneActiveOrderCard[] | null>(null);
  const [history, setHistory] = useState<PhoneHistoryOrderRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!restaurant?.licenseKey) return;
    setLoading(true);
    setError(false);
    try {
      const [a, h] = await Promise.all([
        fetchPhoneActiveOrders(restaurant.licenseKey),
        fetchPhoneOrdersHistoryToday(restaurant.licenseKey),
      ]);
      setActive(a);
      setHistory(h);
    } catch {
      setActive([]);
      setHistory([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [restaurant?.licenseKey]);

  useEffect(() => {
    void refreshRestaurant();
  }, [refreshRestaurant]);

  useEffect(() => {
    if (restaurant?.licenseKey) void load();
  }, [restaurant?.licenseKey, load]);

  if (restaurant === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        {t("phone.venues.loading")}
      </div>
    );
  }

  if (restaurant === null) {
    return <Navigate to="/app" replace />;
  }

  const statusLabel = (s: PhoneOrderUiStatus) => {
    if (s === "waiting") return t("phone.orders.statusWaiting");
    if (s === "preparing") return t("phone.orders.statusPreparing");
    return t("phone.orders.statusReady");
  };

  const timeLabel = (iso: string) => relTime(iso);

  return (
    <div className="flex flex-col bg-transparent text-slate-900">
      <header className="shrink-0 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="pt-2 text-2xl font-bold tracking-tight text-[#0f172a]">
          {t("phone.orders.title")}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">{restaurant.name}</p>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-4">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-4 text-center shadow-sm">
            <p className="text-sm text-red-600">{t("phone.orders.loadError")}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
              {t("phone.venueHome.retry")}
            </Button>
          </div>
        ) : null}

        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#0f172a]">{t("phone.orders.activeSection")}</h2>
            <span className="flex min-w-7 items-center justify-center rounded-full bg-[#0066FF]/12 px-2 py-0.5 text-xs font-semibold text-[#0066FF] tabular-nums">
              {loading ? "—" : (active?.length ?? 0)}
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            {!loading && (active?.length ?? 0) === 0 ? (
              <li className="rounded-2xl border border-dashed border-slate-200 bg-white/80 py-10 text-center text-sm text-slate-500">
                {t("phone.orders.emptyActive")}
              </li>
            ) : null}
            {(active ?? []).map((order) => {
              const st = STATUS_STYLES[order.uiStatus];
              const Icon = st.icon;
              return (
                <li
                  key={order.saleId}
                  className={cn(
                    "rounded-2xl border p-4 shadow-sm",
                    st.card,
                  )}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <span className="font-bold text-slate-900">#{order.orderNumber}</span>
                    <div
                      className={cn(
                        "inline-flex items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        st.label,
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" strokeWidth={2} />
                      {statusLabel(order.uiStatus)}
                    </div>
                    <span className="justify-self-end font-bold tabular-nums text-slate-900">
                      {formatMoney(order.total, restaurant.currency)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {t("phone.orders.tableLabel", { name: order.tableName })}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                    {order.items.length === 0 ? (
                      <li className="text-slate-400">—</li>
                    ) : (
                      order.items.map((it) => (
                        <li key={`${order.saleId}-${it.name}-${it.quantity}`}>
                          • {it.quantity}× {it.name}
                        </li>
                      ))
                    )}
                  </ul>
                  <p className="mt-2 text-xs text-slate-400">{timeLabel(order.createdAt)}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[#0f172a]">{t("phone.orders.historySection")}</h2>
          <ul className="flex flex-col gap-2">
            {!loading && (history?.length ?? 0) === 0 ? (
              <li className="rounded-xl border border-slate-200/80 bg-white py-6 text-center text-sm text-slate-400">
                {t("phone.orders.emptyHistory")}
              </li>
            ) : null}
            {(history ?? []).map((row) => (
              <li
                key={row.saleId}
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">#{row.orderNumber}</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-800">
                      {formatMoney(row.total, restaurant.currency)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t("phone.orders.tableLabel", { name: row.tableName })}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {timeLabel(row.paidAt ?? row.createdAt)}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
