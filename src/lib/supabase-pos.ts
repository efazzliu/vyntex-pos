import { supabase, isSupabaseConfigured } from "@/lib/supabase.ts";
import {
  errorMessageFromUnknown,
  isMissingPgColumnError,
} from "@/lib/supabase-pos/db-errors.ts";
import { licenseKeyLookupVariants } from "@/lib/license-key-variants.ts";
import { devPosPlanDisplayOverride } from "@/lib/dev-pos-plan-override.ts";
import {
  maxEffectiveTerminalsForLicense,
  normalizePlan,
  planTerminalFloor,
} from "@/pages/pos/_lib/plan-features.ts";

function canRebindLicenseInDev() {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_ALLOW_LICENSE_REBIND_DEV === "true"
  );
}

type ActivationResult = {
  licenseKey: string;
  plan: string;
  businessName: string;
  businessType: string;
  expiresAt: string;
  deviceId: string;
  activatedAt: string;
};

function ownerEmailsMatch(
  dbEmail: string | null | undefined,
  sessionEmail: string | null | undefined,
): boolean {
  if (!dbEmail?.trim() || !sessionEmail?.trim()) return false;
  return dbEmail.trim().toLowerCase() === sessionEmail.trim().toLowerCase();
}

function parseRegisteredDevices(
  registeredDevices: unknown,
  legacyDeviceId: string | null,
): string[] {
  if (Array.isArray(registeredDevices)) {
    const ids = registeredDevices.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (ids.length > 0) return ids;
  }
  if (legacyDeviceId) return [legacyDeviceId];
  return [];
}

const RESTAURANT_ACTIVATION_SELECT_BASE =
  "id, name, type, plan, license_key, license_expiry, license_status, device_id, max_terminals, registered_devices";
const RESTAURANT_ACTIVATION_SELECT = `${RESTAURANT_ACTIVATION_SELECT_BASE}, mobile_access_enabled`;

type RestaurantActivationRow = {
  id: string;
  name: string;
  type: string;
  plan: string | null;
  license_key: string;
  license_expiry: string | null;
  license_status: string | null;
  device_id: string | null;
  max_terminals: number | null;
  registered_devices: unknown;
  mobile_access_enabled?: boolean | null;
};

function isPhoneShellEntry(): boolean {
  if (typeof window === "undefined") return false;
  if (/phone\.html$/i.test(window.location.pathname)) return true;
  return import.meta.env.VITE_PHONE_STORE_BUILD === "true";
}

function isRlsLikeError(err: { message?: string; code?: string }): boolean {
  const msg = String(err.message ?? "").toLowerCase();
  const code = String(err.code ?? "");
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("violates row-level security") ||
    msg.includes("rls") ||
    code === "42501"
  );
}

function isMissingActivationRpcError(err: { message?: string }): boolean {
  const msg = String(err.message ?? "").toLowerCase();
  return (
    msg.includes("could not find the function") ||
    msg.includes("vyntex_restaurant_for_activation") ||
    (msg.includes("schema cache") && msg.includes("function"))
  );
}

/**
 * Gjen rreshtin `restaurants` për aktivizim: .eq me variante + RPC normalizuar (anashkalon RLS).
 */
