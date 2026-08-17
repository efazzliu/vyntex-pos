import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  Building2,
  ChevronLeft,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings2,
  Shield,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import { useDashboardLocale } from "./dashboard-locale-context.tsx";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { supabase } from "@/lib/supabase.ts";
import { clearDashboardRestaurantId } from "@/hooks/use-dashboard-restaurant.ts";

const ADMIN_LINKS = [
  { href: "/admin-center/overview", key: "ac.nav.overview", icon: LayoutDashboard },
  { href: "/admin-center/venues", key: "ac.nav.venues", icon: Building2 },
  { href: "/admin-center/licenses", key: "ac.nav.licenses", icon: KeyRound },
  { href: "/admin-center/billing", key: "ac.nav.billing", icon: CreditCard },
  { href: "/admin-center/team-access", key: "ac.nav.team", icon: Users },
  { href: "/admin-center/activity", key: "ac.nav.activity", icon: Activity },
] as const;

const ACCOUNT_LINKS = [
  { href: "/admin-center/settings?tab=account", key: "ac.nav.profile", icon: UserRound },
  { href: "/admin-center/settings?tab=security", key: "ac.nav.security", icon: Shield },
  { href: "/admin-center/settings?tab=notifications", key: "ac.nav.notifications", icon: Bell },
  { href: "/admin-center/settings?tab=preferences", key: "ac.nav.preferences", icon: SlidersHorizontal },
] as const;

function pathActive(pathname: string, search: string, href: string): boolean {
  const url = new URL(href, "https://vyntex.local");
  if (href.startsWith("/admin-center/overview")) {
    return pathname === "/admin-center" || pathname === "/admin-center/overview";
  }
  if (url.pathname === "/admin-center/settings") {
    if (pathname !== "/admin-center/settings") return false;
    const tab = new URLSearchParams(search).get("tab");
    const expected = url.searchParams.get("tab");
    if (!expected) return !tab || tab === "account";
    return tab === expected;
  }
  return pathname === url.pathname || pathname.startsWith(`${url.pathname}/`);
}

export function AdminSidebar({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useDashboardLocale();
  const { user } = useUserRole();

  const displayName = user?.name?.trim() || user?.email || "User";
  const initial = displayName.charAt(0).toUpperCase();

  const handleSignOut = async () => {
    clearDashboardRestaurantId();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const renderLink = (link: { href: string; key: string; icon: typeof LayoutDashboard }) => {
    const active = pathActive(location.pathname, location.search, link.href);
    return (
      <Link
        key={link.href}
        to={link.href}
        onClick={onNavigate}
        title={collapsed ? t(link.key) : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-[13px] font-medium transition-all",
          collapsed && "justify-center px-0",
          active
            ? "border-indigo-100 bg-indigo-50 text-indigo-700 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)]"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        )}
      >
        <link.icon
          className={cn("size-4 shrink-0", active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")}
          strokeWidth={1.75}
        />
        {!collapsed ? t(link.key) : null}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-slate-200/80 bg-white",
        collapsed ? "w-[76px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex items-center gap-3 border-b border-slate-100 px-4 py-4", collapsed && "justify-center px-2")}>
        <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-8 w-8 shrink-0 object-contain" />
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900">Vyntex POS</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-500">
              {t("ac.nav.admin_center")}
            </p>
          </div>
        ) : null}
      </div>

      <div className="border-b border-slate-100 px-3 py-2">
        <Link
          to="/app"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            collapsed && "justify-center px-0",
          )}
        >
          <ChevronLeft className="size-4 text-slate-400" />
          {!collapsed ? t("ac.nav.back_venues") : null}
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div>
          {!collapsed ? (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {t("ac.nav.admin_center")}
            </p>
          ) : null}
          <div className="space-y-0.5">{ADMIN_LINKS.map(renderLink)}</div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          {!collapsed ? (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {t("ac.nav.account")}
            </p>
          ) : null}
          <div className="space-y-0.5">{ACCOUNT_LINKS.map(renderLink)}</div>
        </div>
      </nav>

      <div className="border-t border-slate-100 p-3">
        {!collapsed ? (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-bold text-white">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-[11px] font-medium text-indigo-600">{t("ac.nav.owner")}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label={t("nav.sign_out")}
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="mx-auto flex size-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            aria-label={t("nav.sign_out")}
          >
            <Settings2 className="size-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
