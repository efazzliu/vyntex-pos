import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import { isMissingSupabaseTableError } from "./db-errors.ts";
import { getRestaurantByLicense } from "./restaurant.ts";
import { fetchAllRestaurantsOwnedBySession } from "./phone-pos-session.ts";
import { uuidOrNull } from "./uuid.ts";

function isMobileEventStaffFkViolation(error: { message?: string; code?: string }): boolean {
  const m = String(error.message ?? "").toLowerCase();
  const code = String(error.code ?? "");
  if (code !== "23503") return false;
  return (
    m.includes("staff_id") ||
    m.includes("mobile_admin_login_events_staff_id") ||
    (m.includes("foreign key") && m.includes("staff"))
  );
}

export type MobileAdminLoginEventRow = {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  staff_name: string;
  staff_role: string;
  is_device_admin: boolean;
  staff_id: string | null;
  created_at: string;
};

/** Feed for the phone app: events visible to this session + how many venues they own (for empty-state UX). */
export type MobileAdminLoginFeed = {
  events: MobileAdminLoginEventRow[];
  ownedRestaurantCount: number;
};

/**
 * Inserts one row for the owner phone app. Retries without `staff_id` if FK to `staff` fails
 * (same pattern as `pos_audit_logs`).
 */
export async function recordMobileAdminLoginEvent(args: {
  restaurantId: string;
  restaurantName: string;
  staffName: string;
  staffRole: string;
  isDeviceAdmin: boolean;
  staffId: string | null;
}): Promise<void> {
  let staffId = uuidOrNull(args.staffId ?? undefined);
  const row = {
    restaurant_id: args.restaurantId,
    restaurant_name: args.restaurantName.slice(0, 200),
    staff_name: args.staffName.slice(0, 200),
    staff_role: args.staffRole.slice(0, 50),
    is_device_admin: args.isDeviceAdmin,
    staff_id: staffId,
  };
  let { error } = await supabase.from("mobile_admin_login_events").insert(row);
  if (error && staffId && isMobileEventStaffFkViolation(error)) {
    staffId = null;
    ({ error } = await supabase.from("mobile_admin_login_events").insert({
      ...row,
      staff_id: null,
    }));
  }
  if (error) {
    const msg = String(error.message ?? "");
    if (isMissingSupabaseTableError(msg, "mobile_admin_login_events")) {
      console.error(
        "[POS] mobile_admin_login_events missing — run supabase/ensure_mobile_admin_login_events.sql in Supabase SQL Editor.",
      );
    } else {
      console.warn("[POS] mobile_admin_login_events insert:", error.message);
    }
  }
}

/**
 * Called from POS PIN screen when an admin signs in — independent of `pos_audit_logs`
 * so notifications still work if audit insert fails (RLS, missing table, etc.).
 */
export async function recordAdminPinLoginForPhone(args: {
  licenseKey: string;
  staffName: string;
  staffId?: string | null;
  staffRole: string;
  isDeviceAdmin: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured) {
    console.warn("[POS] Supabase env missing — cannot sync admin login to phone notifications.");
    return;
  }
  const staffId = uuidOrNull(args.staffId ?? undefined);
  /** Prefer RPC (SECURITY DEFINER): works when RLS/GRANTs block direct anon INSERT from the browser. */
  const { error: rpcError } = await supabase.rpc("append_mobile_admin_login_event", {
    p_license_key: args.licenseKey.trim(),
    p_staff_name: args.staffName.slice(0, 200),
    p_staff_role: args.staffRole.slice(0, 50),
    p_is_device_admin: args.isDeviceAdmin,
    p_staff_id: staffId,
  });
  if (!rpcError) return;

  console.warn("[POS] append_mobile_admin_login_event RPC:", rpcError.message);

  try {
    const r = await getRestaurantByLicense(args.licenseKey);
    await recordMobileAdminLoginEvent({
      restaurantId: r.id,
      restaurantName: r.name,
      staffName: args.staffName,
      staffRole: args.staffRole,
      isDeviceAdmin: args.isDeviceAdmin,
      staffId,
    });
  } catch (e) {
    console.warn("[POS] recordAdminPinLoginForPhone fallback:", e instanceof Error ? e.message : e);
  }
}

export async function fetchMobileAdminLoginEventsForSession(): Promise<MobileAdminLoginFeed> {
  const list = await fetchAllRestaurantsOwnedBySession();
  if (list.length === 0) return { events: [], ownedRestaurantCount: 0 };
  const ids = list.map((x) => x.id);
  const { data, error } = await supabase
    .from("mobile_admin_login_events")
    .select(
      "id, restaurant_id, restaurant_name, staff_name, staff_role, is_device_admin, staff_id, created_at",
    )
    .in("restaurant_id", ids)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    const msg = String(error.message ?? "");
    if (isMissingSupabaseTableError(msg, "mobile_admin_login_events")) {
      console.warn(
        "[Phone] mobile_admin_login_events missing — run supabase/ensure_mobile_admin_login_events.sql.",
      );
    } else {
      console.warn("[Phone] fetchMobileAdminLoginEventsForSession:", error.message);
    }
    return { events: [], ownedRestaurantCount: list.length };
  }
  return {
    events: (data ?? []) as MobileAdminLoginEventRow[],
    ownedRestaurantCount: list.length,
  };
}