async function fetchRestaurantRowForActivation(licenseKey: string): Promise<{
  row: RestaurantActivationRow | null;
  error: { message: string; code?: string } | null;
}> {
  let lastError: { message: string; code?: string } | null = null;

  for (const variant of licenseKeyLookupVariants(licenseKey)) {
    let selectCols = RESTAURANT_ACTIVATION_SELECT;
    let { data, error } = await supabase
      .from("restaurants")
      .select(selectCols)
      .eq("license_key", variant)
      .maybeSingle();

    if (
      error &&
      isMissingPgColumnError(error.message, "mobile_access_enabled")
    ) {
      selectCols = RESTAURANT_ACTIVATION_SELECT_BASE;
      ({ data, error } = await supabase
        .from("restaurants")
        .select(selectCols)
        .eq("license_key", variant)
        .maybeSingle());
    }

    if (error) {
      lastError = error;
      if (error.code === "PGRST116") {
        return {
          row: null,
          error: new Error(
            "U gjetën dy ose më shumë licenca me të njëjtin çelës në databazë. / Duplicate license_key rows.",
          ),
        };
      }
      if (!isRlsLikeError(error)) {
        continue;
      }
      break;
    }

    if (data) {
      return { row: data as unknown as RestaurantActivationRow, error: null };
    }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "vyntex_restaurant_for_activation",
    { p_license: licenseKey },
  );

  if (rpcError) {
    if (isMissingActivationRpcError(rpcError)) {
      if (lastError && isRlsLikeError(lastError)) {
        return { row: null, error: lastError };
      }
      return { row: null, error: null };
    }
    return { row: null, error: rpcError };
  }

  const list = Array.isArray(rpcData)
    ? rpcData
    : rpcData && typeof rpcData === "object"
      ? [rpcData as RestaurantActivationRow]
      : [];

  if (list.length === 1) {
    return { row: list[0] as RestaurantActivationRow, error: null };
  }

  if (list.length > 1) {
    return {
      row: null,
      error: new Error(
        "U gjetën dy ose më shumë licenca me të njëjtin çelës në databazë. / Duplicate license_key rows.",
      ),
    };
  }

  if (lastError && !isRlsLikeError(lastError)) {
    return { row: null, error: lastError };
  }

  return { row: null, error: null };
}

export async function verifyLicense(licenseKey: string, deviceId: string) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase not configured");
  }
  const { row: data, error } = await fetchRestaurantRowForActivation(licenseKey);
  if (error) {
    throw error instanceof Error
      ? error
      : new Error(errorMessageFromUnknown(error, "License verification failed"));
  }
  if (!data) {
    return { valid: false as const };
  }

  const isActive = data.license_status === "active";
  const notExpired =
    !data.license_expiry ||
    new Date(data.license_expiry).getTime() > Date.now();
  const devices = parseRegisteredDevices(data.registered_devices, data.device_id as string | null);
  /** Only devices listed on the license may stay signed in (after admin "reset terminals", list is empty → must re-enter key). */
  const sameDevice = devices.includes(deviceId);

  const rawPlan = data.plan ?? "professional";
  return {
    valid: isActive && notExpired && sameDevice,
    plan: devPosPlanDisplayOverride(normalizePlan(String(rawPlan))),
  };
}

