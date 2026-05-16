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
import { Languages, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSiteLanguage } from "@/components/providers/site-locale-provider.tsx";
import { supabase } from "@/lib/supabase.ts";
import { VYNTEX_APP_LOGO_SRC } from "@/lib/site-constants.ts";

const navItems = [
  { key: "home", href: "/" },
  { key: "vynTypes", href: "/vyn-types" },
  { key: "pricing", href: "/pricing" },
  { key: "about", href: "/about" },
  { key: "contact", href: "/contact" },
] as const;

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
    ? "border-white/20 bg-white/5 text-white/90"
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
          ? "bg-transparent"
          : "bg-background/80 backdrop-blur-xl border-b border-border shadow-sm",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
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
                onClick={() => handleNavClick(link.href)}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors rounded-md cursor-pointer",
                  isTransparent
                    ? "text-white/70 hover:text-white hover:bg-white/10"
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
              <SelectTrigger className={cn("h-8 min-w-42 text-xs font-semibold", langSelectClass)}>
                <span className="inline-flex items-center gap-2">
                  <Languages className="size-3.5 text-muted-foreground" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent className="min-w-42">
                <SelectItem value="en">🇺🇸 English</SelectItem>
                <SelectItem value="sq">🇦🇱 Albanian</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            className={cn(
              "md:hidden p-2 rounded-md cursor-pointer",
              isTransparent ? "text-white hover:bg-white/10" : "hover:bg-accent",
            )}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
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
                    <span className="inline-flex items-center gap-2">
                      <Languages className="size-3.5 text-muted-foreground" />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">🇺🇸 English</SelectItem>
                    <SelectItem value="sq">🇦🇱 Albanian</SelectItem>
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
