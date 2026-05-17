import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase.ts";
import {
  clearDashboardRestaurantId,
  setDashboardRestaurantId,
} from "@/hooks/use-dashboard-restaurant.ts";
import { fetchPhoneManagerRestaurantId } from "@/lib/supabase-pos/phone-manager-session.ts";
import { cn } from "@/lib/utils.ts";
import { PhoneBottomNav } from "./phone-bottom-nav.tsx";
import { PhoneNotificationProvider } from "./phone-notification-provider.tsx";

const DASHBOARD_RESTAURANT_ID_KEY = "vyntex.dashboard.restaurantId";

function PhoneManagerAccessGuard() {
  const navigate = useNavigate();
  const { t } = useTranslation("site");
  const dismissRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const managerVenueId = await fetchPhoneManagerRestaurantId();
      if (managerVenueId) {
        setDashboardRestaurantId(managerVenueId);
        return;
      }

      const stored = localStorage.getItem(DASHBOARD_RESTAURANT_ID_KEY)?.trim();
      if (!stored) return;

      const { data: venue } = await supabase
        .from("restaurants")
        .select("owner_user_id, owner_email")
        .eq("id", stored)
        .maybeSingle();

      const email = user.email?.trim().toLowerCase() ?? "";
      const isOwner =
        venue?.owner_user_id === user.id ||
        (email.length > 0 &&
          (venue?.owner_email ?? "").trim().toLowerCase() === email);

      if (isOwner) return;

      if (cancelled || dismissRef.current) return;
      dismissRef.current = true;

      clearDashboardRestaurantId();
      toast.error(t("phone.team.accessRevoked"));
      navigate("/app/profile", { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, t]);

  return null;
}

export default function PhoneShellLayout() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <PhoneNotificationProvider>
      <PhoneManagerAccessGuard />
      <div
        className={cn(
          "phone-app-shell relative flex min-h-dvh flex-col",
          isDark
            ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100"
            : "bg-gradient-to-b from-slate-100 via-[#f3f7ff] to-slate-100 text-slate-900",
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto pb-[5.75rem]">
          <Outlet />
        </div>
        <PhoneBottomNav />
      </div>
    </PhoneNotificationProvider>
  );
}
