import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  DollarSign,
  Filter,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { getDashboardStats, getSoldItemsByDateTimeRange } from "@/lib/supabase-pos/dashboard-ops.ts";
import { getStockItems } from "@/lib/supabase-pos/stock-ops.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

type StatsBundle = Awaited<ReturnType<typeof getDashboardStats>>;

const TOP_RANK_RING = [
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-orange-100 text-orange-800",
  "bg-violet-100 text-violet-800",
  "bg-emerald-100 text-emerald-800",
];

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

function greetingKey(): "phone.venueHome.greetMorning" | "phone.venueHome.greetAfternoon" | "phone.venueHome.greetEvening" {
  const h = new Date().getHours();
  if (h < 12) return "phone.venueHome.greetMorning";
  if (h < 18) return "phone.venueHome.greetAfternoon";
  return "phone.venueHome.greetEvening";
}

export default function PhoneVenueHome() {
  const { t } = useTranslation("site");
  const { restaurant, refresh: refreshRestaurant } = useDashboardRestaurant();
  const [stats, setStats] = useState<StatsBundle | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [rangeDate, setRangeDate] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [soldItems, setSoldItems] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);
  const [soldLoading, setSoldLoading] = useState(false);
  const [soldError, setSoldError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!restaurant?.licenseKey) return;
    setLoading(true);
    setError(false);
    try {
      const [dash, stock] = await Promise.all([
        getDashboardStats(restaurant.licenseKey, "day"),
        getStockItems(restaurant.licenseKey),
      ]);
      setStats(dash);
      const low = stock.filter((i) => i.isLowStock || i.isOutOfStock).length;
      setLowStockCount(low);
    } catch {
      setStats(null);
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

  useEffect(() => {
    if (rangeDate) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    setRangeDate(`${y}-${m}-${d}`);
  }, [rangeDate]);

  const applySoldFilter = useCallback(async () => {
    if (!restaurant?.licenseKey || !rangeDate) return;
    const fromPart = rangeFrom.trim() || "00:00";
    const toPart = rangeTo.trim() || "23:59";
    const start = new Date(`${rangeDate}T${fromPart}:00`);
    const end = new Date(`${rangeDate}T${toPart}:59`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      toast.error(t("phone.venueHome.invalidRange"));
      return;
    }
    setSoldLoading(true);
    setSoldError(false);
    try {
      const rows = await getSoldItemsByDateTimeRange({
        licenseKey: restaurant.licenseKey,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      });
      setSoldItems(rows);
    } catch {
      setSoldError(true);
      setSoldItems([]);
    } finally {
      setSoldLoading(false);
    }
  }, [rangeDate, rangeFrom, rangeTo, restaurant?.licenseKey, t]);

  useEffect(() => {
    if (restaurant?.licenseKey && rangeDate) void applySoldFilter();
  }, [restaurant?.licenseKey, rangeDate, applySoldFilter]);

  const greet = useMemo(() => greetingKey(), []);

  if (restaurant === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 text-slate-500">
        {t("phone.venues.loading")}
      </div>
    );
  }

  if (restaurant === null) {
    return <Navigate to="/app" replace />;
  }

  const topFive = soldItems.slice(0, 10);

  return (
    <div className="flex flex-col bg-transparent text-slate-900">
      <div
        className={cn(
          "relative shrink-0 px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]",
          "bg-gradient-to-br from-[#0066FF] via-[#5b4ddb] to-[#6d28d9]",
        )}
      >
        <div className="flex items-start gap-3 pt-2 sm:gap-4">
          <img
            src={LOGO_URL}
            alt="Vyntex POS"
            className="h-16 w-16 shrink-0 object-contain drop-shadow-md sm:h-[4.5rem] sm:w-[4.5rem]"
            width={72}
            height={72}
            decoding="async"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white/90">
              {t(greet)} <span aria-hidden>👋</span>
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{restaurant.name}</h1>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/15 px-3 py-3 backdrop-blur-sm">
            <DollarSign className="mb-2 size-5 text-white/90" strokeWidth={2} />
            <p className="text-lg font-bold tabular-nums text-white">
              {loading && !stats ? "—" : formatMoney(stats?.todayRevenue ?? 0, restaurant.currency)}
            </p>
            <p className="text-xs text-white/75">{t("phone.venueHome.salesToday")}</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-3 py-3 backdrop-blur-sm">
            <ShoppingBag className="mb-2 size-5 text-white/90" strokeWidth={2} />
            <p className="text-lg font-bold tabular-nums text-white">
              {loading && !stats ? "—" : stats?.todayOrdersCount ?? 0}
            </p>
            <p className="text-xs text-white/75">{t("phone.venueHome.ordersToday")}</p>
          </div>
        </div>
      </div>

      <main className="flex flex-col gap-3 px-4 pb-4 pt-4">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-4 text-center shadow-sm">
            <p className="text-sm text-red-600">{t("phone.venueHome.loadError")}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
              {t("phone.venueHome.retry")}
            </Button>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white px-2 py-3 text-center shadow-sm">
            <div className="mx-auto mb-1 flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShoppingBag className="size-4" strokeWidth={2} />
            </div>
            <p className="text-lg font-bold tabular-nums text-slate-900">
              {loading && !stats ? "—" : stats?.activeOrders ?? 0}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {t("phone.venueHome.metricActive")}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white px-2 py-3 text-center shadow-sm">
            <div className="mx-auto mb-1 flex size-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <UtensilsCrossed className="size-4" strokeWidth={2} />
            </div>
            <p className="text-lg font-bold tabular-nums text-slate-900">
              {loading && !stats ? "—" : stats?.totalTables ?? 0}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {t("phone.venueHome.metricTables")}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white px-2 py-3 text-center shadow-sm">
            <div className="mx-auto mb-1 flex size-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <AlertTriangle className="size-4" strokeWidth={2} />
            </div>
            <p className="text-lg font-bold tabular-nums text-slate-900">
              {loading ? "—" : lowStockCount}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {t("phone.venueHome.metricLowStock")}
            </p>
          </div>
        </div>

        {!loading && lowStockCount > 0 ? (
          <div className="flex gap-3 rounded-2xl border border-orange-200/80 bg-orange-50/90 px-3 py-3 shadow-sm">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-orange-950">{t("phone.venueHome.lowStockTitle")}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-orange-900/80">
                {t("phone.venueHome.lowStockBody", { count: lowStockCount })}
              </p>
            </div>
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <TrendingUp className="size-3.5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{t("phone.venueHome.soldItemsTitle")}</h2>
              <p className="text-[11px] text-slate-500">{t("phone.venueHome.soldItemsSubtitle")}</p>
            </div>
          </div>
          <div className="mb-4 space-y-2 rounded-2xl bg-slate-50 p-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {t("phone.venueHome.filterDate")}
              </label>
              <Input
                type="date"
                value={rangeDate}
                onChange={(e) => setRangeDate(e.target.value)}
                className="h-10 rounded-xl border-slate-200/80 bg-white text-sm"
              />
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {t("phone.venueHome.fromTime")}
                </label>
                <Input
                  type="time"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="h-10 rounded-xl border-slate-200/80 bg-white text-sm"
                />
              </div>
              <div className="pb-3 text-center text-xs font-semibold text-slate-400">—</div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {t("phone.venueHome.toTime")}
                </label>
                <Input
                  type="time"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="h-10 rounded-xl border-slate-200/80 bg-white text-sm"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">{t("phone.venueHome.timeOptionalHint")}</p>
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-100"
              onClick={() => void applySoldFilter()}
              disabled={soldLoading || !rangeDate}
            >
              <Filter className="mr-1.5 size-3.5" />
              {t("phone.venueHome.applyFilter")}
            </Button>
          </div>
          <ul className="space-y-3">
            {soldError ? (
              <li className="py-2 text-center text-sm text-red-500">{t("phone.venueHome.loadError")}</li>
            ) : null}
            {topFive.length === 0 && !soldLoading && !soldError ? (
              <li className="py-6 text-center text-sm text-slate-400">—</li>
            ) : null}
            {topFive.map((item, i) => (
              <li key={item.name} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    TOP_RANK_RING[i % TOP_RANK_RING.length],
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.quantity} {t("phone.venueHome.soldQty")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                  {formatMoney(item.revenue, restaurant.currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
