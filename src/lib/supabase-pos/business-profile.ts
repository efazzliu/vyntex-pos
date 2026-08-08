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

export async function fetchDashboardBusinessProfile(
  restaurantId: string,
): Promise<DashboardBusinessProfile> {
  const { data, error } = await supabase
    .from("restaurants")
    .select(BUSINESS_PROFILE_SELECT)
    .eq("id", restaurantId)
    .single();
  if (error) {
    const missingColumn =
      /column|schema cache/i.test(error.message) &&
      /legal_name|business_email|vat_number|default_vat_rate|timezone/i.test(
        error.message,
      );
    if (missingColumn) {
      throw new Error(
        "Business profile fields are not installed. Run supabase/migrations/031_restaurants_business_profile.sql.",
      );
    }
    throw new Error(error.message);
  }
  const row = data as Record<string, unknown>;
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
  const { error } = await supabase
    .from("restaurants")
    .update({
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
    })
    .eq("id", profile.id);
  if (error) throw new Error(error.message);
}
