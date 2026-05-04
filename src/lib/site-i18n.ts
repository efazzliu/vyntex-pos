import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const SITE_LOCALE_STORAGE_KEY = "vyntex.site.locale";

const translationModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./site-locales/*/*.json",
  { eager: true },
);

const resources: Record<string, Record<string, Record<string, unknown>>> = {};

for (const [path, module] of Object.entries(translationModules)) {
  const match = path.match(/\.\/site-locales\/([^/]+)\/([^/]+)\.json$/);
  if (match) {
    const [, lng, ns] = match;
    if (!resources[lng]) resources[lng] = {};
    resources[lng][ns] = module.default;
  }
}

function readInitialLng(): string {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(SITE_LOCALE_STORAGE_KEY) === "sq" ? "sq" : "en";
}

const siteI18n = i18n.createInstance();

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

export default siteI18n;
