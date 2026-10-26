/** Country-legal tax catalogs for POS prices, orders, and documents. */

export type TaxSystem = "vat" | "sales_tax" | "none";

export type TaxRateKind =
  | "standard"
  | "reduced"
  | "super_reduced"
  | "special"
  | "zero"
  | "sales";

export type TaxPricingMode = "inclusive" | "exclusive";

export type CountryTaxRate = {
  id: string;
  kind: TaxRateKind;
  percent: number;
  nameKey: string;
  hintKey?: string;
  /** When true the venue sets the numeric rate (US sales tax). */
  flexiblePercent?: boolean;
};

export type CountryTaxCatalog = {
  country: string;
  system: TaxSystem;
  countryNameKey: string;
  rates: CountryTaxRate[];
  defaultRateId: string;
};

export type TaxHistoryEntry = {
  at: string;
  summary: string;
  vatNumber: string;
  pricingMode: TaxPricingMode;
  defaultRateId: string;
  enabledRateIds: string[];
};

export type PosTaxSettings = {
  pricingMode: TaxPricingMode;
  defaultRateId: string;
  enabledRateIds: string[];
  customPercent?: number;
  customName?: string;
  history: TaxHistoryEntry[];
};

export type VenueTaxContext = {
  country: string;
  businessType: string;
  fallbackVatFraction?: number;
};

const KIND_TYPICAL: Record<string, TaxRateKind[]> = {
  restaurant: ["standard", "reduced", "zero", "sales"],
  cafe: ["standard", "reduced", "zero", "sales"],
  bar: ["standard", "zero", "sales"],
  hotel: ["standard", "reduced", "special", "super_reduced", "zero", "sales"],
  fitness: ["standard", "zero", "sales"],
};

const COUNTRY_ALIASES: Record<string, string> = {
  xk: "XK",
  kosovo: "XK",
  kosova: "XK",
  rks: "XK",
  al: "AL",
  albania: "AL",
  shqiperi: "AL",
  shqiperia: "AL",
  mk: "MK",
  macedonia: "MK",
  "north macedonia": "MK",
  me: "ME",
  montenegro: "ME",
  rs: "RS",
  serbia: "RS",
  hr: "HR",
  croatia: "HR",
  ba: "BA",
  bosnia: "BA",
  "bosnia and herzegovina": "BA",
  gr: "GR",
  greece: "GR",
  it: "IT",
  italy: "IT",
  de: "DE",
  germany: "DE",
  ch: "CH",
  switzerland: "CH",
  at: "AT",
  austria: "AT",
  gb: "GB",
  uk: "GB",
  "united kingdom": "GB",
  us: "US",
  usa: "US",
  "united states": "US",
};

function rate(
  country: string,
  kind: TaxRateKind,
  percent: number,
  extra?: Partial<CountryTaxRate>,
): CountryTaxRate {
  return {
    id: `${country}_${kind}`,
    kind,
    percent,
    nameKey: `settings.tax_kind_${kind}`,
    ...extra,
  };
}

