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

const POS_I18N_GLOBAL_KEY = "__vyntexPosI18n";

type PosI18nGlobal = typeof globalThis & {
  [POS_I18N_GLOBAL_KEY]?: typeof i18n;
};

/**
 * Keep one POS i18n instance across Vite HMR. Storing it on the default
 * i18next singleton is unsafe: site + POS both attach `initReactI18next`,
 * and a locale HMR can make labels fall through to raw keys.
 */
const posI18n =
  (globalThis as PosI18nGlobal)[POS_I18N_GLOBAL_KEY] ?? i18n.createInstance();
(globalThis as PosI18nGlobal)[POS_I18N_GLOBAL_KEY] = posI18n;

function applyPosResources() {
  for (const [lng, bundles] of Object.entries(resources)) {
    for (const [ns, dict] of Object.entries(bundles)) {
      posI18n.addResourceBundle(lng, ns, dict, true, true);
    }
  }
}

function interpolateTemplate(
  template: string,
  options?: Record<string, unknown>,
) {
  if (!options) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const value = options[name];
    return value == null ? `{{${name}}}` : String(value);
  });
}

/** Translate a POS key, with a JSON fallback if HMR detaches i18next. */
export function translatePos(
  key: string,
  options?: Record<string, unknown>,
  lng?: string,
) {
  const language = lng ?? posI18n.language ?? "en";
  const translated = posI18n.t(key, { ns: "pos", lng: language, ...options });
  if (translated && translated !== key) return String(translated);

  const dict = resources[language]?.pos ?? resources.en?.pos;
  const template = dict?.[key];
  return template ? interpolateTemplate(template, options) : key;
}

if (!posI18n.isInitialized) {
  posI18n.use(initReactI18next).init({
    resources,
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "sq"],
    defaultNS: "pos",
    ns: ["pos"],
    // JSON uses flat keys like "nav.dashboard"; default '.' separator would look up nested nav.dashboard
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
} else {
  applyPosResources();
}

if (import.meta.hot) {
  import.meta.hot.accept(
    ["./locales/en/pos.json", "./locales/sq/pos.json"],
    (updatedModules) => {
      const [nextEn, nextSq] = updatedModules as Array<
        { default: Record<string, string> } | undefined
      >;
      if (nextEn?.default) {
        resources.en = { ...(resources.en ?? {}), pos: nextEn.default };
      }
      if (nextSq?.default) {
        resources.sq = { ...(resources.sq ?? {}), pos: nextSq.default };
      }
      applyPosResources();
    },
  );
}

export { resources };
export default posI18n;
