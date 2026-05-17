import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import { isEmailBanned } from "@/lib/supabase-pos/admin-ops.ts";
import { registerUrlWithFreeTrial } from "@/lib/free-trial.ts";
import { toast } from "sonner";
import AuthTopNav from "@/pages/auth/_components/auth-top-nav.tsx";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

function safeReturnPath(from: unknown): string | null {
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) {
    return null;
  }
  return from;
}

type LoginPageProps = { defaultAfterLogin?: string; showManagerCodeLink?: boolean };

export default function LoginPageModern({
  defaultAfterLogin = "/dashboard",
  showManagerCodeLink = false,
}: LoginPageProps) {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo =
    safeReturnPath((location.state as { from?: unknown } | null)?.from) ?? defaultAfterLogin;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      return void toast.error(t("auth.login.supabaseNotConfigured"));
    }
    try {
      if (await isEmailBanned(email.trim())) {
        return void toast.error("Ky llogari është e bllokuar. Kontaktoni mbështetjen.");
      }
    } catch {
      /* ban check unavailable */
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      const code = (error as { code?: string }).code?.toLowerCase();
      const msg = error.message?.toLowerCase() ?? "";
      if (
        code === "email_not_confirmed" ||
        msg.includes("email not confirmed") ||
        msg.includes("email_not_confirmed")
      ) {
        return void toast.error(t("auth.login.verifyEmail"));
      }
      return void toast.error(error.message);
    }
    if (!data.session) {
      return void toast.error(t("auth.login.verifyEmail"));
    }
    toast.success(t("auth.login.successToast"));
    navigate(returnTo, { replace: true });
  };

  const handlePasswordReset = async () => {
    const emailNorm = email.trim();
    if (!emailNorm) return void toast.error(t("auth.login.enterEmailFirst"));
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailNorm);
      if (error) return void toast.error(error.message);
      toast.success(t("auth.login.resetEmailSent"));
    } finally {
      setSendingReset(false);
    }
  };

  const handleResendVerification = async () => {
    const emailNorm = email.trim();
    if (!emailNorm) return void toast.error(t("auth.login.enterEmailFirst"));
    setSendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailNorm,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) return void toast.error(error.message);
      toast.success(t("auth.login.verificationEmailSent"));
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#060B18]">
      <AuthTopNav />
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#060B18] via-[#0A1628] to-[#060B18]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-[#0066FF]/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-[#44CC00]/12 blur-[120px]" />
      </div>
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-4 py-8 pt-24">
        <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-white/15 bg-white/[0.06] shadow-[0_40px_100px_-28px_rgba(2,6,23,0.85)] backdrop-blur-xl">
          <div className="grid md:grid-cols-[1.05fr_1fr]">
            <section className="relative hidden p-12 md:block">
              <div className="relative">
                <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-14 w-14 object-contain" />
                <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("auth.login.heroBadge")}
                </p>
                <h2 className="mt-5 text-4xl font-bold leading-tight text-white">{t("auth.login.heroTitle")}</h2>
                <ul className="mt-8 space-y-3 text-sm text-white/80">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />
                    {t("auth.login.heroBullet1")}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />
                    {t("auth.login.heroBullet2")}
                  </li>
                </ul>
              </div>
            </section>
            <section className="bg-white/95 p-8 sm:p-10">
              {!isSupabaseConfigured ? (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  {t("auth.login.supabaseNotConfigured")}
                </p>
              ) : null}
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("auth.login.secureBadge")}
              </p>
              <h1 className="mt-4 text-2xl font-bold text-slate-900">{t("auth.login.heading")}</h1>
              <p className="mt-1 text-sm text-slate-500">{t("auth.login.subtitle")}</p>
              <form onSubmit={handleLogin} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-800">
                    {t("auth.login.emailLabel")}
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-slate-900 caret-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-[#0066FF]/40"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => void handlePasswordReset()}
                      disabled={sendingReset}
                      className="text-[#0066FF]"
                    >
                      {sendingReset ? t("auth.login.sendingReset") : t("auth.login.forgotPassword")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleResendVerification()}
                      disabled={sendingVerification}
                      className="text-[#0066FF]"
                    >
                      {sendingVerification
                        ? t("auth.login.sendingVerification")
                        : t("auth.login.resendVerification")}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-800">
                    {t("auth.login.passwordLabel")}
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-11 text-slate-900 caret-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:ring-[#0066FF]/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white shadow-lg shadow-blue-500/30 transition hover:scale-[1.01] hover:from-[#0055DD] hover:to-[#0099BB]">
                  {loading ? t("auth.login.submitLoading") : t("auth.login.submit")}
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-slate-600">
                {t("auth.login.noAccount")}{" "}
                <Link to={registerUrlWithFreeTrial()} className="font-semibold text-[#0066FF] hover:underline">
                  {t("auth.login.createAccount")}
                </Link>
              </p>
              {showManagerCodeLink ? <p className="mt-4 text-sm"><Link to="/redeem-code" className="text-[#0066FF]">{t("auth.login.managerCodeLink")}</Link></p> : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
