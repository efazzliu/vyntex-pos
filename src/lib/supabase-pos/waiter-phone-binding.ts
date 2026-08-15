import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type WaiterPhoneBindingStatus = {
  bound: boolean;
  disconnected: boolean;
  restaurantName: string | null;
};

/**
 * True when this phone device is still registered for the venue and not
 * disconnected by an admin. If admin removed it, local pairing may be cleared.
 */
export async function fetchWaiterPhoneBindingStatus(
  licenseKey: string,
  deviceId: string,
): Promise<WaiterPhoneBindingStatus | null> {
  if (!isSupabaseConfigured || !licenseKey.trim() || !deviceId.trim()) {
    return null;
  }
  const { data, error } = await supabase.rpc("vyntex_waiter_phone_binding_status", {
    p_license_key: licenseKey,
    p_device_id: deviceId,
  });
  if (error) {
    console.warn("[waiter-binding]", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  return {
    bound: Boolean(r.bound),
    disconnected: Boolean(r.disconnected),
    restaurantName: r.restaurant_name != null ? String(r.restaurant_name) : null,
  };
}
