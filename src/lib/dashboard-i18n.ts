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
    "nav.restaurant_pos": "Dashboard",
    "nav.licenses": "Licenses",
    "nav.downloads": "Downloads",
    "nav.billing": "Billing",
    "nav.team_access": "Team access",
    "nav.team": "Team",
    "nav.devices": "Devices",
    "nav.settings": "Settings",
    "nav.business": "Business",
    "nav.license": "License",
    "nav.business_settings": "Business settings",
    "nav.security": "Security",
    "nav.support": "Support",
    "nav.help_center": "Help Center",
    "nav.contact_support": "Contact Support",
    "nav.support_direct": "Support",
    "nav.system_status": "System Status",
    "nav.section_main": "Main",
    "nav.section_management": "Management",
    "nav.section_business": "Business",
    "nav.section_subscription": "Subscription",
    "nav.section_support": "Support",
    "nav.quick_links": "Quick links",
    "nav.website": "Website",
    "nav.sign_out": "Sign out",
    "nav.admin_panel": "Admin panel",
    "nav.license_expired": "License expired",
    "license_expired.banner_title": "Your license has expired",
    "license_expired.banner_line1": "Ended on {{date}}.",
    "license_expired.banner_line2":
      "This website stays available so you can renew, open Billing, and copy your license key. The Windows POS program is blocked until the license is active again — it does not use this web login.",
    "license_expired.link_billing": "Billing",
    "license_expired.link_licenses": "Licenses",
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
    "venue.address": "Address",
    "venue.devices": "Active devices",
    "venue.devices_value": "{{active}} / {{max}}",
    "venue.last_sync": "Last sync",
    "venue.last_sync_never": "Not synced yet — open POS on a terminal with internet",
    "venue.cloud_hint":
      "Your menu, staff, and orders live in the cloud. Install POS on a new PC, enter the same license key, and sign in with your staff PIN.",
    "devices.title": "Devices connected",
    "devices.subtitle": "Terminals using this license",
    "setup.title": "Setup checklist",
    "setup.percent": "{{percent}}% complete",
    "setup.install": "Download & install app",
    "setup.activate": "Activate your license on a terminal",
    "setup.printer": "Connect a printer",
    "setup.tables": "Configure tables",
    "setup.products": "Add products to the menu",
    "activity.title": "Recent activity",
    "activity.empty": "No activity logged yet. Events appear when staff use POS.",
    "activity.just_now": "Just now",
    "install.tab_windows": "Windows",
    "install.tab_mac": "macOS",
    "install.tab_android": "Android",
    "install.tab_mac_soon": "Coming soon",
    "install.tab_android_soon": "Coming soon",
    "install.title": "Restaurant POS Setup",
    "install.subtitle": "Official Windows installer for Vyntex Restaurant POS",
    "install.win_x64": "Download Restaurant POS Setup",
    "install.win_x64_hint": "Windows 64-bit (Intel / AMD) — recommended for most PCs",
    "install.win_arm": "Restaurant POS Setup (ARM64)",
    "install.win_arm_hint": "Windows ARM64 — Surface / Snapdragon devices",
    "install.app_version": "App v{{version}}",
    "install.file_label": "Installer",
    "install.file_name": "RestaurantPOSSetup.exe",
    "install.file_hint":
      "Add public/RestaurantPOSSetup.exe to show the installer build time on this line.",
    "action.business": "Business settings",
    "action.business_desc": "Profile, billing and preferences",
    "action.support": "Support",
    "action.support_desc": "Activation, installer, and billing help",
    "toast.license_copied": "License key copied",
    "toast.copy_failed": "Could not copy. Please copy manually.",
    "toast.download_started": "Restaurant POS Setup download started",
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
    "nav.restaurant_pos": "Dashboard",
    "nav.licenses": "Licencat",
    "nav.downloads": "Shkarkime",
    "nav.billing": "Faturimi",
    "nav.team_access": "Qasja e ekipit",
    "nav.team": "Ekipi",
    "nav.devices": "Pajisjet",
    "nav.settings": "Cilësimet",
    "nav.business": "Biznesi",
    "nav.license": "Licenca",
    "nav.business_settings": "Cilësimet e biznesit",
    "nav.security": "Siguria",
    "nav.support": "Suporti",
    "nav.help_center": "Qendra e ndihmës",
    "nav.contact_support": "Kontakto suportin",
    "nav.support_direct": "Suporti",
    "nav.system_status": "Statusi i sistemit",
    "nav.section_main": "Kryesore",
    "nav.section_management": "Menaxhim",
    "nav.section_business": "Biznes",
    "nav.section_subscription": "Abonimi",
    "nav.section_support": "Suport",
    "nav.quick_links": "Lidhje të shpejta",
    "nav.website": "Faqja",
    "nav.sign_out": "Dilni",
    "nav.admin_panel": "Paneli admin",
    "nav.license_expired": "Licenca ka skaduar",
    "license_expired.banner_title": "Licenca ka skaduar",
    "license_expired.banner_line1": "Mbaroi më {{date}}.",
    "license_expired.banner_line2":
      "Kjo faqe në web mbetet e hapur për të rinovuar, për Faturimin dhe për të kopjuar çelësin e licencës. Programi POS për Windows mbetet i bllokuar derisa licenca të jetë përsëri aktive — ai nuk përdor kyçjen e web-it.",
    "license_expired.link_billing": "Faturimi",
    "license_expired.link_licenses": "Licencat",
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
    "venue.address": "Adresa",
    "venue.devices": "Pajisje aktive",
    "venue.devices_value": "{{active}} / {{max}}",
    "venue.last_sync": "Sinkronizimi i fundit",
    "venue.last_sync_never":
      "Ende pa sinkronizuar — hap POS-in në një terminal me internet",
    "venue.cloud_hint":
      "Menuja, stafi dhe porositë janë në cloud. Në PC të ri: instalo, fut të njëjtën licencë dhe hyr me PIN-in e stafit.",
    "devices.title": "Pajisje të lidhura",
    "devices.subtitle": "Terminale me këtë licencë",
    "setup.title": "Lista e konfigurimit",
    "setup.percent": "{{percent}}% e përfunduar",
    "setup.install": "Shkarko dhe instalo aplikacionin",
    "setup.activate": "Aktivizo licencën në një terminal",
    "setup.printer": "Lidh printerin",
    "setup.tables": "Konfiguro tavolinat",
    "setup.products": "Shto produkte në menu",
    "activity.title": "Aktiviteti i fundit",
    "activity.empty": "Ende pa aktivitet. Ngjarjet shfaqen kur stafi përdor POS-in.",
    "activity.just_now": "Tani",
    "install.tab_windows": "Windows",
    "install.tab_mac": "macOS",
    "install.tab_android": "Android",
    "install.tab_mac_soon": "Së shpejti",
    "install.tab_android_soon": "Së shpejti",
    "install.title": "Restaurant POS Setup",
    "install.subtitle": "Instaluesi zyrtar Windows për Vyntex Restaurant POS",
    "install.win_x64": "Shkarko Restaurant POS Setup",
    "install.win_x64_hint": "Windows 64-bit (Intel / AMD) — rekomandohet për shumicën e PC-ve",
    "install.win_arm": "Restaurant POS Setup (ARM64)",
    "install.win_arm_hint": "Windows ARM64 — Surface / Snapdragon",
    "install.app_version": "Aplikacioni v{{version}}",
    "install.file_label": "Instaluesi",
    "install.file_name": "RestaurantPOSSetup.exe",
    "install.file_hint":
      "Shtoni public/RestaurantPOSSetup.exe për të shfaqur kohën e build-it të instaluesit.",
    "action.business": "Cilësimet e biznesit",
    "action.business_desc": "Profili, faturimi dhe preferencat",
    "action.support": "Suporti",
    "action.support_desc": "Aktivizimi, instaluesi dhe ndihmë me faturimin",
    "toast.license_copied": "Çelësi u kopjua",
    "toast.copy_failed": "Nuk u kopjua. Kopjojeni manualisht.",
    "toast.download_started": "Shkarkimi i Restaurant POS Setup filloi",
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
