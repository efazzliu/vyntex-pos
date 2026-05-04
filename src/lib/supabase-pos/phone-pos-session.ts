import { supabase } from "@/lib/supabase.ts";
import {
  maxEffectiveTerminalsForLicense,
  normalizePlan,
  planTerminalFloor,
} from "@/pages/pos/_lib/plan-features.ts";
import type { StaffRole } from "@/pages/pos/_lib/types.ts";

export type OwnedRestaurantRow = {
  id: string;
  name: string;
  type: string;
  plan: string | null;
  license_key: string;
  license_expiry: string | null;
  license_status: string | null;
  device_id: string | null;
  registered_devices: unknown;
  max_terminals: number | null;
  mobile_access_enabled?: boolean | null;
  /** Street / city when set on the restaurant row */
  address?: string | null;
};

const DASHBOARD_RESTAURANT_ID_KEY = "vyntex.dashboard.restaurantId";

const RESTAURANT_SELECT =
  "id, name, type, plan, license_key, license_expiry, license_status, device_id, registered_devices, max_terminals, mobile_access_enabled, owner_user_id, owner_email";

function normalizeEmail(e: string | null | undefined): string {
  return (e ?? "").trim().toLowerCase();
}

function emailsMatch(
  dbEmail: string | null | undefined,
  sessionEmail: string | null | undefined,
): boolean {
  const a = normalizeEmail(dbEmail);
  const b = normalizeEmail(sessionEmail);
  return a.length > 0 && a === b;
}

/** Krahasim licensash me ose pa viza. */
function normalizeLicenseKeyForCompare(k: string): string {
  return k.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function rowToOwned(
  row: Record<string, unknown>,
): OwnedRestaurantRow {
  const {
    owner_user_id: _u,
    owner_email: _e,
    created_at: _c,
    ...rest
  } = row;
  return rest as OwnedRestaurantRow;
}

const RESTAURANT_LIST_SELECT = `${RESTAURANT_SELECT}, address, created_at`;

/**
 * Të gjitha lokacionet ku përdoruesi është pronar (`owner_user_id` ose `owner_email`).
 * Përdoret në app-in mobil për listën “Lokalet e mia”.
 */
export async function fetchAllRestaurantsOwnedBySession(): Promise<OwnedRestaurantRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const byId = new Map<string, OwnedRestaurantRow & { _sort?: string }>();

  const ingest = (rows: Record<string, unknown>[] | null) => {
    for (const raw of rows ?? []) {
      const id = String(raw.id ?? "");
      if (!id) continue;
      const owned = rowToOwned(raw);
      const sortKey = String(raw.created_at ?? "");
      byId.set(id, { ...owned, _sort: sortKey });
    }
  };

  const { data: byUid, error: errUid } = await supabase
    .from("restaurants")
    .select(RESTAURANT_LIST_SELECT)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });
  if (errUid) {
    console.warn("[fetchAllRestaurantsOwnedBySession] owner_user_id:", errUid.message);
  }
  ingest(byUid as Record<string, unknown>[] | null);

  const em = normalizeEmail(user.email);
  if (em) {
    const { data: byEmail, error: errEmail } = await supabase
      .from("restaurants")
      .select(RESTAURANT_LIST_SELECT)
      .eq("owner_email", em)
      .order("created_at", { ascending: true });
    if (errEmail) {
      console.warn("[fetchAllRestaurantsOwnedBySession] owner_email:", errEmail.message);
    }
    ingest(byEmail as Record<string, unknown>[] | null);
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => (a._sort ?? "").localeCompare(b._sort ?? ""));
  return merged.map(({ _sort: _, ...row }) => row);
}

async function backfillOwnerUserId(restaurantId: string, userId: string) {
  await supabase
    .from("restaurants")
    .update({ owner_user_id: userId })
    .eq("id", restaurantId)
    .is("owner_user_id", null);
}

/**
 * Gjen restorantin e pronarit: `owner_user_id`, ose `owner_email` i njëjtë me llogarinë,
 * ose ID nga dashboard (`localStorage`) nëse përputhet pronësia.
 */
