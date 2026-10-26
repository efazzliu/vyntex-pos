import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import {
  Settings,
  Printer,
  Building2,
  Receipt,
  Wallet,
  UtensilsCrossed,
  Users,
  Percent,
  Bell,
  Plug,
  Shield,
  MonitorSmartphone,
  MonitorCog,
  BadgeCheck,
  ArrowLeft,
  ChevronRight,
  Search,
  X,
  Smartphone,
  Store,
  Package,
  HardDrive,
} from "lucide-react";
import TemplateManager from "./template-manager.tsx";
import SettingsSystemPanel from "./settings-system-panel.tsx";
import SettingsLicensePanel from "./settings-license-panel.tsx";
import SettingsCategoryHub from "./settings-category-hub.tsx";
import SettingsGeneralPanel, {
  type BusinessProfileDraft,
  type GeneralLocaleDraft,
} from "./settings-general-panel.tsx";
import SettingsPaymentPanel from "./settings-payment-panel.tsx";
import SettingsMenuPanel from "./settings-menu-panel.tsx";
import SettingsDevicesPanel from "./settings-devices-panel.tsx";
import SettingsUsersPanel from "./settings-users-panel.tsx";
import SettingsTaxPanel from "./settings-tax-panel.tsx";
import SettingsIntegrationsPanel from "./settings-integrations-panel.tsx";
import SettingsInventoryPanel from "./settings-inventory-panel.tsx";
import SettingsStoragePanel from "./settings-storage-panel.tsx";
import SettingsSecurityPanel from "./settings-security-panel.tsx";
import SettingsCustomerDisplayPanel from "./settings-customer-display-panel.tsx";
import type { PosView } from "../_lib/types.ts";
import {
  type SettingsCategoryId,
  POS_TIMEZONES,
  parseGeneralPrefs,
  readLocalGeneralPrefs,
  writeLocalGeneralPrefs,
  writePaymentManagerRoles,
  type PosGeneralPrefs,
} from "./pos-settings-categories.ts";
import {
  FACTORY_POS_PAYMENT_SETTINGS,
  parsePosPaymentSettings,
  readLocalPaymentSettings,
  writeLocalPaymentSettings,
  type PosPaymentSettings,
} from "@/lib/pos-payment-handling.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  persistPinLoginBranding,
  resolvePinLoginBranding,
} from "@/lib/supabase-pos/license-sync.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

const DEFAULT_PIN_LOGO_PREVIEW = VYNTEX_APP_LOGO_SRC;

async function resizeImageFileToJpegDataUrl(file: File): Promise<string> {
  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("too_large");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("load"));
    el.src = dataUrl;
  });

  const maxDim = 512;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function fileToLogoDataUrl(file: File): Promise<string> {
  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error("too_large");
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  if (isSvg) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  return resizeImageFileToJpegDataUrl(file);
}

type PosSettingsProps = {
  licenseKey: string;
  /** License tier from activation (Supabase `restaurants.plan`). */
  plan: string;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  onNavigate?: (view: PosView) => void;
  staffRole?: string;
  staffId?: string;
  staffName?: string;
  deviceId?: string;
  /** Opens a category directly (e.g. Stock → Inventory & stock rules). `nonce` re-triggers the same category. */
  jumpToCategory?: { category: SettingsCategoryId; nonce: number } | null;
};

