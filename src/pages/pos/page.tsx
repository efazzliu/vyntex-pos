import { useState, useEffect, useCallback, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { motion } from "motion/react";
import {
  clearActivation,
  getActivation,
  getLocalAdmins,
  generateActivationToken,
  getOrCreateDeviceId,
  hasStaffOpenShiftLocal,
  saveActivation,
  type ActivationData,
} from "@/lib/local-db.ts";
import type { ActiveStaff } from "./_lib/types.ts";
import { uuidOrNull } from "@/lib/supabase-pos/uuid.ts";
import ActivationScreen from "./_components/activation-screen.tsx";
import AdminSetupScreen from "./_components/admin-setup-screen.tsx";
import PinLoginScreen from "./_components/pin-login-screen.tsx";
import StartShiftScreen from "./_components/start-shift-screen.tsx";
import PosApp from "./_components/pos-app.tsx";
import { verifyLicense, getShiftStatus } from "@/lib/supabase-pos.ts";
import {
  buildActivationFromOwnedRestaurant,
  ensureDeviceOnOwnedRestaurant,
  fetchDefaultPosStaffForRestaurant,
  fetchRestaurantOwnedBySession,
  isRestaurantLicenseUsable,
} from "@/lib/supabase-pos/phone-pos-session.ts";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { usePosTheme } from "./_lib/use-pos-theme.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

type LaunchStep =
  | "loading"
  | "activation"
  | "admin-setup"
  | "pin-login"
  | "shift-check"
  | "start-shift"
  | "ready"
  | "account-no-restaurant"
  | "account-no-staff"
  | "account-device-blocked"
  | "account-license-bad"
  | "account-error";

type PosLauncherProps = {
  /**
   * Kur është true (vetëm app telefoni): përdor llogarinë Supabase (email/fjalëkalim),
   * pa ekran licensë dhe pa PIN — nëse ka staf në databazë.
   */
  accountAuthMode?: boolean;
};

export default function PosLauncher({ accountAuthMode = false }: PosLauncherProps) {
  const navigate = useNavigate();
  const { theme: posTheme } = usePosTheme();
  const [step, setStep] = useState<LaunchStep>("loading");
  const [activation, setActivation] = useState<ActivationData | null>(null);
  const [activeStaff, setActiveStaff] = useState<ActiveStaff | null>(null);

  useEffect(() => {
    if (accountAuthMode) {
      void checkAccountAuthState();
      return;
    }
    checkLocalState();
  }, [accountAuthMode]);

  /** After admin resets terminals, re-check while POS is open (not only on cold start). */
  useEffect(() => {
    if (accountAuthMode) return;
    const watchSteps: LaunchStep[] = ["pin-login", "shift-check", "start-shift", "ready"];
    if (!activation || !watchSteps.includes(step)) return;

    const reverify = () => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        try {
          const stored = await getActivation();
          if (!stored) return;
          const v = await verifyLicense(stored.licenseKey, stored.deviceId);
          if (!v.valid) {
            await clearActivation();
            setActiveStaff(null);
            setActivation(null);
            toast.info(
              "Licenca u rivendos nga paneli. Fut përsëri çelësin. / License was reset — enter your license key again.",
            );
            setStep("activation");
          }
        } catch {
          /* offline — keep session */
        }
      })();
    };

    document.addEventListener("visibilitychange", reverify);
    window.addEventListener("focus", reverify);
    const intervalId = window.setInterval(reverify, 45_000);
    void reverify();

    return () => {
      document.removeEventListener("visibilitychange", reverify);
      window.removeEventListener("focus", reverify);
      window.clearInterval(intervalId);
    };
  }, [step, activation, accountAuthMode]);

  async function checkAccountAuthState() {
    try {
      const restaurant = await fetchRestaurantOwnedBySession();
      if (!restaurant) {
        setStep("account-no-restaurant");
        return;
      }
      if (!isRestaurantLicenseUsable(restaurant)) {
        setStep("account-license-bad");
        return;
      }

      const deviceId = await getOrCreateDeviceId();
      const ensured = await ensureDeviceOnOwnedRestaurant(restaurant, deviceId);
      if (!ensured.ok) {
        setStep("account-device-blocked");
        return;
      }

      const licenseKey = restaurant.license_key.trim().toUpperCase();
      const token = await generateActivationToken(licenseKey, deviceId);
      const built = buildActivationFromOwnedRestaurant(restaurant, deviceId, token);
      setActivation({ ...built, token });

      const staff = await fetchDefaultPosStaffForRestaurant(restaurant.id);
      if (!staff) {
        setStep("account-no-staff");
        return;
      }

      setActiveStaff({
        id: staff.id,
        name: staff.name,
        role: staff.role,
      });
      setStep("ready");
    } catch {
      setStep("account-error");
    }
  }

  async function checkLocalState() {
    try {
      const stored = await getActivation();

      if (!stored) {
        setStep("activation");
        return;
      }

      // Try to refresh plan from server (non-blocking fallback to cached)
      try {
        const verification = await verifyLicense(
          stored.licenseKey,
          stored.deviceId,
        );
        if (!verification.valid) {
          await clearActivation();
          setActivation(null);
          toast.info(
            "Licenca u rivendos nga paneli. Fut përsëri çelësin. / License was reset — enter your license key again.",
          );
          setStep("activation");
          return;
        }
        if (verification.plan && verification.plan !== stored.plan) {
          const updated = { ...stored, plan: verification.plan };
          // Re-save with updated plan (saveActivation regenerates the token)
          await saveActivation({
            licenseKey: updated.licenseKey,
            plan: updated.plan,
            businessName: updated.businessName,
            businessType: updated.businessType,
            expiresAt: updated.expiresAt,
            deviceId: updated.deviceId,
            activatedAt: updated.activatedAt,
          });
          setActivation({ ...updated, token: stored.token });
        } else {
          setActivation(stored);
        }
      } catch {
        // Offline, misconfiguration, or fetch error — use cached data
        setActivation(stored);
      }

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
    const admins = await getLocalAdmins();
    setStep(admins.length === 0 ? "admin-setup" : "pin-login");
  };

  const handleAdminCreated = () => {
    // After admin setup, go to PIN login
    setStep("pin-login");
  };

  const handlePinLogin = useCallback(async (staff: ActiveStaff) => {
    const stored = await getActivation();
    if (!stored) {
      setStep("activation");
      return;
    }
    try {
      const v = await verifyLicense(stored.licenseKey, stored.deviceId);
      if (!v.valid) {
        await clearActivation();
        setActivation(null);
        toast.info(
          "Licenca u rivendos nga paneli. Fut përsëri çelësin. / License was reset — enter your license key again.",
        );
        setStep("activation");
        return;
      }
    } catch {
      /* offline — allow PIN session */
    }
    setActiveStaff(staff);
    if (staff.role === "waiter") {
      setStep("shift-check");
    } else {
      setStep("ready");
    }
  }, []);

  const handleLogout = () => {
    setActiveStaff(null);
    if (accountAuthMode) {
      navigate("/app", { replace: true });
      return;
    }
    setStep("pin-login");
  };

  const continueWaiterShift = useCallback(() => setStep("ready"), []);
  const startWaiterShift = useCallback(() => setStep("start-shift"), []);

  if (accountAuthMode && step === "account-no-restaurant") {
    return (
      <PosAccountGate
        title="Nuk u gjet biznes"
        body="Kjo llogari nuk është lidhur me asnjë restoran. Regjistro biznesin nga kompjuteri (faqja kryesore Vyntex → dashboard) me të njëjtin email."
      />
    );
  }

  if (accountAuthMode && step === "account-no-staff") {
    return (
      <PosAccountGate
        title="Duhet profil stafi në POS"
        body="Hap POS-in një herë nga kompjuteri dhe krijo administratorin me PIN, ose shto staf nga paneli. Pastaj rihap POS në telefon."
      />
    );
  }

  if (accountAuthMode && step === "account-device-blocked") {
    return (
      <PosAccountGate
        title="Kufiri i pajisjeve"
        body="Licenca ka arritur numrin maksimal të terminaleve. Hiq një pajisje nga paneli ose kontakto suportin."
      />
    );
  }

  if (accountAuthMode && step === "account-license-bad") {
    return (
      <PosAccountGate
        title="Licenca jo aktive"
        body="Licenca është e skaduar ose e pezulluar. Rinovo nga dashboard-i në web."
      />
    );
  }

  if (accountAuthMode && step === "account-error") {
    return (
      <PosAccountGate
        title="Gabim"
        body="Nuk u ngarkuan të dhënat e restorantit. Kontrollo rrjetin dhe provo përsëri."
      />
    );
  }

  // Shift check step: query shift status and decide next step
  if (step === "shift-check" && activeStaff && activation) {
    return (
      <ShiftCheckGate
        licenseKey={activation.licenseKey}
        staff={activeStaff}
        onContinuingShift={continueWaiterShift}
        onNewShiftNeeded={startWaiterShift}
      />
    );
  }

  if (step === "loading") {
    return (
      <div
        data-pos-theme={posTheme}
        className="min-h-screen bg-[#0A0F1E] flex items-center justify-center"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <img
            src={VYNTEX_APP_LOGO_SRC}
            alt="Vyntex POS"
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
        businessName={activation?.businessName ?? "Vyntex POS"}
        licenseKey={activation?.licenseKey ?? ""}
        onComplete={handleAdminCreated}
      />
    );
  }

  if (step === "pin-login") {
    return (
      <PinLoginScreen
        businessName={activation?.businessName ?? "Vyntex POS"}
        licenseKey={activation?.licenseKey ?? ""}
        onLogin={handlePinLogin}
      />
    );
  }

  if (step === "start-shift" && activeStaff && activation) {
    return (
      <StartShiftScreen
        businessName={activation.businessName}
        licenseKey={activation.licenseKey}
        staff={activeStaff}
        onShiftStarted={() => setStep("ready")}
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

function PosAccountGate({ title, body }: { title: string; body: string }) {
  const { theme: posTheme } = usePosTheme();
  return (
    <div
      data-pos-theme={posTheme}
      className="flex min-h-screen items-center justify-center bg-[#0A0F1E] p-4"
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#1e2a45] bg-[#131A2E] p-6 text-center">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="text-sm text-[#8b93a7]">{body}</p>
        <Button asChild className="w-full">
          <Link to="/app">Kthehu te paneli</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * ShiftCheckGate: queries the shift status and auto-routes
 * to either "continuing shift" or "new shift needed".
 */
function ShiftCheckGate({
  licenseKey,
  staff,
  onContinuingShift,
  onNewShiftNeeded,
}: {
  licenseKey: string;
  staff: ActiveStaff;
  onContinuingShift: () => void;
  onNewShiftNeeded: () => void;
}) {
  const { theme: posTheme } = usePosTheme();
  const continueRef = useRef(onContinuingShift);
  const newShiftRef = useRef(onNewShiftNeeded);
  continueRef.current = onContinuingShift;
  newShiftRef.current = onNewShiftNeeded;

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    const settle = (fn: () => void) => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(failSafeId);
      fn();
    };

    const failSafeId = window.setTimeout(() => {
      settle(() => continueRef.current());
    }, 4000);

    const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((resolve) => {
          window.setTimeout(() => resolve(fallback), ms);
        }),
      ]);

    void (async () => {
      try {
        const localOpen = await withTimeout(
          hasStaffOpenShiftLocal(licenseKey, staff.id),
          1500,
          false,
        );
        if (cancelled) return;

        if (localOpen) {
          settle(() => continueRef.current());
          return;
        }

        // Legacy / cached Convex-style ids cannot use Supabase shift rows; go straight in.
        if (!uuidOrNull(staff.id)) {
          settle(() => continueRef.current());
          return;
        }

        const status = await withTimeout(getShiftStatus(staff.id), 2500, {
          hasOpenShift: false as boolean,
        });
        if (cancelled) return;

        if (status.hasOpenShift) settle(() => continueRef.current());
        else settle(() => newShiftRef.current());
      } catch {
        if (!cancelled) settle(() => continueRef.current());
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(failSafeId);
    };
  }, [licenseKey, staff.id]);

  // Show loading while checking
  return (
    <div
      data-pos-theme={posTheme}
      className="min-h-screen bg-[#0A0F1E] flex items-center justify-center"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <img
          src={VYNTEX_APP_LOGO_SRC}
          alt="Vyntex POS"
          className="h-12 w-12 animate-pulse"
        />
        <p className="text-[#5a6580] text-sm">Checking shift status...</p>
      </motion.div>
    </div>
  );
}
