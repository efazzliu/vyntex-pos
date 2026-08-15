/** Factory locale for a license the client has not customized yet. */
export const POS_DEFAULT_LANGUAGE = "en" as const;
export const POS_DEFAULT_CURRENCY_CODE = "EUR";
export const POS_DEFAULT_CURRENCY_SYMBOL = "€";
export const POS_DEFAULT_CURRENCY_POSITION = "prefix" as const;
export const POS_DEFAULT_CURRENCY_DECIMALS = 2;

export type PosLanguage = "en" | "sq";
export type PosCurrencyPosition = "prefix" | "suffix";

export const POS_LICENSE_LOCALE_INSERT = {
  language: POS_DEFAULT_LANGUAGE,
  currency: POS_DEFAULT_CURRENCY_CODE,
  currency_symbol: POS_DEFAULT_CURRENCY_SYMBOL,
  currency_position: POS_DEFAULT_CURRENCY_POSITION,
  currency_decimals: POS_DEFAULT_CURRENCY_DECIMALS,
} as const;

export function localeFieldsFromCurrencyCode(code: string): {
  currency: string;
  currency_symbol: string;
  currency_position: PosCurrencyPosition;
  currency_decimals: number;
} {
  switch (code.trim().toUpperCase()) {
    case "USD":
      return {
        currency: "USD",
        currency_symbol: "$",
        currency_position: "prefix",
        currency_decimals: 2,
      };
    case "GBP":
      return {
        currency: "GBP",
        currency_symbol: "£",
        currency_position: "prefix",
        currency_decimals: 2,
      };
    case "CAD":
      return {
        currency: "CAD",
        currency_symbol: "C$",
        currency_position: "prefix",
        currency_decimals: 2,
      };
    case "AUD":
      return {
        currency: "AUD",
        currency_symbol: "A$",
        currency_position: "prefix",
        currency_decimals: 2,
      };
    case "ALL":
    case "LEK":
      return {
        currency: "ALL",
        currency_symbol: "Lek",
        currency_position: "suffix",
        currency_decimals: 0,
      };
    default:
      return {
        currency: POS_DEFAULT_CURRENCY_CODE,
        currency_symbol: POS_DEFAULT_CURRENCY_SYMBOL,
        currency_position: POS_DEFAULT_CURRENCY_POSITION,
        currency_decimals: POS_DEFAULT_CURRENCY_DECIMALS,
      };
  }
}

export function resolvePosLanguage(raw: unknown): PosLanguage {
  return raw === "sq" ? "sq" : POS_DEFAULT_LANGUAGE;
}

export function resolvePosCurrencySymbol(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s || POS_DEFAULT_CURRENCY_SYMBOL;
}

export function resolvePosCurrencyPosition(raw: unknown): PosCurrencyPosition {
  return raw === "suffix" ? "suffix" : POS_DEFAULT_CURRENCY_POSITION;
}

export function resolvePosCurrencyDecimals(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 3) {
    return POS_DEFAULT_CURRENCY_DECIMALS;
  }
  return Math.floor(n);
}

export function resolvePosCurrencyCode(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  return s || POS_DEFAULT_CURRENCY_CODE;
}
