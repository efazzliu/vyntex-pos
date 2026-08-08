import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import { Menu, Moon, Sun, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "next-themes";
import { useSiteLanguage } from "@/components/providers/site-locale-provider.tsx";
import { FlagAL, FlagUS } from "@/components/flag-icons.tsx";
import { supabase } from "@/lib/supabase.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

const navItems = [
  { key: "home", href: "/" },
  { key: "vynTypes", href: "/vyn-types" },
  { key: "pricing", href: "/pricing" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
] as const;

function ThemeToggle({ transparent }: { transparent: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
        transparent
          ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export default function Navbar() {
  const { t } = useTranslation("site");
  const { language, setLanguage } = useSiteLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const handleNavClick = (href: string) => {
    navigate(href);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobileOpen(false);
  };

  const isHomePage = location.pathname === "/";
  const isTransparent = !scrolled && isHomePage;

  const langSelectClass = isTransparent
    ? "border-white/25 bg-white/10 text-white"
    : "";
  const ctaLabel = isAuthed ? "PROFILE" : "GET STARTED";
  const ctaPath = isAuthed ? "/dashboard/restaurant-pos" : "/register";

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isTransparent
          ? "border-b border-white/15 bg-[#030814]/90 shadow-lg shadow-black/10 backdrop-blur-xl"
          : "border-b border-border bg-background/90 shadow-sm backdrop-blur-xl",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-[72px] items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="h-9 w-9" />
            <span className="text-xl font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              Vyntex POS
            </span>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                className={cn(
                  "cursor-pointer rounded-lg px-4 py-2.5 text-base font-semibold transition-colors",
                  isTransparent
                    ? "text-white hover:bg-white/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  location.pathname === link.href &&
                    !isTransparent &&
                    "text-foreground bg-accent",
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
              className="h-10 rounded-full bg-gradient-to-r from-[#0066FF] to-[#00AACC] px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] hover:from-[#0055DD] hover:to-[#0099BB]"
            >
              {ctaLabel}
            </Button>
            <ThemeToggle transparent={isTransparent} />
            <Select
              value={language}
              onValueChange={(value) => {
                if (value === "en" || value === "sq") setLanguage(value);
              }}
            >
              <SelectTrigger className={cn("h-10 min-w-[8.5rem] text-sm font-semibold", langSelectClass)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[8.5rem]">
                <SelectItem value="en">
                  <span className="inline-flex items-center gap-2">
                    <FlagUS />
                    English
                  </span>
                </SelectItem>
                <SelectItem value="sq">
                  <span className="inline-flex items-center gap-2">
                    <FlagAL />
                    Albanian
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:hidden flex items-center gap-1.5">
            <ThemeToggle transparent={isTransparent} />
            <button
              className={cn(
                "p-2 rounded-md cursor-pointer",
                isTransparent ? "text-white hover:bg-white/10" : "hover:bg-accent",
              )}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navItems.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className={cn(
                    "block w-full text-left px-3 py-2.5 text-sm font-medium rounded-md cursor-pointer transition-colors",
                    location.pathname === link.href
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  {t(`nav.${link.key}`)}
                </button>
              ))}
              <div className="pt-3 mt-2 border-t border-border space-y-3">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(ctaPath)}
                >
                  {ctaLabel}
                </Button>
                <Select
                  value={language}
                  onValueChange={(value) => {
                    if (value === "en" || value === "sq") setLanguage(value);
                  }}
                >
                  <SelectTrigger className="h-9 w-full text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">
                      <span className="inline-flex items-center gap-2">
                        <FlagUS />
                        English
                      </span>
                    </SelectItem>
                    <SelectItem value="sq">
                      <span className="inline-flex items-center gap-2">
                        <FlagAL />
                        Albanian
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
