import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { motion } from "motion/react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useOfflineData } from "@/hooks/use-offline-data.ts";
import {
  hashString,
  getDataCache,
  saveStaffCache,
  verifyPin,
  verifyLocalStaffPin,
  type LocalStaff,
  type PinLoginBranding,
  type PinLoginPlacement,
} from "@/lib/local-db.ts";
import { cn } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input.tsx";
import type { ActiveStaff } from "../_lib/types.ts";
import {
  STAFF_PIN_MAX_LEN,
  isValidStaffPinLength,
  sanitizeStaffPinInput,
} from "../_lib/staff-pin.ts";
import { APP_VERSION_LABEL, VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import { resolvePinLoginBranding } from "@/lib/supabase-pos/license-sync.ts";
import { Wifi, WifiOff, Delete } from "lucide-react";
import { usePosTheme } from "../_lib/use-pos-theme.ts";
import posI18n from "../_lib/pos-i18n.ts";

const NUMPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["clear", "0", "delete"],
] as const;

type PinLoginScreenProps = {
  businessName: string;
  licenseKey: string;
  onLogin: (staff: ActiveStaff) => void | Promise<void>;
};

function LogoAndName({
  branding,
  logoSrc,
  displayName,
  placement,
  isLight,
}: {
  branding: PinLoginBranding;
  logoSrc: string;
  displayName: string;
  placement: PinLoginPlacement;
  isLight?: boolean;
}) {
  const isCorner = placement === "top-left" || placement === "top-right";
  const align =
    placement === "top-left"
      ? "items-start text-left"
      : placement === "top-right"
        ? "items-end text-right"
        : "items-center text-center";

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className={cn(
        "flex flex-col gap-2 mb-2",
        align,
        isCorner && "mb-0 max-w-[min(42vw,280px)]",
      )}
    >
      <img
        src={logoSrc}
        alt=""
        style={{
          height: branding.logoHeightPx,
          maxHeight: "min(44dvh, 520px)",
          width: "auto",
          maxWidth: isCorner
            ? "100%"
            : `min(92vw, ${Math.max(200, Math.round(branding.logoHeightPx * 2.4))}px)`,
        }}
        className={cn(
          "object-contain",
          !isCorner && "mx-auto",
          placement === "top-left" && "self-start",
          placement === "top-right" && "self-end",
        )}
      />
      <p
        className={cn(
          "text-sm font-medium",
          isLight ? "text-slate-600" : "text-[#8b93a7]",
          isCorner && "line-clamp-2",
        )}
      >
        {displayName}
      </p>
    </motion.div>
  );
}

