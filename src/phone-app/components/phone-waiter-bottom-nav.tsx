import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, ClipboardList, LayoutGrid, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { usePhoneAccessBranding } from "@/phone-app/hooks/use-phone-access-branding.tsx";
import { phoneAccessHasBottomNav } from "@/lib/local-db.ts";

const ITEMS = [
  { to: "/waiter/floor", key: "navTables", icon: LayoutGrid, flag: "showNavTables" },
  { to: "/waiter/menu", key: "navMenu", icon: UtensilsCrossed, flag: "showNavMenu" },
  { to: "/waiter/orders", key: "navOrders", icon: ClipboardList, flag: "showNavOrders" },
  { to: "/waiter/notifications", key: "navNotifications", icon: Bell, flag: "showNavAlerts" },
] as const;

export function PhoneWaiterBottomNav() {
  const { t } = useTranslation("site");
  const location = useLocation();
  const access = usePhoneAccessBranding();
  const accent = access.accentColor;
  const items = ITEMS.filter((item) => access[item.flag]);

  if (!phoneAccessHasBottomNav(access) || items.length === 0) return null;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0a1224]/95 px-1.5 pt-1 backdrop-blur-xl",
        "pb-[max(0.4rem,env(safe-area-inset-bottom))]",
      )}
      aria-label={t("phone.waiter.navLabel")}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.to === "/waiter/floor"
              ? location.pathname === "/waiter/floor" ||
                location.pathname.startsWith("/waiter/table/")
              : location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-colors",
                active ? undefined : "active:bg-white/5",
              )}
              style={
                active ? { backgroundColor: `${accent}26` } : undefined
              }
            >
              <Icon
                className="size-5"
                style={{ color: active ? accent : "var(--waiter-muted)" }}
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span
                className="max-w-[4.5rem] truncate text-[10px] font-semibold"
                style={{ color: active ? accent : "var(--waiter-muted)" }}
              >
                {t(`phone.waiter.${item.key}`)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
