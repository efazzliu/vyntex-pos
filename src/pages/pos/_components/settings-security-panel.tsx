import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  AlertTriangle,
  Fingerprint,
  KeyRound,
  Laptop,
  LogOut,
  Monitor,
  Shield,
  ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import {
  SESSION_TIMEOUT_MINUTES,
  isSecurityEventAction,
  parsePosSecuritySettings,
  type SessionTimeoutMinutes,
} from "@/lib/pos-security-config.ts";
import { STAFF_PIN_MAX_LEN, STAFF_PIN_MIN_LEN } from "../_lib/staff-pin.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import type { PosSecurityDevice } from "@/lib/supabase-pos/settings-ops.ts";
import { uuidOrNull } from "@/lib/supabase-pos/uuid.ts";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsSecurityPanelProps = {
  t: Translate;
  licenseKey: string;
  staffId?: string;
  staffName?: string;
  deviceId?: string;
  isAdmin: boolean;
  canManageSessions: boolean;
  onOpenAuditLog: () => void;
};

type AuditRow = {
  _id: string;
  staffName?: string;
  action: string;
  details?: string;
  createdAt: string;
};

const ONLINE_MS = 2 * 60 * 1000;

function isDeviceOnline(row: PosSecurityDevice): boolean {
  if (row.disconnectedAt) return false;
  const seen = Date.parse(row.lastSeenAt);
  return Number.isFinite(seen) && Date.now() - seen <= ONLINE_MS;
}

