import { useCallback } from "react";

/**
 * @deprecated Offline queuing is handled inside `useMutation` from `convex/react`
 * for all `pos.*` mutations. This hook only forwards to `mutationFn`.
 */
export function useOfflineMutation<TArgs extends Record<string, unknown>, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  _functionPath: string,
): (args: TArgs) => Promise<TResult | null> {
  return useCallback((args: TArgs) => mutationFn(args) as Promise<TResult | null>, [mutationFn]);
}
