import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type DashboardLang,
  dashboardT,
  getDashboardLang,
  setDashboardLang,
} from "@/lib/dashboard-i18n.ts";

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
    setDashboardLang(next);
    setLangState(next);
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
