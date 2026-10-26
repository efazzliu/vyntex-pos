import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Cloud,
  CloudOff,
  Database,
  HardDrive,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import {
  getQueuedMutations,
  type QueuedMutation,
} from "@/lib/local-db.ts";
import { usePosLocale } from "./pos-locale-provider.tsx";
import { useSyncState } from "./offline-sync-manager.tsx";

type Translate = (key: string, options?: Record<string, unknown>) => string;

type SettingsStoragePanelProps = {
  t: Translate;
  licenseKey: string;
};

function formatStamp(iso: string | null | undefined, language: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString(language === "sq" ? "sq-AL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SettingsStoragePanel({
  t,
  licenseKey,
}: SettingsStoragePanelProps) {
  const { language } = usePosLocale();
  const isOnline = useOnlineStatus();
  const { queueCount, isSyncing, lastSyncError, retrySync } = useSyncState();
  const companyQuery = useQuery("pos.settings.getCompanyDetails", {
    licenseKey,
  });
  const lastPosSyncAt =
    companyQuery && typeof companyQuery === "object" && !Array.isArray(companyQuery)
      ? String(
          (companyQuery as { lastPosSyncAt?: string | null }).lastPosSyncAt ?? "",
        ).trim() || null
      : null;

  const [queue, setQueue] = useState<QueuedMutation[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const rows = await getQueuedMutations();
      if (!cancelled) setQueue(rows);
    };
    void load();
    const id = window.setInterval(() => void load(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [queueCount, isSyncing]);

  const oldestPending = useMemo(() => {
    let oldest: string | null = null;
    for (const row of queue) {
      if (!oldest || row.createdAt < oldest) oldest = row.createdAt;
    }
    return oldest;
  }, [queue]);
  const failedCount = queue.filter((row) => row.retries > 0).length;
  const lastSyncLabel = formatStamp(lastPosSyncAt, language);
  const oldestLabel = formatStamp(oldestPending, language);

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#64748B]/15">
            <CloudOff className="size-5 text-[#94a3b8]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                {t("settings.store_backup_title")}
              </h2>
              <span className="rounded-full border border-[#2a3a5a] bg-[#131A2E] px-2.5 py-0.5 text-[11px] font-semibold text-[#8b93a7]">
                {t("settings.store_status_unavailable")}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[#8b93a7]">
              {t("settings.store_backup_lead")}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatusCell
            label={t("settings.store_status")}
            value={t("settings.store_status_unavailable")}
          />
          <StatusCell
            label={t("settings.store_last_backup")}
            value={t("settings.store_last_backup_none")}
          />
          <StatusCell
            label={t("settings.store_schedule")}
            value={t("settings.store_schedule_none")}
          />
          <StatusCell
            label={t("settings.store_retention")}
            value={t("settings.store_retention_none")}
          />
        </dl>
        <div className="rounded-[18px] border border-[#1e2a45] bg-[#131A2E] p-4">
          <p className="text-sm font-semibold text-white">
            {t("settings.store_restore")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#8b93a7]">
            {t("settings.store_restore_unavailable")}
          </p>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <HardDrive className="size-5 text-amber-400" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">
              {t("settings.store_queue_title")}
            </h2>
            <p className="mt-0.5 text-sm text-[#8b93a7]">
              {t("settings.store_queue_lead")}
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-[14px] border px-3 py-2.5 text-sm",
            isOnline
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/20 bg-amber-500/10 text-amber-300",
          )}
        >
          {isOnline ? (
            <Wifi className="size-4 shrink-0" />
          ) : (
            <WifiOff className="size-4 shrink-0" />
          )}
          {isOnline
            ? t("settings.store_queue_online")
            : t("settings.store_queue_offline")}
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatusCell
            label={t("settings.store_queue_pending")}
            value={
              queueCount === 0
                ? t("settings.store_queue_empty")
                : t("settings.store_queue_count", { count: queueCount })
            }
          />
          <StatusCell
            label={t("settings.store_queue_oldest")}
            value={oldestLabel ?? t("settings.store_queue_oldest_none")}
          />
          <StatusCell
            label={t("settings.store_queue_failed")}
            value={
              failedCount === 0
                ? t("settings.store_queue_failed_none")
                : t("settings.store_queue_failed_count", { count: failedCount })
            }
          />
        </dl>
        {lastSyncError ? (
          <p className="rounded-[14px] border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {lastSyncError}
          </p>
        ) : null}
        {queueCount > 0 ? (
          <Button
            type="button"
            disabled={!isOnline || isSyncing}
            onClick={() => void retrySync()}
            className="bg-brand hover:bg-brand-hover h-11"
          >
            <RefreshCw
              className={cn("size-4 mr-1.5", isSyncing && "animate-spin")}
            />
            {isSyncing
              ? t("settings.store_queue_syncing")
              : t("settings.store_queue_retry")}
          </Button>
        ) : null}
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
            <Cloud className="size-5 text-brand" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">
              {t("settings.store_sync_title")}
            </h2>
            <p className="mt-0.5 text-sm text-[#8b93a7]">
              {t("settings.store_sync_lead")}
            </p>
          </div>
        </div>
        <dl>
          <StatusCell
            label={t("settings.store_sync_last")}
            value={lastSyncLabel ?? t("settings.store_sync_never")}
          />
        </dl>
      </section>

      <section className="rounded-[22px] border border-[#1e2a45] bg-[#0D1326] p-5 sm:p-6 space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1e2a45]">
            <Database className="size-5 text-[#8b93a7]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">
              {t("settings.store_recovery_title")}
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-[#8b93a7]">
              {t("settings.store_recovery_cloud")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#8b93a7]">
              {t("settings.store_recovery_queue")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#8b93a7]">
              {t("settings.store_recovery_device")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#1e2a45] bg-[#131A2E] px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#5a6580]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-white">{value}</dd>
    </div>
  );
}
