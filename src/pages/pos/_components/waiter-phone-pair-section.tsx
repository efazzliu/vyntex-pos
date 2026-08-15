import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { getActivation, getOrCreateDeviceId } from "@/lib/local-db.ts";
import {
  buildWaiterPairQrPayload,
  createWaiterPairCode,
} from "@/lib/supabase-pos/waiter-phone-pair.ts";
import posI18n from "../_lib/pos-i18n.ts";

type WaiterPhonePairSectionProps = {
  licenseKey: string;
};

export default function WaiterPhonePairSection({
  licenseKey,
}: WaiterPhonePairSectionProps) {
  const t = useCallback(
    (key: string, opts?: Record<string, unknown>) => posI18n.t(key, opts),
    [],
  );

  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const activation = await getActivation();
      const deviceId =
        activation?.deviceId?.trim() || (await getOrCreateDeviceId());
      const key =
        (activation?.licenseKey || licenseKey).trim().toUpperCase();
      if (!key) throw new Error("missing_license");
      const result = await createWaiterPairCode(key, deviceId);
      setCode(result.code);
      setExpiresAt(result.expiresAt);
      const payload = buildWaiterPairQrPayload(result.code);
      const url = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 280,
        color: { dark: "#0A0F1E", light: "#FFFFFF" },
      });
      setQrDataUrl(url);
    } catch (err) {
      setCode(null);
      setExpiresAt(null);
      setQrDataUrl(null);
      const msg = err instanceof Error ? err.message : "unknown";
      const map: Record<string, string> = {
        pos_not_authorized: t("settings.waiter_pair_err_pos"),
        migration_missing: t("settings.waiter_pair_err_migration"),
        no_supabase: t("settings.waiter_pair_err_server"),
        missing_license: t("settings.waiter_pair_err_generic"),
      };
      const friendly = map[msg] ?? (msg.length < 120 ? msg : t("settings.waiter_pair_err_generic"));
      setLoadError(friendly);
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  }, [licenseKey, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSec(null);
      return;
    }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemainingSec(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (remainingSec === 0 && code) {
      void refresh();
    }
  }, [remainingSec, code, refresh]);

  const mins = remainingSec != null ? Math.floor(remainingSec / 60) : null;
  const secs = remainingSec != null ? remainingSec % 60 : null;

  return (
    <section className="rounded-xl border border-[#1e2a45] bg-[#0D1326] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Smartphone className="size-5 text-[#0066FF]" />
            {t("settings.waiter_pair_title")}
          </h2>
          <p className="mt-1 text-sm text-[#8b93a7] max-w-xl">
            {t("settings.waiter_pair_desc")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void refresh()}
          className="border-[#2a3a5a] text-[#8b93a7] hover:text-white shrink-0"
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${busy ? "animate-spin" : ""}`} />
          {t("settings.waiter_pair_refresh")}
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <p>{loadError}</p>
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="rounded-2xl bg-white p-3 shadow-lg shadow-black/30">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={t("settings.waiter_pair_qr_alt")}
              className="size-[200px] sm:size-[220px]"
            />
          ) : (
            <div className="flex size-[200px] sm:size-[220px] items-center justify-center rounded-lg bg-slate-200 text-center text-xs font-medium text-slate-500 px-4">
              {busy
                ? "…"
                : loadError
                  ? t("settings.waiter_pair_refresh")
                  : "…"}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 text-center sm:text-left w-full">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5a6580]">
            {t("settings.waiter_pair_code_label")}
          </p>
          <p className="font-mono text-3xl sm:text-4xl font-semibold tracking-[0.2em] text-white">
            {code ?? "········"}
          </p>
          {mins != null && secs != null ? (
            <p className="text-xs text-[#8b93a7]">
              {t("settings.waiter_pair_expires", {
                time: `${mins}:${String(secs).padStart(2, "0")}`,
              })}
            </p>
          ) : null}
          <p className="text-sm text-[#8b93a7] leading-relaxed">
            {t("settings.waiter_pair_howto")}
          </p>
        </div>
      </div>
    </section>
  );
}
