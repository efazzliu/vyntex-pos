import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import {
  DEFAULT_PHONE_ACCESS_BRANDING,
  getDataCache,
  hashString,
  phoneAccessButtonTextColor,
  type PhoneAccessBranding,
  verifyLocalStaffPin,
  verifyPin,
} from "@/lib/local-db.ts";
import { phoneAccessThemeTokens, waiterThemeGlow, waiterThemeStyle } from "@/lib/phone-access-theme.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import {
  resolvePhoneAccessBranding,
  resolvePinLoginBranding,
} from "@/lib/supabase-pos/license-sync.ts";
import { fetchWaiterPhoneBindingStatus } from "@/lib/supabase-pos/waiter-phone-binding.ts";
import { cn } from "@/lib/utils.ts";
import type { ActiveStaff, StaffRole } from "@/pages/pos/_lib/types.ts";
import {
  isValidStaffPinLength,
  sanitizeStaffPinInput,
} from "@/pages/pos/_lib/staff-pin.ts";
import {
  clearWaiterPhonePair,
  getWaiterPhonePair,
  getWaiterVenueKey,
  isOwnerLocalWaiterPair,
  isWaiterDesignPreviewLicense,
  normalizeWaiterVenueKey,
  setWaiterSession,
  setWaiterVenueKey,
} from "@/phone-app/lib/waiter-session.ts";

const ORDER_ROLES = new Set<StaffRole>(["waiter", "manager", "admin"]);

type StaffRow = {
  _id: string;
  name: string;
  role: StaffRole;
  pinHash: string;
  isActive: boolean;
};

