import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, Package, ShoppingBag, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { usePhoneAdminLoginNotifications } from "@/phone-app/hooks/use-phone-admin-login-notifications-context.tsx";

export function PhoneBottomNav() {
  const { t } = useTranslation("site");
  const location = useLocation();
  const { unreadCount } = usePhoneAdminLoginNotifications();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200/90 bg-white/90 px-1.5 pt-1 shadow-[0_-8px_32px_rgba(0,102,255,0.06)] backdrop-blur-xl",
        "dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-[0_-8px_24px_rgba(2,6,23,0.6)]",
        "pb-[max(0.35rem,env(safe-area-inset-bottom))]",
      )}
      aria-label="Phone navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
        <PhoneNavItem
          to="/app/venue"
          icon={Home}
          label={t("phone.venueHome.navHome")}
          active={location.pathname === "/app/venue"}
        />
        <PhoneNavItem
          to="/app/orders"
          icon={ShoppingBag}
          label={t("phone.venueHome.navOrders")}
          active={location.pathname === "/app/orders"}
        />
        <PhoneNavItem
          to="/app/stock"
          icon={Package}
          label={t("phone.venueHome.navStock")}
          active={location.pathname === "/app/stock"}
        />
        <PhoneNavItem
          to="/app/staff"
          icon={Users}
          label={t("phone.venueHome.navStaff")}
          active={location.pathname === "/app/staff"}
        />
        <PhoneNavItem
          to="/app/profile"
          icon={UserRound}
          label={t("phone.venueHome.navProfile")}
          active={location.pathname === "/app/profile"}
          badge={unreadCount}
        />
      </div>
    </nav>
  );
}

function PhoneNavItem({
  to,
  end: endProp,
  icon: Icon,
  label,
  active,
  badge,
}: {
  to: string;
  end?: boolean;
  icon: typeof Home;
  label: string;
  active: boolean;
  badge?: number;
}) {
  const inner = (
    <>
      <span className="relative inline-flex">
        <Icon
          className={cn(
            "size-5",
            active ? "text-[#0066FF] dark:text-[#7aa2ff]" : "text-slate-400 dark:text-slate-500",
          )}
          strokeWidth={active ? 2.25 : 1.75}
        />
        {badge != null && badge > 0 ? (
          <span className="absolute -right-1.5 -top-1 flex min-w-[1rem] justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-4 text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "mt-0.5 max-w-[4.25rem] truncate text-[10px] font-semibold",
          active ? "text-[#0066FF] dark:text-[#7aa2ff]" : "text-slate-500 dark:text-slate-400",
        )}
      >
        {label}
      </span>
    </>
  );

  return (
    <NavLink
      to={to}
      end={Boolean(endProp)}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-colors",
        active ? "bg-[#0066FF]/10 dark:bg-[#7aa2ff]/15" : "hover:bg-slate-50/90 dark:hover:bg-slate-800/70",
      )}
    >
      {inner}
    </NavLink>
  );
}
