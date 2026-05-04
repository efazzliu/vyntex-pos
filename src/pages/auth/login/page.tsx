export { default } from "./page-modern.tsx";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { supabase } from "@/lib/supabase.ts";
import { toast } from "sonner";
import AuthTopNav from "@/pages/auth/_components/auth-top-nav.tsx";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

function safeReturnPath(from: unknown): string | null {
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) {
    return null;
  }
  return from;
}

type LoginPageProps = {
  defaultAfterLogin?: string;
  showManagerCodeLink?: boolean;
};

export default function LoginPage({
  defaultAfterLogin = "/dashboard",
  showManagerCodeLink = false,
}: LoginPageProps) {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo =
    safeReturnPath((location.state as { from?: unknown } | null)?.from) ??
    defaultAfterLogin;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data.user?.email_confirmed_at) {
      toast.error(t("auth.login.verifyEmail"));
      return;
    }

    toast.success(t("auth.login.successToast"));
    navigate(returnTo, { replace: true });
  };

  const handlePasswordReset = async () => {
    const emailNorm = email.trim();
    if (!emailNorm) {
      toast.error("Enter your email first");
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailNorm);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password reset email sent");
    } finally {
      setSendingReset(false);
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
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[#0099CC]/8 blur-[100px]" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-4 py-8 pt-24">
        <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-[0_35px_90px_-20px_rgba(2,6,23,0.75)] backdrop-blur-xl">
          <div className="grid md:grid-cols-[1.05fr_1fr]">
            <section className="relative hidden p-10 md:block">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0066FF]/20 via-[#00AACC]/10 to-[#44CC00]/15" />
              <div className="relative">
                <img src={LOGO_URL} alt="Vyntex POS" className="h-14 w-14 object-contain" />
                <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  MODERN POS PLATFORM
                </p>
                <h2 className="mt-5 text-3xl font-bold leading-tight text-white">
                  Welcome back to
                  <span className="bg-gradient-to-r from-[#66B3FF] to-[#8AF35A] bg-clip-text text-transparent">
                    {" "}
                    Vyntex POS
                  </span>
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
                  Sign in to manage your venues, sales, and operations from one secure dashboard.
                </p>
                <ul className="mt-8 space-y-3 text-sm text-white/80">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />
                    Real-time dashboard and reports
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />
                    Secure cloud authentication
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />
                    Multi-venue management tools
                  </li>
                </ul>
              </div>
            </section>

            <section className="bg-white/95 p-7 sm:p-9">
              <div className="flex items-center gap-3 md:hidden">
                <img src={LOGO_URL} alt="Vyntex POS" className="h-11 w-11 object-contain" />
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Vyntex POS</h1>
                  <p className="text-xs text-slate-500">Secure access panel</p>
                </div>
              </div>

              <div className="mt-3 md:mt-0">
                <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  SECURE LOGIN
                </p>
                <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
                <p className="mt-1 text-sm text-slate-500">{t("auth.login.subtitle")}</p>
              </div>

              <form onSubmit={handleLogin} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-800">
                    {t("auth.login.emailLabel")}
                  </Label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.login.emailPlaceholder")}
                      required
                      className="h-11 rounded-xl border-slate-200 bg-slate-50/90 pl-10 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handlePasswordReset()}
                      disabled={sendingReset}
                      className="text-xs font-medium text-[#0066FF] hover:underline disabled:opacity-60"
                    >
                      {sendingReset ? "Sending reset..." : "Forgot password?"}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-800">
                    {t("auth.login.passwordLabel")}
                  </Label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 rounded-xl border-slate-200 bg-slate-50/90 pl-10 pr-11 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-11 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/30 transition-transform duration-200 hover:scale-[1.01]"
                >
                  {loading ? t("auth.login.submitLoading") : t("auth.login.submit")}
                </Button>
              </form>

              {showManagerCodeLink ? (
                <p className="mt-5 text-center text-sm">
                  <Link to="/redeem-code" className="font-medium text-[#0066FF] hover:underline">
                    {t("auth.login.managerCodeLink")}
                  </Link>
                </p>
              ) : null}

              <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
                {t("auth.login.footerHint")}
              </p>

              <p className="mt-4 text-center text-sm leading-relaxed text-slate-500">
                {t("auth.login.registerNote")}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { supabase } from "@/lib/supabase.ts";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import AuthTopNav from "@/pages/auth/_components/auth-top-nav.tsx";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

function safeReturnPath(from: unknown): string | null {
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) {
    return null;
  }
  return from;
}

type LoginPageProps = {
  /** Used when there is no `from` in location state (e.g. phone shell → `/app`). */
  defaultAfterLogin?: string;
  /** Phone app: link to invite-code entry (no password) for venue managers. */
  showManagerCodeLink?: boolean;
};

export default function LoginPage({
  defaultAfterLogin = "/dashboard",
  showManagerCodeLink = false,
}: LoginPageProps) {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo =
    safeReturnPath((location.state as { from?: unknown } | null)?.from) ??
    defaultAfterLogin;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data.user?.email_confirmed_at) {
      toast.error(t("auth.login.verifyEmail"));
      return;
    }

    toast.success(t("auth.login.successToast"));
    navigate(returnTo, { replace: true });
  };

  const handlePasswordReset = async () => {
    const emailNorm = email.trim();
    if (!emailNorm) {
      toast.error("Enter your email first");
      return;
    }
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailNorm);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password reset email sent");
    } finally {
      setSendingReset(false);
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
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[#0099CC]/8 blur-[100px]" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-4 py-8 pt-24">
      <div
        className={cn(
          "w-full max-w-[420px] rounded-[1.45rem] border border-slate-200/90 bg-white/95 p-8 shadow-[0_26px_60px_-16px_rgba(15,23,42,0.18)] backdrop-blur-sm",
        )}
      >
        <div className="flex flex-col items-center text-center">
          <img
            src={LOGO_URL}
            alt="Vyntex POS"
            className="mb-5 h-16 w-16 object-contain"
          />
          <h1 className="text-[1.35rem] font-bold tracking-tight text-slate-900">Vyntex POS</h1>
          <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-slate-500">
            {t("auth.login.subtitle")}
          </p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-800">
              {t("auth.login.emailLabel")}
            </Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.login.emailPlaceholder")}
                required
                className="h-11 rounded-xl border-slate-200 bg-slate-50/90 pl-10 text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handlePasswordReset()}
                disabled={sendingReset}
                className="text-xs font-medium text-[#0066FF] hover:underline disabled:opacity-60"
              >
                {sendingReset ? "Sending reset..." : "Forgot password?"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-800">
              {t("auth.login.passwordLabel")}
            </Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-xl border-slate-200 bg-slate-50/90 pl-10 pr-11 text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="mt-2 h-11 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/30 transition-transform duration-200 hover:scale-[1.01]"
          >
            {loading ? t("auth.login.submitLoading") : t("auth.login.submit")}
          </Button>
        </form>

        {showManagerCodeLink ? (
          <p className="mt-5 text-center text-sm">
            <Link
              to="/redeem-code"
              className="font-medium text-[#0066FF] hover:underline"
            >
              {t("auth.login.managerCodeLink")}
            </Link>
          </p>
        ) : null}

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
          {t("auth.login.footerHint")}
        </p>

        <p className="mt-4 text-center text-sm leading-relaxed text-slate-500">
          {t("auth.login.registerNote")}
        </p>
      </div>
      </div>
    </div>
  );
}
