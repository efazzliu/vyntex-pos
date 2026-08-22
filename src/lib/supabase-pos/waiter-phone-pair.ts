import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import { detectPosDeviceOs } from "@/lib/supabase-pos/device-presence.ts";

export type WaiterPairCodeResult = {
  code: string;
  licenseKey: string;
  restaurantName: string;
  expiresAt: string;
};

export type WaiterClaimResult = {
  ok: true;
  licenseKey: string;
  restaurantName: string;
  deviceRowId: string;
};

function rpcErrorCode(err: { message?: string; details?: string } | null): string {
  const raw = `${err?.message ?? ""} ${err?.details ?? ""}`.toLowerCase();
  if (raw.includes("pos_not_authorized")) return "pos_not_authorized";
  if (raw.includes("code_already_used")) return "code_already_used";
  if (raw.includes("code_expired")) return "code_expired";
  if (raw.includes("license_inactive")) return "license_inactive";
  if (raw.includes("license_expired")) return "license_expired";
  if (raw.includes("phone_limit")) return "phone_limit";
  if (raw.includes("invalid_license")) return "invalid_license";
  if (raw.includes("request_not_found")) return "request_not_found";
  if (raw.includes("request_not_pending")) return "request_not_pending";
  if (raw.includes("request_expired")) return "request_expired";
  if (raw.includes("missing_params")) return "missing_params";
  if (raw.includes("could not find the function") || raw.includes("schema cache")) {
    return "migration_missing";
  }
  return "unknown";
}

export async function createWaiterPairCode(
  licenseKey: string,
  posDeviceId: string,
): Promise<WaiterPairCodeResult> {
  if (!isSupabaseConfigured) throw new Error("no_supabase");
  const { data, error } = await supabase.rpc("vyntex_create_waiter_pair_code", {
    p_license_key: licenseKey,
    p_pos_device_id: posDeviceId,
  });
  if (error) {
    const code = rpcErrorCode(error);
    throw new Error(code === "unknown" ? error.message : code);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("empty_response");
  const r = row as Record<string, unknown>;
  const pairCode = String(r.code ?? "").trim().toUpperCase();
  if (!pairCode) throw new Error("empty_response");
  return {
    code: pairCode,
    licenseKey: String(r.license_key ?? licenseKey),
    restaurantName: String(r.restaurant_name ?? ""),
    expiresAt: String(r.expires_at ?? ""),
  };
}

export async function claimWaiterPhone(args: {
  code: string;
  phoneDeviceId: string;
  displayName?: string;
}): Promise<WaiterClaimResult> {
  if (!isSupabaseConfigured) throw new Error("no_supabase");
  const { data, error } = await supabase.rpc("vyntex_claim_waiter_phone", {
    p_code: args.code.trim().toUpperCase(),
    p_phone_device_id: args.phoneDeviceId,
    p_display_name: args.displayName ?? null,
    p_os: detectPosDeviceOs(),
    p_app_version: APP_VERSION_LABEL,
  });
  if (error) {
    const code = rpcErrorCode(error);
    throw new Error(code === "unknown" ? error.message : code);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("empty_response");
  const r = row as Record<string, unknown>;
  if (!r.ok) throw new Error("invalid_code");
  return {
    ok: true,
    licenseKey: String(r.license_key ?? "").trim().toUpperCase(),
    restaurantName: String(r.restaurant_name ?? ""),
    deviceRowId: String(r.device_row_id ?? ""),
  };
}

/** Normalize scanned QR / typed input into an 8-char pair code. */
export function extractWaiterPairCode(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  try {
    if (text.includes("waiter/pair") || text.includes("c=")) {
      const hashIdx = text.indexOf("#");
      const qIdx = text.indexOf("?");
      const query = hashIdx >= 0
        ? text.slice(hashIdx + 1).replace(/^[^?]+\?/, "")
        : qIdx >= 0
          ? text.slice(qIdx + 1)
          : "";
      const params = new URLSearchParams(query.includes("=") ? query : `c=${query}`);
      const fromC = params.get("c") ?? params.get("code");
      if (fromC) {
        const cleaned = fromC.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (cleaned.length >= 6) return cleaned.slice(0, 8);
      }
    }
  } catch {
    /* fall through */
  }

  const m = text.match(/(?:vyntex[_-]?waiter[_-]?pair[:/\s]*)([A-Za-z0-9]{6,12})/i);
  if (m?.[1]) return m[1].replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);

  const plain = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (plain.length >= 6 && plain.length <= 12) return plain.slice(0, 8);
  return null;
}

export function buildWaiterPairQrPayload(code: string): string {
  const c = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
  return `https://www.vyntexpos.net/phone.html#/waiter/pair?c=${encodeURIComponent(c)}`;
}
