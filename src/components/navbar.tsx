import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { cn } from "@/lib/utils.ts";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { toast } from "sonner";

const LOGO_URL = "https://hercules-cdn.com/file_80VAi8Tu1pNV5onr3HBvq7tz";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "VYN Types", href: "/vyn-types" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const handleNavClick = (href: string) => {
    navigate(href);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobileOpen(false);
  };

  // Only transparent navbar on homepage hero
  const isHomePage = location.pathname === "/";
  const isTransparent = !scrolled && isHomePage;

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isTransparent
          ? "bg-transparent"
          : "bg-background/80 backdrop-blur-xl border-b border-border shadow-sm"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={LOGO_URL} alt="VYNTEX" className="h-8 w-8" />
            <span className="text-xl font-bold bg-gradient-to-r from-[#0066FF] to-[#44CC00] bg-clip-text text-transparent">
              VYNTEX
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.href)}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors rounded-md cursor-pointer",
                  isTransparent
                    ? "text-white/70 hover:text-white hover:bg-white/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  location.pathname === link.href && !isTransparent && "text-foreground bg-accent"
                )}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <AuthLoading>
              <Skeleton className="h-8 w-20 rounded-md" />
            </AuthLoading>
            <Unauthenticated>
              <SignInButton />
            </Unauthenticated>
            <Authenticated>
              <Button
                size="sm"
                onClick={() => toast.info("Coming soon in a future milestone!")}
              >
                Dashboard
              </Button>
            </Authenticated>
          </div>

          <button
            className={cn(
              "md:hidden p-2 rounded-md cursor-pointer",
              isTransparent ? "text-white hover:bg-white/10" : "hover:bg-accent"
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
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleNavClick(link.href)}
                  className={cn(
                    "block w-full text-left px-3 py-2.5 text-sm font-medium rounded-md cursor-pointer transition-colors",
                    location.pathname === link.href
                      ? "text-foreground bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-3 mt-2 border-t border-border">
                <AuthLoading>
                  <Skeleton className="h-9 w-full rounded-md" />
                </AuthLoading>
                <Unauthenticated>
                  <SignInButton />
                </Unauthenticated>
                <Authenticated>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => toast.info("Coming soon in a future milestone!")}
                  >
                    Dashboard
                  </Button>
                </Authenticated>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
