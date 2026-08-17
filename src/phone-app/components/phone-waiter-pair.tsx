import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Camera, CheckCircle2, KeyRound, Keyboard, Loader2 } from "lucide-react";
import { getOrCreateDeviceId } from "@/lib/local-db.ts";
import { sendPosDeviceHeartbeat } from "@/lib/supabase-pos/device-presence.ts";
import {
  claimWaiterPhone,
  extractWaiterPairCode,
} from "@/lib/supabase-pos/waiter-phone-pair.ts";
import {
  cancelWaiterLicenseRequest,
  fetchWaiterLicenseRequestStatus,
  formatWaiterLicenseInput,
  normalizeWaiterLicenseKey,
  requestWaiterPhoneByLicense,
} from "@/lib/supabase-pos/waiter-phone-license-request.ts";
import {
  setWaiterPhonePair,
  getWaiterPhonePair,
  getWaiterLicensePending,
  setWaiterLicensePending,
  clearWaiterLicensePending,
} from "@/phone-app/lib/waiter-session.ts";
import { fetchWaiterPhoneBindingStatus } from "@/lib/supabase-pos/waiter-phone-binding.ts";
import { cn } from "@/lib/utils.ts";

type ScanPhase = "idle" | "camera" | "claiming" | "pending" | "done";

