import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Clock, Copy, KeyRound, RefreshCw, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { getActivation, getOrCreateDeviceId } from "@/lib/local-db.ts";
import {
  buildWaiterPairQrPayload,
  createWaiterPairCode,
} from "@/lib/supabase-pos/waiter-phone-pair.ts";
import {
  approveWaiterLicenseRequest,
  listWaiterLicenseRequests,
  rejectWaiterLicenseRequest,
  type WaiterLicensePendingRow,
} from "@/lib/supabase-pos/waiter-phone-license-request.ts";
import posI18n from "../_lib/pos-i18n.ts";

type WaiterPhonePairSectionProps = {
  licenseKey: string;
  canActivate?: boolean;
};

export default function WaiterPhonePairSection({
  licenseKey,
  canActivate = true,
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
  const [pendingPhones, setPendingPhones] = useState<WaiterLicensePendingRow[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pendingCountRef = useRef(0);
  const posIdsRef = useRef<{ licenseKey: string; deviceId: string } | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  const resolvePosIds = useCallback(async () => {
    const activation = await getActivation();
    const deviceId =
      activation?.deviceId?.trim() || (await getOrCreateDeviceId());
    const key = (activation?.licenseKey || licenseKey).trim().toUpperCase();
    if (!key) throw new Error("missing_license");
    posIdsRef.current = { licenseKey: key, deviceId };
    return { licenseKey: key, deviceId };
  }, [licenseKey]);

  const refreshPending = useCallback(async (opts?: { quiet?: boolean }) => {
    try {
      const ids = posIdsRef.current ?? (await resolvePosIds());
      const rows = await listWaiterLicenseRequests(ids.licenseKey, ids.deviceId);
      if (!opts?.quiet && rows.length > pendingCountRef.current) {
        toast.info(t("settings.waiter_pair_license_new"));
      }
      pendingCountRef.current = rows.length;
      setPendingPhones(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "migration_missing") return;
      if (!opts?.quiet) {
        /* QR path already surfaces generic errors */
      }
    }
  }, [resolvePosIds, t]);

  const refresh = useCallback(async () => {
    setBusy(true);
    setLoadError(null);
    try {
      const ids = await resolvePosIds();
      const result = await createWaiterPairCode(ids.licenseKey, ids.deviceId);
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
  }, [resolvePosIds, t]);

  useEffect(() => {
    if (!canActivate) return;
    void refresh();
    void refreshPending({ quiet: true });
  }, [canActivate, refresh, refreshPending]);

  useEffect(() => {
    if (!canActivate) return;
    const id = window.setInterval(() => {
      void refreshPending({ quiet: false });
    }, 4000);
    return () => window.clearInterval(id);
  }, [canActivate, refreshPending]);

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
    if (!canActivate) return;
    if (remainingSec === 0 && code) {
      void refresh();
    }
  }, [canActivate, remainingSec, code, refresh]);

  const mins = remainingSec != null ? Math.floor(remainingSec / 60) : null;
  const secs = remainingSec != null ? remainingSec % 60 : null;
  const timerUrgent = remainingSec != null && remainingSec <= 60;
  const timerWarn = remainingSec != null && remainingSec <= 180 && remainingSec > 60;

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
      toast.error(t("settings.waiter_pair_err_generic"));
    }
  }, [code, t]);

  const decidePending = async (requestId: string, action: "approve" | "reject") => {
    setActingId(requestId);
    try {
      const ids = posIdsRef.current ?? (await resolvePosIds());
      if (action === "approve") {
        await approveWaiterLicenseRequest(ids.licenseKey, ids.deviceId, requestId);
        toast.success(t("settings.waiter_pair_license_approved"));
      } else {
        await rejectWaiterLicenseRequest(ids.licenseKey, ids.deviceId, requestId);
        toast.success(t("settings.waiter_pair_license_rejected"));
      }
      await refreshPending({ quiet: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      const map: Record<string, string> = {
        pos_not_authorized: t("settings.waiter_pair_err_pos"),
        phone_limit: t("settings.waiter_pair_license_limit"),
        request_expired: t("settings.waiter_pair_license_expired"),
        request_not_pending: t("settings.waiter_pair_license_expired"),
        migration_missing: t("settings.waiter_pair_err_migration"),
      };
      toast.error(map[msg] ?? t("settings.waiter_pair_err_generic"));
    } finally {
      setActingId(null);
    }
  };

  if (!canActivate) {
    return (
      <section className="rounded-2xl border border-[#1e2a45] bg-[#0D1326] p-6 space-y-2">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Smartphone className="size-5 text-[#0066FF]" />
          {t("settings.waiter_pair_title")}
        </h2>
        <p className="text-sm text-[#8b93a7]">
          {t("settings.waiter_pair_desc")}
        </p>
        <p className="text-xs text-amber-400/90">
          {t("settings.admin_only_device_activation")}
        </p>
      </section>
    );
  }

  const expireLabel =
    mins != null && secs != null
      ? t("settings.waiter_pair_expires", {
          time: `${mins}:${String(secs).padStart(2, "0")}`,
        })
      : null;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#0066FF]/15">
                <Smartphone className="size-4 text-[#0066FF]" />
              </span>
              {t("settings.waiter_pair_title")}
            </h2>
            <p className="mt-2 text-sm text-[#8b93a7] max-w-2xl leading-relaxed">
              {t("settings.waiter_pair_desc")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void refresh()}
            className="border-[#2a3a5a] text-[#0066FF] hover:border-[#0066FF]/40 hover:text-[#0066FF] shrink-0"
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

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[#1e2a45] bg-[#0A0F1E] px-5 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5a6580]">
              {t("settings.waiter_pair_scan_label")}
            </p>
            <div className="rounded-2xl bg-white p-3 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.45)]">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={t("settings.waiter_pair_qr_alt")}
                  className="size-[176px] sm:size-[196px]"
                />
              ) : (
                <div className="flex size-[176px] sm:size-[196px] items-center justify-center rounded-lg bg-slate-200 text-center text-xs font-medium text-slate-500 px-4">
                  {busy || loadError ? t("settings.waiter_pair_refresh") : "…"}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center py-1 lg:px-1">
            <span className="inline-flex size-10 items-center justify-center rounded-full border border-[#1e2a45] bg-[#0D1326] text-[10px] font-bold tracking-[0.12em] text-[#5a6580]">
              {t("settings.waiter_pair_or")}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[#1e2a45] bg-[#0A0F1E] px-5 py-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5a6580]">
              {t("settings.waiter_pair_code_label")}
            </p>
            <p className="font-mono text-[2rem] sm:text-4xl font-bold tracking-[0.18em] text-white tabular-nums">
              {code ?? "········"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!code}
                onClick={() => void copyCode()}
                className="border-[#2a3a5a] text-[#8b93a7] hover:text-white"
              >
                {copied ? (
                  <Check className="size-3.5 mr-1.5 text-[#44CC00]" />
                ) : (
                  <Copy className="size-3.5 mr-1.5" />
                )}
                {copied
                  ? t("settings.waiter_pair_copied")
                  : t("settings.waiter_pair_copy")}
              </Button>
              {expireLabel ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    timerUrgent
                      ? "bg-red-500/10 text-red-400"
                      : timerWarn
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-[#1e2a45] text-[#8b93a7]",
                  )}
                >
                  <Clock className="size-3.5" />
                  {expireLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {(
            [
              "settings.waiter_pair_step1",
              "settings.waiter_pair_step2",
              "settings.waiter_pair_step3",
            ] as const
          ).map((key, i) => (
            <li
              key={key}
              className="flex items-start gap-3 rounded-xl border border-[#1e2a45] bg-[#0A0F1E] px-3.5 py-3"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0066FF]/15 text-xs font-bold text-[#0066FF]">
                {i + 1}
              </span>
              <p className="text-sm leading-snug text-[#8b93a7] pt-0.5">{t(key)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0066FF]/15">
            <KeyRound className="size-4 text-[#0066FF]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                {t("settings.waiter_pair_license_title")}
              </p>
              {pendingPhones.length > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0066FF] px-1.5 text-[10px] font-bold text-white">
                  {pendingPhones.length}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[#8b93a7]">
              {t("settings.waiter_pair_license_desc")}
            </p>
          </div>
        </div>

        {pendingPhones.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1e2a45] bg-[#0A0F1E] px-4 py-10 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-[#1e2a45]">
              <Smartphone className="size-5 text-[#5a6580]" />
            </div>
            <p className="text-sm text-[#8b93a7]">
              {t("settings.waiter_pair_license_empty")}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pendingPhones.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[#1e2a45] bg-[#0A0F1E] px-3.5 py-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0066FF]/15">
                  <Smartphone className="size-4 text-[#0066FF]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {row.displayName || row.phoneDeviceId.slice(0, 10)}
                  </p>
                  <p className="text-[11px] text-[#8b93a7]">
                    {[row.os, t("settings.waiter_pair_license_waiting")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={actingId === row.id}
                  onClick={() => void decidePending(row.id, "approve")}
                  className="h-8 bg-[#44CC00] px-2.5 text-[#06200a] hover:bg-[#3bb300]"
                >
                  <Check className="size-3.5 mr-1" />
                  {t("settings.waiter_pair_license_approve")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actingId === row.id}
                  onClick={() => void decidePending(row.id, "reject")}
                  className="h-8 border-red-500/30 px-2.5 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                >
                  <X className="size-3.5 mr-1" />
                  {t("settings.waiter_pair_license_reject")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
