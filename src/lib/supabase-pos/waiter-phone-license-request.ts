import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import { detectPosDeviceOs } from "@/lib/supabase-pos/device-presence.ts";

export type WaiterLicenseRequestResult = {
  status: "pending" | "already_bound";
  licenseKey: string;
  restaurantName: string;
  deviceRowId: string | null;
  expiresAt: string | null;
};

export type WaiterLicenseRequestStatus = {
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled" | "none";
  restaurantName: string | null;
  licenseKey: string | null;
  deviceRowId: string | null;
  expiresAt: string | null;
};

export type WaiterLicensePendingRow = {
  id: string;
  phoneDeviceId: string;
  displayName: string;
  os: string | null;
  createdAt: string;
  expiresAt: string;
};

function rpcErrorCode(err: { message?: string; details?: string } | null): string {
  const raw = `${err?.message ?? ""} ${err?.details ?? ""}`.toLowerCase();
  if (raw.includes("pos_not_authorized")) return "pos_not_authorized";
  if (raw.includes("invalid_license")) return "invalid_license";
  if (raw.includes("license_inactive")) return "license_inactive";
  if (raw.includes("license_expired")) return "license_expired";
  if (raw.includes("phone_limit")) return "phone_limit";
  if (raw.includes("request_not_found")) return "request_not_found";
  if (raw.includes("request_not_pending")) return "request_not_pending";
  if (raw.includes("request_expired")) return "request_expired";
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

export function formatWaiterLicenseInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  const parts = clean.match(/.{1,4}/g);
  return parts ? parts.join("-") : "";
}

export function normalizeWaiterLicenseKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function requestWaiterPhoneByLicense(args: {
  licenseKey: string;
  phoneDeviceId: string;
  displayName?: string;
}): Promise<WaiterLicenseRequestResult> {
  if (!isSupabaseConfigured) throw new Error("no_supabase");
  const key = normalizeWaiterLicenseKey(args.licenseKey);
  if (key.length < 12) throw new Error("invalid_license");

  const { data, error } = await supabase.rpc("vyntex_request_waiter_phone_by_license", {
    p_license_key: key,
    p_phone_device_id: args.phoneDeviceId,
    p_display_name: args.displayName ?? null,
    p_os: detectPosDeviceOs(),
    p_app_version: APP_VERSION_LABEL,
  });
  if (error) {
    const code = rpcErrorCode(error);
    throw new Error(code === "unknown" ? error.message : code);
  }
  const r = firstRow(data);
  if (!r) throw new Error("empty_response");
  const status = String(r.status ?? "");
  if (status !== "pending" && status !== "already_bound") {
    throw new Error("empty_response");
  }
  return {
    status,
    licenseKey: String(r.license_key ?? key).trim().toUpperCase(),
    restaurantName: String(r.restaurant_name ?? ""),
    deviceRowId: r.device_row_id != null ? String(r.device_row_id) : null,
    expiresAt: r.expires_at != null ? String(r.expires_at) : null,
  };
}

export async function fetchWaiterLicenseRequestStatus(
  licenseKey: string,
  phoneDeviceId: string,
): Promise<WaiterLicenseRequestStatus | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("vyntex_waiter_license_request_status", {
    p_license_key: normalizeWaiterLicenseKey(licenseKey),
    p_phone_device_id: phoneDeviceId,
  });
  if (error) {
    console.warn("[waiter-license-status]", error.message);
    return null;
  }
  const r = firstRow(data);
  if (!r) return null;
  const status = String(r.status ?? "none");
  return {
    status: status as WaiterLicenseRequestStatus["status"],
    restaurantName: r.restaurant_name != null ? String(r.restaurant_name) : null,
    licenseKey: r.license_key != null ? String(r.license_key).trim().toUpperCase() : null,
    deviceRowId: r.device_row_id != null ? String(r.device_row_id) : null,
    expiresAt: r.expires_at != null ? String(r.expires_at) : null,
  };
}

export async function cancelWaiterLicenseRequest(
  licenseKey: string,
  phoneDeviceId: string,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("no_supabase");
  const { error } = await supabase.rpc("vyntex_cancel_waiter_license_request", {
    p_license_key: normalizeWaiterLicenseKey(licenseKey),
    p_phone_device_id: phoneDeviceId,
  });
  if (error) {
    const code = rpcErrorCode(error);
    throw new Error(code === "unknown" ? error.message : code);
  }
}

export async function listWaiterLicenseRequests(
  licenseKey: string,
  posDeviceId: string,
): Promise<WaiterLicensePendingRow[]> {
  if (!isSupabaseConfigured) throw new Error("no_supabase");
  const { data, error } = await supabase.rpc("vyntex_list_waiter_license_requests", {
    p_license_key: licenseKey,
    p_pos_device_id: posDeviceId,
  });
  if (error) {
    const code = rpcErrorCode(error);
    throw new Error(code === "unknown" ? error.message : code);
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      phoneDeviceId: String(row.phone_device_id ?? ""),
      displayName: String(row.display_name ?? ""),
      os: row.os != null ? String(row.os) : null,
      createdAt: String(row.created_at ?? ""),
      expiresAt: String(row.expires_at ?? ""),
    }))
    .filter((row) => row.id);
}

export async function approveWaiterLicenseRequest(
  licenseKey: string,
  posDeviceId: string,
  requestId: string,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("no_supabase");
  const { error } = await supabase.rpc("vyntex_approve_waiter_license_request", {
    p_license_key: licenseKey,
    p_pos_device_id: posDeviceId,
    p_request_id: requestId,
  });
  if (error) {
    const code = rpcErrorCode(error);
    throw new Error(code === "unknown" ? error.message : code);
  }
}

export async function rejectWaiterLicenseRequest(
  licenseKey: string,
  posDeviceId: string,
  requestId: string,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("no_supabase");
  const { error } = await supabase.rpc("vyntex_reject_waiter_license_request", {
    p_license_key: licenseKey,
    p_pos_device_id: posDeviceId,
    p_request_id: requestId,
  });
  if (error) {
    const code = rpcErrorCode(error);
    throw new Error(code === "unknown" ? error.message : code);
  }
}
