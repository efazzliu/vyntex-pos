import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation, type TFunction } from "react-i18next";
import {
  BadgeAlert,
  Bell,
  ChevronRight,
  CreditCard,
  HelpCircle,
  Languages,
  LogOut,
  MapPin,
  MoonStar,
  RefreshCw,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { usePlatformAdmin } from "@/hooks/use-platform-admin.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { APP_VERSION_LABEL, supportMailtoWithSubject } from "@/lib/site-constants.ts";
import { supabase } from "@/lib/supabase.ts";
import { cn } from "@/lib/utils.ts";
import { clearDashboardRestaurantId } from "@/hooks/use-dashboard-restaurant.ts";
import { usePhoneManagerSession } from "@/lib/supabase-pos/phone-manager-session.ts";
import { fetchAllRestaurantsOwnedBySession } from "@/lib/supabase-pos/phone-pos-session.ts";
import { usePhoneAdminLoginNotifications } from "@/phone-app/hooks/use-phone-admin-login-notifications-context.tsx";

function SettingsRow({
  icon: Icon,
  iconWrapClass,
  label,
  onClick,
  to,
  href,
  badge,
}: {
  icon: typeof UserRound;
  iconWrapClass: string;
  label: string;
  onClick?: () => void;
  to?: string;
  href?: string;
  badge?: number;
}) {
  const inner = (
    <>
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", iconWrapClass)}>
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <span className="min-w-0 flex-1 font-medium text-slate-900">{label}</span>
      {badge != null && badge > 0 ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
      <ChevronRight className="size-5 shrink-0 text-slate-300" aria-hidden />
    </>
  );

  const cls = "flex w-full items-center gap-3 py-3.5 pr-1 text-left";

  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }

  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

function initialsFromName(name: string, t: TFunction<"site">): string {
  const clean = name.trim();
  if (!clean) return t("phone.profile.initialsFallback");
  const parts = clean.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function PhoneProfilePage() {
  const { t, i18n } = useTranslation("site");
  const navigate = useNavigate();
  const { session } = usePlatformAdmin();
  const { user, isAdmin } = useUserRole();
  const { restaurant } = useDashboardRestaurant();
  const { unreadCount } = usePhoneAdminLoginNotifications();
  const [venueCount, setVenueCount] = useState<number | null>(null);

  const loadVenues = useCallback(async () => {
    try {
      const list = await fetchAllRestaurantsOwnedBySession();
      setVenueCount(list.length);
    } catch {
      setVenueCount(null);
    }
  }, []);

  useEffect(() => {
    void loadVenues();
  }, [loadVenues]);

  const displayName =
    user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    t("phone.profile.fallbackName");
  const isPhoneManager = usePhoneManagerSession() === true;

  const email = user?.email ?? session?.user?.email ?? "";
  const phone =
    (session?.user?.phone && String(session.user.phone).trim()) ||
    (session?.user?.user_metadata as { phone?: string } | undefined)?.phone?.trim() ||
    "";
  const createdAt = session?.user?.created_at;

  const memberSince =
    createdAt != null
      ? new Intl.DateTimeFormat(i18n.language.startsWith("sq") ? "sq-AL" : "en-US", {
          month: "long",
          year: "numeric",
        }).format(new Date(createdAt))
      : "—";

  const roleLabel = isPhoneManager
    ? t("phone.profile.roleManager")
    : isAdmin
      ? t("phone.profile.roleAdmin")
      : t("phone.profile.roleOwner");
  const activeVenueName = restaurant?.name ?? t("phone.profile.noActiveVenue");
  const initials = useMemo(() => initialsFromName(displayName, t), [displayName, t]);

  const handleSignOut = async () => {
    clearDashboardRestaurantId();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };
  const helpHref = supportMailtoWithSubject(t("phone.profile.helpSubject"));

  return (
    <div className="flex flex-col bg-transparent pb-4 text-slate-900">
      <div
        className={cn(
          "px-4 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]",
          "rounded-b-[1.75rem] bg-gradient-to-br from-[#0066FF] via-[#5b4ddb] to-[#6d28d9]",
        )}
      >
        <div className="flex gap-3 pt-2">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-extrabold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-white">{displayName}</p>
            <p className="text-sm text-white/90">{roleLabel}</p>
            {email ? <p className="mt-0.5 truncate text-xs text-white/75">{email}</p> : null}
          </div>
        </div>
        {!isPhoneManager ? (
          <div className="mt-5 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-medium text-white/80">{t("phone.profile.activeVenueLabel")}</p>
            <p className="mt-0.5 truncate text-base font-bold text-white">{activeVenueName}</p>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 -mt-4 flex flex-col gap-4 px-4">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">{t("phone.profile.accountTitle")}</h2>
          <dl className="mt-3 divide-y divide-slate-100">
            {isPhoneManager ? (
              <>
                <div className="flex justify-between gap-3 py-3 text-sm">
                  <dt className="text-slate-500">{t("phone.profile.labelFullName")}</dt>
                  <dd className="font-medium text-slate-900">{displayName}</dd>
                </div>
                <div className="flex justify-between gap-3 py-3 text-sm">
                  <dt className="text-slate-500">{t("phone.profile.labelEmail")}</dt>
                  <dd className="font-medium text-slate-900">
                    {email || t("phone.profile.notSet")}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 py-3 text-sm">
                  <dt className="text-slate-500">{t("phone.profile.accountRoleLabel")}</dt>
                  <dd className="font-medium text-slate-900">{roleLabel}</dd>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between gap-3 py-3 text-sm">
                  <dt className="text-slate-500">{t("phone.profile.phone")}</dt>
                  <dd className="font-medium text-slate-900">{phone || t("phone.profile.notSet")}</dd>
                </div>
                <div className="flex justify-between gap-3 py-3 text-sm">
                  <dt className="text-slate-500">{t("phone.profile.memberSince")}</dt>
                  <dd className="font-medium text-slate-900">{memberSince}</dd>
                </div>
                <div className="flex justify-between gap-3 py-3 text-sm">
                  <dt className="text-slate-500">{t("phone.profile.activeVenuesCount")}</dt>
                  <dd className="font-medium tabular-nums text-slate-900">
                    {venueCount === null ? "—" : venueCount}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="px-4 pt-4">
            <h2 className="text-base font-bold text-slate-900">{t("phone.profile.settingsTitle")}</h2>
          </div>
          <div className="divide-y divide-slate-100 px-4 pb-2">
            <SettingsRow
              icon={UserRound}
              iconWrapClass="bg-sky-100 text-sky-700"
              label={t("phone.profile.personalInfo")}
              to="/app/profile/personal"
            />
            {isPhoneManager ? (
              <>
                <SettingsRow
                  icon={BadgeAlert}
                  iconWrapClass="bg-orange-100 text-orange-700"
                  label={t("phone.profile.notifications")}
                  to="/app/notifications"
                />
                <SettingsRow
                  icon={Languages}
                  iconWrapClass="bg-violet-100 text-violet-700"
                  label={t("phone.profile.language")}
                  to="/app/profile/preferences"
                />
                <SettingsRow
                  icon={MoonStar}
                  iconWrapClass="bg-indigo-100 text-indigo-700"
                  label={t("phone.profile.display")}
                  to="/app/profile/display"
                />
              </>
            ) : (
              <>
                <SettingsRow
                  icon={Bell}
                  iconWrapClass="bg-violet-100 text-violet-700"
                  label={t("phone.profile.notifications")}
                  badge={unreadCount}
                  to="/app/notifications"
                />
                <SettingsRow
                  icon={MapPin}
                  iconWrapClass="bg-emerald-100 text-emerald-700"
                  label={t("phone.profile.myVenues")}
                  to="/app"
                />
                <SettingsRow
                  icon={Users}
                  iconWrapClass="bg-indigo-100 text-indigo-700"
                  label={t("phone.profile.teamManagement")}
                  to="/app/phone-team"
                />
                <SettingsRow
                  icon={CreditCard}
                  iconWrapClass="bg-orange-100 text-orange-700"
                  label={t("phone.profile.licenses")}
                  to="/app/profile/licenses"
                />
                <SettingsRow
                  icon={Languages}
                  iconWrapClass="bg-violet-100 text-violet-700"
                  label={t("phone.profile.language")}
                  to="/app/profile/preferences"
                />
                <SettingsRow
                  icon={MoonStar}
                  iconWrapClass="bg-indigo-100 text-indigo-700"
                  label={t("phone.profile.display")}
                  to="/app/profile/display"
                />
                <SettingsRow
                  icon={Shield}
                  iconWrapClass="bg-sky-100 text-sky-700"
                  label={t("phone.profile.security")}
                  to="/app/profile/security"
                />
                <SettingsRow
                  icon={HelpCircle}
                  iconWrapClass="bg-emerald-100 text-emerald-700"
                  label={t("phone.profile.help")}
                  href={helpHref}
                />
              </>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3">
          {!isPhoneManager ? (
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-[#0066FF]/35 bg-[#0066FF]/5 text-base font-semibold text-[#0066FF] transition-colors hover:bg-[#0066FF]/10"
              onClick={() => navigate("/app")}
            >
              <RefreshCw className="mr-2 size-5" />
              {t("phone.profile.switchVenue")}
            </button>
          ) : null}
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-red-200 bg-red-50 text-base font-semibold text-red-700 transition-colors hover:bg-red-100"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="mr-2 size-5" />
            {t("phone.profile.signOut")}
          </button>
        </div>
        {!isPhoneManager ? (
          <footer className="pt-2 text-center text-xs text-slate-400">
            <p>{t("phone.profile.appLine", { v: APP_VERSION_LABEL })}</p>
            <p className="mt-1">{t("phone.profile.copyright", { year: new Date().getFullYear() })}</p>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
