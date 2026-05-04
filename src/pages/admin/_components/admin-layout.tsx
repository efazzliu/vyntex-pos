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
  Users,
  Settings,
  ChevronLeft,
} from "lucide-react";
import { useEffect } from "react";
import { canAccessAdminPath, canSeeAdminNavItem, type PlatformAdminRole } from "@/lib/platform-admin.ts";
import { AdminPageHeader } from "@/pages/admin/_components/admin-page-header.tsx";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

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
    title: "MAIN",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Revenue", href: "/admin/subscriptions", icon: Wallet },
      { label: "Clients", href: "/admin/businesses", icon: Building2 },
      { label: "Licenses", href: "/admin/licenses", icon: KeyRound },
      { label: "Analytics", href: "/admin/reports", icon: BarChart3 },
      { label: "Support", href: "/admin/support", icon: LifeBuoy },
      { label: "Team", href: "/admin/users", icon: Users },
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
        "relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-[0_20px_48px_-34px_rgba(2,6,23,0.35)] transition-all duration-300 dark:border-slate-800 dark:bg-[#070d1f] dark:text-white dark:shadow-[0_24px_52px_-30px_rgba(0,0,0,0.75)]",
        collapsed ? "w-20" : "w-[276px]"
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0066FF]/8 to-transparent dark:from-[#0066FF]/12"
        aria-hidden
      />
      {/* Header */}
      <div className="relative mx-3 mt-3 flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 dark:border-white/10 dark:bg-white/[0.02]">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <img src={LOGO_URL} alt="Vyntex POS" className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="truncate bg-gradient-to-r from-[#0066FF] via-cyan-500 to-[#44CC00] bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
              Vyntex POS
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="hidden cursor-pointer rounded-lg border border-slate-200/80 bg-white p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:block dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ChevronLeft
            className={cn(
              "size-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      <nav className="relative flex-1 space-y-4 overflow-y-auto px-3 pb-4 pt-5">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            {!collapsed && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-white/35">
                {section.title}
              </p>
            )}

            {section.items.map((item) => {
              const parentActive = isActive(item.href) || (item.children?.some((child) => isActive(child.href)) ?? false);
              return (
                <div key={item.label} className="space-y-1">
                  <Link
                    to={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      parentActive
                        ? "border border-[#2f6ebf]/40 bg-[#0066FF]/10 text-[#0c234f] dark:border-[#2f6ebf]/55 dark:bg-[#0066FF]/18 dark:text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/6 dark:hover:text-white",
                      collapsed && "justify-center px-0"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon
                      className={cn(
                        "size-5 shrink-0 transition-colors",
                        parentActive
                          ? "text-[#0f4cb8] dark:text-white"
                          : "text-slate-500 group-hover:text-slate-800 dark:text-white/75 dark:group-hover:text-white",
                      )}
                    />
                    {!collapsed && item.label}
                  </Link>

                  {!collapsed && item.children?.length ? (
                    <div className="ml-6 space-y-0.5 border-l border-slate-200/80 pl-3 dark:border-white/12">
                      {item.children.map((child) => (
                        <Link
                          key={`${item.label}-${child.label}`}
                          to={child.href}
                          className={cn(
                            "block rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                            isActive(child.href)
                              ? "bg-[#0066FF]/12 text-[#0f4cb8] dark:bg-[#0066FF]/20 dark:text-white"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-white/60 dark:hover:bg-white/7 dark:hover:text-white",
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
        ))}
      </nav>
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
          <img src={LOGO_URL} alt="Vyntex POS" className="h-12 w-12 animate-pulse" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return <AdminContent adminAccess={adminAccess} />;
}

function AdminContent({ adminAccess }: { adminAccess: PlatformAdminRole | null }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mobileLinks = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/subscriptions", label: "Revenue" },
    { href: "/admin/businesses", label: "Clients" },
    { href: "/admin/licenses", label: "Licenses" },
    { href: "/admin/reports", label: "Analytics" },
    { href: "/admin/support", label: "Support" },
    { href: "/admin/users", label: "Team" },
    { href: "/admin/settings", label: "Settings" },
  ].filter((x) => canSeeAdminNavItem(x.href, adminAccess));

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-[#050914]">
      {/* Desktop sidebar */}
      <div className="hidden shrink-0 lg:block lg:p-2.5">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          adminAccess={adminAccess}
        />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src={LOGO_URL} alt="Vyntex POS" className="h-6 w-6" />
            <span className="text-base font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              Vyntex POS
            </span>
          </Link>
          <span className="ml-auto px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-red-500">
            ADMIN
          </span>
        </header>

        <main className="flex-1 overflow-y-auto pb-[5.75rem] lg:p-3 lg:pb-3">
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
