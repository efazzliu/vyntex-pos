import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import {
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  Info,
  MoreHorizontal,
  Percent,
  Settings,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import {
  enabledCatalogRates,
  formatTaxPercent,
  getCountryTaxCatalog,
  parsePosTaxSettings,
  ratePercent,
  serializePosTaxSettings,
  typicalRateIdsForBusiness,
  type PosTaxSettings,
  type TaxPricingMode,
} from "@/lib/pos-tax-config.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsTaxPanelProps = {
  t: Translate;
  licenseKey: string;
  isAdmin: boolean;
  country: string;
  businessType: string;
  vatNumber: string;
  defaultVatRate: number;
  taxSettingsRaw: unknown;
  onOpenMenu: () => void;
  onOpenGeneral: () => void;
};

export default function SettingsTaxPanel({
  t,
  licenseKey,
  isAdmin,
  country,
  businessType,
  vatNumber,
  defaultVatRate,
  taxSettingsRaw,
  onOpenMenu,
  onOpenGeneral,
}: SettingsTaxPanelProps) {
  const updateTax = useMutation("pos.settings.updateTaxSettings");
  const catalog = getCountryTaxCatalog(country);
  const ctx = useMemo(
    () => ({
      country,
      businessType,
      fallbackVatFraction: defaultVatRate,
    }),
    [country, businessType, defaultVatRate],
  );

  const parsed = useMemo(
    () => parsePosTaxSettings(taxSettingsRaw, ctx),
    [taxSettingsRaw, ctx],
  );

  const [draftNumber, setDraftNumber] = useState(vatNumber);
  const [draft, setDraft] = useState<PosTaxSettings>(parsed);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftNumber(vatNumber);
    setDraft(parsed);
  }, [vatNumber, parsed]);

  const typicalIds = catalog
    ? typicalRateIdsForBusiness(catalog, businessType)
    : [];
  const enabledRates = enabledCatalogRates(catalog, draft);

  const toggleRate = (id: string, on: boolean) => {
    if (!catalog || !isAdmin) return;
    const nextIds = on
      ? [...new Set([...draft.enabledRateIds, id])]
      : draft.enabledRateIds.filter((x) => x !== id);
    if (nextIds.length === 0) return;
    let defaultRateId = draft.defaultRateId;
    if (!nextIds.includes(defaultRateId)) defaultRateId = nextIds[0];
    setDraft({ ...draft, enabledRateIds: nextIds, defaultRateId });
  };

  const setPricing = (pricingMode: TaxPricingMode) => {
    if (!isAdmin) return;
    setDraft({ ...draft, pricingMode });
  };

  const [openRow, setOpenRow] = useState<string | null>(null);
  const vatOn = catalog
    ? draft.enabledRateIds.some((id) => {
        const row = catalog.rates.find((rate) => rate.id === id);
        return row ? ratePercent(row, draft) > 0 : false;
      })
    : false;
  const zeroRate = catalog?.rates.find((row) => row.kind === "zero");
  const standardRate = catalog?.rates.find((row) => row.kind === "standard");

  const setVatEnabled = (on: boolean) => {
    if (!catalog || !isAdmin) return;
    if (on) {
      const ids = typicalIds.length > 0 ? typicalIds : catalog.rates.map((row) => row.id);
      setDraft({
        ...draft,
        enabledRateIds: ids,
        defaultRateId: ids.includes(draft.defaultRateId) ? draft.defaultRateId : ids[0],
      });
      return;
    }
    if (!zeroRate) return;
    setDraft({ ...draft, enabledRateIds: [zeroRate.id], defaultRateId: zeroRate.id });
  };

  const dirty =
    draftNumber !== vatNumber ||
    draft.pricingMode !== parsed.pricingMode ||
    draft.defaultRateId !== parsed.defaultRateId ||
    draft.customPercent !== parsed.customPercent ||
    draft.enabledRateIds.join("|") !== parsed.enabledRateIds.join("|");

  const discard = () => {
    setDraftNumber(vatNumber);
    setDraft(parsed);
    setOpenRow(null);
  };

  const lastSaved = parsed.history[0];
  const lastSavedLabel = lastSaved
    ? t("settings.tax_last_saved", {
        time: new Date(lastSaved.at).toLocaleString(),
      })
    : t("settings.tax_not_saved");
  const onPurple = { color: "#ffffff" };

  const save = async () => {
    if (!isAdmin) {
      toast.error(t("settings.admin_only_vat"));
      return;
    }
    if (!catalog) {
      toast.error(t("settings.tax_need_country"));
      return;
    }
    setSaving(true);
    try {
      const serialized = serializePosTaxSettings(draft);
      await updateTax({
        licenseKey,
        vatNumber: draftNumber,
        pricingMode: serialized.pricingMode,
        defaultRateId: serialized.defaultRateId,
        enabledRateIds: serialized.enabledRateIds,
        customPercent: serialized.customPercent,
        customName: serialized.customName,
      });
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand/15">
            <Percent className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight text-white">{t("settings.tax_heading")}</h1>
            <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.tax_lead")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-[#cbd5e1] bg-white shadow-none hover:bg-[#f8fafc] disabled:opacity-100"
            style={{
              color: "#0f172a",
              backgroundColor: "#ffffff",
              borderColor: "#cbd5e1",
              opacity: 1,
            }}
            disabled={!dirty || saving}
            onClick={discard}
          >
            {t("settings.tax_discard")}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl bg-brand px-4 hover:bg-brand-hover"
            style={onPurple}
            onClick={() => void save()}
            disabled={saving || !isAdmin || !catalog || !dirty}
          >
            <SaveIcon />
            {saving ? "…" : t("settings.save_changes")}
          </Button>
        </div>
      </div>

      {!isAdmin ? <p className="text-xs text-amber-500">{t("settings.admin_only_vat")}</p> : null}

      {catalog ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-white">{t("settings.tax_config")}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-600">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {t("settings.tax_active")}
          </span>
          <span className="text-[#8b93a7]">{lastSavedLabel}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenGeneral}
          className="flex w-full items-center gap-4 rounded-[22px] border border-amber-500/30 bg-[#0D1326] p-5 text-left"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
            <Building2 className="size-5 text-amber-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-white">{t("settings.tax_need_country_title")}</p>
            <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.tax_need_country")}</p>
          </div>
        </button>
      )}

      {catalog ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-5">
              <div className="flex items-center gap-2">
                <Settings className="size-4 text-brand" />
                <h2 className="text-base font-semibold text-white">{t("settings.tax_settings_title")}</h2>
              </div>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">{t("settings.tax_enable_vat")}</p>
                  <p className="mt-0.5 text-xs text-[#8b93a7]">{t("settings.tax_enable_vat_desc")}</p>
                </div>
                <Switch
                  checked={vatOn}
                  disabled={!isAdmin || (!vatOn && typicalIds.length === 0) || (vatOn && !zeroRate)}
                  onCheckedChange={setVatEnabled}
                  className="data-[state=checked]:border-brand data-[state=checked]:bg-brand"
                />
              </div>
              <div className="mt-4 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Label className="text-sm text-white">{t("settings.tax_country")}</Label>
                    <p className="text-xs text-[#8b93a7]">{t("settings.tax_country_desc")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenGeneral}
                    className="flex h-11 w-full shrink-0 items-center justify-between rounded-xl border border-[#1e2a45] bg-[#0D1326] px-3 text-sm text-white sm:w-64"
                  >
                    <span>{t(catalog.countryNameKey)}</span>
                    <span className="text-[#8b93a7]">▾</span>
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Label className="text-sm text-white">{t("settings.vat_number")}</Label>
                    <p className="text-xs text-[#8b93a7]">{t("settings.tax_vat_number_lead")}</p>
                  </div>
                  <Input
                    value={draftNumber}
                    onChange={(event) => setDraftNumber(event.target.value)}
                    disabled={!isAdmin}
                    placeholder={t("settings.tax_vat_placeholder")}
                    className="h-11 w-full shrink-0 rounded-xl border-[#1e2a45] bg-[#0D1326] text-white sm:w-64"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 text-sm font-medium text-white">{t("settings.tax_pricing_method")}</p>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {(
                      [
                        ["inclusive", "settings.tax_prices_include"],
                        ["exclusive", "settings.tax_prices_exclude"],
                      ] as const
                    ).map(([id, labelKey]) => {
                      const selected = draft.pricingMode === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => setPricing(id)}
                          className={cn(
                            "h-11 rounded-xl border px-4 text-sm font-medium",
                            selected
                              ? "border-brand bg-brand"
                              : "border-[#d5dbe6] bg-white text-[#0f172a]",
                          )}
                          style={selected ? { color: "#ffffff" } : undefined}
                        >
                          {t(labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="flex min-w-0 items-start gap-2 rounded-xl bg-brand/10 px-3 py-2.5 text-xs leading-relaxed text-brand-active">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 whitespace-normal break-words">
                    {t("settings.tax_pricing_note")}
                  </span>
                </p>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">{t("settings.tax_rates_title")}</h2>
                  <p className="mt-0.5 text-xs text-[#8b93a7]">{t("settings.tax_rates_lead")}</p>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="text-[11px] text-[#8b93a7]">
                      <th className="pb-2 font-medium">{t("settings.tax_col_name")}</th>
                      <th className="pb-2 font-medium">{t("settings.tax_col_rate")}</th>
                      <th className="pb-2 font-medium">{t("settings.tax_col_applies")}</th>
                      <th className="pb-2 font-medium">{t("settings.tax_col_status")}</th>
                      <th className="pb-2 font-medium">{t("settings.tax_col_actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.rates.map((rate) => {
                      const on = draft.enabledRateIds.includes(rate.id);
                      const pct = formatTaxPercent(ratePercent(rate, draft));
                      return (
                        <tr key={rate.id} className="border-t border-[#1e2a45]">
                          <td className="py-3 text-sm font-medium text-white">{t(rate.nameKey)}</td>
                          <td className="py-3">
                            {rate.flexiblePercent && on ? (
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={draft.customPercent ?? 0}
                                disabled={!isAdmin}
                                onChange={(event) =>
                                  setDraft({ ...draft, customPercent: Number(event.target.value) })
                                }
                                className="h-8 w-20 border-[#1e2a45] bg-[#0D1326] text-sm text-brand"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-brand">{pct}%</span>
                            )}
                          </td>
                          <td className="py-3 text-sm text-[#8b93a7]">
                            {rate.hintKey ? t(rate.hintKey) : t("settings.tax_applies_all")}
                          </td>
                          <td className="py-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-xs font-semibold",
                                on ? "text-emerald-600" : "text-[#8b93a7]",
                              )}
                            >
                              <span className={cn("size-1.5 rounded-full", on ? "bg-emerald-500" : "bg-[#94a3b8]")} />
                              {on ? t("settings.tax_active") : t("settings.tax_inactive")}
                            </span>
                          </td>
                          <td className="relative py-3">
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => setOpenRow(openRow === rate.id ? null : rate.id)}
                              className="flex size-8 items-center justify-center rounded-full text-[#8b93a7] hover:bg-[#1e2a45]/30"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                            {openRow === rate.id ? (
                              <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-[#1e2a45] bg-[#131A2E] p-1 shadow-lg">
                                <button
                                  type="button"
                                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-[#1e2a45]/30"
                                  onClick={() => {
                                    if (on) setDraft({ ...draft, defaultRateId: rate.id });
                                    setOpenRow(null);
                                  }}
                                >
                                  {t("settings.tax_set_default")}
                                </button>
                                <button
                                  type="button"
                                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-[#1e2a45]/30"
                                  onClick={() => {
                                    toggleRate(rate.id, !on);
                                    setOpenRow(null);
                                  }}
                                >
                                  {on ? t("settings.tax_turn_off") : t("settings.tax_turn_on")}
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="min-w-0 space-y-4">
            <section className="rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-5">
              <h2 className="text-base font-semibold text-white">{t("settings.tax_behavior_title")}</h2>
              <p className="mt-0.5 text-xs text-[#8b93a7]">{t("settings.tax_behavior_lead")}</p>
              <div className="mt-4 space-y-1.5">
                <Label className="text-sm text-white">{t("settings.tax_default_rate_label")}</Label>
                <p className="text-xs text-[#8b93a7]">{t("settings.tax_default_rate_desc")}</p>
                <TaxRateMenu
                  value={draft.defaultRateId}
                  disabled={!isAdmin}
                  options={enabledRates.map((rate) => ({
                    value: rate.id,
                    label: `${t(rate.nameKey)} ${formatTaxPercent(ratePercent(rate, draft))}%`,
                  }))}
                  onChange={(rateId) => setDraft({ ...draft, defaultRateId: rateId })}
                />
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  <div>
                    <p className="text-sm font-medium text-white">{t("settings.tax_auto_apply")}</p>
                    <p className="text-xs text-[#8b93a7]">{t("settings.tax_auto_apply_desc")}</p>
                  </div>
                </div>
                <button type="button" onClick={onOpenMenu} className="flex gap-2 text-left">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  <div>
                    <p className="text-sm font-medium text-white">{t("settings.tax_item_override")}</p>
                    <p className="text-xs text-[#8b93a7]">{t("settings.tax_item_override_desc")}</p>
                  </div>
                </button>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#1e2a45] bg-[#131A2E] p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-brand" />
                <h2 className="text-base font-semibold text-white">{t("settings.tax_summary_title")}</h2>
              </div>
              <p className="mt-0.5 text-xs text-[#8b93a7]">{t("settings.tax_summary_lead")}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[#0D1326] px-2 py-3 text-center">
                  <p className="text-xl font-bold text-brand">{enabledRates.length}</p>
                  <p className="mt-1 text-[11px] text-[#8b93a7]">{t("settings.tax_summary_active")}</p>
                </div>
                <div className="rounded-xl bg-[#0D1326] px-2 py-3 text-center">
                  <p className="text-xl font-bold text-brand">
                    {standardRate ? `${formatTaxPercent(ratePercent(standardRate, draft))}%` : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8b93a7]">{t("settings.tax_summary_standard")}</p>
                </div>
                <div className="rounded-xl bg-[#0D1326] px-2 py-3 text-center">
                  <p className="text-xl font-bold text-brand">
                    {zeroRate && draft.enabledRateIds.includes(zeroRate.id)
                      ? `${formatTaxPercent(ratePercent(zeroRate, draft))}%`
                      : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8b93a7]">{t("settings.tax_summary_zero")}</p>
                </div>
              </div>
              <p className="mt-3 flex gap-2 text-xs text-[#8b93a7]">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {t("settings.tax_summary_note")}
              </p>
            </section>
          </div>
        </div>
      ) : null}

      <p className="flex items-center gap-2 rounded-2xl border border-brand/25 bg-brand/10 px-4 py-3 text-sm text-brand-active">
        <Shield className="size-4 shrink-0 text-brand" />
        {t("settings.tax_footer_note")}
      </p>
    </div>
  );
}

function TaxRateMenu({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { theme } = usePosTheme();
  const light = theme === "light";
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value) ?? options[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-sm font-medium disabled:opacity-60",
          light
            ? "border-[#d5dbe6] bg-white text-[#0f172a]"
            : "border-[#1e2a45] bg-[#131A2E] text-white",
        )}
      >
        <Percent className="size-4 shrink-0 text-[#64748b]" />
        <span className="min-w-0 flex-1 truncate text-left">{current?.label ?? ""}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-[#64748b] transition-transform", open && "rotate-180")} />
      </PopoverTrigger>
      <PopoverContent
        data-pos-theme={theme}
        align="start"
        className={cn(
          "w-[var(--radix-popover-trigger-width)] rounded-2xl p-1.5 shadow-[0_16px_40px_rgb(15_23_42/10%)]",
          light ? "border-[#e2e8f0] bg-white text-[#0f172a]" : "border-[#1e2a45] bg-[#131A2E]",
        )}
      >
        <div className="space-y-0.5">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium",
                  active
                    ? light
                      ? "bg-[#f1f5f9] text-[#0f172a]"
                      : "bg-[#1e2a45]"
                    : light
                      ? "text-[#0f172a] hover:bg-[#f8fafc]"
                      : "hover:bg-[#1e2a45]",
                )}
              >
                <Percent className="size-4 shrink-0 text-[#64748b]" />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {active ? <Check className="size-4 shrink-0 text-[#0f172a]" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}
