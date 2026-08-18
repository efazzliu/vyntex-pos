import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, Loader2, Store, UserRound } from "lucide-react";
import { getOrCreateDeviceId } from "@/lib/local-db.ts";
import { sendPosDeviceHeartbeat } from "@/lib/supabase-pos/device-presence.ts";
import {
  isRestaurantLicenseUsable,
  type OwnedRestaurantRow,
} from "@/lib/supabase-pos/phone-pos-session.ts";
import { getStaff } from "@/lib/supabase-pos/staff-ops.ts";
import { supabase } from "@/lib/supabase.ts";
import { cn } from "@/lib/utils.ts";
import { normalizePlan } from "@/pages/pos/_lib/plan-features.ts";
import type { ActiveStaff, StaffRole } from "@/pages/pos/_lib/types.ts";
import {
  bindWaiterPhoneAsOwner,
  fetchVenuesForWaiterAccount,
} from "@/lib/supabase-pos/waiter-phone-owner-bind.ts";
import {
  clearWaiterLicensePending,
  setWaiterPhonePair,
  setWaiterSession,
} from "@/phone-app/lib/waiter-session.ts";

const ORDER_ROLES = new Set<StaffRole>(["waiter", "manager", "admin"]);

type StaffChoice = {
  id: string;
  name: string;
  role: StaffRole;
};

function normalizePersonName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function planLabel(plan: string | null | undefined): string {
  const p = normalizePlan(String(plan ?? ""));
  if (p === "enterprise") return "Enterprise";
  if (p === "starter") return "Starter";
  return "Professional";
}

