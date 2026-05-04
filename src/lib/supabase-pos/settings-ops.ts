import { supabase } from "@/lib/supabase.ts";
import { assertNoPgError } from "./db-errors.ts";
import { getRestaurantByLicense, clearRestaurantCache } from "./restaurant.ts";

export async function getCompanyDetails(licenseKey: string) {
  const r = await getRestaurantByLicense(licenseKey);
  return {
    name: r.name,
    type: r.type,
    address: r.address ?? "",
    phone: r.phone ?? "",
    currency: r.currency,
    language: (r.language as "en" | "sq") ?? "en",
    currencySymbol: r.currency_symbol ?? "Lek",
    currencyPosition: (r.currency_position as "prefix" | "suffix") ?? "suffix",
    currencyDecimals: r.currency_decimals ?? 2,
    plan: r.plan,
    licenseKey: r.license_key,
    licenseExpiry: r.license_expiry,
    licenseStatus: r.license_status,
  };
}

export async function updateLocaleSettings(args: {
  licenseKey: string;
  language?: "en" | "sq";
  currencySymbol?: string;
  currencyPosition?: "prefix" | "suffix";
  currencyDecimals?: number;
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
