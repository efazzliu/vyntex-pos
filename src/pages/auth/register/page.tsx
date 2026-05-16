export { default } from "./page-modern.tsx";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Lock, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { supabase } from "@/lib/supabase.ts";
import { toast } from "sonner";
import AuthTopNav from "@/pages/auth/_components/auth-top-nav.tsx";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Registration successful. Please verify your email first.");
    navigate("/login");
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

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 pt-24">
        <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-[0_35px_90px_-20px_rgba(2,6,23,0.75)] backdrop-blur-xl">
          <div className="grid md:grid-cols-[1fr_1.05fr]">
            <section className="bg-white/95 p-7 sm:p-9">
              <div className="flex items-center gap-3">
                <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-11 w-11 object-contain" />
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Vyntex POS</h1>
                  <p className="text-xs text-slate-500">Create your account</p>
                </div>
              </div>

              <div className="mt-3">
                <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  QUICK ONBOARDING
                </p>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Register</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Start using Vyntex POS in a few steps.
                </p>
              </div>

              <form onSubmit={handleRegister} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-800">
                    Name
                  </Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      required
                      className="h-11 border-slate-200 bg-slate-50/90 pl-10 text-slate-900"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-800">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="h-11 border-slate-200 bg-slate-50/90 pl-10 text-slate-900"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-800">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 border-slate-200 bg-slate-50/90 pl-10 text-slate-900"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-800">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="h-11 border-slate-200 bg-slate-50/90 pl-10 text-slate-900"
                    />
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full text-base font-semibold" disabled={loading}>
                  {loading ? "Creating..." : "Create Account"}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-[#0066FF] hover:underline">
                  Login
                </Link>
              </p>
            </section>

            <section className="relative hidden p-10 md:block">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0066FF]/20 via-[#00AACC]/10 to-[#44CC00]/15" />
              <div className="relative">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  SMART START
                </p>
                <h3 className="mt-5 text-3xl font-bold leading-tight text-white">
                  Build your POS workspace in minutes
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
                  Register once and access dashboards, settings, and tools tailored for your business.
                </p>
                <ul className="mt-8 space-y-3 text-sm text-white/80">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />
                    Guided setup for venues and staff
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />
                    Secure login with email verification
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#66B3FF]" />
                    Access from desktop and phone
                  </li>
                </ul>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { supabase } from "@/lib/supabase.ts";
import { toast } from "sonner";
import AuthTopNav from "@/pages/auth/_components/auth-top-nav.tsx";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Registration successful. Please verify your email first.");
    navigate("/login");
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

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 pt-24">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-[0_26px_60px_-16px_rgba(15,23,42,0.18)] backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
          <p className="mt-1 text-sm text-slate-500">Register with email, name, and password.</p>

          <form onSubmit={handleRegister} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-800">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
                className="border-slate-200 bg-slate-50/90 text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-800">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="border-slate-200 bg-slate-50/90 text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-800">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-200 bg-slate-50/90 text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-slate-800">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-slate-200 bg-slate-50/90 text-slate-900"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Register"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-[#0066FF] hover:underline">
              Login
            </Link>
          </p>
          </div>
        </div>
      </div>
  );
}