export async function fetchRestaurantOwnedBySession(): Promise<OwnedRestaurantRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rpcData, error: rpcError } = await supabase.rpc("vyntex_my_restaurant");
  if (rpcError) {
    console.warn("[fetchRestaurantOwnedBySession] vyntex_my_restaurant:", rpcError.message);
  }
  const rpcRow = Array.isArray(rpcData)
    ? rpcData[0]
    : rpcData && typeof rpcData === "object"
      ? (rpcData as Record<string, unknown>)
      : null;
  const rpcId = rpcRow != null ? (rpcRow as { id?: unknown }).id : undefined;
  const rpcIdStr =
    rpcId !== undefined && rpcId !== null ? String(rpcId).trim() : "";
  if (!rpcError && rpcRow && rpcIdStr.length > 0) {
    return rowToOwned({ ...(rpcRow as Record<string, unknown>), id: rpcIdStr });
  }

  const meta = user.user_metadata as {
    vyntex_restaurant_id?: string;
    vyntex_license_key?: string;
    vyntex_phone_manager?: boolean;
  };

  if (meta?.vyntex_restaurant_id) {
    const { data: metaRow, error: metaErr } = await supabase
      .from("restaurants")
      .select(RESTAURANT_SELECT)
      .eq("id", meta.vyntex_restaurant_id)
      .maybeSingle();

    if (!metaErr && metaRow) {
      const r = metaRow as Record<string, unknown>;
      const rowLicense = String(r.license_key ?? "");
      const metaLicense = meta.vyntex_license_key
        ? String(meta.vyntex_license_key)
        : "";
      const licenseOk =
        !metaLicense ||
        normalizeLicenseKeyForCompare(rowLicense) ===
          normalizeLicenseKeyForCompare(metaLicense);

      if (licenseOk) {
        /** Linked via phone invite — read-only venue access, do not claim ownership. */
        if (meta.vyntex_phone_manager === true) {
          return rowToOwned(r);
        }
        if (r.owner_user_id === user.id) {
          return rowToOwned(r);
        }
        if (user.email && emailsMatch(r.owner_email as string, user.email)) {
          const ownerNorm =
            normalizeEmail(user.email) ?? user.email.trim().toLowerCase();
          await supabase
            .from("restaurants")
            .update({
              owner_user_id: user.id,
              owner_email: ownerNorm,
            })
            .eq("id", r.id as string);
          return rowToOwned({
            ...r,
            owner_user_id: user.id,
            owner_email: ownerNorm,
          });
        }
        if (
          r.owner_user_id == null &&
          user.email &&
          metaLicense &&
          normalizeLicenseKeyForCompare(rowLicense) ===
            normalizeLicenseKeyForCompare(metaLicense)
        ) {
          const ownerNorm =
            normalizeEmail(user.email) ?? user.email.trim().toLowerCase();
          await supabase
            .from("restaurants")
            .update({
              owner_user_id: user.id,
              owner_email: ownerNorm,
            })
            .eq("id", r.id as string);
          return rowToOwned({
            ...r,
            owner_user_id: user.id,
            owner_email: ownerNorm,
          });
        }
      }
    }
  }

  const metaLic = meta?.vyntex_license_key?.trim();
  if (metaLic) {
    const keyUpper = metaLic.toUpperCase();
    const { data: licRow, error: licErr } = await supabase
      .from("restaurants")
      .select(RESTAURANT_SELECT)
      .eq("license_key", keyUpper)
      .maybeSingle();

    if (!licErr && licRow) {
      const r = licRow as Record<string, unknown>;
      const canUseLicenseMeta =
        r.owner_user_id === user.id ||
        emailsMatch(r.owner_email as string, user.email) ||
        (r.owner_user_id == null &&
          (r.owner_email == null || String(r.owner_email).trim() === ""));
      if (canUseLicenseMeta) {
        const ownerNorm =
          normalizeEmail(user.email) ?? user.email?.trim().toLowerCase() ?? "";
        if (r.owner_user_id !== user.id && ownerNorm) {
          await supabase
            .from("restaurants")
            .update({
              owner_user_id: user.id,
              owner_email: ownerNorm,
            })
            .eq("id", r.id as string);
        }
        return rowToOwned({
          ...r,
          owner_user_id: user.id,
          owner_email: ownerNorm || (r.owner_email as string) || null,
        });
      }
    }
  }

  const { data: byId, error: e1 } = await supabase
    .from("restaurants")
    .select(RESTAURANT_SELECT)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!e1 && byId) {
    return rowToOwned(byId as Record<string, unknown>);
  }

  const sessionEmail = user.email?.trim();
  const sessionEmailNorm = sessionEmail ? normalizeEmail(sessionEmail) : "";
  if (sessionEmailNorm) {
    const { data: byEmail, error: e2 } = await supabase
      .from("restaurants")
      .select(RESTAURANT_SELECT)
      .eq("owner_email", sessionEmailNorm)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!e2 && byEmail) {
      const row = byEmail as Record<string, unknown>;
      const oe = row.owner_email as string | null | undefined;
      if (emailsMatch(oe, sessionEmail)) {
        if (row.owner_user_id !== user.id) {
          await supabase
            .from("restaurants")
            .update({
              owner_user_id: user.id,
              owner_email: sessionEmailNorm,
            })
            .eq("id", row.id as string);
        }
        return rowToOwned({
          ...row,
          owner_user_id: user.id,
          owner_email: sessionEmailNorm,
        });
      }
    }
  }

  if (typeof localStorage !== "undefined") {
    const rid = localStorage.getItem(DASHBOARD_RESTAURANT_ID_KEY);
    if (rid) {
      const { data: byRid, error: e3 } = await supabase
        .from("restaurants")
        .select(RESTAURANT_SELECT)
        .eq("id", rid)
        .maybeSingle();

      if (!e3 && byRid) {
        const row = byRid as Record<string, unknown>;
        if (row.owner_user_id === user.id) {
          return rowToOwned(row);
        }
        if (
          row.owner_user_id == null &&
          sessionEmail &&
          emailsMatch(row.owner_email as string | null, sessionEmail)
        ) {
          await backfillOwnerUserId(row.id as string, user.id);
          return rowToOwned(row);
        }
      }
    }
  }

  return null;
}

