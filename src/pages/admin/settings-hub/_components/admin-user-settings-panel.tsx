import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Bell,
  ImagePlus,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sun,
  User,
  Volume2,
} from "lucide-react";
import { supabase } from "@/lib/supabase.ts";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { toast } from "sonner";
import { applyAdminLanguage, normalizeAdminLang } from "../_lib/admin-i18n.ts";
import { useAdminSettings } from "../_lib/admin-settings-context.tsx";
import { uploadAdminAvatar } from "../_lib/admin-avatar-storage.ts";
import { formatAdminDateTime } from "../_lib/admin-format.ts";
import {
  listAdminAuthSessions,
  revokeAdminAuthSession,
  type AdminAuthSession,
} from "../_lib/admin-settings-api.ts";
import {
  ADMIN_ACCENT_OPTIONS,
  ADMIN_LANGUAGES,
  adminLanguageValue,
  adminTimezoneOptions,
  adminTimezoneValue,
} from "../_lib/admin-settings-types.ts";
import { AdminCard } from "@/pages/admin/_components/admin-card.tsx";
import { adminBadgeClass, adminInputClass } from "@/pages/admin/_lib/admin-ui.ts";
import { SettingsRow } from "./settings-section-card.tsx";

function initials(name: string, email: string) {
  const n = name.trim();
  if (n) return n.slice(0, 2).toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

const TAB_IDS = ["account", "security", "appearance", "notifications"] as const;
type SettingsTab = (typeof TAB_IDS)[number];

function isSettingsTab(v: string | null): v is SettingsTab {
  return TAB_IDS.includes(v as SettingsTab);
}

const TAB_ICONS = { account: User, security: Shield, appearance: Palette, notifications: Bell } as const;

export function AdminUserSettingsPanel() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const s = useAdminSettings();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const [sessionInfo, setSessionInfo] = useState<{ expiresAt: string | null; provider: string } | null>(
    null,
  );
  const [authSessions, setAuthSessions] = useState<AdminAuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const tabParam = searchParams.get("tab");
  const hashTab = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
  const activeTab: SettingsTab = isSettingsTab(tabParam)
    ? tabParam
    : isSettingsTab(hashTab)
      ? hashTab
      : "account";

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab }, { replace: true });
    if (typeof window !== "undefined") window.location.hash = tab;
  };

  const languageValue = adminLanguageValue(s.language);
  const timezoneValue = adminTimezoneValue(s.timezone);
  const timezoneOptions = useMemo(() => adminTimezoneOptions(s.timezone), [s.timezone]);

  useEffect(() => {
    if (!s.loaded) return;
    void s.recordLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per settings visit
  }, [s.loaded]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        setSessionInfo(null);
        return;
      }
      setSessionInfo({
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        provider: (session.user.app_metadata?.provider as string) ?? "email",
      });
    })();
  }, []);

  const handleAvatarFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Choose an image file");
    if (file.size > 400_000) return void toast.error("Image must be under 400 KB");
    void (async () => {
      try {
        if (s.userId) {
          const url = await uploadAdminAvatar(s.userId, file);
          s.setAvatarUrl(url);
          toast.success("Photo uploaded — save account to confirm metadata");
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              s.setAvatarUrl(reader.result);
              toast.success("Photo ready — save account to apply");
            }
          };
          reader.readAsDataURL(file);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    })();
  };

  const loadAuthSessions = async () => {
    setSessionsLoading(true);
    try {
      const sessions = await listAdminAuthSessions();
      setAuthSessions(sessions);
    } catch (e) {
      setAuthSessions([]);
      toast.error(e instanceof Error ? e.message : "Could not load sessions");
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "security" && s.loaded) void loadAuthSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, s.loaded]);

  const handleChangeEmail = async () => {
    const err = await s.changeEmail(newEmail);
    if (err) return void toast.error(err);
    toast.success("Check your inbox to confirm the new email address.");
    setEmailOpen(false);
    setNewEmail("");
  };

  const fmt = (value: Date | string) => formatAdminDateTime(value, s.timezone, s.lang);

  const handleSaveAccount = async () => {
    const err = await s.saveAccount();
    if (err) toast.error(err);
    else toast.success("Account saved");
  };

  const handleSaveNotifications = async () => {
    const err = await s.saveNotifications();
    if (err) toast.error(err);
    else toast.success("Notification preferences saved");
  };

  const handleUiChange = async (patch: Parameters<typeof s.setUi>[0]) => {
    s.setUi(patch);
    const err = await s.saveUi(patch);
    if (err) toast.error(err);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) return void toast.error("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return void toast.error("Passwords do not match");
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return void toast.error(error.message);
      toast.success("Password updated");
      setPasswordOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setPasswordLoading(false);
    }
  };

  const startMfaEnroll = async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) return void toast.error(error.message);
      setMfaFactorId(data.id);
      const qr = data.totp.qr_code;
      setMfaQr(
        qr.startsWith("data:") || qr.startsWith("http")
          ? qr
          : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`,
      );
      setMfaSecret(data.totp.secret);
      setMfaOpen(true);
    } finally {
      setMfaLoading(false);
    }
  };

  const verifyMfa = async () => {
    if (!mfaFactorId || !mfaCode.trim()) return;
    setMfaLoading(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (cErr) return void toast.error(cErr.message);
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      });
      if (error) return void toast.error(error.message);
      toast.success("Two-factor authentication enabled");
      setMfaOpen(false);
      setMfaCode("");
      await s.refreshMfa();
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    setMfaLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (!totp) return void toast.error("No active 2FA factor");
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totp.id });
      if (error) return void toast.error(error.message);
      toast.success("2FA disabled");
      await s.refreshMfa();
    } finally {
      setMfaLoading(false);
    }
  };

  const handleGlobalLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) return void toast.error(error.message);
    navigate("/login", { replace: true });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const handlePushToggle = async (checked: boolean) => {
    s.setNotifications({ push: checked });
    if (checked && typeof Notification !== "undefined" && Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        s.setNotifications({ push: false });
        toast.message("Browser blocked push notifications");
      }
    }
  };

  const testSound = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      toast.message("Could not play test sound");
    }
  };

  if (!s.loaded) {
    return (
      <AdminCard className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-[#0066FF]" />
      </AdminCard>
    );
  }

  const languageLabel = ADMIN_LANGUAGES.find((l) => l.value === languageValue)?.label ?? "English";
  const themeLabel =
    theme === "dark" ? (s.lang === "sq" ? "Errët" : "Dark") : theme === "light" ? (s.lang === "sq" ? "E çelët" : "Light") : s.lang === "sq" ? "Sistemi" : "System";

  return (
    <>
      <AdminCard className="overflow-visible">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0066FF]">{s.t("workspace")}</p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{s.t("settings.title")}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{s.t("settings.subtitle")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleSignOut()}
            className="h-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
          >
            <LogOut className="mr-1.5 size-3.5" />
            {s.t("settings.signOut")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          <Avatar className="size-11 ring-2 ring-[#0066FF]/20">
            <AvatarImage src={s.avatarUrl || undefined} alt="" />
            <AvatarFallback className="bg-[#0066FF]/10 text-sm font-semibold text-[#0066FF]">
              {initials(s.fullName, s.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {s.fullName.trim() || "Admin user"}
            </p>
            <p className="truncate text-xs text-slate-500">{s.email}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={adminBadgeClass}>{s.t("badge.platformAdmin")}</span>
            <span className={cn(adminBadgeClass, s.mfaEnabled && "text-emerald-700 dark:text-emerald-300")}>
              {s.mfaEnabled ? s.t("badge.2faOn") : s.t("badge.2faOff")}
            </span>
            <span className={adminBadgeClass}>{languageLabel}</span>
            <span className={adminBadgeClass}>{themeLabel}</span>
          </div>
        </div>

        <div className="flex gap-0 overflow-x-auto border-b border-slate-200 px-3 dark:border-slate-800">
          {TAB_IDS.map((id) => {
            const Icon = TAB_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
                  activeTab === id
                    ? "border-[#0066FF] text-[#0066FF]"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                )}
              >
                <Icon className="size-3.5" />
                {s.t(`tab.${id}`)}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === "account" && (
            <div className="space-y-5">
              <div className="flex flex-col gap-5 md:flex-row md:items-start">
                <div className="flex shrink-0 flex-col items-center gap-2 md:w-[140px]">
                  <Avatar className="size-20 border border-slate-200 dark:border-slate-700">
                    <AvatarImage src={s.avatarUrl || undefined} alt="" />
                    <AvatarFallback className="text-lg font-semibold">{initials(s.fullName, s.email)}</AvatarFallback>
                  </Avatar>
                  <Label className="cursor-pointer">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                      <ImagePlus className="size-3" />
                      Upload
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => handleAvatarFile(e.target.files?.[0] ?? null)}
                    />
                  </Label>
                  <p className="text-center text-[10px] text-slate-400">Max 400 KB</p>
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="admin-full-name" className="text-xs">
                        Full name
                      </Label>
                      <Input
                        id="admin-full-name"
                        value={s.fullName}
                        onChange={(e) => s.setFullName(e.target.value)}
                        className={cn(adminInputClass, "mt-1 h-9 w-full")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="admin-email" className="text-xs">
                        {s.t("account.email")}
                      </Label>
                      <div className="mt-1 flex gap-2">
                        <Input
                          id="admin-email"
                          value={s.email}
                          readOnly
                          className={cn(adminInputClass, "h-9 flex-1 bg-slate-100 dark:bg-slate-900")}
                        />
                        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setEmailOpen(true)}>
                          {s.t("account.changeEmail")}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="admin-phone" className="text-xs">
                        Phone
                      </Label>
                      <Input
                        id="admin-phone"
                        value={s.phone}
                        onChange={(e) => s.setPhone(e.target.value)}
                        placeholder="+355 …"
                        className={cn(adminInputClass, "mt-1 h-9 w-full")}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Language</Label>
                      <Select
                        value={languageValue}
                        onValueChange={(v) => {
                          s.setLanguage(v);
                          applyAdminLanguage(normalizeAdminLang(v));
                        }}
                      >
                        <SelectTrigger className={cn(adminInputClass, "mt-1 h-9 w-full")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ADMIN_LANGUAGES.map((l) => (
                            <SelectItem key={l.value} value={l.value}>
                              {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Timezone</Label>
                      <Select value={timezoneValue} onValueChange={s.setTimezone}>
                        <SelectTrigger className={cn(adminInputClass, "mt-1 h-9 w-full")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timezoneOptions.map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{s.t("account.emailHint")}</p>
                </div>
              </div>
              <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
                <Button
                  type="button"
                  disabled={s.saving}
                  onClick={() => void handleSaveAccount()}
                  className="h-9 rounded-lg bg-[#0066FF] px-4 text-sm text-white hover:bg-[#0052cc]"
                >
                  {s.saving ? "Saving…" : "Save account"}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <SettingsRow label="Password" hint="Update your login password.">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-lg sm:w-auto"
                  onClick={() => setPasswordOpen(true)}
                >
                  <KeyRound className="mr-1.5 size-3.5" />
                  Change password
                </Button>
              </SettingsRow>
              <SettingsRow
                label="Two-factor authentication"
                hint={s.mfaEnabled ? "Authenticator app is active." : "Recommended for admin accounts."}
              >
                {s.mfaEnabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={mfaLoading}
                    className="h-8 w-full rounded-lg sm:w-auto"
                    onClick={() => void disableMfa()}
                  >
                    Disable 2FA
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={mfaLoading}
                    className="h-8 w-full rounded-lg bg-[#0066FF] sm:w-auto"
                    onClick={() => void startMfaEnroll()}
                  >
                    Enable 2FA
                  </Button>
                )}
              </SettingsRow>
              <SettingsRow label={s.t("security.sessions")} hint={s.t("security.sessionsHint")}>
                <div className="w-full space-y-2 text-xs">
                  {sessionsLoading ? (
                    <Loader2 className="size-4 animate-spin text-[#0066FF]" />
                  ) : authSessions.length === 0 ? (
                    <p className="text-slate-500">
                      {sessionInfo?.provider ?? "—"} · {s.t("security.currentSession")}
                      {sessionInfo?.expiresAt ? ` · ${fmt(sessionInfo.expiresAt)}` : ""}
                    </p>
                  ) : (
                    authSessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                            {(sess.user_agent ?? "Unknown device").slice(0, 80)}
                          </p>
                          <p className="text-slate-500">
                            {fmt(sess.updated_at || sess.created_at)}
                            {sess.ip ? ` · ${sess.ip}` : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 text-xs"
                          onClick={() =>
                            void revokeAdminAuthSession(sess.id)
                              .then(() => {
                                toast.success("Session revoked");
                                void loadAuthSessions();
                              })
                              .catch((e) => toast.error(e instanceof Error ? e.message : "Revoke failed"))
                          }
                        >
                          {s.t("security.revoke")}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </SettingsRow>
              <SettingsRow label={s.t("security.loginHistory")} hint={s.t("security.loginHistoryHint")}>
                <div className="max-h-32 w-full overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-left text-[11px] dark:border-slate-700 dark:bg-slate-950">
                  {s.loginHistory.length === 0 ? (
                    <p className="text-slate-500">No history yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {s.loginHistory.slice(0, 8).map((entry) => (
                        <li key={entry.at} className="border-b border-slate-200/80 pb-1.5 last:border-0 dark:border-slate-800">
                          <p className="font-medium text-slate-700 dark:text-slate-200">{fmt(entry.at)}</p>
                          <p className="truncate text-slate-500">
                            {entry.ip ? `${entry.ip} · ` : ""}
                            {entry.userAgent}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </SettingsRow>
              <SettingsRow label="All devices" hint="Sign out everywhere.">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-8 w-full rounded-lg sm:w-auto"
                  onClick={() => void handleGlobalLogout()}
                >
                  Sign out everywhere
                </Button>
              </SettingsRow>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <SettingsRow label="Theme" hint="Light, dark, or system.">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: "light" as const, label: "Light", Icon: Sun },
                      { id: "dark" as const, label: "Dark", Icon: Moon },
                      { id: "system" as const, label: "System", Icon: Monitor },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <Button
                      key={id}
                      type="button"
                      variant={(theme ?? "system") === id ? "default" : "outline"}
                      size="sm"
                      className={cn("h-8 rounded-lg text-xs", (theme ?? "system") === id && "bg-[#0066FF]")}
                      onClick={() => setTheme(id)}
                    >
                      <Icon className="mr-1 size-3" />
                      {label}
                    </Button>
                  ))}
                </div>
              </SettingsRow>
              <SettingsRow label="Accent color" hint="Buttons and highlights.">
                <div className="flex flex-wrap gap-2">
                  {ADMIN_ACCENT_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => void handleUiChange({ accentColor: c.id })}
                      className={cn(
                        "size-7 rounded-full border-2",
                        s.ui.accentColor === c.id ? "border-slate-900 dark:border-white" : "border-transparent",
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </SettingsRow>
              <SettingsRow label="Collapsed sidebar" hint="Start with narrow nav.">
                <Switch
                  checked={s.ui.sidebarCollapsed}
                  onCheckedChange={(checked) => void handleUiChange({ sidebarCollapsed: checked })}
                />
              </SettingsRow>
              <SettingsRow label="Compact mode" hint="Tighter page spacing.">
                <Switch
                  checked={s.ui.compactMode}
                  onCheckedChange={(checked) => void handleUiChange({ compactMode: checked })}
                />
              </SettingsRow>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-4">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <SettingsRow label="Email">
                  <Switch
                    checked={s.notifications.email}
                    onCheckedChange={(checked) => s.setNotifications({ email: checked })}
                  />
                </SettingsRow>
                <SettingsRow label="Push" hint="Browser permission required.">
                  <Switch checked={s.notifications.push} onCheckedChange={(checked) => void handlePushToggle(checked)} />
                </SettingsRow>
                <SettingsRow label="Sound">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={s.notifications.sound}
                      onCheckedChange={(checked) => {
                        s.setNotifications({ sound: checked });
                        if (checked) testSound();
                      }}
                    />
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={testSound}>
                      <Volume2 className="size-3.5" />
                    </Button>
                  </div>
                </SettingsRow>
                <SettingsRow label="Billing alerts">
                  <Switch
                    checked={s.notifications.billingAlerts}
                    onCheckedChange={(checked) => s.setNotifications({ billingAlerts: checked })}
                  />
                </SettingsRow>
                <SettingsRow label="License expiry">
                  <Switch
                    checked={s.notifications.licenseExpiryAlerts}
                    onCheckedChange={(checked) => s.setNotifications({ licenseExpiryAlerts: checked })}
                  />
                </SettingsRow>
              </div>
              <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
                <Button
                  type="button"
                  disabled={s.saving}
                  onClick={() => void handleSaveNotifications()}
                  className="h-9 rounded-lg bg-[#0066FF] px-4 text-sm text-white hover:bg-[#0052cc]"
                >
                  {s.saving ? "Saving…" : "Save notifications"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </AdminCard>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{s.t("account.changeEmail")}</DialogTitle>
            <DialogDescription>{s.t("account.emailHint")}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="new-admin-email">Email</Label>
            <Input
              id="new-admin-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={s.saving} onClick={() => void handleChangeEmail()}>
              {s.saving ? s.t("account.saving") : s.t("account.changeEmail")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Enter a new password (min. 8 characters).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="new-pass">New password</Label>
              <Input
                id="new-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="confirm-pass">Confirm password</Label>
              <Input
                id="confirm-pass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={passwordLoading} onClick={() => void handleChangePassword()}>
              {passwordLoading ? "Updating…" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mfaOpen} onOpenChange={setMfaOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up authenticator</DialogTitle>
            <DialogDescription>
              Scan the QR code with Google Authenticator, then enter the 6-digit code.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {mfaQr ? (
              <img src={mfaQr} alt="2FA QR code" className="size-44 rounded-lg border border-slate-200 bg-white p-2" />
            ) : null}
            {mfaSecret ? (
              <p className="break-all text-center font-mono text-xs text-slate-500">Secret: {mfaSecret}</p>
            ) : null}
            <Input
              placeholder="000000"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="max-w-[160px] text-center text-lg tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMfaOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={mfaLoading || mfaCode.length < 6} onClick={() => void verifyMfa()}>
              {mfaLoading ? "Verifying…" : "Verify & enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
