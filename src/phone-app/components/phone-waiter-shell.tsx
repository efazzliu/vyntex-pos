import { useEffect, type ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";
import { PhoneAccessBrandingProvider, usePhoneAccessBranding } from "@/phone-app/hooks/use-phone-access-branding.tsx";
import { cn } from "@/lib/utils.ts";
import { phoneAccessThemeTokens, waiterThemeStyle } from "@/lib/phone-access-theme.ts";
import { useWaiterReadyToasts } from "@/phone-app/hooks/use-waiter-ready-toasts.ts";
import { PhoneWaiterBottomNav } from "./phone-waiter-bottom-nav.tsx";

function WaiterThemeFrame({ children }: { children: ReactNode }) {
  const access = usePhoneAccessBranding();
  const tokens = phoneAccessThemeTokens(access.theme);
  return (
    <div
      data-waiter-theme={tokens.isLight ? "light" : "dark"}
      data-waiter-skin={tokens.id}
      className={cn("relative min-h-dvh", tokens.isLight ? "text-[#0f172a]" : "text-white")}
      style={waiterThemeStyle(tokens)}
    >
      {children}
    </div>
  );
}

export default function PhoneWaiterShell() {
  const navigate = useNavigate();
  const session = getWaiterSession();
  useWaiterReadyToasts(session?.licenseKey ?? "", session?.staff.id ?? "");

  useEffect(() => {
    if (!session) navigate("/waiter", { replace: true });
  }, [session, navigate]);

  if (!session) return null;

  return (
    <PhoneAccessBrandingProvider>
      <WaiterThemeFrame>
        <Outlet />
        <PhoneWaiterBottomNav />
      </WaiterThemeFrame>
    </PhoneAccessBrandingProvider>
  );
}