const SETTINGS_NAV: {
  id: SettingsCategoryId;
  icon: typeof Settings;
  titleKey: string;
  descKey: string;
  comingSoon?: boolean;
}[] = [
  { id: "general", icon: Building2, titleKey: "settings.cat.general", descKey: "settings.cat.general_desc" },
  { id: "payments", icon: Wallet, titleKey: "settings.cat.payments", descKey: "settings.cat.payments_desc" },
  { id: "menu", icon: UtensilsCrossed, titleKey: "settings.cat.menu", descKey: "settings.cat.menu_desc" },
  { id: "devices", icon: Printer, titleKey: "settings.cat.devices", descKey: "settings.cat.devices_desc" },
  { id: "users", icon: Users, titleKey: "settings.cat.users", descKey: "settings.cat.users_desc" },
  { id: "tax", icon: Percent, titleKey: "settings.cat.tax", descKey: "settings.cat.tax_desc" },
  { id: "notifications", icon: Bell, titleKey: "settings.cat.notifications", descKey: "settings.cat.notifications_desc", comingSoon: true },
  { id: "integrations", icon: Plug, titleKey: "settings.cat.integrations", descKey: "settings.cat.integrations_desc", comingSoon: true },
  { id: "inventory", icon: Package, titleKey: "settings.cat.inventory", descKey: "settings.cat.inventory_desc" },
  { id: "storage", icon: HardDrive, titleKey: "settings.cat.storage", descKey: "settings.cat.storage_desc", comingSoon: true },
  { id: "security", icon: Shield, titleKey: "settings.cat.security", descKey: "settings.cat.security_desc", comingSoon: true },
  { id: "print", icon: Receipt, titleKey: "settings.cat.print", descKey: "settings.cat.print_desc" },
  { id: "customerDisplay", icon: MonitorSmartphone, titleKey: "settings.cat.customer_display", descKey: "settings.cat.customer_display_desc", comingSoon: true },
  { id: "phoneApp", icon: Smartphone, titleKey: "settings.cat.phone_app", descKey: "settings.cat.phone_app_desc", comingSoon: true },
  { id: "other", icon: MonitorCog, titleKey: "settings.cat.other", descKey: "settings.cat.other_desc" },
  { id: "license", icon: BadgeCheck, titleKey: "settings.cat.license", descKey: "settings.cat.license_desc" },
];

