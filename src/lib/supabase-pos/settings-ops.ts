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
  appendTaxHistory,
  defaultVatFraction,
  getCountryTaxCatalog,
  parsePosTaxSettings,
  serializePosTaxSettings,
  taxSettingsSummary,
} from "@/lib/pos-tax-config.ts";
import {
  parsePosStockRules,
  serializePosStockRules,
  stockRulesFromRestaurantRow,
} from "@/lib/pos-order-availability.ts";
import {
  parsePosSecuritySettings,
  serializePosSecuritySettings,
  type PosSecuritySettings,
} from "@/lib/pos-security-config.ts";
import {
  parsePosCustomerDisplay,
  serializePosCustomerDisplay,
  type PosCustomerDisplaySettings,
} from "@/lib/pos-customer-display.ts";
import { isLocalDevicePosAdmin, uuidOrNull } from "./uuid.ts";
import { assertStaffCanManageStaff } from "./staff-auth.ts";
import { STAFF_PERMISSION_DENIED } from "@/lib/staff-permissions.ts";
import { insertAuditLog } from "./dashboard-ops.ts";
import {
  normalizePhoneAccessBranding,
  normalizePinLoginBranding,
  type PhoneAccessBranding,
  type PinLoginBranding,
} from "@/lib/local-db.ts";
import { assertNoPgError } from "./db-errors.ts";
import { getRestaurantByLicense, clearRestaurantCache } from "./restaurant.ts";

