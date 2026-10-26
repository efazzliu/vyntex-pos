import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";
import {
  getOfflineQueueCount,
  getPrintQueueCount,
} from "@/lib/local-db.ts";

export const POS_UPDATE_ORIGIN = "https://www.vyntexpos.net";
const LAST_CHECK_KEY = "vyntex.pos.updateLastCheck";

export type PosAppUpdateCheck = {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  packaged: boolean;
  viaElectron: boolean;
  releaseNotes: string | null;
  installerUpdatedAt: string | null;
  downloaded: boolean;
  checkedAt: number;
};

export type PosSystemInfo = {
  runtime: "electron-packaged" | "electron-dev" | "web";
  appVersion: string;
  platform: string;
  arch: string;
  electron: string | null;
  chrome: string | null;
  osLabel: string;
  userAgent: string;
};

export type StoredUpdateCheck = {
  at: number;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
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

type PublishedMeta = {
  appVersion: string;
  installerUpdatedAt: string | null;
  releaseNotes: string | null;
};

function parsePublishedMeta(raw: unknown): PublishedMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  const appVersion = typeof j.appVersion === "string" ? j.appVersion.trim() : "";
  if (!appVersion) return null;
  const notes = typeof j.releaseNotes === "string" ? j.releaseNotes.trim() : "";
  return {
    appVersion,
    installerUpdatedAt:
      typeof j.installerUpdatedAt === "string" && j.installerUpdatedAt.trim()
        ? j.installerUpdatedAt.trim()
        : null,
    releaseNotes: notes || null,
  };
}

async function fetchLatestMetaFromOrigin(): Promise<PublishedMeta | null> {
  const urls = [
    `${POS_UPDATE_ORIGIN}/build-meta.json`,
    `${POS_UPDATE_ORIGIN}/__vyntex/build-meta.json`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const parsed = parsePublishedMeta(await r.json());
      if (parsed) return parsed;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function readStoredUpdateCheck(): StoredUpdateCheck | null {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUpdateCheck;
    if (!parsed?.at || !parsed.currentVersion) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredUpdateCheck(row: StoredUpdateCheck) {
  try {
    localStorage.setItem(LAST_CHECK_KEY, JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

export async function checkForPosAppUpdate(): Promise<PosAppUpdateCheck> {
  const desktop = window.desktop;
  const checkedAt = Date.now();
  if (typeof desktop?.checkForAppUpdate === "function") {
    const r = await desktop.checkForAppUpdate();
    const result: PosAppUpdateCheck = {
      currentVersion: r.currentVersion,
      latestVersion: r.latestVersion,
      updateAvailable: r.updateAvailable,
      packaged: r.packaged,
      viaElectron: true,
      releaseNotes: r.releaseNotes?.trim() || null,
      installerUpdatedAt: r.installerUpdatedAt ?? null,
      downloaded: r.downloaded === true,
      checkedAt,
    };
    writeStoredUpdateCheck({
      at: checkedAt,
      currentVersion: result.currentVersion,
      latestVersion: result.latestVersion,
      updateAvailable: result.updateAvailable,
    });
    return result;
  }

  const currentVersion = APP_VERSION_LABEL;
  const latest = await fetchLatestMetaFromOrigin();
  if (!latest) {
    throw new Error("check_failed");
  }
  const result: PosAppUpdateCheck = {
    currentVersion,
    latestVersion: latest.appVersion,
    updateAvailable: compareAppVersions(latest.appVersion, currentVersion) > 0,
    packaged: false,
    viaElectron: false,
    releaseNotes: latest.releaseNotes,
    installerUpdatedAt: latest.installerUpdatedAt,
    downloaded: false,
    checkedAt,
  };
  writeStoredUpdateCheck({
    at: checkedAt,
    currentVersion: result.currentVersion,
    latestVersion: result.latestVersion,
    updateAvailable: result.updateAvailable,
  });
  return result;
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

export async function downloadPosAppUpdate(): Promise<
  { ok: true; viaElectron: boolean } | { ok: false; error: string }
> {
  const desktop = window.desktop;
  if (desktop?.isElectron) {
    if (typeof desktop.downloadAppUpdate !== "function") {
      return { ok: false, error: "dev" };
    }
    const r = await desktop.downloadAppUpdate();
    if (r.ok) return { ok: true, viaElectron: true };
    return { ok: false, error: r.error || "download_failed" };
  }
  startBrowserInstallerDownload();
  return { ok: true, viaElectron: false };
}

export async function installPosAppUpdate(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const desktop = window.desktop;
  if (!desktop?.isElectron) {
    return { ok: false, error: "web" };
  }
  if (typeof desktop.installAppUpdate !== "function") {
    return { ok: false, error: "dev" };
  }
  const r = await desktop.installAppUpdate();
  if (r.ok) return { ok: true };
  return { ok: false, error: r.error || "install_failed" };
}

export async function readPosSystemInfo(): Promise<PosSystemInfo> {
  const desktop = window.desktop;
  if (desktop?.isElectron && typeof desktop.appSystemInfo === "function") {
    try {
      const row = await desktop.appSystemInfo();
      const runtime = row.packaged ? "electron-packaged" : "electron-dev";
      return {
        runtime,
        appVersion: row.appVersion || APP_VERSION_LABEL,
        platform: row.platform,
        arch: row.arch,
        electron: row.electron,
        chrome: row.chrome,
        osLabel: [row.osType, row.osRelease].filter(Boolean).join(" "),
        userAgent: navigator.userAgent,
      };
    } catch {
      /* fall through */
    }
  }
  const ua = navigator.userAgent;
  const platform = desktop?.platform || navigator.platform || "unknown";
  return {
    runtime: desktop?.isElectron ? "electron-dev" : "web",
    appVersion: APP_VERSION_LABEL,
    platform,
    arch: guessWindowsInstallerArch(),
    electron: null,
    chrome: null,
    osLabel: platform,
    userAgent: ua,
  };
}

export async function exportPosDiagnostics(extra: Record<string, unknown> = {}) {
  const [info, offlineQueue, printQueue] = await Promise.all([
    readPosSystemInfo(),
    getOfflineQueueCount(),
    getPrintQueueCount(),
  ]);
  const last = readStoredUpdateCheck();
  const payload = {
    generatedAt: new Date().toISOString(),
    ...info,
    online: navigator.onLine,
    language: navigator.language,
    screen: {
      width: window.screen?.width ?? null,
      height: window.screen?.height ?? null,
    },
    lastUpdateCheck: last,
    offlineQueueCount: offlineQueue,
    printQueueCount: printQueue,
    ...extra,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vyntex-pos-diagnostics-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
