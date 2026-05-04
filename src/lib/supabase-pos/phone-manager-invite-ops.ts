import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

/** Same unambiguous charset as SQL `create_phone_manager_invite` (no I, O, 0, 1). */
export function normalizePhoneInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 8);
}

export type CreateInviteResult = { code: string; expiresAt: string };

function unwrapRpcRow(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === "string") {
    try {
      const p = JSON.parse(data) as unknown;
      if (Array.isArray(p) && p[0] && typeof p[0] === "object") {
        return p[0] as Record<string, unknown>;
      }
      if (p && typeof p === "object") return p as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  }
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  if (typeof data === "object") return data as Record<string, unknown>;
  return null;
}

function parseCreateInvitePayload(data: unknown): Record<string, unknown> | null {
  const row = unwrapRpcRow(data);
  if (row) return row;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    return data[0] as Record<string, unknown>;
  }
  return null;
}

export async function createPhoneManagerInvite(
  restaurantId: string,
): Promise<CreateInviteResult> {
  if (!isSupabaseConfigured) {
    throw new Error("supabase_not_configured");
  }

  const { data, error } = await supabase.rpc("create_phone_manager_invite", {
    p_restaurant_id: restaurantId,
  });

  if (error) throw error;

  const row = parseCreateInvitePayload(data);
  if (!row) {
    console.warn("[createPhoneManagerInvite] unexpected response:", data);
    throw new Error("Invalid response from create_phone_manager_invite");
  }

  const okVal = row.ok;
  const ok =
    okVal === undefined ||
    okVal === true ||
    okVal === "true" ||
    (typeof okVal === "string" && okVal.toLowerCase() === "true");

  if (okVal === false || okVal === "false" || (!ok && row.error)) {
    const err = String(row.error ?? "unknown");
    if (err === "not_allowed") throw new Error("Not allowed for this venue");
    if (err === "not_authenticated") throw new Error("Not authenticated");
    throw new Error(err);
  }

  const code = row.code ?? row.Code;
  const rawExp = row.expires_at ?? row.expiresAt;
  if (typeof code !== "string" || !code.trim()) {
    throw new Error("Missing code from create_phone_manager_invite");
  }
  const expiresAt =
    typeof rawExp === "string"
      ? rawExp
      : rawExp instanceof Date
        ? rawExp.toISOString()
        : String(rawExp ?? "");
  if (!expiresAt) {
    throw new Error("Missing expiry from create_phone_manager_invite");
  }
  return { code: code.trim(), expiresAt };
}

export type RedeemInviteResult =
  | {
      ok: true;
      restaurantId: string;
      licenseKey: string;
      restaurantName: string;
    }
  | { ok: false; error: string; detail?: string };

export async function redeemPhoneManagerInvite(
  rawCode: string,
): Promise<RedeemInviteResult> {
  const code = normalizePhoneInviteCode(rawCode);
  if (code.length < 8) {
    return { ok: false, error: "invalid_code" };
  }

  const { data, error } = await supabase.rpc("redeem_phone_manager_invite", {
    p_code: code,
  });

  if (error) {
    console.warn("[redeemPhoneManagerInvite]", error.message);
    return { ok: false, error: "rpc_error", detail: error.message };
  }

  let j: Record<string, unknown> | null = unwrapRpcRow(data);
  if (j == null && typeof data === "string") {
    try {
      j = JSON.parse(data) as Record<string, unknown>;
    } catch {
      j = null;
    }
  }
  if (j == null && data && typeof data === "object" && !Array.isArray(data)) {
    j = data as Record<string, unknown>;
  }

  const okVal = j?.ok;
  const ok =
    okVal === true ||
    okVal === "true" ||
    (typeof okVal === "string" && okVal.toLowerCase() === "true");

  if (!j || !ok) {
    const err = typeof j?.error === "string" ? j.error : "unknown";
    return { ok: false, error: err };
  }

  const restaurantId = String(j.restaurant_id ?? j.restaurantId ?? "");
  const licenseKey = String(j.license_key ?? j.licenseKey ?? "");
  const restaurantName = String(j.restaurant_name ?? j.restaurantName ?? "");
  if (!restaurantId || !licenseKey) {
    return { ok: false, error: "invalid_response" };
  }

  return {
    ok: true,
    restaurantId,
    licenseKey,
    restaurantName,
  };
}

export type PhoneManagerRow = {
  managerUserId: string;
  managerEmail: string;
  linkedAt: string;
};

export async function listPhoneManagersForRestaurant(
  restaurantId: string,
): Promise<PhoneManagerRow[]> {
  const { data, error } = await supabase.rpc("list_phone_managers_for_restaurant", {
    p_restaurant_id: restaurantId,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
  return rows.map((raw: Record<string, unknown>) => ({
    managerUserId: String(raw.manager_user_id ?? raw.managerUserId ?? ""),
    managerEmail: String(raw.manager_email ?? raw.managerEmail ?? "—"),
    linkedAt:
      typeof raw.linked_at === "string"
        ? raw.linked_at
        : raw.linked_at instanceof Date
          ? raw.linked_at.toISOString()
          : String(raw.linked_at ?? raw.linkedAt ?? ""),
  }));
}

export async function revokePhoneManager(
  restaurantId: string,
  managerUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("revoke_phone_manager", {
    p_restaurant_id: restaurantId,
    p_manager_user_id: managerUserId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const j = unwrapRpcRow(data);
  const okVal = j?.ok;
  const ok =
    okVal === true ||
    okVal === "true" ||
    (typeof okVal === "string" && okVal.toLowerCase() === "true");
  if (!ok) {
    const err = typeof j?.error === "string" ? j.error : "unknown";
    return { ok: false, error: err };
  }
  return { ok: true };
}

/**
 * Returns false if this user was removed as phone manager (JWT still says manager).
 * Returns null if RPC missing (migration not applied) — caller should not force logout.
 */
export async function phoneManagerAccessStillValid(): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("phone_manager_access_still_valid");
  if (error) {
    console.warn("[phoneManagerAccessStillValid]", error.message);
    return null;
  }
  return data === true;
}
