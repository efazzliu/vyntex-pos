import { supabase } from "@/lib/supabase.ts";

export type DashboardBusinessProfile = {
  id: string;
  name: string;
  legalName: string;
  type: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  taxNumber: string;
  vatNumber: string;
  defaultVatRate: number;
  currency: string;
  language: "en" | "sq";
  timezone: string;
};

const BUSINESS_PROFILE_SELECT =
  "id, name, legal_name, type, address, city, postal_code, country, phone, business_email, website, tax_number, vat_number, default_vat_rate, currency, language, timezone";

const BASIC_PROFILE_SELECT = "id, name, type, address, phone, currency, language";

function isMissingBusinessProfileColumn(message: string): boolean {
  return (
    /column|schema cache/i.test(message) &&
    /legal_name|business_email|vat_number|default_vat_rate|timezone|postal_code|website|tax_number|city|country|business_profile_updated_at/i.test(
      message,
    )
  );
}

function mapProfile(row: Record<string, unknown>): DashboardBusinessProfile {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    legalName: String(row.legal_name ?? ""),
    type: String(row.type ?? "restaurant"),
    address: String(row.address ?? ""),
    city: String(row.city ?? ""),
    postalCode: String(row.postal_code ?? ""),
    country: String(row.country ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.business_email ?? ""),
    website: String(row.website ?? ""),
    taxNumber: String(row.tax_number ?? ""),
    vatNumber: String(row.vat_number ?? ""),
    defaultVatRate: Number(row.default_vat_rate ?? 0.2),
    currency: String(row.currency ?? "EUR"),
    language: row.language === "sq" ? "sq" : "en",
    timezone: String(row.timezone ?? "Europe/Tirane"),
  };
}

export async function fetchDashboardBusinessProfile(
  restaurantId: string,
): Promise<DashboardBusinessProfile> {
  const { data, error } = await supabase
    .from("restaurants")
    .select(BUSINESS_PROFILE_SELECT)
    .eq("id", restaurantId)
    .single();
  if (!error && data) return mapProfile(data as Record<string, unknown>);

  if (error && isMissingBusinessProfileColumn(error.message)) {
    const fallback = await supabase
      .from("restaurants")
      .select(BASIC_PROFILE_SELECT)
      .eq("id", restaurantId)
      .single();
    if (fallback.error || !fallback.data) {
      throw new Error(fallback.error?.message ?? error.message);
    }
    return mapProfile(fallback.data as Record<string, unknown>);
  }

  throw new Error(error?.message ?? "Could not load business profile.");
}

export async function saveDashboardBusinessProfile(
  profile: DashboardBusinessProfile,
): Promise<void> {
  const name = profile.name.trim();
  if (!name) throw new Error("Restaurant name is required.");
  if (
    !Number.isFinite(profile.defaultVatRate) ||
    profile.defaultVatRate < 0 ||
    profile.defaultVatRate > 1
  ) {
    throw new Error("VAT rate must be between 0% and 100%.");
  }

  const optional = (value: string) => value.trim() || null;
  const fullPatch = {
    name,
    legal_name: optional(profile.legalName),
    address: optional(profile.address),
    city: optional(profile.city),
    postal_code: optional(profile.postalCode),
    country: optional(profile.country),
    phone: optional(profile.phone),
    business_email: optional(profile.email),
    website: optional(profile.website),
    tax_number: optional(profile.taxNumber),
    vat_number: optional(profile.vatNumber),
    default_vat_rate: profile.defaultVatRate,
    currency: profile.currency,
    language: profile.language,
    timezone: profile.timezone,
    business_profile_updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("restaurants")
    .update(fullPatch)
    .eq("id", profile.id);
  if (!error) return;
  if (!isMissingBusinessProfileColumn(error.message)) {
    throw new Error(error.message);
  }

  const { error: basicError } = await supabase
    .from("restaurants")
    .update({
      name,
      address: optional(profile.address),
      phone: optional(profile.phone),
      currency: profile.currency,
      language: profile.language,
    })
    .eq("id", profile.id);
  if (basicError) throw new Error(basicError.message);
}
