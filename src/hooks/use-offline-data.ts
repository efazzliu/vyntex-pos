import { useState, useEffect } from "react";
import { saveDataCache, getDataCache } from "@/lib/local-db.ts";

/**
 * Wraps a Convex useQuery result with IndexedDB caching.
 * When online and query returns data, it's cached locally.
 * When offline (query returns undefined), the last cached value is returned.
 *
 * @param cacheKey  Unique identifier for this query (e.g. "tables:LICENSE_KEY")
 * @param queryResult  The result from a Convex `useQuery()` call (undefined while loading or offline)
 * @param isOnline  Whether the device is currently online
 */
export function useOfflineData<T>(
  cacheKey: string,
  queryResult: T | undefined,
  _isOnline: boolean
): { data: T | undefined; isCached: boolean; isHydrated: boolean } {
  const [cachedData, setCachedData] = useState<T | undefined>(undefined);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from cache on mount or when cache key changes
  useEffect(() => {
    let cancelled = false;
    setIsHydrated(false);
    setCachedData(undefined);

    getDataCache<T>(cacheKey).then((cached) => {
      if (cancelled) return;
      if (cached !== undefined) {
        setCachedData(cached);
      }
      setIsHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  // When live data arrives, update the cache
  useEffect(() => {
    if (queryResult !== undefined) {
      setCachedData(queryResult);
      // Save to IndexedDB (fire-and-forget)
      saveDataCache(cacheKey, queryResult).catch(() => {
        // Silently ignore IndexedDB write errors
      });
    }
  }, [queryResult, cacheKey]);

  // Determine what to return
  if (queryResult !== undefined) {
    return { data: queryResult, isCached: false, isHydrated: true };
  }

  // Waiting for first IndexedDB read for this cache key
  if (!isHydrated) {
    return { data: undefined, isCached: false, isHydrated: false };
  }

  // Hydrated: use cache if present (cache miss => data undefined; caller may use ?? [])
  if (cachedData !== undefined) {
    return { data: cachedData, isCached: true, isHydrated: true };
  }

  return { data: undefined, isCached: false, isHydrated: true };
}
