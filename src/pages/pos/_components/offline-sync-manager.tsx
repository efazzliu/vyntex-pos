import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import {
  getQueuedMutations,
  removeQueuedMutation,
  incrementMutationRetry,
  getOfflineQueueCount,
  type QueuedMutation,
} from "@/lib/local-db.ts";
import { toast } from "sonner";
import { runQueuedMutation } from "@/lib/supabase-pos.ts";

// ── Context for offline sync state ──

type SyncState = {
  queueCount: number;
  isSyncing: boolean;
  lastSyncError: string | null;
};

const SyncContext = createContext<SyncState>({
  queueCount: 0,
  isSyncing: false,
  lastSyncError: null,
});

export function useSyncState() {
  return useContext(SyncContext);
}

const MAX_RETRIES = 5;

type OfflineSyncManagerProps = {
  children: React.ReactNode;
};

export default function OfflineSyncManager({ children }: OfflineSyncManagerProps) {
  const isOnline = useOnlineStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const syncInProgressRef = useRef(false);

  // Poll queue count periodically
  useEffect(() => {
    const updateCount = async () => {
      const count = await getOfflineQueueCount();
      setQueueCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  const replayQueue = useCallback(async () => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    setIsSyncing(true);
    setLastSyncError(null);

    try {
      const queue = await getQueuedMutations();
      if (queue.length === 0) {
        setIsSyncing(false);
        syncInProgressRef.current = false;
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const item of queue) {
        if (item.retries >= MAX_RETRIES) {
          // Too many retries, discard
          await removeQueuedMutation(item.id);
          failCount++;
          continue;
        }

        if (!item.functionPath.startsWith("pos.")) {
          await removeQueuedMutation(item.id);
          failCount++;
          continue;
        }

        try {
          await runQueuedMutation(
            item.functionPath,
            item.args as Record<string, unknown>,
          );
          await removeQueuedMutation(item.id);
          successCount++;
        } catch {
          await incrementMutationRetry(item.id);
          failCount++;
        }
      }

      const newCount = await getOfflineQueueCount();
      setQueueCount(newCount);

      if (successCount > 0) {
        toast.success(`Synced ${successCount} offline action${successCount > 1 ? "s" : ""}`, {
          duration: 3000,
        });
      }
      if (failCount > 0 && newCount > 0) {
        setLastSyncError(`${newCount} action${newCount > 1 ? "s" : ""} failed to sync`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setLastSyncError(message);
    } finally {
      setIsSyncing(false);
      syncInProgressRef.current = false;
    }
  }, []);

  // When transitioning from offline → online, replay the queue
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) {
      // Just came back online
      replayQueue();
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, replayQueue]);

  return (
    <SyncContext.Provider value={{ queueCount, isSyncing, lastSyncError }}>
      {children}
    </SyncContext.Provider>
  );
}
