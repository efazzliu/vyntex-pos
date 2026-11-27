import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Globe,
  Monitor,
  Printer,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { SiteLanguageToggle } from "@/components/site-language-toggle.tsx";
import { useMarketingPrimaryCtaHref } from "@/hooks/use-marketing-primary-cta-href.ts";
import { useSiteLanguage } from "@/components/providers/site-locale-provider.tsx";
import { submitContactForm } from "@/lib/supabase-pos/contact-ops.ts";
import { isSupabaseConfigured } from "@/lib/supabase.ts";
import {
  APP_VERSION_LABEL,
  VYNTEX_APP_LOGO_SRC,
  VYNTEX_INSTAGRAM_URL,
} from "@/lib/site-constants.ts";
import { cn } from "@/lib/utils.ts";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

type NavLink = { labelKey: string; href: string; external?: boolean };

const PRODUCT_LINKS: NavLink[] = [
  { labelKey: "footerPremium.product.features", href: "/features" },
  { labelKey: "footerPremium.product.posOrdering", href: "/features" },
  { labelKey: "footerPremium.product.kds", href: "/features" },
  { labelKey: "footerPremium.product.inventory", href: "/features" },
  { labelKey: "footerPremium.product.reports", href: "/features" },
  { labelKey: "footerPremium.product.integrations", href: "/contact" },
];

const SOLUTION_LINKS: NavLink[] = [
  { labelKey: "footerPremium.solutions.restaurants", href: "/vyn-types" },
  { labelKey: "footerPremium.solutions.cafes", href: "/vyn-types" },
  { labelKey: "footerPremium.solutions.fastFood", href: "/vyn-types" },
  { labelKey: "footerPremium.solutions.bars", href: "/vyn-types" },
  { labelKey: "footerPremium.solutions.multiLocation", href: "/pricing" },
  { labelKey: "footerPremium.solutions.enterprise", href: "/pricing" },
];

const RESOURCE_LINKS: NavLink[] = [
  { labelKey: "footerPremium.resources.videoTutorials", href: "/product-demo" },
  { labelKey: "footerPremium.resources.faq", href: "/faq" },
  { labelKey: "footerPremium.resources.contactSupport", href: "/contact" },
];

const COMPANY_LINKS: NavLink[] = [
  { labelKey: "footerPremium.company.about", href: "/about" },
  { labelKey: "footerPremium.company.pricing", href: "/pricing" },
  { labelKey: "footerPremium.company.contact", href: "/contact" },
  { labelKey: "footerPremium.company.partner", href: "/contact" },
];

const LEGAL_LINKS: NavLink[] = [
  { labelKey: "footer.privacy", href: "/legal/privacy" },
  { labelKey: "footer.terms", href: "/legal/terms" },
  { labelKey: "footerPremium.legal.contactSupport", href: "/contact" },
];

function FooterLink({ link }: { link: NavLink }) {
  const { t } = useTranslation("site");
  const className =
    "text-sm text-neutral-500 transition-colors hover:text-neutral-900";

  if (link.external || link.href.startsWith("http")) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={className}>
        {t(link.labelKey)}
      </a>
    );
  }

  if (link.href.startsWith("/#")) {
    return (
      <a href={link.href} className={className}>
        {t(link.labelKey)}
      </a>
    );
  }

  return (
    <Link to={link.href} className={className}>
      {t(link.labelKey)}
    </Link>
  );
}

