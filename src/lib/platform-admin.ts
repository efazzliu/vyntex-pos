/**
 * Site-wide platform admins (license owner / support).
 * Set VITE_PLATFORM_ADMIN_EMAILS in env: comma-separated emails (case-insensitive).
 * For production, tighten Supabase RLS and/or use Edge Functions with service role.
 */
const CUSTOM_ADMINS_STORAGE_KEY = "vyntex.platform_admin_emails.custom";
export type PlatformAdminRole = "full" | "operations" | "support" | "finance" | "viewer";
type StoredCustomAdmins = Record<string, PlatformAdminRole>;
type PlatformAdminSource = "env" | "custom";

export type PlatformAdminEntry = {
  email: string;
  role: PlatformAdminRole;
  source: PlatformAdminSource;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function parsePlatformAdminEmails(): Set<string> {
  const raw = (import.meta.env.VITE_PLATFORM_ADMIN_EMAILS as string | undefined) ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => normalizeEmail(e))
      .filter(Boolean),
  );
}

function normalizeRole(role: unknown): PlatformAdminRole {
  if (role === "full") return "full";
  if (role === "operations") return "operations";
  if (role === "support" || role === "limited") return "support";
  if (role === "finance") return "finance";
  if (role === "viewer") return "viewer";
  return "support";
}

function readCustomPlatformAdmins(): StoredCustomAdmins {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_ADMINS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;

    // Backward-compat: previous format was string[] emails.
    if (Array.isArray(parsed)) {
      const out: StoredCustomAdmins = {};
      for (const entry of parsed) {
        if (typeof entry !== "string") continue;
        const e = normalizeEmail(entry);
        if (!e) continue;
        out[e] = "limited";
      }
      return out;
    }

    if (!parsed || typeof parsed !== "object") return {};
    const out: StoredCustomAdmins = {};
    for (const [emailRaw, roleRaw] of Object.entries(parsed as Record<string, unknown>)) {
      const e = normalizeEmail(emailRaw);
      if (!e) continue;
      out[e] = normalizeRole(roleRaw);
    }
    return out;
  } catch {
    return {};
  }
}

function writeCustomPlatformAdmins(map: StoredCustomAdmins) {
  if (!canUseStorage()) return;
  const normalized: StoredCustomAdmins = {};
  for (const [emailRaw, role] of Object.entries(map)) {
    const email = normalizeEmail(emailRaw);
    if (!email) continue;
    normalized[email] = normalizeRole(role);
  }
  window.localStorage.setItem(CUSTOM_ADMINS_STORAGE_KEY, JSON.stringify(normalized));
}

export function getCustomPlatformAdminEmails(): string[] {
  return Object.keys(readCustomPlatformAdmins());
}

export function addCustomPlatformAdminEmail(
  email: string,
  role: PlatformAdminRole = "support",
): void {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const next = readCustomPlatformAdmins();
  next[normalized] = normalizeRole(role);
  writeCustomPlatformAdmins(next);
}

export function removeCustomPlatformAdminEmail(email: string): void {
  const normalized = normalizeEmail(email);
  const next = readCustomPlatformAdmins();
  delete next[normalized];
  writeCustomPlatformAdmins(next);
}

export function setCustomPlatformAdminRole(email: string, role: PlatformAdminRole): void {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const next = readCustomPlatformAdmins();
  if (!next[normalized]) return;
  next[normalized] = normalizeRole(role);
  writeCustomPlatformAdmins(next);
}

export function getPlatformAdminRole(email: string | null | undefined): PlatformAdminRole | null {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  const env = parsePlatformAdminEmails();
  if (env.has(normalized)) return "full";
  const custom = readCustomPlatformAdmins();
  return custom[normalized] ?? null;
}

export function getAllPlatformAdminEmails(): string[] {
  return getAllPlatformAdmins().map((x) => x.email);
}

export function getAllPlatformAdmins(): PlatformAdminEntry[] {
  const out = new Map<string, PlatformAdminEntry>();
  for (const email of parsePlatformAdminEmails()) {
    out.set(email, { email, role: "full", source: "env" });
  }
  for (const [email, role] of Object.entries(readCustomPlatformAdmins())) {
    if (out.has(email)) continue;
    out.set(email, { email, role, source: "custom" });
  }
  return Array.from(out.values()).sort((a, b) => a.email.localeCompare(b.email));
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  return getPlatformAdminRole(email) !== null;
}

export function canAccessAdminPath(pathname: string, adminAccess: PlatformAdminRole | null): boolean {
  if (!adminAccess) return false;
  if (adminAccess === "full") return pathname.startsWith("/admin");

  const roleRoutes: Record<Exclude<PlatformAdminRole, "full">, string[]> = {
    operations: [
      "/admin",
      "/admin/businesses",
      "/admin/licenses",
      "/admin/branches",
      "/admin/subscriptions",
      "/admin/bookings",
      "/admin/users",
      "/admin/staff-roles",
      "/admin/modules",
      "/admin/settings",
    ],
    support: ["/admin", "/admin/users", "/admin/support", "/admin/contacts", "/admin/settings"],
    finance: [
      "/admin",
      "/admin/invoices",
      "/admin/subscriptions",
      "/admin/licenses",
      "/admin/reports",
      "/admin/settings",
    ],
    viewer: ["/admin", "/admin/settings"],
  };

  const allowed = roleRoutes[adminAccess] ?? ["/admin"];
  return allowed.some((base) =>
    base === "/admin" ? pathname === "/admin" : pathname.startsWith(base),
  );
}

export function canSeeAdminNavItem(
  href: string,
  adminAccess: PlatformAdminRole | null,
): boolean {
  return canAccessAdminPath(href, adminAccess);
}
