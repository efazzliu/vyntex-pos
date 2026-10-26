import { useEffect, type ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { fetchWaiterPhoneBindingStatus } from "@/lib/supabase-pos/waiter-phone-binding.ts";
import {
  clearWaiterPhonePair,
  clearWaiterSession,
  getWaiterPhonePair,
  getWaiterSession,
  isOwnerLocalWaiterPair,
  isWaiterDesignPreviewLicense,
} from "@/phone-app/lib/waiter-session.ts";
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

  useEffect(() => {
    const pair = getWaiterPhonePair();
    if (!pair?.licenseKey || !pair.deviceId) return;
    if (isWaiterDesignPreviewLicense(pair.licenseKey)) return;
    if (isOwnerLocalWaiterPair(pair)) return;

    let cancelled = false;
    const check = async () => {
      const status = await fetchWaiterPhoneBindingStatus(
        pair.licenseKey,
        pair.deviceId,
      );
      if (cancelled || !status) return;
      if (status.disconnected || !status.bound) {
        clearWaiterSession();
        clearWaiterPhonePair();
        navigate("/waiter", { replace: true });
      }
    };
    void check();
    const id = window.setInterval(() => void check(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [navigate]);

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
