import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useSiteLanguage } from "@/components/providers/site-locale-provider.tsx";
import { FlagAL, FlagUS } from "@/components/flag-icons.tsx";
import { cn } from "@/lib/utils.ts";
import { supabase } from "@/lib/supabase.ts";
import { registerUrlWithFreeTrial } from "@/lib/free-trial.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";
import { Languages } from "lucide-react";

const navItems = [
  { key: "home", href: "/" },
  { key: "vynTypes", href: "/vyn-types" },
  { key: "pricing", href: "/pricing" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
] as const;

export default function AuthTopNav() {
  const { t } = useTranslation("site");
  const { language, setLanguage } = useSiteLanguage();
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

        <div className="hidden md:flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate(ctaPath)}
            className="rounded-full bg-gradient-to-r from-[#0066FF] to-[#00AACC] px-4 text-white shadow-lg shadow-blue-600/25 transition-all hover:scale-[1.02] hover:from-[#0055DD] hover:to-[#0099BB]"
          >
            {ctaLabel}
          </Button>
          <Select
            value={language}
            onValueChange={(value) => {
              if (value === "en" || value === "sq") setLanguage(value);
            }}
          >
            <SelectTrigger className="h-8 min-w-42 border-white/20 bg-white/5 text-xs font-semibold text-white/90">
              <span className="inline-flex items-center gap-2">
                <Languages className="size-3.5 text-white/70" />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent className="min-w-42">
              <SelectItem value="en">
                <FlagUS /> English
              </SelectItem>
              <SelectItem value="sq">
                <FlagAL /> Albanian
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  );
}
