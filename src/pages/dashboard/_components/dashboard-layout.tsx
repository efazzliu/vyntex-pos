import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { cn } from "@/lib/utils.ts";
import SetupForm from "./setup-form.tsx";
import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  Settings,
  LogOut,
  Menu,
  ChevronLeft,
} from "lucide-react";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

const sidebarLinks = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Orders", href: "/dashboard/orders", icon: ClipboardList },
  { label: "Menu", href: "/dashboard/menu", icon: UtensilsCrossed },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function DashboardSidebar({
  collapsed,
  onToggle,
  mobile,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
}) {
  const location = useLocation();
  const { user, removeUser } = useAuth();
  const restaurant = useQuery(api.dashboard.restaurants.getMyRestaurant);

  const isActive = (href: string) => {
    if (href === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-[#0a0f1e] text-white transition-all duration-300 h-full",
        mobile ? "w-full" : collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <img src={LOGO_URL} alt="VYNTEX" className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent truncate">
              VYNTEX
            </span>
          )}
        </Link>
        {!mobile && (
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-white/10 text-white/60 cursor-pointer hidden lg:block"
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

      {/* Restaurant name */}
      {!collapsed && restaurant && (
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs text-white/40 uppercase tracking-wider">
            Restaurant
          </p>
          <p className="text-sm font-medium text-white/90 truncate">
            {restaurant.name}
          </p>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {sidebarLinks.map((link) => (
          <Link
            key={link.href}
            to={link.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive(link.href)
                ? "bg-gradient-to-r from-[#0066FF]/20 to-[#44CC00]/10 text-white border border-[#0066FF]/30"
                : "text-white/60 hover:text-white hover:bg-white/5",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? link.label : undefined}
          >
            <link.icon className="size-5 shrink-0" />
            {!collapsed && link.label}
          </Link>
        ))}
      </nav>

      {/* User section */}
      {!collapsed && (
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0066FF] to-[#44CC00] flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user?.profile.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/90 truncate">
                {user?.profile.name || "User"}
              </p>
              <p className="text-xs text-white/40 truncate">
                {user?.profile.email || ""}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => removeUser()}
          >
            <LogOut className="size-4 mr-2" />
            Sign Out
          </Button>
        </div>
      )}
    </aside>
  );
}

function DashboardContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const restaurant = useQuery(api.dashboard.restaurants.getMyRestaurant);

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
      <div className="flex items-center justify-center h-dvh">
        <div className="flex flex-col items-center gap-4">
          <img src={LOGO_URL} alt="VYNTEX" className="h-12 w-12 animate-pulse" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  // No restaurant - show setup
  if (restaurant === null) {
    return <SetupForm />;
  }

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <DashboardSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 h-full">
            <DashboardSidebar
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              mobile
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-accent cursor-pointer"
          >
            <Menu className="size-5" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src={LOGO_URL} alt="VYNTEX" className="h-6 w-6" />
            <span className="text-base font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              VYNTEX
            </span>
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center h-dvh">
          <div className="flex flex-col items-center gap-4">
            <img src={LOGO_URL} alt="VYNTEX" className="h-12 w-12 animate-pulse" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex items-center justify-center h-dvh bg-background">
          <div className="text-center max-w-md mx-auto px-4">
            <img src={LOGO_URL} alt="VYNTEX" className="h-16 w-16 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Sign in to your dashboard
            </h1>
            <p className="text-muted-foreground mb-6">
              Access your restaurant management tools, orders, and analytics.
            </p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <DashboardContent />
      </Authenticated>
    </>
  );
}