export default function PhoneWaiterAccount() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preferredName = params.get("name")?.trim() ?? "";

  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [venues, setVenues] = useState<OwnedRestaurantRow[] | null>(null);
  const [venue, setVenue] = useState<OwnedRestaurantRow | null>(null);
  const [staff, setStaff] = useState<StaffChoice[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const autoVenueRef = useRef(false);
  const autoStaffRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSignedIn(Boolean(data.session?.user));
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchVenuesForWaiterAccount();
        if (!cancelled) setVenues(list);
      } catch {
        if (!cancelled) {
          setVenues([]);
          setError(t("phone.waiter.accountLoadFailed"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, t]);

  const enterAsStaff = useCallback(
    (
      chosen: OwnedRestaurantRow,
      member: StaffChoice,
      bind: { licenseKey: string; restaurantName: string; deviceRowId: string },
      deviceId: string,
    ) => {
      setWaiterPhonePair({
        licenseKey: bind.licenseKey,
        restaurantName: bind.restaurantName || chosen.name,
        deviceId,
        deviceRowId: bind.deviceRowId,
        pairedAt: Date.now(),
      });
      clearWaiterLicensePending();
      void sendPosDeviceHeartbeat(bind.licenseKey, deviceId);
      setWaiterSession({
        licenseKey: bind.licenseKey,
        staff: { id: member.id, name: member.name, role: member.role } satisfies ActiveStaff,
        signedInAt: Date.now(),
      });
      navigate("/waiter/floor", { replace: true });
    },
    [navigate],
  );

  const activateVenue = useCallback(
    async (row: OwnedRestaurantRow) => {
      if (!isRestaurantLicenseUsable(row)) {
        setError(t("phone.waiter.pairLicense"));
        return;
      }
      setBusy(true);
      setError("");
      try {
        const deviceId = await getOrCreateDeviceId();
        const bind = await bindWaiterPhoneAsOwner({
          licenseKey: row.license_key,
          phoneDeviceId: deviceId,
        });
        const rows = await getStaff(bind.licenseKey);
        const choices: StaffChoice[] = rows
          .filter((s) => s.isActive && ORDER_ROLES.has(s.role as StaffRole))
          .map((s) => ({
            id: s._id,
            name: s.name,
            role: s.role as StaffRole,
          }))
          .sort((a, b) => {
            const roleRank = (role: StaffRole) => (role === "waiter" ? 0 : 1);
            const d = roleRank(a.role) - roleRank(b.role);
            if (d !== 0) return d;
            return a.name.localeCompare(b.name);
          });
        setVenue(row);
        setStaff(choices);

        const want = normalizePersonName(preferredName);
        if (want && !autoStaffRef.current) {
          const matches = choices.filter((s) => normalizePersonName(s.name) === want);
          if (matches.length === 1) {
            autoStaffRef.current = true;
            enterAsStaff(row, matches[0], bind, deviceId);
            return;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        const map: Record<string, string> = {
          not_authenticated: t("phone.waiter.accountNeedSignIn"),
          not_venue_owner: t("phone.waiter.accountNotOwner"),
          invalid_license: t("phone.waiter.pairInvalidLicense"),
          license_inactive: t("phone.waiter.pairLicense"),
          license_expired: t("phone.waiter.pairLicense"),
          phone_limit: t("phone.waiter.pairLimit"),
          migration_missing: t("phone.waiter.pairMigration"),
          no_supabase: t("phone.waiter.pairServer"),
        };
        setError(map[msg] ?? t("phone.waiter.pairFailed"));
      } finally {
        setBusy(false);
      }
    },
    [enterAsStaff, preferredName, t],
  );

  useEffect(() => {
    if (!venues || venue || autoVenueRef.current) return;
    const usable = venues.filter(isRestaurantLicenseUsable);
    if (usable.length === 1) {
      autoVenueRef.current = true;
      void activateVenue(usable[0]);
    }
  }, [activateVenue, venue, venues]);

  const pickStaff = useCallback(
    async (member: StaffChoice) => {
      if (!venue) return;
      setBusy(true);
      setError("");
      try {
        const deviceId = await getOrCreateDeviceId();
        const bind = await bindWaiterPhoneAsOwner({
          licenseKey: venue.license_key,
          phoneDeviceId: deviceId,
          displayName: member.name,
        });
        enterAsStaff(venue, member, bind, deviceId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        setError(msg === "migration_missing" ? t("phone.waiter.pairMigration") : t("phone.waiter.pairFailed"));
        setBusy(false);
      }
    },
    [enterAsStaff, t, venue],
  );

  if (!authChecked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#070b14] text-white">
        <Loader2 className="size-8 animate-spin text-[#0066FF]" />
      </div>
    );
  }

  if (!signedIn) {
    const accountPath = preferredName
      ? `/waiter/account?name=${encodeURIComponent(preferredName)}`
      : "/waiter/account";
    return <Navigate to={`/login?next=${encodeURIComponent(accountPath)}`} replace />;
  }

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
            to="/waiter/pair"
            className="text-[13px] font-medium text-white/45 hover:text-white/75"
          >
            {t("phone.waiter.pairBack")}
          </Link>
          <Link
            to="/app"
            className="text-[13px] font-medium text-white/45 hover:text-white/75"
          >
            {t("phone.waiter.managerLogin")}
          </Link>
        </div>

        <div className="mb-6 text-center">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: '"Space Grotesk", Geist, system-ui, sans-serif' }}
          >
            {t("phone.waiter.accountTitle")}
          </h1>
          <p className="mt-2 text-sm text-white/45 leading-relaxed">
            {venue
              ? t("phone.waiter.accountPickStaff")
              : t("phone.waiter.accountPickVenue")}
          </p>
        </div>

        {error ? (
          <p className="mb-4 text-center text-xs font-medium text-red-400">{error}</p>
        ) : null}

        {busy && !staff ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Loader2 className="size-10 animate-spin text-[#0066FF]" />
            <p className="text-sm text-white/60">{t("phone.waiter.accountBinding")}</p>
          </div>
        ) : venue && staff ? (
          staff.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.04] px-4 py-10 text-center text-sm text-white/45">
              {t("phone.waiter.accountNoStaff")}
            </p>
          ) : (
            <ul className="mx-auto flex w-full max-w-[22rem] flex-col gap-2">
              {staff.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void pickStaff(member)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-left transition active:scale-[0.99]",
                      "disabled:opacity-50",
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#44CC00]/15 text-[#44CC00]">
                      <UserRound className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white">{member.name}</span>
                      <span className="block text-xs text-white/45">
                        {t(`phone.staff.role_${member.role}`, { defaultValue: member.role })}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-white/25" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : venues === null ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-[#0066FF]" />
          </div>
        ) : venues.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 bg-white/[0.04] px-4 py-10 text-center text-sm text-white/45">
            {t("phone.waiter.accountNoVenues")}
          </p>
        ) : (
          <ul className="mx-auto flex w-full max-w-[22rem] flex-col gap-2">
            {venues.map((row) => {
              const usable = isRestaurantLicenseUsable(row);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={!usable || busy}
                    onClick={() => void activateVenue(row)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-left transition active:scale-[0.99]",
                      "disabled:opacity-40",
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0066FF]/15 text-[#7eb6ff]">
                      <Store className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white">{row.name}</span>
                      <span className="block text-xs text-white/45">{planLabel(row.plan)}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-white/25" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
