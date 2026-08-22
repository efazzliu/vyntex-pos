import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enSite from "./site-locales/en/site.json";
import sqSite from "./site-locales/sq/site.json";

export const SITE_LOCALE_STORAGE_KEY = "vyntex.site.locale";

const resources = {
  en: { site: enSite as Record<string, unknown> },
  sq: { site: sqSite as Record<string, unknown> },
};

function readInitialLng(): string {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(SITE_LOCALE_STORAGE_KEY) === "sq" ? "sq" : "en";
}

const globalI18n = i18n as typeof i18n & { __vyntexSite?: typeof i18n };
const siteI18n = globalI18n.__vyntexSite ?? i18n.createInstance();
globalI18n.__vyntexSite = siteI18n;

function applySiteResources() {
  siteI18n.addResourceBundle("en", "site", resources.en.site, true, true);
  siteI18n.addResourceBundle("sq", "site", resources.sq.site, true, true);
}

if (!siteI18n.isInitialized) {
  siteI18n.use(initReactI18next).init({
    resources,
    lng: readInitialLng(),
    fallbackLng: "en",
    supportedLngs: ["en", "sq"],
    defaultNS: "site",
    ns: ["site"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
} else {
  applySiteResources();
}

if (import.meta.hot) {
  import.meta.hot.accept(
    ["./site-locales/en/site.json", "./site-locales/sq/site.json"],
    () => {
      applySiteResources();
    },
  );
}

export default siteI18n;