function normalizePersonName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function PhoneWaiterLogin() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const [pair, setPair] = useState(() => getWaiterPhonePair());
  const [venueKey] = useState(
    () => pair?.licenseKey || getWaiterVenueKey(),
  );
  const [waiterName, setWaiterName] = useState("");
  const [waiterCode, setWaiterCode] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState<ActiveStaff | null>(null);
  const [venueLogo, setVenueLogo] = useState<string | null>(null);
  const [access, setAccess] = useState<PhoneAccessBranding>(
    DEFAULT_PHONE_ACCESS_BRANDING,
  );

  const paired = Boolean(pair?.licenseKey);
  const licenseKey = normalizeWaiterVenueKey(venueKey);
  const tokens = phoneAccessThemeTokens(access.theme);
  const light = tokens.isLight;
  const accent = access.accentColor;
  const displayLogo = access.logoDataUrl || venueLogo;

  useEffect(() => {
    if (!licenseKey) {
      setVenueLogo(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [pin, phone] = await Promise.all([
          resolvePinLoginBranding(licenseKey),
          resolvePhoneAccessBranding(licenseKey),
        ]);
        if (cancelled) return;
        setVenueLogo(pin.logoDataUrl || null);
        setAccess(phone);
      } catch {
        if (!cancelled) {
          setVenueLogo(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [licenseKey]);
  const staffRows = useQuery(
    "pos.staff.getStaff",
    licenseKey ? { licenseKey } : "skip",
  ) as StaffRow[] | undefined;

  // Force a fresh fetch on mount so a staff member created moments ago on the
  // POS is available immediately, instead of waiting out the query's cache window.
  useEffect(() => {
    if (!licenseKey) return;
    void queryClient.invalidateQueries({ queryKey: ["pos", "pos.staff.getStaff"] });
  }, [licenseKey, queryClient]);

  // Locked to venue until admin disconnects this Device ID.
  useEffect(() => {
    if (!pair?.licenseKey || !pair.deviceId) return;
    if (isWaiterDesignPreviewLicense(pair.licenseKey)) return;
    if (isOwnerLocalWaiterPair(pair)) return;
    let cancelled = false;
    void (async () => {
      const status = await fetchWaiterPhoneBindingStatus(
        pair.licenseKey,
        pair.deviceId,
      );
      if (cancelled || !status) return;
      if (status.disconnected || !status.bound) {
        clearWaiterPhonePair();
        setPair(null);
        return;
      }
      if (status.restaurantName && status.restaurantName !== pair.restaurantName) {
        const next = { ...pair, restaurantName: status.restaurantName };
        setPair(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pair]);

  const verifyLogin = useCallback(async () => {
    const key = normalizeWaiterVenueKey(venueKey);
    const name = waiterName.trim();
    const code = sanitizeStaffPinInput(waiterCode);
    if (!key) {
      setErrorMsg(t("phone.waiter.venueRequired"));
      return;
    }
    if (!name) {
      setErrorMsg(t("phone.waiter.nameRequired"));
      return;
    }
    if (!isValidStaffPinLength(code.length)) {
      setErrorMsg(t("phone.waiter.codeRequired"));
      return;
    }

    setVerifying(true);
    setError(false);
    setErrorMsg("");

    try {
      setWaiterVenueKey(key);
      const pinHash = await hashString(code);
      const fromCache =
        (await getDataCache<StaffRow[]>(`staff:${key}`)) ?? undefined;
      const rows = staffRows ?? fromCache ?? [];
      const wantName = normalizePersonName(name);

      let match: ActiveStaff | null = null;

      if (rows.length > 0) {
        const found = rows.find(
          (s) =>
            s.pinHash === pinHash &&
            s.isActive &&
            normalizePersonName(s.name) === wantName,
        );
        if (found) {
          match = { id: found._id, name: found.name, role: found.role };
        } else {
          const pinOnly = rows.find((s) => s.pinHash === pinHash && s.isActive);
          if (pinOnly && normalizePersonName(pinOnly.name) !== wantName) {
            setError(true);
            setErrorMsg(t("phone.waiter.nameMismatch"));
            return;
          }
        }
      } else {
        const local = await verifyLocalStaffPin(pinHash);
        if (local && normalizePersonName(local.name) === wantName) {
          match = {
            id: local.convexId,
            name: local.name,
            role: local.role as StaffRole,
          };
        }
      }

      if (!match) {
        const localAdmin = await verifyPin(code);
        if (
          localAdmin &&
          normalizePersonName(localAdmin.name) === wantName
        ) {
          match = {
            id: "local-admin",
            name: localAdmin.name,
            role: "admin",
          };
        }
      }

      if (!match) {
        setError(true);
        setErrorMsg(t("phone.waiter.invalidCredentials"));
        return;
      }

      if (!ORDER_ROLES.has(match.role)) {
        setError(true);
        setErrorMsg(t("phone.waiter.roleBlocked"));
        return;
      }

      setSuccess(match);
      setWaiterSession({
        licenseKey: key,
        staff: match,
        signedInAt: Date.now(),
      });
      setTimeout(() => navigate("/waiter/floor", { replace: true }), 700);
    } finally {
      setVerifying(false);
    }
  }, [venueKey, waiterName, waiterCode, staffRows, navigate, t]);

  const canSubmit =
    paired &&
    waiterName.trim().length > 0 &&
    isValidStaffPinLength(sanitizeStaffPinInput(waiterCode).length) &&
    !verifying &&
    !success;

  return (
    <div
      data-waiter-theme={light ? "light" : "dark"}
      data-waiter-skin={tokens.id}
      className={cn(
        "relative flex min-h-dvh flex-col overflow-hidden",
        light ? "text-[#0f172a]" : "text-white",
      )}
      style={waiterThemeStyle(tokens)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: waiterThemeGlow(tokens),
        }}
      />
      {access.showVyntexMark ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.06]"
        >
          <img
            src={VYNTEX_APP_LOGO_SRC}
            alt=""
            className="h-[140vw] w-[140vw] max-w-none object-contain sm:h-[90vh] sm:w-[90vh]"
          />
        </div>
      ) : null}

      <div className="relative z-10 flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center">
          <div
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em]",
              light ? "text-slate-400" : "text-white/45",
            )}
          >
            {isOnline ? (
              <>
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                <Wifi className="size-3 text-emerald-400" />
                <span className="text-emerald-400/90">{t("phone.waiter.online")}</span>
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-amber-400" />
                <WifiOff className="size-3 text-amber-400" />
                <span className="text-amber-400/90">{t("phone.waiter.offline")}</span>
              </>
            )}
          </div>
        </div>

        {access.showVyntexMark ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-6 flex flex-col items-center text-center"
        >
          <img
            src={VYNTEX_APP_LOGO_SRC}
            alt=""
            className="mb-3 w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,102,255,0.35)]"
            style={{ height: access.logoHeightPx }}
          />
          <h1
            className={cn(
              "text-[2.35rem] font-semibold leading-none tracking-tight",
              light ? "text-slate-900" : "text-white",
            )}
            style={{
              fontFamily: '"Space Grotesk", Geist, system-ui, sans-serif',
              color: access.loginTitleColor,
            }}
          >
            Vyntex
          </h1>
          <p className="mt-2 text-[15px] font-medium" style={{ color: access.loginSubtitleColor }}>
            {t("phone.waiter.subtitle")}
          </p>
          <p
            className="mt-1 max-w-[16rem] text-[13px] leading-snug"
            style={{ color: access.loginHintColor }}
          >
            {t("phone.waiter.hintNameCode")}
          </p>
        </motion.div>
        ) : null}

        <div className="mx-auto mb-5 w-full max-w-[20rem]">
          {paired ? (
            <div className="flex flex-col items-center gap-2">
              {displayLogo ? (
                <img
                  src={displayLogo}
                  alt=""
                  className="w-auto max-w-[10rem] object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
                  style={{ height: Math.min(access.logoHeightPx, 72) }}
                />
              ) : null}
              <p
                className="text-center text-[1.65rem] font-semibold tracking-tight"
                style={{
                  fontFamily: '"Montserrat", "Space Grotesk", Geist, system-ui, sans-serif',
                  color: access.loginTitleColor,
                }}
              >
                {pair?.restaurantName || licenseKey}
              </p>
            </div>
          ) : (
            <Link
              to="/waiter/pair"
              className="flex w-full flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-center transition active:scale-[0.99]"
              style={{
                borderColor: `${accent}59`,
                backgroundColor: `${accent}1F`,
              }}
            >
              <span
                className={cn(
                  "text-[15px] font-semibold",
                  light ? "text-slate-900" : "text-white",
                )}
              >
                {t("phone.waiter.activatePhone")}
              </span>
              <span
                className={cn(
                  "text-[12px] leading-snug",
                  light ? "text-slate-500" : "text-white/55",
                )}
              >
                {t("phone.waiter.activatePhoneHint")}
              </span>
            </Link>
          )}
        </div>

        {paired ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="mx-auto flex w-full max-w-[20rem] flex-1 flex-col"
          >
            <AnimatePresence mode="wait">
              {success ? (
                <motion.p
                  key="ok"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-5 text-center text-lg font-semibold text-[#44CC00]"
                  style={{
                    fontFamily: '"Space Grotesk", Geist, system-ui, sans-serif',
                  }}
                >
                  {t("phone.waiter.welcome", { name: success.name })}
                </motion.p>
              ) : (
                <motion.p
                  key="ask"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 text-center text-[15px] font-medium"
                  style={{ color: access.loginHintColor }}
                >
                  {t("phone.waiter.enterCredentials")}
                </motion.p>
              )}
            </AnimatePresence>

            {access.showNameLabel ? (
            <label
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: access.loginFieldColor }}
            >
              {t("phone.waiter.nameLabel")}
            </label>
            ) : null}
            <input
              value={waiterName}
              disabled={verifying || !!success}
              onChange={(e) => {
                setWaiterName(e.target.value);
                setError(false);
                setErrorMsg("");
              }}
              autoComplete="name"
              placeholder={t("phone.waiter.namePlaceholder")}
              className={cn(
                "mb-3 h-12 w-full rounded-2xl border px-3.5 text-[15px] outline-none",
                light
                  ? "bg-white border-slate-200"
                  : "bg-white/[0.06] border-white/10",
                error ? "border-red-400/60" : "",
              )}
              style={{ color: access.loginFieldColor }}
              onFocus={(e) => {
                if (!error) e.currentTarget.style.borderColor = accent;
              }}
              onBlur={(e) => {
                if (!error) e.currentTarget.style.borderColor = "";
              }}
            />

            {access.showCodeLabel ? (
            <label
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: access.loginFieldColor }}
            >
              {t("phone.waiter.codeLabel")}
            </label>
            ) : null}
            <input
              value={waiterCode}
              disabled={verifying || !!success}
              onChange={(e) => {
                setWaiterCode(sanitizeStaffPinInput(e.target.value));
                setError(false);
                setErrorMsg("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) {
                  e.preventDefault();
                  void verifyLogin();
                }
              }}
              type="password"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t("phone.waiter.codePlaceholder")}
              className={cn(
                "mb-3 h-12 w-full rounded-2xl border px-3.5 font-mono text-[15px] tracking-wide outline-none",
                light
                  ? "bg-white border-slate-200"
                  : "bg-white/[0.06] border-white/10",
                error ? "border-red-400/60" : "",
              )}
              style={{ color: access.loginFieldColor }}
              onFocus={(e) => {
                if (!error) e.currentTarget.style.borderColor = accent;
              }}
              onBlur={(e) => {
                if (!error) e.currentTarget.style.borderColor = "";
              }}
            />

            {(errorMsg || error) && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-3 text-center text-xs font-medium text-red-400"
              >
                {errorMsg || t("phone.waiter.invalidCredentials")}
              </motion.p>
            )}

            <button
              type="button"
              onClick={() => void verifyLogin()}
              disabled={!canSubmit}
              className="mt-auto h-12 w-full rounded-2xl text-[15px] font-semibold shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition active:scale-[0.98] disabled:opacity-35 disabled:shadow-none"
              style={{
                backgroundColor: access.signInColor,
                color: phoneAccessButtonTextColor(access.signInColor),
              }}
            >
              {verifying ? t("phone.waiter.signingIn") : t("phone.waiter.signIn")}
            </button>
          </motion.div>
        ) : null}

        <p className="pt-4 text-center text-sm">
          <Link
            to="/login"
            className="font-medium underline-offset-4"
            style={{ color: accent }}
          >
            {t("phone.waiter.managerLogin")}
          </Link>
        </p>
        <p
          className={cn(
            "pt-3 text-center text-[10px]",
            light ? "text-slate-400" : "text-white/25",
          )}
        >
          {t("phone.waiter.footer")}
        </p>
      </div>
    </div>
  );
}
