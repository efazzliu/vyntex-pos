import { supabase } from "@/lib/supabase.ts";
import {
  POS_LICENSE_LOCALE_INSERT,
  resolvePosCurrencyCode,
  resolvePosCurrencyDecimals,
  resolvePosCurrencyPosition,
  resolvePosCurrencySymbol,
  resolvePosLanguage,
} from "@/lib/pos-locale-defaults.ts";
import {
  parsePosPaymentSettings,
} from "@/lib/pos-payment-handling.ts";
import {
  normalizePinLoginBranding,
  type PinLoginBranding,
} from "@/lib/local-db.ts";
import { assertNoPgError } from "./db-errors.ts";
import { getRestaurantByLicense, clearRestaurantCache } from "./restaurant.ts";

function isMissingPosPinBrandingColumn(err: { message?: string }): boolean {
  const msg = String(err.message ?? "").toLowerCase();
  return (
    msg.includes("pos_pin_branding") ||
    msg.includes("pos_theme") ||
    (msg.includes("schema cache") && msg.includes("column"))
  );
}

function brandingFromRow(raw: unknown): PinLoginBranding | null {
  if (!raw || typeof raw !== "object") return null;
  return normalizePinLoginBranding(raw as Partial<PinLoginBranding>);
}

export async function fetchPinBrandingFromCloud(
  licenseKey: string,
): Promise<PinLoginBranding | null> {
  const r = await getRestaurantByLicense(licenseKey);
  if (r.pos_pin_branding == null) return null;
  return brandingFromRow(r.pos_pin_branding);
}

export async function savePinBrandingToCloud(
  licenseKey: string,
  branding: PinLoginBranding,
): Promise<void> {
  const r = await getRestaurantByLicense(licenseKey);
  const payload = normalizePinLoginBranding(branding);
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_pin_branding: payload })
    .eq("id", r.id);
  if (error) {
    if (isMissingPosPinBrandingColumn(error)) {
      throw new Error(
        "Mungon kolona pos_pin_branding. Ekzekuto supabase/migrations/028_restaurants_pos_license_sync.sql në Supabase SQL Editor.",
      );
    }
    throw error;
  }
  clearRestaurantCache(licenseKey);
}

export async function fetchPosThemeFromCloud(
  licenseKey: string,
): Promise<string | null> {
  const r = await getRestaurantByLicense(licenseKey);
  const t = r.pos_theme;
  return t === "light" || t === "dark" ? t : null;
}

export async function savePosThemeToCloud(
  licenseKey: string,
  theme: "light" | "dark",
): Promise<void> {
  const r = await getRestaurantByLicense(licenseKey);
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_theme: theme })
    .eq("id", r.id);
  if (error) {
    if (isMissingPosPinBrandingColumn(error)) {
      throw new Error(
        "Mungon kolona pos_theme. Ekzekuto supabase/migrations/028_restaurants_pos_license_sync.sql në Supabase SQL Editor.",
      );
    }
    throw error;
  }
  clearRestaurantCache(licenseKey);
}

async function ensureFactoryLocaleIfUnset(
  r: Awaited<ReturnType<typeof getRestaurantByLicense>>,
  licenseKey: string,
) {
  const langMissing = !String(r.language ?? "").trim();
  const symbolMissing = !String(r.currency_symbol ?? "").trim();
  if (!langMissing && !symbolMissing) return r;

  const patch: Record<string, unknown> = {};
  if (langMissing) patch.language = POS_LICENSE_LOCALE_INSERT.language;
  if (symbolMissing) {
    patch.currency = POS_LICENSE_LOCALE_INSERT.currency;
    patch.currency_symbol = POS_LICENSE_LOCALE_INSERT.currency_symbol;
    patch.currency_position = POS_LICENSE_LOCALE_INSERT.currency_position;
    patch.currency_decimals = POS_LICENSE_LOCALE_INSERT.currency_decimals;
  }

  const { error } = await supabase.from("restaurants").update(patch).eq("id", r.id);
  if (error) {
    console.warn("[settings] could not persist factory locale", error.message);
    return r;
  }
  clearRestaurantCache(licenseKey);
  return {
    ...r,
    language: langMissing ? POS_LICENSE_LOCALE_INSERT.language : r.language,
    currency: symbolMissing ? POS_LICENSE_LOCALE_INSERT.currency : r.currency,
    currency_symbol: symbolMissing
      ? POS_LICENSE_LOCALE_INSERT.currency_symbol
      : r.currency_symbol,
    currency_position: symbolMissing
      ? POS_LICENSE_LOCALE_INSERT.currency_position
      : r.currency_position,
    currency_decimals: symbolMissing
      ? POS_LICENSE_LOCALE_INSERT.currency_decimals
      : r.currency_decimals,
  };
}

export async function getCompanyDetails(licenseKey: string) {
  let r = await getRestaurantByLicense(licenseKey, { fresh: true });
  r = await ensureFactoryLocaleIfUnset(r, licenseKey);
  return {
    name: r.name,
    type: r.type,
    address: r.address ?? "",
    phone: r.phone ?? "",
    legalName: r.legal_name ?? "",
    city: r.city ?? "",
    taxNumber: r.tax_number ?? "",
    vatNumber: r.vat_number ?? "",
    defaultVatRate: r.default_vat_rate ?? 0.2,
    timezone: r.timezone ?? "Europe/Tirane",
    currency: resolvePosCurrencyCode(r.currency),
    language: resolvePosLanguage(r.language),
    currencySymbol: resolvePosCurrencySymbol(r.currency_symbol),
    currencyPosition: resolvePosCurrencyPosition(r.currency_position),
    currencyDecimals: resolvePosCurrencyDecimals(r.currency_decimals),
    plan: r.plan,
    id: r.id,
    licenseKey: r.license_key,
    licenseExpiry: r.license_expiry,
    licenseStatus: r.license_status,
    paymentSettings: parsePosPaymentSettings(r.pos_payment_settings),
    enforceOrderAvailability: r.pos_enforce_availability === true,
  };
}

