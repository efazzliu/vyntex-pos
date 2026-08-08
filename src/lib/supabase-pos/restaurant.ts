import { licenseKeyLookupVariants } from "@/lib/license-key-variants.ts";
import { supabase } from "@/lib/supabase.ts";

export type RestaurantRow = {
  id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  legal_name?: string | null;
  city?: string | null;
  tax_number?: string | null;
  vat_number?: string | null;
  default_vat_rate?: number | null;
  currency: string;
  language: string | null;
  currency_symbol: string | null;
  currency_position: string | null;
  currency_decimals: number | null;
  plan: string;
  license_key: string;
  license_expiry: string;
  license_status: string;
  device_id: string | null;
  /** SHA-256 hex; synced from device for close-day when staff PIN differs */
  pos_device_close_pin_hash?: string | null;
  pos_pin_branding?: unknown;
  pos_theme?: string | null;
  max_terminals?: number;
  registered_devices?: unknown;
};

const cache = new Map<string, RestaurantRow>();

function cacheRestaurantRow(row: RestaurantRow, lookupVariants: string[]): RestaurantRow {
  const canonical = String(row.license_key).trim().toUpperCase();
  cache.set(canonical, row);
  for (const v of lookupVariants) {
    cache.set(v.trim().toUpperCase(), row);
  }
  return row;
}

export async function getRestaurantByLicense(
  licenseKey: string,
): Promise<RestaurantRow> {
  const variants = licenseKeyLookupVariants(licenseKey);
  for (const v of variants) {
    const hit = cache.get(v.trim().toUpperCase());
    if (hit) return hit;
  }

  for (const variant of variants) {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("license_key", variant)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") {
        throw new Error(
          "U gjetën dy ose më shumë licenca me të njëjtin çelës në databazë. / Duplicate license_key rows.",
        );
      }
      continue;
    }
    if (!data) continue;

    if (data.license_status !== "active") {
      throw new Error("License is not active.");
    }

    return cacheRestaurantRow(data as RestaurantRow, variants);
  }

  // Same normalized lookup as POS activation (handles dashed vs compact keys).
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "vyntex_restaurant_for_activation",
    { p_license: licenseKey },
  );

  if (rpcError) {
    throw new Error("Invalid license key.");
  }

  const list = Array.isArray(rpcData)
    ? rpcData
    : rpcData && typeof rpcData === "object"
      ? [rpcData as RestaurantRow]
      : [];

  if (list.length > 1) {
    throw new Error(
      "U gjetën dy ose më shumë licenca me të njëjtin çelës në databazë. / Duplicate license_key rows.",
    );
  }

  if (list.length === 1) {
    const row = list[0] as RestaurantRow;
    if (row.license_status !== "active") {
      throw new Error("License is not active.");
    }
    return cacheRestaurantRow(row, variants);
  }

  throw new Error("Invalid license key.");
}

export function clearRestaurantCache(licenseKey?: string) {
  if (!licenseKey) {
    cache.clear();
    return;
  }
  for (const v of licenseKeyLookupVariants(licenseKey)) {
    cache.delete(v.trim().toUpperCase());
  }
}
