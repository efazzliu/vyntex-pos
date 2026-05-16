import { rootFetchPath } from "@/lib/build-meta-fetch.ts";
import { APP_VERSION_LABEL } from "@/lib/site-constants.ts";

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

/** Same-site path; the URL path is the download name (not `RestaurantPOSSetup.exe`). */
export function versionedInstallerWebPath(
  arch: WindowsInstallerArch,
  version: string = APP_VERSION_LABEL,
): string {
  return `/${installerDownloadFilename(arch, version)}`;
}

function resolveInstallerHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.replace(/^\//, "");
  return rootFetchPath(path);
}

function isCustomInstallerUrl(url: string): boolean {
  const candidates = [
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL_X64),
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL),
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL_ARM64),
  ].filter(Boolean) as string[];
  return candidates.some((c) => c === url);
}

/**
 * Start a Windows installer download. Uses a versioned URL path so the browser
 * saves `RestaurantPOSSetup-1.0.8-x64.exe` (the `download` attribute alone is
 * often ignored for .exe on same-origin).
 */
export function triggerInstallerDownload(
  url: string,
  arch: WindowsInstallerArch,
  version: string,
): void {
  const target =
    /^https?:\/\//i.test(url) || isCustomInstallerUrl(url)
      ? url
      : versionedInstallerWebPath(arch, version);

  const href = resolveInstallerHref(target);
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Dashboard + in-app download targets (client bundle). */
export function windowsInstallerX64Href(version: string = APP_VERSION_LABEL): string {
  const custom =
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL_X64) ??
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL);
  if (custom) return custom;
  return versionedInstallerWebPath("x64", version);
}

export function windowsInstallerArm64Href(version: string = APP_VERSION_LABEL): string | undefined {
  const custom = trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL_ARM64);
  if (custom) return custom;
  const arm64ExeInPublic = import.meta.env.VITE_ARM64_INSTALLER_AVAILABLE === "true";
  if (!arm64ExeInPublic) return undefined;
  return versionedInstallerWebPath("arm64", version);
}
