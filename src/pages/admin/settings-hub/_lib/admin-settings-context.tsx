import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase.ts";
import type {
  AdminLang,
} from "./admin-i18n.ts";
import { adminT, applyAdminLanguage, normalizeAdminLang } from "./admin-i18n.ts";
import type {
  AdminLoginHistoryEntry,
  AdminNotificationPrefs,
  AdminUiPrefs,
  AdminUserMetadata,
} from "./admin-settings-types.ts";
import {
  accentHexForId,
  appendLoginHistory,
  applyAccentCss,
  mergeNotificationPrefs,
  mergeUiPrefs,
  writeLocalUiPrefs,
} from "./admin-settings-storage.ts";
import { uploadAdminAvatar, uploadAdminAvatarFromDataUrl } from "./admin-avatar-storage.ts";

type AdminSettingsContextValue = {
  loaded: boolean;
  userId: string | null;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  language: string;
  lang: AdminLang;
  timezone: string;
  t: (key: string) => string;
  notifications: AdminNotificationPrefs;
  loginHistory: AdminLoginHistoryEntry[];
  ui: AdminUiPrefs;
  mfaEnabled: boolean;
  setFullName: (v: string) => void;
  setPhone: (v: string) => void;
  setAvatarUrl: (v: string) => void;
  setLanguage: (v: string) => void;
  setTimezone: (v: string) => void;
  setNotifications: (patch: Partial<AdminNotificationPrefs>) => void;
  setUi: (patch: Partial<AdminUiPrefs>) => void;
  saveAccount: () => Promise<string | null>;
  saveNotifications: () => Promise<string | null>;
  saveUi: (patch?: Partial<AdminUiPrefs>) => Promise<string | null>;
  changeEmail: (newEmail: string) => Promise<string | null>;
  refreshMfa: () => Promise<void>;
  recordLogin: () => Promise<void>;
  saving: boolean;
};

const AdminSettingsContext = createContext<AdminSettingsContextValue | null>(null);

