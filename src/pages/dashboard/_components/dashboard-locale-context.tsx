import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  APP_LANGUAGE_EVENT,
  isAppLang,
  setAppLanguageStores,
} from "@/lib/app-language.ts";
import {
  type DashboardLang,
  dashboardT,
  getDashboardLang,
} from "@/lib/dashboard-i18n.ts";
import siteI18n from "@/lib/site-i18n.ts";

type DashboardLocaleContextValue = {
  lang: DashboardLang;
  setLang: (lang: DashboardLang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const DashboardLocaleContext = createContext<DashboardLocaleContextValue | null>(
  null,
);

export function DashboardLocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<DashboardLang>(() => getDashboardLang());

  const setLang = useCallback((next: DashboardLang) => {
    setAppLanguageStores(next);
    void siteI18n.changeLanguage(next);
    setLangState(next);
  }, []);

  useEffect(() => {
    const onAppLanguage = (event: Event) => {
      const next = (event as CustomEvent<{ language?: string }>).detail?.language;
      if (isAppLang(next)) setLangState(next);
    };
    window.addEventListener(APP_LANGUAGE_EVENT, onAppLanguage);
    return () => window.removeEventListener(APP_LANGUAGE_EVENT, onAppLanguage);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      dashboardT(key, lang, vars),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  );

  return (
    <DashboardLocaleContext.Provider value={value}>
      {children}
    </DashboardLocaleContext.Provider>
  );
}

export function useDashboardLocale(): DashboardLocaleContextValue {
  const ctx = useContext(DashboardLocaleContext);
  if (!ctx) {
    throw new Error("useDashboardLocale must be used within DashboardLocaleProvider");
  }
  return ctx;
}
