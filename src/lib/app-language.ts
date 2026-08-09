import { SITE_LOCALE_STORAGE_KEY } from "@/lib/site-i18n.ts";

export type AppLang = "en" | "sq";

/** Fired whenever the shared app language changes (site, dashboard, admin). */
export const APP_LANGUAGE_EVENT = "vyntex:app-language";

const DASHBOARD_LOCALE_STORAGE_KEY = "vyntex.dashboard.locale";
const ADMIN_LANG_STORAGE_KEY = "vyntex-admin-lang";

export function isAppLang(value: unknown): value is AppLang {
  return value === "en" || value === "sq";
}

/** Persist language for every product surface and notify listeners. */
export function setAppLanguageStores(lng: AppLang) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SITE_LOCALE_STORAGE_KEY, lng);
  localStorage.setItem(DASHBOARD_LOCALE_STORAGE_KEY, lng);
  localStorage.setItem(ADMIN_LANG_STORAGE_KEY, lng);
  document.documentElement.lang = lng === "sq" ? "sq" : "en";
  window.dispatchEvent(
    new CustomEvent(APP_LANGUAGE_EVENT, { detail: { language: lng } }),
  );
}
