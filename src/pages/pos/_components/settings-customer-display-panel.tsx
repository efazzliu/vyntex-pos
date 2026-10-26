import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { toast } from "sonner";
import {
  MonitorOff,
  MonitorSmartphone,
  Unplug,
} from "lucide-react";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import {
  closeCustomerDisplayWindow,
  openCustomerDisplayWindow,
  parsePosCustomerDisplay,
  readCustomerDisplayHardware,
  subscribeCustomerDisplay,
  writeLocalCustomerDisplay,
  type PosCustomerDisplaySettings,
} from "@/lib/pos-customer-display.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsCustomerDisplayPanelProps = {
  t: Translate;
  licenseKey: string;
  staffId?: string;
  isAdmin: boolean;
  venueName?: string;
};

const ALIVE_MS = 4000;

export default function SettingsCustomerDisplayPanel({
  t,
  licenseKey,
  staffId,
  isAdmin,
  venueName,
}: SettingsCustomerDisplayPanelProps) {
  const companyQuery = useQuery("pos.settings.getCompanyDetails", {
    licenseKey,
  });
  const updateDisplay = useMutation("pos.settings.updateCustomerDisplay");
  const parsed = parsePosCustomerDisplay(
    companyQuery && typeof companyQuery === "object" && !Array.isArray(companyQuery)
      ? (companyQuery as { customerDisplay?: unknown }).customerDisplay
      : undefined,
  );
  const [draft, setDraft] = useState<PosCustomerDisplaySettings>(parsed);
  const [saving, setSaving] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [aliveAt, setAliveAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [hardware, setHardware] = useState({
    open: false,
    extraDisplayCount: 0,
    displayLabel: null as string | null,
  });

  useEffect(() => {
    setDraft(parsed);
    writeLocalCustomerDisplay(licenseKey, parsed);
  }, [licenseKey, parsed.enabled, parsed.language, parsed.welcomeMessage, parsed.showItems, parsed.showSubtotal, parsed.showTax, parsed.showTotal, parsed.showChange]);

  useEffect(() => {
    const stop = subscribeCustomerDisplay((message) => {
      if (message.kind === "alive") setAliveAt(message.at);
    });
    const poll = window.setInterval(() => {
      void readCustomerDisplayHardware().then(setHardware);
      setNow(Date.now());
    }, 2000);
    void readCustomerDisplayHardware().then(setHardware);
    return () => {
      stop();
      window.clearInterval(poll);
    };
  }, []);

  const windowOpen = hardware.open || now - aliveAt < ALIVE_MS;
  const isElectron = Boolean(window.desktop?.isElectron);

  const persist = async (next: PosCustomerDisplaySettings) => {
    if (!isAdmin) {
      toast.error(t("settings.cd_admin_only"));
      return;
    }
    setDraft(next);
    writeLocalCustomerDisplay(licenseKey, next);
    setSaving(true);
    try {
      await updateDisplay({
        licenseKey,
        actorStaffId: staffId,
        settings: next,
      });
      toast.success(t("settings.saved"));
      if (!next.enabled) {
        await closeCustomerDisplayWindow();
        setAliveAt(0);
      }
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setSaving(false);
    }
  };

  const pair = async () => {
    if (!draft.enabled) {
      toast.error(t("settings.cd_enable_first"));
      return;
    }
    setPairing(true);
    try {
      const result = await openCustomerDisplayWindow();
      if (!result.ok) {
        if (result.error === "NO_EXTRA_DISPLAY") {
          toast.error(t("settings.cd_no_screen"));
        } else if (result.error === "POPUP_BLOCKED") {
          toast.error(t("settings.cd_popup_blocked"));
        } else {
          toast.error(t("settings.cd_pair_failed"));
        }
        return;
      }
      toast.success(t("settings.cd_pair_ok"));
      void readCustomerDisplayHardware().then(setHardware);
    } finally {
      setPairing(false);
    }
  };

  const unpair = async () => {
    await closeCustomerDisplayWindow();
    setAliveAt(0);
    void readCustomerDisplayHardware().then(setHardware);
  };

  const statusKey = windowOpen
    ? "settings.cd_status_connected"
    : isElectron && hardware.extraDisplayCount > 0
      ? "settings.cd_status_detected"
      : "settings.cd_status_disconnected";

  const hintKey = windowOpen
    ? hardware.displayLabel
      ? "settings.cd_hint_named"
      : "settings.cd_hint_window"
    : isElectron
      ? hardware.extraDisplayCount > 0
        ? "settings.cd_hint_detected"
        : "settings.cd_hint_no_screen"
      : "settings.cd_hint_browser";

  const toggleRow = (
    key: "showItems" | "showSubtotal" | "showTax" | "showTotal" | "showChange",
    labelKey: string,
    descKey: string,
  ) => (
    <label className="flex items-start justify-between gap-4 rounded-[16px] border border-[#1e2a45] bg-[#131A2E] px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-white">{t(labelKey)}</span>
        <span className="mt-0.5 block text-xs text-[#8b93a7]">{t(descKey)}</span>
      </span>
      <Switch
        checked={Boolean(draft[key])}
        disabled={!isAdmin || saving}
        onCheckedChange={(on) => void persist({ ...draft, [key]: on })}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15">
            <MonitorSmartphone className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{t("settings.cd_heading")}</h2>
            <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.cd_lead")}</p>
          </div>
        </div>
        <label className="flex items-start justify-between gap-4 rounded-[16px] border border-[#1e2a45] bg-[#131A2E] px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-white">{t("settings.cd_enable")}</span>
            <span className="mt-0.5 block text-xs text-[#8b93a7]">{t("settings.cd_enable_desc")}</span>
          </span>
          <Switch
            checked={draft.enabled}
            disabled={!isAdmin || saving}
            onCheckedChange={(on) => void persist({ ...draft, enabled: on })}
          />
        </label>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#131A2E]">
            {windowOpen ? (
              <MonitorSmartphone className="size-5 text-emerald-400" />
            ) : (
              <MonitorOff className="size-5 text-[#8b93a7]" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{t("settings.cd_status_title")}</h2>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  windowOpen
                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                    : "border-[#2a3a5a] bg-[#131A2E] text-[#8b93a7]",
                )}
              >
                {t(statusKey)}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[#8b93a7]">
              {t(hintKey, {
                name: hardware.displayLabel || venueName || "",
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!draft.enabled || pairing}
            onClick={() => void pair()}
            className="h-11 bg-brand hover:bg-brand-hover"
          >
            {t("settings.cd_pair")}
          </Button>
          {windowOpen ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void unpair()}
              className="h-11 border-[#1e2a45] bg-transparent text-white"
            >
              <Unplug className="size-4" />
              {t("settings.cd_unpair")}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold text-white">{t("settings.cd_content_title")}</h2>
        {toggleRow("showItems", "settings.cd_show_items", "settings.cd_show_items_desc")}
        {toggleRow("showSubtotal", "settings.cd_show_subtotal", "settings.cd_show_subtotal_desc")}
        {toggleRow("showTax", "settings.cd_show_tax", "settings.cd_show_tax_desc")}
        {toggleRow("showTotal", "settings.cd_show_total", "settings.cd_show_total_desc")}
        {toggleRow("showChange", "settings.cd_show_change", "settings.cd_show_change_desc")}
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold text-white">{t("settings.cd_welcome_title")}</h2>
        <p className="text-sm text-[#8b93a7]">{t("settings.cd_welcome_lead")}</p>
        <textarea
          value={draft.welcomeMessage}
          disabled={!isAdmin || saving}
          onChange={(e) => setDraft((prev) => ({ ...prev, welcomeMessage: e.target.value.slice(0, 240) }))}
          onBlur={() => {
            if (draft.welcomeMessage !== parsed.welcomeMessage) {
              void persist(draft);
            }
          }}
          rows={3}
          className="w-full rounded-xl border border-[#1e2a45] bg-[#131A2E] px-3 py-2 text-sm text-white outline-none focus:border-brand/50"
          placeholder={t("settings.cd_welcome_default")}
        />
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-semibold text-white">{t("settings.cd_lang_title")}</h2>
        <p className="text-sm text-[#8b93a7]">{t("settings.cd_lang_lead")}</p>
        <div className="flex flex-wrap gap-2">
          {(["en", "sq"] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              disabled={!isAdmin || saving}
              onClick={() => void persist({ ...draft, language: lng })}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                draft.language === lng
                  ? "border-brand/50 bg-brand/15 text-white"
                  : "border-[#1e2a45] bg-[#131A2E] text-[#8b93a7]",
              )}
            >
              {lng === "en" ? t("settings.cd_lang_en") : t("settings.cd_lang_sq")}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-white">{t("settings.cd_promo_title")}</h2>
          <span className="rounded-full border border-[#2a3a5a] bg-[#131A2E] px-2.5 py-0.5 text-[11px] font-semibold text-[#8b93a7]">
            {t("settings.cd_unavailable")}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-[#8b93a7]">{t("settings.cd_promo_lead")}</p>
      </section>
    </div>
  );
}
