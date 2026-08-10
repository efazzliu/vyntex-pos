import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  formatSettingsDateTime,
  parseUserAgentLabel,
  recordDashboardLoginVisit,
  recordPasswordChangedAt,
} from "../_lib/account-settings.ts";
import type { DashboardLoginHistoryEntry } from "../_lib/types.ts";
import { SettingsRow } from "./settings-row.tsx";
import { supabase } from "@/lib/supabase.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { KeyRound, Loader2, Shield } from "lucide-react";
import { supportMailtoWithSubject } from "@/lib/site-constants.ts";
import { useDashboardLocale } from "@/pages/dashboard/_components/dashboard-locale-context.tsx";

type PremiumCardProps = {
  children: React.ReactNode;
};

function SectionShell({ children }: PremiumCardProps) {
  const { t } = useDashboardLocale();
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.28)] dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-700/80">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/10 to-[#00AACC]/10 p-2.5 text-[#0066FF] dark:border-slate-600 dark:text-cyan-400">
          <Shield className="size-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t("settings.security.title")}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {t("settings.security.subtitle")}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function DashboardSecuritySection() {
  const { t } = useDashboardLocale();
  const navigate = useNavigate();
  const [loginHistory, setLoginHistory] = useState<DashboardLoginHistoryEntry[]>([]);
  const [sessionInfo, setSessionInfo] = useState<{
    expiresAt: string | null;
    provider: string;
    userAgent: string;
  } | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const refreshMfa = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return;
    const verified = Boolean(data?.totp?.some((f) => f.status === "verified"));
    setMfaEnabled(verified);
  };

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session) {
        setSessionInfo({
          expiresAt: session.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
          provider: (session.user.app_metadata?.provider as string) ?? "email",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "—",
        });
      }
      const history = await recordDashboardLoginVisit();
      setLoginHistory(history);
      await refreshMfa();
    })();
  }, []);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) return void toast.error(t("settings.security.error.password_length"));
    if (newPassword !== confirmPassword) return void toast.error(t("settings.security.error.password_mismatch"));
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return void toast.error(error.message);
      await recordPasswordChangedAt();
      toast.success(t("settings.security.password_updated"));
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
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (cErr) return void toast.error(cErr.message);
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      });
      if (error) return void toast.error(error.message);
      toast.success(t("settings.security.mfa_enabled"));
      setMfaOpen(false);
      setMfaCode("");
      await refreshMfa();
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    setMfaLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (!totp) return void toast.error(t("settings.security.error.no_mfa_factor"));
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totp.id });
      if (error) return void toast.error(error.message);
      toast.success(t("settings.security.mfa_disabled"));
      await refreshMfa();
    } finally {
      setMfaLoading(false);
    }
  };

  const handleGlobalLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) return void toast.error(error.message);
    navigate("/login", { replace: true });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") {
      return void toast.error(t("settings.security.error.type_delete"));
    }
    await supabase.auth.signOut({ scope: "global" });
    toast.message(t("settings.security.delete_request_title"), {
      description: t("settings.security.delete_request_desc"),
    });
    window.location.href = supportMailtoWithSubject("Vyntex POS — Delete my account");
  };

  return (
    <>
      <SectionShell>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <SettingsRow label={t("settings.security.change_password")} hint={t("settings.security.change_password_hint")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full rounded-xl sm:w-auto"
              onClick={() => setPasswordOpen(true)}
            >
              <KeyRound className="mr-1.5 size-3.5" />
              {t("settings.security.change_password")}
            </Button>
          </SettingsRow>

          <SettingsRow
            label={t("settings.security.mfa")}
            hint={mfaEnabled ? t("settings.security.mfa_active") : t("settings.security.mfa_inactive")}
          >
            {mfaEnabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={mfaLoading}
                className="h-9 w-full rounded-xl sm:w-auto"
                onClick={() => void disableMfa()}
              >
                {t("settings.security.disable_2fa")}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={mfaLoading}
                className="h-9 w-full rounded-xl bg-[#0066FF] sm:w-auto"
                onClick={() => void startMfaEnroll()}
              >
                {mfaLoading ? <Loader2 className="size-4 animate-spin" /> : t("settings.security.enable_2fa")}
              </Button>
            )}
          </SettingsRow>

          <SettingsRow label={t("settings.security.active_session")} hint={t("settings.security.active_session_hint")}>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-950">
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {sessionInfo ? parseUserAgentLabel(sessionInfo.userAgent) : "—"}
              </p>
              <p className="mt-1 text-slate-500">
                {sessionInfo?.provider ?? "email"}
                {sessionInfo?.expiresAt
                  ? ` · ${t("settings.security.session_until", {
                      date: formatSettingsDateTime(sessionInfo.expiresAt),
                    })}`
                  : ""}
              </p>
            </div>
          </SettingsRow>

          <SettingsRow label={t("settings.security.sign_out_all")} hint={t("settings.security.sign_out_all_hint")}>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-9 w-full rounded-xl sm:w-auto"
              onClick={() => void handleGlobalLogout()}
            >
              {t("settings.security.sign_out_everywhere")}
            </Button>
          </SettingsRow>

          <SettingsRow wide label={t("settings.security.login_history")} hint={t("settings.security.login_history_hint")}>
            <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/80">
              {loginHistory.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">{t("settings.security.no_signins")}</p>
              ) : (
                <ul className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {loginHistory.map((entry) => (
                    <li
                      key={entry.at}
                      className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                    >
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {formatSettingsDateTime(entry.at)}
                      </span>
                      <span className="text-xs text-slate-500 sm:text-right">
                        {parseUserAgentLabel(entry.userAgent)}
                        {entry.ip ? (
                          <span className="text-slate-400"> · {entry.ip}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SettingsRow>

          <SettingsRow
            label={t("settings.security.delete_account")}
            hint={t("settings.security.delete_account_hint")}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-9 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 sm:w-auto",
                "dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40",
              )}
              onClick={() => setDeleteOpen(true)}
            >
              {t("settings.security.delete_account")}
            </Button>
          </SettingsRow>
        </div>
      </SectionShell>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.security.dialog.change_password_title")}</DialogTitle>
            <DialogDescription>{t("settings.security.dialog.change_password_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-password">{t("settings.security.new_password")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">{t("settings.security.confirm_password")}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>
              {t("settings.security.cancel")}
            </Button>
            <Button type="button" disabled={passwordLoading} onClick={() => void handleChangePassword()}>
              {passwordLoading ? t("settings.security.saving") : t("settings.security.update_password")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mfaOpen} onOpenChange={setMfaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.security.mfa_dialog_title")}</DialogTitle>
            <DialogDescription>{t("settings.security.mfa_dialog_desc")}</DialogDescription>
          </DialogHeader>
          {mfaQr ? (
            <img src={mfaQr} alt={t("settings.security.mfa_qr_alt")} className="mx-auto h-40 w-40 rounded-lg border" />
          ) : null}
          {mfaSecret ? (
            <p className="text-center font-mono text-xs text-slate-500">
              {t("settings.security.mfa_secret", { secret: mfaSecret })}
            </p>
          ) : null}
          <div>
            <Label htmlFor="mfa-code">{t("settings.security.verification_code")}</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMfaOpen(false)}>
              {t("settings.security.cancel")}
            </Button>
            <Button type="button" disabled={mfaLoading} onClick={() => void verifyMfa()}>
              {t("settings.security.verify_enable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.security.delete_dialog_title")}</DialogTitle>
            <DialogDescription>{t("settings.security.delete_dialog_desc")}</DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={t("settings.security.delete_placeholder")}
            className="font-mono"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("settings.security.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteAccount()}>
              {t("settings.security.request_deletion")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
