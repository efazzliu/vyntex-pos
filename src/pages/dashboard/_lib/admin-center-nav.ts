import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building2,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  UserRound,
  Users,
} from "lucide-react";

export type AdminNavLink = {
  href: string;
  key: string;
  icon: LucideIcon;
};

/** Mobile bottom bar: same five-tab pattern as the venue phone shell. */
export const ADMIN_MOBILE_BOTTOM_LINKS: readonly AdminNavLink[] = [
  { href: "/admin-center/overview", key: "ac.nav.overview", icon: LayoutDashboard },
  { href: "/admin-center/venues", key: "ac.nav.venues", icon: Building2 },
  { href: "/admin-center/licenses", key: "ac.nav.licenses", icon: KeyRound },
  { href: "/admin-center/billing", key: "ac.nav.billing", icon: CreditCard },
  { href: "/admin-center/settings?tab=account", key: "ac.nav.profile", icon: UserRound },
] as const;

/** Desktop sidebar: all Admin Center sections. */
export const ADMIN_PRIMARY_LINKS: readonly AdminNavLink[] = [
  ...ADMIN_MOBILE_BOTTOM_LINKS.slice(0, 4),
  { href: "/admin-center/team-access", key: "ac.nav.team", icon: Users },
  { href: "/admin-center/activity", key: "ac.nav.activity", icon: Activity },
] as const;

export function adminPathActive(pathname: string, search: string, href: string): boolean {
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
