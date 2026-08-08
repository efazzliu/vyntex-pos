import { supabase } from "@/lib/supabase.ts";
import {
  DEFAULT_DASHBOARD_NOTIFICATION_PREFS,
  type DashboardActivityItem,
  type DashboardLoginHistoryEntry,
  type DashboardNotificationPrefs,
  type DashboardUserMetadata,
} from "./types.ts";

const LOGIN_HISTORY_MAX = 12;

export function mergeDashboardNotificationPrefs(
  raw?: Partial<DashboardNotificationPrefs> | null,
): DashboardNotificationPrefs {
  return { ...DEFAULT_DASHBOARD_NOTIFICATION_PREFS, ...raw };
}

export function mergeDashboardLoginHistory(
  raw?: DashboardLoginHistoryEntry[] | null,
): DashboardLoginHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e) => e && typeof e.at === "string").slice(0, LOGIN_HISTORY_MAX);
}

export function appendDashboardLoginHistory(
  prev: DashboardLoginHistoryEntry[],
  userAgent: string,
  ip?: string,
): DashboardLoginHistoryEntry[] {
  const at = new Date().toISOString();
  const last = prev[0];
  if (last && last.userAgent === userAgent && last.ip === ip) {
    const lastMs = new Date(last.at).getTime();
    if (Date.now() - lastMs < 60_000) return prev;
  }
  return [{ at, userAgent, ip }, ...prev].slice(0, LOGIN_HISTORY_MAX);
}

export async function loadDashboardAccountMeta(): Promise<{
  notifications: DashboardNotificationPrefs;
  loginHistory: DashboardLoginHistoryEntry[];
  passwordChangedAt: string | null;
  emailVerified: boolean;
}> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const meta = (user?.user_metadata ?? {}) as DashboardUserMetadata;
  return {
    notifications: mergeDashboardNotificationPrefs(meta.dashboard_notifications),
    loginHistory: mergeDashboardLoginHistory(meta.dashboard_login_history),
    passwordChangedAt:
      typeof meta.password_changed_at === "string" ? meta.password_changed_at : null,
    emailVerified: Boolean(user?.email_confirmed_at),
  };
}

export async function recordPasswordChangedAt(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const existing = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
  await supabase.auth.updateUser({
    data: {
      ...existing,
      password_changed_at: new Date().toISOString(),
    },
  });
}