function FooterColumn({
  titleKey,
  links,
}: {
  titleKey: string;
  links: NavLink[];
}) {
  const { t } = useTranslation("site");
  return (
    <div>
      <h4 className="text-sm font-semibold text-neutral-950">{t(titleKey)}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.labelKey}>
            <FooterLink link={link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CtaBanner() {
  const { t } = useTranslation("site");
  const trialHref = useMarketingPrimaryCtaHref();

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-sky to-brand-accent px-6 py-10 sm:px-10 sm:py-12 lg:px-14">
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/20 opacity-40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-brand-accent/40 opacity-40 blur-3xl"
        aria-hidden
      />

      <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("footerPremium.cta.title")}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            {t("footerPremium.cta.subtitle")}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-white px-6 font-semibold text-neutral-950 hover:bg-white/95"
            >
              <Link to={trialHref} className="inline-flex items-center gap-1.5">
                {t("footerPremium.cta.trial")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-white/40 bg-transparent px-6 font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/contact" className="inline-flex items-center gap-1.5">
                {t("footerPremium.cta.sales")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Lightweight POS hardware mockups — no external assets */}
        <div className="relative mx-auto hidden h-44 w-full max-w-md lg:block" aria-hidden>
          <div className="absolute left-4 top-2 w-48 rounded-xl border border-white/20 bg-white/10 p-2 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-1.5 border-b border-white/15 pb-1.5">
              <Monitor className="size-3.5 text-white/80" />
              <span className="text-[10px] font-medium text-white/70">POS</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {["Orders", "Tables", "Menu", "Pay"].map((label) => (
                <div
                  key={label}
                  className="rounded-md bg-white/15 px-2 py-1.5 text-center text-[10px] font-semibold text-white"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-2 left-28 w-24 rounded-lg border border-white/20 bg-white/15 p-2 shadow-lg">
            <Printer className="mb-1 size-3.5 text-white/80" />
            <div className="space-y-1 font-mono text-[8px] leading-tight text-white/75">
              <div>VYNTEX POS</div>
              <div>------------</div>
              <div>TOTAL 16.00</div>
            </div>
          </div>
          <div className="absolute right-2 top-6 w-20 rounded-2xl border border-white/25 bg-white/15 p-2 shadow-xl">
            <Smartphone className="mb-1 size-3.5 text-white/80" />
            <div className="mx-auto mt-1 flex size-12 items-center justify-center rounded-md bg-white/90">
              <div className="grid grid-cols-3 gap-0.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className="size-1.5 rounded-[1px] bg-neutral-800" />
                ))}
              </div>
            </div>
            <p className="mt-1 text-center text-[8px] font-medium text-white/80">QR Menu</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsletterBlock() {
  const { t } = useTranslation("site");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!valid) {
      setStatus("error");
      setErrorMsg(t("footerPremium.newsletter.invalid"));
      return;
    }
    if (!isSupabaseConfigured) {
      setStatus("error");
      setErrorMsg(t("footerPremium.newsletter.unavailable"));
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    try {
      await submitContactForm({
        name: "Newsletter",
        email: trimmed,
        subject: "Newsletter subscription",
        message: "Please add this email to VyntexPOS product updates.",
        type: "form",
      });
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : t("footerPremium.newsletter.error"));
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-5 sm:p-6">
      <h3 className="text-base font-bold text-neutral-950">
        {t("footerPremium.newsletter.title")}
      </h3>
      <p className="mt-1.5 text-sm text-neutral-500">
        {t("footerPremium.newsletter.subtitle")}
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <Input
          type="email"
          name="newsletter-email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status !== "idle" && status !== "loading") setStatus("idle");
          }}
          placeholder={t("footerPremium.newsletter.placeholder")}
          className="h-11 rounded-full border-neutral-200 bg-white px-4"
          disabled={status === "loading"}
          aria-invalid={status === "error"}
        />
        <Button
          type="submit"
          disabled={status === "loading"}
          className="h-11 shrink-0 rounded-full bg-gradient-to-r from-brand to-brand-sky px-6 font-semibold text-white shadow-md shadow-brand/20 hover:from-brand-hover hover:to-brand-hover"
        >
          {status === "loading"
            ? t("footerPremium.newsletter.loading")
            : t("footerPremium.newsletter.subscribe")}
        </Button>
      </form>
      {status === "success" ? (
        <p className="mt-2 text-sm font-medium text-emerald-600" role="status">
          {t("footerPremium.newsletter.success")}
        </p>
      ) : null}
      {status === "error" && errorMsg ? (
        <p className="mt-2 text-sm font-medium text-red-600" role="alert">
          {errorMsg}
        </p>
      ) : null}
    </div>
  );
}

export default function Footer() {
  const { t } = useTranslation("site");
  const { language } = useSiteLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-white text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Final CTA */}
        <div className="py-12 sm:py-14">
          <CtaBanner />
        </div>

        {/* Main columns */}
        <div className="grid grid-cols-1 gap-10 border-t border-neutral-200 py-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2">
              <img src={VYNTEX_APP_LOGO_SRC} alt="Vyntex POS" className="size-8" />
              <span className="text-lg font-bold text-neutral-950">VyntexPOS</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-neutral-500">
              {t("footerPremium.brand.description")}
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <a
                href={VYNTEX_INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="inline-flex size-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:border-brand/40 hover:text-brand"
              >
                <InstagramIcon className="size-4" />
              </a>
            </div>
            <p className="mt-3 text-xs text-neutral-400">{t("footerPremium.brand.socialNote")}</p>
          </div>

          <FooterColumn titleKey="footerPremium.product.title" links={PRODUCT_LINKS} />
          <FooterColumn titleKey="footerPremium.solutions.title" links={SOLUTION_LINKS} />
          <FooterColumn titleKey="footerPremium.resources.title" links={RESOURCE_LINKS} />
          <FooterColumn titleKey="footerPremium.company.title" links={COMPANY_LINKS} />
        </div>

        {/* Newsletter */}
        <div className="pb-10">
          <NewsletterBlock />
        </div>

        {/* Legal row — only existing pages */}
        <nav
          aria-label={t("footerPremium.legal.navLabel")}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-200 py-5 text-xs text-neutral-500"
        >
          {LEGAL_LINKS.map((link, i) => (
            <span key={link.labelKey} className="inline-flex items-center gap-3">
              {i > 0 ? <span className="text-neutral-300" aria-hidden>|</span> : null}
              <FooterLink link={link} />
            </span>
          ))}
        </nav>

        {/* Copyright bar */}
        <div className="flex flex-col items-start justify-between gap-4 border-t border-neutral-200 py-6 sm:flex-row sm:items-center">
          <p className="text-xs text-neutral-400">
            © {year} VyntexPOS. {t("footer.rights")}{" "}
            <span className="text-neutral-300">· {t("footer.version", { v: APP_VERSION_LABEL })}</span>
          </p>
          <p className="text-xs font-medium text-neutral-500">
            {t("footerPremium.builtFor")}
          </p>
          <div className="flex items-center gap-2">
            <Globe className="size-3.5 text-neutral-400" aria-hidden />
            <span className="text-xs text-neutral-500">
              {language === "sq" ? "Shqip" : "English"}
            </span>
            <SiteLanguageToggle
              align="end"
              triggerClassName={cn(
                "size-9 border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
              )}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 pb-8">
          <span className="size-1.5 rounded-full bg-brand-accent" aria-hidden />
          <span className="text-xs text-neutral-400">{t("footer.operational")}</span>
        </div>
      </div>
    </footer>
  );
}
