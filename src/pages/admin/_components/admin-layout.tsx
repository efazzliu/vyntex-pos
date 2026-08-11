import { useState, type ComponentType } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  LayoutDashboard,
  Wallet,
  Building2,
  KeyRound,
  BarChart3,
  LifeBuoy,
  UserRound,
  UsersRound,
  Settings,
  ChevronLeft,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { canAccessAdminPath, canSeeAdminNavItem, type PlatformAdminRole } from "@/lib/platform-admin.ts";
import { AdminPageHeader } from "@/pages/admin/_components/admin-page-header.tsx";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import { AdminSettingsProvider, useAdminSettings } from "@/pages/admin/settings-hub/_lib/admin-settings-context.tsx";
import { runAdminAlerts } from "@/pages/admin/settings-hub/_lib/admin-alerts.ts";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet.tsx";

type SidebarAccent = {
  chip: string;
  icon: string;
  dot: string;
};

type SidebarItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  accent: SidebarAccent;
  children?: Array<{
    label: string;
    href: string;
  }>;
  accessHrefs?: string[];
};

type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

// Each nav destination gets its own accent color instead of one uniform brand tint —
// makes items instantly recognizable at a glance, like a set of app icons.
const ACCENTS = {
  blue: { chip: "bg-blue-50 dark:bg-blue-500/10", icon: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  emerald: { chip: "bg-emerald-50 dark:bg-emerald-500/10", icon: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  violet: { chip: "bg-violet-50 dark:bg-violet-500/10", icon: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500" },
  amber: { chip: "bg-amber-50 dark:bg-amber-500/10", icon: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  cyan: { chip: "bg-cyan-50 dark:bg-cyan-500/10", icon: "text-cyan-600 dark:text-cyan-400", dot: "bg-cyan-500" },
  rose: { chip: "bg-rose-50 dark:bg-rose-500/10", icon: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
  indigo: { chip: "bg-indigo-50 dark:bg-indigo-500/10", icon: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500" },
  teal: { chip: "bg-teal-50 dark:bg-teal-500/10", icon: "text-teal-600 dark:text-teal-400", dot: "bg-teal-500" },
  slate: { chip: "bg-slate-100 dark:bg-white/10", icon: "text-slate-600 dark:text-slate-300", dot: "bg-slate-500" },
} as const;

const sidebarSections: SidebarSection[] = [
  {
    title: "Platform",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, accent: ACCENTS.blue },
      { label: "Revenue", href: "/admin/subscriptions", icon: Wallet, accent: ACCENTS.emerald },
      { label: "Clients", href: "/admin/businesses", icon: Building2, accent: ACCENTS.violet },
      { label: "Licenses", href: "/admin/licenses", icon: KeyRound, accent: ACCENTS.amber },
      { label: "Analytics", href: "/admin/reports", icon: BarChart3, accent: ACCENTS.cyan },
      { label: "Support", href: "/admin/support", icon: LifeBuoy, accent: ACCENTS.rose },
      { label: "Users", href: "/admin/users", icon: UserRound, accent: ACCENTS.indigo },
      { label: "Team", href: "/admin/team", icon: UsersRound, accent: ACCENTS.teal },
      { label: "Settings", href: "/admin/settings", icon: Settings, accent: ACCENTS.slate },
    ],
  },
];

function AdminSidebar({
  collapsed,
  onToggle,
  onClose,
  adminAccess,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
  adminAccess: PlatformAdminRole | null;
}) {
  const location = useLocation();
  const [query, setQuery] = useState("");

  const isActive = (href: string) => {
    const basePath = href.split("?")[0];
    if (href === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(basePath);
  };

  const normalizedQuery = query.trim().toLowerCase();

  const sections = sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const childScope = item.children?.map((child) => child.href) ?? [];
        const baseScope = item.accessHrefs?.length ? item.accessHrefs : [item.href];
        const scope = Array.from(new Set([...baseScope, ...childScope]));
        if (!scope.some((href) => canSeeAdminNavItem(href, adminAccess))) return false;
        if (!normalizedQuery) return true;
        return item.label.toLowerCase().includes(normalizedQuery);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-[#eef1f7] p-2.5 transition-[width] duration-300 ease-out dark:bg-[#050914]",
        collapsed ? "w-[84px]" : "w-[280px]"
      )}
    >
      {/* Floating card "dock" — a distinct nav shell, separate from the page chrome, that
          follows the app's own light/dark theme instead of forcing one look. */}
      <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-slate-200/70 bg-white shadow-[0_20px_45px_-28px_rgba(15,23,42,0.35)] dark:border-white/[0.06] dark:bg-[#0b0f1a] dark:shadow-[0_20px_45px_-28px_rgba(0,0,0,0.7)]">
        <div className="flex shrink-0 items-center gap-2.5 px-4 pt-4 pb-3">
          <Link
            to="/"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5",
              collapsed && "justify-center"
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0066FF] to-[#44CC00] shadow-[0_8px_18px_-8px_rgba(0,102,255,0.55)]">
              <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-[18px] w-[18px]" />
            </span>
            {!collapsed && (
              <span className="min-w-0 truncate text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                Vyntex POS
              </span>
            )}
          </Link>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 lg:flex dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="relative shrink-0 px-3 pb-3">
            <Search className="pointer-events-none absolute left-6 top-1/2 size-3.5 -translate-y-1/2 text-slate-400 dark:text-white/30" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search menu…"
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-[12.5px] font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-sky-500/40 dark:focus:bg-white/[0.08]"
            />
          </div>
        )}

        <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 pb-3">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-white/25">
                  {section.title}
                </p>
              )}

              <div className="space-y-1">
                {section.items.map((item) => {
                  const parentActive =
                    isActive(item.href) ||
                    (item.children?.some((child) => isActive(child.href)) ?? false);
                  return (
                    <div key={item.label} className="space-y-0.5">
                      <Link
                        to={item.href}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-2xl px-2 py-2 text-[13px] font-semibold transition-all duration-200",
                          parentActive
                            ? "bg-slate-100 text-slate-900 dark:bg-white/[0.09] dark:text-white"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/[0.05] dark:hover:text-white/85",
                          collapsed && "justify-center px-0"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200",
                            item.accent.chip,
                            item.accent.icon,
                            parentActive && "scale-[1.06]"
                          )}
                        >
                          <item.icon className="size-[17px]" strokeWidth={2} />
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && parentActive && (
                          <span className={cn("ml-auto size-1.5 shrink-0 rounded-full", item.accent.dot)} />
                        )}
                      </Link>

                      {!collapsed && item.children?.length ? (
                        <div className="ml-11 space-y-0.5 border-l border-slate-200 pl-3 dark:border-white/10">
                          {item.children.map((child) => (
                            <Link
                              key={`${item.label}-${child.label}`}
                              to={child.href}
                              className={cn(
                                "block rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                                isActive(child.href)
                                  ? "bg-slate-100 font-semibold text-slate-900 dark:bg-white/[0.08] dark:text-white"
                                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/[0.05] dark:hover:text-white/80"
                              )}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!collapsed && sections.length === 0 && (
            <p className="px-2.5 py-4 text-center text-xs text-slate-400 dark:text-white/30">
              No results for “{query}”
            </p>
          )}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-2.5 dark:border-white/[0.06]">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.04]">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-400 text-[11px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(239,68,68,0.55)]">
                PA
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-800 dark:text-white">
                  Platform Admin
                </span>
                <span className="block truncate text-[10px] text-slate-400 dark:text-white/40">
                  Full system access
                </span>
              </span>
            </div>
          ) : (
            <div
              className="mx-auto flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-400 text-[10px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(239,68,68,0.55)]"
              title="Platform Admin"
            >
              PA
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function AdminGate() {
  const { user, isAdmin, adminAccess, loading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true, state: { from: "/admin" } });
      return;
    }
    if (!isAdmin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!canAccessAdminPath(location.pathname, adminAccess)) {
      navigate("/admin", { replace: true });
    }
  }, [user, isAdmin, loading, navigate, location.pathname, adminAccess]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="flex flex-col items-center gap-4">
          <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-12 w-12 animate-pulse" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <AdminSettingsProvider>
      <AdminContentInner adminAccess={adminAccess} />
    </AdminSettingsProvider>
  );
}

function AdminContentInner({ adminAccess }: { adminAccess: PlatformAdminRole | null }) {
  const settings = useAdminSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarCollapsed = settings.ui.sidebarCollapsed;
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const goBackToProfile = () => {
    const from = (location.state as { from?: string } | null)?.from;
    if (
      typeof from === "string" &&
      from.startsWith("/") &&
      !from.startsWith("/admin")
    ) {
      navigate(from);
      return;
    }
    // Profile / settings — where admins enter the admin panel from.
    navigate("/dashboard/settings");
  };

  useEffect(() => {
    if (!settings.loaded || !settings.email) return;
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default" &&
      settings.notifications.push
    ) {
      void Notification.requestPermission();
    }
    void runAdminAlerts(settings.notifications, settings.email);
  }, [settings.loaded, settings.email, settings.notifications]);

  // Close the mobile drawer only when the route changes (not when it opens).
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    void settings.saveUi({ sidebarCollapsed: next });
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f4f6fa] dark:bg-[#050914]">
      {/* Desktop sidebar */}
      <div className="hidden shrink-0 lg:block">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          adminAccess={adminAccess}
        />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open admin menu"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background/60 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-[0_6px_18px_-14px_rgba(2,6,23,0.55)] transition-all hover:bg-accent/60 active:scale-[0.98]"
          >
            <Menu className="size-4" />
          </button>
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-6 w-6" />
            <span className="text-base font-bold tracking-tight">
              <span className="text-[#0066FF]">Vyntex</span>{" "}
              <span className="text-[#44CC00]">POS</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={goBackToProfile}
            aria-label="Back to profile"
            title="Back to profile"
            className="ml-auto inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/15 active:scale-[0.98]"
          >
            <ChevronLeft className="size-3.5" />
            ADMIN
          </button>
        </header>

        <main
          className={cn(
            "flex-1 overflow-y-auto pb-4 lg:p-3 lg:pb-3",
            settings.ui.compactMode && "text-[13px] [&_.space-y-6]:space-y-4",
          )}
        >
          <div className="px-6 pb-2 pt-6 lg:px-8 lg:pt-8">
            <AdminPageHeader />
          </div>
          <Outlet />
        </main>
      </div>

      {/* Mobile side drawer */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[272px] max-w-[85vw] border-none bg-transparent p-0 shadow-[0_0_60px_-10px_rgba(0,0,0,0.6)] sm:max-w-[300px] [&>button]:hidden lg:hidden"
        >
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <AdminSidebar
            collapsed={false}
            onToggle={toggleSidebar}
            onClose={() => setMobileSidebarOpen(false)}
            adminAccess={adminAccess}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function AdminLayout() {
  return <AdminGate />;
}
