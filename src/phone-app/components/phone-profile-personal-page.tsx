import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { supabase } from "@/lib/supabase.ts";
import { SUPPORT_EMAIL, SUPPORT_MAILTO_HREF } from "@/lib/site-constants.ts";
import { cn } from "@/lib/utils.ts";

export default function PhoneProfilePersonalPage() {
  const { t } = useTranslation("site");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isPhoneManager, setIsPhoneManager] = useState(false);
  const [canSetCredentials, setCanSetCredentials] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEditEmail = isPhoneManager && canSetCredentials;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = data.user;
      if (u) {
        const meta = u.user_metadata as { full_name?: string };
        setFullName((meta?.full_name ?? "").trim());
        const existingEmail = (u.email ?? "").trim();
        setEmail(existingEmail);
        setIsPhoneManager(
          (u.user_metadata as { vyntex_phone_manager?: boolean } | undefined)
            ?.vyntex_phone_manager === true,
        );
        setCanSetCredentials(!existingEmail);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error(t("phone.profile.personalNameRequired"));
      return;
    }
    if (canEditEmail && !EMAIL_RE.test(email.trim())) {
      toast.error(t("phone.redeem.emailInvalid"));
      return;
    }
    if (canEditEmail && password.length < 6) {
      toast.error(t("phone.redeem.passwordMin"));
      return;
    }
    if (canEditEmail && password !== confirmPassword) {
      toast.error(t("phone.redeem.passwordMismatch"));
      return;
    }
    setSaving(true);
    try {
      const payload: {
        data: { full_name: string };
        email?: string;
        password?: string;
      } = {
        data: { full_name: fullName.trim() },
      };
      if (canEditEmail) {
        payload.email = email.trim().toLowerCase();
        payload.password = password;
      }
      const { error } = await supabase.auth.updateUser(payload);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("phone.profile.personalSaved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-transparent">
      <header
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3",
          "pt-[max(0.5rem,env(safe-area-inset-top))]",
        )}
      >
        <Link
          to="/app/profile"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-[#0066FF]/10"
          aria-label={t("phone.profile.backToProfile")}
        >
          <ChevronLeft className="size-6" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">{t("phone.profile.personalInfo")}</h1>
          <p className="text-xs text-slate-500">{t("phone.profile.personalSubtitle")}</p>
        </div>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="phone-personal-name">{t("phone.profile.labelFullName")}</Label>
          <Input
            id="phone-personal-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            disabled={loading}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone-personal-email">{t("phone.profile.labelEmail")}</Label>
          <Input
            id="phone-personal-email"
            type={canEditEmail ? "text" : "email"}
            inputMode="email"
            value={email}
            readOnly={!canEditEmail}
            onChange={(e) => setEmail(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 rounded-xl bg-slate-50 text-slate-600 read-only:cursor-not-allowed"
          />
          {canEditEmail ? (
            <p className="text-xs leading-relaxed text-slate-500">
              {t("phone.profile.managerCredentialsHint")}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-slate-500">
              {t("phone.profile.emailReadonlyHint")}{" "}
              <a href={SUPPORT_MAILTO_HREF} className="font-medium text-[#0066FF] underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          )}
        </div>
        {canEditEmail ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="phone-personal-password">{t("phone.redeem.managerPasswordLabel")}</Label>
              <Input
                id="phone-personal-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("phone.redeem.managerPasswordPlaceholder")}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-personal-password-confirm">
                {t("phone.redeem.managerPasswordConfirmLabel")}
              </Label>
              <Input
                id="phone-personal-password-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("phone.redeem.managerPasswordConfirmPlaceholder")}
                className="h-11 rounded-xl"
              />
            </div>
          </>
        ) : null}
        <Button
          type="submit"
          className="mt-2 h-11 w-full rounded-xl bg-[#0066FF] hover:bg-[#0055DD]"
          disabled={
            loading ||
            saving ||
            (canEditEmail &&
              (!EMAIL_RE.test(email.trim()) ||
                password.length < 6 ||
                confirmPassword.length < 6 ||
                password !== confirmPassword))
          }
        >
          {saving ? t("phone.profile.saving") : t("phone.profile.saveProfile")}
        </Button>
      </form>
    </div>
  );
}
