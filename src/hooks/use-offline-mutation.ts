import { useCallback, useRef } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status.ts";
import { enqueueMutation } from "@/lib/local-db.ts";
import { toast } from "sonner";

/**
 * Returns a function that either calls the Convex mutation directly (online)
 * or queues it for later replay (offline).
 *
 * @param mutationFn  The Convex mutation function from `useMutation()`
 * @param functionPath  A string identifier for the mutation (e.g. "pos.orders.createOrder")
 *                      Used to replay the mutation later via the sync manager
 */
export function useOfflineMutation<TArgs extends Record<string, unknown>, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  functionPath: string
): (args: TArgs) => Promise<TResult | null> {
  const isOnline = useOnlineStatus();
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  return useCallback(
    async (args: TArgs): Promise<TResult | null> => {
      if (isOnlineRef.current) {
        // Online: call the mutation directly
        return mutationFn(args);
      }

      // Offline: queue the mutation for later sync
      await enqueueMutation(functionPath, args as Record<string, unknown>);
      toast.info("Saved offline. Will sync when back online.", {
        duration: 2000,
      });
      return null;
    },
    [mutationFn, functionPath]
  );
}
