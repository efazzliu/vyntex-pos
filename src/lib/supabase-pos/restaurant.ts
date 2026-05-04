import { licenseKeyLookupVariants } from "@/lib/license-key-variants.ts";
import { supabase } from "@/lib/supabase.ts";

export type RestaurantRow = {
  id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
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
  max_terminals?: number;
  registered_devices?: unknown;
};

const cache = new Map<string, RestaurantRow>();

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

    if (error) continue;
    if (!data) continue;

    if (data.license_status !== "active") {
      throw new Error("License is not active.");
    }

    const row = data as RestaurantRow;
    const canonical = String(row.license_key).trim().toUpperCase();
    cache.set(canonical, row);
    for (const v of variants) {
      cache.set(v.trim().toUpperCase(), row);
    }
    return row;
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