export function AdminSettingsProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Europe/Tirane");
  const [notifications, setNotificationsState] = useState<AdminNotificationPrefs>(
    mergeNotificationPrefs(),
  );
  const [loginHistory, setLoginHistory] = useState<AdminLoginHistoryEntry[]>([]);
  const [ui, setUiState] = useState<AdminUiPrefs>(mergeUiPrefs());
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const lang = normalizeAdminLang(language);

  const t = useCallback((key: string) => adminT(lang, key), [lang]);

  const refreshMfa = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return;
    const verified = [...(data.totp ?? []), ...(data.phone ?? [])].some((f) => f.status === "verified");
    setMfaEnabled(verified);
  }, []);

  const hydrateFromUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (!u) {
      setLoaded(true);
      return;
    }
    const meta = (u.user_metadata ?? {}) as AdminUserMetadata;
    const nextLang = normalizeAdminLang(meta.language ?? "en");
    setUserId(u.id);
    setFullName((meta.full_name ?? "").trim());
    setEmail(u.email ?? "");
    setPhone((meta.phone ?? "").trim());
    setAvatarUrl((meta.avatar_url ?? "").trim());
    setLanguage(nextLang);
    setTimezone(meta.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
    setNotificationsState(mergeNotificationPrefs(meta.admin_notifications));
    setLoginHistory(meta.admin_login_history ?? []);
    const mergedUi = mergeUiPrefs(meta.admin_ui);
    setUiState(mergedUi);
    writeLocalUiPrefs(mergedUi);
    applyAccentCss(accentHexForId(mergedUi.accentColor));
    applyAdminLanguage(nextLang);
    await refreshMfa();
    setLoaded(true);
  }, [refreshMfa]);

  useEffect(() => {
    void hydrateFromUser();
  }, [hydrateFromUser]);

  useEffect(() => {
    applyAdminLanguage(lang);
  }, [lang]);

  useEffect(() => {
    applyAccentCss(accentHexForId(ui.accentColor));
    writeLocalUiPrefs(ui);
    document.documentElement.toggleAttribute("data-admin-compact", ui.compactMode);
  }, [ui]);

  const setNotifications = useCallback((patch: Partial<AdminNotificationPrefs>) => {
    setNotificationsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setUi = useCallback((patch: Partial<AdminUiPrefs>) => {
    setUiState((prev) => ({ ...prev, ...patch }));
  }, []);

  const buildMetadataPatch = useCallback(
    (extra: Partial<AdminUserMetadata> = {}): AdminUserMetadata => ({
      full_name: fullName.trim(),
      phone: phone.trim(),
      avatar_url: avatarUrl.trim() || undefined,
      language: lang,
      timezone,
      admin_notifications: notifications,
      admin_login_history: loginHistory,
      admin_ui: ui,
      ...extra,
    }),
    [avatarUrl, fullName, lang, loginHistory, notifications, phone, timezone, ui],
  );

  const persistMetadata = useCallback(
    async (extra: Partial<AdminUserMetadata> = {}): Promise<string | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const existing = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
      const patch = buildMetadataPatch(extra);
      const { error } = await supabase.auth.updateUser({
        data: { ...existing, ...patch },
      });
      return error?.message ?? null;
    },
    [buildMetadataPatch],
  );

  const resolveAvatarForSave = useCallback(async (): Promise<string> => {
    if (!userId) return avatarUrl.trim();
    const raw = avatarUrl.trim();
    if (!raw) return "";
    if (raw.startsWith("data:")) {
      return uploadAdminAvatarFromDataUrl(userId, raw);
    }
    if (raw.startsWith("http")) return raw;
    return raw;
  }, [avatarUrl, userId]);

  const saveAccount = useCallback(async () => {
    if (!fullName.trim()) return "Full name is required";
    setSaving(true);
    try {
      let nextAvatar = avatarUrl.trim();
      try {
        nextAvatar = await resolveAvatarForSave();
        if (nextAvatar !== avatarUrl) setAvatarUrl(nextAvatar);
      } catch (e) {
        return e instanceof Error ? e.message : "Avatar upload failed";
      }
      const err = await persistMetadata({ avatar_url: nextAvatar || undefined, language: lang });
      if (!err) applyAdminLanguage(lang);
      return err;
    } finally {
      setSaving(false);
    }
  }, [avatarUrl, fullName, lang, persistMetadata, resolveAvatarForSave]);

  const saveNotifications = useCallback(async () => {
    setSaving(true);
    try {
      return await persistMetadata({});
    } finally {
      setSaving(false);
    }
  }, [persistMetadata]);

  const saveUi = useCallback(
    async (patch?: Partial<AdminUiPrefs>) => {
      const nextUi = patch ? { ...ui, ...patch } : ui;
      if (patch) setUiState(nextUi);
      setSaving(true);
      try {
        return await persistMetadata({ admin_ui: nextUi });
      } finally {
        setSaving(false);
      }
    },
    [persistMetadata, ui],
  );

  const changeEmail = useCallback(async (newEmail: string) => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Enter a valid email address";
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) return error.message;
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const recordLogin = useCallback(async () => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
    let ip: string | undefined;
    try {
      const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
      const data = (await res.json()) as { ip?: string };
      if (data.ip) ip = data.ip;
    } catch {
      /* optional */
    }
    let nextHistory: AdminLoginHistoryEntry[] = [];
    setLoginHistory((prev) => {
      nextHistory = appendLoginHistory(prev, ua, ip);
      return nextHistory;
    });
    try {
      const { data: userData } = await supabase.auth.getUser();
      const existing = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
      await supabase.auth.updateUser({
        data: { ...existing, admin_login_history: nextHistory },
      });
    } catch {
      /* non-blocking */
    }
  }, []);

  const value = useMemo(
    () => ({
      loaded,
      userId,
      fullName,
      email,
      phone,
      avatarUrl,
      language,
      lang,
      timezone,
      t,
      notifications,
      loginHistory,
      ui,
      mfaEnabled,
      setFullName,
      setPhone,
      setAvatarUrl,
      setLanguage,
      setTimezone,
      setNotifications,
      setUi,
      saveAccount,
      saveNotifications,
      saveUi,
      changeEmail,
      refreshMfa,
      recordLogin,
      saving,
    }),
    [
      loaded,
      userId,
      fullName,
      email,
      phone,
      avatarUrl,
      language,
      lang,
      timezone,
      t,
      notifications,
      loginHistory,
      ui,
      mfaEnabled,
      setNotifications,
      setUi,
      saveAccount,
      saveNotifications,
      saveUi,
      changeEmail,
      refreshMfa,
      recordLogin,
      saving,
    ],
  );

  return <AdminSettingsContext.Provider value={value}>{children}</AdminSettingsContext.Provider>;
}

export function useAdminSettings() {
  const ctx = useContext(AdminSettingsContext);
  if (!ctx) throw new Error("useAdminSettings must be used within AdminSettingsProvider");
  return ctx;
}
