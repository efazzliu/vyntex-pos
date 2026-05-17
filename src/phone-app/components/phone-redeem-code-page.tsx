import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import { setDashboardRestaurantId } from "@/hooks/use-dashboard-restaurant.ts";
import { isMissingPgColumnError } from "@/lib/supabase-pos/db-errors.ts";
import {
  normalizePhoneInviteCode,
  redeemPhoneManagerInvite,
} from "@/lib/supabase-pos/phone-manager-invite-ops.ts";
import { cn } from "@/lib/utils.ts";

type EnsureSessionResult = { ok: true } | { ok: false; message: string };

async function ensureSessionForManagerCredentials(
  emailRaw: string,
  password: string,
): Promise<EnsureSessionResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: "no_supabase" };
  }

  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "invalid_email" };
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error && signIn.data.session?.user) {
    return { ok: true };
  }

  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: {
      shouldCreateUser: true,
    },
  });
  if (signUp.error) {
    return { ok: false, message: signUp.error.message };
  }

  if (signUp.data.session?.user) {
    return { ok: true };
  }

  const retrySignIn = await supabase.auth.signInWithPassword({ email, password });
  if (retrySignIn.error || !retrySignIn.data.session?.user) {
    return { ok: false, message: "session_not_ready" };
  }
  return { ok: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PhoneRedeemCodePage() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [managerPasswordConfirm, setManagerPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const errMsg = (key: string) => {
    const map: Record<string, string> = {
      not_found: t("phone.redeem.errNotFound"),
      already_used: t("phone.redeem.errUsed"),
      expired: t("phone.redeem.errExpired"),
      venue_missing: t("phone.redeem.errVenueMissing"),
      owner_no_redeem: t("phone.redeem.errOwner"),
      not_authenticated: t("phone.redeem.errNotAuthenticated"),
      invalid_code: t("phone.redeem.errInvalid"),
      rpc_error: t("phone.redeem.errGeneric"),
      unknown: t("phone.redeem.errGeneric"),
      invalid_response: t("phone.redeem.errGeneric"),
    };
    return map[key] ?? t("phone.redeem.errGeneric");
  };

  const normalized = normalizePhoneInviteCode(code);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = managerName.trim();
    const email = managerEmail.trim().toLowerCase();
    const password = managerPassword;
    const confirmPassword = managerPasswordConfirm;
    if (!fullName) {
      toast.error(t("phone.profile.personalNameRequired"));
      return;
    }
    if (!EMAIL_RE.test(email)) {
      toast.error(t("phone.redeem.emailInvalid"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("phone.redeem.passwordMin"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("phone.redeem.passwordMismatch"));
      return;
    }
    if (normalized.length !== 8) {
      toast.error(t("phone.redeem.errInvalidEight"));
      return;
    }
    setBusy(true);
    try {
      const ens = await ensureSessionForManagerCredentials(email, password);
      if (!ens.ok) {
        if (ens.message === "no_supabase") {
          toast.error(t("phone.team.supabaseNotConfigured"));
          return;
        }
        if (ens.message === "invalid_email") {
          toast.error(t("phone.redeem.emailInvalid"));
          return;
        }
        if (ens.message === "session_not_ready") {
          toast.error(t("phone.redeem.errSessionReady"));
          return;
        }
        toast.error(ens.message);
        return;
      }

      const result = await redeemPhoneManagerInvite(normalized);
      if (!result.ok) {
        if (result.error === "rpc_error" && result.detail) {
          const hint =
            /does not exist|schema cache|Could not find|function public\./i.test(
              result.detail,
            )
              ? t("phone.redeem.errMigration")
              : "";
          toast.error(
            hint
              ? `${hint} (${result.detail})`
              : `${errMsg(result.error)} — ${result.detail}`,
          );
          if (import.meta.env.DEV) {
            console.warn("[redeemPhoneManagerInvite]", result.detail);
          }
        } else {
          toast.error(errMsg(result.error));
        }
        return;
      }
      const { data: mobileRow, error: mobileErr } = await supabase
        .from("restaurants")
        .select("mobile_access_enabled")
        .eq("id", result.restaurantId)
        .maybeSingle();
      if (mobileErr && !isMissingPgColumnError(mobileErr.message, "mobile_access_enabled")) {
        toast.error(mobileErr.message);
        return;
      }
      const mobileEnabled =
        !mobileErr || isMissingPgColumnError(mobileErr.message, "mobile_access_enabled")
          ? (mobileRow as { mobile_access_enabled?: boolean } | null)?.mobile_access_enabled !==
            false
          : true;
      if (!mobileEnabled) {
        toast.error(t("phone.mobileAccessDisabled"));
        await supabase.auth.signOut();
        return;
      }
      setDashboardRestaurantId(result.restaurantId);
      const { error: upErr } = await supabase.auth.updateUser({
        email,
        password,
        data: {
          full_name: fullName,
        },
      });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      toast.success(
        t("phone.redeem.success", { name: result.restaurantName }),
      );
      navigate("/app/venue", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-transparent">
      <header
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3",
          "pt-[max(0.5rem,env(safe-area-inset-top))]",
        )}
      >
        <Link
          to="/login"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-[#0066FF]/10"
          aria-label={t("phone.redeem.backLogin")}
        >
          <ChevronLeft className="size-6" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900">{t("phone.redeem.title")}</h1>
          <p className="text-xs text-slate-500">{t("phone.redeem.subtitle")}</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-6">
        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="manager-name">{t("phone.redeem.nameLabel")}</Label>
            <Input
              id="manager-name"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder={t("phone.redeem.namePlaceholder")}
              autoComplete="name"
              autoCapitalize="words"
              className="h-12 rounded-xl border-slate-200 bg-white text-base text-slate-900 placeholder:text-slate-400"
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager-email">{t("phone.redeem.managerEmailLabel")}</Label>
            <Input
              id="manager-email"
              type="text"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              placeholder={t("phone.redeem.managerEmailPlaceholder")}
              className="h-12 rounded-xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager-password">{t("phone.redeem.managerPasswordLabel")}</Label>
            <Input
              id="manager-password"
              type="password"
              autoComplete="new-password"
              value={managerPassword}
              onChange={(e) => setManagerPassword(e.target.value)}
              placeholder={t("phone.redeem.managerPasswordPlaceholder")}
              className="h-12 rounded-xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager-password-confirm">{t("phone.redeem.managerPasswordConfirmLabel")}</Label>
            <Input
              id="manager-password-confirm"
              type="password"
              autoComplete="new-password"
              value={managerPasswordConfirm}
              onChange={(e) => setManagerPasswordConfirm(e.target.value)}
              placeholder={t("phone.redeem.managerPasswordConfirmPlaceholder")}
              className="h-12 rounded-xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-code">{t("phone.redeem.inputLabel")}</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(normalizePhoneInviteCode(e.target.value))}
              placeholder={t("phone.redeem.placeholder")}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              className="h-12 rounded-xl border-slate-200 bg-white font-mono text-lg tracking-[0.2em] text-slate-900 placeholder:text-slate-400"
              maxLength={8}
              aria-invalid={normalized.length > 0 && normalized.length < 8}
            />
          </div>
          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-[#0066FF] hover:bg-[#0055DD]"
            disabled={
              busy ||
              !managerName.trim() ||
              !EMAIL_RE.test(managerEmail.trim()) ||
              managerPassword.length < 6 ||
              managerPasswordConfirm.length < 6 ||
              managerPassword !== managerPasswordConfirm ||
              normalized.length !== 8
            }
          >
            {busy ? t("phone.profile.saving") : t("phone.redeem.submit")}
          </Button>
          <p className="text-center text-xs leading-relaxed text-slate-500">
            {t("phone.redeem.hint")}
          </p>
        </form>
        <p className="text-center text-sm">
          <Link to="/login" className="font-medium text-[#0066FF] hover:underline">
            {t("phone.redeem.backLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
