import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { motion } from "motion/react";
import { AlertCircle, KeyRound, Monitor } from "lucide-react";
import {
  getOrCreateDeviceId,
  saveActivation,
} from "@/lib/local-db.ts";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

type ActivationScreenProps = {
  onActivated: () => void;
};

export default function ActivationScreen({ onActivated }: ActivationScreenProps) {
  const [segments, setSegments] = useState(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const activateMutation = useMutation(api.licenseActivation.activate);

  // Load device ID on mount
  useState(() => {
    getOrCreateDeviceId().then(setDeviceId);
  });

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
      const result = await activateMutation({
        licenseKey: fullKey,
        deviceId,
      });

      // Save activation data locally
      await saveActivation({
        licenseKey: result.licenseKey,
        plan: result.plan,
        businessName: result.businessName,
        businessType: result.businessType,
        expiresAt: result.expiresAt,
        deviceId: result.deviceId,
        activatedAt: result.activatedAt,
      });

      onActivated();
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message: string };
        setError(data.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <motion.img
            src={LOGO_URL}
            alt="VYNTEX"
            className="h-16 w-16 mb-4"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
            VYNTEX
          </h1>
          <p className="text-[#8b93a7] text-sm mt-1">Enterprise POS Platform</p>
        </div>

        {/* Activation Card */}
        <div className="bg-[#131A2E] border border-[#1e2a45] rounded-2xl p-6 space-y-6">
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
            disabled={!isKeyComplete || loading || !deviceId}
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
          <span className="text-[#0066FF]">VYNTEX Web Dashboard</span>
        </p>
      </motion.div>
    </div>
  );
}