export default function PinLoginScreen({
  businessName,
  licenseKey,
  onLogin,
}: PinLoginScreenProps) {
  const { theme: posTheme } = usePosTheme();
  const isLightPos = posTheme === "light";
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState<ActiveStaff | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [branding, setBranding] = useState<PinLoginBranding | null>(null);
  const isOnline = useOnlineStatus();

  const companyQuery = useQuery("pos.settings.getCompanyDetails", {
    licenseKey,
  });
  const { data: companyCached } = useOfflineData(
    `company:${licenseKey}`,
    companyQuery,
    isOnline,
  );

  const displayName =
    companyCached &&
    typeof companyCached === "object" &&
    "name" in companyCached &&
    typeof (companyCached as { name: unknown }).name === "string" &&
    (companyCached as { name: string }).name.trim()
      ? (companyCached as { name: string }).name.trim()
      : businessName;

  const posLanguage: "en" | "sq" = useMemo(() => {
    if (companyQuery?.language === "sq") return "sq";
    if (
      companyCached &&
      typeof companyCached === "object" &&
      "language" in companyCached &&
      (companyCached as { language?: unknown }).language === "sq"
    ) {
      return "sq";
    }
    return "en";
  }, [companyQuery, companyCached]);

  const tPin = useMemo(
    () => posI18n.getFixedT(posLanguage, "pos"),
    [posLanguage],
  );

  useEffect(() => {
    let cancelled = false;
    resolvePinLoginBranding(licenseKey).then((b) => {
      if (!cancelled) setBranding(b);
    });
    return () => {
      cancelled = true;
    };
  }, [licenseKey]);

  const staffListQuery = useQuery("pos.staff.getStaff", { licenseKey });
  const { data: staffRows } = useOfflineData<Doc<"staff">[]>(
    `staff:${licenseKey}`,
    staffListQuery,
    isOnline,
  );

  useEffect(() => {
    if (staffListQuery && staffListQuery.length > 0) {
      const cached: LocalStaff[] = staffListQuery.map((s) => ({
        convexId: s._id,
        name: s.name,
        role: s.role,
        pinHash: s.pinHash,
        isActive: s.isActive,
      }));
      saveStaffCache(cached);
    }
  }, [staffListQuery]);

  const insertAuditLogMut = useMutation("pos.dashboard.insertAuditLog");
  const recordAdminPinForPhoneMut = useMutation("pos.dashboard.recordAdminPinLoginForPhone");

  const logAdminPinLogin = useCallback(
    (staff: ActiveStaff) => {
      if (staff.role !== "admin" && staff.id !== "local-admin") return;
      if (!licenseKey.trim()) return;
      const isDeviceAdmin = staff.id === "local-admin";
      /** Phone notifications: own mutation so they work even when `pos_audit_logs` insert fails. */
      void recordAdminPinForPhoneMut({
        licenseKey,
        staffName: staff.name,
        staffId: isDeviceAdmin ? undefined : staff.id,
        staffRole: staff.role,
        isDeviceAdmin,
      });
      void insertAuditLogMut({
        licenseKey,
        staffName: staff.name,
        staffId: isDeviceAdmin ? undefined : staff.id,
        action: "login",
        details: isDeviceAdmin
          ? `Device admin ${staff.name} signed in with PIN`
          : `Administrator ${staff.name} signed in with PIN`,
        metadata: {
          source: "pin",
          role: staff.role,
          isDeviceAdmin,
        },
      });
    },
    [licenseKey, insertAuditLogMut, recordAdminPinForPhoneMut],
  );

  const verifyEnteredPin = useCallback(
    async (enteredPin: string) => {
      setVerifying(true);
      setError(false);

      try {
        const pinHash = await hashString(enteredPin);

        const fromDataCache =
          (await getDataCache<Doc<"staff">[]>(`staff:${licenseKey}`)) ??
          undefined;
        const rows = staffRows ?? fromDataCache ?? [];

        if (rows.length > 0) {
          const match = rows.find((s) => s.pinHash === pinHash && s.isActive);
          if (match) {
            const staff: ActiveStaff = {
              id: match._id,
              name: match.name,
              role: match.role,
            };
            logAdminPinLogin(staff);
            setSuccess(staff);
            setTimeout(() => void Promise.resolve(onLogin(staff)), 800);
            return;
          }
        } else {
          const localMatch = await verifyLocalStaffPin(pinHash);
          if (localMatch) {
            const staff: ActiveStaff = {
              id: localMatch.convexId,
              name: localMatch.name,
              role: localMatch.role,
            };
            logAdminPinLogin(staff);
            setSuccess(staff);
            setTimeout(() => void Promise.resolve(onLogin(staff)), 800);
            return;
          }
        }

        const localAdmin = await verifyPin(enteredPin);
        if (localAdmin) {
          const adminStaff: ActiveStaff = {
            id: "local-admin",
            name: localAdmin.name,
            role: "admin",
          };
          logAdminPinLogin(adminStaff);
          setSuccess(adminStaff);
          setTimeout(() => void Promise.resolve(onLogin(adminStaff)), 800);
          return;
        }

        setError(true);
        setTimeout(() => {
          setPin("");
          setError(false);
        }, 1000);
      } finally {
        setVerifying(false);
      }
    },
    [staffRows, licenseKey, onLogin, logAdminPinLogin],
  );

  const trySubmitPin = useCallback(() => {
    if (verifying || success) return;
    if (!isValidStaffPinLength(pin.length)) return;
    void verifyEnteredPin(pin);
  }, [pin, verifying, success, verifyEnteredPin]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (verifying || success) return;

      if (key === "clear") {
        setPin("");
        setError(false);
        return;
      }

      if (key === "delete") {
        setPin((prev) => prev.slice(0, -1));
        setError(false);
        return;
      }

      setPin((prev) => {
        if (prev.length >= STAFF_PIN_MAX_LEN) return prev;
        return prev + key;
      });
    },
    [verifying, success],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (verifying || success) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key.length === 1 && /^[a-zA-Z0-9]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key);
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        handleKeyPress("delete");
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        handleKeyPress("clear");
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        trySubmitPin();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [verifying, success, handleKeyPress, trySubmitPin]);

  const b = branding;
  const placement: PinLoginPlacement = b?.placement ?? "top-center";
  const logoSrc = b?.logoDataUrl ?? VYNTEX_APP_LOGO_SRC;
  const logoHeight = b?.logoHeightPx ?? 140;

  const showCustomLogo = placement === "custom";
  const showLogoInColumnTop = placement === "top-center";
  const showLogoCenterBand = placement === "center";
  const showLogoAbovePin = placement === "above-pin";
  const showCornerLogo =
    !showCustomLogo && (placement === "top-left" || placement === "top-right");
  const showLogoBottomBar = !showCustomLogo && placement === "bottom-center";

  const brandingForRender: PinLoginBranding = b ?? {
    logoDataUrl: null,
    logoHeightPx: logoHeight,
    placement,
    logoOffsetXPercent: 50,
    logoOffsetYPercent: 22,
    pinBlockOffsetXPercent: 50,
    pinBlockOffsetYPercent: 56,
  };

  const customOx = Math.min(
    100,
    Math.max(0, brandingForRender.logoOffsetXPercent),
  );
  const customOy = Math.min(
    100,
    Math.max(0, brandingForRender.logoOffsetYPercent),
  );
  const pinBlockX = Math.min(
    100,
    Math.max(0, brandingForRender.pinBlockOffsetXPercent),
  );
  const pinBlockY = Math.min(
    100,
    Math.max(0, brandingForRender.pinBlockOffsetYPercent),
  );

  const wifiRow = (
    <div
      className={cn(
        "flex items-center gap-1.5",
        showLogoInColumnTop && !showLogoCenterBand ? "mb-8" : "mb-8 mt-2",
      )}
    >
      {isOnline ? (
        <>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Wifi className="size-3 text-emerald-400" />
          <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
            {tPin("pin.online")}
          </span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <WifiOff className="size-3 text-amber-400" />
          <span className="text-[10px] text-amber-400 font-medium uppercase tracking-wider">
            {tPin("pin.offline")}
          </span>
        </>
      )}
    </div>
  );

  return (
    <div
      data-pos-theme={posTheme}
      className={cn(
        "min-h-screen flex flex-col relative p-4 select-none",
        isLightPos ? "bg-slate-100" : "bg-[#0A0F1E]",
      )}
    >
      {showCornerLogo && b && (
        <div
          className={cn(
            "absolute top-4 z-10 px-2",
            placement === "top-left" ? "left-2" : "right-2",
          )}
        >
          <LogoAndName
            branding={brandingForRender}
            logoSrc={logoSrc}
            displayName={displayName}
            placement={placement}
            isLight={isLightPos}
          />
        </div>
      )}

      {showCustomLogo && b && (
        <div
          className="pointer-events-none absolute z-[8]"
          style={{
            left: `${customOx}%`,
            top: `${customOy}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <LogoAndName
            branding={brandingForRender}
            logoSrc={logoSrc}
            displayName={displayName}
            placement="top-center"
            isLight={isLightPos}
          />
        </div>
      )}

      {showLogoBottomBar && b && (
        <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 flex justify-center px-3">
          <div className="pointer-events-auto max-w-[min(92vw,36rem)]">
            <LogoAndName
              branding={brandingForRender}
              logoSrc={logoSrc}
              displayName={displayName}
              placement="top-center"
              isLight={isLightPos}
            />
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col items-center",
          showCustomLogo
            ? "relative justify-start"
            : showLogoCenterBand
              ? "justify-between py-2"
              : "justify-center",
        )}
      >
        {showLogoCenterBand && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full max-w-xs py-2">
            <LogoAndName
              branding={brandingForRender}
              logoSrc={logoSrc}
              displayName={displayName}
              placement="top-center"
              isLight={isLightPos}
            />
          </div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={cn(
            "flex w-full max-w-xs flex-col items-center",
            showLogoCenterBand && "shrink-0",
            showCustomLogo &&
              "pointer-events-auto absolute z-[10] max-h-[min(88dvh,100%)] overflow-y-auto overscroll-contain py-1",
          )}
          style={
            showCustomLogo
              ? {
                  left: `${pinBlockX}%`,
                  top: `${pinBlockY}%`,
                  transform: "translate(-50%, -50%)",
                }
              : undefined
          }
        >
          {showLogoInColumnTop && (
            <LogoAndName
              branding={brandingForRender}
              logoSrc={logoSrc}
              displayName={displayName}
              placement="top-center"
              isLight={isLightPos}
            />
          )}

          {wifiRow}

          {showLogoAbovePin && (
            <div className="mb-6 w-full flex justify-center">
              <LogoAndName
                branding={brandingForRender}
                logoSrc={logoSrc}
                displayName={displayName}
                placement="above-pin"
                isLight={isLightPos}
              />
            </div>
          )}

          <p
            className={cn(
              "text-lg font-semibold mb-6",
              isLightPos ? "text-slate-900" : "text-white",
            )}
          >
            {success
              ? tPin("pin.welcome", { name: success.name })
              : tPin("pin.enter_pin")}
          </p>

          <Input
            type="password"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={STAFF_PIN_MAX_LEN}
            value={pin}
            disabled={verifying || !!success}
            onChange={(e) => {
              setPin(sanitizeStaffPinInput(e.target.value));
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                trySubmitPin();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setPin("");
                setError(false);
              }
            }}
            placeholder={tPin("pin.placeholder")}
            aria-label={tPin("pin.placeholder")}
            aria-invalid={error}
            className={cn(
              "select-text mb-10 w-full max-w-[17rem] h-12 rounded-2xl px-4 text-center font-mono text-lg tracking-normal shadow-none transition-[border-color]",
              "focus-visible:ring-0 focus-visible:ring-offset-0 aria-invalid:ring-0 dark:aria-invalid:ring-0",
              isLightPos
                ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-300"
                : "border-[#1e2a45] bg-[#131A2E] text-white placeholder:text-[#3a4560] focus-visible:border-[#1e2a45]",
              success && "border-[#44CC00] focus-visible:border-[#44CC00]",
              error && !success && "border-red-500 focus-visible:border-red-500",
            )}
          />

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-xs mb-4 font-medium"
            >
              {tPin("pin.invalid")}
            </motion.p>
          )}

          <div className="flex flex-col gap-3">
            {NUMPAD_KEYS.map((row, ri) => (
              <div key={ri} className="flex gap-3 justify-center">
                {row.map((key) => {
                  const isAction = key === "clear" || key === "delete";
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleKeyPress(key)}
                      disabled={verifying || !!success}
                      className={cn(
                        "w-20 h-14 rounded-2xl font-semibold text-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50",
                        isAction
                          ? isLightPos
                            ? "bg-slate-200/90 text-slate-700 hover:bg-slate-300 border border-slate-300"
                            : "bg-[#1e2a45]/60 text-[#8b93a7] hover:bg-[#1e2a45]"
                          : isLightPos
                            ? "bg-white text-slate-900 hover:bg-slate-100 border border-slate-300"
                            : "bg-[#131A2E] text-white hover:bg-[#1e2a45] border border-[#1e2a45]",
                      )}
                    >
                      {key === "delete" ? (
                        <Delete className="size-5 mx-auto" />
                      ) : key === "clear" ? (
                        <span className="text-base">C</span>
                      ) : (
                        key
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {!success && (
            <button
              type="button"
              onClick={trySubmitPin}
              disabled={
                verifying || !isValidStaffPinLength(pin.length)
              }
              className="mt-2 w-full max-w-[17rem] h-12 rounded-2xl font-semibold bg-[#44CC00] hover:bg-[#3db80a] disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-[0.98]"
            >
              <span className={isLightPos ? "text-[#f8fafc]" : "text-white"}>
                {tPin("pin.sign_in")}
              </span>
            </button>
          )}
        </motion.div>
      </div>

      <div className="relative w-full shrink-0 pb-2 px-2">
        <p
          className={cn(
            "text-[10px] text-center",
            isLightPos ? "text-slate-400" : "text-[#3a4560]",
          )}
        >
          Powered by Vyntex POS
        </p>
        <p
          className={cn(
            "absolute bottom-2 right-2 text-[10px] tabular-nums pointer-events-none",
            isLightPos ? "text-slate-400" : "text-[#3a4560]",
          )}
          aria-label={`Version ${APP_VERSION_LABEL}`}
        >
          {APP_VERSION_LABEL}
        </p>
      </div>
    </div>
  );
}
