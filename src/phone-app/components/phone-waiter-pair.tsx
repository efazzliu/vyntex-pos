import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { Camera, CheckCircle2, Keyboard, Loader2 } from "lucide-react";
import { getOrCreateDeviceId } from "@/lib/local-db.ts";
import { sendPosDeviceHeartbeat } from "@/lib/supabase-pos/device-presence.ts";
import {
  claimWaiterPhone,
  extractWaiterPairCode,
} from "@/lib/supabase-pos/waiter-phone-pair.ts";
import { setWaiterPhonePair, getWaiterPhonePair } from "@/phone-app/lib/waiter-session.ts";
import { fetchWaiterPhoneBindingStatus } from "@/lib/supabase-pos/waiter-phone-binding.ts";
import { cn } from "@/lib/utils.ts";

type ScanPhase = "idle" | "camera" | "claiming" | "done";

export default function PhoneWaiterPair() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);

  const [manual, setManual] = useState("");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [error, setError] = useState("");
  const [venueName, setVenueName] = useState("");
  const claimedOnce = useRef(false);

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
        setWaiterPhonePair({
          licenseKey: result.licenseKey,
          restaurantName: result.restaurantName,
          deviceId,
          deviceRowId: result.deviceRowId,
          pairedAt: Date.now(),
        });
        void sendPosDeviceHeartbeat(result.licenseKey, deviceId);
        setVenueName(result.restaurantName);
        setPhase("done");
        setTimeout(() => navigate("/waiter", { replace: true }), 900);
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
    [navigate, stopCamera, t],
  );

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

      <div className="relative z-10 flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/waiter"
            className="text-[13px] font-medium text-white/45 hover:text-white/75"
          >
            {t("phone.waiter.pairBack")}
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
            {t("phone.waiter.pairHint")}
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

            <div className="mx-auto w-full max-w-[20rem] space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
                <Keyboard className="size-3.5" />
                {t("phone.waiter.pairOrType")}
              </div>
              <div className="flex gap-2">
                <input
                  value={manual}
                  onChange={(e) =>
                    setManual(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
                  }
                  placeholder="ABC12XYZ"
                  className="h-12 flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 font-mono text-center text-lg tracking-[0.2em] text-white outline-none placeholder:text-white/20 focus:border-[#0066FF]/60"
                />
                <button
                  type="button"
                  disabled={manual.length < 6 || phase === "claiming"}
                  onClick={() => void claim(manual)}
                  className={cn(
                    "h-12 shrink-0 rounded-2xl bg-[#44CC00] px-4 text-sm font-semibold text-[#06200a] transition active:scale-[0.97] disabled:opacity-35",
                  )}
                >
                  {t("phone.waiter.pairActivate")}
                </button>
              </div>
              {error ? (
                <p className="text-center text-xs font-medium text-red-400">{error}</p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
