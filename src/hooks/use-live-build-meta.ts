import { useEffect, useState } from "react";
import {
  fetchAppBuildMeta,
  type AppBuildMeta,
} from "@/lib/build-meta-fetch.ts";

/**
 * Live `package.json` version + installer mtime when dev/preview middleware or static
 * `build-meta.json` is available; otherwise `null` (caller keeps compile-time fallbacks).
 */
export function useLiveBuildMeta(): AppBuildMeta | null {
  const [meta, setMeta] = useState<AppBuildMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchAppBuildMeta().then((m) => {
      if (!cancelled && m) setMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return meta;
}
