import { rootFetchPath } from "@/lib/build-meta-fetch.ts";

/** Trim a Vite env URL; return undefined if empty or placeholder. */
export function trimInstallerEnvUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 && !t.includes("...") ? t : undefined;
}

export type WindowsInstallerArch = "x64" | "arm64";

/** Browser download filename (matches electron-builder artifact naming). */
export function installerDownloadFilename(
  arch: WindowsInstallerArch,
  version: string,
): string {
  const v = version.trim() || "0.0.0";
  return `RestaurantPOSSetup-${v}-${arch}.exe`;
}

function resolveInstallerHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.replace(/^\//, "");
  return rootFetchPath(path);
}

function isSameOriginUrl(url: string): boolean {
  try {
    const resolved = new URL(url, window.location.href);
    return resolved.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Start a Windows installer download with a versioned filename in the browser UI
 * (e.g. `RestaurantPOSSetup-1.0.8-x64.exe` instead of `RestaurantPOSSetup (2).exe`).
 */
export function triggerInstallerDownload(
  url: string,
  arch: WindowsInstallerArch,
  version: string,
): void {
  const filename = installerDownloadFilename(arch, version);
  const href = resolveInstallerHref(url);

  if (isSameOriginUrl(href)) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  window.open(href, "_blank", "noopener,noreferrer");
}

/** Dashboard + in-app download targets (client bundle). */
export function windowsInstallerX64Href(): string {
  return (
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL_X64) ??
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL) ??
    "/RestaurantPOSSetup.exe"
  );
}

export function windowsInstallerArm64Href(): string | undefined {
  const arm64ExeInPublic = import.meta.env.VITE_ARM64_INSTALLER_AVAILABLE === "true";
  return (
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL_ARM64) ??
    (arm64ExeInPublic ? "/RestaurantPOSSetup-arm64.exe" : undefined)
  );
}