function formatStamp(iso: string | null | undefined, language: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString(language === "sq" ? "sq-AL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SettingsSecurityPanel({
  t,
  licenseKey,
  staffId,
  staffName,
  deviceId,
  isAdmin,
  canManageSessions,
  onOpenAuditLog,
}: SettingsSecurityPanelProps) {
  const { language } = usePosLocale();
  const cloudStaffId = uuidOrNull(staffId);
  const companyQuery = useQuery("pos.settings.getCompanyDetails", {
    licenseKey,
  });
  const devicesQuery = useQuery(
    "pos.settings.listSecurityDevices",
    cloudStaffId && canManageSessions
      ? { licenseKey, staffId: cloudStaffId }
      : "skip",
  );
  const auditQuery = useQuery("pos.dashboard.getAuditLogs", {
    licenseKey,
    staffId: staffId || undefined,
    limit: 80,
  });
  const updateSecurity = useMutation("pos.settings.updateSecuritySettings");
  const revokeDevice = useMutation("pos.settings.revokeSecurityDevice");

  const securitySettings = parsePosSecuritySettings(
    companyQuery && typeof companyQuery === "object" && !Array.isArray(companyQuery)
      ? (companyQuery as { securitySettings?: unknown }).securitySettings
      : undefined,
  );
  const [timeoutMinutes, setTimeoutMinutes] = useState<SessionTimeoutMinutes>(
    securitySettings.sessionTimeoutMinutes,
  );
  const [savingTimeout, setSavingTimeout] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    setTimeoutMinutes(securitySettings.sessionTimeoutMinutes);
  }, [securitySettings.sessionTimeoutMinutes]);

  const devices = useMemo((): PosSecurityDevice[] => {
    if (!Array.isArray(devicesQuery)) return [];
    return devicesQuery as PosSecurityDevice[];
  }, [devicesQuery]);

  const audits = useMemo((): AuditRow[] => {
    if (!Array.isArray(auditQuery)) return [];
    return auditQuery as AuditRow[];
  }, [auditQuery]);

  const activeDevices = devices.filter(isDeviceOnline);
  const authorized = devices.filter((d) => !d.disconnectedAt);
  const othersOnline = activeDevices.filter((d) => d.deviceId !== deviceId);
  const logins = audits.filter((a) => a.action === "login" || a.action === "logout");
  const failed = audits.filter((a) => a.action === "login_failed");
  const events = audits.filter((a) => isSecurityEventAction(a.action)).slice(0, 8);
  const needsCloudAdmin = !cloudStaffId;

  const saveTimeout = async (next: SessionTimeoutMinutes) => {
    if (!isAdmin) {
      toast.error(t("settings.sec_admin_only"));
      return;
    }
    setTimeoutMinutes(next);
    setSavingTimeout(true);
    try {
      await updateSecurity({
        licenseKey,
        actorStaffId: staffId,
        sessionTimeoutMinutes: next,
      });
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setSavingTimeout(false);
    }
  };

  const revoke = async (targetDeviceId: string) => {
    if (!cloudStaffId) {
      toast.error(t("settings.sec_cloud_admin"));
      return;
    }
    setRevokingId(targetDeviceId);
    try {
      await revokeDevice({
        licenseKey,
        staffId: cloudStaffId,
        staffName: staffName || "Admin",
        targetDeviceId,
        currentDeviceId: deviceId,
      });
      toast.success(t("settings.sec_revoke_ok"));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "CANNOT_REVOKE_SELF") {
        toast.error(t("settings.sec_revoke_self"));
      } else if (code === "CLOUD_ADMIN_REQUIRED") {
        toast.error(t("settings.sec_cloud_admin"));
      } else {
        toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
      }
    } finally {
      setRevokingId(null);
    }
  };

  const signOutOthers = async () => {
    for (const row of othersOnline) {
      await revoke(row.deviceId);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
            <Monitor className="size-5 text-emerald-400" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">
              {t("settings.sec_sessions_title")}
            </h2>
            <p className="mt-0.5 text-sm text-[#8b93a7]">
              {t("settings.sec_sessions_lead")}
            </p>
          </div>
        </div>
        <div className="rounded-[18px] border border-brand/30 bg-brand/10 px-4 py-3">
          <p className="text-sm font-semibold text-white">
            {staffName || t("settings.sec_this_session")}
          </p>
          <p className="mt-0.5 text-xs text-[#8b93a7]">
            {t("settings.sec_this_terminal")}
            {deviceId ? ` · ${deviceId.slice(0, 8)}` : ""}
          </p>
        </div>
        {needsCloudAdmin ? (
          <p className="text-xs leading-relaxed text-amber-300/90">
            {t("settings.sec_cloud_admin")}
          </p>
        ) : activeDevices.length === 0 ? (
          <p className="text-sm text-[#8b93a7]">{t("settings.sec_sessions_empty")}</p>
        ) : (
          <ul className="space-y-2">
            {activeDevices.map((row) => {
              const mine = row.deviceId === deviceId;
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[#1e2a45] bg-[#131A2E] px-4 py-3"
                >
                  <Laptop className="size-4 shrink-0 text-[#8b93a7]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {row.displayName}
                      {mine ? ` · ${t("settings.sec_this_device")}` : ""}
                    </p>
                    <p className="text-[11px] text-[#8b93a7]">
                      {row.os || t("settings.sec_os_unknown")}
                      {row.lastSeenAt
                        ? ` · ${formatStamp(row.lastSeenAt, language)}`
                        : ""}
                    </p>
                  </div>
                  {!mine ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={revokingId === row.deviceId}
                      onClick={() => void revoke(row.deviceId)}
                      className="border-[#1e2a45] bg-transparent text-white h-9"
                    >
                      <LogOut className="size-3.5 mr-1.5" />
                      {t("settings.sec_sign_out")}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {othersOnline.length > 0 && cloudStaffId ? (
          <Button
            type="button"
            disabled={Boolean(revokingId)}
            onClick={() => void signOutOthers()}
            className="bg-brand hover:bg-brand-hover h-11"
          >
            <LogOut className="size-4 mr-1.5" />
            {t("settings.sec_sign_out_others")}
          </Button>
        ) : null}
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
            <Laptop className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">
              {t("settings.sec_devices_title")}
            </h2>
            <p className="mt-0.5 text-sm text-[#8b93a7]">
              {t("settings.sec_devices_lead")}
            </p>
          </div>
        </div>
        {needsCloudAdmin ? (
          <p className="text-sm text-[#8b93a7]">{t("settings.sec_cloud_admin")}</p>
        ) : authorized.length === 0 ? (
          <p className="text-sm text-[#8b93a7]">{t("settings.sec_devices_empty")}</p>
        ) : (
          <ul className="space-y-2">
            {authorized.map((row) => {
              const mine = row.deviceId === deviceId;
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[#1e2a45] bg-[#131A2E] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{row.displayName}</p>
                    <p className="mt-0.5 text-[11px] text-[#8b93a7]">
                      {isDeviceOnline(row)
                        ? t("settings.sec_device_online")
                        : t("settings.sec_device_idle")}
                      {row.ipAddress ? ` · ${row.ipAddress}` : ""}
                    </p>
                  </div>
                  {!mine ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={revokingId === row.deviceId}
                      onClick={() => void revoke(row.deviceId)}
                      className="border-[#1e2a45] bg-transparent text-white h-9"
                    >
                      {t("settings.sec_revoke_device")}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {t("settings.sec_timeout_title")}
          </h2>
          <p className="mt-0.5 text-sm text-[#8b93a7]">
            {t("settings.sec_timeout_lead")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SESSION_TIMEOUT_MINUTES.map((mins) => (
            <button
              key={mins}
              type="button"
              disabled={!isAdmin || savingTimeout}
              onClick={() => void saveTimeout(mins)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                timeoutMinutes === mins
                  ? "border-brand/50 bg-brand/15 text-white"
                  : "border-[#1e2a45] bg-[#131A2E] text-[#8b93a7]",
                (!isAdmin || savingTimeout) && "opacity-70",
              )}
            >
              {mins === 0
                ? t("settings.sec_timeout_off")
                : t("settings.sec_timeout_mins", { count: mins })}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-3">
        <div className="flex items-start gap-3">
          <KeyRound className="size-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold text-white">
              {t("settings.sec_pin_title")}
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-[#8b93a7]">
              {t("settings.sec_pin_lead", {
                min: STAFF_PIN_MIN_LEN,
                max: STAFF_PIN_MAX_LEN,
              })}
            </p>
            <p className="mt-2 text-xs text-[#5a6580]">{t("settings.sec_pin_users")}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-3">
        <div className="flex items-start gap-3">
          <Fingerprint className="size-5 shrink-0 text-[#8b93a7] mt-0.5" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                {t("settings.sec_2fa_title")}
              </h2>
              <span className="rounded-full border border-[#2a3a5a] bg-[#131A2E] px-2.5 py-0.5 text-[11px] font-semibold text-[#8b93a7]">
                {t("settings.sec_unavailable")}
              </span>
            </div>
            <p className="mt-0.5 text-sm leading-relaxed text-[#8b93a7]">
              {t("settings.sec_2fa_lead")}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">
          {t("settings.sec_history_title")}
        </h2>
        {logins.length === 0 ? (
          <p className="text-sm text-[#8b93a7]">{t("settings.sec_history_empty")}</p>
        ) : (
          <ul className="space-y-2">
            {logins.slice(0, 8).map((row) => (
              <li key={row._id} className="text-sm text-white">
                {row.staffName || "—"} · {t(`audit.action_${row.action}`)}
                <span className="block text-[11px] text-[#8b93a7]">
                  {formatStamp(row.createdAt, language)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5a6580]">
            {t("settings.sec_failed_title")}
          </p>
          {failed.length === 0 ? (
            <p className="mt-1 text-sm text-[#8b93a7]">{t("settings.sec_failed_none")}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {failed.slice(0, 6).map((row) => (
                <li key={row._id} className="flex items-start gap-2 text-sm text-amber-200">
                  <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                  <span>
                    {row.details || t("settings.sec_failed_item")}
                    <span className="block text-[11px] text-[#8b93a7]">
                      {formatStamp(row.createdAt, language)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Shield className="size-5 shrink-0 text-[#DC2626] mt-0.5" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white">
              {t("settings.sec_events_title")}
            </h2>
            <p className="mt-0.5 text-sm text-[#8b93a7]">
              {t("settings.sec_events_lead")}
            </p>
          </div>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-[#8b93a7]">{t("settings.sec_events_empty")}</p>
        ) : (
          <ul className="space-y-2">
            {events.map((row) => (
              <li key={row._id} className="text-sm text-white">
                {t(`audit.action_${row.action}`)} · {row.staffName || "—"}
                <span className="block text-[11px] text-[#8b93a7]">
                  {formatStamp(row.createdAt, language)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onOpenAuditLog}
          className="text-sm font-medium text-brand hover:underline"
        >
          {t("settings.open_audit_log")}
        </button>
      </section>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-[#5a6580]">
        <ShieldOff className="size-3.5 mt-0.5 shrink-0" />
        {t("settings.sec_device_id_note")}
      </p>
    </div>
  );
}
