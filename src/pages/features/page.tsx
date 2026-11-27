import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChefHat,
  Layers,
  LayoutGrid,
  Monitor,
  Package,
  Play,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { registerUrlWithFreeTrial } from "@/lib/free-trial.ts";

type FeatureCategory =
  | "all"
  | "pos"
  | "tables"
  | "kds"
  | "inventory"
  | "staff"
  | "reports"
  | "enterprise";

type FeatureCard = {
  id: string;
  category: FeatureCategory;
  icon: typeof Monitor;
};

const FEATURE_CARDS: FeatureCard[] = [
  { id: "pos", category: "pos", icon: Monitor },
  { id: "tables", category: "tables", icon: LayoutGrid },
  { id: "kds", category: "kds", icon: ChefHat },
  { id: "inventory", category: "inventory", icon: Package },
  { id: "staff", category: "staff", icon: Users },
  { id: "reports", category: "reports", icon: BarChart3 },
];

const CATEGORY_TABS: { id: FeatureCategory; icon: typeof Monitor }[] = [
  { id: "all", icon: Sparkles },
  { id: "pos", icon: Monitor },
  { id: "tables", icon: LayoutGrid },
  { id: "kds", icon: ChefHat },
  { id: "inventory", icon: Package },
  { id: "staff", icon: Users },
  { id: "reports", icon: BarChart3 },
  { id: "enterprise", icon: Boxes },
];

const PLAN_META = [
  { id: "starter", icon: Zap, popular: false },
  { id: "professional", icon: Trophy, popular: true },
  { id: "enterprise", icon: Layers, popular: false },
] as const;

function PosHeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand/25 via-transparent to-brand-accent/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.4rem] border border-border bg-[#0b1224] shadow-2xl shadow-brand/20">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 text-[11px] font-medium text-white/50">Vyntex POS</span>
        </div>
        <div className="grid grid-cols-[0.9fr_1.1fr] gap-3 p-4">
          <div className="space-y-2">
            {["Pizza", "Burger", "Pasta", "Drinks"].map((label, i) => (
              <div
                key={label}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-semibold",
                  i === 0
                    ? "bg-gradient-to-r from-brand to-brand-sky text-white"
                    : "bg-white/5 text-white/70",
                )}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-xl bg-white/[0.04] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
              Current order
            </p>
            {[
              ["Margherita", "€9.50"],
              ["Cola", "€2.00"],
              ["Tiramisu", "€4.50"],
            ].map(([name, price]) => (
              <div key={name} className="flex items-center justify-between text-xs text-white/80">
                <span>{name}</span>
                <span className="font-semibold text-brand-accent">{price}</span>
              </div>
            ))}
            <div className="mt-3 border-t border-white/10 pt-2 flex items-center justify-between text-sm font-bold text-white">
              <span>Total</span>
              <span>€16.00</span>
            </div>
            <div className="mt-2 rounded-lg bg-gradient-to-r from-brand to-brand-sky py-2 text-center text-xs font-bold text-white">
              Pay
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-2 w-24 rounded-lg border border-border bg-card p-2 shadow-lg">
        <div className="h-16 rounded bg-muted/80 p-1.5 font-mono text-[8px] leading-tight text-muted-foreground">
          VYNTEX POS
          <br />
          ---------------
          <br />
          Margherita 9.50
          <br />
          Cola 2.00
          <br />
          TOTAL 16.00
        </div>
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const { t } = useTranslation("site");
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<FeatureCategory>("all");

  const visibleCards = useMemo(() => {
    if (activeCategory === "all") return FEATURE_CARDS;
    if (activeCategory === "enterprise") {
      return FEATURE_CARDS.filter((c) => c.id === "inventory" || c.id === "reports");
    }
    return FEATURE_CARDS.filter((c) => c.category === activeCategory);
  }, [activeCategory]);

  const planFeatures = (id: string) => {
    const raw = t(`featuresPage.plans.${id}.items`, { returnObjects: true });
    return Array.isArray(raw) ? (raw as string[]) : [];
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-background pt-28 pb-16 sm:pt-32 sm:pb-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.12),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.10),transparent_45%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              {t("featuresPage.badge")}
            </span>
            <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {t("featuresPage.heroTitleBefore")}{" "}
              <span className="bg-gradient-to-r from-brand to-brand-accent bg-clip-text text-transparent">
                {t("featuresPage.heroTitleHighlight")}
              </span>{" "}
              {t("featuresPage.heroTitleAfter")}{" "}
              <span className="bg-gradient-to-r from-brand to-brand-accent bg-clip-text text-transparent">
                {t("featuresPage.heroTitleRestaurants")}
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              {t("featuresPage.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-12 rounded-full bg-gradient-to-r from-brand to-brand-sky px-7 font-bold text-white shadow-lg shadow-brand/25"
                onClick={() => navigate(registerUrlWithFreeTrial())}
              >
                {t("featuresPage.ctaTrial")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full px-6 font-semibold"
                onClick={() => navigate("/product-demo")}
              >
                <Play className="size-4" />
                {t("featuresPage.ctaDemo")}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="pb-6 lg:pb-0"
          >
            <PosHeroVisual />
          </motion.div>
        </div>
      </section>

      {/* Category tabs + feature grid */}
      <section className="border-t border-border bg-background pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="-mt-6 overflow-x-auto pb-2">
            <div className="inline-flex min-w-full gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:min-w-0 sm:flex-wrap">
              {CATEGORY_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-gradient-to-r from-brand to-brand-sky text-white shadow-md shadow-brand/20"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {t(`featuresPage.tabs.${tab.id}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {visibleCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.article
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: i * 0.04, duration: 0.35 }}
                    className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5"
                  >
                    <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand/15 to-brand-accent/15">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {t(`featuresPage.cards.${card.id}.title`)}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {t(`featuresPage.cards.${card.id}.description`)}
                    </p>
                    <div className="mt-5 flex justify-end">
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand/10 text-primary transition group-hover:bg-brand group-hover:text-white">
                        <ArrowRight className="size-4" />
                      </span>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>

          {activeCategory === "enterprise" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 text-center text-sm text-muted-foreground"
            >
              {t("featuresPage.enterpriseHint")}
            </motion.p>
          ) : null}
        </div>
      </section>

      {/* Plan comparison */}
      <section className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              {t("featuresPage.plansLabel")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("featuresPage.plansTitle")}
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {PLAN_META.map((plan) => {
              const Icon = plan.icon;
              const items = planFeatures(plan.id);
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
                    plan.popular
                      ? "border-brand shadow-lg shadow-brand/10 ring-1 ring-brand/30"
                      : "border-border",
                  )}
                >
                  {plan.popular ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand to-brand-sky px-3 py-1 text-xs font-bold text-white shadow">
                      {t("pricing.mostPopular")}
                    </span>
                  ) : null}
                  <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand/15 to-brand-accent/15">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    {t(`featuresPage.plans.${plan.id}.name`)}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-primary">
                    {t(`featuresPage.plans.${plan.id}.tagline`)}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t(`featuresPage.plans.${plan.id}.description`)}
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn(
                      "mt-8 h-11 w-full rounded-full font-semibold",
                      plan.popular
                        ? "bg-gradient-to-r from-brand to-brand-sky text-white shadow-md shadow-brand/25"
                        : "",
                    )}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate("/pricing")}
                  >
                    {t(`featuresPage.plans.${plan.id}.cta`)}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Full comparison CTA */}
      <section className="border-t border-border bg-background py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <h3 className="text-xl font-bold text-foreground">
              {t("featuresPage.comparisonTitle")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("featuresPage.comparisonSubtitle")}
            </p>
          </div>
          <Button asChild className="rounded-full font-semibold" size="lg">
            <Link to="/pricing">
              {t("featuresPage.comparisonCta")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