const CATALOGS: Record<string, CountryTaxCatalog> = {
  XK: {
    country: "XK",
    system: "vat",
    countryNameKey: "settings.tax_country_xk",
    defaultRateId: "XK_standard",
    rates: [
      rate("XK", "standard", 18),
      rate("XK", "reduced", 8, { hintKey: "settings.tax_hint_food" }),
      rate("XK", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  AL: {
    country: "AL",
    system: "vat",
    countryNameKey: "settings.tax_country_al",
    defaultRateId: "AL_standard",
    rates: [
      rate("AL", "standard", 20),
      rate("AL", "reduced", 6, { hintKey: "settings.tax_hint_reduced" }),
      rate("AL", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  MK: {
    country: "MK",
    system: "vat",
    countryNameKey: "settings.tax_country_mk",
    defaultRateId: "MK_standard",
    rates: [
      rate("MK", "standard", 18),
      rate("MK", "reduced", 5, { hintKey: "settings.tax_hint_reduced" }),
      rate("MK", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  ME: {
    country: "ME",
    system: "vat",
    countryNameKey: "settings.tax_country_me",
    defaultRateId: "ME_standard",
    rates: [
      rate("ME", "standard", 21),
      rate("ME", "reduced", 7, { hintKey: "settings.tax_hint_reduced" }),
      rate("ME", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  RS: {
    country: "RS",
    system: "vat",
    countryNameKey: "settings.tax_country_rs",
    defaultRateId: "RS_standard",
    rates: [
      rate("RS", "standard", 20),
      rate("RS", "reduced", 10, { hintKey: "settings.tax_hint_reduced" }),
      rate("RS", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  HR: {
    country: "HR",
    system: "vat",
    countryNameKey: "settings.tax_country_hr",
    defaultRateId: "HR_standard",
    rates: [
      rate("HR", "standard", 25),
      rate("HR", "reduced", 13, { hintKey: "settings.tax_hint_reduced" }),
      rate("HR", "super_reduced", 5, { hintKey: "settings.tax_hint_super_reduced" }),
      rate("HR", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  BA: {
    country: "BA",
    system: "vat",
    countryNameKey: "settings.tax_country_ba",
    defaultRateId: "BA_standard",
    rates: [
      rate("BA", "standard", 17),
      rate("BA", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  GR: {
    country: "GR",
    system: "vat",
    countryNameKey: "settings.tax_country_gr",
    defaultRateId: "GR_standard",
    rates: [
      rate("GR", "standard", 24),
      rate("GR", "reduced", 13, { hintKey: "settings.tax_hint_reduced" }),
      rate("GR", "super_reduced", 6, { hintKey: "settings.tax_hint_super_reduced" }),
      rate("GR", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  IT: {
    country: "IT",
    system: "vat",
    countryNameKey: "settings.tax_country_it",
    defaultRateId: "IT_standard",
    rates: [
      rate("IT", "standard", 22),
      rate("IT", "reduced", 10, { hintKey: "settings.tax_hint_food" }),
      rate("IT", "super_reduced", 5),
      rate("IT", "special", 4, { hintKey: "settings.tax_hint_super_reduced" }),
      rate("IT", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  DE: {
    country: "DE",
    system: "vat",
    countryNameKey: "settings.tax_country_de",
    defaultRateId: "DE_standard",
    rates: [
      rate("DE", "standard", 19),
      rate("DE", "reduced", 7, { hintKey: "settings.tax_hint_food" }),
      rate("DE", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  CH: {
    country: "CH",
    system: "vat",
    countryNameKey: "settings.tax_country_ch",
    defaultRateId: "CH_standard",
    rates: [
      rate("CH", "standard", 8.1),
      rate("CH", "special", 3.8, { hintKey: "settings.tax_hint_accommodation" }),
      rate("CH", "reduced", 2.6, { hintKey: "settings.tax_hint_reduced" }),
      rate("CH", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  AT: {
    country: "AT",
    system: "vat",
    countryNameKey: "settings.tax_country_at",
    defaultRateId: "AT_standard",
    rates: [
      rate("AT", "standard", 20),
      rate("AT", "reduced", 13, { hintKey: "settings.tax_hint_accommodation" }),
      rate("AT", "super_reduced", 10, { hintKey: "settings.tax_hint_food" }),
      rate("AT", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  GB: {
    country: "GB",
    system: "vat",
    countryNameKey: "settings.tax_country_gb",
    defaultRateId: "GB_standard",
    rates: [
      rate("GB", "standard", 20),
      rate("GB", "reduced", 5, { hintKey: "settings.tax_hint_reduced" }),
      rate("GB", "zero", 0, { hintKey: "settings.tax_hint_exempt" }),
    ],
  },
  US: {
    country: "US",
    system: "sales_tax",
    countryNameKey: "settings.tax_country_us",
    defaultRateId: "US_sales",
    rates: [
      {
        id: "US_sales",
        kind: "sales",
        percent: 0,
        nameKey: "settings.tax_kind_sales",
        hintKey: "settings.tax_hint_sales",
        flexiblePercent: true,
      },
    ],
  },
};

export function normalizeTaxCountry(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, " ");
  return COUNTRY_ALIASES[compact.toLowerCase()] ?? compact.toUpperCase();
}

export function getCountryTaxCatalog(
  country: string | null | undefined,
): CountryTaxCatalog | null {
  const code = normalizeTaxCountry(country);
  if (!code) return null;
  return CATALOGS[code] ?? null;
}

export function typicalRateIdsForBusiness(
  catalog: CountryTaxCatalog,
  businessType: string,
): string[] {
  const kinds = KIND_TYPICAL[businessType] ?? KIND_TYPICAL.restaurant;
  const matched = catalog.rates.filter((r) => kinds.includes(r.kind));
  const ids = (matched.length > 0 ? matched : catalog.rates).map((r) => r.id);
  if (!ids.includes(catalog.defaultRateId)) ids.unshift(catalog.defaultRateId);
  return [...new Set(ids)];
}

export function formatTaxPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "0";
  const rounded = Math.round(percent * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function percentToFraction(percent: number): number {
  return Math.round(percent * 100) / 10_000;
}

export function fractionToPercent(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

function sameFraction(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.0002;
}

export const DEFAULT_TAX_SETTINGS: PosTaxSettings = {
  pricingMode: "inclusive",
  defaultRateId: "",
  enabledRateIds: [],
  history: [],
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

export function parsePosTaxSettings(
  raw: unknown,
  ctx: VenueTaxContext,
): PosTaxSettings {
  const catalog = getCountryTaxCatalog(ctx.country);
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pricingMode: TaxPricingMode =
    o.pricingMode === "exclusive" ? "exclusive" : "inclusive";

  if (!catalog) {
    return {
      pricingMode,
      defaultRateId: "",
      enabledRateIds: [],
      history: parseHistory(o.history),
    };
  }

  const legalIds = new Set(catalog.rates.map((r) => r.id));
  const typical = typicalRateIdsForBusiness(catalog, ctx.businessType);
  let enabled = asStringArray(o.enabledRateIds).filter((id) => legalIds.has(id));
  if (enabled.length === 0) enabled = typical;

  let defaultRateId = String(o.defaultRateId ?? "").trim();
  if (!legalIds.has(defaultRateId) || !enabled.includes(defaultRateId)) {
    const fromFallback =
      typeof ctx.fallbackVatFraction === "number"
        ? catalog.rates.find((r) =>
            sameFraction(percentToFraction(effectivePercent(r, o)), ctx.fallbackVatFraction!),
          )?.id
        : undefined;
    defaultRateId =
      (fromFallback && enabled.includes(fromFallback) ? fromFallback : undefined) ??
      (enabled.includes(catalog.defaultRateId) ? catalog.defaultRateId : enabled[0]) ??
      catalog.defaultRateId;
  }

  const customPercent = Number(o.customPercent);
  const customName = String(o.customName ?? "").trim();

  return {
    pricingMode,
    defaultRateId,
    enabledRateIds: enabled,
    customPercent:
      Number.isFinite(customPercent) && customPercent >= 0 && customPercent <= 100
        ? Math.round(customPercent * 10) / 10
        : catalog.system === "sales_tax" && typeof ctx.fallbackVatFraction === "number"
          ? fractionToPercent(ctx.fallbackVatFraction)
          : 0,
    customName: customName || undefined,
    history: parseHistory(o.history),
  };
}

function effectivePercent(rate: CountryTaxRate, raw: Record<string, unknown>): number {
  if (!rate.flexiblePercent) return rate.percent;
  const n = Number(raw.customPercent);
  return Number.isFinite(n) ? n : rate.percent;
}

function parseHistory(raw: unknown): TaxHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const at = String(o.at ?? "").trim();
      const summary = String(o.summary ?? "").trim();
      if (!at || !summary) return null;
      return {
        at,
        summary,
        vatNumber: String(o.vatNumber ?? ""),
        pricingMode: o.pricingMode === "exclusive" ? "exclusive" : "inclusive",
        defaultRateId: String(o.defaultRateId ?? ""),
        enabledRateIds: asStringArray(o.enabledRateIds),
      } satisfies TaxHistoryEntry;
    })
    .filter((row): row is TaxHistoryEntry => row != null)
    .slice(0, 25);
}

export function appendTaxHistory(
  settings: PosTaxSettings,
  entry: Omit<TaxHistoryEntry, "at"> & { at?: string },
): TaxHistoryEntry[] {
  const next: TaxHistoryEntry = {
    at: entry.at ?? new Date().toISOString(),
    summary: entry.summary,
    vatNumber: entry.vatNumber,
    pricingMode: entry.pricingMode,
    defaultRateId: entry.defaultRateId,
    enabledRateIds: [...entry.enabledRateIds],
  };
  return [next, ...settings.history].slice(0, 25);
}

export function catalogRateById(
  catalog: CountryTaxCatalog | null,
  id: string,
): CountryTaxRate | undefined {
  return catalog?.rates.find((r) => r.id === id);
}

export function enabledCatalogRates(
  catalog: CountryTaxCatalog | null,
  settings: PosTaxSettings,
): CountryTaxRate[] {
  if (!catalog) return [];
  const enabled = new Set(settings.enabledRateIds);
  return catalog.rates.filter((r) => enabled.has(r.id));
}

export function ratePercent(
  rate: CountryTaxRate,
  settings: PosTaxSettings,
): number {
  if (rate.flexiblePercent) {
    const n = Number(settings.customPercent);
    return Number.isFinite(n) ? n : rate.percent;
  }
  return rate.percent;
}

export function defaultVatFraction(settings: PosTaxSettings, ctx: VenueTaxContext): number {
  const catalog = getCountryTaxCatalog(ctx.country);
  const rate = catalogRateById(catalog, settings.defaultRateId);
  if (!rate) {
    return typeof ctx.fallbackVatFraction === "number" ? ctx.fallbackVatFraction : 0.2;
  }
  return percentToFraction(ratePercent(rate, settings));
}

export function allowedVatFractions(
  settings: PosTaxSettings,
  ctx: VenueTaxContext,
): number[] {
  const catalog = getCountryTaxCatalog(ctx.country);
  if (!catalog) {
    return typeof ctx.fallbackVatFraction === "number"
      ? [ctx.fallbackVatFraction]
      : [];
  }
  return enabledCatalogRates(catalog, settings).map((r) =>
    percentToFraction(ratePercent(r, settings)),
  );
}

export function isVatRateAllowed(
  fraction: number,
  settings: PosTaxSettings,
  ctx: VenueTaxContext,
): boolean {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) return false;
  const allowed = allowedVatFractions(settings, ctx);
  if (allowed.length === 0) return false;
  return allowed.some((n) => sameFraction(n, fraction));
}

export function serializePosTaxSettings(settings: PosTaxSettings): PosTaxSettings {
  return {
    pricingMode: settings.pricingMode === "exclusive" ? "exclusive" : "inclusive",
    defaultRateId: String(settings.defaultRateId ?? "").trim(),
    enabledRateIds: [...new Set(settings.enabledRateIds.map((id) => String(id).trim()).filter(Boolean))],
    customPercent:
      typeof settings.customPercent === "number" && Number.isFinite(settings.customPercent)
        ? Math.round(Math.min(100, Math.max(0, settings.customPercent)) * 10) / 10
        : undefined,
    customName: settings.customName?.trim() || undefined,
    history: settings.history.slice(0, 25),
  };
}

export function taxSettingsSummary(
  settings: PosTaxSettings,
  ctx: VenueTaxContext,
): string {
  const catalog = getCountryTaxCatalog(ctx.country);
  const rate = catalogRateById(catalog, settings.defaultRateId);
  const pct = rate ? formatTaxPercent(ratePercent(rate, settings)) : "—";
  const mode = settings.pricingMode === "exclusive" ? "tax-exclusive" : "tax-inclusive";
  return `${catalog?.country ?? "—"} default ${pct}% (${mode})`;
}
