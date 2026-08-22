import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { motion } from "motion/react";
import { AlertCircle, KeyRound, Monitor } from "lucide-react";
import {
  clearActivation,
  getOrCreateDeviceId,
  saveActivation,
} from "@/lib/local-db.ts";
import { activateLicense } from "@/lib/supabase-pos.ts";
import { hydratePosLicenseData } from "@/lib/supabase-pos/license-sync.ts";
import { isSupabaseConfigured } from "@/lib/supabase.ts";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import { APP_VERSION_LABEL, VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import { sendPosDeviceHeartbeat } from "@/lib/supabase-pos/device-presence.ts";

type ActivationScreenProps = {
  onActivated: () => void;
};

function isPhoneShellEntry(): boolean {
  if (typeof window === "undefined") return false;
  if (/phone\.html$/i.test(window.location.pathname)) return true;
  return import.meta.env.VITE_PHONE_STORE_BUILD === "true";
}

export default function ActivationScreen({ onActivated }: ActivationScreenProps) {
  const { theme: posTheme } = usePosTheme();
  const [segments, setSegments] = useState(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const showPhoneBackLink = isPhoneShellEntry();

  // Load device ID on mount (never leave the UI stuck on "Generating...")
  useEffect(() => {
    let cancelled = false;
    void getOrCreateDeviceId()
      .then((id) => {
        if (!cancelled) setDeviceId(id);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `dev-${Date.now().toString(36)}`;
        try {
          localStorage.setItem("vyntex.pos.deviceId", fallback);
        } catch {
          // ignore
        }
        setDeviceId(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSegmentChange = (index: number, value: string) => {
    // Only allow the unambiguous charset (A-Z except I,O + 2-9)
    const cleaned = value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 4);
    const newSegments = [...segments];
    newSegments[index] = cleaned;
    setSegments(newSegments);
    setError(null);

    // Auto-advance to next segment
    if (cleaned.length === 4 && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to previous segment on backspace when empty
    if (e.key === "Backspace" && segments[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .toUpperCase()
      .replace(/[^A-HJ-NP-Z2-9]/g, "");
    if (pasted.length >= 16) {
      setSegments([
        pasted.slice(0, 4),
        pasted.slice(4, 8),
        pasted.slice(8, 12),
        pasted.slice(12, 16),
      ]);
    }
  };

  const fullKey = segments.join("-");
  const isKeyComplete = segments.every((s) => s.length === 4);

  const handleActivate = async () => {
    if (!isKeyComplete || !deviceId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await activateLicense(fullKey, deviceId);

      // Save activation data locally — critical for continuing past this screen
      await saveActivation({
        licenseKey: result.licenseKey,
        plan: result.plan,
        businessName: result.businessName,
        businessType: result.businessType,
        expiresAt: result.expiresAt,
        deviceId: result.deviceId,
        activatedAt: result.activatedAt,
      });

      // Cloud sync / presence must not block a successful activation
      try {
        await hydratePosLicenseData(result.licenseKey);
      } catch (hydrateErr) {
        console.warn("[activation] hydrate failed (non-blocking)", hydrateErr);
      }
      try {
        const heartbeatAccepted = await sendPosDeviceHeartbeat(
          result.licenseKey,
          result.deviceId,
        );
        if (heartbeatAccepted === false) {
          await clearActivation();
          throw new Error("This device is no longer assigned to the license.");
        }
      } catch (hbErr) {
        if (
          hbErr instanceof Error &&
          /no longer assigned/i.test(hbErr.message)
        ) {
          throw hbErr;
        }
        console.warn("[activation] heartbeat failed (non-blocking)", hbErr);
      }

      onActivated();
    } catch (err) {
      const raw =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.";
      const lower = raw.toLowerCase();
      // PostgREST/Supabase often hides the real DB fault behind this phrase
      if (lower === "internal error." || lower === "internal error" || lower.includes("internal server error")) {
        setError(
          "Ruajtja lokale dështoi (IndexedDB në Electron). Mbyll dhe rihap POS, pastaj provo përsëri. / Local storage failed — restart POS and try again.",
        );
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-pos-theme={posTheme}
      className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <motion.img
            src={VYNTEX_APP_LOGO_SRC}
            alt="Vyntex POS"
            className="h-16 w-16 mb-4"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
            Vyntex POS
          </h1>
          <p className="text-[#8b93a7] text-sm mt-1">Enterprise POS Platform</p>
        </div>

        {/* Activation Card */}
        <div className="bg-[#131A2E] border border-[#1e2a45] rounded-2xl p-6 space-y-6">
          {!isSupabaseConfigured && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left">
              <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-100/95 leading-relaxed">
                <span className="font-semibold text-amber-200">Server configuration missing.</span>{" "}
                This .exe was built without Supabase settings. The owner must run{" "}
                <code className="rounded bg-black/30 px-1">npm run dist:win</code> with{" "}
                <code className="rounded bg-black/30 px-1">.env</code> containing{" "}
                <code className="rounded bg-black/30 px-1">VITE_SUPABASE_URL</code> and{" "}
                <code className="rounded bg-black/30 px-1">VITE_SUPABASE_ANON_KEY</code>, or give you the
                installer from the web dashboard.
                <span className="block mt-2 text-amber-200/80">
                  Mungon konfigurimi i serverit — rikrijoni instaluesin me variablat e mësipërme ose shkarkoni nga
                  dashboard-i.
                </span>
              </p>
            </div>
          )}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-[#0066FF]/10 mb-2">
              <KeyRound className="size-6 text-[#0066FF]" />
            </div>
            <h2 className="text-lg font-semibold text-white">License Activation</h2>
            <p className="text-sm text-[#8b93a7]">
              Enter your 16-digit license key to activate this device
            </p>
          </div>

          {/* License Key Input */}
          <div className="space-y-3">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              License Key
            </Label>
            <div className="flex items-center gap-2" onPaste={handlePaste}>
              {segments.map((seg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    value={seg}
                    onChange={(e) => handleSegmentChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    maxLength={4}
                    placeholder="XXXX"
                    className="text-center font-mono text-base tracking-widest bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] h-12 focus:border-[#0066FF] focus:ring-[#0066FF]/20"
                  />
                  {i < 3 && (
                    <span className="text-[#3a4560] font-mono text-lg shrink-0">-</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Device ID Display */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Monitor className="size-3" />
              Device ID
            </Label>
            <div className="bg-[#0A0F1E] border border-[#1e2a45] rounded-lg px-3 py-2.5">
              <p className="font-mono text-xs text-[#5a6580] truncate">
                {deviceId ?? "Generating..."}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg p-3"
            >
              <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </motion.div>
          )}

          {/* Activate Button */}
          <Button
            onClick={handleActivate}
            disabled={
              !isKeyComplete || loading || !deviceId || !isSupabaseConfigured
            }
            className="w-full h-12 bg-gradient-to-r from-[#0066FF] to-[#0052cc] hover:from-[#0052cc] hover:to-[#003d99] text-white font-semibold text-base"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Activating...
              </span>
            ) : (
              "Activate License"
            )}
          </Button>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-[#5a6580] mt-6">
          Find your license key in the{" "}
          <span className="text-[#0066FF]">Vyntex POS Web Dashboard</span>
        </p>
        {showPhoneBackLink ? (
          <p className="mt-3 text-center text-sm">
            <Link to="/login" className="text-[#0066FF] hover:underline">
              Kthehu te kyçja / Back to sign in
            </Link>
          </p>
        ) : null}
        <p
          className="text-center text-[10px] tabular-nums text-[#3a4560] mt-2"
          aria-label={`Version ${APP_VERSION_LABEL}`}
        >
          v{APP_VERSION_LABEL}
        </p>
      </motion.div>
    </div>
  );
}
