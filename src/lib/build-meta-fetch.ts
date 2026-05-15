/**
 * Build-time meta is injected via Vite `define`, but that only refreshes when the dev
 * server restarts. In dev/preview we also expose live JSON so the dashboard can match
 * `package.json` + installer mtime without a restart.
 */
export type AppBuildMeta = {
  appVersion: string;
  installerUpdatedAt: string | null;
};

/** Path for `fetch()` from the site origin (nested SPA routes when `base` is `./`). */
export function rootFetchPath(relativePath: string): string {
  const p = relativePath.replace(/^\//, "");
  const base = import.meta.env.BASE_URL;
  if (!base || base === "./" || base === ".") return `/${p}`;
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${prefix}/${p}`;
}

export async function fetchAppBuildMeta(): Promise<AppBuildMeta | null> {
  const candidates = [
    rootFetchPath("__vyntex/build-meta.json"),
    rootFetchPath("build-meta.json"),
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const j = (await r.json()) as Partial<AppBuildMeta>;
      if (typeof j.appVersion === "string" && j.appVersion.trim()) {
        return {
          appVersion: j.appVersion.trim(),
          installerUpdatedAt:
            typeof j.installerUpdatedAt === "string" && j.installerUpdatedAt.trim()
              ? j.installerUpdatedAt.trim()
              : null,
        };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}
