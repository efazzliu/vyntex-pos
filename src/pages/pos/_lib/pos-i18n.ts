import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Eagerly import all POS translation files
const translationModules = import.meta.glob<{
  default: Record<string, string>;
}>("./locales/*/*.json", { eager: true });

// Build resources object from imported modules
const resources: Record<string, Record<string, Record<string, string>>> = {};

for (const [path, module] of Object.entries(translationModules)) {
  // Vite may use `\` on Windows; glob keys must still map to `locales/<lng>/<ns>.json`.
  const posix = path.replace(/\\/g, "/");
  const match = posix.match(/locales\/([^/]+)\/([^/]+)\.json$/);
  if (match) {
    const [, lng, ns] = match;
    if (!resources[lng]) resources[lng] = {};
    resources[lng][ns] = module.default;
  }
}

// Create a separate i18n instance for POS (doesn't interfere with main app)
const posI18n = i18n.createInstance();

posI18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "sq"],
  defaultNS: "pos",
  // JSON uses flat keys like "nav.dashboard"; default '.' separator would look up nested nav.dashboard
  keySeparator: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default posI18n;
