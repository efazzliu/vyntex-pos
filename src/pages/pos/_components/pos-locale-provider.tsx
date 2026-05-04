import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import posI18n from "../_lib/pos-i18n.ts";

// ── Currency config type ────────────────────────────────

type CurrencyConfig = {
  symbol: string;
  position: "prefix" | "suffix";
  decimals: number;
};

type PosLocaleContextType = {
  language: "en" | "sq";
  currency: CurrencyConfig;
  /** Format a number as a currency string */
  formatPrice: (amount: number) => string;
  /** Translation function shortcut */
  t: (key: string, options?: Record<string, unknown>) => string;
};

const DEFAULT_CURRENCY: CurrencyConfig = {
  symbol: "Lek",
  position: "suffix",
  decimals: 2,
};

const PosLocaleContext = createContext<PosLocaleContextType>({
  language: "en",
  currency: DEFAULT_CURRENCY,
  formatPrice: (amount) => `${amount.toFixed(2)} Lek`,
  t: (key) => key,
});

export function usePosLocale() {
  return useContext(PosLocaleContext);
}

// ── Provider ────────────────────────────────────────────

type PosLocaleProviderProps = {
  language: "en" | "sq";
  currencySymbol?: string;
  currencyPosition?: "prefix" | "suffix";
  currencyDecimals?: number;
  children: ReactNode;
};

function PosLocaleInner({
  language,
  currencySymbol = "Lek",
  currencyPosition = "suffix",
  currencyDecimals = 2,
  children,
}: PosLocaleProviderProps) {
  const { i18n, t } = useTranslation("pos");

  // Sync i18next language with the database setting
  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const currency: CurrencyConfig = useMemo(
    () => ({
      symbol: currencySymbol,
      position: currencyPosition,
      decimals: currencyDecimals,
    }),
    [currencySymbol, currencyPosition, currencyDecimals]
  );

  const formatPrice = useCallback(
    (amount: number): string => {
      const formatted = amount.toFixed(currency.decimals);
      if (currency.position === "prefix") {
        return `${currency.symbol}${formatted}`;
      }
      return `${formatted} ${currency.symbol}`;
    },
    [currency]
  );

  const value = useMemo<PosLocaleContextType>(
    () => ({ language, currency, formatPrice, t }),
    [language, currency, formatPrice, t]
  );

  return (
    <PosLocaleContext.Provider value={value}>
      {children}
    </PosLocaleContext.Provider>
  );
}

/** Wraps children with i18next provider and locale context */
export default function PosLocaleProvider(props: PosLocaleProviderProps) {
  return (
    <I18nextProvider i18n={posI18n}>
      <PosLocaleInner {...props} />
    </I18nextProvider>
  );
}