function isMissingPosPinBrandingColumn(err: { message?: string }): boolean {
  const msg = String(err.message ?? "").toLowerCase();
  return (
    msg.includes("pos_pin_branding") ||
    msg.includes("pos_theme") ||
    msg.includes("phone_access_branding") ||
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

function phoneAccessFromRow(raw: unknown): PhoneAccessBranding | null {
  if (!raw || typeof raw !== "object") return null;
  return normalizePhoneAccessBranding(raw as Partial<PhoneAccessBranding>);
}

export async function fetchPhoneAccessBrandingFromCloud(
  licenseKey: string,
): Promise<PhoneAccessBranding | null> {
  const r = await getRestaurantByLicense(licenseKey);
  if (r.phone_access_branding == null) return null;
  return phoneAccessFromRow(r.phone_access_branding);
}

export async function savePhoneAccessBrandingToCloud(
  licenseKey: string,
  branding: PhoneAccessBranding,
): Promise<void> {
  const r = await getRestaurantByLicense(licenseKey);
  const payload = normalizePhoneAccessBranding(branding);
  const { error } = await supabase
    .from("restaurants")
    .update({ phone_access_branding: payload })
    .eq("id", r.id);
  if (error) {
    if (isMissingPosPinBrandingColumn(error)) {
      throw new Error(
        "Mungon kolona phone_access_branding. Ekzekuto supabase/ensure_phone_access_branding.sql në Supabase SQL Editor.",
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

function countRegisteredPosDevices(
  raw: unknown,
  primaryDeviceId?: string | null,
): number {
  const ids = new Set<string>();
  const list = Array.isArray(raw) ? raw : [];
  for (const item of list) {
    const id = String(item ?? "").trim();
    if (id) ids.add(id);
  }
  const primary = String(primaryDeviceId ?? "").trim();
  if (primary) ids.add(primary);
  return ids.size;
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
    postalCode: r.postal_code ?? "",
    country: r.country ?? "",
    email: r.business_email ?? "",
    website: r.website ?? "",
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
    licenseStartedAt: r.created_at ?? null,
    maxTerminals: r.max_terminals ?? null,
    registeredDeviceCount: countRegisteredPosDevices(
      r.registered_devices,
      r.device_id,
    ),
    paymentSettings: parsePosPaymentSettings(r.pos_payment_settings),
    generalPrefs: r.pos_general_prefs,
    taxSettings: r.pos_tax_settings,
    stockRules: (() => {
      const stored = stockRulesFromRestaurantRow(r);
      return stored === undefined ? null : parsePosStockRules(stored);
    })(),
    enforceOrderAvailability: r.pos_enforce_availability === true,
    mobileAccessEnabled: r.mobile_access_enabled !== false,
    lastPosSyncAt: r.last_pos_sync_at ?? null,
    securitySettings: parsePosSecuritySettings(r.pos_security_settings),
    customerDisplay: parsePosCustomerDisplay(r.pos_customer_display),
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

function optionalText(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function updateCompanyProfile(args: {
  licenseKey: string;
  name?: string;
  type?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const patch: Record<string, unknown> = {};
  if (args.name !== undefined) {
    const n = args.name.trim();
    if (!n) throw new Error("Business name is required");
    patch.name = n;
  }
  // Business type is chosen when the license is purchased. The POS cannot change it.
  if (args.address !== undefined) patch.address = optionalText(args.address);
  if (args.phone !== undefined) patch.phone = optionalText(args.phone);
  if (args.email !== undefined) patch.business_email = optionalText(args.email);
  if (args.website !== undefined) patch.website = optionalText(args.website);
  if (args.city !== undefined) patch.city = optionalText(args.city);
  if (args.postalCode !== undefined) patch.postal_code = optionalText(args.postalCode);
  if (args.country !== undefined) patch.country = optionalText(args.country);

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("restaurants")
    .update(patch)
    .eq("id", r.id);
  if (!error) {
    clearRestaurantCache(args.licenseKey);
    return;
  }

  const missing =
    /column|schema cache/i.test(String(error.message ?? "")) &&
    /business_email|website|postal_code|country|city|type/i.test(String(error.message ?? ""));
  if (!missing) throw error;

  const basic: Record<string, unknown> = {};
  if (patch.name !== undefined) basic.name = patch.name;
  if (patch.address !== undefined) basic.address = patch.address;
  if (patch.phone !== undefined) basic.phone = patch.phone;
  if (patch.type !== undefined) basic.type = patch.type;
  if (Object.keys(basic).length === 0) throw error;
  const retry = await supabase.from("restaurants").update(basic).eq("id", r.id);
  if (retry.error) throw retry.error;
  clearRestaurantCache(args.licenseKey);
}

export async function updateGeneralPrefs(args: {
  licenseKey: string;
  prefs: Record<string, unknown>;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_general_prefs: args.prefs })
    .eq("id", r.id);
  if (!error) {
    clearRestaurantCache(args.licenseKey);
    return;
  }
  const msg = String(error.message ?? "");
  if (/pos_general_prefs|schema cache|column/i.test(msg)) return;
  throw error;
}

export async function updatePaymentSettings(args: {
  licenseKey: string;
  handling: "waiter" | "counter";
  manager: boolean;
  waiter: boolean;
  methods?: { cash?: boolean; card?: boolean; qr?: boolean };
  channels?: unknown;
  roleMethods?: unknown;
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
    channels: args.channels,
    roleMethods: args.roleMethods,
    allowSplitBill: args.allowSplitBill,
    allowRefund: args.allowRefund,
  }) as Record<string, unknown>;
  const keptRules = stockRulesFromRestaurantRow({
    pos_payment_settings: r.pos_payment_settings,
  });
  if (keptRules !== undefined) payload.stockRules = keptRules;
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
  enforce?: boolean;
  blockOutOfStock?: boolean;
  defaultLowStockThreshold?: number;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const nextRules = parsePosStockRules(stockRulesFromRestaurantRow(r));
  if (typeof args.blockOutOfStock === "boolean") {
    nextRules.blockOutOfStock = args.blockOutOfStock;
  }
  if (
    typeof args.defaultLowStockThreshold === "number" &&
    Number.isFinite(args.defaultLowStockThreshold)
  ) {
    nextRules.defaultLowStockThreshold = parsePosStockRules({
      defaultLowStockThreshold: args.defaultLowStockThreshold,
    }).defaultLowStockThreshold;
  }
  const serialized = serializePosStockRules(nextRules);
  const enforcePatch: Record<string, unknown> = {};
  if (typeof args.enforce === "boolean") {
    enforcePatch.pos_enforce_availability = args.enforce === true;
  }
  const columnWrite = await supabase
    .from("restaurants")
    .update({ ...enforcePatch, pos_stock_rules: serialized })
    .eq("id", r.id)
    .select("id")
    .maybeSingle();
  const columnMsg = String(columnWrite.error?.message ?? "").toLowerCase();
  const missingRulesColumn =
    columnWrite.error != null &&
    (columnMsg.includes("pos_stock_rules") || columnMsg.includes("schema cache"));
  if (columnWrite.error && !missingRulesColumn) {
    if (columnMsg.includes("pos_enforce_availability")) {
      throw new Error(
        "Mungon kolona pos_enforce_availability. Ekzekuto supabase/ensure_pos_order_availability.sql në Supabase SQL Editor.",
      );
    }
    throw columnWrite.error;
  }
  if (!columnWrite.error) {
    if (!columnWrite.data) throw new Error("Stock rules were not saved.");
    clearRestaurantCache(args.licenseKey);
    return;
  }
  const currentPay =
    r.pos_payment_settings && typeof r.pos_payment_settings === "object"
      ? { ...(r.pos_payment_settings as Record<string, unknown>) }
      : {};
  currentPay.stockRules = serialized;
  const fallback = await supabase
    .from("restaurants")
    .update({ ...enforcePatch, pos_payment_settings: currentPay })
    .eq("id", r.id)
    .select("id")
    .maybeSingle();
  if (fallback.error) throw fallback.error;
  if (!fallback.data) throw new Error("Stock rules were not saved.");
  clearRestaurantCache(args.licenseKey);
}

export async function updateTaxSettings(args: {
  licenseKey: string;
  vatNumber?: string;
  defaultVatRate?: number;
  pricingMode?: "inclusive" | "exclusive";
  defaultRateId?: string;
  enabledRateIds?: string[];
  customPercent?: number;
  customName?: string;
  actorStaffId?: string;
  actorStaffName?: string;
}) {
  const r = await getRestaurantByLicense(args.licenseKey);
  const ctx = {
    country: r.country ?? "",
    businessType: r.type ?? "restaurant",
    fallbackVatFraction: Number(r.default_vat_rate ?? 0.2),
  };
  const catalog = getCountryTaxCatalog(ctx.country);
  const previous = parsePosTaxSettings(r.pos_tax_settings, ctx);

  const vatNumber =
    args.vatNumber !== undefined ? args.vatNumber.trim() : (r.vat_number ?? "");

  const patch: Record<string, unknown> = {};
  if (args.vatNumber !== undefined) patch.vat_number = vatNumber || null;

  if (
    args.pricingMode !== undefined ||
    args.defaultRateId !== undefined ||
    args.enabledRateIds !== undefined ||
    args.customPercent !== undefined ||
    args.customName !== undefined
  ) {
    if (!catalog) {
      throw new Error(
        "Set the business country in General before configuring tax rates.",
      );
    }
    const next = parsePosTaxSettings(
      {
        pricingMode: args.pricingMode ?? previous.pricingMode,
        defaultRateId: args.defaultRateId ?? previous.defaultRateId,
        enabledRateIds: args.enabledRateIds ?? previous.enabledRateIds,
        customPercent: args.customPercent ?? previous.customPercent,
        customName: args.customName ?? previous.customName,
        history: previous.history,
      },
      ctx,
    );
    const legal = new Set(catalog.rates.map((rate) => rate.id));
    if (next.enabledRateIds.some((id) => !legal.has(id))) {
      throw new Error("A selected tax rate is not valid for this country.");
    }
    if (!next.enabledRateIds.includes(next.defaultRateId)) {
      throw new Error("The default tax rate must be one of the enabled country rates.");
    }
    const serialized = serializePosTaxSettings({
      ...next,
      history: appendTaxHistory(previous, {
        summary: taxSettingsSummary(next, ctx),
        vatNumber,
        pricingMode: next.pricingMode,
        defaultRateId: next.defaultRateId,
        enabledRateIds: next.enabledRateIds,
      }),
    });
    patch.pos_tax_settings = serialized;
    patch.default_vat_rate = defaultVatFraction(serialized, ctx);
  } else if (args.defaultVatRate !== undefined) {
    patch.default_vat_rate = args.defaultVatRate;
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("restaurants")
    .update(patch)
    .eq("id", r.id);
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("pos_tax_settings") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon kolona pos_tax_settings. Ekzekuto supabase/migrations/046_restaurants_tax_settings.sql në Supabase SQL Editor.",
      );
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
  await insertAuditLog({
    licenseKey: args.licenseKey,
    staffId: args.actorStaffId,
    staffName: args.actorStaffName?.trim() || "System",
    action: "tax_update",
    details: `Tax settings updated${vatNumber ? ` (${vatNumber})` : ""}`,
    metadata: {
      defaultRateId: args.defaultRateId ?? previous.defaultRateId,
      pricingMode: args.pricingMode ?? previous.pricingMode,
    },
  });
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

export type PosSecurityDevice = {
  id: string;
  deviceId: string;
  displayName: string;
  locationName: string | null;
  os: string | null;
  appVersion: string | null;
  ipAddress: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSyncAt: string | null;
  disconnectedAt: string | null;
  deviceKind: string;
};

function requireCloudSecurityStaffId(staffId: string | null | undefined): string {
  if (isLocalDevicePosAdmin(staffId)) {
    throw new Error("CLOUD_ADMIN_REQUIRED");
  }
  const sid = uuidOrNull(staffId);
  if (!sid) throw new Error("CLOUD_ADMIN_REQUIRED");
  return sid;
}

export async function updateSecuritySettings(args: {
  licenseKey: string;
  actorStaffId?: string | null;
  sessionTimeoutMinutes: number;
}) {
  if (!String(args.actorStaffId ?? "").trim()) {
    throw new Error(STAFF_PERMISSION_DENIED);
  }
  await assertStaffCanManageStaff({
    licenseKey: args.licenseKey,
    actorStaffId: args.actorStaffId,
  });
  const r = await getRestaurantByLicense(args.licenseKey);
  const next: PosSecuritySettings = serializePosSecuritySettings({
    sessionTimeoutMinutes: args.sessionTimeoutMinutes as PosSecuritySettings["sessionTimeoutMinutes"],
  });
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_security_settings: next })
    .eq("id", r.id);
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("pos_security_settings") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon kolona pos_security_settings. Ekzekuto supabase/migrations/048_pos_security.sql në Supabase SQL Editor.",
      );
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
}

export async function updateCustomerDisplay(args: {
  licenseKey: string;
  actorStaffId?: string | null;
  settings: PosCustomerDisplaySettings;
}) {
  if (!String(args.actorStaffId ?? "").trim()) {
    throw new Error(STAFF_PERMISSION_DENIED);
  }
  await assertStaffCanManageStaff({
    licenseKey: args.licenseKey,
    actorStaffId: args.actorStaffId,
  });
  const r = await getRestaurantByLicense(args.licenseKey);
  const next = serializePosCustomerDisplay(args.settings);
  const { error } = await supabase
    .from("restaurants")
    .update({ pos_customer_display: next })
    .eq("id", r.id);
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("pos_customer_display") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon kolona pos_customer_display. Ekzekuto supabase/migrations/049_pos_customer_display.sql në Supabase SQL Editor.",
      );
    }
    throw error;
  }
  clearRestaurantCache(args.licenseKey);
}

export async function listSecurityDevices(args: {
  licenseKey: string;
  staffId?: string | null;
}): Promise<PosSecurityDevice[]> {
  await assertStaffCanManageStaff({
    licenseKey: args.licenseKey,
    actorStaffId: args.staffId,
  });
  const staffId = requireCloudSecurityStaffId(args.staffId);
  const { data, error } = await supabase.rpc("vyntex_pos_list_security_devices", {
    p_license_key: args.licenseKey,
    p_staff_id: staffId,
  });
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("vyntex_pos_list_security_devices") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon funksioni i sigurisë. Ekzekuto supabase/migrations/048_pos_security.sql në Supabase SQL Editor.",
      );
    }
    if (msg.includes("not authorized")) {
      throw new Error("CLOUD_ADMIN_REQUIRED");
    }
    throw error;
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ""),
    deviceId: String(row.device_id ?? ""),
    displayName: String(row.display_name ?? "POS"),
    locationName: row.location_name ? String(row.location_name) : null,
    os: row.os ? String(row.os) : null,
    appVersion: row.app_version ? String(row.app_version) : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    firstSeenAt: String(row.first_seen_at ?? ""),
    lastSeenAt: String(row.last_seen_at ?? ""),
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    disconnectedAt: row.disconnected_at ? String(row.disconnected_at) : null,
    deviceKind: String(row.device_kind ?? "pos"),
  }));
}

