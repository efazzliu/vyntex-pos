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

type PremiumCardProps = {
  children: React.ReactNode;
};

function SectionShell({ children }: PremiumCardProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(2,6,23,0.28)] dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-4 dark:border-slate-700/80">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#0066FF]/10 to-[#00AACC]/10 p-2.5 text-[#0066FF] dark:border-slate-600 dark:text-cyan-400">
          <Shield className="size-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Security settings</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Password, two-factor authentication, sessions, and account deletion.
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function DashboardSecuritySection() {
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
    if (newPassword.length < 8) return void toast.error("Password must be at least 8 characters");
    if (newPassword !== confirmPassword) return void toast.error("Passwords do not match");
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return void toast.error(error.message);
      await recordPasswordChangedAt();
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
      toast.success("Two-factor authentication enabled");
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
      if (!totp) return void toast.error("No active 2FA factor");
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totp.id });
      if (error) return void toast.error(error.message);
      toast.success("2FA disabled");
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
      return void toast.error('Type DELETE to confirm');
    }
    await supabase.auth.signOut({ scope: "global" });
    toast.message("Account deletion request", {
      description:
        "We signed you out. Email support to complete permanent deletion of your account and data.",
    });
    window.location.href = supportMailtoWithSubject("Vyntex POS — Delete my account");
  };

  return (
    <>
      <SectionShell>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <SettingsRow label="Change password" hint="Use at least 8 characters.">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full rounded-xl sm:w-auto"
              onClick={() => setPasswordOpen(true)}
            >
              <KeyRound className="mr-1.5 size-3.5" />
              Change password
            </Button>
          </SettingsRow>

          <SettingsRow
            label="Two-factor authentication (2FA)"
            hint={mfaEnabled ? "Authenticator app is active." : "Adds a code from your phone at sign-in."}
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
                Disable 2FA
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={mfaLoading}
                className="h-9 w-full rounded-xl bg-[#0066FF] sm:w-auto"
                onClick={() => void startMfaEnroll()}
              >
                {mfaLoading ? <Loader2 className="size-4 animate-spin" /> : "Enable 2FA"}
              </Button>
            )}
          </SettingsRow>

          <SettingsRow label="Active session (this device)" hint="Other devices can be signed out below.">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-950">
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {sessionInfo ? parseUserAgentLabel(sessionInfo.userAgent) : "—"}
              </p>
              <p className="mt-1 text-slate-500">
                {sessionInfo?.provider ?? "email"}
                {sessionInfo?.expiresAt
                  ? ` · session until ${formatSettingsDateTime(sessionInfo.expiresAt)}`
                  : ""}
              </p>
            </div>
          </SettingsRow>

          <SettingsRow label="Sign out all devices" hint="Ends every active login for this account.">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-9 w-full rounded-xl sm:w-auto"
              onClick={() => void handleGlobalLogout()}
            >
              Sign out everywhere
            </Button>
          </SettingsRow>

          <SettingsRow wide label="Login history" hint="Recent sign-ins recorded on this account.">
            <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/80">
              {loginHistory.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No sign-ins recorded yet.</p>
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
            label="Delete account"
            hint="Permanent removal of your account and linked venues requires support confirmation."
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
              Delete account
            </Button>
          </SettingsRow>
        </div>
      </SectionShell>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Choose a strong password you do not use elsewhere.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="new-password">New password</Label>
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
              <Label htmlFor="confirm-password">Confirm password</Label>
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
              Cancel
            </Button>
            <Button type="button" disabled={passwordLoading} onClick={() => void handleChangePassword()}>
              {passwordLoading ? "Saving…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mfaOpen} onOpenChange={setMfaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable two-factor authentication</DialogTitle>
            <DialogDescription>Scan the QR code with Google Authenticator or similar.</DialogDescription>
          </DialogHeader>
          {mfaQr ? (
            <img src={mfaQr} alt="2FA QR code" className="mx-auto h-40 w-40 rounded-lg border" />
          ) : null}
          {mfaSecret ? (
            <p className="text-center font-mono text-xs text-slate-500">Secret: {mfaSecret}</p>
          ) : null}
          <div>
            <Label htmlFor="mfa-code">Verification code</Label>
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
              Cancel
            </Button>
            <Button type="button" disabled={mfaLoading} onClick={() => void verifyMfa()}>
              Verify & enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              This signs you out and opens an email to support to complete permanent deletion. Type{" "}
              <strong>DELETE</strong> to continue.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            className="font-mono"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteAccount()}>
              Request deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