export default function PhoneWaiterPair() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  const [manual, setManual] = useState("");
  const [licenseInput, setLicenseInput] = useState("");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [error, setError] = useState("");
  const [venueName, setVenueName] = useState("");
  const claimedOnce = useRef(false);
  const licenseKeyLen = normalizeWaiterLicenseKey(licenseInput).length;

  useEffect(() => {
    const existing = getWaiterPhonePair();
    if (!existing) return;
    let cancelled = false;
    void (async () => {
      const status = await fetchWaiterPhoneBindingStatus(
        existing.licenseKey,
        existing.deviceId,
      );
      if (cancelled) return;
      if (status?.bound && !status.disconnected) {
        navigate("/waiter", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const finishPair = useCallback(
    (args: {
      licenseKey: string;
      restaurantName: string;
      deviceId: string;
      deviceRowId: string;
    }) => {
      setWaiterPhonePair({
        licenseKey: args.licenseKey,
        restaurantName: args.restaurantName,
        deviceId: args.deviceId,
        deviceRowId: args.deviceRowId,
        pairedAt: Date.now(),
      });
      clearWaiterLicensePending();
      void sendPosDeviceHeartbeat(args.licenseKey, args.deviceId);
      setVenueName(args.restaurantName);
      setPhase("done");
      setTimeout(() => navigate("/waiter", { replace: true }), 900);
    },
    [navigate],
  );

  const claim = useCallback(
    async (rawCode: string) => {
      const code = extractWaiterPairCode(rawCode);
      if (!code) {
        setError(t("phone.waiter.pairInvalidCode"));
        return;
      }
      if (claimedOnce.current) return;
      claimedOnce.current = true;
      setPhase("claiming");
      setError("");
      stopCamera();
      try {
        const deviceId = await getOrCreateDeviceId();
        const result = await claimWaiterPhone({
          code,
          phoneDeviceId: deviceId,
          displayName: undefined,
        });
        finishPair({
          licenseKey: result.licenseKey,
          restaurantName: result.restaurantName,
          deviceId,
          deviceRowId: result.deviceRowId,
        });
      } catch (err) {
        claimedOnce.current = false;
        const msg = err instanceof Error ? err.message : "unknown";
        const map: Record<string, string> = {
          code_already_used: t("phone.waiter.pairUsed"),
          code_expired: t("phone.waiter.pairExpired"),
          invalid_code: t("phone.waiter.pairInvalidCode"),
          phone_limit: t("phone.waiter.pairLimit"),
          license_inactive: t("phone.waiter.pairLicense"),
          license_expired: t("phone.waiter.pairLicense"),
          migration_missing: t("phone.waiter.pairMigration"),
          no_supabase: t("phone.waiter.pairServer"),
        };
        setError(map[msg] ?? t("phone.waiter.pairFailed"));
        setPhase("idle");
      }
    },
    [finishPair, stopCamera, t],
  );

  const requestByLicense = useCallback(async () => {
    const key = normalizeWaiterLicenseKey(licenseInput);
    if (key.length < 12) {
      setError(t("phone.waiter.pairInvalidLicense", { defaultValue: "Invalid license key. Check and try again." }));
      return;
    }
    if (claimedOnce.current) return;
    claimedOnce.current = true;
    setPhase("claiming");
    setError("");
    stopCamera();
    try {
      const deviceId = await getOrCreateDeviceId();
      const result = await requestWaiterPhoneByLicense({
        licenseKey: key,
        phoneDeviceId: deviceId,
      });
      if (result.status === "already_bound" && result.deviceRowId) {
        finishPair({
          licenseKey: result.licenseKey,
          restaurantName: result.restaurantName,
          deviceId,
          deviceRowId: result.deviceRowId,
        });
        return;
      }
      setWaiterLicensePending({
        licenseKey: result.licenseKey,
        deviceId,
        restaurantName: result.restaurantName,
        expiresAt: result.expiresAt ?? "",
      });
      setVenueName(result.restaurantName);
      claimedOnce.current = false;
      setPhase("pending");
    } catch (err) {
      claimedOnce.current = false;
      const msg = err instanceof Error ? err.message : "unknown";
      const map: Record<string, string> = {
        invalid_license: t("phone.waiter.pairInvalidLicense", {
          defaultValue: "Invalid license key. Check and try again.",
        }),
        license_inactive: t("phone.waiter.pairLicense"),
        license_expired: t("phone.waiter.pairLicense"),
        phone_limit: t("phone.waiter.pairLimit"),
        migration_missing: t("phone.waiter.pairMigration"),
        no_supabase: t("phone.waiter.pairServer"),
      };
      setError(map[msg] ?? t("phone.waiter.pairFailed"));
      setPhase("idle");
    }
  }, [finishPair, licenseInput, stopCamera, t]);

  const cancelPending = useCallback(async () => {
    const pending = getWaiterLicensePending();
    if (pending) {
      try {
        await cancelWaiterLicenseRequest(pending.licenseKey, pending.deviceId);
      } catch {
        /* still clear locally */
      }
    }
    clearWaiterLicensePending();
    setPhase("idle");
    setVenueName("");
  }, []);

  useEffect(() => {
    const pending = getWaiterLicensePending();
    if (!pending) return;
    setVenueName(pending.restaurantName);
    setPhase("pending");
  }, []);

  useEffect(() => {
    if (phase !== "pending") return;
    const pending = getWaiterLicensePending();
    if (!pending) {
      setPhase("idle");
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const status = await fetchWaiterLicenseRequestStatus(
        pending.licenseKey,
        pending.deviceId,
      );
      if (cancelled || !status) return;
      if (status.status === "approved" && status.licenseKey && status.deviceRowId) {
        finishPair({
          licenseKey: status.licenseKey,
          restaurantName: status.restaurantName ?? pending.restaurantName,
          deviceId: pending.deviceId,
          deviceRowId: status.deviceRowId,
        });
        return;
      }
      if (status.status === "rejected") {
        clearWaiterLicensePending();
        setError(t("phone.waiter.pairLicenseRejected", {
          defaultValue: "This phone was not approved. Ask the administrator.",
        }));
        setPhase("idle");
        return;
      }
      if (
        status.status === "expired" ||
        status.status === "cancelled" ||
        status.status === "none"
      ) {
        clearWaiterLicensePending();
        setError(t("phone.waiter.pairLicenseWaitExpired", {
          defaultValue: "The request expired. Send it again.",
        }));
        setPhase("idle");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [finishPair, phase, t]);

  useEffect(() => {
    const fromUrl = params.get("c") ?? params.get("code");
    if (fromUrl) {
      void claim(fromUrl);
      return;
    }
    // Camera-app QR opens phone.html#/waiter/pair?c=… — parse hash query too.
    try {
      const hash = window.location.hash || "";
      const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
      const c = new URLSearchParams(q).get("c") ?? new URLSearchParams(q).get("code");
      if (c) void claim(c);
    } catch {
      /* ignore */
    }
  }, [params, claim]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("phone.waiter.pairNoCamera"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("camera");
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const BD = (
        window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => {
            detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
          };
        }
      ).BarcodeDetector;

      if (!BD) {
        setError(t("phone.waiter.pairScanFallback"));
        return;
      }

      const detector = new BD({ formats: ["qr_code"] });
      scanningRef.current = true;

      const loop = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue;
          if (raw) {
            scanningRef.current = false;
            await claim(raw);
            return;
          }
        } catch {
          /* keep scanning */
        }
        if (scanningRef.current) {
          window.setTimeout(() => void loop(), 280);
        }
      };
      void loop();
    } catch {
      setError(t("phone.waiter.pairCameraDenied"));
      setPhase("idle");
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#070b14] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(100% 60% at 50% -5%, rgba(0,102,255,0.4) 0%, transparent 55%), linear-gradient(180deg, #0a1224 0%, #070b14 100%)",
        }}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-x-hidden px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/waiter"
            className="text-[13px] font-medium text-white/45 hover:text-white/75"
          >
            {t("phone.waiter.pairBack")}
          </Link>
          <Link
            to="/login"
            className="text-[13px] font-medium text-white/45 hover:text-white/75"
          >
            {t("phone.waiter.managerLogin")}
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: '"Space Grotesk", Geist, system-ui, sans-serif' }}
          >
            {t("phone.waiter.pairTitle")}
          </h1>
          <p className="mt-2 text-sm text-white/45 leading-relaxed">
            {t("phone.waiter.pairHint", {
              defaultValue:
                "Scan the QR in POS Settings, type the 8-character code, or enter the venue license (admin must approve).",
            })}
          </p>
        </motion.div>

        {phase === "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 className="size-14 text-[#44CC00]" />
            <p className="text-lg font-semibold text-[#44CC00]">
              {t("phone.waiter.pairSuccess")}
            </p>
            {venueName ? (
              <p className="text-sm text-white/50">{venueName}</p>
            ) : null}
          </div>
        ) : phase === "claiming" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Loader2 className="size-10 animate-spin text-[#0066FF]" />
            <p className="text-sm text-white/60">{t("phone.waiter.pairClaiming")}</p>
          </div>
        ) : phase === "pending" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            <Loader2 className="size-10 animate-spin text-[#0066FF]" />
            <p className="text-lg font-semibold text-white">
              {t("phone.waiter.pairLicenseWaiting", {
                defaultValue: "Waiting for approval",
              })}
            </p>
            {venueName ? (
              <p className="text-sm text-white/50">{venueName}</p>
            ) : null}
            <p className="max-w-[18rem] text-sm text-white/40 leading-relaxed">
              {t("phone.waiter.pairLicenseWaitingHint", {
                defaultValue:
                  "Open POS → Settings → Devices on the restaurant computer and approve this phone.",
              })}
            </p>
            <button
              type="button"
              onClick={() => void cancelPending()}
              className="mt-2 text-[13px] font-medium text-white/45 hover:text-white/75"
            >
              {t("phone.waiter.pairLicenseCancel", { defaultValue: "Cancel request" })}
            </button>
          </div>
        ) : (
          <>
            {phase === "camera" ? (
              <div className="relative mx-auto mb-5 aspect-[3/4] w-full max-w-[20rem] overflow-hidden rounded-3xl border border-white/10 bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-[#0066FF]/70" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void startCamera()}
                className="mx-auto mb-5 flex h-40 w-full max-w-[20rem] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/20 bg-white/[0.04] transition active:scale-[0.99]"
              >
                <Camera className="size-8 text-[#7eb6ff]" />
                <span className="text-sm font-medium text-white/80">
                  {t("phone.waiter.pairScan")}
                </span>
              </button>
            )}

            <div className="mx-auto w-full max-w-[20rem] min-w-0 space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
                <Keyboard className="size-3.5" />
                {t("phone.waiter.pairOrType")}
              </div>
              <div className="flex w-full min-w-0 items-center gap-2">
                <input
                  value={manual}
                  onChange={(e) =>
                    setManual(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
                  }
                  placeholder="ABC12XYZ"
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-3 font-mono text-center text-base tracking-[0.12em] text-white outline-none placeholder:text-white/20 focus:border-[#0066FF]/60"
                />
                <button
                  type="button"
                  disabled={manual.length < 6 || phase === "claiming"}
                  onClick={() => void claim(manual)}
                  className={cn(
                    "h-12 w-[5.75rem] shrink-0 rounded-2xl bg-[#44CC00] px-2 text-sm font-semibold text-[#06200a] transition active:scale-[0.97] disabled:opacity-35",
                  )}
                >
                  {t("phone.waiter.pairActivate")}
                </button>
              </div>
              {error ? (
                <p className="text-center text-xs font-medium text-red-400">{error}</p>
              ) : null}

              <div className="flex items-center gap-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
                <KeyRound className="size-3.5" />
                {t("phone.waiter.pairOrLicense", { defaultValue: "Or enter license" })}
              </div>
              <p className="text-[11px] leading-relaxed text-white/35">
                {t("phone.waiter.pairLicenseHint", {
                  defaultValue: "The POS administrator must approve this phone in Settings.",
                })}
              </p>
              <div className="flex w-full min-w-0 items-center gap-2">
                <input
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(formatWaiterLicenseInput(e.target.value))}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-3 font-mono text-center text-sm tracking-[0.08em] text-white outline-none placeholder:text-white/20 focus:border-[#0066FF]/60"
                />
                <button
                  type="button"
                  disabled={licenseKeyLen < 12 || phase === "claiming"}
                  onClick={() => void requestByLicense()}
                  className={cn(
                    "h-12 w-[5.75rem] shrink-0 rounded-2xl bg-[#0066FF] px-2 text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-35",
                  )}
                >
                  {t("phone.waiter.pairLicenseSend", { defaultValue: "Request" })}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