export default function PosSettings({
  licenseKey,
  plan,
  theme,
  onThemeChange,
  onNavigate,
  staffRole,
  staffId,
  staffName,
  deviceId,
  jumpToCategory,
}: PosSettingsProps) {
  const { t } = usePosLocale();
  const isAdminStaff = staffRole === "admin";
  const isManagerStaff = staffRole === "manager";
  const canEditBusinessIdentity = isAdminStaff;
  const canEditLanguageCurrency = isAdminStaff;
  const canEditTimezone = isAdminStaff || isManagerStaff;
  const companyQuery = useQuery('pos.settings.getCompanyDetails', { licenseKey });
  const updateLocale = useMutation('pos.settings.updateLocaleSettings');
  const updateCompanyProfile = useMutation('pos.settings.updateCompanyProfile');
  const updateGeneralPrefs = useMutation("pos.settings.updateGeneralPrefs");
  const updatePaymentSettings = useMutation('pos.settings.updatePaymentSettings');

  const [activeCategory, setActiveCategory] =
    useState<SettingsCategoryId | null>(jumpToCategory?.category ?? null);
  useEffect(() => {
    if (jumpToCategory) setActiveCategory(jumpToCategory.category);
  }, [jumpToCategory]);
  const [printEditorOpen, setPrintEditorOpen] = useState(false);
  const [printEditorTitle, setPrintEditorTitle] = useState<string | null>(null);
  const [settingsQuery, setSettingsQuery] = useState("");
  const [settingsSearchOpen, setSettingsSearchOpen] = useState(false);
  const printEditorBackRef = useRef<(() => void) | null>(null);
  const registerEditorBack = useCallback((fn: (() => void) | null) => {
    printEditorBackRef.current = fn;
  }, []);
  const [hubBackArmed, setHubBackArmed] = useState(true);
  useEffect(() => {
    if (printEditorOpen) {
      setHubBackArmed(false);
      return;
    }
    const id = window.setTimeout(() => setHubBackArmed(true), 400);
    return () => window.clearTimeout(id);
  }, [printEditorOpen]);
  const [paymentSettings, setPaymentSettings] = useState<PosPaymentSettings>(() =>
    readLocalPaymentSettings(licenseKey),
  );
  const [paymentDraft, setPaymentDraft] = useState<PosPaymentSettings>(() =>
    readLocalPaymentSettings(licenseKey),
  );
  const [paymentDirty, setPaymentDirty] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const emptyBusinessDraft: BusinessProfileDraft = {
    name: "",
    type: "restaurant",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    postalCode: "",
    country: "",
  };
  const [businessDraft, setBusinessDraft] = useState<BusinessProfileDraft>(emptyBusinessDraft);
  const emptyLocaleDraft: GeneralLocaleDraft = {
    language: "en",
    currencySymbol: "â‚¬",
    timezone: "Europe/Tirane",
  };
  const [localeDraft, setLocaleDraft] = useState<GeneralLocaleDraft>(emptyLocaleDraft);
  const [prefsDraft, setPrefsDraft] = useState<PosGeneralPrefs>(() =>
    readLocalGeneralPrefs(licenseKey),
  );
  const [savingCompany, setSavingCompany] = useState(false);
  const [generalLogoUrl, setGeneralLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const company =
    companyQuery &&
    typeof companyQuery === "object" &&
    !Array.isArray(companyQuery) &&
    "name" in companyQuery
      ? companyQuery
      : {
          name: "Restaurant POS",
          address: "",
          phone: "",
          currency: "EUR",
          plan: "professional",
          licenseStatus: "active",
          licenseExpiry: undefined as string | undefined,
          language: "en",
          timezone: "Europe/Tirane",
          vatNumber: "",
          defaultVatRate: 0.2,
          currencySymbol: "â‚¬",
          currencyPosition: "prefix",
          currencyDecimals: 2,
        };
  const companyTimezone = String(
    (company as { timezone?: string }).timezone || "Europe/Tirane",
  );
  const timezoneOptions = POS_TIMEZONES.includes(
    companyTimezone as (typeof POS_TIMEZONES)[number],
  )
    ? [...POS_TIMEZONES]
    : [companyTimezone, ...POS_TIMEZONES];

  useEffect(() => {
    const fromCloud = (company as { paymentSettings?: unknown }).paymentSettings;
    if (fromCloud) {
      const parsed = parsePosPaymentSettings(fromCloud);
      setPaymentSettings(parsed);
      writeLocalPaymentSettings(licenseKey, parsed);
      if (!paymentDirty) setPaymentDraft(parsed);
      return;
    }
    const local = readLocalPaymentSettings(licenseKey);
    setPaymentSettings(local);
    if (!paymentDirty) setPaymentDraft(local);
  }, [licenseKey, companyQuery, paymentDirty]);

  const companyAsRecord = company as Record<string, unknown>;
  const draftFromCompany = (): BusinessProfileDraft => ({
    name: String(company.name ?? ""),
    type: ["restaurant", "cafe", "bar", "hotel", "fitness"].includes(
      String(companyAsRecord.type ?? "").toLowerCase(),
    )
      ? String(companyAsRecord.type).toLowerCase()
      : "restaurant",
    phone: String(company.phone ?? ""),
    email: String(companyAsRecord.email ?? ""),
    website: String(companyAsRecord.website ?? ""),
    address: String(company.address ?? ""),
    city: String(companyAsRecord.city ?? ""),
    postalCode: String(companyAsRecord.postalCode ?? ""),
    country: String(companyAsRecord.country ?? ""),
  });

  const localeFromCompany = (): GeneralLocaleDraft => ({
    language: String(company.language ?? "en") === "sq" ? "sq" : "en",
    currencySymbol: String(company.currencySymbol ?? "â‚¬") || "â‚¬",
    timezone: companyTimezone,
  });

  const prefsFromCompany = (): PosGeneralPrefs => {
    const cloud = companyAsRecord.generalPrefs;
    if (cloud && typeof cloud === "object" && Object.keys(cloud as object).length > 0) {
      return parseGeneralPrefs(cloud);
    }
    return readLocalGeneralPrefs(licenseKey);
  };

  useEffect(() => {
    if (editingCompany) return;
    setBusinessDraft(draftFromCompany());
    setLocaleDraft(localeFromCompany());
    setPrefsDraft(prefsFromCompany());
  }, [editingCompany, companyQuery, licenseKey]);

  useEffect(() => {
    let cancelled = false;
    void resolvePinLoginBranding(licenseKey).then((branding) => {
      if (!cancelled) setGeneralLogoUrl(branding.logoDataUrl ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [licenseKey]);

  const resetGeneralDrafts = () => {
    setBusinessDraft(draftFromCompany());
    setLocaleDraft(localeFromCompany());
    setPrefsDraft(prefsFromCompany());
    setEditingCompany(false);
  };

  const saveCompany = async () => {
    if (
      !canEditBusinessIdentity &&
      !canEditLanguageCurrency &&
      !canEditTimezone
    ) {
      toast.error(t("settings.admin_only_identity"));
      return;
    }
    if (canEditBusinessIdentity) {
      const name = businessDraft.name.trim();
      if (!name) {
        toast.error(t("settings.company_name_required"));
        return;
      }
    }
    setSavingCompany(true);
    try {
      if (canEditBusinessIdentity) {
        await updateCompanyProfile({
          licenseKey,
          name: businessDraft.name.trim(),
          address: businessDraft.address,
          phone: businessDraft.phone,
          email: businessDraft.email,
          website: businessDraft.website,
          city: businessDraft.city,
          postalCode: businessDraft.postalCode,
          country: businessDraft.country,
        });
        writeLocalGeneralPrefs(licenseKey, prefsDraft);
        await updateGeneralPrefs({ licenseKey, prefs: prefsDraft });
      }
      if (canEditLanguageCurrency || canEditTimezone) {
        await updateLocale({
          licenseKey,
          ...(canEditLanguageCurrency
            ? {
                language: localeDraft.language === "sq" ? "sq" : "en",
                currencySymbol: localeDraft.currencySymbol,
              }
            : {}),
          ...(canEditTimezone ? { timezone: localeDraft.timezone } : {}),
        });
      }
      toast.success(t("settings.saved"));
      setEditingCompany(false);
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setSavingCompany(false);
    }
  };

  const saveGeneralLogo = async (logoDataUrl: string | null) => {
    setLogoBusy(true);
    try {
      const current = await resolvePinLoginBranding(licenseKey);
      const next = { ...current, logoDataUrl };
      await persistPinLoginBranding(licenseKey, next);
      setGeneralLogoUrl(logoDataUrl);
      toast.success(t("settings.pin_logo_saved"));
    } catch {
      toast.error(t("settings.save_failed"));
    } finally {
      setLogoBusy(false);
    }
  };

  const onPickGeneralLogo = async (file: File) => {
    if (!canEditBusinessIdentity) {
      toast.error(t("settings.admin_only_identity"));
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/i.test(file.type) && !/\.svg$/i.test(file.name)) {
      toast.error(t("settings.pin_logo_invalid"));
      return;
    }
    setLogoBusy(true);
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      await saveGeneralLogo(dataUrl);
    } catch (err) {
      setLogoBusy(false);
      if (err instanceof Error && err.message === "too_large") {
        toast.error(t("settings.pin_logo_invalid"));
      } else {
        toast.error(t("settings.pin_logo_read_error"));
      }
    }
  };

  const savePaymentSettings = async (next: PosPaymentSettings) => {
    if (staffRole === "waiter") {
      toast.error(t("settings.payment_waiter_blocked"));
      return;
    }
    const parsed = parsePosPaymentSettings(next);
    const normalized: PosPaymentSettings = {
      ...parsed,
      allowSplitBill: isAdminStaff
        ? parsed.allowSplitBill
        : paymentSettings.allowSplitBill,
      allowRefund: isAdminStaff
        ? parsed.allowRefund
        : paymentSettings.allowRefund,
    };
    setPaymentSettings(normalized);
    writeLocalPaymentSettings(licenseKey, normalized);
    writePaymentManagerRoles(licenseKey, normalized.counterRoles);
    setSavingPayment(true);
    try {
      await updatePaymentSettings({
        licenseKey,
        handling: normalized.handling,
        manager: normalized.counterRoles.manager,
        waiter: normalized.counterRoles.waiter,
        methods: normalized.methods,
        channels: normalized.channels,
        roleMethods: normalized.roleMethods,
        allowSplitBill: normalized.allowSplitBill,
        allowRefund: normalized.allowRefund,
      });
      setPaymentDirty(false);
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setSavingPayment(false);
    }
  };

  const hasPhoneApp =
    Boolean(companyQuery) &&
    (company as { mobileAccessEnabled?: boolean }).mobileAccessEnabled !== false;
  const visibleSettingsNav = useMemo(
    () =>
      SETTINGS_NAV.filter((item) => {
        if (item.id === "payments" && staffRole === "waiter") return false;
        if (item.id === "phoneApp" && !hasPhoneApp) return false;
        return true;
      }),
    [staffRole, hasPhoneApp],
  );
  const activeNav =
    activeCategory == null
      ? null
      : (visibleSettingsNav.find((c) => c.id === activeCategory) ?? null);
  const ActiveIcon = activeNav?.icon;
  const settingsSearchResults = useMemo(() => {
    const q = settingsQuery.trim().toLowerCase();
    if (!q) return [];
    return visibleSettingsNav.filter((item) => {
      const title = t(item.titleKey).toLowerCase();
      const desc = t(item.descKey).toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [settingsQuery, visibleSettingsNav, t]);

  useEffect(() => {
    if (staffRole === "waiter" && activeCategory === "payments") {
      setActiveCategory(null);
    }
    if (
      activeCategory === "phoneApp" ||
      activeCategory === "notifications" ||
      activeCategory === "integrations" ||
      activeCategory === "storage" ||
      activeCategory === "security" ||
      activeCategory === "customerDisplay"
    ) {
      setActiveCategory(null);
    }
  }, [staffRole, activeCategory, hasPhoneApp]);

  if (activeCategory == null || !activeNav || !ActiveIcon) {
    return (
      <SettingsCategoryHub
        items={visibleSettingsNav}
        t={t}
        onSelect={setActiveCategory}
      />
    );
  }

  const goSettingsHub = () => {
    if (!hubBackArmed) return;
    setActiveCategory(null);
  };
  const goSettingsBack = () => {
    if (printEditorOpen && printEditorBackRef.current) {
      printEditorBackRef.current();
      return;
    }
    goSettingsHub();
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6">
        <div className="flex h-9 min-w-0 items-center gap-3">
          <button
            type="button"
            disabled={!hubBackArmed && !printEditorOpen}
            onClick={goSettingsBack}
            className="inline-flex shrink-0 items-center text-[#8b93a7] transition-colors hover:text-white cursor-pointer disabled:pointer-events-none"
          >
            <span className="flex size-9 items-center justify-center rounded-full border border-[#1e2a45] bg-[#131A2E] transition-colors hover:border-brand/40">
              <ArrowLeft className="size-4" />
            </span>
          </button>
          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            <button
              type="button"
              onClick={goSettingsHub}
              className="shrink-0 font-medium text-[#8b93a7] transition-colors hover:text-white cursor-pointer"
            >
              {t("nav.settings")}
            </button>
            <ChevronRight className="size-3.5 shrink-0 text-[#8b93a7]" />
            {printEditorTitle ? (
              <>
                <button
                  type="button"
                  onClick={() => printEditorBackRef.current?.()}
                  className="min-w-0 truncate font-medium text-[#8b93a7] transition-colors hover:text-white cursor-pointer"
                >
                  {t(activeNav.titleKey)}
                </button>
                <ChevronRight className="size-3.5 shrink-0 text-[#8b93a7]" />
                <span className="min-w-0 truncate font-semibold text-white">
                  {printEditorTitle}
                </span>
              </>
            ) : (
              <span className="min-w-0 truncate font-semibold text-white">
                {t(activeNav.titleKey)}
              </span>
            )}
          </nav>
          <div className="relative ml-auto w-[17.5rem] shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#8b93a7]" />
            <input
              value={settingsQuery}
              onChange={(e) => {
                setSettingsQuery(e.target.value);
                setSettingsSearchOpen(true);
              }}
              onFocus={() => setSettingsSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSettingsSearchOpen(false), 120)}
              placeholder={t("settings.search_ph")}
              className="h-9 w-full rounded-full border border-[#1e2a45] bg-[#131A2E] pl-9 pr-8 text-[12px] text-white outline-none placeholder:text-[#5a6580] transition focus:border-brand/50"
            />
            {settingsQuery ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSettingsQuery("");
                  setSettingsSearchOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b93a7] transition hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
            {settingsSearchOpen && settingsQuery.trim() ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-2xl border border-[#1e2a45] bg-[#131A2E] py-1 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.65)]">
                {settingsSearchResults.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-[#8b93a7]">
                    {t("settings.search_empty")}
                  </p>
                ) : (
                  settingsSearchResults.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          if (item.comingSoon) return;
                          setPrintEditorOpen(false);
                          setPrintEditorTitle(null);
                          setActiveCategory(item.id);
                          setSettingsQuery("");
                          setSettingsSearchOpen(false);
                        }}
                        disabled={item.comingSoon}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#1e2a45]/70",
                          item.comingSoon && "cursor-default opacity-60 hover:bg-transparent",
                        )}
                      >
                        <Icon className="size-3.5 shrink-0 text-[#8b93a7]" />
                        <span className="truncate text-[12px] font-medium text-white">
                          {t(item.titleKey)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div
        className={
          printEditorOpen
            ? "mt-5 min-h-0 flex-1 overflow-hidden px-6 pb-6"
            : "mt-5 min-h-0 flex-1 overflow-auto px-6 pb-6"
        }
      >
        {activeCategory === "print" ? (
          <div className={printEditorOpen ? "h-full min-h-0 overflow-hidden" : undefined}>
            <TemplateManager
              licenseKey={licenseKey}
              onEditingChange={setPrintEditorOpen}
              onEditorTitle={setPrintEditorTitle}
              registerEditorBack={registerEditorBack}
              onOpenDevices={() => setActiveCategory("devices")}
            />
          </div>
        ) : null}

        {activeCategory === "general" ? (
          <SettingsGeneralPanel
            t={t}
            locale={localeDraft}
            timezoneOptions={timezoneOptions}
            isAdminStaff={isAdminStaff}
            canEditBusinessIdentity={canEditBusinessIdentity}
            canEditLanguageCurrency={canEditLanguageCurrency}
            canEditTimezone={canEditTimezone}
            savingCompany={savingCompany}
            draft={businessDraft}
            prefs={prefsDraft}
            onDraftChange={(field, value) => {
              setEditingCompany(true);
              setBusinessDraft((prev) => ({ ...prev, [field]: value }));
            }}
            onPrefsChange={(patch) => {
              setEditingCompany(true);
              setPrefsDraft((prev) => ({ ...prev, ...patch }));
            }}
            onLocaleChange={(field, value) => {
              setEditingCompany(true);
              setLocaleDraft((prev) => ({ ...prev, [field]: value }));
            }}
            onCancelEdit={resetGeneralDrafts}
            onSaveCompany={() => void saveCompany()}
            logoPreviewSrc={generalLogoUrl ?? DEFAULT_PIN_LOGO_PREVIEW}
            logoHasCustom={Boolean(generalLogoUrl)}
            logoBusy={logoBusy}
            onPickLogo={(file) => void onPickGeneralLogo(file)}
            onRemoveLogo={() => void saveGeneralLogo(null)}
          />
        ) : null}

        {activeCategory === "payments" ? (
          staffRole === "waiter" ? (
            <p className="text-sm text-amber-400/90">
              {t("settings.payment_waiter_blocked")}
            </p>
          ) : (
          <SettingsPaymentPanel
            t={t}
            settings={paymentDraft}
            saving={savingPayment}
            isAdmin={isAdminStaff}
            hasPhoneApp={hasPhoneApp}
            onChange={(next) => {
              setPaymentDirty(true);
              setPaymentDraft(parsePosPaymentSettings(next));
            }}
            onReset={() => {
              setPaymentDirty(true);
              setPaymentDraft(parsePosPaymentSettings(FACTORY_POS_PAYMENT_SETTINGS));
            }}
            onSave={() => void savePaymentSettings(paymentDraft)}
          />
          )
        ) : null}

        {activeCategory === "menu" ? (
          <SettingsMenuPanel t={t} onOpenMenu={() => onNavigate?.("menu")} />
        ) : null}

        {activeCategory === "users" ? (
          <SettingsUsersPanel
            t={t}
            licenseKey={licenseKey}
            plan={plan}
            actorStaffId={staffId}
            actorStaffName={staffName}
            deviceId={deviceId}
            isAdmin={isAdminStaff}
            canManageSessions={isAdminStaff || isManagerStaff}
          />
        ) : null}

        {activeCategory === "tax" ? (
          <SettingsTaxPanel
            t={t}
            licenseKey={licenseKey}
            isAdmin={isAdminStaff}
            country={String(companyAsRecord.country ?? businessDraft.country ?? "")}
            businessType={String(companyAsRecord.type ?? businessDraft.type ?? "restaurant")}
            vatNumber={String((company as { vatNumber?: string }).vatNumber ?? "")}
            defaultVatRate={
              Number.isFinite(Number((company as { defaultVatRate?: number }).defaultVatRate))
                ? Number((company as { defaultVatRate?: number }).defaultVatRate)
                : 0.2
            }
            taxSettingsRaw={(company as { taxSettings?: unknown }).taxSettings}
            onOpenMenu={() => onNavigate?.("menu")}
            onOpenGeneral={() => setActiveCategory("general")}
          />
        ) : null}

        {activeCategory === "notifications" ? (
          <CategoryPlaceholder description={t("settings.cat.notifications_desc")} />
        ) : null}
        {activeCategory === "integrations" ? (
          <SettingsIntegrationsPanel t={t} />
        ) : null}
        {activeCategory === "inventory" ? (
          <SettingsInventoryPanel
            t={t}
            licenseKey={licenseKey}
            isAdmin={isAdminStaff}
            onOpenStock={() => onNavigate?.("stock")}
          />
        ) : null}
        {activeCategory === "storage" ? (
          <SettingsStoragePanel t={t} licenseKey={licenseKey} />
        ) : null}
        {activeCategory === "security" ? (
          <SettingsSecurityPanel
            t={t}
            licenseKey={licenseKey}
            staffId={staffId}
            staffName={staffName}
            deviceId={deviceId}
            isAdmin={isAdminStaff}
            canManageSessions={isAdminStaff || isManagerStaff}
            onOpenAuditLog={() => onNavigate?.("audit-log")}
          />
        ) : null}
        {activeCategory === "customerDisplay" ? (
          <SettingsCustomerDisplayPanel
            t={t}
            licenseKey={licenseKey}
            staffId={staffId}
            isAdmin={isAdminStaff}
            venueName={typeof company?.name === "string" ? company.name : ""}
          />
        ) : null}

        {activeCategory === "other" ? (
          <SettingsSystemPanel
            t={t}
            theme={theme}
            onThemeChange={onThemeChange}
          />
        ) : null}

        {activeCategory === "license" ? (
          <SettingsLicensePanel t={t} licenseKey={licenseKey} />
        ) : null}

        {activeCategory === "devices" ? (
          <SettingsDevicesPanel
            t={t}
            licenseKey={licenseKey}
            onOpenPrintLayout={() => setActiveCategory("print")}
          />
        ) : null}
      </div>
    </div>
  );
}

function CategoryPlaceholder({ description }: { description: string }) {
  const { t } = usePosLocale();
  return (
    <section className="rounded-xl border border-[#1e2a45] bg-[#0D1326] p-8 space-y-2">
      <p className="text-sm text-[#8b93a7] leading-relaxed">{description}</p>
      <p className="text-xs text-[#5a6580]">{t("settings.cat_coming_soon")}</p>
    </section>
  );
}

// â”€â”€ Setting Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#131A2E]/60 border border-[#1e2a45]/50 flex-wrap gap-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description ? (
          <p className="text-xs text-[#5a6580] mt-0.5">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
