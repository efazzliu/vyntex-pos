/** Trim a Vite env URL; return undefined if empty or placeholder. */
export function trimInstallerEnvUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 && !t.includes("...") ? t : undefined;
}

/** Dashboard + in-app download targets (client bundle). */
export function windowsInstallerX64Href(): string {
  return (
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL_X64) ??
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL) ??
    "/VyntexPOSSetup.exe"
  );
}

export function windowsInstallerArm64Href(): string | undefined {
  const arm64ExeInPublic = import.meta.env.VITE_ARM64_INSTALLER_AVAILABLE === "true";
  return (
    trimInstallerEnvUrl(import.meta.env.VITE_RESTAURANT_POS_EXE_URL_ARM64) ??
    (arm64ExeInPublic ? "/VyntexPOSSetup-arm64.exe" : undefined)
  );
}
