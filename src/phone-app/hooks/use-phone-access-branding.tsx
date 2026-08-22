import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_PHONE_ACCESS_BRANDING,
  type PhoneAccessBranding,
} from "@/lib/local-db.ts";
import { resolvePhoneAccessBranding } from "@/lib/supabase-pos/license-sync.ts";
import { getWaiterSession } from "@/phone-app/lib/waiter-session.ts";

const PhoneAccessBrandingContext = createContext<PhoneAccessBranding>(
  DEFAULT_PHONE_ACCESS_BRANDING,
);

export function PhoneAccessBrandingProvider({ children }: { children: ReactNode }) {
  const licenseKey = getWaiterSession()?.licenseKey ?? "";
  const [branding, setBranding] = useState<PhoneAccessBranding>(
    DEFAULT_PHONE_ACCESS_BRANDING,
  );

  useEffect(() => {
    if (!licenseKey) return;
    let cancelled = false;
    void resolvePhoneAccessBranding(licenseKey).then((next) => {
      if (!cancelled) setBranding(next);
    });
    return () => {
      cancelled = true;
    };
  }, [licenseKey]);

  return (
    <PhoneAccessBrandingContext.Provider value={branding}>
      {children}
    </PhoneAccessBrandingContext.Provider>
  );
}

export function usePhoneAccessBranding(): PhoneAccessBranding {
  return useContext(PhoneAccessBrandingContext);
}
