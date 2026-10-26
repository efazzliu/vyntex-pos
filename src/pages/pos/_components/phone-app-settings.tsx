import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronRight,
  Paintbrush,
  QrCode,
  Smartphone,
  Unplug,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { errorMessageFromUnknown } from "@/lib/supabase-pos/db-errors.ts";
import { uuidOrNull } from "@/lib/supabase-pos/uuid.ts";
import type { PosWaiterPhoneDevice } from "@/lib/supabase-pos/settings-ops.ts";
import type { StaffRole } from "../_lib/types.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import WaiterPhonePairSection from "./waiter-phone-pair-section.tsx";
import PhoneAccessDesignSection from "./phone-access-design-section.tsx";
import { BRAND } from "@/lib/brand-colors.ts";

type PhoneAppSection = "activation" | "accessDesign";

type PhoneAppSettingsProps = {
  licenseKey: string;
  canActivate: boolean;
  canEditDesign: boolean;
  venueName?: string;
  staffId?: string;
  staffName?: string;
};

const PHONE_ROLES = new Set<StaffRole>(["waiter", "cashier", "manager", "admin"]);
const ONLINE_MS = 2 * 60 * 1000;

const SECTIONS: {
  id: PhoneAppSection;
  icon: typeof QrCode;
  color: string;
  titleKey: string;
  descKey: string;
}[] = [
  {
    id: "activation",
    icon: QrCode,
    color: BRAND.primary,
    titleKey: "settings.phone_app_activation",
    descKey: "settings.phone_app_activation_desc",
  },
  {
    id: "accessDesign",
    icon: Paintbrush,
    color: BRAND.primary,
    titleKey: "settings.phone_app_access",
    descKey: "settings.phone_app_access_desc",
  },
];

type StaffRow = {
  _id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
};

