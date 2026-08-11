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
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { canAccessAdminPath, canSeeAdminNavItem, type PlatformAdminRole } from "@/lib/platform-admin.ts";
import { AdminPageHeader } from "@/pages/admin/_components/admin-page-header.tsx";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import { AdminSettingsProvider, useAdminSettings } from "@/pages/admin/settings-hub/_lib/admin-settings-context.tsx";
import { runAdminAlerts } from "@/pages/admin/settings-hub/_lib/admin-alerts.ts";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet.tsx";

type SidebarItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
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

const sidebarSections: SidebarSection[] = [
  {
    title: "Platform",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Revenue", href: "/admin/subscriptions", icon: Wallet },
      { label: "Clients", href: "/admin/businesses", icon: Building2 },
      { label: "Licenses", href: "/admin/licenses", icon: KeyRound },
      { label: "Analytics", href: "/admin/reports", icon: BarChart3 },
      { label: "Support", href: "/admin/support", icon: LifeBuoy },
      { label: "Users", href: "/admin/users", icon: UserRound },
      { label: "Team", href: "/admin/team", icon: UsersRound },
      { label: "Settings", href: "/admin/settings", icon: Settings },
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

  const isActive = (href: string) => {
    const basePath = href.split("?")[0];
    if (href === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(basePath);
  };

  const sections = sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const childScope = item.children?.map((child) => child.href) ?? [];
        const baseScope = item.accessHrefs?.length ? item.accessHrefs : [item.href];
        const scope = Array.from(new Set([...baseScope, ...childScope]));
        return scope.some((href) => canSeeAdminNavItem(href, adminAccess));
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col overflow-hidden bg-[#080b13] text-white transition-[width] duration-300 ease-out",
        collapsed ? "w-[76px]" : "w-[272px]"
      )}
    >
      {/* Ambient brand glow — a fixed dark "control room" chrome, independent of the app theme. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,102,255,0.20),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(68,204,0,0.14),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />

      <div className="relative z-10 flex shrink-0 items-center gap-3 px-4 pt-5 pb-4">
        <Link
          to="/"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3",
            collapsed && "justify-center"
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#44CC00] shadow-[0_10px_26px_-10px_rgba(0,102,255,0.65)]">
            <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-5 w-5" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight tracking-tight text-white">
                Vyntex POS
              </span>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                Control Center
              </span>
            </span>
          )}
        </Link>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/50 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <X className="size-[18px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/40 transition-all hover:bg-white/10 hover:text-white lg:flex"
          >
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="relative z-10 mx-4 mb-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2">
          <ShieldCheck className="size-3.5 shrink-0 text-emerald-400" />
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
            Platform Admin
          </span>
          <span className="ml-auto size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" />
        </div>
      )}

      <nav className="relative z-10 flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
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
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-200",
                        parentActive
                          ? "bg-white/[0.09] text-white"
                          : "text-white/50 hover:bg-white/[0.05] hover:text-white/90",
                        collapsed && "justify-center px-0"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#0066FF] to-[#44CC00] transition-opacity duration-200",
                          parentActive ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                          parentActive
                            ? "bg-gradient-to-br from-[#0066FF]/30 to-[#44CC00]/25 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                            : "bg-white/[0.04] text-white/40 group-hover:bg-white/[0.09] group-hover:text-white/80"
                        )}
                      >
                        <item.icon className="size-[17px]" strokeWidth={parentActive ? 2.25 : 1.75} />
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>

                    {!collapsed && item.children?.length ? (
                      <div className="ml-11 space-y-0.5 border-l border-white/[0.08] pl-3">
                        {item.children.map((child) => (
                          <Link
                            key={`${item.label}-${child.label}`}
                            to={child.href}
                            className={cn(
                              "block rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                              isActive(child.href)
                                ? "bg-white/[0.08] font-semibold text-white"
                                : "text-white/40 hover:bg-white/[0.05] hover:text-white/80"
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
      </nav>

      <div className="relative z-10 shrink-0 border-t border-white/[0.06] p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-400 text-[11px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(239,68,68,0.7)]">
              PA
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">Platform Admin</span>
              <span className="block truncate text-[10px] text-white/40">Full system access</span>
            </span>
          </div>
        ) : (
          <div
            className="mx-auto flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-400 text-[10px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(239,68,68,0.7)]"
            title="Platform Admin"
          >
            PA
          </div>
        )}
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
