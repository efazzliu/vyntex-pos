import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { isAuthEmailVerified } from "@/lib/auth-email-verified.ts";
import { supabase } from "@/lib/supabase.ts";
import {
  clearDashboardRestaurantId,
} from "@/hooks/use-dashboard-restaurant.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { isPlatformAdminEmail } from "@/lib/platform-admin.ts";
import SetupForm from "./setup-form.tsx";
import ExpiredLicense from "./expired-license.tsx";
import { DashboardLocaleProvider, useDashboardLocale } from "./dashboard-locale-context.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { dashboardTypeLabel } from "@/lib/dashboard-i18n.ts";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  ChevronLeft,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  KeyRound,
  Download,
  CreditCard,
  Users,
  Building2,
  Shield,
  LifeBuoy,
  House,
  Languages,
} from "lucide-react";
import { toast } from "sonner";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

const sidebarLinkDefs = [
  { i18nKey: "nav.restaurant_pos", href: "/dashboard/restaurant-pos", icon: LayoutDashboard },
  { i18nKey: "nav.licenses", href: "/dashboard/licenses", icon: KeyRound },
  { i18nKey: "nav.downloads", href: "/dashboard/downloads", icon: Download },
  { i18nKey: "nav.billing", href: "/dashboard/billing", icon: CreditCard },
  { i18nKey: "nav.team_access", href: "/dashboard/team-access", icon: Users },
  { i18nKey: "nav.business_settings", href: "/dashboard/business-settings", icon: Building2 },
  { i18nKey: "nav.security", href: "/dashboard/security", icon: Shield },
  { i18nKey: "nav.support", href: "/dashboard/support", icon: LifeBuoy },
] as const;

function DashboardSidebar({
  collapsed,
  onToggle,
  mobile,
  vynType,
  licenseActive,
  isAdmin,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
  vynType?: string;
  licenseActive?: boolean;
  isAdmin?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUserRole();
  const { t, lang } = useDashboardLocale();

  const handleSignOut = async () => {
    clearDashboardRestaurantId();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const displayName = user?.name?.trim() || user?.email || "User";
  const displayEmail = user?.email ?? "";
  const initial = (displayName || "?").charAt(0).toUpperCase();

  const isActive = (href: string) => {
    if (href === "/dashboard/restaurant-pos") {
      return (
        location.pathname === "/dashboard" ||
        location.pathname === "/dashboard/restaurant-pos"
      );
    }
    return location.pathname.startsWith(href);
  };

  const visibleLinks = sidebarLinkDefs;

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-sky-500/20 bg-gradient-to-b from-[#050c16] to-[#02040a] text-zinc-100 shadow-[inset_-1px_0_0_0_rgba(56,189,248,0.08)] transition-all duration-300",
        mobile ? "w-full" : collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sky-500/12 via-blue-600/5 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(56,189,248,0.08),transparent_55%)] opacity-80" />
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-sky-500/15 bg-black/20 p-4 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <img src={LOGO_URL} alt={t("layout.brand")} className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent truncate">
              {t("layout.brand")}
            </span>
          )}
        </Link>
        {!mobile && (
          <button
            onClick={onToggle}
            className="hidden cursor-pointer rounded-lg border border-transparent p-1 text-sky-200/70 hover:border-sky-500/25 hover:bg-sky-500/10 hover:text-white lg:block"
          >
            <ChevronLeft
              className={cn(
                "size-4 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {/* License type badge */}
      {!collapsed && vynType && (
        <div className="relative z-10 border-b border-sky-500/15 bg-black/15 px-4 py-3 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/45">
            {t("layout.active_license")}
          </p>
          <p className="text-sm font-medium text-white truncate">
            {vynType ? dashboardTypeLabel(vynType, lang) : vynType}
          </p>
        </div>
      )}

      {/* Nav links */}
      <nav className="relative z-10 flex-1 space-y-1 px-2 py-4">
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive(link.href)
                ? "border-sky-400/35 bg-sky-500/10 text-white shadow-[0_0_28px_-10px_rgba(56,189,248,0.35)]"
                : "text-white/55 hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? t(link.i18nKey) : undefined}
          >
            <link.icon className="size-5 shrink-0" />
            {!collapsed && t(link.i18nKey)}
          </Link>
        ))}

        {!collapsed && (
          <div className="mt-5 px-1">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200/40">
              {t("nav.quick_links")}
            </p>
            <Link
              to="/"
              className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium text-white/55 transition-all hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white"
            >
              <House className="size-5 shrink-0" />
              {t("nav.website")}
            </Link>
          </div>
        )}

        {/* Expired indicator in sidebar */}
        {!licenseActive && !collapsed && (
          <div className="mt-3 mx-1 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-400 text-xs font-medium">
              <ShieldAlert className="size-4 shrink-0" />
              {t("nav.license_expired")}
            </div>
          </div>
        )}
      </nav>

      {/* Admin panel link */}
      {isAdmin && !collapsed && (
        <div className="px-3 pb-2">
          <Link
            to="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <ShieldCheck className="size-4" />
            {t("nav.admin_panel")}
          </Link>
        </div>
      )}

      {/* User section */}
      {!collapsed && (
        <div className="relative z-10 border-t border-sky-500/15 bg-black/20 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-sky-500/20 bg-black/35 p-2.5 shadow-[0_0_24px_-12px_rgba(56,189,248,0.15)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0066FF] to-[#44CC00] text-xs font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-100 truncate">
                {displayName}
              </p>
              <p className="text-xs text-sky-200/40 truncate">
                {displayEmail}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start rounded-lg border border-transparent text-white/60 hover:border-sky-500/20 hover:bg-sky-500/10 hover:text-white"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="size-4 mr-2" />
            {t("nav.sign_out")}
          </Button>
        </div>
      )}
    </aside>
  );
}