export async function revokeSecurityDevice(args: {
  licenseKey: string;
  staffId?: string | null;
  staffName?: string;
  targetDeviceId: string;
  currentDeviceId?: string;
}): Promise<void> {
  await assertStaffCanManageStaff({
    licenseKey: args.licenseKey,
    actorStaffId: args.staffId,
  });
  const staffId = requireCloudSecurityStaffId(args.staffId);
  const target = String(args.targetDeviceId ?? "").trim();
  if (!target) throw new Error("CLOUD_ADMIN_REQUIRED");
  if (args.currentDeviceId && target === args.currentDeviceId) {
    throw new Error("CANNOT_REVOKE_SELF");
  }
  const { data, error } = await supabase.rpc("vyntex_pos_revoke_device", {
    p_license_key: args.licenseKey,
    p_staff_id: staffId,
    p_target_device_id: target,
  });
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("vyntex_pos_revoke_device") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon funksioni i sigurisë. Ekzekuto supabase/migrations/048_pos_security.sql në Supabase SQL Editor.",
      );
    }
    if (msg.includes("not authorized") || msg.includes("waiter phones")) {
      throw new Error(msg.includes("waiter") ? "PHONE_APP_DEVICE" : "CLOUD_ADMIN_REQUIRED");
    }
    throw error;
  }
  if (data !== true) throw new Error("REVOKE_FAILED");
  clearRestaurantCache(args.licenseKey);
  await insertAuditLog({
    licenseKey: args.licenseKey,
    staffId,
    staffName: args.staffName || "Admin",
    action: "device_revoke",
    details: `Signed out terminal ${target}`,
    metadata: { deviceId: target, source: "security_settings" },
  });
}

