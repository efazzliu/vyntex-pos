import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { Switch } from "@/components/ui/switch.tsx";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Package,
  RotateCcw,
  Save,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  parsePosStockRules,
  readLocalPosStockRules,
  writeLocalEnforceOrderAvailability,
  writeLocalPosStockRules,
  type PosStockRules,
} from "@/lib/pos-order-availability.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsInventoryPanelProps = {
  t: Translate;
  licenseKey: string;
  isAdmin: boolean;
  onOpenStock: () => void;
};

const cardClass =
  "rounded-[22px] border border-[#e6edf5] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

function clampThreshold(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LOW_STOCK_THRESHOLD;
  return Math.min(9999, Math.max(0, Math.round(n)));
}

export default function SettingsInventoryPanel({
  t,
  licenseKey,
  isAdmin,
  onOpenStock,
}: SettingsInventoryPanelProps) {
  const companyQuery = useQuery("pos.settings.getCompanyDetails", { licenseKey });
  const updateRules = useMutation("pos.settings.updateOrderAvailabilitySettings");
  const company =
    companyQuery && typeof companyQuery === "object" && !Array.isArray(companyQuery)
      ? (companyQuery as {
          enforceOrderAvailability?: boolean;
          stockRules?: unknown;
        })
      : null;
  const parsed =
    company && company.stockRules != null
      ? parsePosStockRules(company.stockRules)
      : readLocalPosStockRules(licenseKey);
  const cloudHonor = company?.enforceOrderAvailability === true;
  const serverKey = company
    ? `${cloudHonor}|${parsed.blockOutOfStock}|${parsed.defaultLowStockThreshold}`
    : "";

  const [honorKitchenStop, setHonorKitchenStop] = useState(cloudHonor);
  const [blockOutOfStock, setBlockOutOfStock] = useState(parsed.blockOutOfStock);
  const [thresholdDraft, setThresholdDraft] = useState(String(parsed.defaultLowStockThreshold));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const editingRef = useRef(false);

  const touch = () => {
    editingRef.current = true;
    setSaved(false);
  };

  useEffect(() => {
    if (!company || editingRef.current) return;
    setHonorKitchenStop(cloudHonor);
    setBlockOutOfStock(parsed.blockOutOfStock);
    setThresholdDraft(String(parsed.defaultLowStockThreshold));
    writeLocalEnforceOrderAvailability(licenseKey, cloudHonor);
    writeLocalPosStockRules(licenseKey, parsed);
  }, [licenseKey, serverKey]);

  const threshold = clampThreshold(thresholdDraft);
  const dirty =
    honorKitchenStop !== cloudHonor ||
    blockOutOfStock !== parsed.blockOutOfStock ||
    threshold !== parsed.defaultLowStockThreshold;
  const locked = !isAdmin || saving;

  const discard = () => {
    editingRef.current = false;
    setHonorKitchenStop(cloudHonor);
    setBlockOutOfStock(parsed.blockOutOfStock);
    setThresholdDraft(String(parsed.defaultLowStockThreshold));
    setSaved(false);
  };

  const save = async () => {
    if (!isAdmin) {
      toast.error(t("settings.availability_admin_only"));
      return;
    }
    const next: PosStockRules = {
      blockOutOfStock,
      defaultLowStockThreshold: threshold,
    };
    setSaving(true);
    try {
      await updateRules({
        licenseKey,
        enforce: honorKitchenStop,
        blockOutOfStock: next.blockOutOfStock,
        defaultLowStockThreshold: next.defaultLowStockThreshold,
      });
      writeLocalEnforceOrderAvailability(licenseKey, honorKitchenStop);
      writeLocalPosStockRules(licenseKey, next);
      setThresholdDraft(String(next.defaultLowStockThreshold));
      editingRef.current = false;
      setSaved(true);
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e7f0ff] text-brand">
            <Package className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-[#0f172a]">
            {t("settings.cat.inventory")}
          </h1>
          <p className="mt-0.5 text-sm text-[#64748b]">{t("settings.inv_page_lead")}</p>
          {!isAdmin ? (
            <p className="mt-1 text-xs text-[#d97706]">{t("settings.availability_admin_only")}</p>
          ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={discard}
            disabled={!dirty || saving}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e6edf5] bg-white px-4 text-sm font-medium text-[#0f172a] disabled:opacity-50"
          >
            <RotateCcw className="size-4" />
            {t("settings.discard_changes")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !isAdmin}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold disabled:opacity-50"
            style={{ color: "#ffffff" }}
          >
            <Save className="size-4" />
            {saving ? "…" : t("settings.save_changes")}
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-4 rounded-[22px] border border-[#e6edf5] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:gap-0 lg:px-2">
        <StatusCell
          icon={<Send className="size-4" />}
          label={t("settings.inv_bar_deduct")}
          value={t("settings.inv_deduct_send")}
        />
        <StatusRule />
        <StatusCell
          icon={<Ban className="size-4" />}
          label={t("settings.inv_oos_title")}
          value={blockOutOfStock ? t("settings.inv_summary_block") : t("settings.inv_summary_allow")}
        />
        <StatusRule />
        <StatusCell
          icon={<ChefHat className="size-4" />}
          label={t("settings.inv_bar_kitchen")}
          value={honorKitchenStop ? t("settings.inv_summary_kitchen_on") : t("settings.inv_summary_kitchen_off")}
        />
        <StatusRule />
        <StatusCell
          icon={<AlertTriangle className="size-4" />}
          label={t("settings.inv_bar_threshold")}
          value={String(threshold)}
        />
        {saved && !dirty ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 px-3 text-xs font-semibold text-[#16a34a] lg:ml-auto">
            <span className="size-1.5 rounded-full bg-[#16a34a]" />
            {t("settings.inv_saved")}
          </span>
        ) : null}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <section className={cardClass}>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
                <Send className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-[#0f172a]">{t("settings.inv_deduct_title")}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{t("settings.inv_deduct_lead")}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
              <p className="text-sm font-semibold text-[#0f172a]">{t("settings.inv_deduct_send")}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{t("settings.inv_deduct_send_desc")}</p>
            </div>
            <p className="mt-3 border-t border-[#eef2f6] pt-3 text-xs leading-relaxed text-[#64748b]">
              {t("settings.inv_deduct_recipe_desc")}
            </p>
          </section>

          <section className={cardClass}>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
                <Ban className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-[#0f172a]">{t("settings.inv_oos_title")}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{t("settings.inv_oos_lead")}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <Choice
                selected={blockOutOfStock}
                disabled={locked}
                title={t("settings.inv_block_oos")}
                desc={t("settings.inv_block_oos_desc")}
                onClick={() => {
                  setBlockOutOfStock(true);
                  touch();
                }}
              />
              <Choice
                selected={!blockOutOfStock}
                disabled={locked}
                title={t("settings.inv_allow_oos")}
                desc={t("settings.inv_allow_oos_desc")}
                onClick={() => {
                  setBlockOutOfStock(false);
                  touch();
                }}
              />
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
                  <ChefHat className="size-4" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-[#0f172a]">{t("settings.inv_kitchen_title")}</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">
                    {honorKitchenStop ? t("settings.inv_kitchen_on") : t("settings.inv_kitchen_off")}
                  </p>
                </div>
              </div>
              <Switch
                checked={honorKitchenStop}
                disabled={locked}
                onCheckedChange={(on) => {
                  setHonorKitchenStop(on);
                  touch();
                }}
                className="data-[state=checked]:border-brand data-[state=checked]:bg-brand"
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className={cardClass}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
                  <AlertTriangle className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-[#0f172a]">{t("settings.inv_threshold_title")}</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#64748b]">{t("settings.inv_threshold_lead")}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex h-11 items-stretch overflow-hidden rounded-xl border border-[#e6edf5] bg-white">
                  <span className="flex w-12 items-center justify-center text-sm font-semibold tabular-nums text-[#0f172a]">
                    {threshold}
                  </span>
                  <div className="flex w-7 flex-col border-l border-[#e6edf5]">
                    <button
                      type="button"
                      disabled={locked || threshold >= 9999}
                      onClick={() => {
                        setThresholdDraft(String(Math.min(9999, threshold + 1)));
                        touch();
                      }}
                      className="flex flex-1 items-center justify-center text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-40"
                    >
                      <ChevronUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      disabled={locked || threshold <= 0}
                      onClick={() => {
                        setThresholdDraft(String(Math.max(0, threshold - 1)));
                        touch();
                      }}
                      className="flex flex-1 items-center justify-center border-t border-[#e6edf5] text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-40"
                    >
                      <ChevronDown className="size-3" />
                    </button>
                  </div>
                </div>
                <span className="text-xs text-[#64748b]">{t("settings.inv_units")}</span>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-[15px] font-semibold text-[#0f172a]">{t("settings.inv_preview_title")}</h2>
            <p className="mt-0.5 text-xs text-[#64748b]">{t("settings.inv_preview_lead")}</p>
            <div
              className={cn(
                "mt-4 rounded-2xl border px-4 py-3",
                blockOutOfStock ? "border-[#fecaca] bg-[#fef2f2]" : "border-[#fde68a] bg-[#fffbeb]",
              )}
            >
              <p className={cn("text-sm font-semibold", blockOutOfStock ? "text-[#b91c1c]" : "text-[#b45309]")}>
                {blockOutOfStock ? t("settings.inv_preview_blocked") : t("settings.inv_preview_allowed")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
                {blockOutOfStock ? t("settings.inv_preview_blocked_desc") : t("settings.inv_preview_allowed_desc")}
              </p>
            </div>
          </section>

          <button
            type="button"
            onClick={onOpenStock}
            className="flex w-full items-center gap-3 rounded-[22px] border border-[#e6edf5] bg-white px-5 py-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand">
              <Package className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#0f172a]">{t("nav.stock")}</span>
              <span className="mt-0.5 block text-xs text-[#64748b]">{t("settings.inv_stock_jump")}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
              {t("settings.open_stock")}
              <ArrowRight className="size-4" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Choice({
  selected,
  disabled,
  title,
  desc,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left disabled:opacity-60",
        selected ? "border-brand bg-brand-light" : "border-[#e6edf5] bg-white",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#0f172a]">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[#64748b]">{desc}</span>
      </span>
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-brand bg-brand" : "border-[#d5dbe6] bg-white",
        )}
      >
        {selected ? <Check className="size-3" style={{ color: "#ffffff" }} /> : null}
      </span>
    </button>
  );
}

function StatusCell({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
      <span className="flex size-9 shrink-0 items-center justify-center text-[#94a3b8]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#94a3b8]">{label}</p>
        <p className="line-clamp-2 text-sm font-medium leading-snug text-[#0f172a]">{value}</p>
      </div>
    </div>
  );
}

function StatusRule() {
  return <span className="hidden h-8 w-px shrink-0 bg-[#e6edf5] lg:block" />;
}
