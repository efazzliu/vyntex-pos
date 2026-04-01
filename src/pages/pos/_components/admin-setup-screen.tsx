import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { motion } from "motion/react";
import { AlertCircle, Eye, EyeOff, ShieldCheck, UserPlus } from "lucide-react";
import { saveLocalAdmin } from "@/lib/local-db.ts";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

type AdminSetupScreenProps = {
  businessName: string;
  onComplete: () => void;
};

export default function AdminSetupScreen({
  businessName,
  onComplete,
}: AdminSetupScreenProps) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePinChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    setPin(cleaned);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("Please enter a full name.");
      return;
    }

    if (password.length < 6) {
      setError("Master password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (pin.length !== 4) {
      setError("Quick Login PIN must be exactly 4 digits.");
      return;
    }

    setLoading(true);

    try {
      await saveLocalAdmin(name.trim(), password, pin);
      onComplete();
    } catch {
      setError("Failed to create admin profile. Please try again.");
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
        <div className="flex flex-col items-center mb-8">
          <motion.img
            src={LOGO_URL}
            alt="VYNTEX"
            className="h-14 w-14 mb-3"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <p className="text-[#8b93a7] text-sm">{businessName}</p>
        </div>

        {/* Setup Card */}
        <div className="bg-[#131A2E] border border-[#1e2a45] rounded-2xl p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-[#44CC00]/10 mb-2">
              <UserPlus className="size-6 text-[#44CC00]" />
            </div>
            <h2 className="text-lg font-semibold text-white">Create Business Admin</h2>
            <p className="text-sm text-[#8b93a7]">
              Set up the owner profile for this device. Credentials are stored locally for
              offline access.
            </p>
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              Full Name
            </Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Restaurant Manager"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] h-11 focus:border-[#44CC00] focus:ring-[#44CC00]/20"
            />
          </div>

          {/* Master Password */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="size-3" />
              Master Password
            </Label>
            <p className="text-xs text-[#5a6580]">
              Used to access Settings, change prices, or view reports
            </p>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Min 6 characters"
                className="bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] h-11 pr-10 focus:border-[#44CC00] focus:ring-[#44CC00]/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6580] hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              Confirm Password
            </Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              placeholder="Re-enter password"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] h-11 focus:border-[#44CC00] focus:ring-[#44CC00]/20"
            />
          </div>

          {/* Quick Login PIN */}
          <div className="space-y-2">
            <Label className="text-[#8b93a7] text-xs uppercase tracking-wider">
              Quick Login PIN (4 digits)
            </Label>
            <p className="text-xs text-[#5a6580]">
              Used for fast staff switching and opening tables
            </p>
            <div className="flex gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="size-12 rounded-lg bg-[#0A0F1E] border border-[#1e2a45] flex items-center justify-center"
                >
                  <span className="text-xl font-mono text-white">
                    {pin[i] ? "\u2022" : ""}
                  </span>
                </div>
              ))}
            </div>
            <Input
              type="tel"
              inputMode="numeric"
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              maxLength={4}
              placeholder="Enter 4-digit PIN"
              className="bg-[#0A0F1E] border-[#1e2a45] text-white placeholder:text-[#3a4560] h-11 font-mono tracking-[0.5em] text-center focus:border-[#44CC00] focus:ring-[#44CC00]/20"
            />
          </div>

          {/* Error */}
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

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-[#44CC00] to-[#38a600] hover:from-[#38a600] hover:to-[#2d8500] text-white font-semibold text-base"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Creating Profile...
              </span>
            ) : (
              "Create Admin Profile"
            )}
          </Button>
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <ShieldCheck className="size-3.5 text-[#44CC00]" />
          <p className="text-xs text-[#5a6580]">
            Credentials are encrypted and stored locally on this device
          </p>
        </div>
      </motion.div>
    </div>
  );
}