export type PosWaiterPhoneDevice = {
  id: string;
  deviceId: string;
  displayName: string;
  os: string | null;
  appVersion: string | null;
  ipAddress: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSyncAt: string | null;
  disconnectedAt: string | null;
};

function mapWaiterPhoneRow(row: Record<string, unknown>): PosWaiterPhoneDevice {
  return {
    id: String(row.id ?? ""),
    deviceId: String(row.device_id ?? ""),
    displayName: String(row.display_name ?? "Phone"),
    os: row.os ? String(row.os) : null,
    appVersion: row.app_version ? String(row.app_version) : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    firstSeenAt: String(row.first_seen_at ?? ""),
    lastSeenAt: String(row.last_seen_at ?? ""),
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    disconnectedAt: row.disconnected_at ? String(row.disconnected_at) : null,
  };
}

export async function listWaiterPhones(args: {
  licenseKey: string;
  staffId?: string | null;
}): Promise<PosWaiterPhoneDevice[]> {
  await assertStaffCanManageStaff({
    licenseKey: args.licenseKey,
    actorStaffId: args.staffId,
  });
  const staffId = requireCloudSecurityStaffId(args.staffId);
  const { data, error } = await supabase.rpc("vyntex_pos_list_waiter_phones", {
    p_license_key: args.licenseKey,
    p_staff_id: staffId,
  });
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("vyntex_pos_list_waiter_phones") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon funksioni i telefonave. Ekzekuto supabase/migrations/050_pos_phone_app_devices.sql në Supabase SQL Editor.",
      );
    }
    if (msg.includes("not authorized")) {
      throw new Error("CLOUD_ADMIN_REQUIRED");
    }
    throw error;
  }
  return (data ?? []).map((row: Record<string, unknown>) => mapWaiterPhoneRow(row));
}