export async function updateLocaleSettings(args: {
  licenseKey: string;
  language?: "en" | "sq";
  currencySymbol?: string;
  currencyPosition?: "prefix" | "suffix";
  currencyDecimals?: number;
  timezone?: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const patch: Record<string, unknown> = {};
  if (args.language !== undefined) patch.language = args.language;
  if (args.currencySymbol !== undefined)
    patch.currency_symbol = args.currencySymbol;
  if (args.currencyPosition !== undefined)
    patch.currency_position = args.currencyPosition;
  if (args.currencyDecimals !== undefined)
    patch.currency_decimals = args.currencyDecimals;
  if (args.timezone !== undefined) patch.timezone = args.timezone.trim();
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("restaurants")
    .update(patch)
    .eq("id", r.id);
  if (error) throw error;
  clearRestaurantCache(args.licenseKey);
}

export async function updateCompanyProfile(args: {
  licenseKey: string;
  name?: string;
  address?: string;
  phone?: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const patch: Record<string, unknown> = {};
  if (args.name !== undefined) {
    const n = args.name.trim();
    if (!n) throw new Error("Business name is required");
    patch.name = n;
  }
  if (args.address !== undefined) patch.address = args.address.trim() || null;
  if (args.phone !== undefined) patch.phone = args.phone.trim() || null;

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("restaurants")
    .update(patch)
    .eq("id", r.id);
  if (error) throw error;
  clearRestaurantCache(args.licenseKey);
}

export async function updatePaymentSettings(args: {
  licenseKey: string;
  handling: "waiter" | "counter";
  manager: boolean;
  waiter: boolean;
  methods?: { cash?: boolean; card?: boolean; qr?: boolean };
  allowSplitBill?: boolean;
  allowRefund?: boolean;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const payload = parsePosPaymentSettings({
    handling: args.handling === "waiter" ? "waiter" : "counter",
    counterRoles: {
      admin: true,
      manager: args.manager !== false,
      waiter: args.waiter === true,
    },
    methods: args.methods,
    allowSplitBill: args.allowSplitBill,
    allowRefund: args.allowRefund,
  });
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_payment_settings: payload })
    .eq("id", r.id);
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("pos_payment_settings") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon kolona pos_payment_settings. Ekzekuto supabase/ensure_pos_payment_settings.sql në Supabase SQL Editor.",
      );
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
}

export async function updateOrderAvailabilitySettings(args: {
  licenseKey: string;
  enforce: boolean;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_enforce_availability: args.enforce === true })
    .eq("id", r.id);
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("pos_enforce_availability") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon kolona pos_enforce_availability. Ekzekuto supabase/ensure_pos_order_availability.sql në Supabase SQL Editor.",
      );
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
}

export async function updateTaxSettings(args: {
  licenseKey: string;
  vatNumber?: string;
  defaultVatRate?: number;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const patch: Record<string, unknown> = {};
  if (args.vatNumber !== undefined)
    patch.vat_number = args.vatNumber.trim() || null;
  if (args.defaultVatRate !== undefined)
    patch.default_vat_rate = args.defaultVatRate;

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("restaurants")
    .update(patch)
    .eq("id", r.id);
  if (error) throw error;
  clearRestaurantCache(args.licenseKey);
}

/** Persist device quick-login PIN hash so close day can authorize when staff.pin_hash differs. */
export async function syncDeviceClosePinHash(args: {
  licenseKey: string;
  pinHash: string;
}) {
  const h = String(args.pinHash ?? "").trim();
  if (h.length < 64) {
    throw new Error("Invalid PIN hash.");
  }
  const r = await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_device_close_pin_hash: h })
    .eq("id", r.id);
  if (error) {
    const msg = String(error.message ?? "");
    if (
      msg.includes("pos_device_close_pin_hash") ||
      msg.includes("schema cache")
    ) {
      throw new Error(
        "Mungon kolona pos_device_close_pin_hash. Në Supabase SQL Editor ekzekuto: supabase/ensure_pos_device_close_pin.sql",
      );
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
  return { ok: true as const };
}

export async function getPrinters(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  const { data, error } = await supabase
    .from("pos_printers")
    .select("*")
    .eq("restaurant_id", r.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    _id: p.id,
    _creationTime: new Date(p.created_at).getTime(),
    name: p.name,
    type: p.type,
    address: p.address,
    role: p.role,
    isActive: p.is_active,
  }));
}

export async function addPrinter(args: {
  licenseKey: string;
  name: string;
  type: string;
  address: string;
  role: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { data, error } = await supabase
    .from("pos_printers")
    .insert({
      restaurant_id: r.id,
      name: args.name,
      type: args.type,
      address: args.address,
      role: args.role,
      is_active: true,
    })
    .select("id")
    .single();
  assertNoPgError("Could not save printer", error);
  return data!.id as string;
}

export async function updatePrinter(args: {
  licenseKey: string;
  printerId: string;
  role?: string;
  name?: string;
  address?: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const patch: Record<string, unknown> = {};
  if (args.role !== undefined) patch.role = args.role;
  if (args.name !== undefined) patch.name = args.name;
  if (args.address !== undefined) patch.address = args.address;
  const { error } = await supabase
    .from("pos_printers")
    .update(patch)
    .eq("id", args.printerId);
  if (error) throw error;
}

export async function deletePrinter(args: {
  licenseKey: string;
  printerId: string;
}) {
  await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("pos_printers")
    .delete()
    .eq("id", args.printerId);
  if (error) throw error;
}
