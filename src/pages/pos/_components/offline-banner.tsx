import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { useSyncState } from "./offline-sync-manager.tsx";
import { Wifi, WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { motion, AnimatePresence } from "motion/react";

/**
 * Floating offline/sync banner for the POS.
 * Shows status:
 *  - Online: green dot (small, unobtrusive)
 *  - Offline: amber banner with queue count
 *  - Syncing: blue pulsing banner
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { queueCount, isSyncing } = useSyncState();

  // Don't show anything when online and no pending items
  if (isOnline && queueCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm",
          !isOnline
            ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
            : isSyncing
              ? "bg-blue-500/20 border border-blue-500/40 text-blue-300"
              : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
        )}
      >
        {!isOnline ? (
          <>
            <WifiOff className="size-3.5" />
            <span>Offline Mode</span>
            {queueCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/30 text-[10px]">
                {queueCount} pending
              </span>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="size-3.5 animate-spin" />
            <span>Syncing...</span>
          </>
        ) : queueCount > 0 ? (
          <>
            <CloudOff className="size-3.5" />
            <span>{queueCount} pending sync</span>
          </>
        ) : (
          <>
            <Wifi className="size-3.5" />
            <span>Back online</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
