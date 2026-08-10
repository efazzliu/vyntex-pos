import { useEffect, useState, type ReactNode } from "react";
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
import { DashboardLicenseExpiredBanner } from "./expired-license.tsx";
import { DashboardLocaleProvider, useDashboardLocale } from "./dashboard-locale-context.tsx";
import { useDashboardRestaurant } from "@/hooks/use-dashboard-restaurant.ts";
import { dashboardTypeLabel } from "@/lib/dashboard-i18n.ts";
import { SiteLanguageToggle } from "@/components/site-language-toggle.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronDown,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  KeyRound,
  Download,
  Users,
  Building2,
  Monitor,
  CreditCard,
  CircleHelp,
  MessageCircle,
  Activity,
  House,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

const sidebarGroups = [
  {
    labelKey: "nav.section_main",
    links: [
      { i18nKey: "nav.restaurant_pos", href: "/dashboard/restaurant-pos", icon: LayoutDashboard },
    ],
  },
  {
    labelKey: "nav.section_business",
    links: [
      { i18nKey: "nav.business", href: "/dashboard/business-settings", icon: Building2 },
      { i18nKey: "nav.devices", href: "/dashboard/devices", icon: Monitor },
      { i18nKey: "nav.team", href: "/dashboard/team-access", icon: Users },
      { i18nKey: "nav.license", href: "/dashboard/licenses", icon: KeyRound },
    ],
  },
  {
    labelKey: "nav.section_subscription",
    links: [
      { i18nKey: "nav.billing", href: "/dashboard/billing", icon: CreditCard },
      { i18nKey: "nav.downloads", href: "/dashboard/downloads", icon: Download },
    ],
  },
  {
    labelKey: "nav.section_support",
    links: [
      { i18nKey: "nav.help_center", href: "/dashboard/support", icon: CircleHelp },
      { i18nKey: "nav.support_direct", href: "/contact", icon: MessageCircle },
      { i18nKey: "nav.system_status", href: "/dashboard/system-status", icon: Activity },
    ],
  },
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
    const target = new URL(href, window.location.origin);
    const path = target.pathname;
    if (path === "/dashboard/settings") {
      if (location.pathname !== "/dashboard/settings") return false;
      const tab = new URLSearchParams(location.search).get("tab");
      const expectedTab = target.searchParams.get("tab");
      if (!expectedTab) return !tab || tab === "account";
      return tab === expectedTab;
    }
    if (target.hash) {
      return location.pathname === path && location.hash === target.hash;
    }
    if (
      (path === "/dashboard/licenses" || path === "/dashboard/support") &&
      location.hash
    ) {
      return false;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-slate-200 bg-white text-slate-800 transition-all duration-300",
        "dark:border-sky-500/20 dark:bg-gradient-to-b dark:from-[#050c16] dark:to-[#02040a] dark:text-zinc-100 dark:shadow-[inset_-1px_0_0_0_rgba(56,189,248,0.08)]",
        mobile ? "w-full" : collapsed ? "w-[72px]" : "w-[230px]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-40 bg-gradient-to-b from-sky-500/12 via-blue-600/5 to-transparent dark:block" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(56,189,248,0.08),transparent_55%)] opacity-80 dark:block" />
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50/90 p-4 backdrop-blur-sm dark:border-sky-500/15 dark:bg-black/20">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <img src={VYNTEX_APP_LOGO_SRC} alt={t("layout.brand")} className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent truncate">
              {t("layout.brand")}
            </span>
          )}
        </Link>
        {!mobile && (
          <button
            onClick={onToggle}
            className="hidden cursor-pointer rounded-lg border border-transparent p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-sky-200/70 dark:hover:border-sky-500/25 dark:hover:bg-sky-500/10 dark:hover:text-white lg:block"
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
        <div className="relative z-10 border-b border-slate-200 bg-slate-50/80 px-4 py-3 backdrop-blur-sm dark:border-sky-500/15 dark:bg-black/15">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-sky-200/45">
            {t("layout.active_license")}
          </p>
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
            {vynType ? dashboardTypeLabel(vynType, lang) : vynType}
          </p>
        </div>
      )}

      {/* Nav links */}
      <nav className="relative z-10 flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {sidebarGroups.map((group) => (
          <div key={group.labelKey}>
            {!collapsed ? (
              <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-sky-200/40">
                {t(group.labelKey)}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-[13px] font-medium transition-colors",
                    isActive(link.href)
                      ? "border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white",
                    collapsed && "justify-center px-0",
                  )}
                  title={collapsed ? t(link.i18nKey) : undefined}
                >
                  <link.icon className="size-4 shrink-0" />
                  {!collapsed ? t(link.i18nKey) : null}
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="border-t border-slate-200 pt-4 dark:border-white/10">
          <Link
            to="/dashboard/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-[13px] font-medium transition-colors",
              isActive("/dashboard/settings")
                ? "border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/[0.06] dark:hover:text-white",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? t("nav.settings") : undefined}
          >
            <Settings className="size-4 shrink-0" />
            {!collapsed ? t("nav.settings") : null}
          </Link>
        </div>

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
            state={{ from: "/dashboard/settings" }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <ShieldCheck className="size-4" />
            {t("nav.admin_panel")}
          </Link>
        </div>
      )}

      {/* User section */}
      {!collapsed && (
        <div className="relative z-10 border-t border-slate-200 bg-slate-50/90 p-4 backdrop-blur-sm dark:border-sky-500/15 dark:bg-black/20">
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-sky-500/20 dark:bg-black/35 dark:shadow-[0_0_24px_-12px_rgba(56,189,248,0.15)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0066FF] to-[#44CC00] text-xs font-bold text-white">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-zinc-100">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-sky-200/40">
                {displayEmail}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start rounded-lg border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/60 dark:hover:border-sky-500/20 dark:hover:bg-sky-500/10 dark:hover:text-white"
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

function profileShortLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Account";
  if (trimmed.includes("@")) {
    const local = trimmed.split("@")[0] ?? trimmed;
    return local.length > 18 ? `${local.slice(0, 16)}…` : local;
  }
  const first = trimmed.split(/\s+/)[0];
  return first.length > 18 ? `${first.slice(0, 16)}…` : first;
}

function DashboardHeaderToolbar({
  t,
  profileName,
  profileTargetPath,
  onSignOut,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  profileName: string;
  profileTargetPath: string;
  onSignOut: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);

  const profileInitial = profileName.charAt(0).toUpperCase();
  const shortName = profileShortLabel(profileName);
  const isDark = themeMounted && resolvedTheme === "dark";

  return (
    <div
      className="flex items-center rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-[#0a1220]/80 dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.55)]"
      role="toolbar"
      aria-label="Dashboard actions"
    >
      <SiteLanguageToggle
        triggerClassName="size-8 rounded-lg border-transparent bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 dark:text-sky-200/70 dark:hover:bg-white/[0.05] dark:hover:text-white"
      />

      <span className="mx-1 h-4 w-px shrink-0 bg-slate-200 dark:bg-white/10" aria-hidden />

      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Dark mode"}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 dark:text-sky-200/70 dark:hover:bg-white/[0.05] dark:hover:text-white"
      >
        {isDark ? <Sun className="size-3.5" strokeWidth={2} /> : <Moon className="size-3.5" strokeWidth={2} />}
      </button>

      <span className="mx-1 h-4 w-px shrink-0 bg-slate-200 dark:bg-white/10" aria-hidden />

      <Link
        to="/"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-sky-200/65 dark:hover:bg-white/[0.05] dark:hover:text-white"
        title={t("header.back_website")}
      >
        <House className="size-3.5 shrink-0" strokeWidth={2} />
        <span className="hidden sm:inline">{t("nav.website")}</span>
      </Link>

      <span className="mx-1 h-4 w-px shrink-0 bg-slate-200 dark:bg-white/10" aria-hidden />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex max-w-[11rem] items-center gap-1.5 rounded-lg py-1 pl-1 pr-1.5 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 dark:hover:bg-white/[0.05] sm:max-w-[13rem] sm:pr-2"
            aria-label={t("nav.profile_aria")}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/15 dark:text-sky-50 dark:ring-sky-400/25">
              {profileInitial}
            </span>
            <span className="hidden truncate text-xs font-medium text-slate-700 sm:block dark:text-slate-200">
              {shortName}
            </span>
            <ChevronDown className="hidden size-3.5 shrink-0 text-slate-400 sm:block dark:text-slate-500" strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium text-foreground">{profileName}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to={profileTargetPath} className="cursor-pointer">
              <Settings className="size-4" />
              {t("nav.settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={() => void onSignOut()}
          >
            <LogOut className="size-4" />
            {t("nav.sign_out")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DashboardShell({
  children,
  sidebarCollapsed,
  onToggleSidebar,
  mobileOpen,
  onMobileOpenChange,
  vynType,
  licenseActive,
  isAdmin,
  profileName,
  profileTargetPath,
  onSignOut,
  expiredBanner,
}: {
  children: ReactNode;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  vynType?: string;
  licenseActive?: boolean;
  isAdmin?: boolean;
  profileName: string;
  profileTargetPath: string;
  onSignOut: () => void;
  expiredBanner?: ReactNode;
}) {
  const { t } = useDashboardLocale();

  const iconBtn =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 dark:text-sky-200/75 dark:hover:bg-white/[0.06] dark:hover:text-white";

  return (
    <div className="client-dashboard-shell flex h-dvh overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#02040a] dark:text-zinc-100">
      <div className="hidden md:block shrink-0">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={onToggleSidebar}
          vynType={vynType}
          licenseActive={licenseActive}
          isAdmin={isAdmin}
        />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => onMobileOpenChange(false)}
          />
          <div className="relative h-full w-72 border-r border-sky-500/20 shadow-[8px_0_40px_-10px_rgba(0,0,0,0.5)]">
            <DashboardSidebar
              collapsed={false}
              onToggle={() => onMobileOpenChange(false)}
              mobile
              vynType={vynType}
              licenseActive={licenseActive}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      ) : null}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 hidden justify-end px-3 pt-2.5 sm:px-5 md:flex">
          <div className="pointer-events-auto">
            <DashboardHeaderToolbar
              t={t}
              profileName={profileName}
              profileTargetPath={profileTargetPath}
              onSignOut={onSignOut}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-between px-2 pt-2.5 md:hidden">
          <div className="pointer-events-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onMobileOpenChange(true)}
              className={cn(iconBtn, "-ml-0.5")}
              aria-label={t("nav.menu_aria")}
            >
              <Menu className="size-5" />
            </button>
            <Link
              to="/dashboard/restaurant-pos"
              className={cn(iconBtn, "p-0")}
              title={t("layout.brand")}
              aria-label={t("layout.brand")}
            >
              <img src={VYNTEX_APP_LOGO_SRC} alt="" className="h-7 w-7 rounded-lg" />
            </Link>
          </div>
          <div className="pointer-events-auto">
            <DashboardHeaderToolbar
              t={t}
              profileName={profileName}
              profileTargetPath={profileTargetPath}
              onSignOut={onSignOut}
            />
          </div>
        </div>

        <main className="relative min-h-0 min-w-0 w-full flex-1 overflow-y-auto bg-transparent">
          {expiredBanner}
          {children}
        </main>
      </div>
    </div>
  );
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
    const reduced =
      typeof window !== "undefined" &&
      localStorage.getItem("vyntex.dashboard.reducedMotion") === "1";
    document.documentElement.toggleAttribute("data-dashboard-reduced-motion", reduced);
  }, []);

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
            src={VYNTEX_APP_LOGO_SRC}
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
              src={VYNTEX_APP_LOGO_SRC}
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
      return (
        <DashboardShell
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
          licenseActive
          isAdmin={isAdmin}
          profileName={user?.name?.trim() || user?.email || "Profile"}
          profileTargetPath={
            isAdmin || isPlatformAdminEmail(user?.email)
              ? "/admin"
              : "/dashboard/settings"
          }
          onSignOut={() => {
            void (async () => {
              clearDashboardRestaurantId();
              await supabase.auth.signOut();
              navigate("/login", { replace: true });
            })();
          }}
        >
          <SetupForm />
        </DashboardShell>
      );
    }

    return (
      <DashboardShell
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        licenseActive
        isAdmin={isAdmin}
        profileName={user?.name?.trim() || user?.email || "Profile"}
        profileTargetPath={
          isAdmin || isPlatformAdminEmail(user?.email)
            ? "/admin"
            : "/dashboard/settings"
        }
        onSignOut={() => {
          void (async () => {
            clearDashboardRestaurantId();
            await supabase.auth.signOut();
            navigate("/login", { replace: true });
          })();
        }}
      >
        <Outlet />
      </DashboardShell>
    );
  }

  const expired = isLicenseExpired(
    restaurant.licenseStatus,
    restaurant.licenseExpiry
  );
  const profileName = user?.name?.trim() || user?.email || "Profile";
  const profileTargetPath =
    isAdmin || isPlatformAdminEmail(user?.email) ? "/admin" : "/dashboard/settings";

  const handleHeaderSignOut = async () => {
    clearDashboardRestaurantId();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <DashboardShell
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      mobileOpen={mobileOpen}
      onMobileOpenChange={setMobileOpen}
      vynType={restaurant.type}
      licenseActive={!expired}
      isAdmin={isAdmin}
      profileName={profileName}
      profileTargetPath={profileTargetPath}
      onSignOut={() => void handleHeaderSignOut()}
      expiredBanner={
        expired ? (
          <DashboardLicenseExpiredBanner licenseExpiry={restaurant.licenseExpiry} />
        ) : null
      }
    >
      <Outlet />
    </DashboardShell>
  );
}

export default function DashboardLayout() {
  return (
    <DashboardLocaleProvider>
      <DashboardContent />
    </DashboardLocaleProvider>
  );
}
