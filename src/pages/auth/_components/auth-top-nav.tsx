import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { useSiteLanguage } from "@/components/providers/site-locale-provider.tsx";
import { FlagAL, FlagUS } from "@/components/flag-icons.tsx";
import { cn } from "@/lib/utils.ts";
import { supabase } from "@/lib/supabase.ts";
import { registerUrlWithFreeTrial } from "@/lib/free-trial.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

const navItems = [
  { key: "home", href: "/" },
  { key: "vynTypes", href: "/vyn-types" },
  { key: "pricing", href: "/pricing" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
] as const;

function AuthLangFlags() {
  const { language, setLanguage } = useSiteLanguage();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLanguage("sq")}
        aria-label="Shqip"
        aria-pressed={language === "sq"}
        title="Shqip"
        className={cn(
          "inline-flex items-center justify-center rounded-full px-2.5 py-1.5 transition-colors",
          language === "sq" ? "bg-white/25 ring-1 ring-white/40" : "hover:bg-white/15",
        )}
      >
        <FlagAL className="h-4 w-6" />
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-label="English"
        aria-pressed={language === "en"}
        title="English"
        className={cn(
          "inline-flex items-center justify-center rounded-full px-2.5 py-1.5 transition-colors",
          language === "en" ? "bg-white/25 ring-1 ring-white/40" : "hover:bg-white/15",
        )}
      >
        <FlagUS className="h-4 w-6" />
      </button>
    </div>
  );
}

export default function AuthTopNav() {
  const { t } = useTranslation("site");
  const [isAuthed, setIsAuthed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const ctaLabel = isAuthed ? t("auth.topNav.profile") : t("auth.topNav.getStarted");
  const ctaPath = isAuthed ? "/dashboard/restaurant-pos" : registerUrlWithFreeTrial();

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setIsAuthed(Boolean(session?.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setIsAuthed(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-[#060B18]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-8 w-8" />
          <span className="text-xl font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
            Vyntex POS
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((link) => (
            <button
              key={link.href}
              onClick={() => navigate(link.href)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white",
                location.pathname === link.href && "bg-white/10 text-white",
              )}
            >
              {t(`nav.${link.key}`)}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate(ctaPath)}
            className="hidden rounded-full bg-gradient-to-r from-[#0066FF] to-[#00AACC] px-4 text-white shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.02] hover:from-[#0055DD] hover:to-[#0099BB] md:inline-flex"
          >
            {ctaLabel}
          </Button>
          <AuthLangFlags />
        </div>
      </div>
    </header>
  );
}
