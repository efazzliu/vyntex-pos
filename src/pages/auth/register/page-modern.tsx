import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Lock, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { supabase } from "@/lib/supabase.ts";
import { toast } from "sonner";
import AuthTopNav from "@/pages/auth/_components/auth-top-nav.tsx";
import { FREE_TRIAL_QUERY_VALUE, USER_META_APP_TRIAL } from "@/lib/free-trial.ts";

export default function RegisterPageModern() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trialSignup = searchParams.get("trial") === FREE_TRIAL_QUERY_VALUE;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return void toast.error("Please fill all required fields.");
    if (password.length < 6) return void toast.error("Password must be at least 6 characters.");
    if (password !== confirmPassword) return void toast.error("Passwords do not match.");
    setLoading(true);
    const userData: Record<string, string> = { full_name: name.trim() };
    if (trialSignup) userData[USER_META_APP_TRIAL] = FREE_TRIAL_QUERY_VALUE;

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: userData, emailRedirectTo: `${window.location.origin}/login` },
    });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      const alreadyRegistered =
        msg.includes("already registered") || msg.includes("user already registered");
      if (alreadyRegistered) {
        setResendingVerification(true);
        try {
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email: email.trim(),
            options: { emailRedirectTo: `${window.location.origin}/login` },
          });
          if (resendError) return void toast.error(resendError.message);
          return void toast.success("This email is already registered. Verification email was sent again.");
        } finally {
          setResendingVerification(false);
        }
      }
      return void toast.error(error.message);
    }
    toast.success("Registration successful. Please verify your email first.");
    const nextSearch = searchParams.toString();
    navigate(nextSearch ? `/login?${nextSearch}` : "/login");
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
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 pt-24">
        <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-white/15 bg-white/[0.06] shadow-[0_40px_100px_-28px_rgba(2,6,23,0.85)] backdrop-blur-xl">
          <div className="grid md:grid-cols-[1fr_1.05fr]">
            <section className="bg-white/95 p-8 sm:p-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                QUICK ONBOARDING
              </p>
              <h1 className="mt-4 text-2xl font-bold text-slate-900">Create Account</h1>
              <p className="mt-1 text-sm text-slate-500">Register with email, name, and password.</p>
              {trialSignup ? (
                <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 text-sm text-emerald-900">
                  <strong className="font-semibold">1 month free</strong> on Starter when you finish setup — full POS
                  access, no card required to start.
                </div>
              ) : null}
              <form onSubmit={handleRegister} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl border-slate-200 bg-slate-50/90 pl-10 shadow-sm focus-visible:ring-[#0066FF]/40" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl border-slate-200 bg-slate-50/90 pl-10 shadow-sm focus-visible:ring-[#0066FF]/40" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl border-slate-200 bg-slate-50/90 pl-10 shadow-sm focus-visible:ring-[#0066FF]/40" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 rounded-xl border-slate-200 bg-slate-50/90 pl-10 shadow-sm focus-visible:ring-[#0066FF]/40" required />
                  </div>
                </div>
                <Button type="submit" className="h-11 w-full rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00AACC] text-white shadow-lg shadow-blue-500/30 transition hover:scale-[1.01] hover:from-[#0055DD] hover:to-[#0099BB]" disabled={loading || resendingVerification}>
                  {loading ? "Creating..." : resendingVerification ? "Resending verification..." : "Create Account"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <Link
                  to={searchParams.toString() ? `/login?${searchParams.toString()}` : "/login"}
                  className="font-medium text-[#0066FF] hover:underline"
                >
                  Login
                </Link>
              </p>
            </section>

            <section className="relative hidden p-12 md:block">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0066FF]/20 via-[#00AACC]/10 to-[#44CC00]/15" />
              <div className="relative">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  SMART START
                </p>
                <h2 className="mt-5 text-4xl font-bold leading-tight text-white">
                  Build your POS workspace in minutes
                </h2>
                <ul className="mt-8 space-y-3 text-sm text-white/80">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />Guided setup for venues and staff</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />Secure email verification</li>
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