export async function revokeWaiterPhone(args: {
  licenseKey: string;
  staffId?: string | null;
  staffName?: string;
  targetDeviceId: string;
}): Promise<void> {
  await assertStaffCanManageStaff({
    licenseKey: args.licenseKey,
    actorStaffId: args.staffId,
  });
  const staffId = requireCloudSecurityStaffId(args.staffId);
  const target = String(args.targetDeviceId ?? "").trim();
  if (!target) throw new Error("CLOUD_ADMIN_REQUIRED");
  const { data, error } = await supabase.rpc("vyntex_pos_revoke_waiter_phone", {
    p_license_key: args.licenseKey,
    p_staff_id: staffId,
    p_target_device_id: target,
  });
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("vyntex_pos_revoke_waiter_phone") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon funksioni i telefonave. Ekzekuto supabase/migrations/050_pos_phone_app_devices.sql në Supabase SQL Editor.",
      );
    }
    if (msg.includes("phone_not_found")) {
      throw new Error("PHONE_NOT_FOUND");
    }
    if (msg.includes("not authorized")) {
      throw new Error("CLOUD_ADMIN_REQUIRED");
    }
    throw error;
  }
  if (data !== true) throw new Error("REVOKE_FAILED");
  await insertAuditLog({
    licenseKey: args.licenseKey,
    staffId,
    staffName: args.staffName || "Admin",
    action: "device_revoke",
    details: `Revoked waiter phone ${target}`,
    metadata: { deviceId: target, source: "phone_app_settings" },
  });
}

