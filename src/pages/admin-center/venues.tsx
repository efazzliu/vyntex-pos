import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { setDashboardRestaurantId } from "@/hooks/use-dashboard-restaurant.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { useAdminCenter } from "@/pages/dashboard/_components/admin-center-context.tsx";
import { AdminPage, StatusDot, acCard, acCardHover } from "@/pages/dashboard/_components/admin-center-ui.tsx";
import { loadAdminOverview } from "@/pages/dashboard/_lib/admin-center-data.ts";
import { formatEur, formatInt, relativeTime } from "@/pages/dashboard/_lib/admin-center-format.ts";

export default function DashboardVenuesPage() {
  const { t, lang } = useDashboardLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const focus = params.get("focus");
  const { rawVenues, venueFilterId, datePreset, customRange, openRenew } = useAdminCenter();

  const overviewQuery = useQuery({
    queryKey: [
      "admin-center",
      "venues-perf",
      venueFilterId,
      datePreset,
      chartKey(customRange),
      lang,
      rawVenues.map((v) => v.id).join(","),
    ],
    queryFn: () =>
      loadAdminOverview({
        venues: rawVenues,
        venueFilterId: "all",
        preset: datePreset,
        customRange,
        chartRange: "30d",
        lang,
      }),
    enabled: rawVenues.length > 0,
  });

  const rows = useMemo(() => {
    const perf = overviewQuery.data?.performance ?? [];
    const byId = new Map(perf.map((p) => [p.venueId, p]));
    return (overviewQuery.data?.venues ?? []).map((venue) => ({
      venue,
      stats: byId.get(venue.id),
    }));
  }, [overviewQuery.data]);

  if (overviewQuery.isLoading && rawVenues.length > 0) {
    return (
      <AdminPage className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
            {t("ac.nav.admin_center")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {t("ac.venues.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("ac.venues.subtitle")}</p>
        </div>
        <Button asChild className="h-10 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
          <Link to="/app">
            <Plus className="size-4" />
            {t("ac.overview.add_venue")}
          </Link>
        </Button>
      </header>

      {rows.length === 0 ? (
        <section className={cn(acCard, "p-10 text-center")}>
          <Store className="mx-auto size-10 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold">{t("ac.venues.empty_title")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("ac.venues.empty_body")}</p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ venue, stats }) => {
            const focused = focus === venue.id;
            return (
              <article
                key={venue.id}
                className={cn(
                  acCard,
                  acCardHover,
                  "p-5",
                  focused && "ring-2 ring-indigo-400/70",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                      <Store className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-slate-900">{venue.name}</h2>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="size-3.5" />
                        {venue.city || venue.address || "—"}
                      </p>
                    </div>
                  </div>
                  <StatusDot health={venue.health} label={t(`ac.license.${venue.health}`)} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-600">
                    {venue.planLabel}
                  </span>
                  {stats?.lastActive ? (
                    <span className="text-slate-400">
                      {t("ac.venues.last_active")}: {relativeTime(stats.lastActive, lang)}
                    </span>
                  ) : null}
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label={t("ac.kpi.revenue")} value={formatEur(stats?.revenue ?? 0, true)} />
                  <Stat label={t("ac.kpi.orders")} value={formatInt(stats?.orders ?? 0)} />
                  <Stat label={t("ac.venues.staff")} value={String(stats?.staff ?? 0)} />
                  <Stat label={t("ac.venues.tables")} value={String(stats?.tables ?? 0)} />
                </dl>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                    onClick={() => {
                      setDashboardRestaurantId(venue.id);
                      navigate("/app/venue");
                    }}
                  >
                    {t("ac.venues.open")}
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      openRenew({
                        venueId: venue.id,
                        venueName: venue.name,
                        plan: venue.planLabel,
                        expiry: venue.license_expiry,
                      })
                    }
                  >
                    {t("ac.license.manage")}
                  </Button>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">{t("ac.hierarchy.open_hint")}</p>
              </article>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function chartKey(range?: { from: Date; to: Date }) {
  if (!range) return "";
  return `${range.from.toISOString()}-${range.to.toISOString()}`;
}
