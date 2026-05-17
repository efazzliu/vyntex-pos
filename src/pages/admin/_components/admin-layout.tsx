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
} from "lucide-react";
import { useEffect } from "react";
import { canAccessAdminPath, canSeeAdminNavItem, type PlatformAdminRole } from "@/lib/platform-admin.ts";
import { AdminPageHeader } from "@/pages/admin/_components/admin-page-header.tsx";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import { AdminSettingsProvider, useAdminSettings } from "@/pages/admin/settings-hub/_lib/admin-settings-context.tsx";
import { runAdminAlerts } from "@/pages/admin/settings-hub/_lib/admin-alerts.ts";

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
  adminAccess,
}: {
  collapsed: boolean;
  onToggle: () => void;
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
        "relative flex h-full flex-col overflow-hidden border-r border-slate-200/80 bg-gradient-to-b from-white via-slate-50/90 to-slate-100/70 text-slate-900 shadow-[inset_-1px_0_0_0_rgba(148,163,184,0.12)] transition-[width] duration-300 ease-out dark:border-sky-500/15 dark:from-[#050c16] dark:via-[#030812] dark:to-[#02040a] dark:text-zinc-100 dark:shadow-[inset_-1px_0_0_0_rgba(56,189,248,0.06)]",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-blue-500/[0.04] via-slate-200/20 to-transparent dark:from-sky-500/10 dark:via-blue-600/4 dark:to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(59,130,246,0.05),transparent_60%)] dark:bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(56,189,248,0.07),transparent_60%)]" />

      <div className="relative z-10 flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/70 px-4 py-4 backdrop-blur-sm dark:border-sky-500/12 dark:bg-black/20">
        <Link
          to="/"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5",
            collapsed && "justify-center"
          )}
        >
          <img
            src={VYNTEX_APP_LOGO_SRC}
            alt="Vyntex POS"
            className="h-7 w-7 shrink-0"
          />
          {!collapsed && (
            <span className="truncate text-base font-bold tracking-tight bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              Vyntex POS
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-400 transition-all hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 lg:flex dark:text-sky-200/60 dark:hover:border-sky-500/25 dark:hover:bg-sky-500/10 dark:hover:text-white"
        >
          <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {!collapsed && (
        <div className="relative z-10 border-b border-slate-200/80 bg-slate-50/60 px-4 py-2.5 backdrop-blur-sm dark:border-sky-500/12 dark:bg-black/15">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-sky-200/40">
            Admin Console
          </p>
        </div>
      )}

      <nav className="relative z-10 flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-sky-200/40">
                {section.title}
              </p>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const parentActive =
                  isActive(item.href) ||
                  (item.children?.some((child) => isActive(child.href)) ?? false);
                return (
                  <div key={item.label} className="space-y-0.5">
                    <Link
                      to={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        parentActive
                          ? "border-blue-200/80 bg-blue-50 text-blue-900 shadow-[0_0_24px_-12px_rgba(37,99,235,0.25)] dark:border-sky-400/35 dark:bg-sky-500/10 dark:text-white dark:shadow-[0_0_28px_-10px_rgba(56,189,248,0.35)]"
                          : "text-slate-600 hover:border-slate-200/80 hover:bg-slate-100/80 hover:text-slate-900 dark:text-white/55 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.06] dark:hover:text-white",
                        collapsed && "justify-center px-0"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          parentActive
                            ? "bg-blue-100 text-blue-600 dark:bg-sky-500/15 dark:text-sky-300"
                            : "text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-700 dark:text-white/50 dark:group-hover:bg-white/[0.06] dark:group-hover:text-white/80"
                        )}
                      >
                        <item.icon className="size-[18px]" strokeWidth={parentActive ? 2.25 : 1.75} />
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>

                    {!collapsed && item.children?.length ? (
                      <div className="ml-11 space-y-0.5 border-l border-slate-200/80 pl-3 dark:border-sky-500/15">
                        {item.children.map((child) => (
                          <Link
                            key={`${item.label}-${child.label}`}
                            to={child.href}
                            className={cn(
                              "block rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                              isActive(child.href)
                                ? "bg-blue-50 font-semibold text-blue-700 dark:bg-sky-500/10 dark:text-sky-300"
                                : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800 dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/80"
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

      <div className="relative z-10 shrink-0 border-t border-slate-200/80 bg-slate-50/60 p-3 backdrop-blur-sm dark:border-sky-500/12 dark:bg-black/20">
        {!collapsed ? (
          <div className="rounded-xl border border-red-200/80 bg-red-50/80 px-3 py-2 text-center dark:border-sky-500/20 dark:bg-black/35">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600/90 dark:text-red-400/90">
              Platform Admin
            </p>
          </div>
        ) : (
          <div className="mx-auto size-2 rounded-full bg-red-500/80 dark:bg-red-400/80" title="Platform Admin" />
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
  const sidebarCollapsed = settings.ui.sidebarCollapsed;

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

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    void settings.saveUi({ sidebarCollapsed: next });
  };
  const mobileLinks = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/subscriptions", label: "Revenue" },
    { href: "/admin/businesses", label: "Clients" },
    { href: "/admin/licenses", label: "Licenses" },
    { href: "/admin/reports", label: "Analytics" },
    { href: "/admin/support", label: "Support" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/team", label: "Team" },
    { href: "/admin/settings", label: "Settings" },
  ].filter((x) => canSeeAdminNavItem(x.href, adminAccess));

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
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-6 w-6" />
            <span className="text-base font-bold tracking-tight">
              <span className="text-[#0066FF]">Vyntex</span>{" "}
              <span className="text-[#44CC00]">POS</span>
            </span>
          </Link>
          <span className="ml-auto px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-red-500">
            ADMIN
          </span>
        </header>

        <main
          className={cn(
            "flex-1 overflow-y-auto pb-[5.75rem] lg:p-3 lg:pb-3",
            settings.ui.compactMode && "text-[13px] [&_.space-y-6]:space-y-4",
          )}
        >
          <div className="px-6 pb-2 pt-6 lg:px-8 lg:pt-8">
            <AdminPageHeader />
          </div>
          <Outlet />
        </main>
        <div className="lg:hidden border-t border-border bg-background px-4 py-3">
          <div className="flex gap-3 overflow-x-auto">
            {mobileLinks.map((x) => (
              <Link
                key={x.href}
                to={x.href}
                className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs text-foreground"
              >
                {x.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return <AdminGate />;
}