export async function renameWaiterPhone(args: {
  licenseKey: string;
  staffId?: string | null;
  targetDeviceId: string;
  displayName: string;
}): Promise<void> {
  await assertStaffCanManageStaff({
    licenseKey: args.licenseKey,
    actorStaffId: args.staffId,
  });
  const staffId = requireCloudSecurityStaffId(args.staffId);
  const target = String(args.targetDeviceId ?? "").trim();
  const displayName = String(args.displayName ?? "").trim();
  if (!target || !displayName) throw new Error("CLOUD_ADMIN_REQUIRED");
  const { data, error } = await supabase.rpc("vyntex_pos_rename_waiter_phone", {
    p_license_key: args.licenseKey,
    p_staff_id: staffId,
    p_target_device_id: target,
    p_display_name: displayName,
  });
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("vyntex_pos_rename_waiter_phone") || msg.includes("schema cache")) {
      throw new Error(
        "Mungon funksioni i telefonave. Ekzekuto supabase/migrations/050_pos_phone_app_devices.sql në Supabase SQL Editor.",
      );
    }
    if (msg.includes("phone_not_found")) {
      throw new Error("PHONE_NOT_FOUND");
    }
    if (msg.includes("not authorized")) {
      throw new Error("CLOUD_ADMIN_REQUIRED");
    }
    throw error;
  }
  if (data !== true) throw new Error("RENAME_FAILED");
}
