import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase.ts";
import { clearDashboardRestaurantId } from "@/hooks/use-dashboard-restaurant.ts";
import { isPhoneManagerSession } from "@/lib/supabase-pos/phone-manager-session.ts";
import { fetchRestaurantOwnedBySession } from "@/lib/supabase-pos/phone-pos-session.ts";
import { isMissingPgColumnError } from "@/lib/supabase-pos/db-errors.ts";

/**
 * Blocks phone app access when mobile dashboard access is disabled
 * on all licenses available to this account.
 */
export default function PhoneMobileAccessGate() {
  const { t } = useTranslation("site");
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const didToast = useRef(false);

  async function isMobileAccessEnabledForRestaurantId(restaurantId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("restaurants")
      .select("mobile_access_enabled")
      .eq("id", restaurantId)
      .maybeSingle();
    if (error) {
      if (isMissingPgColumnError(error.message, "mobile_access_enabled")) return true;
      throw error;
    }
    return (data as { mobile_access_enabled?: boolean } | null)?.mobile_access_enabled !== false;
  }

  async function ownerHasAnyMobileAccess(userId: string, userEmail: string | null): Promise<boolean> {
    let byUserIdEnabled = false;
    const qById = await supabase
      .from("restaurants")
      .select("id, mobile_access_enabled")
      .eq("owner_user_id", userId);
    if (qById.error) {
      if (isMissingPgColumnError(qById.error.message, "mobile_access_enabled")) return true;
      throw qById.error;
    }
    const byIdRows = (qById.data ?? []) as Array<{ mobile_access_enabled?: boolean }>;
    byUserIdEnabled = byIdRows.some((r) => r.mobile_access_enabled !== false);

    const emailNorm = (userEmail ?? "").trim().toLowerCase();
    if (!emailNorm) return byUserIdEnabled || byIdRows.length === 0;

    const qByEmail = await supabase
      .from("restaurants")
      .select("id, mobile_access_enabled")
      .eq("owner_email", emailNorm);
    if (qByEmail.error) {
      if (isMissingPgColumnError(qByEmail.error.message, "mobile_access_enabled")) return true;
      throw qByEmail.error;
    }
    const byEmailRows = (qByEmail.data ?? []) as Array<{ mobile_access_enabled?: boolean }>;
    const byEmailEnabled = byEmailRows.some((r) => r.mobile_access_enabled !== false);

    const total = byIdRows.length + byEmailRows.length;
    if (total === 0) return true;
    return byUserIdEnabled || byEmailEnabled;
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        let canUsePhone = true;
        if (await isPhoneManagerSession()) {
          const row = await fetchRestaurantOwnedBySession();
          canUsePhone = row ? await isMobileAccessEnabledForRestaurantId(row.id) : true;
        } else {
          canUsePhone = await ownerHasAnyMobileAccess(user.id, user.email ?? null);
        }

        if (cancelled) return;
        if (!canUsePhone) {
          setAllowed(false);
          if (!didToast.current) {
            didToast.current = true;
            toast.error(t("phone.mobileAccessDisabled"));
          }
          clearDashboardRestaurantId();
          await supabase.auth.signOut();
          if (!cancelled) setSignedOut(true);
          return;
        }
        setAllowed(true);
      } catch {
        // Fail open to avoid locking users out on transient errors.
        setAllowed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  if (signedOut) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white px-4">
        <p className="text-sm text-slate-600">{t("phone.venues.loading")}</p>
      </div>
    );
  }
  if (!allowed) {
    return null;
  }
  return <Outlet />;
}
