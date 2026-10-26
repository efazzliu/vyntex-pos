import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils.ts";
import { FlagAL, FlagUS } from "@/components/flag-icons.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Bike,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Coffee,
  Dumbbell,
  Globe,
  Hash,
  Hotel,
  ImageIcon,
  Info,
  Languages,
  Link2,
  Lock,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { PosGeneralPrefs } from "./pos-settings-categories.ts";

export type GeneralCompany = {
  name: string;
  type?: string;
  address: string;
  phone: string;
  email?: string;
  website?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  currency: string;
  plan: string;
  licenseStatus: string;
  licenseExpiry?: string;
  language: string;
  timezone?: string;
  currencySymbol: string;
  currencyPosition: string;
  currencyDecimals: number;
};

export type BusinessProfileDraft = {
  name: string;
  type: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};

export type GeneralLocaleDraft = {
  language: string;
  currencySymbol: string;
  timezone: string;
};

const BUSINESS_TYPES = [
  { id: "restaurant", icon: UtensilsCrossed },
  { id: "cafe", icon: Coffee },
  { id: "bar", icon: Wine },
  { id: "hotel", icon: Hotel },
  { id: "fitness", icon: Dumbbell },
] as const;

const COUNTRY_OPTIONS = [
  { value: "XK", label: "Kosovo", flag: "🇽🇰" },
  { value: "AL", label: "Albania", flag: "🇦🇱" },
  { value: "MK", label: "North Macedonia", flag: "🇲🇰" },
  { value: "ME", label: "Montenegro", flag: "🇲🇪" },
  { value: "RS", label: "Serbia", flag: "🇷🇸" },
  { value: "HR", label: "Croatia", flag: "🇭🇷" },
  { value: "BA", label: "Bosnia and Herzegovina", flag: "🇧🇦" },
  { value: "GR", label: "Greece", flag: "🇬🇷" },
  { value: "IT", label: "Italy", flag: "🇮🇹" },
  { value: "DE", label: "Germany", flag: "🇩🇪" },
  { value: "CH", label: "Switzerland", flag: "🇨🇭" },
  { value: "AT", label: "Austria", flag: "🇦🇹" },
  { value: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { value: "US", label: "United States", flag: "🇺🇸" },
] as const;

const CURRENCY_OPTIONS = [
  { value: "€", label: "EUR – Euro (€)" },
  { value: "$", label: "USD – US Dollar ($)" },
  { value: "Lek", label: "ALL – Lek" },
  { value: "£", label: "GBP – Pound (£)" },
  { value: "CHF", label: "CHF – Swiss Franc" },
  { value: "din", label: "RSD – Dinar (din)" },
] as const;

const ORDER_TYPES = [
  { id: "dine_in", icon: UtensilsCrossed },
  { id: "takeaway", icon: ShoppingBag },
  { id: "delivery", icon: Bike },
] as const;

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsGeneralPanelProps = {
  t: Translate;
  locale: GeneralLocaleDraft;
  timezoneOptions: string[];
  isAdminStaff: boolean;
  canEditBusinessIdentity: boolean;
  canEditLanguageCurrency: boolean;
  canEditTimezone: boolean;
  savingCompany: boolean;
  draft: BusinessProfileDraft;
  prefs: PosGeneralPrefs;
  onDraftChange: (field: keyof BusinessProfileDraft, value: string) => void;
  onPrefsChange: (patch: Partial<PosGeneralPrefs>) => void;
  onLocaleChange: (field: keyof GeneralLocaleDraft, value: string) => void;
  onCancelEdit: () => void;
  onSaveCompany: () => void;
  logoPreviewSrc: string;
  logoHasCustom: boolean;
  logoBusy: boolean;
  onPickLogo: (file: File) => void;
  onRemoveLogo: () => void;
};

function timezoneLabel(tz: string): string {
  try {
    const raw =
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "longOffset",
      })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    const match = raw.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (match) {
      const hh = match[2].padStart(2, "0");
      const mm = (match[3] ?? "00").padStart(2, "0");
      return `(UTC${match[1]}${hh}:${mm}) ${tz}`;
    }
    return raw ? `${tz} (${raw.replace(/^GMT/, "UTC")})` : tz;
  } catch {
    return tz;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useLogoMeta(src: string, custom: boolean) {
  const [meta, setMeta] = useState<{ width: number; height: number; bytes: number | null } | null>(null);
  useEffect(() => {
    if (!custom || !src) {
      setMeta(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const match = src.match(/^data:[^;]+;base64,(.+)$/);
      const bytes = match ? Math.floor((match[1].length * 3) / 4) : null;
      setMeta({ width: img.naturalWidth, height: img.naturalHeight, bytes });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, custom]);
  return meta;
}

function BusinessTypeLock({
  type,
  t,
}: {
  type: string;
  t: Translate;
}) {
  const known = BUSINESS_TYPES.find((item) => item.id === type);
  const Icon = known?.icon;
  const label = known ? t(`settings.type.${known.id}`) : type.trim() || "—";
  return (
    <div className={cn(selectTriggerClass, "flex cursor-default items-center gap-2 px-3")}>
      {Icon ? <Icon className="size-4 shrink-0 text-[#94a3b8]" /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Lock className="size-3.5 shrink-0 text-[#94a3b8]" />
    </div>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <Label className="text-[13px] font-medium text-[#334155]">
      {children}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
    </Label>
  );
}

function CardHeading({
  icon: Icon,
  title,
  lead,
  tint,
}: {
  icon: LucideIcon;
  title: string;
  lead: string;
  tint: "purple" | "orange";
}) {
  return (
    <div className="mb-4 flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          tint === "purple" ? "bg-brand-light text-brand" : "bg-brand-light text-brand",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-[#0f172a]">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{lead}</p>
      </div>
    </div>
  );
}

const fieldInputClass =
  "h-11 rounded-xl border-[#e6edf5] bg-white text-[#0f172a] shadow-none placeholder:text-[#94a3b8]";

const selectTriggerClass =
  "h-11 w-full rounded-xl border-[#e6edf5] bg-white text-sm text-[#0f172a] shadow-none";

const selectMenuClass =
  "rounded-xl border-[#e6edf5] bg-white text-[#0f172a]";

const cardClass =
  "rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

function IconInput({
  icon: Icon,
  className,
  ...props
}: { icon: LucideIcon } & ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
      <Input className={cn(fieldInputClass, "pl-10", className)} {...props} />
    </div>
  );
}

function IconSelectTrigger({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <SelectTrigger className={selectTriggerClass}>
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-[#94a3b8]" />
        {children ?? <SelectValue />}
      </span>
    </SelectTrigger>
  );
}

export default function SettingsGeneralPanel({
  t,
  locale,
  timezoneOptions,
  isAdminStaff,
  canEditBusinessIdentity,
  canEditLanguageCurrency,
  canEditTimezone,
  savingCompany,
  draft,
  prefs,
  onDraftChange,
  onPrefsChange,
  onLocaleChange,
  onCancelEdit,
  onSaveCompany,
  logoPreviewSrc,
  logoHasCustom,
  logoBusy,
  onPickLogo,
  onRemoveLogo,
}: SettingsGeneralPanelProps) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const locked = !canEditBusinessIdentity;
  const localeLocked = !canEditLanguageCurrency;
  const tzLocked = !canEditTimezone;
  const selectedCountry =
    COUNTRY_OPTIONS.find((item) => item.value === draft.country) ??
    COUNTRY_OPTIONS.find(
      (item) => item.label.toLowerCase() === draft.country.trim().toLowerCase(),
    );
  const currencyOptions = CURRENCY_OPTIONS.some(
    (item) => item.value === locale.currencySymbol,
  )
    ? CURRENCY_OPTIONS
    : [
        { value: locale.currencySymbol, label: locale.currencySymbol },
        ...CURRENCY_OPTIONS,
      ];
  const canSave =
    canEditBusinessIdentity || canEditLanguageCurrency || canEditTimezone;
  const logoMeta = useLogoMeta(logoPreviewSrc, logoHasCustom);
  const knownType = BUSINESS_TYPES.find((item) => item.id === draft.type);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-[#0f172a]">
              {t("settings.cat.general")}
            </h1>
            <p className="mt-0.5 text-sm text-[#64748b]">{t("settings.general_lead")}</p>
            {!isAdminStaff ? (
              <p className="mt-1 text-xs text-[#d97706]">{t("settings.manager_general_hint")}</p>
            ) : null}
          </div>
        </div>
        {canSave ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={savingCompany}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e6edf5] bg-white px-4 text-sm font-medium text-[#0f172a] disabled:opacity-60"
            >
              <RotateCcw className="size-4" />
              {t("settings.discard_changes")}
            </button>
            <button
              type="button"
              onClick={onSaveCompany}
              disabled={savingCompany}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold disabled:opacity-60"
              style={{ color: "#ffffff" }}
            >
              <Save className="size-4" />
              {savingCompany ? "…" : t("settings.save_changes")}
            </button>
          </div>
        ) : null}
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <section className={cardClass}>
            <CardHeading
              icon={Building2}
              tint="purple"
              title={t("settings.company_details")}
              lead={t("settings.company_details_lead")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel required>{t("settings.business_name")}</FieldLabel>
                <IconInput
                  icon={Building2}
                  value={draft.name}
                  onChange={(e) => onDraftChange("name", e.target.value)}
                  disabled={locked}
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("settings.phone_number")}</FieldLabel>
                <IconInput
                  icon={Phone}
                  value={draft.phone}
                  onChange={(e) => onDraftChange("phone", e.target.value)}
                  disabled={locked}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("settings.email_address")}</FieldLabel>
                <IconInput
                  icon={Mail}
                  type="email"
                  value={draft.email}
                  onChange={(e) => onDraftChange("email", e.target.value)}
                  disabled={locked}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("settings.website")}</FieldLabel>
                <IconInput
                  icon={Link2}
                  value={draft.website}
                  onChange={(e) => onDraftChange("website", e.target.value)}
                  disabled={locked}
                  autoComplete="url"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel>{t("settings.address")}</FieldLabel>
                <IconInput
                  icon={MapPin}
                  value={draft.address}
                  onChange={(e) => onDraftChange("address", e.target.value)}
                  disabled={locked}
                  autoComplete="street-address"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("settings.city")}</FieldLabel>
                <IconInput
                  icon={Building2}
                  value={draft.city}
                  onChange={(e) => onDraftChange("city", e.target.value)}
                  disabled={locked}
                  autoComplete="address-level2"
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel>{t("settings.postal_code")}</FieldLabel>
                <IconInput
                  icon={Hash}
                  value={draft.postalCode}
                  onChange={(e) => onDraftChange("postalCode", e.target.value)}
                  disabled={locked}
                  autoComplete="postal-code"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel required>{t("settings.country")}</FieldLabel>
                <Select
                  value={selectedCountry?.value}
                  onValueChange={(value) => {
                    const match = COUNTRY_OPTIONS.find((item) => item.value === value);
                    onDraftChange("country", match?.label ?? value);
                  }}
                  disabled={locked}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="text-base leading-none">{selectedCountry?.flag ?? "🏳️"}</span>
                      <span className="truncate">
                        {selectedCountry?.label || draft.country || t("settings.country")}
                      </span>
                    </span>
                  </SelectTrigger>
                  <SelectContent align="start" className={selectMenuClass}>
                    {COUNTRY_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        <span className="text-base leading-none">{item.flag}</span>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[#64748b]">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <span>{t("settings.country_tax_note")}</span>
                </p>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <CardHeading
              icon={Globe}
              tint="orange"
              title={t("settings.regional_title")}
              lead={t("settings.regional_lead")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <div className="space-y-1.5 sm:col-span-3">
                <FieldLabel required>{t("settings.currency")}</FieldLabel>
                <Select
                  value={locale.currencySymbol}
                  onValueChange={(value) => onLocaleChange("currencySymbol", value)}
                  disabled={localeLocked}
                >
                  <IconSelectTrigger icon={CircleDollarSign}>
                    <SelectValue />
                  </IconSelectTrigger>
                  <SelectContent align="start" className={selectMenuClass}>
                    {currencyOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <FieldLabel required>{t("settings.language")}</FieldLabel>
                <Select
                  value={locale.language === "sq" ? "sq" : "en"}
                  onValueChange={(value) => onLocaleChange("language", value)}
                  disabled={localeLocked}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <span className="flex min-w-0 items-center gap-2">
                      {locale.language === "sq" ? (
                        <FlagAL className="h-3.5 w-5" />
                      ) : (
                        <FlagUS className="h-3.5 w-5" />
                      )}
                      <span className="truncate">
                        {locale.language === "sq" ? t("settings.lang_sq") : t("settings.lang_en")}
                      </span>
                    </span>
                  </SelectTrigger>
                  <SelectContent align="start" className={selectMenuClass}>
                    <SelectItem value="en">
                      <FlagUS className="h-3.5 w-5" />
                      {t("settings.lang_en")}
                    </SelectItem>
                    <SelectItem value="sq">
                      <FlagAL className="h-3.5 w-5" />
                      {t("settings.lang_sq")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel required>{t("settings.timezone")}</FieldLabel>
                <Select
                  value={locale.timezone}
                  onValueChange={(value) => onLocaleChange("timezone", value)}
                  disabled={tzLocked}
                >
                  <IconSelectTrigger icon={Clock} />
                  <SelectContent align="start" className={selectMenuClass}>
                    {timezoneOptions.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {timezoneLabel(tz)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel>{t("settings.date_format")}</FieldLabel>
                <Select
                  value={prefs.dateFormat}
                  onValueChange={(value) =>
                    onPrefsChange({ dateFormat: value as PosGeneralPrefs["dateFormat"] })
                  }
                  disabled={locked}
                >
                  <IconSelectTrigger icon={CalendarDays} />
                  <SelectContent align="start" className={selectMenuClass}>
                    <SelectItem value="dmy">{t("settings.date_format_dmy")}</SelectItem>
                    <SelectItem value="mdy">{t("settings.date_format_mdy")}</SelectItem>
                    <SelectItem value="ymd">{t("settings.date_format_ymd")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <FieldLabel>{t("settings.time_format")}</FieldLabel>
                <Select
                  value={prefs.timeFormat}
                  onValueChange={(value) =>
                    onPrefsChange({ timeFormat: value as PosGeneralPrefs["timeFormat"] })
                  }
                  disabled={locked}
                >
                  <IconSelectTrigger icon={Clock} />
                  <SelectContent align="start" className={selectMenuClass}>
                    <SelectItem value="24h">{t("settings.time_format_24")}</SelectItem>
                    <SelectItem value="12h">{t("settings.time_format_12")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className={cardClass}>
            <CardHeading
              icon={ImageIcon}
              tint="purple"
              title={t("settings.logo_title")}
              lead={t("settings.logo_lead")}
            />
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onPickLogo(file);
              }}
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex size-[92px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e6edf5] bg-[#f8fafc]">
                <img src={logoPreviewSrc} alt="" className="max-h-16 max-w-[72px] object-contain" />
                {logoHasCustom ? (
                  <span className="absolute bottom-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-[#16a34a]">
                    <span className="text-[10px] font-bold" style={{ color: "#ffffff" }}>✓</span>
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                {logoHasCustom && logoMeta ? (
                  <p className="text-sm text-[#64748b]">
                    {logoMeta.width > 0 ? `${logoMeta.width} × ${logoMeta.height}` : null}
                    {logoMeta.bytes != null
                      ? `${logoMeta.width > 0 ? " · " : ""}${formatBytes(logoMeta.bytes)}`
                      : null}
                  </p>
                ) : (
                  <p className="text-sm text-[#64748b]">{t("settings.logo_formats")}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={logoBusy || locked || !logoHasCustom}
                    onClick={onRemoveLogo}
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-[#e6edf5] bg-white text-[#64748b] disabled:opacity-40"
                    aria-label={t("settings.logo_remove")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={logoBusy || locked}
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e6edf5] bg-white px-3 text-sm font-medium text-[#0f172a] disabled:opacity-40"
                  >
                    {t("settings.logo_change")}
                  </button>
                </div>
                {logoHasCustom ? (
                  <p className="mt-2 text-xs text-[#94a3b8]">{t("settings.logo_formats")}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <CardHeading
              icon={knownType?.icon ?? UtensilsCrossed}
              tint="orange"
              title={t("settings.business_type")}
              lead={t("settings.business_type_card_lead")}
            />
            <BusinessTypeLock type={draft.type} t={t} />
          </section>

          <section className={cardClass}>
            <CardHeading
              icon={SlidersHorizontal}
              tint="orange"
              title={t("settings.defaults_title")}
              lead={t("settings.defaults_lead")}
            />
            <div className="space-y-3">
              <DefaultRow icon={ShoppingBag} label={t("settings.default_order_type")}>
                <Select
                  value={prefs.defaultOrderType}
                  onValueChange={(value) =>
                    onPrefsChange({
                      defaultOrderType: value as PosGeneralPrefs["defaultOrderType"],
                    })
                  }
                  disabled={locked}
                >
                  <SelectTrigger className={cn(selectTriggerClass, "w-[180px]")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" className={selectMenuClass}>
                    {ORDER_TYPES.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SelectItem key={item.id} value={item.id}>
                          <Icon className="size-4 text-[#94a3b8]" />
                          {t(`settings.order_type_${item.id}`)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </DefaultRow>
              <DefaultRow icon={UtensilsCrossed} label={t("settings.default_table_service")}>
                <Select
                  value={prefs.defaultTableService ? "on" : "off"}
                  onValueChange={(value) =>
                    onPrefsChange({ defaultTableService: value === "on" })
                  }
                  disabled={locked}
                >
                  <SelectTrigger className={cn(selectTriggerClass, "w-[180px]")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" className={selectMenuClass}>
                    <SelectItem value="on">{t("settings.defaults_enabled")}</SelectItem>
                    <SelectItem value="off">{t("settings.defaults_disabled")}</SelectItem>
                  </SelectContent>
                </Select>
              </DefaultRow>
              <DefaultRow icon={Languages} label={t("settings.receipt_language")}>
                <Select
                  value={prefs.receiptLanguage}
                  onValueChange={(value) =>
                    onPrefsChange({
                      receiptLanguage: value as PosGeneralPrefs["receiptLanguage"],
                    })
                  }
                  disabled={locked}
                >
                  <SelectTrigger className={cn(selectTriggerClass, "w-[180px]")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" className={selectMenuClass}>
                    <SelectItem value="en">{t("settings.lang_en")}</SelectItem>
                    <SelectItem value="sq">{t("settings.lang_sq")}</SelectItem>
                  </SelectContent>
                </Select>
              </DefaultRow>
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[#64748b]">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>{t("settings.defaults_future_note")}</span>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function DefaultRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2 text-sm text-[#334155]">
        <Icon className="size-4 shrink-0 text-[#94a3b8]" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}
