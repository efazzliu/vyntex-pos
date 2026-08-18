import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, LogOut, ShieldCheck, Store, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { supabase } from "@/lib/supabase.ts";
import {
  clearDashboardRestaurantId,
  setDashboardRestaurantId,
} from "@/hooks/use-dashboard-restaurant.ts";
import {
  fetchAllRestaurantsOwnedBySession,
  fetchRestaurantOwnedBySession,
  isRestaurantLicenseUsable,
  type OwnedRestaurantRow,
} from "@/lib/supabase-pos/phone-pos-session.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { cn } from "@/lib/utils.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

export default function PhoneDashboard() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const { user } = useUserRole();
  const [venues, setVenues] = useState<OwnedRestaurantRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const refreshVenues = useCallback(async () => {
    setLoadError(false);
    try {
      let list = await fetchAllRestaurantsOwnedBySession();
      if (list.length === 0) {
        const single = await fetchRestaurantOwnedBySession();
        if (single) list = [single];
      }
      setVenues(list);
    } catch {
      setLoadError(true);
      setVenues([]);
    }
  }, []);

  useEffect(() => {
    void refreshVenues();
  }, [refreshVenues]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await fetchAllRestaurantsOwnedBySession();
      if (cancelled || all.length !== 1) return;
      setDashboardRestaurantId(all[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    clearDashboardRestaurantId();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const openVenue = useCallback(
    async (row: OwnedRestaurantRow) => {
      if (row.mobile_access_enabled === false) {
        toast.error(t("phone.mobileAccessDisabled"));
        return;
      }
      setOpeningId(row.id);
      try {
        setDashboardRestaurantId(row.id);
        navigate("/app/venue");
      } finally {
        setOpeningId(null);
      }
    },
    [navigate, t],
  );

  const email = user?.email?.trim() ?? "";
  const count = venues?.length ?? 0;

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col",
        "bg-gradient-to-b from-slate-100 via-[#f3f7ff] to-slate-100 text-slate-900",
      )}
    >
      <header
        className={cn(
          "shrink-0 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]",
        )}
      >
        <div className="flex items-start justify-between gap-3 pt-2">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={VYNTEX_APP_LOGO_SRC}
              alt="Vyntex POS"
              className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
              width={64}
              height={64}
              decoding="async"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">
                {t("phone.venues.title")}
              </h1>
              {email ? (
                <p className="mt-0.5 truncate text-sm text-slate-500">{email}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="shrink-0 rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-white/80 hover:text-slate-800"
            aria-label={t("phone.venues.signOut")}
          >
            <LogOut className="size-5" />
          </button>
        </div>
        <div className="mt-3 h-px w-full bg-slate-200/90" />
      </header>

      <main className="flex flex-1 flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {venues === null ? (
          <p className="py-8 text-center text-sm text-slate-500">{t("phone.venues.loading")}</p>
        ) : loadError ? (
          <p className="py-8 text-center text-sm text-red-600">{t("phone.venues.loadError")}</p>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              {t("phone.venues.licenseCount", { count })}
            </p>

            {venues.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center text-sm text-slate-500">
                {t("phone.venues.empty")}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {venues.map((row) => {
                  const active = isRestaurantLicenseUsable(row);
                  const busy = openingId === row.id;
                  const address = (row.address ?? "").trim();
                  const licenseShow = row.license_key.trim().toUpperCase();

                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void openVenue(row)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm transition-shadow",
                          "hover:border-slate-300 hover:shadow-md",
                          "disabled:opacity-70",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-12 shrink-0 items-center justify-center rounded-xl",
                            active
                              ? "bg-[#0066FF]/12 text-[#0066FF]"
                              : "bg-slate-100 text-slate-400",
                          )}
                        >
                          <Store className="size-6" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 gap-y-1">
                            <span className="font-semibold text-[#0f172a]">{row.name}</span>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {active ? t("phone.venues.active") : t("phone.venues.inactive")}
                            </span>
                          </div>
                          {address ? (
                            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{address}</p>
                          ) : null}
                          <p className="mt-1.5 text-xs text-slate-400">
                            {t("phone.venues.licenseLine", { key: licenseShow })}
                          </p>
                          {busy ? (
                            <p className="mt-1 text-xs text-primary">{t("phone.venues.opening")}</p>
                          ) : null}
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-slate-300" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        <Button variant="outline" className="mt-2 h-11 w-full justify-start gap-2 rounded-xl" asChild>
          <Link to="/waiter/account">
            <UserRound className="size-5 shrink-0" />
            {t("phone.venues.openWaiter")}
          </Link>
        </Button>

        <Button variant="outline" className="mt-2 h-11 w-full justify-start gap-2 rounded-xl" asChild>
          <Link to="/admin-center/overview">
            <ShieldCheck className="size-5 shrink-0" />
            {t("phone.venues.admin")}
          </Link>
        </Button>

        <p className="mt-auto pt-4 text-center text-xs leading-relaxed text-slate-400">
          {t("phone.venues.desktopHint")}
        </p>
      </main>
    </div>
  );
}