function isPhoneOnline(row: PosWaiterPhoneDevice): boolean {
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

export default function PhoneAppSettings({
  licenseKey,
  canActivate,
  canEditDesign,
  venueName,
  staffId,
  staffName,
}: PhoneAppSettingsProps) {
  const { t, language } = usePosLocale();
  const [section, setSection] = useState<PhoneAppSection | null>("activation");
  const pairRefreshRef = useRef<(() => void) | null>(null);
  const cloudStaffId = uuidOrNull(staffId);
  const devicesQuery = useQuery(
    "pos.settings.listWaiterPhones",
    cloudStaffId && canActivate
      ? { licenseKey, staffId: cloudStaffId }
      : "skip",
  );
  const staffQuery = useQuery("pos.staff.getStaff", { licenseKey });
  const revokePhone = useMutation("pos.settings.revokeWaiterPhone");
  const renamePhone = useMutation("pos.settings.renameWaiterPhone");
  const [actingId, setActingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const devices = useMemo((): PosWaiterPhoneDevice[] => {
    if (!Array.isArray(devicesQuery)) return [];
    return devicesQuery as PosWaiterPhoneDevice[];
  }, [devicesQuery]);

  const waiters = useMemo((): StaffRow[] => {
    if (!Array.isArray(staffQuery)) return [];
    return (staffQuery as StaffRow[])
      .filter((row) => PHONE_ROLES.has(row.role))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  }, [staffQuery]);

  const saveName = async (row: PosWaiterPhoneDevice) => {
    const next = editName.trim();
    if (!next || next === row.displayName) {
      setEditingId(null);
      return;
    }
    setActingId(row.deviceId);
    try {
      await renamePhone({
        licenseKey,
        staffId: cloudStaffId,
        targetDeviceId: row.deviceId,
        displayName: next,
      });
      toast.success(t("settings.saved"));
      setEditingId(null);
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.save_failed")));
    } finally {
      setActingId(null);
    }
  };

  const revoke = async (row: PosWaiterPhoneDevice, repair: boolean) => {
    if (!canActivate) {
      toast.error(t("settings.admin_only_device_activation"));
      return;
    }
    setActingId(row.deviceId);
    try {
      await revokePhone({
        licenseKey,
        staffId: cloudStaffId,
        staffName,
        targetDeviceId: row.deviceId,
      });
      toast.success(
        repair ? t("settings.phone_app_repair_ok") : t("settings.phone_app_revoke_ok"),
      );
      if (repair) {
        setSection("activation");
        pairRefreshRef.current?.();
      }
    } catch (err) {
      toast.error(errorMessageFromUnknown(err, t("settings.phone_app_revoke_failed")));
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-2">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-light">
            <Smartphone className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{t("settings.phone_app_heading")}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-[#8b93a7]">
              {t("settings.phone_app_lead")}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const on = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(on ? null : item.id)}
              className={cn(
                "group flex items-center gap-3.5 rounded-[18px] border bg-[#131A2E]",
                "px-4 py-[17px] text-left cursor-pointer",
                "transition-all duration-200 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
                on
                  ? "border-brand shadow-[0_14px_32px_-18px_rgba(0,91,214,0.45)]"
                  : "border-[#1e2a45] hover:-translate-y-px hover:border-brand/30 hover:shadow-[0_14px_32px_-18px_rgba(0,91,214,0.45)]",
              )}
            >
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${item.color}1F` }}
              >
                <Icon
                  className="size-[22px]"
                  style={{ color: item.color }}
                  strokeWidth={1.75}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-tight text-white">
                  {t(item.titleKey)}
                </p>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[#8b93a7]">
                  {t(item.descKey)}
                </p>
              </div>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                  on
                    ? "bg-brand/10 text-brand rotate-90"
                    : "text-brand/70 group-hover:translate-x-0.5 group-hover:bg-brand/10 group-hover:text-brand",
                )}
              >
                <ChevronRight className="size-5" strokeWidth={2} />
              </span>
            </button>
          );
        })}
      </div>

      {section === "activation" ? (
        <WaiterPhonePairSection
          licenseKey={licenseKey}
          canActivate={canActivate}
          refreshRef={pairRefreshRef}
        />
      ) : null}

      {section === "accessDesign" ? (
        <PhoneAccessDesignSection
          licenseKey={licenseKey}
          canEdit={canEditDesign}
          venueName={venueName}
        />
      ) : null}

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#131A2E]">
            <Smartphone className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{t("settings.phone_app_devices_title")}</h2>
            <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.phone_app_devices_lead")}</p>
          </div>
        </div>
        {!canActivate ? (
          <p className="text-sm text-amber-400/90">{t("settings.admin_only_device_activation")}</p>
        ) : !cloudStaffId ? (
          <p className="text-sm text-[#8b93a7]">{t("settings.sec_cloud_admin")}</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-[#8b93a7]">{t("settings.phone_app_devices_empty")}</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((row) => {
              const active = !row.disconnectedAt;
              const online = isPhoneOnline(row);
              return (
                <li
                  key={row.id || row.deviceId}
                  className="rounded-[16px] border border-[#1e2a45] bg-[#131A2E] px-4 py-3 space-y-3"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {editingId === row.deviceId ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value.slice(0, 60))}
                          onBlur={() => void saveName(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveName(row);
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          className="w-full rounded-lg border border-brand/40 bg-[#0A0F1E] px-2 py-1 text-sm text-white outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={!canActivate || Boolean(actingId)}
                          onClick={() => {
                            setEditingId(row.deviceId);
                            setEditName(row.displayName);
                          }}
                          className="text-left text-sm font-medium text-white"
                        >
                          {row.displayName}
                        </button>
                      )}
                      <p className="mt-1 font-mono text-[11px] text-[#8b93a7] break-all">
                        {t("settings.phone_app_device_id")}: {row.deviceId}
                      </p>
                      <p className="mt-1 text-[11px] text-[#8b93a7]">
                        {row.os || t("settings.phone_app_os_unknown")}
                        {row.lastSeenAt
                          ? ` · ${t("settings.phone_app_last_seen", { time: formatStamp(row.lastSeenAt, language) })}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                        !active
                          ? "border-[#2a3a5a] bg-[#0A0F1E] text-[#8b93a7]"
                          : online
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                      )}
                    >
                      {!active
                        ? t("settings.phone_app_status_inactive")
                        : online
                          ? t("settings.phone_app_status_online")
                          : t("settings.phone_app_status_idle")}
                    </span>
                  </div>
                  {canActivate ? (
                    <div className="flex flex-wrap gap-2">
                      {active ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={actingId === row.deviceId}
                          onClick={() => void revoke(row, false)}
                          className="h-9 border-[#1e2a45] bg-transparent text-white"
                        >
                          <Unplug className="size-3.5" />
                          {t("settings.phone_app_revoke")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={actingId === row.deviceId}
                        onClick={() => void revoke(row, true)}
                        className="h-9 border-[#1e2a45] bg-transparent text-white"
                      >
                        {t("settings.phone_app_repair")}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#131A2E]">
            <Users className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">{t("settings.phone_app_waiters_title")}</h2>
            <p className="mt-0.5 text-sm text-[#8b93a7]">{t("settings.phone_app_waiters_lead")}</p>
          </div>
        </div>
        {waiters.length === 0 ? (
          <p className="text-sm text-[#8b93a7]">{t("settings.phone_app_waiters_empty")}</p>
        ) : (
          <ul className="space-y-2">
            {waiters.map((row) => (
              <li
                key={row._id}
                className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[#1e2a45] bg-[#131A2E] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{row.name}</p>
                  <p className="mt-0.5 text-[11px] text-[#8b93a7]">
                    {t(`staff.role_${row.role}`)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                    row.isActive
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                      : "border-[#2a3a5a] bg-[#0A0F1E] text-[#8b93a7]",
                  )}
                >
                  {row.isActive
                    ? t("settings.phone_app_waiter_allowed")
                    : t("settings.phone_app_waiter_blocked")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-2">
        <h2 className="text-lg font-semibold text-white">{t("settings.phone_app_session_title")}</h2>
        <p className="text-sm leading-relaxed text-[#8b93a7]">{t("settings.phone_app_session_lead")}</p>
      </section>
    </div>
  );
}