/**
 * Check if license is expired by comparing the expiry date string to now.
 */
function isLicenseExpired(
  licenseStatus: string,
  licenseExpiry: string
): boolean {
  if (licenseStatus === "expired" || licenseStatus === "suspended") return true;
  return new Date(licenseExpiry) < new Date();
}

function DashboardContent() {
  const { t, lang, setLang } = useDashboardLocale();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasVerifiedEmail, setHasVerifiedEmail] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { restaurant, refresh: refreshDashboardRestaurant } = useDashboardRestaurant();
  const { isAdmin, user } = useUserRole();

  /*
   * After license setup, localStorage is updated but this layout keeps the pre-setup
   * hook state (restaurant === null) unless we refetch when the route changes.
   */
  useEffect(() => {
    void refreshDashboardRestaurant();
  }, [location.pathname, refreshDashboardRestaurant]);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAuthUser(data.user ?? null);
      setHasVerifiedEmail(isAuthEmailVerified(data.user));
      setAuthLoading(false);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setHasVerifiedEmail(isAuthEmailVerified(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Close mobile sidebar on route change
  const currentPath = location.pathname;
  const [prevPath, setPrevPath] = useState(currentPath);
  if (currentPath !== prevPath) {
    setPrevPath(currentPath);
    setMobileOpen(false);
  }

  // Loading state
  if (restaurant === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#02040a]">
        <div className="flex flex-col items-center gap-4">
          <img
            src={LOGO_URL}
            alt={t("layout.brand")}
            className="h-12 w-12 animate-pulse"
          />
          <Skeleton className="h-4 w-40 rounded-md bg-sky-500/10" />
        </div>
      </div>
    );
  }

  // No restaurant - show setup
  if (restaurant === null) {
    if (authLoading) {
      return (
        <div className="flex h-dvh items-center justify-center bg-[#02040a]">
          <div className="flex flex-col items-center gap-4">
            <img
              src={LOGO_URL}
              alt={t("layout.brand")}
              className="h-12 w-12 animate-pulse"
            />
            <Skeleton className="h-4 w-40 rounded-md bg-sky-500/10" />
          </div>
        </div>
      );
    }

    if (!hasVerifiedEmail) {
      if (authUser?.email) {
        return (
          <div className="flex h-dvh items-center justify-center bg-background px-4">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/10">
                <Mail className="size-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Verify your email
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a link to{" "}
                <span className="font-medium text-foreground">{authUser.email}</span>.
                Open it to activate your account, then return here.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={async () => {
                    const { error } = await supabase.auth.resend({
                      type: "signup",
                      email: authUser.email!,
                    });
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    toast.success("Verification email sent again.");
                  }}
                >
                  Resend email
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="secondary"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate("/login", { replace: true });
                  }}
                >
                  Use a different account
                </Button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="flex h-dvh items-center justify-center bg-background px-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#0066FF]/10 to-[#44CC00]/10">
              <Sparkles className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Create your account first
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Register with name, email and password, then verify your email to
              continue.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/register">
                <Button className="w-full sm:w-auto">Register</Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="w-full sm:w-auto">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    if (location.pathname === "/dashboard/get-started") {
      return <SetupForm />;
    }

    if (location.pathname === "/dashboard/settings") {
      return <Outlet />;
    }

    return <Navigate to="/dashboard/settings" replace />;
  }

  const expired = isLicenseExpired(
    restaurant.licenseStatus,
    restaurant.licenseExpiry
  );
  const profileName = user?.name?.trim() || user?.email || "Profile";
  const profileInitial = profileName.charAt(0).toUpperCase();
  const profileTargetPath =
    isAdmin || isPlatformAdminEmail(user?.email) ? "/admin" : "/dashboard/settings";

  const iconBtn =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-sky-200/75 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40";

  const toggleLang = () => setLang(lang === "en" ? "sq" : "en");

  return (
    <div className="dark flex h-dvh overflow-hidden bg-[#02040a] text-zinc-100">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          vynType={restaurant.type}
          licenseActive={!expired}
          isAdmin={isAdmin}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-72 border-r border-sky-500/20 shadow-[8px_0_40px_-10px_rgba(0,0,0,0.5)]">
            <DashboardSidebar
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              mobile
              vynType={restaurant.type}
              licenseActive={!expired}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {/* Main: no top strip — toolbar floats over scroll area so page bg reaches the top */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 hidden justify-end px-3 pt-2.5 sm:px-5 lg:flex">
          <div className="pointer-events-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={toggleLang}
              className={iconBtn}
              aria-label={`${t("layout.lang_toggle")}: ${lang === "en" ? t("header.lang_en") : t("header.lang_sq")}. ${t("header.lang_click_toggle")}`}
              title={`${t("layout.lang_toggle")} — ${t("header.lang_click_toggle")}`}
            >
              <Languages className="size-[18px]" strokeWidth={1.75} />
            </button>
            <Link
              to="/"
              className={iconBtn}
              title={t("header.back_website")}
              aria-label={t("header.back_website")}
            >
              <ExternalLink className="size-[18px]" strokeWidth={1.75} />
            </Link>
            <Link
              to={profileTargetPath}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0066FF] to-[#44CC00] text-[11px] font-bold text-white shadow-[0_0_16px_-4px_rgba(56,189,248,0.35)] transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45"
              title={profileName}
              aria-label={t("nav.profile_aria")}
            >
              {profileInitial}
            </Link>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-between px-2 pt-2.5 lg:hidden">
          <div className="pointer-events-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={cn(iconBtn, "-ml-0.5")}
              aria-label={t("nav.menu_aria")}
            >
              <Menu className="size-5" />
            </button>
            <Link to="/" className={cn(iconBtn, "p-0")} title={t("layout.brand")} aria-label={t("layout.brand")}>
              <img src={LOGO_URL} alt="" className="h-7 w-7 rounded-lg" />
            </Link>
          </div>
          <div className="pointer-events-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={toggleLang}
              className={iconBtn}
              aria-label={`${t("layout.lang_toggle")}: ${lang === "en" ? t("header.lang_en") : t("header.lang_sq")}. ${t("header.lang_click_toggle")}`}
              title={`${t("layout.lang_toggle")} — ${t("header.lang_click_toggle")}`}
            >
              <Languages className="size-[17px]" strokeWidth={1.75} />
            </button>
            <Link
              to="/"
              className={iconBtn}
              title={t("header.site")}
              aria-label={t("header.site")}
            >
              <ExternalLink className="size-[17px]" strokeWidth={1.75} />
            </Link>
            <Link
              to={profileTargetPath}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0066FF] to-[#44CC00] text-[10px] font-bold text-white shadow-[0_0_14px_-4px_rgba(56,189,248,0.35)]"
              aria-label={t("nav.profile_aria")}
            >
              {profileInitial}
            </Link>
          </div>
        </div>

        <main className="relative min-h-0 min-w-0 w-full flex-1 overflow-y-auto bg-transparent">
          {expired ? <ExpiredLicense restaurant={restaurant} /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <DashboardLocaleProvider>
      <DashboardContent />
    </DashboardLocaleProvider>
  );
}
