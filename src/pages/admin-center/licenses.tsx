import { ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";
import { useAdminCenter } from "@/pages/dashboard/_components/admin-center-context.tsx";
import { AdminPage, StatusDot, acCard } from "@/pages/dashboard/_components/admin-center-ui.tsx";
import { dashboardPlanLabel } from "@/lib/dashboard-i18n.ts";

export default function DashboardLicensesPage() {
  const { t, lang } = useDashboardLocale();
  const { venues, venuesLoading, openRenew } = useAdminCenter();
  const locale = lang === "sq" ? "sq-AL" : "en-US";

  if (venuesLoading) {
    return (
      <AdminPage className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 rounded-2xl" />
      </AdminPage>
    );
  }

  const healthy = venues.filter((v) => v.health === "active").length;
  const expiring = venues.filter((v) => v.health === "expiring").length;
  const expired = venues.filter((v) => v.health === "expired").length;
  const urgent = venues.find((v) => v.health !== "active" || (v.daysRemaining ?? 99) < 7);

  return (
    <AdminPage>
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
          {t("ac.nav.admin_center")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("ac.nav.licenses")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("ac.license.page_subtitle")}</p>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Summary label={t("ac.license.active")} value={String(healthy)} tone="green" />
        <Summary label={t("ac.license.expiring")} value={String(expiring)} tone="orange" />
        <Summary label={t("ac.license.expired")} value={String(expired)} tone="red" />
      </div>

      {urgent && (urgent.daysRemaining ?? 99) < 7 ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-amber-900">
            ⚠️ {t("ac.license.expires_in", { count: Math.max(urgent.daysRemaining ?? 0, 0) })}
          </p>
          <Button
            className="rounded-xl bg-amber-600 text-white hover:bg-amber-700"
            onClick={() =>
              openRenew({
                venueId: urgent.id,
                venueName: urgent.name,
                plan: urgent.planLabel,
                expiry: urgent.license_expiry,
              })
            }
          >
            {t("ac.license.renew_now")}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        {venues.map((venue) => (
          <article key={venue.id} className={cn(acCard, "p-5")}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <KeyRound className="size-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{venue.name}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {dashboardPlanLabel(venue.plan ?? "professional", lang)}
                    {venue.license_expiry
                      ? ` · ${new Date(venue.license_expiry).toLocaleDateString(locale, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}`
                      : null}
                  </p>
                  <p className="mt-1 font-mono text-xs tracking-wide text-slate-400">
                    {venue.license_key.trim().toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusDot health={venue.health} label={t(`ac.license.${venue.health}`)} />
                <span className="text-xs text-slate-500">
                  {venue.daysRemaining != null
                    ? t("ac.license.days_left", { count: Math.max(venue.daysRemaining, 0) })
                    : "—"}
                </span>
                <Button
                  variant={venue.health === "active" ? "outline" : "default"}
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
                  {venue.health === "active" ? t("ac.license.manage") : t("ac.renew.cta")}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AdminPage>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "orange" | "red";
}) {
  return (
    <div className={cn(acCard, "p-4")}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "green" && "text-emerald-600",
          tone === "orange" && "text-amber-600",
          tone === "red" && "text-rose-600",
        )}
      >
        {value}
      </p>
    </div>
  );
}
