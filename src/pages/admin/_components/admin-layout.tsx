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

type SidebarItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
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
    title: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "Business",
    items: [
      { label: "Clients", href: "/admin/businesses", icon: Building2 },
      { label: "Licenses", href: "/admin/licenses", icon: KeyRound },
      { label: "Users", href: "/admin/users", icon: UserRound },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Revenue", href: "/admin/subscriptions", icon: Wallet },
      { label: "Analytics", href: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Operations",
    items: [{ label: "Support", href: "/admin/support", icon: LifeBuoy }],
  },
  {
    title: "Admin",
    items: [
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
        const haystack = `${section.title} ${item.label}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-out dark:border-white/10 dark:bg-[#0a0e16]",
        collapsed ? "w-[68px]" : "w-[248px]"
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-white/10">
        <Link
          to="/"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5",
            collapsed && "justify-center"
          )}
        >
          <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-6 w-6 shrink-0" />
          {!collapsed && (
            <span className="min-w-0 truncate text-[14px] font-semibold tracking-tight text-slate-900 dark:text-white">
              Vyntex Admin
            </span>
          )}
        </Link>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:flex dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="shrink-0 px-3 pt-3">
          <div className="flex h-8 items-center rounded-md border border-slate-200 px-2.5 transition-colors focus-within:border-slate-400 dark:border-white/10 dark:focus-within:border-white/25">
            <Search
              className="size-3.5 shrink-0 text-slate-400 dark:text-white/30"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-full min-w-0 flex-1 bg-transparent pl-2 pr-1 text-[12.5px] leading-none text-slate-700 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {sections.map((section, sectionIndex) => (
          <div key={section.title} className={cn("space-y-0.5", sectionIndex > 0 && "pt-3")}>
            {collapsed ? (
              sectionIndex > 0 ? (
                <div
                  className="mx-auto mb-2 h-px w-6 bg-slate-200 dark:bg-white/10"
                  aria-hidden="true"
                />
              ) : null
            ) : (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">
                {section.title}
              </p>
            )}

            <div className="space-y-px">
              {section.items.map((item) => {
                const parentActive =
                  isActive(item.href) ||
                  (item.children?.some((child) => isActive(child.href)) ?? false);
                return (
                  <div key={item.label}>
                    <Link
                      to={item.href}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] font-medium transition-colors",
                        parentActive
                          ? "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white",
                        collapsed && "justify-center px-0"
                      )}
                      title={collapsed ? `${section.title} · ${item.label}` : undefined}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-[#0066FF] transition-opacity",
                          parentActive ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <item.icon
                        className={cn(
                          "size-[16px] shrink-0",
                          parentActive ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-white/40"
                        )}
                        strokeWidth={parentActive ? 2 : 1.75}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>

                    {!collapsed && item.children?.length ? (
                      <div className="ml-[26px] space-y-px border-l border-slate-200 pl-2.5 dark:border-white/10">
                        {item.children.map((child) => (
                          <Link
                            key={`${item.label}-${child.label}`}
                            to={child.href}
                            className={cn(
                              "block rounded-md px-2 py-1 text-xs transition-colors",
                              isActive(child.href)
                                ? "font-medium text-slate-900 dark:text-white"
                                : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80"
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
          <p className="px-2 py-4 text-center text-xs text-slate-400 dark:text-white/30">
            No results for “{query}”
          </p>
        )}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-2.5 dark:border-white/10">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900">
              PA
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-slate-800 dark:text-white/85">
                Platform Admin
              </span>
              <span className="block truncate text-[10.5px] text-slate-400 dark:text-white/35">
                Full system access
              </span>
            </span>
          </div>
        ) : (
          <div
            className="mx-auto flex size-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900"
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
          className="w-[248px] max-w-[85vw] border-none bg-transparent p-0 shadow-[0_0_60px_-10px_rgba(0,0,0,0.6)] sm:max-w-[248px] [&>button]:hidden lg:hidden"
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
