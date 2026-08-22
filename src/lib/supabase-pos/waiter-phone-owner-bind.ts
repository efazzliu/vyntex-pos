import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import { detectPosDeviceOs } from "@/lib/supabase-pos/device-presence.ts";
import {
  fetchAllRestaurantsOwnedBySession,
  fetchRestaurantOwnedBySession,
  isRestaurantLicenseUsable,
  type OwnedRestaurantRow,
} from "@/lib/supabase-pos/phone-pos-session.ts";
import { normalizeWaiterLicenseKey } from "@/lib/supabase-pos/waiter-phone-license-request.ts";
import { normalizePlan } from "@/pages/pos/_lib/plan-features.ts";

export type WaiterOwnerBindResult = {
  licenseKey: string;
  restaurantName: string;
  deviceRowId: string;
};

function rpcErrorCode(err: { message?: string; details?: string } | null): string {
  const raw = `${err?.message ?? ""} ${err?.details ?? ""}`.toLowerCase();
  if (raw.includes("not_authenticated")) return "not_authenticated";
  if (raw.includes("not_venue_owner")) return "not_venue_owner";
  if (raw.includes("invalid_license")) return "invalid_license";
  if (raw.includes("license_inactive")) return "license_inactive";
  if (raw.includes("license_expired")) return "license_expired";
  if (raw.includes("phone_limit")) return "phone_limit";
  if (raw.includes("missing_params")) return "missing_params";
  if (raw.includes("could not find the function") || raw.includes("schema cache")) {
    return "migration_missing";
  }
  return "unknown";
}

function firstRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  return row as Record<string, unknown>;
}

function venueSort(a: OwnedRestaurantRow, b: OwnedRestaurantRow): number {
  const aOk = isRestaurantLicenseUsable(a) ? 0 : 1;
  const bOk = isRestaurantLicenseUsable(b) ? 0 : 1;
  if (aOk !== bOk) return aOk - bOk;
  const aEnt = normalizePlan(String(a.plan ?? "")) === "enterprise" ? 0 : 1;
  const bEnt = normalizePlan(String(b.plan ?? "")) === "enterprise" ? 0 : 1;
  if (aEnt !== bEnt) return aEnt - bEnt;
  return a.name.localeCompare(b.name);
}

/** Venues this signed-in user can activate a waiter phone for (owner or manager). */
export async function fetchVenuesForWaiterAccount(): Promise<OwnedRestaurantRow[]> {
  const byId = new Map<string, OwnedRestaurantRow>();

  const ingest = (rows: OwnedRestaurantRow[]) => {
    for (const row of rows) {
      if (row?.id) byId.set(row.id, row);
    }
  };

  ingest(await fetchAllRestaurantsOwnedBySession());
  if (byId.size === 0) {
    const single = await fetchRestaurantOwnedBySession();
    if (single) ingest([single]);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: mgr, error: mgrErr } = await supabase
      .from("phone_app_managers")
      .select("restaurant_id")
      .eq("user_id", user.id);
    if (mgrErr) {
      console.warn("[fetchVenuesForWaiterAccount] managers:", mgrErr.message);
    }
    const missingIds = (mgr ?? [])
      .map((row) => String(row.restaurant_id ?? "").trim())
      .filter((id) => id.length > 0 && !byId.has(id));
    if (missingIds.length > 0) {
      const { data: rows, error } = await supabase
        .from("restaurants")
        .select(
          "id, name, type, plan, license_key, license_expiry, license_status, device_id, registered_devices, max_terminals, mobile_access_enabled, address, created_at",
        )
        .in("id", missingIds);
      if (error) {
        console.warn("[fetchVenuesForWaiterAccount] manager venues:", error.message);
      } else {
        ingest((rows ?? []) as OwnedRestaurantRow[]);
      }
    }
  }

  return Array.from(byId.values()).sort(venueSort);
}

async function bindWaiterPhoneAsOwnerFallback(args: {
  licenseKey: string;
  phoneDeviceId: string;
}): Promise<WaiterOwnerBindResult> {
  const want = normalizeWaiterLicenseKey(args.licenseKey);
  const venues = await fetchVenuesForWaiterAccount();
  const match = venues.find(
    (row) =>
      isRestaurantLicenseUsable(row) &&
      normalizeWaiterLicenseKey(row.license_key) === want,
  );
  if (!match) throw new Error("not_venue_owner");
  return {
    licenseKey: match.license_key.trim().toUpperCase(),
    restaurantName: match.name,
    deviceRowId: `owner-local-${args.phoneDeviceId}`,
  };
}

export async function bindWaiterPhoneAsOwner(args: {
  licenseKey: string;
  phoneDeviceId: string;
  displayName?: string;
}): Promise<WaiterOwnerBindResult> {
  if (!isSupabaseConfigured) throw new Error("no_supabase");

  const { data, error } = await supabase.rpc("vyntex_owner_bind_waiter_phone", {
    p_license_key: args.licenseKey,
    p_phone_device_id: args.phoneDeviceId,
    p_display_name: args.displayName ?? null,
    p_os: detectPosDeviceOs(),
    p_app_version: APP_VERSION_LABEL,
  });
  if (error) {
    const code = rpcErrorCode(error);
    if (code === "migration_missing") {
      return bindWaiterPhoneAsOwnerFallback(args);
    }
    throw new Error(code === "unknown" ? error.message : code);
  }
  const r = firstRow(data);
  if (!r || !r.ok) throw new Error("empty_response");
  const deviceRowId = r.device_row_id != null ? String(r.device_row_id) : "";
  if (!deviceRowId) throw new Error("empty_response");
  return {
    licenseKey: String(r.license_key ?? args.licenseKey).trim().toUpperCase(),
    restaurantName: String(r.restaurant_name ?? ""),
    deviceRowId,
  };
}
