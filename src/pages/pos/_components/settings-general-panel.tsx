import type { ReactNode } from "react";
import { cn } from "@/lib/utils.ts";
import { FlagAL, FlagUS } from "@/components/flag-icons.tsx";
import { Button } from "@/components/ui/button.tsx";
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
  Building2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Coins,
  CreditCard,
  Globe,
  HardDrive,
  Lightbulb,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PosView } from "../_lib/types.ts";
import type { SettingsCategoryId } from "./pos-settings-categories.ts";
import AppUpdateSection from "./app-update-section.tsx";

export type GeneralCompany = {
  name: string;
  address: string;
  phone: string;
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

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsGeneralPanelProps = {
  t: Translate;
  formatPrice: (n: number) => string;
  company: GeneralCompany;
  companyTimezone: string;
  timezoneOptions: string[];
  isAdminStaff: boolean;
  canEditBusinessIdentity: boolean;
  canEditLanguageCurrency: boolean;
  canEditTimezone: boolean;
  editingCompany: boolean;
  savingCompany: boolean;
  savingLocale: boolean;
  draftName: string;
  draftAddress: string;
  draftPhone: string;
  planTierDisplay: (plan: string) => string;
  licenseStatusDisplay: (status: string) => string;
  licenseExpiryLine: { text: string; lineClass: string } | null;
  onDraftName: (v: string) => void;
  onDraftAddress: (v: string) => void;
  onDraftPhone: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveCompany: () => void;
  onLocaleChange: (
    field:
      | "language"
      | "currencySymbol"
      | "currencyPosition"
      | "currencyDecimals"
      | "timezone",
    value: string | number,
  ) => void;
  onNavigate?: (view: PosView) => void;
  onOpenCategory: (id: SettingsCategoryId) => void;
};

function timezoneLabel(tz: string): string {
  try {
    const off = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return off ? `${tz} (${off})` : tz;
  } catch {
    return tz;
  }
}

function InfoTile({
  icon: Icon,
  label,
  value,
  valueColor,
  subline,
  sublineClassName,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  valueColor?: string;
  subline?: string;
  sublineClassName?: string;
  hint?: string;
}) {
  return (
    <div className="flex min-h-[92px] items-start gap-3 rounded-2xl border border-[#1e2a45] bg-[#131A2E] px-4 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1e2a45]/80">
        <Icon className="size-4 text-[#8b93a7]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5a6580]">
          {label}
        </p>
        <p className={cn("mt-1 text-[15px] font-semibold leading-snug text-white", valueColor)}>
          {value}
        </p>
        {subline ? (
          <p className={cn("mt-1 text-xs leading-snug", sublineClassName ?? "text-[#8b93a7]")}>
            {subline}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-1 text-[11px] leading-snug text-[#5a6580]">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function PrefRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-[46%]">
        <p className="text-sm font-semibold text-white">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[#8b93a7]">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0 sm:flex sm:justify-end">{children}</div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[#1e2a45]/50 cursor-pointer"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1e2a45]">
        <Icon className="size-4 text-[#0066FF]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-white">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-[#5a6580] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0066FF]" />
    </button>
  );
}

const selectTriggerClass =
  "h-11 min-w-[220px] rounded-xl bg-[#131A2E] border-[#1e2a45] text-white text-sm";

export default function SettingsGeneralPanel({
  t,
  formatPrice,
  company,
  companyTimezone,
  timezoneOptions,
  isAdminStaff,
  canEditBusinessIdentity,
  canEditLanguageCurrency,
  canEditTimezone,
  editingCompany,
  savingCompany,
  savingLocale,
  draftName,
  draftAddress,
  draftPhone,
  planTierDisplay,
  licenseStatusDisplay,
  licenseExpiryLine,
  onDraftName,
  onDraftAddress,
  onDraftPhone,
  onStartEdit,
  onCancelEdit,
  onSaveCompany,
  onLocaleChange,
  onNavigate,
  onOpenCategory,
}: SettingsGeneralPanelProps) {
  const currencyDisplay = company.currencySymbol
    ? `${company.currency} (${company.currencySymbol})`
    : company.currency;
  const expiryDate =
    company.licenseExpiry && !Number.isNaN(new Date(company.licenseExpiry).getTime())
      ? new Date(company.licenseExpiry).toLocaleDateString()
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-[28px] font-bold tracking-tight text-white">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#0066FF]/12">
              <Store className="size-5 text-[#0066FF]" />
            </span>
            {t("settings.cat.general")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8b93a7]">
            {t("settings.general_lead")}
          </p>
          {!isAdminStaff ? (
            <p className="mt-2 text-xs text-amber-400/90">
              {t("settings.manager_general_hint")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onNavigate ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-[#0066FF]/35 bg-transparent text-[#0066FF] hover:bg-[#0066FF]/10 hover:text-[#0066FF]"
              onClick={() => onNavigate("floor")}
            >
              {t("settings.preview_pos")}
            </Button>
          ) : null}
          {editingCompany && canEditBusinessIdentity ? (
            <Button
              type="button"
              className="h-10 rounded-xl bg-[#0066FF] hover:bg-[#0052CC]"
              onClick={onSaveCompany}
              disabled={savingCompany}
            >
              {savingCompany ? "…" : t("settings.company_save")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="space-y-6 min-w-0">
          <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2.5 text-lg font-semibold text-white">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[#0066FF]/12">
                  <Building2 className="size-[18px] text-[#0066FF]" />
                </span>
                {t("settings.company_details")}
              </h2>
              {canEditBusinessIdentity ? (
                editingCompany ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg border-[#2a3a5a] text-[#8b93a7] hover:text-white"
                      onClick={onCancelEdit}
                      disabled={savingCompany}
                    >
                      {t("settings.company_cancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 rounded-lg bg-[#0066FF] hover:bg-[#0052CC]"
                      onClick={onSaveCompany}
                      disabled={savingCompany}
                    >
                      {savingCompany ? "…" : t("settings.company_save")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg border-[#2a3a5a] text-[#8b93a7] hover:text-white shrink-0"
                    onClick={onStartEdit}
                  >
                    <Pencil className="size-3.5 mr-1.5" />
                    {t("settings.company_edit")}
                  </Button>
                )
              ) : null}
            </div>

            {editingCompany && canEditBusinessIdentity ? (
              <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[#8b93a7] text-[11px] font-semibold uppercase tracking-wider">
                    {t("settings.business_name")}
                  </Label>
                  <Input
                    value={draftName}
                    onChange={(e) => onDraftName(e.target.value)}
                    className="h-11 rounded-xl bg-[#0A0F1E] border-[#1e2a45] text-white"
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8b93a7] text-[11px] font-semibold uppercase tracking-wider">
                    {t("settings.address")}
                  </Label>
                  <Input
                    value={draftAddress}
                    onChange={(e) => onDraftAddress(e.target.value)}
                    className="h-11 rounded-xl bg-[#0A0F1E] border-[#1e2a45] text-white"
                    autoComplete="street-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8b93a7] text-[11px] font-semibold uppercase tracking-wider">
                    {t("settings.phone")}
                  </Label>
                  <Input
                    value={draftPhone}
                    onChange={(e) => onDraftPhone(e.target.value)}
                    className="h-11 rounded-xl bg-[#0A0F1E] border-[#1e2a45] text-white"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {editingCompany && canEditBusinessIdentity ? null : (
                <>
                  <InfoTile
                    icon={Building2}
                    label={t("settings.business_name")}
                    value={company.name}
                  />
                  <InfoTile
                    icon={MapPin}
                    label={t("settings.address")}
                    value={company.address || t("settings.not_set")}
                  />
                  <InfoTile
                    icon={Phone}
                    label={t("settings.phone")}
                    value={company.phone || t("settings.not_set")}
                  />
                </>
              )}
              <InfoTile icon={Coins} label={t("settings.currency")} value={currencyDisplay} />
              <InfoTile
                icon={CreditCard}
                label={t("settings.plan")}
                value={planTierDisplay(company.plan)}
                hint={t("settings.plan_cannot_change_here")}
              />
              <InfoTile
                icon={ShieldCheck}
                label={t("settings.license")}
                value={licenseStatusDisplay(String(company.licenseStatus ?? ""))}
                valueColor={
                  company.licenseStatus === "active" ? "text-emerald-500" : "text-red-400"
                }
                subline={licenseExpiryLine?.text}
                sublineClassName={licenseExpiryLine?.lineClass}
              />
            </div>
          </section>

          <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h2 className="mb-2 flex items-center gap-2.5 text-lg font-semibold text-white">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#0066FF]/12">
                <Globe className="size-[18px] text-[#0066FF]" />
              </span>
              {t("settings.language_currency")}
            </h2>

            <div className="divide-y divide-[#1e2a45]/80">
              <PrefRow label={t("settings.language")} description={t("settings.language_desc")}>
                <div className="flex overflow-hidden rounded-xl border border-[#1e2a45]">
                  <button
                    type="button"
                    onClick={() => onLocaleChange("language", "en")}
                    disabled={savingLocale || !canEditLanguageCurrency}
                    className={cn(
                      "flex h-11 items-center gap-1.5 px-4 text-sm font-medium transition-colors",
                      company.language === "en"
                        ? "bg-[#0066FF] text-white"
                        : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                      canEditLanguageCurrency ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                    )}
                  >
                    <FlagUS className="h-3.5 w-5" />
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => onLocaleChange("language", "sq")}
                    disabled={savingLocale || !canEditLanguageCurrency}
                    className={cn(
                      "flex h-11 items-center gap-1.5 px-4 text-sm font-medium transition-colors",
                      company.language === "sq"
                        ? "bg-[#0066FF] text-white"
                        : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                      canEditLanguageCurrency ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                    )}
                  >
                    <FlagAL className="h-3.5 w-5" />
                    Albanian
                  </button>
                </div>
              </PrefRow>

              <PrefRow label={t("settings.timezone")} description={t("settings.timezone_desc")}>
                <Select
                  value={companyTimezone}
                  onValueChange={(val) => onLocaleChange("timezone", val)}
                  disabled={savingLocale || !canEditTimezone}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {timezoneLabel(tz)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PrefRow>

              <PrefRow
                label={t("settings.currency_symbol")}
                description={t("settings.currency_symbol_desc")}
              >
                <Select
                  value={company.currencySymbol}
                  onValueChange={(val) => onLocaleChange("currencySymbol", val)}
                  disabled={savingLocale || !canEditLanguageCurrency}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Lek">Lek (Albanian Lek)</SelectItem>
                    <SelectItem value="€">€ (Euro)</SelectItem>
                    <SelectItem value="$">$ (US Dollar)</SelectItem>
                    <SelectItem value="£">£ (British Pound)</SelectItem>
                    <SelectItem value="CHF">CHF (Swiss Franc)</SelectItem>
                    <SelectItem value="din">din (Serbian Dinar)</SelectItem>
                  </SelectContent>
                </Select>
              </PrefRow>

              <PrefRow
                label={t("settings.currency_position")}
                description={t("settings.currency_position_desc")}
              >
                <div className="flex overflow-hidden rounded-xl border border-[#1e2a45]">
                  <button
                    type="button"
                    onClick={() => onLocaleChange("currencyPosition", "prefix")}
                    disabled={savingLocale || !canEditLanguageCurrency}
                    className={cn(
                      "flex h-11 items-center gap-1.5 px-3.5 text-sm font-medium transition-colors",
                      company.currencyPosition === "prefix"
                        ? "bg-[#0066FF] text-white"
                        : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                      canEditLanguageCurrency ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                    )}
                  >
                    <CircleDollarSign className="size-3.5" />
                    {t("settings.position_prefix")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onLocaleChange("currencyPosition", "suffix")}
                    disabled={savingLocale || !canEditLanguageCurrency}
                    className={cn(
                      "flex h-11 items-center gap-1.5 px-3.5 text-sm font-medium transition-colors",
                      company.currencyPosition === "suffix"
                        ? "bg-[#0066FF] text-white"
                        : "bg-[#131A2E] text-[#5a6580] hover:text-white",
                      canEditLanguageCurrency ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                    )}
                  >
                    {t("settings.position_suffix")}
                    <CircleDollarSign className="size-3.5" />
                  </button>
                </div>
              </PrefRow>

              <PrefRow label={t("settings.decimals")} description={t("settings.decimals_desc")}>
                <Select
                  value={String(company.currencyDecimals)}
                  onValueChange={(val) => onLocaleChange("currencyDecimals", Number(val))}
                  disabled={savingLocale || !canEditLanguageCurrency}
                >
                  <SelectTrigger className="h-11 w-[160px] rounded-xl bg-[#131A2E] border-[#1e2a45] text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 (100)</SelectItem>
                    <SelectItem value="1">1 (100.0)</SelectItem>
                    <SelectItem value="2">2 (100.00)</SelectItem>
                    <SelectItem value="3">3 (100.000)</SelectItem>
                  </SelectContent>
                </Select>
              </PrefRow>
            </div>

            <div className="mt-5 rounded-2xl border border-[#1e2a45]/70 bg-[#131A2E]/70 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a6580]">
                {t("settings.preview_label")}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-white">
                {formatPrice(1234.56)}
              </p>
            </div>
          </section>

          <AppUpdateSection />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-4 sm:p-5">
            <h3 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5a6580]">
              {t("settings.quick_actions")}
            </h3>
            <div className="space-y-0.5">
              {canEditBusinessIdentity ? (
                <QuickAction
                  icon={Pencil}
                  label={t("settings.quick_edit_business")}
                  onClick={onStartEdit}
                />
              ) : null}
              <QuickAction
                icon={Wallet}
                label={t("settings.cat.payments")}
                onClick={() => onOpenCategory("payments")}
              />
              <QuickAction
                icon={Users}
                label={t("settings.cat.users")}
                onClick={() => {
                  if (onNavigate) onNavigate("staff");
                  else onOpenCategory("users");
                }}
              />
              <QuickAction
                icon={HardDrive}
                label={t("settings.cat.backup")}
                onClick={() => onOpenCategory("backup")}
              />
            </div>
          </section>

          <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5a6580]">
              <Lightbulb className="size-3.5 text-amber-400" />
              {t("settings.tips")}
            </h3>
            <p className="text-sm leading-relaxed text-[#8b93a7]">{t("settings.tips_autosave")}</p>
          </section>

          <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5a6580]">
              <Clock className="size-3.5" />
              {t("settings.last_updated")}
            </h3>
            <p className="text-sm font-medium text-white">
              {expiryDate
                ? t("settings.last_updated_license", { date: expiryDate })
                : t("settings.last_updated_live")}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
