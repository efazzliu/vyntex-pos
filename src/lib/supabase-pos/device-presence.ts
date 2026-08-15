import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type DashboardPosDevice = {
  id: string;
  restaurant_id: string;
  device_id: string;
  display_name: string;
  location_name: string | null;
  os: string | null;
  app_version: string | null;
  ip_address: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_sync_at: string | null;
  disconnected_at: string | null;
  device_kind?: "pos" | "waiter_phone" | string | null;
};

export function detectPosDeviceOs(): string {
  const desktopPlatform = window.desktop?.platform?.toLowerCase();
  if (desktopPlatform === "win32") return "Windows";
  if (desktopPlatform === "darwin") return "macOS";
  if (desktopPlatform === "linux") return "Linux";

  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/macintosh|mac os/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown";
}

/**
 * Returns false only when the server explicitly rejects this device.
 * Missing migration/network failures return null so offline POS access remains available.
 */
export async function sendPosDeviceHeartbeat(
  licenseKey: string,
  deviceId: string,
): Promise<boolean | null> {
  if (!isSupabaseConfigured || !navigator.onLine) return null;
  const { data, error } = await supabase.rpc("vyntex_pos_device_heartbeat", {
    p_license_key: licenseKey,
    p_device_id: deviceId,
    p_os: detectPosDeviceOs(),
    p_app_version: APP_VERSION_LABEL,
  });
  if (error) {
    console.warn("[device-presence] heartbeat unavailable", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" && "accepted" in row
    ? Boolean((row as { accepted: unknown }).accepted)
    : null;
}

export async function fetchDashboardPosDevices(
  restaurantIds: string[],
): Promise<DashboardPosDevice[]> {
  if (!isSupabaseConfigured || restaurantIds.length === 0) return [];
  const colsWithKind =
    "id, restaurant_id, device_id, display_name, location_name, os, app_version, ip_address, first_seen_at, last_seen_at, last_sync_at, disconnected_at, device_kind";
  const colsWithoutKind =
    "id, restaurant_id, device_id, display_name, location_name, os, app_version, ip_address, first_seen_at, last_seen_at, last_sync_at, disconnected_at";
  let { data, error } = await supabase
    .from("pos_devices")
    .select(colsWithKind)
    .in("restaurant_id", restaurantIds)
    .order("last_seen_at", { ascending: false });
  if (error && /device_kind|column/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("pos_devices")
      .select(colsWithoutKind)
      .in("restaurant_id", restaurantIds)
      .order("last_seen_at", { ascending: false }));
  }
  if (error) throw new Error(error.message);
  return (data ?? []) as DashboardPosDevice[];
}

export async function renameDashboardPosDevice(
  id: string,
  displayName: string,
  locationName: string,
): Promise<void> {
  const name = displayName.trim().slice(0, 60);
  const location = locationName.trim().slice(0, 80);
  if (!name) throw new Error("Device name is required.");
  const { data, error } = await supabase.rpc("vyntex_rename_pos_device", {
    p_device_row_id: id,
    p_display_name: name,
    p_location_name: location || null,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Device not found or you do not have access.");
}

export async function disconnectDashboardPosDevice(
  restaurantId: string,
  deviceId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("vyntex_disconnect_pos_device", {
    p_restaurant_id: restaurantId,
    p_device_id: deviceId,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("The device could not be disconnected.");
}
