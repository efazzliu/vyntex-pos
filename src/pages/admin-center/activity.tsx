import { useQuery } from "@tanstack/react-query";
import { AdminPage, acCard } from "@/pages/dashboard/_components/admin-center-ui.tsx";
import { useAdminCenter } from "@/pages/dashboard/_components/admin-center-context.tsx";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { loadAdminOverview } from "@/pages/dashboard/_lib/admin-center-data.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";

export default function DashboardActivityPage() {
  const { t, lang } = useDashboardLocale();
  const { rawVenues, venueFilterId, datePreset, customRange } = useAdminCenter();
  const query = useQuery({
    queryKey: ["admin-center", "activity", venueFilterId, datePreset, lang, rawVenues.length],
    queryFn: () =>
      loadAdminOverview({
        venues: rawVenues,
        venueFilterId,
        preset: datePreset,
        customRange,
        chartRange: "30d",
        lang,
      }),
    enabled: rawVenues.length > 0,
  });

  const items = query.data?.activity ?? [];

  return (
    <AdminPage>
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
          {t("ac.nav.admin_center")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("ac.activity.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("ac.activity.subtitle")}</p>
      </header>

      {query.isLoading ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : (
        <section className={cn(acCard, "p-5")}>
          <ol className="relative space-y-0 border-l border-slate-200 pl-6">
            {items.map((item) => (
              <li key={item.id} className="relative pb-6 last:pb-0">
                <span
                  className={cn(
                    "absolute -left-[31px] top-1.5 size-3 rounded-full ring-4 ring-white",
                    item.tone === "green" && "bg-emerald-500",
                    item.tone === "blue" && "bg-sky-500",
                    item.tone === "violet" && "bg-violet-500",
                    item.tone === "orange" && "bg-amber-500",
                    item.tone === "red" && "bg-rose-500",
                  )}
                />
                <p className="text-sm font-semibold capitalize text-slate-900">{item.title}</p>
                <p className="text-sm text-slate-500">{item.venue}</p>
                <p className="mt-0.5 text-xs text-slate-400">{item.relative}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </AdminPage>
  );
}
