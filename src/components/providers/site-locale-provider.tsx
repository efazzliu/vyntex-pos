import { useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { setAppLanguageStores } from "@/lib/app-language.ts";
import siteI18n from "@/lib/site-i18n.ts";

export function SiteLocaleProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = (lng: string) => {
      document.documentElement.lang = lng.startsWith("sq") ? "sq" : "en";
    };
    apply(siteI18n.language);
    siteI18n.on("languageChanged", apply);
    return () => {
      siteI18n.off("languageChanged", apply);
    };
  }, []);

  return <I18nextProvider i18n={siteI18n}>{children}</I18nextProvider>;
}

export function useSiteLanguage() {
  const { i18n } = useTranslation("site");
  const language = i18n.language.startsWith("sq") ? "sq" : "en";

  const setLanguage = (lng: "en" | "sq") => {
    void i18n.changeLanguage(lng);
    setAppLanguageStores(lng);
  };

  return { language, setLanguage };
}
