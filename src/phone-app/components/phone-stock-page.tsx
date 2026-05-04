import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Box, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { getStockItems } from "@/lib/supabase-pos/stock-ops.ts";
import { cn } from "@/lib/utils.ts";

type StockRow = Awaited<ReturnType<typeof getStockItems>>[number];

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

function stockUnitLabel(unit: unknown, t: (k: string) => string): string {
  const u = String(unit ?? "pc").toLowerCase();
  const key = `phone.stock.unit.${u}`;
  const tr = t(key);
  return tr === key ? u : tr;
}

export default function PhoneStockPage() {
  const { t } = useTranslation("site");
  const { restaurant, refresh: refreshRestaurant } = useDashboardRestaurant();
  const [items, setItems] = useState<StockRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!restaurant?.licenseKey) return;
    setLoading(true);
    setError(false);
    try {
      const rows = await getStockItems(restaurant.licenseKey);
      setItems(rows);
    } catch {
      setItems([]);
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

  const filtered = useMemo(() => {
    const list = items ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        it.categoryName.toLowerCase().includes(q),
    );
  }, [items, query]);

  const lowItems = useMemo(
    () => filtered.filter((it) => it.isLowStock || it.isOutOfStock),
    [filtered],
  );

  const restItems = useMemo(
    () => filtered.filter((it) => !it.isLowStock && !it.isOutOfStock),
    [filtered],
  );

  const totals = useMemo(() => {
    const list = items ?? [];
    let value = 0;
    for (const it of list) {
      const q = it.currentStock ?? 0;
      value += q * Number(it.price ?? 0);
    }
    return { count: list.length, value: Math.round(value * 100) / 100 };
  }, [items]);

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

  const renderCard = (it: StockRow, variant: "low" | "normal") => {
    const u = stockUnitLabel(it.stockUnit, t);
    const cur = it.currentStock ?? 0;
    const minTh = it.lowStockThreshold;
    const priceStr = formatMoney(Number(it.price ?? 0), restaurant.currency);
    const priceLine = t("phone.stock.priceLine", { price: priceStr, unit: u });

    return (
      <li
        key={it._id}
        className={cn(
          "rounded-2xl border p-4 shadow-sm",
          variant === "low"
            ? "border-amber-100/90 bg-[#fffbf5]"
            : "border-slate-200/90 bg-white",
        )}
      >
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{it.name}</p>
            <p className="text-xs text-slate-500">{it.categoryName}</p>
            <p className="mt-2 text-sm font-medium text-slate-800">
              {t("phone.stock.qtyLine", {
                qty: cur,
                unit: u,
              })}
            </p>
            {minTh != null ? (
              <p className="text-xs text-slate-500">
                {t("phone.stock.minLabel", { qty: minTh, unit: u })}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            {it.isOutOfStock ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                {t("phone.stock.statusOut")}
              </span>
            ) : it.isLowStock ? (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {t("phone.stock.statusLow")}
              </span>
            ) : null}
            <p className="max-w-[9rem] text-xs font-medium leading-snug text-slate-600">{priceLine}</p>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="relative flex flex-col bg-transparent text-slate-900">
      <header className="shrink-0 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="pt-2 text-2xl font-bold tracking-tight text-[#0f172a]">{t("phone.stock.title")}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{restaurant.name}</p>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("phone.stock.searchPlaceholder")}
            className="h-11 rounded-xl border-slate-200 bg-white pl-10 shadow-sm"
            type="search"
            autoComplete="off"
          />
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-24">
        {error ? (
          <p className="rounded-xl border border-red-200 bg-white p-4 text-center text-sm text-red-600">
            {t("phone.stock.loadError")}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#5b4ddb] px-3 py-4 shadow-md shadow-[#0066FF]/20">
            <Box className="mb-2 size-6 text-white/90" strokeWidth={2} />
            <p className="text-2xl font-bold tabular-nums text-white">
              {loading ? "—" : totals.count}
            </p>
            <p className="text-xs font-medium text-white/85">{t("phone.stock.totalProducts")}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 px-3 py-4 shadow-md">
            <Package className="mb-2 size-6 text-white/90" strokeWidth={2} />
            <p className="text-xl font-bold tabular-nums leading-tight text-white">
              {loading ? "—" : formatMoney(totals.value, restaurant.currency)}
            </p>
            <p className="mt-1 text-xs font-medium text-white/90">{t("phone.stock.totalValue")}</p>
          </div>
        </div>

        {!loading && (items?.length ?? 0) === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white/80 py-10 text-center text-sm text-slate-500">
            {t("phone.stock.emptyTracked")}
          </p>
        ) : null}

        {lowItems.length > 0 ? (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-[#0f172a]">
              <AlertTriangle className="size-5 text-orange-500" aria-hidden />
              {t("phone.stock.lowSection", { count: lowItems.length })}
            </h2>
            <ul className="flex flex-col gap-3">{lowItems.map((it) => renderCard(it, "low"))}</ul>
          </section>
        ) : null}

        {restItems.length > 0 ? (
          <section>
            <h2 className="mb-2 text-base font-semibold text-[#0f172a]">{t("phone.stock.allSection")}</h2>
            <ul className="flex flex-col gap-3">{restItems.map((it) => renderCard(it, "normal"))}</ul>
          </section>
        ) : null}

        {!loading &&
        (items?.length ?? 0) > 0 &&
        filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t("phone.stock.noSearchResults")}</p>
        ) : null}
      </div>
    </div>
  );
}
