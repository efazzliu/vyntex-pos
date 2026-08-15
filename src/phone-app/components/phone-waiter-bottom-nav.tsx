import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, ClipboardList, LayoutGrid, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const ITEMS = [
  { to: "/waiter/floor", key: "navTables", icon: LayoutGrid },
  { to: "/waiter/menu", key: "navMenu", icon: UtensilsCrossed },
  { to: "/waiter/orders", key: "navOrders", icon: ClipboardList },
  { to: "/waiter/notifications", key: "navNotifications", icon: Bell },
] as const;

export function PhoneWaiterBottomNav() {
  const { t } = useTranslation("site");
  const location = useLocation();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0a1224]/95 px-1.5 pt-1 backdrop-blur-xl",
        "pb-[max(0.4rem,env(safe-area-inset-bottom))]",
      )}
      aria-label={t("phone.waiter.navLabel")}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
        {ITEMS.map((item) => {
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
                active ? "bg-[#0066FF]/15" : "active:bg-white/5",
              )}
            >
              <Icon
                className={cn(
                  "size-5",
                  active ? "text-[#7eb6ff]" : "text-white/40",
                )}
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span
                className={cn(
                  "max-w-[4.5rem] truncate text-[10px] font-semibold",
                  active ? "text-[#7eb6ff]" : "text-white/45",
                )}
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
