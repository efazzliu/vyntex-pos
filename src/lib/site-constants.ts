/**
 * Public support address shown across the marketing site and dashboard.
 * Override with VITE_SUPPORT_EMAIL when building (e.g. staging).
 */
const raw = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim();

export const SUPPORT_EMAIL = raw && raw.includes("@") ? raw : "support@vyntexpos.com";

export const SUPPORT_MAILTO_HREF = `mailto:${SUPPORT_EMAIL}`;

/**
 * Marketing contact page: show the support address as a clickable `mailto` link.
 * Set to `true` once the business inbox is live; while `false`, visitors use the form only.
 */
export const SUPPORT_BUSINESS_EMAIL_READY = false;

/** Pre-filled subjects for Enterprise customers (POS Settings). */
export function supportMailtoWithSubject(subject: string): string {
  return `${SUPPORT_MAILTO_HREF}?subject=${encodeURIComponent(subject)}`;
}

export const MAILTO_ENTERPRISE_PRIORITY_SUPPORT = supportMailtoWithSubject(
  "Vyntex POS — Enterprise priority support",
);

export const MAILTO_ENTERPRISE_SLA_ONBOARDING = supportMailtoWithSubject(
  "Vyntex POS — Enterprise SLA / onboarding",
);

function resolveAppVersionLabel(): string {
  if (typeof __APP_VERSION__ === "string" && __APP_VERSION__.trim().length > 0) {
    return __APP_VERSION__.trim();
  }
  const fromEnv = import.meta.env.VITE_APP_VERSION;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return "0.0.0-dev";
}

/**
 * User-facing version (footer, PIN screen, phone profile, dashboard). Prefer `__APP_VERSION__`
 * from Vite `define`, then `import.meta.env.VITE_APP_VERSION`.
 */
export const APP_VERSION_LABEL = resolveAppVersionLabel();

function formatInstallerMtimeForUi(iso: string | undefined): string | null {
  if (!iso || !String(iso).trim()) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Raw ISO mtime of `public/VyntexPOSSetup.exe` from Vite `define` (dev start / build). */
export function readInstallerUpdatedAtIso(): string | undefined {
  const a = typeof __INSTALLER_UPDATED_AT__ === "string" ? __INSTALLER_UPDATED_AT__.trim() : "";
  if (a) return a;
  const b = import.meta.env.VITE_INSTALLER_UPDATED_AT;
  if (typeof b === "string" && b.trim()) return b.trim();
  return undefined;
}

/** User-facing timestamp for the Windows x64 installer file in `public/`. */
export function formattedInstallerMtime(): string | null {
  return formatInstallerMtimeForUi(readInstallerUpdatedAtIso());
}
