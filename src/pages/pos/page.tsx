import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { motion } from "motion/react";
import {
  getActivation,
  getLocalAdmins,
  type ActivationData,
} from "@/lib/local-db.ts";
import type { ActiveStaff } from "./_lib/types.ts";
import ActivationScreen from "./_components/activation-screen.tsx";
import AdminSetupScreen from "./_components/admin-setup-screen.tsx";
import PinLoginScreen from "./_components/pin-login-screen.tsx";
import PosApp from "./_components/pos-app.tsx";
import PosInstallScreen from "./_components/pos-install-screen.tsx";

type LaunchStep = "loading" | "install" | "activation" | "admin-setup" | "pin-login" | "ready";

export default function PosLauncher() {
  const [step, setStep] = useState<LaunchStep>("loading");
  const [activation, setActivation] = useState<ActivationData | null>(null);
  const [activeStaff, setActiveStaff] = useState<ActiveStaff | null>(null);

  useEffect(() => {
    // If opened with ?install=true, show the install screen
    const params = new URLSearchParams(window.location.search);
    if (params.get("install") === "true") {
      // Clean the URL param
      params.delete("install");
      const cleanUrl =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState({}, "", cleanUrl);

      setStep("install");
      return;
    }

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

      const admins = await getLocalAdmins();
      if (admins.length === 0) {
        setStep("admin-setup");
        return;
      }

      // Always go through PIN login after activation is verified
      setStep("pin-login");
    } catch {
      setStep("activation");
    }
  }

  const handleActivated = async () => {
    const stored = await getActivation();
    if (stored) {
      setActivation(stored);
    }
    setStep("admin-setup");
  };

  const handleAdminCreated = () => {
    // After admin setup, go to PIN login
    setStep("pin-login");
  };

  const handlePinLogin = (staff: ActiveStaff) => {
    setActiveStaff(staff);
    setStep("ready");
  };

  const handleLogout = () => {
    setActiveStaff(null);
    setStep("pin-login");
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

  if (step === "install") {
    return <PosInstallScreen />;
  }

  if (step === "activation") {
    return <ActivationScreen onActivated={handleActivated} />;
  }

  if (step === "admin-setup") {
    return (
      <AdminSetupScreen
        businessName={activation?.businessName ?? "VYNTEX POS"}
        licenseKey={activation?.licenseKey ?? ""}
        onComplete={handleAdminCreated}
      />
    );
  }

  if (step === "pin-login") {
    return (
      <PinLoginScreen
        businessName={activation?.businessName ?? "VYNTEX POS"}
        licenseKey={activation?.licenseKey ?? ""}
        onLogin={handlePinLogin}
      />
    );
  }

  // step === "ready"
  return (
    <PosApp
      activation={activation!}
      activeStaff={activeStaff!}
      onLogout={handleLogout}
    />
  );
}
