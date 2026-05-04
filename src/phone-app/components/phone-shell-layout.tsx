import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase.ts";
import { clearDashboardRestaurantId } from "@/hooks/use-dashboard-restaurant.ts";
import { phoneManagerAccessStillValid } from "@/lib/supabase-pos/phone-manager-invite-ops.ts";
import { cn } from "@/lib/utils.ts";
import { PhoneBottomNav } from "./phone-bottom-nav.tsx";
import { PhoneNotificationProvider } from "./phone-notification-provider.tsx";

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
      const meta = user.user_metadata as { vyntex_phone_manager?: boolean };
      if (meta?.vyntex_phone_manager !== true) return;

      const valid = await phoneManagerAccessStillValid();
      if (cancelled || valid !== false || dismissRef.current) return;
      dismissRef.current = true;

      await supabase.auth.updateUser({
        data: {
          vyntex_restaurant_id: null,
          vyntex_license_key: null,
          vyntex_phone_manager: null,
        },
      });
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
