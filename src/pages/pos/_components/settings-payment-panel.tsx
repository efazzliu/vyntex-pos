import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import {
  Banknote,
  ChevronRight,
  CreditCard,
  Info,
  Link2,
  Monitor,
  QrCode,
  RotateCcw,
  Save,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  LOCKED_PAY_METHODS,
  type PayMethodKey,
  type PosPaymentSettings,
} from "@/lib/pos-payment-handling.ts";
import { BRAND } from "@/lib/brand-colors.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

const METHOD_META: {
  id: PayMethodKey;
  icon: LucideIcon;
  color: string;
  titleKey: string;
  descKey: string;
}[] = [
  {
    id: "cash",
    icon: Banknote,
    color: BRAND.primary,
    titleKey: "settings.pay_method_cash",
    descKey: "settings.pay_method_cash_desc",
  },
  {
    id: "card",
    icon: CreditCard,
    color: BRAND.primary,
    titleKey: "settings.pay_method_card",
    descKey: "settings.pay_method_card_desc",
  },
  {
    id: "qr",
    icon: QrCode,
    color: BRAND.primary,
    titleKey: "settings.pay_method_qr",
    descKey: "settings.pay_method_qr_desc",
  },
  {
    id: "other",
    icon: Link2,
    color: BRAND.primary,
    titleKey: "settings.pay_method_other",
    descKey: "settings.pay_method_other_desc",
  },
];

function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 items-center justify-center rounded-full text-[#8b93a7] hover:text-white"
          aria-label={label}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ChannelColHeader({
  icon: Icon,
  main,
  sub,
  infoLabel,
  infoText,
}: {
  icon: LucideIcon;
  main: string;
  sub: string;
  infoLabel: string;
  infoText: string;
}) {
  return (
    <div className="flex flex-col items-center justify-end text-center leading-tight text-[#8b93a7]">
      <span className="flex items-center gap-0.5 text-[11px] font-semibold">
        <Icon className="size-3.5 shrink-0" />
        {main}
        <InfoTip label={infoLabel} text={infoText} />
      </span>
      <span className="text-[10px] font-medium">{sub}</span>
    </div>
  );
}

function methodGridClass(hasPhoneApp: boolean) {
  return hasPhoneApp
    ? "grid grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_1.5rem] items-center gap-x-8"
    : "grid grid-cols-[minmax(0,1fr)_7.5rem_1.5rem] items-center gap-x-8";
}

type SettingsPaymentPanelProps = {
  t: Translate;
  settings: PosPaymentSettings;
  saving: boolean;
  isAdmin: boolean;
  hasPhoneApp?: boolean;
  onChange: (next: PosPaymentSettings) => void;
  onReset: () => void;
  onSave: () => void;
};

export default function SettingsPaymentPanel({
  t,
  settings,
  saving,
  isAdmin,
  hasPhoneApp = true,
  onChange,
  onReset,
  onSave,
}: SettingsPaymentPanelProps) {
  const setChannel = (
    method: PayMethodKey,
    channel: "pos" | "phone",
    value: boolean,
  ) => {
    if (LOCKED_PAY_METHODS.includes(method)) return;
    const nextPos = { ...settings.channels.pos };
    const nextPhone = { ...settings.channels.phone };
    if (channel === "pos") nextPos[method] = value;
    else nextPhone[method] = value;
    if (!nextPos.cash && !nextPos.card) {
      if (method === "cash") nextPos.card = true;
      else nextPos.cash = true;
    }
    onChange({
      ...settings,
      channels: { pos: nextPos, phone: nextPhone },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand/15">
            <Wallet className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight text-white">
              {t("settings.pay_heading")}
            </h1>
            <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-[#8b93a7]">
              {t("settings.pay_lead")}
            </p>
            {!isAdmin ? (
              <p className="mt-2 text-xs text-amber-400/90">
                {t("settings.manager_payments_hint")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-[#2a3a5a] bg-[#131A2E] px-4 text-white hover:bg-[#1e2a45] hover:text-white"
              onClick={onReset}
              disabled={saving}
            >
              <RotateCcw className="size-4" />
              {t("settings.pay_reset")}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full bg-brand px-4 hover:bg-brand-hover"
              onClick={onSave}
              disabled={saving}
            >
              <Save className="size-4" />
              {saving ? "…" : t("settings.save_changes")}
            </Button>
          </div>
      </div>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6">
        <div className={cn(methodGridClass(hasPhoneApp), "mb-1 items-end pb-3")}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/12">
              <CreditCard className="size-5 text-brand" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">
                {t("settings.pay_methods_title")}
              </h2>
              <p className="mt-0.5 text-sm leading-relaxed text-[#8b93a7]">
                {t("settings.pay_methods_lead")}
              </p>
            </div>
          </div>
          <ChannelColHeader
            icon={Monitor}
            main={t("settings.pay_col_pos_main")}
            sub={t("settings.pay_col_pos_sub")}
            infoLabel={t("settings.pay_col_pos")}
            infoText={t("settings.pay_pos_info")}
          />
          {hasPhoneApp ? (
            <ChannelColHeader
              icon={Smartphone}
              main={t("settings.pay_col_phone_main")}
              sub={t("settings.pay_col_phone_sub")}
              infoLabel={t("settings.pay_col_phone")}
              infoText={t("settings.pay_phone_info")}
            />
          ) : null}
          <span />
        </div>

        {METHOD_META.map((item) => {
          const Icon = item.icon;
          const inactive = LOCKED_PAY_METHODS.includes(item.id);
          return (
            <div
              key={item.id}
              className={cn(
                methodGridClass(hasPhoneApp),
                "border-t border-[#1e2a45] py-4",
                inactive && "opacity-55",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${item.color}22` }}
                >
                  <Icon className="size-5" style={{ color: item.color }} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{t(item.titleKey)}</p>
                  <p className="text-xs text-[#8b93a7]">{t(item.descKey)}</p>
                </div>
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={inactive ? false : settings.channels.pos[item.id]}
                  disabled={inactive}
                  onCheckedChange={(v) => setChannel(item.id, "pos", v)}
                  className="data-[state=checked]:border-brand data-[state=checked]:bg-brand"
                />
              </div>
              {hasPhoneApp ? (
                <div className="flex justify-center">
                  <Switch
                    checked={inactive ? false : settings.channels.phone[item.id]}
                    disabled={inactive}
                    onCheckedChange={(v) => setChannel(item.id, "phone", v)}
                    className="data-[state=checked]:border-brand data-[state=checked]:bg-brand"
                  />
                </div>
              ) : null}
              <ChevronRight className="size-4 justify-self-end text-[#5a6580]" />
            </div>
          );
        })}
      </section>
    </div>
  );
}
