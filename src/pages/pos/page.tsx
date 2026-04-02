import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { motion } from "motion/react";
import {
  getActivation,
  getLocalAdmins,
  type ActivationData,
} from "@/lib/local-db.ts";
import ActivationScreen from "./_components/activation-screen.tsx";
import AdminSetupScreen from "./_components/admin-setup-screen.tsx";
import PosApp from "./_components/pos-app.tsx";

type LaunchStep = "loading" | "activation" | "admin-setup" | "ready";

export default function PosLauncher() {
  const [step, setStep] = useState<LaunchStep>("loading");
  const [activation, setActivation] = useState<ActivationData | null>(null);

  // Check local state on mount
  useEffect(() => {
    checkLocalState();
  }, []);

  async function checkLocalState() {
    try {
      const stored = await getActivation();

      if (!stored) {
        setStep("activation");
        return;
      }

      setActivation(stored);

      // Check if local admin exists
      const admins = await getLocalAdmins();
      if (admins.length === 0) {
        setStep("admin-setup");
        return;
      }

      setStep("ready");
    } catch {
      // If IndexedDB fails, start from activation
      setStep("activation");
    }
  }

  const handleActivated = async () => {
    // Re-read activation data after it was saved
    const stored = await getActivation();
    if (stored) {
      setActivation(stored);
    }
    setStep("admin-setup");
  };

  const handleAdminCreated = () => {
    setStep("ready");
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <img
            src="https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz"
            alt="VYNTEX"
            className="h-12 w-12 animate-pulse"
          />
          <Skeleton className="h-4 w-32 bg-[#1e2a45]" />
        </motion.div>
      </div>
    );
  }

  if (step === "activation") {
    return <ActivationScreen onActivated={handleActivated} />;
  }

  if (step === "admin-setup") {
    return (
      <AdminSetupScreen
        businessName={activation?.businessName ?? "VYNTEX POS"}
        onComplete={handleAdminCreated}
      />
    );
  }

  return <PosApp activation={activation!} />;
}