export async function activateLicense(
  licenseKey: string,
  deviceId: string
): Promise<ActivationResult> {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Ky instalim nuk është lidhur me serverin (mungon konfigurimi). " +
        "Ndërtoni .exe me VITE_SUPABASE_URL dhe VITE_SUPABASE_ANON_KEY, ose shkarkoni versionin nga dashboard-i juaj. " +
        "This build is missing server configuration; rebuild with Supabase env or download the installer from your dashboard.",
    );
  }
  const { row, error: fetchError } =
    await fetchRestaurantRowForActivation(licenseKey);
  const normalizedKey = String(row?.license_key ?? licenseKey)
    .trim()
    .toUpperCase();

  if (fetchError) {
    const dup =
      fetchError instanceof Error &&
      /duplicate|dy ose më shumë licenca/i.test(fetchError.message);
    if (dup) {
      throw fetchError;
    }
    const msg = String(fetchError.message ?? "").toLowerCase();
    if (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("load failed") ||
      msg.includes("network request failed")
    ) {
      throw new Error(
        "Nuk ka lidhje me internetin ose serverin. Kontrolloni rrjetin dhe provoni përsëri. / No connection to the server — check your network and try again.",
      );
    }
    if (isRlsLikeError(fetchError)) {
      throw new Error(
        "Supabase bllokon leximin (RLS). Ekzekuto në SQL Editor: supabase/ensure_pos_restaurants_anon_for_activation.sql",
      );
    }
    throw new Error(errorMessageFromUnknown(fetchError, "Invalid license key."));
  }

  if (!row) {
    throw new Error(
      "Licenca nuk u gjet në këtë projekt Supabase. Verifiko: 1) çelësi në Table Editor → restaurants, 2) .env (URL/anon key) i njëjtë me projektin, 3) ekzekuto supabase/ensure_pos_restaurants_anon_for_activation.sql (RLS + RPC vyntex_restaurant_for_activation). / License not found or wrong project.",
    );
  }

  if (row.license_status !== "active") {
    throw new Error("This license is not active.");
  }

  if (isPhoneShellEntry() && row.mobile_access_enabled === false) {
    throw new Error(
      "Qasja nga telefoni është e çaktivizuar për këtë licencë. / Mobile access is disabled for this license.",
    );
  }

  const expiresAt = row.license_expiry;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw new Error("This license has expired.");
  }

  const planStr = String(row.plan ?? "professional");
  let storedMax = Math.max(1, Number(row.max_terminals) || 1);
  if (normalizePlan(planStr) === "enterprise") {
    const floor = planTerminalFloor("enterprise");
    if (storedMax < floor) {
      const { error: bumpError } = await supabase
        .from("restaurants")
        .update({ max_terminals: floor })
        .eq("id", row.id);
      if (!bumpError) storedMax = floor;
    }
  }
  const maxTerminals = maxEffectiveTerminalsForLicense(planStr, storedMax);

  const devices = parseRegisteredDevices(row.registered_devices, row.device_id as string | null);

  if (devices.includes(deviceId)) {
    // Already registered — nothing to update
  } else if (canRebindLicenseInDev()) {
    const { error: updateError } = await supabase
      .from("restaurants")
      .update({
        device_id: deviceId,
        registered_devices: [deviceId],
      })
      .eq("id", row.id);
    if (updateError) {
      throw new Error("Failed to bind this device to the license.");
    }
  } else if (devices.length >= maxTerminals) {
    throw new Error(
      "This license is already activated on the maximum number of devices. Ask support to add terminals or reset devices.",
    );
  } else {
    const nextDevices = [...devices, deviceId];
    const primary = (row.device_id as string | null) ?? deviceId;
    const { error: updateError } = await supabase
      .from("restaurants")
      .update({
        device_id: primary || deviceId,
        registered_devices: nextDevices,
      })
      .eq("id", row.id);
    if (updateError) {
      throw new Error("Failed to bind this device to the license.");
    }
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (authUser?.id && authUser.email) {
    const { data: ownRow } = await supabase
      .from("restaurants")
      .select("owner_user_id, owner_email")
      .eq("id", row.id)
      .maybeSingle();

    const emailLower = authUser.email.trim().toLowerCase();
    const canLinkOwner =
      ownRow &&
      ownRow.owner_user_id == null &&
      (ownRow.owner_email == null || ownerEmailsMatch(ownRow.owner_email, authUser.email));

    if (canLinkOwner) {
      let claimQuery = supabase
        .from("restaurants")
        .update({
          owner_user_id: authUser.id,
          owner_email: emailLower,
        })
        .eq("id", row.id)
        .is("owner_user_id", null);
      if (ownRow.owner_email == null) {
        claimQuery = claimQuery.is("owner_email", null);
      } else {
        claimQuery = claimQuery.eq("owner_email", ownRow.owner_email.trim().toLowerCase());
      }
      await claimQuery;
    }
  }

  return {
    licenseKey: normalizedKey,
    plan: devPosPlanDisplayOverride(normalizePlan(String(row.plan ?? "professional"))),
    businessName: row.name,
    businessType: row.type ?? "restaurant",
    expiresAt: expiresAt ?? new Date().toISOString(),
    deviceId,
    activatedAt: new Date().toISOString(),
  };
}

export async function getShiftStatus(staffId: string) {
  const { data, error } = await supabase
    .from("shifts")
    .select("id")
    .eq("staff_id", staffId)
    .is("clock_out", null)
    .limit(1);

  if (error) {
    return { hasOpenShift: false };
  }

  return { hasOpenShift: (data?.length ?? 0) > 0 };
}

export async function verifyAdminPin(licenseKey: string, pinHash: string) {
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, role, restaurants!inner(license_key)")
    .eq("restaurants.license_key", licenseKey)
    .eq("pin_hash", pinHash)
    .in("role", ["admin", "manager"])
    .eq("is_active", true)
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return {
    adminId: data[0].id as string,
    adminName: data[0].name as string,
  };
}

export async function runQueuedMutation(
  functionPath: string,
  args: Record<string, unknown>,
) {
  const { runPosMutation } = await import("@/lib/supabase-pos/pos-router.ts");
  const id = functionPath.includes(".")
    ? functionPath
    : `pos.${functionPath.replace(/\//g, ".").replace(/^pos\./, "")}`;
  await runPosMutation(id, args);
}
