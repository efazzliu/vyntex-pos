import { fetchAppBuildMeta, rootFetchPath } from "@/lib/build-meta-fetch.ts";
import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";

export const POS_UPDATE_ORIGIN = "https://www.vyntexpos.net";

export type PosAppUpdateCheck = {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  packaged: boolean;
  viaElectron: boolean;
};

export function compareAppVersions(a: string, b: string): number {
  const parse = (v: string) =>
    String(v || "0")
      .split(/[^\d]+/)
      .filter(Boolean)
      .map((n) => Number(n) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function productionInstallerUrl(arch: "x64" | "arm64" = "x64"): string {
  return arch === "arm64"
    ? `${POS_UPDATE_ORIGIN}/RestaurantPOSSetup-arm64.exe`
    : `${POS_UPDATE_ORIGIN}/RestaurantPOSSetup.exe`;
}

export function guessWindowsInstallerArch(): "x64" | "arm64" {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/arm64|aarch64/i.test(ua)) return "arm64";
  return "x64";
}

async function fetchLatestVersionFromOrigin(): Promise<string | null> {
  const urls = [
    `${POS_UPDATE_ORIGIN}/build-meta.json`,
    `${POS_UPDATE_ORIGIN}/__vyntex/build-meta.json`,
    rootFetchPath("build-meta.json"),
    rootFetchPath("__vyntex/build-meta.json"),
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const j = (await r.json()) as { appVersion?: string };
      if (typeof j.appVersion === "string" && j.appVersion.trim()) {
        return j.appVersion.trim();
      }
    } catch {
      /* try next */
    }
  }
  const local = await fetchAppBuildMeta();
  return local?.appVersion ?? null;
}

export async function checkForPosAppUpdate(): Promise<PosAppUpdateCheck> {
  const desktop = window.desktop;
  if (typeof desktop?.checkForAppUpdate === "function") {
    const r = await desktop.checkForAppUpdate();
    return {
      currentVersion: r.currentVersion,
      latestVersion: r.latestVersion,
      updateAvailable: r.updateAvailable,
      packaged: r.packaged,
      viaElectron: true,
    };
  }

  const currentVersion = APP_VERSION_LABEL;
  const latestVersion = await fetchLatestVersionFromOrigin();
  if (!latestVersion) {
    throw new Error("check_failed");
  }
  return {
    currentVersion,
    latestVersion,
    updateAvailable: compareAppVersions(latestVersion, currentVersion) > 0,
    packaged: false,
    viaElectron: false,
  };
}

export function startBrowserInstallerDownload(): void {
  const href = productionInstallerUrl(guessWindowsInstallerArch());
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
