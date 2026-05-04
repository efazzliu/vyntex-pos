export type DashboardLang = "en" | "sq";

const STORAGE_KEY = "vyntex.dashboard.locale";

export function getDashboardLang(): DashboardLang {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "sq" || stored === "en") return stored;
  if (navigator.language.toLowerCase().startsWith("sq")) return "sq";
  return "en";
}

export function setDashboardLang(lang: DashboardLang): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, String(v));
  }
  return out;
}

const DICT: Record<DashboardLang, Record<string, string>> = {
  en: {
    "layout.brand": "Vyntex POS",
    "layout.active_license": "Active license",
    "layout.lang_toggle": "Language",
    "nav.restaurant_pos": "Restaurant POS",
    "nav.licenses": "Licenses",
    "nav.downloads": "Downloads",
    "nav.billing": "Billing",
    "nav.team_access": "Team access",
    "nav.business_settings": "Business settings",
    "nav.security": "Security",
    "nav.support": "Support",
    "nav.quick_links": "Quick links",
    "nav.website": "Website",
    "nav.sign_out": "Sign out",
    "nav.admin_panel": "Admin panel",
    "nav.license_expired": "License expired",
    "header.back_website": "Back to website",
    "header.site": "Site",
    "header.lang_en": "EN",
    "header.lang_sq": "SQ",
    "header.lang_click_toggle": "Click to switch language",
    "nav.profile_aria": "Open profile settings",
    "nav.menu_aria": "Open navigation menu",
    "overview.eyebrow": "License overview",
    "overview.title": "Vyntex POS Dashboard",
    "overview.subtitle":
      "Manage your plan, copy your license key, and install the correct Windows build — in one place.",
    "stat.license_type": "License type",
    "stat.plan": "Plan",
    "stat.days_remaining": "Days remaining",
    "stat.days_value": "{{count}} days",
    "venue.active": "Active",
    "venue.label": "Active venue",
    "venue.expires": "Expires on",
    "venue.license_key": "License key",
    "install.title": "Install software",
    "install.win_x64": "Windows — 64-bit (Intel / AMD)",
    "install.win_x64_hint": "Recommended for most PCs",
    "install.win_arm": "Windows — ARM64",
    "install.win_arm_hint": "Surface / Snapdragon devices",
    "install.app_version": "App v{{version}}",
    "install.file_label": "Installer file",
    "install.file_hint":
      "Add public/VyntexPOSSetup.exe to show the installer build time on this line.",
    "action.business": "Business settings",
    "action.business_desc": "Profile, billing and preferences",
    "action.support": "Support",
    "action.support_desc": "Activation, installer, and billing help",
    "toast.license_copied": "License key copied",
    "toast.copy_failed": "Could not copy. Please copy manually.",
    "toast.download_started": "Download started",
    "type.restaurant": "Restaurant POS",
    "type.cafe": "Coffee POS",
    "type.bar": "Bar POS",
    "type.hotel": "Hotel POS",
    "type.fitness": "Fitness POS",
    "plan.starter": "Starter",
    "plan.professional": "Professional",
    "plan.enterprise": "Enterprise",
  },
  sq: {
    "layout.brand": "Vyntex POS",
    "layout.active_license": "Licenca aktive",
    "layout.lang_toggle": "Gjuha",
    "nav.restaurant_pos": "POS restoranti",
    "nav.licenses": "Licencat",
    "nav.downloads": "Shkarkime",
    "nav.billing": "Faturimi",
    "nav.team_access": "Qasja e ekipit",
    "nav.business_settings": "Cilësimet e biznesit",
    "nav.security": "Siguria",
    "nav.support": "Suporti",
    "nav.quick_links": "Lidhje të shpejta",
    "nav.website": "Faqja",
    "nav.sign_out": "Dilni",
    "nav.admin_panel": "Paneli admin",
    "nav.license_expired": "Licenca ka skaduar",
    "header.back_website": "Kthehu në faqe",
    "header.site": "Faqja",
    "header.lang_en": "EN",
    "header.lang_sq": "SQ",
    "header.lang_click_toggle": "Kliko për të ndërruar gjuhën",
    "nav.profile_aria": "Hap cilësimet e profilit",
    "nav.menu_aria": "Hap menynë e navigimit",
    "overview.eyebrow": "Përmbledhje licence",
    "overview.title": "Paneli Vyntex POS",
    "overview.subtitle":
      "Menaxho planin, kopjo çelësin e licencës dhe instalo versionin e duhur të Windows — në një vend.",
    "stat.license_type": "Lloji i licencës",
    "stat.plan": "Plani",
    "stat.days_remaining": "Ditë të mbetura",
    "stat.days_value": "{{count}} ditë",
    "venue.active": "Aktive",
    "venue.label": "Lokali aktiv",
    "venue.expires": "Skadon më",
    "venue.license_key": "Çelësi i licencës",
    "install.title": "Instalo programin",
    "install.win_x64": "Windows — 64-bit (Intel / AMD)",
    "install.win_x64_hint": "Rekomandohet për shumicën e kompjuterave",
    "install.win_arm": "Windows — ARM64",
    "install.win_arm_hint": "Surface / Snapdragon",
    "install.app_version": "Aplikacioni v{{version}}",
    "install.file_label": "Skedari i instaluesit",
    "install.file_hint":
      "Shtoni public/VyntexPOSSetup.exe për të shfaqur kohën e build-it të instaluesit.",
    "action.business": "Cilësimet e biznesit",
    "action.business_desc": "Profili, faturimi dhe preferencat",
    "action.support": "Suporti",
    "action.support_desc": "Aktivizimi, instaluesi dhe ndihmë me faturimin",
    "toast.license_copied": "Çelësi u kopjua",
    "toast.copy_failed": "Nuk u kopjua. Kopjojeni manualisht.",
    "toast.download_started": "Shkarkimi filloi",
    "type.restaurant": "POS për restorant",
    "type.cafe": "POS për kafe",
    "type.bar": "POS për bar",
    "type.hotel": "POS për hotel",
    "type.fitness": "POS për fitness",
    "plan.starter": "Fillestar",
    "plan.professional": "Profesional",
    "plan.enterprise": "Enterprise",
  },
};

export function dashboardT(
  key: string,
  lang: DashboardLang,
  vars?: Record<string, string | number>,
): string {
  const raw = DICT[lang][key] ?? DICT.en[key] ?? key;
  return interpolate(raw, vars);
}

export function dashboardTypeLabel(type: string, lang: DashboardLang): string {
  return dashboardT(`type.${type}`, lang) || type;
}

export function dashboardPlanLabel(plan: string, lang: DashboardLang): string {
  return dashboardT(`plan.${plan}`, lang) || plan;
}

export function dashboardDateLocale(lang: DashboardLang): string {
  return lang === "sq" ? "sq-AL" : "en-US";
}
