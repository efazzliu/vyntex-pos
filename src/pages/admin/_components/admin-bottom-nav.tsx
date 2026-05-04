import { Link } from "react-router-dom";
import type { PlatformAdminRole } from "@/lib/platform-admin.ts";
import { canSeeAdminNavItem } from "@/lib/platform-admin.ts";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/licenses", label: "Licenses" },
  { href: "/admin/users", label: "Clients" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminBottomNav({ adminAccess }: { adminAccess: PlatformAdminRole | null }) {
  return (
    <div style={{ display: "flex", gap: 12, paddingTop: 12 }}>
      {links
        .filter((x) => canSeeAdminNavItem(x.href, adminAccess))
        .map((x) => (
          <Link key={x.href} to={x.href}>
            {x.label}
          </Link>
        ))}
    </div>
  );
}
import { NavLink } from "react-router-dom";
import { Banknote, Home, MessageSquare, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { canSeeAdminNavItem, type PlatformAdminRole } from "@/lib/platform-admin.ts";

const items = [
  { to: "/admin", label: "Home", icon: Home, end: true },
  { to: "/admin/users", label: "Clients", icon: Users },
  { to: "/admin/finance", label: "Finance", icon: Banknote },
  { to: "/admin/contacts", label: "Support", icon: MessageSquare },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export function AdminBottomNav({ adminAccess }: { adminAccess: PlatformAdminRole | null }) {
  const visibleItems = items.filter((x) => canSeeAdminNavItem(x.to, adminAccess));

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 px-1 pt-1 shadow-[0_-8px_32px_rgba(0,102,255,0.06)] backdrop-blur-xl lg:hidden",
        "pb-[max(0.35rem,env(safe-area-inset-bottom))]",
      )}
      aria-label="Admin navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
        {visibleItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-colors",
                isActive ? "bg-[#0066FF]/10 text-[#0066FF]" : "text-muted-foreground hover:bg-accent/50",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-5" strokeWidth={isActive ? 2.25 : 1.75} />
                <span className="max-w-[4.25rem] truncate text-[10px] font-semibold">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