export function formatRelativeActivity(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.round(
      (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const time = date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (dayDiff === 0) return `Today ${time}`;
    if (dayDiff === 1) return `Yesterday ${time}`;
    if (dayDiff < 7) return `${dayDiff} days ago`;
    return formatSettingsDateTime(iso);
  } catch {
    return iso;
  }
}

export function parseDeviceLabel(ua: string): string {
  if (/Macintosh|Mac OS/i.test(ua)) return "MacBook Pro";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
  if (/Electron/i.test(ua)) return "Vyntex POS desktop";
  return parseUserAgentLabel(ua);
}

export function buildAccountActivityFeed(input: {
  loginHistory: DashboardLoginHistoryEntry[];
  passwordChangedAt: string | null;
}): DashboardActivityItem[] {
  const items: DashboardActivityItem[] = [];
  const last = input.loginHistory[0];
  if (last) {
    items.push({
      id: "last-login",
      label: "Last login",
      value: formatRelativeActivity(last.at),
    });
  }
  if (input.passwordChangedAt) {
    items.push({
      id: "password-changed",
      label: "Password changed",
      value: formatRelativeActivity(input.passwordChangedAt),
    });
  } else {
    items.push({
      id: "password-changed",
      label: "Password changed",
      value: "Not recorded yet",
      tone: "warning",
    });
  }
  const prev = input.loginHistory[1];
  if (last && prev) {
    const currentDevice = parseDeviceLabel(last.userAgent);
    const prevDevice = parseDeviceLabel(prev.userAgent);
    if (currentDevice !== prevDevice) {
      items.push({
        id: "new-device",
        label: "New device login",
        value: currentDevice,
        tone: "info",
      });
    } else {
      items.push({
        id: "device",
        label: "Current device",
        value: currentDevice,
      });
    }
  } else if (last) {
    items.push({
      id: "device",
      label: "Current device",
      value: parseDeviceLabel(last.userAgent),
    });
  }
  return items;
}

export type ProfileCompletionItem = {
  id: string;
  label: string;
  points: number;
  done: boolean;
  hint?: string;
};

export const ACCOUNT_COUNTRY_OPTIONS = [
  { value: "AL", label: "Albania" },
  { value: "XK", label: "Kosovo" },
  { value: "MK", label: "North Macedonia" },
  { value: "ME", label: "Montenegro" },
  { value: "RS", label: "Serbia" },
  { value: "HR", label: "Croatia" },
  { value: "SI", label: "Slovenia" },
  { value: "BA", label: "Bosnia and Herzegovina" },
  { value: "GR", label: "Greece" },
  { value: "IT", label: "Italy" },
  { value: "DE", label: "Germany" },
  { value: "CH", label: "Switzerland" },
  { value: "AT", label: "Austria" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
] as const;

export function getProfileCompletionChecklist(input: {
  fullName: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  country: string;
  hasRestaurant: boolean;
  mfaEnabled?: boolean;
}): ProfileCompletionItem[] {
  const nameDone = input.fullName.trim().length >= 2;
  const emailDone = Boolean(input.email.trim());
  const verifiedDone = input.emailVerified;
  const phoneDone = input.phone.trim().length >= 6;
  const countryDone = Boolean(input.country.trim());
  const venueDone = input.hasRestaurant;
  const mfaDone = Boolean(input.mfaEnabled);

  return [
    {
      id: "name",
      label: "Full name",
      points: 20,
      done: nameDone,
      hint: nameDone ? undefined : "Add your full name and save",
    },
    {
      id: "email",
      label: "Email on account",
      points: 15,
      done: emailDone,
    },
    {
      id: "verified",
      label: "Email verified",
      points: 15,
      done: verifiedDone,
      hint: verifiedDone ? undefined : "Confirm the link in your inbox",
    },
    {
      id: "phone",
      label: "Phone number",
      points: 15,
      done: phoneDone,
      hint: phoneDone ? undefined : "Add a contact phone number",
    },
    {
      id: "country",
      label: "Country",
      points: 15,
      done: countryDone,
      hint: countryDone ? undefined : "Select your country",
    },
    {
      id: "venue",
      label: "Venue linked",
      points: 10,
      done: venueDone,
      hint: venueDone ? undefined : "Enter your POS license key in the section below",
    },
    {
      id: "mfa",
      label: "Two-factor authentication (2FA)",
      points: 10,
      done: mfaDone,
      hint: mfaDone ? undefined : "Optional — enable in Settings → Security",
    },
  ];
}

export function computeProfileCompleteness(input: {
  fullName: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  country: string;
  hasRestaurant: boolean;
  mfaEnabled?: boolean;
}): number {
  return getProfileCompletionChecklist(input).reduce(
    (sum, item) => sum + (item.done ? item.points : 0),
    0,
  );
}

export async function saveDashboardNotificationPrefs(
  notifications: DashboardNotificationPrefs,
): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const existing = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
  const { error } = await supabase.auth.updateUser({
    data: {
      ...existing,
      dashboard_notifications: notifications,
    },
  });
  return error?.message ?? null;
}

export async function recordDashboardLoginVisit(): Promise<DashboardLoginHistoryEntry[]> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  let ip: string | undefined;
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(3000),
    });
    const data = (await res.json()) as { ip?: string };
    if (data.ip) ip = data.ip;
  } catch {
    /* optional */
  }

  const { data: userData } = await supabase.auth.getUser();
  const meta = (userData.user?.user_metadata ?? {}) as DashboardUserMetadata;
  const prev = mergeDashboardLoginHistory(meta.dashboard_login_history);
  const nextHistory = appendDashboardLoginHistory(prev, ua, ip);

  try {
    const existing = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
    await supabase.auth.updateUser({
      data: { ...existing, dashboard_login_history: nextHistory },
    });
  } catch {
    /* non-blocking */
  }

  return nextHistory;
}

export function formatSettingsDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function parseUserAgentLabel(ua: string): string {
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS/i.test(ua)) return "Mac";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Electron/i.test(ua)) return "Vyntex POS desktop";
  if (/Chrome/i.test(ua)) return "Chrome browser";
  if (/Firefox/i.test(ua)) return "Firefox browser";
  if (/Safari/i.test(ua)) return "Safari browser";
  return "Unknown device";
}
