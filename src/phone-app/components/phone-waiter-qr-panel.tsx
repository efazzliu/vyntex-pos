import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { Check, Clock, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { getOrCreateDeviceId } from "@/lib/local-db.ts";
import {
  buildWaiterPairQrPayload,
  createWaiterPairCode,
} from "@/lib/supabase-pos/waiter-phone-pair.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

type PhoneWaiterQrPanelProps = {
  licenseKey: string;
};

export default function PhoneWaiterQrPanel({ licenseKey }: PhoneWaiterQrPanelProps) {
  const { t } = useTranslation("site");
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const key = licenseKey.trim();
    if (!key) return;
    setBusy(true);
    setError("");
    try {
      const deviceId = await getOrCreateDeviceId();
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
        pos_not_authorized: t("phone.staff.qrErrLicense"),
        migration_missing: t("phone.staff.qrErrMigration"),
        no_supabase: t("phone.staff.qrErrServer"),
      };
      const friendly = map[msg] ?? t("phone.staff.qrErrGeneric");
      setError(friendly);
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
    if (remainingSec === 0 && code) void refresh();
  }, [remainingSec, code, refresh]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const copyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("phone.staff.qrErrGeneric"));
    }
  }, [code, t]);

  const mins = remainingSec != null ? Math.floor(remainingSec / 60) : null;
  const secs = remainingSec != null ? remainingSec % 60 : null;
  const expireLabel =
    mins != null && secs != null
      ? t("phone.staff.qrExpires", { time: `${mins}:${String(secs).padStart(2, "0")}` })
      : null;
  const timerUrgent = remainingSec != null && remainingSec <= 60;

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#0f172a]">{t("phone.staff.qrTitle")}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t("phone.staff.qrHint")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void refresh()}
          className="h-9 shrink-0 rounded-xl"
        >
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
        </Button>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl bg-white p-2 shadow-inner ring-1 ring-slate-200">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={t("phone.staff.qrTitle")} className="size-[196px]" />
          ) : (
            <div className="flex size-[196px] items-center justify-center rounded-xl bg-slate-100">
              <Loader2 className="size-7 animate-spin text-[#0066FF]" />
            </div>
          )}
        </div>
        <p className="font-mono text-2xl font-bold tracking-[0.18em] text-slate-900 tabular-nums">
          {code ?? "········"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!code}
            onClick={() => void copyCode()}
            className="h-9 rounded-xl"
          >
            {copied ? <Check className="mr-1.5 size-3.5 text-emerald-600" /> : <Copy className="mr-1.5 size-3.5" />}
            {copied ? t("phone.staff.qrCopied") : t("phone.staff.qrCopy")}
          </Button>
          {expireLabel ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                timerUrgent ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600",
              )}
            >
              <Clock className="size-3.5" />
              {expireLabel}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
