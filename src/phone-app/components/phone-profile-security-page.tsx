import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { supabase } from "@/lib/supabase.ts";
import { cn } from "@/lib/utils.ts";

export default function PhoneProfileSecurityPage() {
  const { t } = useTranslation("site");
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setEmail(data.user?.email ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}#/login`
      : undefined;

  const sendReset = async () => {
    if (!email?.trim()) {
      toast.error(t("phone.profile.resetEmailErr"));
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("phone.profile.resetEmailSent"));
    } catch {
      toast.error(t("phone.profile.resetEmailErr"));
    } finally {
      setSending(false);
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
          <h1 className="text-lg font-bold text-slate-900">{t("phone.profile.security")}</h1>
          <p className="text-xs text-slate-500">{t("phone.profile.securitySubtitle")}</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <KeyRound className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{t("phone.profile.labelEmail")}</p>
              <p className="mt-1 break-all text-sm text-slate-600">
                {loading ? "…" : email ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">{t("phone.profile.passwordResetHint")}</p>

        <Button
          type="button"
          className="h-12 w-full rounded-xl bg-[#0066FF] hover:bg-[#0055DD]"
          disabled={loading || sending || !email}
          onClick={() => void sendReset()}
        >
          {sending ? t("phone.profile.sending") : t("phone.profile.sendResetEmail")}
        </Button>
      </div>
    </div>
  );
}
