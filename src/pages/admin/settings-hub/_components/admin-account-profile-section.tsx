import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { ExternalLink, LogOut, Mail, Monitor, Moon, Sun, User } from "lucide-react";
import { supabase } from "@/lib/supabase.ts";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { toast } from "sonner";
import { SUPPORT_EMAIL, SUPPORT_MAILTO_HREF } from "@/lib/site-constants.ts";

export function AdminAccountProfileSection() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [personalName, setPersonalName] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalLoading, setPersonalLoading] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = data.user;
      if (u) {
        const meta = u.user_metadata as { full_name?: string };
        setPersonalName((meta?.full_name ?? "").trim() || "");
        setPersonalEmail(u.email ?? "");
      }
      setAuthLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalName.trim()) return void toast.error("Your name is required");
    setPersonalLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: personalName.trim() } });
      if (error) return void toast.error(error.message);
      toast.success("Profile updated");
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <motion.section
      id="account"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="scroll-mt-6 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white/95 via-slate-50/50 to-cyan-50/20 p-5 shadow-[0_28px_64px_-48px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-700/60 dark:from-slate-900/90 dark:via-slate-900/75 dark:to-slate-950/80 lg:p-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Your account
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Profile & appearance</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Name and email for this login. Theme applies across admin and the rest of the site.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleSignOut()}
          className="rounded-xl border-red-500/25 text-red-600 hover:bg-red-500/10 dark:text-red-400"
        >
          <LogOut className="mr-2 size-4" />
          Sign out
        </Button>
      </div>

      <form onSubmit={handleSavePersonal} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div>
            <Label htmlFor="admin-personal-name" className="text-sm text-slate-700 dark:text-slate-300">
              Full name
            </Label>
            <Input
              id="admin-personal-name"
              value={personalName}
              onChange={(e) => setPersonalName(e.target.value)}
              disabled={!authLoaded}
              className="mt-1.5 h-11 rounded-xl border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <Label htmlFor="admin-personal-email" className="text-sm text-slate-700 dark:text-slate-300">
              <Mail className="mr-1 inline size-3.5" />
              Email
            </Label>
            <Input
              id="admin-personal-email"
              value={personalEmail}
              readOnly
              className="mt-1.5 h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400"
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              To change email, contact{" "}
              <a href={SUPPORT_MAILTO_HREF} className="font-medium text-[#0066FF] hover:underline dark:text-cyan-400">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>
          <Button
            type="submit"
            disabled={personalLoading || !authLoaded}
            className="h-11 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#22c55e] px-6 font-semibold text-white shadow-[0_12px_32px_-16px_rgba(0,102,255,0.45)]"
          >
            {personalLoading ? "Saving…" : "Save profile"}
          </Button>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            <Link
              to="/dashboard/settings"
              className="inline-flex items-center gap-1.5 font-medium text-[#0066FF] hover:underline dark:text-cyan-400"
            >
              <ExternalLink className="size-3.5" />
              Venue, billing & license (dashboard)
            </Link>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-600/80 dark:bg-slate-800/50">
          <div className="mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <User className="size-4 text-[#0066FF] dark:text-cyan-400" />
            <span className="text-sm font-semibold">Theme</span>
          </div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Same as the menu on the top bar.</p>
          <div className="flex flex-col gap-2">
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
                className={cn(
                  "w-full justify-start rounded-xl",
                  (theme ?? "system") === id &&
                    "bg-gradient-to-r from-[#0066FF] to-cyan-500 text-white hover:opacity-95 dark:text-white",
                )}
                onClick={() => setTheme(id)}
              >
                <Icon className="mr-2 size-4" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </form>
    </motion.section>
  );
}
