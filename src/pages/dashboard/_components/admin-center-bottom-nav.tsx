import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import { useDashboardLocale } from "./dashboard-locale-context.tsx";
import {
  ADMIN_MOBILE_BOTTOM_LINKS,
  adminPathActive,
} from "../_lib/admin-center-nav.ts";

export function AdminCenterBottomNav() {
  const location = useLocation();
  const { t } = useDashboardLocale();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/90 bg-white/90 px-1 pt-1 shadow-[0_-8px_32px_rgba(0,102,255,0.06)] backdrop-blur-xl md:hidden",
        "pb-[max(0.35rem,env(safe-area-inset-bottom))]",
      )}
      aria-label={t("ac.nav.admin_center")}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
        {ADMIN_MOBILE_BOTTOM_LINKS.map((link) => {
          const Icon = link.icon;
          const active =
            link.href.startsWith("/admin-center/settings")
              ? location.pathname === "/admin-center/settings"
              : adminPathActive(location.pathname, location.search, link.href);
          return (
            <NavLink
              key={link.href}
              to={link.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-colors",
                active ? "bg-[#0066FF]/10" : "hover:bg-slate-50/90",
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0",
                  active ? "text-[#0066FF]" : "text-slate-400",
                )}
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span
                className={cn(
                  "mt-0.5 max-w-[4.25rem] truncate text-[10px] font-semibold",
                  active ? "text-[#0066FF]" : "text-slate-500",
                )}
              >
                {t(link.key)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