function parseRegisteredDevices(
  registeredDevices: unknown,
  legacyDeviceId: string | null,
): string[] {
  if (Array.isArray(registeredDevices)) {
    const ids = registeredDevices.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    if (ids.length > 0) return ids;
  }
  if (legacyDeviceId) return [legacyDeviceId];
  return [];
}

function canRebindLicenseInDev() {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_ALLOW_LICENSE_REBIND_DEV === "true"
  );
}

/**
 * Siguron që `deviceId` është në `registered_devices` për restorantin e pronarit.
 */
export async function ensureDeviceOnOwnedRestaurant(
  restaurant: OwnedRestaurantRow,
  deviceId: string,
): Promise<{ ok: true } | { ok: false; reason: "not_owner" | "max_devices" }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_owner" };

  const { data: row, error } = await supabase
    .from("restaurants")
    .select(
      "id, owner_user_id, owner_email, registered_devices, device_id, max_terminals, plan",
    )
    .eq("id", restaurant.id)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, reason: "not_owner" };
  }

  const owns =
    row.owner_user_id === user.id ||
    (user.email != null &&
      emailsMatch(row.owner_email as string | null, user.email));

  if (!owns) {
    return { ok: false, reason: "not_owner" };
  }

  if (row.owner_user_id == null) {
    await supabase
      .from("restaurants")
      .update({ owner_user_id: user.id })
      .eq("id", restaurant.id);
  }

  const planStr = String(row.plan ?? "professional");
  let storedMax = Math.max(1, Number(row.max_terminals) || 1);
  if (normalizePlan(planStr) === "enterprise") {
    const floor = planTerminalFloor("enterprise");
    if (storedMax < floor) {
      const { error: bumpErr } = await supabase
        .from("restaurants")
        .update({ max_terminals: floor })
        .eq("id", restaurant.id);
      if (!bumpErr) storedMax = floor;
    }
  }
  const maxTerminals = maxEffectiveTerminalsForLicense(planStr, storedMax);

  const devices = parseRegisteredDevices(
    row.registered_devices,
    row.device_id as string | null,
  );

  if (devices.includes(deviceId)) {
    return { ok: true };
  }

  if (canRebindLicenseInDev()) {
    const { error: upErr } = await supabase
      .from("restaurants")
      .update({
        device_id: deviceId,
        registered_devices: [deviceId],
      })
      .eq("id", restaurant.id);
    return upErr ? { ok: false, reason: "max_devices" } : { ok: true };
  }

  if (devices.length >= maxTerminals) {
    return { ok: false, reason: "max_devices" };
  }

  const nextDevices = [...devices, deviceId];
  const primary = (row.device_id as string | null) ?? deviceId;
  const { error: upErr } = await supabase
    .from("restaurants")
    .update({
      device_id: primary || deviceId,
      registered_devices: nextDevices,
    })
    .eq("id", restaurant.id);

  return upErr ? { ok: false, reason: "max_devices" } : { ok: true };
}

export type DefaultStaffPick = {
  id: string;
  name: string;
  role: StaffRole;
};

/** Për hyrje me llogari (pa PIN): përdor administratorin / menaxherin e parë aktiv. */
export async function fetchDefaultPosStaffForRestaurant(
  restaurantId: string,
): Promise<DefaultStaffPick | null> {
  const { data: preferred, error: e1 } = await supabase
    .from("staff")
    .select("id, name, role")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .in("role", ["admin", "manager"])
    .order("created_at", { ascending: true })
    .limit(1);

  if (!e1 && preferred?.[0]) {
    return {
      id: preferred[0].id as string,
      name: preferred[0].name as string,
      role: preferred[0].role as StaffRole,
    };
  }

  const { data: anyStaff, error: e2 } = await supabase
    .from("staff")
    .select("id, name, role")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);

  if (e2 || !anyStaff?.[0]) return null;
  return {
    id: anyStaff[0].id as string,
    name: anyStaff[0].name as string,
    role: anyStaff[0].role as StaffRole,
  };
}

export function isRestaurantLicenseUsable(r: OwnedRestaurantRow): boolean {
  if (r.mobile_access_enabled === false) return false;
  if (r.license_status && r.license_status !== "active") return false;
  if (r.license_expiry && new Date(r.license_expiry).getTime() <= Date.now()) {
    return false;
  }
  return true;
}

export function buildActivationFromOwnedRestaurant(
  r: OwnedRestaurantRow,
  deviceId: string,
  token: string,
) {
  const licenseKey = r.license_key.trim().toUpperCase();
  return {
    licenseKey,
    plan: String(normalizePlan(String(r.plan ?? "professional"))),
    businessName: r.name,
    businessType: r.type,
    expiresAt: r.license_expiry ?? new Date(Date.now() + 864e9 * 365).toISOString(),
    deviceId,
    activatedAt: new Date().toISOString(),
    token,
  };
}
